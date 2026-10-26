"use client";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, EyeOff, Minus, ShoppingBag, Store, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { COMPANIES, money, type Choice, type RoomView } from "@/lib/game-types";
import { Panel, type Action } from "@/components/game-parts";
import { cn } from "@/lib/utils";

export function RoleCard({ room }: { room: RoomView }) {
  const me = room.me!;
  if (me.role === "spectator") return <Alert><EyeOff /><AlertTitle>You have a front-row seat.</AlertTitle><AlertDescription>This market already assigned its roles. Watch this round; you&apos;ll trade in the next one.</AlertDescription></Alert>;
  if (room.round === 2) return <div className="portfolio"><div><Wallet size={17} /><span>Cash</span><strong>{money(me.cash)}</strong></div><div><ShoppingBag size={17} /><span>{COMPANIES[room.company].ticker} shares</span><strong>{me.shares}</strong></div></div>;
  const buy = me.role === "buyer";
  return <div className={cn("role-card", buy ? "buyer-role" : "seller-role")}><div className="role-heading"><span>{buy ? <ShoppingBag size={20} /> : <Store size={20} />} You&apos;re a {me.role}.</span><EyeOff size={17} aria-label="Only visible to you" /></div><p>{buy ? "Buy below your value. Keep the difference." : "Sell above your cost. Keep the difference."}</p><div className="private-value"><span>{me.units >= 3 ? "ALL UNITS TRADED" : buy ? "YOUR NEXT UNIT IS WORTH" : "YOUR NEXT UNIT COSTS"}</span><strong>{me.units >= 3 ? "Nice work." : money(me.values[me.units])}</strong></div><div className="unit-strip">{me.values.map((v, i) => <div key={i} className={cn(i < me.units && "unit-done", i === me.units && "unit-current")}><span>UNIT {i + 1}</span><b>{i < me.units ? <Check size={16} /> : money(v)}</b></div>)}</div></div>;
}

export function TradingPanel({ room, action, pending, online }: { room: RoomView; action: Action; pending: boolean; online: boolean }) {
  const me = room.me!;
  const [price, setPrice] = useState("60"); const [choice, setChoice] = useState<Choice>("hold");
  const disabled = pending || !online || room.pausedAt !== null || room.phase !== "live";
  const limit = me.values[me.units];
  useEffect(() => { if (limit !== undefined) setPrice(String(me.role === "buyer" ? Math.max(1, limit - 15) : Math.min(200, limit + 15))); }, [limit, me.role, room.round]);
  useEffect(() => { setChoice(me.choice ?? "hold"); }, [room.beat, me.choice]);
  const myOrder = room.orders.find(o => o.playerId === me.id);
  const buy = me.role === "buyer";
  const best = room.orders.filter(o => o.side === (buy ? "sell" : "buy")).sort((a, b) => buy ? a.price - b.price : b.price - a.price)[0];
  const valid = Number.isInteger(Number(price)) && Number(price) >= 1 && Number(price) <= 200 && (buy ? Number(price) <= limit : Number(price) >= limit);
  const margin = buy ? limit - Number(price) : Number(price) - limit;
  return <Panel title={room.round === 2 ? "Your trading desk" : "Make your move"} description={`Trading as ${me.name}`} className="trading-panel" aside={<Badge variant="secondary">{me.roundScore} pts this round</Badge>}><RoleCard room={room} />
    {me.role !== "spectator" && (room.round === 2 ? <div className="hype-controls"><div className="hype-price"><span>Wave {Math.min(room.beat + 1, 6)} execution price</span><strong>{money(room.currentPrice)}</strong></div><FieldGroup><Field><FieldLabel id="choice-label">Your next move</FieldLabel><ToggleGroup type="single" value={choice} onValueChange={v => { if (v) setChoice(v as Choice); }} variant="outline" size="lg" className="choice-group" aria-labelledby="choice-label" disabled={disabled}><ToggleGroupItem value="buy" disabled={me.cash < room.currentPrice}><ArrowDownRight /> Buy</ToggleGroupItem><ToggleGroupItem value="hold"><Minus /> Hold</ToggleGroupItem><ToggleGroupItem value="sell" disabled={me.shares < 1}><ArrowUpRight /> Sell</ToggleGroupItem></ToggleGroup><FieldDescription>One share per wave. All orders execute at the price above when the wave closes.</FieldDescription></Field><Button disabled={disabled} size="lg" onClick={() => action("choice", { choice })}>{me.choice === choice ? <><Check data-icon="inline-start" /> {choice === "hold" ? "Holding" : `${choice === "buy" ? "Buy" : "Sell"} queued`}</> : <>{me.choice ? "Update" : "Lock in"} {choice} <ArrowRight data-icon="inline-end" /></>}</Button></FieldGroup><p className="small muted">{me.choice ? "You can change your decision until the wave closes." : "No decision? You'll automatically hold."} Final value stays hidden until the reveal.</p></div> : me.units >= 3 ? <Alert className="mt-4"><Check /><AlertTitle>Three deals. Job done.</AlertTitle><AlertDescription>Watch the market and see how your profit stacks up.</AlertDescription></Alert> : <form className="order-form" onSubmit={e => { e.preventDefault(); if (valid) void action("order", { price: Number(price) }); }}><FieldGroup><Field data-invalid={!valid}><FieldLabel htmlFor="offer-price">{buy ? "Your bid ($)" : "Your asking price ($)"}</FieldLabel><Input id="offer-price" type="number" inputMode="numeric" min={buy ? 1 : limit} max={buy ? limit : 200} step={1} value={price} onChange={e => setPrice(e.target.value)} aria-invalid={!valid} required /><FieldDescription>{valid ? `A deal at this price earns you ${margin} points.` : buy ? `Stay at or below your $${limit} value.` : `Stay at or above your $${limit} cost.`}</FieldDescription></Field><Button type="submit" disabled={disabled || !valid} size="lg">{myOrder ? "Replace" : "Post"} {buy ? "bid" : "ask"} <ArrowRight data-icon="inline-end" /></Button></FieldGroup>{myOrder && <div className="open-order"><span>Your {buy ? "bid" : "ask"}: <strong>{money(myOrder.price)}</strong></span><Button type="button" variant="ghost" onClick={() => action("cancel")} disabled={disabled}>Cancel</Button></div>}{best && (buy ? best.price <= limit : best.price >= limit) && <Button type="button" variant="outline" className="w-full mt-3" disabled={disabled} onClick={() => action("order", { price: best.price })}>{buy ? "Buy" : "Sell"} now for {money(best.price)} <Check data-icon="inline-end" /></Button>}<p className="small muted">One open offer at a time. Matching offers trade at the earlier offer&apos;s price.</p></form>)}
  </Panel>;
}

export function OrderBook({ room }: { room: RoomView }) {
  const bids = room.orders.filter(o => o.side === "buy").sort((a, b) => b.price - a.price || a.at - b.at);
  const asks = room.orders.filter(o => o.side === "sell").sort((a, b) => a.price - b.price || a.at - b.at);
  return <Panel title="The order book" description="Live offers from your classmates"><div className="order-book"><div><div className="book-heading buy-text"><span>BUYERS BID</span><ArrowDownRight size={16} /></div>{bids.slice(0, 6).map(o => <div key={o.id} className="book-row"><span>{o.name}</span><strong>{money(o.price)}</strong></div>)}{!bids.length && <p className="book-empty">No bids yet.</p>}</div><div><div className="book-heading sell-text"><span>SELLERS ASK</span><ArrowUpRight size={16} /></div>{asks.slice(0, 6).map(o => <div key={o.id} className="book-row"><span>{o.name}</span><strong>{money(o.price)}</strong></div>)}{!asks.length && <p className="book-empty">No asks yet.</p>}</div></div></Panel>;
}
