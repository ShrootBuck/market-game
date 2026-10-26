import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:3100";
async function post(data, token, expected = 200) {
  const res = await fetch(`${base}/api/game`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data), signal: AbortSignal.timeout(12000) });
  const body = await res.json(); assert.equal(res.status, expected, JSON.stringify(body)); return body;
}
async function get(code, token, expected = 200) {
  const res = await fetch(`${base}/api/game?code=${code}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
  assert.equal(res.status, expected); return res.json();
}
const host = await post({ op: "create", title: "QA - presentation rehearsal", duration: 90, company: "spacex" }, null, 201);
const code = host.code;
const act = (action, data = {}, token = host.token, status = 200) => post({ op: "action", code, action, ...data }, token, status);
const players = await Promise.all(Array.from({ length: 40 }, (_, i) => post({ op: "join", code, name: `QA Trader ${i + 1}` }, null, 201)));
assert.equal((await get(code, host.token)).players.length, 40);
await get(code, "invalid", 401); await act("prepare"); await act("start");
const views = await Promise.all(players.map(p => get(code, p.token)));
const buyers = views.map((v, i) => ({ ...players[i], me: v.me })).filter(p => p.me.role === "buyer");
const sellers = views.map((v, i) => ({ ...players[i], me: v.me })).filter(p => p.me.role === "seller");
await act("end", {}, players[0].token, 403);
await act("order", { price: 50 }, sellers[0].token);
await Promise.all(buyers.slice(0, 2).map(p => act("order", { price: 60 }, p.token)));
let room = await get(code, host.token);
assert.equal(room.trades.length, 1, "Concurrent buyers cannot fill the same ask twice");
assert.equal(room.trades[0].price, 50);
assert.equal(room.players.filter(p => p.units === 1).length, 2);
console.log("PASS: 40 joins, authenticated roles, private values, concurrent matching, host authorization.");
const times = [];
for (let batch = 0; batch < 10; batch++) {
  await Promise.all(players.map(async p => { const start = performance.now(); const v = await get(code, p.token); assert.equal(v.me.id, p.id); assert.ok(v.players.every(x => !('values' in x) && !('token' in x))); times.push(performance.now() - start); }));
}
times.sort((a, b) => a - b);
console.log(`PASS: 400 synchronized state reads; median ${Math.round(times[200])}ms, p95 ${Math.round(times[380])}ms.`);
await act("pause");
await act("order", { price: 60 }, buyers[0].token, 400);
room = await act("resume"); assert.equal(room.pausedAt, null);
await act("end"); await act("next"); await act("start");
await act("shock"); room = await get(code, host.token); assert.equal(room.shocked, true); assert.equal(room.orders.length, 0);
await act("end"); await act("next"); room = await act("start");
assert.equal(room.round, 2); assert.equal(room.news.length, 0); assert.equal(room.settlementValue, null);
for (const p of players) await act("choice", { choice: "buy" }, p.token);
console.log("PASS: pause/resume, supply shock, transition into the SpaceX tweet market.");
while (room.phase === "live") {
  await new Promise(resolve => setTimeout(resolve, 2000));
  room = await get(code, host.token);
  if (room.phase === "live") { assert.equal(room.settlementValue, null); assert.ok(room.news.every(n => !('impact' in n))); }
}
assert.equal(room.beat, 6); assert.equal(room.news.length, 3); assert.ok(room.settlementValue !== null);
const me = (await get(code, players[0].token)).me;
assert.equal(me.roundScore, me.cash + me.shares * room.settlementValue - 480);
room = await act("finish"); assert.equal(room.phase, "finished");
if (process.env.QA_STATE_PATH) await writeFile(process.env.QA_STATE_PATH, JSON.stringify({ base, code, hostToken: host.token, playerToken: players[0].token, score: me.score, players: 40 }), { mode: 0o600 });
console.log("PASS: all six timed waves, three news flashes, private payout, final score, and final leaderboard.");
console.log(`COMPLETE: ${base} · room ${code}`);
