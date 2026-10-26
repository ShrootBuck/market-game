"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleHelp, Loader2, Monitor, Radio, Smartphone, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brand, LiveDot } from "@/components/brand";
import { Education } from "@/components/education";
import { MarketChart } from "@/components/market-chart";
import { ROUNDS, type Company } from "@/lib/game-types";
export async function api(data: Record<string, unknown>, token?: string) {
  const response = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}
export const sessionKey = (code: string, host: boolean) => `market:${host ? "host" : "player"}:${code}`;
export function saveSession(code: string, token: string, host: boolean) {
  localStorage.setItem(sessionKey(code, host), token);
  localStorage.setItem("market:last", JSON.stringify({ code, host }));
}
const sample = [38, 45, 41, 54, 48, 58, 52, 65, 60, 57, 63, 61, 62].map((price, at) => ({ price, at: at * 10 }));
export function Landing() {
  const router = useRouter();
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const [hostOpen, setHostOpen] = useState(false); const [title, setTitle] = useState("The classroom exchange");
  const [duration, setDuration] = useState(120); const [company, setCompany] = useState<Company>("tesla");
  const [last, setLast] = useState<{ code: string; host: boolean } | null>(null);
  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get("room")?.toUpperCase().slice(0, 5) || "");
    try { setLast(JSON.parse(localStorage.getItem("market:last") || "null")); } catch { /* A stale saved seat is optional. */ }
  }, []);
  async function join(e: React.FormEvent) {
    e.preventDefault(); setError(""); setPending(true);
    try {
      const oldToken = localStorage.getItem(sessionKey(code, false));
      if (oldToken) {
        const check = await fetch(`/api/game?code=${code}`, { headers: { Authorization: `Bearer ${oldToken}` }, signal: AbortSignal.timeout(8000) });
        if (check.ok) { router.push(`/play/${code}`); return; }
      }
      const result = await api({ op: "join", code, name }); saveSession(result.code, result.token, false); router.push(`/play/${result.code}`);
    } catch (err) { setError((err as Error).message); } finally { setPending(false); }
  }
  async function create(practice = false) {
    setError(""); setPending(true);
    try {
      const result = await api({ op: "create", title: practice ? "Practice exchange" : title, duration, company });
      saveSession(result.code, result.token, true);
      if (practice) await api({ op: "action", code: result.code, action: "bots" }, result.token);
      router.push(`/host/${result.code}`);
    } catch (err) { setError((err as Error).message); } finally { setPending(false); }
  }
  return <div className="site-shell"><header className="site-header"><Brand /><nav><Education /><Education math /><Badge variant="outline" className="header-pill"><Users data-icon="inline-start" /> Built for the whole room</Badge></nav></header><main>
    <section className="hero"><div className="hero-copy"><LiveDot /><h1>The market<br />is made of <span>you.</span><svg viewBox="0 0 240 12" aria-hidden="true"><path d="M4 7 Q120 -3 235 7" /></svg></h1><p>Buy. Sell. Panic a little.<br />Turn your classroom into a live trading floor.</p><div className="hero-notes"><span><Check size={15} /> No account needed</span><span><Check size={15} /> 3 mini-games</span><span><Check size={15} /> One very real leaderboard</span></div></div>
    <div className="entry-card"><div className="entry-heading"><span className="mini-icon"><Smartphone size={21} /></span><span className="eyebrow">YOUR SEAT ON THE TRADING FLOOR</span></div><h2>Got a room code?</h2><p>Join on your phone. Make your move.</p><form onSubmit={join}>
      <FieldGroup className="gap-4">
        <Field data-disabled={pending} data-invalid={!!error && !hostOpen}>
          <FieldLabel htmlFor="room-code">Room code</FieldLabel>
          <Input id="room-code" variant="code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 5))} placeholder="ABCDE" maxLength={5} required autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={pending} aria-invalid={!!error && !hostOpen} />
        </Field>
        <Field data-disabled={pending}>
          <FieldLabel htmlFor="player-name">Your trading name</FieldLabel>
          <Input id="player-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Warren Buff-it" maxLength={18} required autoComplete="nickname" disabled={pending} />
        </Field>
        {error && !hostOpen && <FieldError>{error}</FieldError>}
        <Button className="primary-cta" size="xl" type="submit" disabled={pending || code.length !== 5 || !name.trim()}>{pending ? <><Loader2 className="spin" data-icon="inline-start" /> Joining...</> : <>Join the market <ArrowRight data-icon="inline-end" /></>}</Button>
      </FieldGroup>
    </form><div className="entry-divider"><Separator className="flex-1" /><span>Running the show?</span><Separator className="flex-1" /></div><Dialog open={hostOpen} onOpenChange={v => { setHostOpen(v); setError(""); }}><DialogTrigger asChild><Button variant="outline" className="host-cta" size="lg"><Monitor data-icon="inline-start" /> Host a game <ChevronRight data-icon="inline-end" /></Button></DialogTrigger><DialogContent className="host-dialog"><DialogHeader><DialogTitle>Open your exchange.</DialogTitle><DialogDescription>Share the host screen. Everyone else joins with a room code.</DialogDescription></DialogHeader><FieldGroup className="gap-5">
        <Field><FieldLabel htmlFor="session-title">Room name</FieldLabel><Input id="session-title" maxLength={40} value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field><FieldLabel id="round-duration-label">Time per mini-game</FieldLabel>
          <ToggleGroup type="single" variant="outline" size="lg" className="w-full" value={String(duration)} onValueChange={v => v && setDuration(Number(v))} aria-labelledby="round-duration-label">
            <ToggleGroupItem value="90" className="flex-1">90 sec</ToggleGroupItem><ToggleGroupItem value="120" className="flex-1">2 min</ToggleGroupItem><ToggleGroupItem value="180" className="flex-1">3 min</ToggleGroupItem>
          </ToggleGroup><FieldDescription>Two minutes is a good starting point.</FieldDescription>
        </Field>
        <Field><FieldLabel id="hype-company-label">Company for Tweet Trader</FieldLabel>
          <ToggleGroup type="single" variant="outline" size="lg" className="w-full" value={company} onValueChange={v => v && setCompany(v as Company)} aria-labelledby="hype-company-label">
            <ToggleGroupItem value="tesla" className="flex-1">Tesla · TSLA</ToggleGroupItem><ToggleGroupItem value="spacex" className="flex-1">SpaceX · SPCX</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </FieldGroup><p className="small muted">Real companies. Simulated prices and clearly labeled parody posts. Each round has a briefing and a reveal.</p>{error && <FieldError>{error}</FieldError>}<Button className="primary-cta" size="xl" onClick={() => create()} disabled={pending}>{pending ? <><Loader2 className="spin" data-icon="inline-start" /> Creating...</> : <>Create room <ArrowRight data-icon="inline-end" /></>}</Button></DialogContent></Dialog></div></section>
    {last && <div className="resume-strip"><Radio size={16} /><span>Your previous room: <strong>{last.code}</strong></span><Button variant="link" onClick={() => router.push(`/${last.host ? "host" : "play"}/${last.code}`)}>Return to room <ArrowRight size={14} /></Button></div>}
    <section className="floor-preview" aria-label="Example of the live market display"><div className="preview-top"><div><span className="eyebrow">A LITTLE COMPETITION. A LOT OF ECONOMICS.</span><h2>Watch the room become a market.</h2></div><Badge variant="outline">Illustrative trading floor</Badge></div><div className="preview-body"><div className="preview-chart"><div className="quote-heading"><span className="stock-symbol">MKT</span><div><p>Classroom exchange</p><div className="quote-value">$62<span><ArrowUpRight size={15} /> A price you discovered</span></div></div></div><MarketChart points={sample} start={0} end={120} sample /></div><div className="preview-activity"><div className="eyebrow">THE FLOOR IS TALKING</div><div className="example-trade"><span className="trade-icon buy"><ArrowDownRight size={19} /></span><div><strong>Someone sees a bargain.</strong><p>A buyer places a bid.</p></div><span className="buy-text">BUY</span></div><div className="example-trade"><span className="trade-icon sell"><ArrowUpRight size={19} /></span><div><strong>Someone sees a profit.</strong><p>A seller takes the offer.</p></div><span className="sell-text">SELL</span></div><div className="example-news"><Zap size={18} /><div><strong>Then Elon hits post.</strong><p>Suddenly, everyone has an opinion.</p></div></div><p className="preview-caption">Your choices make the chart.<br />The chart changes your choices.</p></div></div></section>
    <section className="rounds-section"><div className="section-heading"><div><span className="eyebrow">THE GAME PLAN</span><h2>Three markets. Zero chill.</h2></div><Button variant="ghost" onClick={() => create(true)} disabled={pending}><CircleHelp data-icon="inline-start" /> Try a practice room <ArrowUpRight size={16} /></Button></div><div className="round-cards">{ROUNDS.map((r, i) => <article key={r.short} className={`round-card ${r.color}`}><div className="round-number">0{i + 1}<span>{["BUYERS VS. SELLERS", "A BREAKING NEWS MOMENT", "THE CROWD VS. THE HYPE"][i]}</span></div><h3>{r.short}</h3><p>{r.description}</p><span className="round-tag">{["Find equilibrium", "React to a supply shock", "Read the news. Read the room."][i]} <ArrowUpRight size={14} /></span></article>)}</div></section>
    </main><footer className="site-footer"><Brand /><span>A classroom experiment in supply, demand & human behavior.</span><span>Play the market. Learn the market.</span></footer></div>;
}
