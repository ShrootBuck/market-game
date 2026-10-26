"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Check, Copy, Download, Radio, Trophy, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AVATARS, COMPANIES, type PublicPlayer, type RoomView } from "@/lib/game-types";
import { cn } from "@/lib/utils";

export type Action = (name: string, data?: Record<string, unknown>) => Promise<void>;
export function Panel({ title, description, children, className, aside }: { title: string; description?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return <Card className={cn("panel", className)}><CardHeader><div className="panel-title-row"><CardTitle>{title}</CardTitle>{aside}</div>{description && <CardDescription>{description}</CardDescription>}</CardHeader><CardContent>{children}</CardContent></Card>;
}
export function PlayerAvatar({ player }: { player: Pick<PublicPlayer, "name" | "avatar"> }) {
  return <Avatar style={{ "--muted": AVATARS[player.avatar] } as React.CSSProperties}><AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>;
}
export function RoomInvite({ code, small = false }: { code: string; small?: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${window.location.origin}/?room=${code}`), [code]);
  async function copy() { try { await navigator.clipboard.writeText(url); toast.success("Join link copied."); } catch { toast.error("Copy the room code from the screen instead."); } }
  return <div className={cn("room-invite", small && "compact-invite")}><div><span className="eyebrow">JOIN THE EXCHANGE</span><p className="join-domain">market-game.zaydkrunz.com</p><div className="big-room-code">{code}</div><Button variant="outline" onClick={copy}><Copy data-icon="inline-start" /> Copy join link</Button></div>{url && <div className="qr-box"><QRCodeSVG value={url} size={small ? 108 : 156} level="M" marginSize={1} title={`Scan to join room ${code}`} /><span>Scan. Join. Trade.</span></div>}</div>;
}
export function Leaderboard({ room, final = false }: { room: RoomView; final?: boolean }) {
  const people = [...room.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return <Panel title={final ? "The closing bell" : "Leaderboard"} description="Total profit across all three markets" aside={<Trophy size={18} />}><div className="leaderboard">{people.slice(0, final ? 100 : 10).map((p, i) => <div key={p.id} className={cn("leader-row", p.id === room.me?.id && "is-me")}><span className="rank">{i > 0 && p.score === people[i - 1].score ? people.findIndex(q => q.score === p.score) + 1 : i + 1}</span><PlayerAvatar player={p} /><span className="leader-name">{p.name}{p.id === room.me?.id && <small> YOU</small>}</span><strong className={p.score < 0 ? "sell-text" : ""}>{p.score}<small> pts</small></strong></div>)}{!people.length && <p className="muted">The first trader takes the lead.</p>}</div>{people.length > 10 && !final && <p className="small muted">Showing the top 10 of {people.length} players.</p>}</Panel>;
}
export function TradeFeed({ room }: { room: RoomView }) {
  return <Panel title="The tape" description={`${room.trades.length} completed trades`} aside={<Radio size={17} />}><div className="trade-feed">{room.trades.slice(-6).reverse().map(t => <div key={t.id} className="tape-row"><span className="trade-check"><Check size={14} /></span><div><strong>{t.buyer}</strong><span> bought from {t.seller}</span></div><b>${t.price}</b></div>)}{!room.trades.length && <Empty><EmptyHeader><EmptyMedia variant="icon"><Radio /></EmptyMedia><EmptyTitle>Quiet on the floor.</EmptyTitle><EmptyDescription>The first completed trade will appear here.</EmptyDescription></EmptyHeader></Empty>}</div></Panel>;
}
export function Tweet({ news, large = false }: { news: RoomView["news"][number]; large?: boolean }) {
  return <div className={cn("tweet", large && "tweet-large")}><div className="tweet-author"><span className="elon-avatar">E</span><div><strong>Elon Musk <span className="verified-dot">✓</span></strong><span>@elonmusk · simulated post</span></div><span className="x-mark" aria-hidden="true">𝕏</span></div><p className="tweet-text">{news.text}</p><div className="tweet-context">{news.context}</div><Badge variant="secondary">PARODY · CLASSROOM GAME</Badge>{news.impact !== undefined && <div className="news-explanation"><strong>{news.impact === 0 ? "All hype. $0 impact." : `${news.impact > 0 ? "+" : "−"}$${Math.abs(news.impact)} to final value.`}</strong><p>{news.explanation}</p></div>}</div>;
}
export function NewsFlash({ room }: { room: RoomView }) {
  const [open, setOpen] = useState(false);
  const news = room.news.at(-1);
  const eventKey = room.round === 1 && room.shocked ? `shock:${room.code}` : news ? news.id : null;
  useEffect(() => {
    if (!eventKey || room.phase !== "live") { setOpen(false); return; }
    const key = `market:seen:${eventKey}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "yes"); setOpen(true);
    const timer = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(timer);
  }, [eventKey, room.phase]);
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="news-flash"><DialogHeader><DialogTitle><span className="news-kicker"><Zap size={17} /> BREAKING ON THE FLOOR</span>{room.round === 1 ? "Supply just got expensive." : "Elon has posted."}</DialogTitle><DialogDescription>{room.round === 1 ? "A factory outage raises every seller's cost by $20. Outstanding offers have been cleared. Check your new costs." : `${COMPANIES[room.company].name} traders, your move. Business news or just noise?`}</DialogDescription></DialogHeader>{room.round === 2 && news && <Tweet news={news} large />}<Button onClick={() => setOpen(false)} size="lg">Back to trading <ArrowRight data-icon="inline-end" /></Button></DialogContent></Dialog>;
}
export function ExportResults({ room }: { room: RoomView }) {
  function download() {
    const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [["Place", "Player", "Free market", "Supply shock", "Tweet trader", "Total"], ...[...room.players].sort((a, b) => b.score - a.score).map((p, i) => [String(i + 1), /^[=+@\-]/.test(p.name) ? `'${p.name}` : p.name, ...[0, 1, 2].map(r => String(room.history.find(h => h.round === r)?.scores.find(s => s.id === p.id)?.score ?? 0)), String(p.score)])];
    const url = URL.createObjectURL(new Blob([lines.map(row => row.map(quote).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `market-${room.code}-results.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <Button variant="outline" onClick={download}><Download data-icon="inline-start" /> Download results</Button>;
}
