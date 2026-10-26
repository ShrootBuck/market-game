"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RoomView } from "@/lib/game-types";
import { api, sessionKey } from "@/components/landing";

export function useRoom(code: string, host: boolean) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [fatal, setFatal] = useState(""); const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(false); const [now, setNow] = useState(0);
  const token = useRef(""); const offset = useRef(0); const locked = useRef(false);
  const latest = useRef(0); const lastProfit = useRef<number | null>(null);
  const accept = useCallback((state: RoomView) => {
    if (state.serverNow < latest.current) return;
    latest.current = state.serverNow; offset.current = state.serverNow - Date.now();
    setRoom(state); setNow(state.serverNow); setOnline(true);
    if (state.me && lastProfit.current !== null && state.me.score > lastProfit.current && state.phase === "live") toast.success(`Deal! +${state.me.score - lastProfit.current} points`);
    lastProfit.current = state.me?.score ?? null;
  }, []);
  useEffect(() => {
    token.current = localStorage.getItem(sessionKey(code, host)) || "";
    if (!token.current) { setFatal(host ? "This browser doesn't have the host key for this room. Open it in the browser where you created it." : "Grab a seat before entering the trading floor."); return; }
    let alive = true, timeout: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/game?code=${code}`, { headers: { Authorization: `Bearer ${token.current}` }, cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]) });
        const data = await response.json();
        if (!alive) return;
        if (!response.ok) {
          if ([400, 401, 404].includes(response.status)) { setFatal(data.error); return; }
          throw new Error(data.error);
        }
        accept(data);
      } catch { if (alive) setOnline(false); }
      if (alive) timeout = setTimeout(load, 1000);
    }
    void load();
    const clock = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => { alive = false; clearTimeout(timeout); clearInterval(clock); abort.abort(); };
  }, [code, host, accept]);
  const action = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    if (locked.current) return;
    locked.current = true; setPending(true);
    try { accept(await api({ op: "action", code, action, ...data }, token.current)); }
    catch (err) { toast.error((err as Error).message); }
    finally { locked.current = false; setPending(false); }
  }, [code, accept]);
  return { room, fatal, online, pending, now, action };
}
