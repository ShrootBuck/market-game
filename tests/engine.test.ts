import test from "node:test";
import assert from "node:assert/strict";
import { act, authenticate, equilibrium, joinRoom, makeRoom, tick, view } from "../lib/engine";
import type { Room } from "../lib/game-types";

const NOW = 1_000_000;
function fixture(count = 4) {
  const room = makeRoom("ABCDE", "Test exchange", 120, NOW);
  for (let i = 0; i < count; i++) joinRoom(room, `Trader ${i}`);
  act(room, room.hostToken, "prepare", {}, NOW);
  act(room, room.hostToken, "start", {}, NOW);
  return room;
}
function next(room: Room) {
  act(room, room.hostToken, "end", {}, NOW + 10);
  act(room, room.hostToken, "next", {}, NOW + 20);
  act(room, room.hostToken, "start", {}, NOW + 30);
}

test("crossed quotes execute at resting price and conserve total surplus", () => {
  const r = fixture(), buyer = r.players.find(p => p.role === "buyer")!, seller = r.players.find(p => p.role === "seller")!;
  act(r, seller.token, "order", { price: 50 }, NOW + 1);
  act(r, buyer.token, "order", { price: 70 }, NOW + 2);
  assert.equal(r.trades[0].price, 50);
  assert.equal(buyer.score, buyer.values[0] - 50);
  assert.equal(seller.score, 50 - seller.values[0]);
  assert.equal(buyer.score + seller.score, buyer.values[0] - seller.values[0]);
  assert.equal(buyer.units, 1); assert.equal(seller.units, 1); assert.equal(r.orders.length, 0);
});
test("quotes obey price-time priority and a player can only have one open order", () => {
  const r = fixture(6), sellers = r.players.filter(p => p.role === "seller"), buyer = r.players.find(p => p.role === "buyer")!;
  act(r, sellers[0].token, "order", { price: 60 }, NOW + 1);
  act(r, sellers[1].token, "order", { price: 50 }, NOW + 2);
  act(r, sellers[2].token, "order", { price: 50 }, NOW + 3);
  act(r, buyer.token, "order", { price: 70 }, NOW + 4);
  assert.equal(r.trades[0].seller, sellers[1].name);
  act(r, sellers[0].token, "order", { price: 65 }, NOW + 5);
  assert.equal(r.orders.filter(o => o.playerId === sellers[0].id).length, 1);
});
test("invalid quotes, unprofitable quotes, and fourth units are rejected", () => {
  const r = fixture(), buyer = r.players.find(p => p.role === "buyer")!, seller = r.players.find(p => p.role === "seller")!;
  for (const price of [0, -1, 201, 1.5, NaN, Infinity]) assert.throws(() => act(r, buyer.token, "order", { price }, NOW + 1));
  assert.throws(() => act(r, buyer.token, "order", { price: buyer.values[0] + 1 }, NOW + 1));
  assert.throws(() => act(r, seller.token, "order", { price: seller.values[0] - 1 }, NOW + 1));
  buyer.units = 3; assert.throws(() => act(r, buyer.token, "order", { price: 50 }, NOW + 1));
});
test("only the host controls the market; invalid tokens fail", () => {
  const r = fixture();
  assert.throws(() => act(r, r.players[0].token, "end", {}, NOW + 1));
  assert.throws(() => act(r, "invalid", "pause", {}, NOW + 1));
  assert.throws(() => authenticate(r, ""));
  assert.equal(r.phase, "live");
});
test("serialized player and host views never expose other players' secrets", () => {
  const r = fixture(), v = view(r, r.players[0].token, NOW), h = view(r, r.hostToken, NOW);
  assert.equal(v.me?.id, r.players[0].id); assert.equal(h.me, null);
  for (const p of v.players) { assert.ok(!("token" in p)); assert.ok(!("values" in p)); assert.ok(!("cash" in p)); assert.ok(!("choice" in p)); }
  assert.ok(!JSON.stringify(v).includes(r.hostToken));
  assert.equal(v.equilibrium, null); assert.equal(h.equilibrium, null);
  assert.ok(!("fundamental" in v));
});
test("join validation, locking, and late-arrival spectator behavior", () => {
  const r = makeRoom("ABCDE", "Test", 120, NOW);
  joinRoom(r, "Ada");
  assert.throws(() => joinRoom(r, " ada ")); assert.throws(() => joinRoom(r, "")); assert.throws(() => joinRoom(r, "a".repeat(19)));
  r.locked = true; assert.throws(() => joinRoom(r, "Other")); r.locked = false;
  joinRoom(r, "Other"); act(r, r.hostToken, "prepare", {}, NOW);
  const late = joinRoom(r, "Late"); assert.equal(late.role, "spectator");
  act(r, r.hostToken, "start", {}, NOW); assert.throws(() => act(r, late.token, "order", { price: 50 }, NOW + 1));
  next(r); assert.notEqual(late.role, "spectator");
});
test("pause freezes timers and trading, resume shifts all deadlines", () => {
  const r = fixture(); next(r);
  const originalEnd = r.endsAt!, originalShock = r.shockAt!;
  act(r, r.hostToken, "pause", {}, NOW + 100);
  tick(r, NOW + 200_000); assert.equal(r.phase, "live"); assert.equal(r.shocked, false);
  assert.throws(() => act(r, r.players[0].token, "order", { price: 50 }, NOW + 200_000));
  act(r, r.hostToken, "resume", {}, NOW + 200_100);
  assert.equal(r.endsAt, originalEnd + 200_000); assert.equal(r.shockAt, originalShock + 200_000);
});
test("automatic supply shock happens once, clears stale quotes, and preserves earned profit", () => {
  const r = fixture(); next(r);
  const seller = r.players.find(p => p.role === "seller")!, originalCost = seller.values[0];
  act(r, seller.token, "order", { price: 55 }, NOW + 50);
  tick(r, r.shockAt!);
  assert.equal(seller.values[0], originalCost + 20); assert.equal(r.orders.length, 0);
  tick(r, NOW + 60_100); assert.equal(seller.values[0], originalCost + 20);
  assert.equal(seller.score, 0);
});
test("round two swaps buyers and sellers", () => {
  const r = fixture(8), roles = r.players.map(p => p.role); next(r);
  r.players.forEach((p, i) => assert.equal(p.role, roles[i] === "buyer" ? "seller" : "buyer"));
});
test("expiry finalizes exactly once, cancels open orders, and reveals equilibrium", () => {
  const r = fixture(); tick(r, r.endsAt!);
  assert.equal(r.phase, "results"); assert.equal(r.history.length, 1);
  tick(r, NOW + 999999); assert.equal(r.history.length, 1);
  assert.ok(view(r, r.hostToken).equilibrium); assert.equal(r.orders.length, 0);
});
test("equilibrium interval is consistent with ordered values and costs", () => {
  const r = fixture(), eq = equilibrium(r);
  assert.ok(eq.low <= eq.high); assert.ok(eq.quantity > 0); assert.ok(eq.surplus >= 0);
  assert.ok(eq.demand[eq.quantity - 1] >= eq.high);
  assert.ok(eq.supply[eq.quantity - 1] <= eq.low);
});
test("hype choices execute at the displayed price, then affect the next price", () => {
  const r = fixture(); next(r); next(r);
  for (const p of r.players) act(r, p.token, "choice", { choice: "buy" }, NOW + 100);
  tick(r, r.nextBeatAt!);
  assert.equal(r.prices.at(-1)!.price, 90);
  for (const p of r.players) { assert.equal(p.cash, 240); assert.equal(p.shares, 4); assert.equal(p.choice, null); }
  assert.ok(r.trades.every(t => t.price === 60));
});
test("hype preserves hidden value and future news until the proper reveal", () => {
  const r = fixture(); next(r); next(r);
  let v = view(r, r.players[0].token, NOW);
  assert.equal(v.news.length, 0); assert.equal(v.settlementValue, null); assert.ok(!("fundamental" in v));
  tick(r, r.nextBeatAt!); v = view(r, r.players[0].token, NOW);
  assert.equal(v.news.length, 1); assert.ok(!("impact" in v.news[0])); assert.ok(!("explanation" in v.news[0]));
  tick(r, r.endsAt!); v = view(r, r.players[0].token, NOW);
  assert.equal(v.news.length, 3); assert.equal(v.settlementValue, r.fundamental); assert.ok("impact" in v.news[0]);
});
test("a vote replacement is not an extra order; no borrowing or short selling", () => {
  const r = fixture(); next(r); next(r); const p = r.players[0];
  act(r, p.token, "choice", { choice: "buy" }, NOW + 100);
  act(r, p.token, "choice", { choice: "sell" }, NOW + 101);
  tick(r, r.nextBeatAt!); assert.equal(p.cash, 360); assert.equal(p.shares, 2);
  p.cash = 0; assert.throws(() => act(r, p.token, "choice", { choice: "buy" }, r.nextBeatAt! - 1));
  p.shares = 0; assert.throws(() => act(r, p.token, "choice", { choice: "sell" }, r.nextBeatAt! - 1));
});
test("six-wave completion settles positions once and preserves prior-round scores", () => {
  const r = fixture(); r.players[0].score = 50; next(r); next(r);
  const p = r.players[0]; tick(r, r.endsAt!);
  assert.equal(r.beat, 6); assert.equal(r.phase, "results");
  assert.equal(p.roundScore, p.cash + p.shares * r.fundamental - 480);
  assert.equal(p.score, 50 + p.roundScore);
  const score = p.score; tick(r, NOW + 999999); assert.equal(p.score, score);
  act(r, r.hostToken, "finish", {}, NOW + 999999); assert.equal(r.phase, "finished");
});
test("practice traders generate actual trades through the same matching engine", () => {
  const r = makeRoom("ABCDE", "Practice", 120, NOW);
  act(r, r.hostToken, "bots", {}, NOW); assert.equal(r.players.length, 8);
  act(r, r.hostToken, "prepare", {}, NOW); act(r, r.hostToken, "start", {}, NOW);
  for (let t = NOW + 3000; t < NOW + 120000; t += 3000) tick(r, t);
  assert.ok(r.trades.length > 0); assert.ok(r.players.every(p => p.units <= 3));
});
