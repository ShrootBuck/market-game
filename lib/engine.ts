import { randomInt, randomUUID } from "node:crypto";
import type { Choice, Equilibrium, Player, Room, RoomView } from "./game-types";
import { makeNews } from "./news";

export class GameError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function check(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new GameError(message, status);
}
const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join("");
}
export function makeRoom(code: string, title: string, duration: number, now = Date.now()): Room {
  return { code, hostToken: randomUUID(), createdAt: now, updatedAt: now, title: title.trim().slice(0, 40) || "The classroom exchange", duration, locked: false, phase: "lobby", round: 0, players: [], orders: [], trades: [], prices: [], startedAt: null, endsAt: null, pausedAt: null, shockAt: null, shocked: false, beat: 0, nextBeatAt: null, lastBotAt: 0, history: [], company: "tesla", fundamental: 60, news: [] };
}
export function joinRoom(room: Room, name: string, bot = false) {
  check(!room.locked && room.phase !== "finished", "This room is closed to new players.");
  check(room.players.length < 100, "This room has reached 100 players.");
  const clean = name.trim().replace(/\s+/g, " ");
  check(clean.length >= 1 && clean.length <= 18 && !/[\x00-\x1f\x7f]/.test(clean), "Use a name between 1 and 18 characters.");
  check(!room.players.some(p => p.name.toLowerCase() === clean.toLowerCase()), "That name is taken. Add an initial or choose another.");
  const player: Player = { id: randomUUID(), token: randomUUID(), name: clean, avatar: room.players.length % 8, bot, role: "spectator", score: 0, roundScore: 0, values: [], units: 0, cash: 300, shares: 3, choice: null };
  room.players.push(player);
  return player;
}
export function authenticate(room: Room, token: string) {
  if (token === room.hostToken) return { host: true, player: null };
  const player = room.players.find(p => p.token === token);
  check(player, "Your seat could not be found. Rejoin from the home page.", 401);
  return { host: false, player };
}

export function equilibrium(room: Room, beforeShock = false): Equilibrium {
  const demand = room.players.filter(p => p.role === "buyer").flatMap(p => p.values).sort((a, b) => b - a);
  const supply = room.players.filter(p => p.role === "seller").flatMap(p => p.values.map(v => v - (beforeShock && room.shocked ? 20 : 0))).sort((a, b) => a - b);
  let quantity = 0, surplus = 0;
  while (quantity < Math.min(demand.length, supply.length) && demand[quantity] >= supply[quantity]) {
    surplus += demand[quantity] - supply[quantity]; quantity++;
  }
  if (!quantity) return { price: 60, low: 60, high: 60, quantity: 0, surplus: 0, demand, supply };
  const low = Math.max(supply[quantity - 1], demand[quantity] ?? 0);
  const high = Math.min(demand[quantity - 1], supply[quantity] ?? 200);
  return { price: (low + high) / 2, low, high, quantity, surplus, demand, supply };
}

function prepare(room: Room) {
  room.phase = "briefing";
  room.orders = []; room.trades = []; room.prices = [];
  room.startedAt = null; room.endsAt = null; room.pausedAt = null;
  room.shockAt = null; room.shocked = false; room.beat = 0; room.nextBeatAt = null;
  room.fundamental = 60; room.news = room.round === 2 ? makeNews(room.company) : [];
  const people = shuffle([...room.players]);
  let buyers = 0, sellers = 0;
  people.forEach((p, i) => {
    p.roundScore = 0; p.units = 0; p.cash = 300; p.shares = 3; p.choice = null;
    if (room.round === 2) { p.role = "trader"; p.values = []; return; }
    // In round two, returning buyers and sellers swap sides. Late arrivals balance the room.
    p.role = room.round === 1 && p.role !== "spectator" ? (p.role === "buyer" ? "seller" : "buyer") : (buyers <= sellers ? "buyer" : "seller");
    if (p.role === "buyer") buyers++; else sellers++;
    const offset = (i % 5) * 5 - 10;
    p.values = p.role === "buyer" ? [100 + offset, 80 + offset, 60 + offset] : [20 + offset, 40 + offset, 60 + offset];
  });
}

function finish(room: Room) {
  if (room.phase !== "live") return;
  if (room.round === 2) {
    for (const p of room.players.filter(p => p.role === "trader")) {
      p.roundScore = p.cash + p.shares * room.fundamental - 480;
      p.score += p.roundScore;
    }
  }
  room.phase = "results"; room.orders = []; room.pausedAt = null;
  room.history.push({ round: room.round, trades: room.trades.length, average: room.trades.length ? room.trades.reduce((s, t) => s + t.price, 0) / room.trades.length : null, equilibrium: room.round === 2 ? room.fundamental : equilibrium(room).price, scores: room.players.map(p => ({ id: p.id, name: p.name, score: p.roundScore })) });
}

function shock(room: Room, now: number) {
  check(room.round === 1 && room.phase === "live" && !room.shocked, "The supply shock is not available right now.");
  room.shocked = true; room.shockAt = now;
  for (const p of room.players) if (p.role === "seller") p.values = p.values.map(v => v + 20);
  room.orders = [];
}

function placeOrder(room: Room, p: Player, price: number, now: number) {
  check(room.round < 2 && (p.role === "buyer" || p.role === "seller"), "You can trade in the next market.");
  check(p.units < 3, "You've traded all three units. Nicely done.");
  check(Number.isInteger(price) && price >= 1 && price <= 200, "Choose a whole-dollar price from $1 to $200.");
  const buyer = p.role === "buyer";
  const limit = p.values[p.units];
  check(buyer ? price <= limit : price >= limit, buyer ? `Your next unit is worth $${limit}. Don't pay more than that.` : `Your next unit costs $${limit}. Don't sell below that.`);
  room.orders = room.orders.filter(o => o.playerId !== p.id);
  const match = room.orders.filter(o => o.side === (buyer ? "sell" : "buy") && (buyer ? o.price <= price : o.price >= price)).sort((a, b) => (buyer ? a.price - b.price : b.price - a.price) || a.at - b.at)[0];
  if (match) {
    const other = room.players.find(person => person.id === match.playerId)!;
    check(other && other.units < 3, "That offer has already traded. Try again.");
    const b = buyer ? p : other, s = buyer ? other : p;
    const buyerProfit = b.values[b.units] - match.price;
    const sellerProfit = match.price - s.values[s.units];
    check(buyerProfit >= 0 && sellerProfit >= 0, "That quote is no longer valid. Try another price.");
    b.score += buyerProfit; b.roundScore += buyerProfit; b.units++;
    s.score += sellerProfit; s.roundScore += sellerProfit; s.units++;
    room.orders = room.orders.filter(o => o.id !== match.id);
    room.trades.push({ id: randomUUID(), buyer: b.name, seller: s.name, price: match.price, at: now });
    room.prices.push({ at: now, price: match.price });
  } else {
    room.orders.push({ id: randomUUID(), playerId: p.id, name: p.name, side: buyer ? "buy" : "sell", price, at: now });
  }
}

function settleWave(room: Room, now: number) {
  const people = room.players.filter(p => p.role === "trader");
  const previous = room.prices.at(-1)?.price ?? 60;
  // Orders execute at the displayed price. Their imbalance moves the NEXT wave's quote.
  // The simulated market maker provides liquidity; this is not a double auction.
  let buys = 0, sells = 0;
  for (const p of people) {
    if (p.choice === "buy" && p.cash >= previous) {
      p.cash -= previous; p.shares++; buys++;
      room.trades.push({ id: randomUUID(), buyer: p.name, seller: "Market maker", price: previous, at: now });
    } else if (p.choice === "sell" && p.shares > 0) {
      p.cash += previous; p.shares--; sells++;
      room.trades.push({ id: randomUUID(), buyer: "Market maker", seller: p.name, price: previous, at: now });
    }
    p.choice = null;
  }
  const price = Math.max(10, Math.min(180, previous + Math.round(30 * (buys - sells) / Math.max(1, people.length))));
  room.prices.push({ at: now, price });
  room.beat++;
  for (const news of room.news) if (news.beat === room.beat) room.fundamental += news.impact;
  if (room.beat >= 6) finish(room);
  else room.nextBeatAt = now + room.duration * 1000 / 6;
}

export function tick(room: Room, now = Date.now()) {
  if (room.phase !== "live" || room.pausedAt !== null) return;
  if (room.round === 1 && !room.shocked && room.shockAt && now >= room.shockAt) shock(room, room.shockAt);
  if (room.round === 2) {
    while (room.phase === "live" && room.nextBeatAt && now >= room.nextBeatAt) settleWave(room, room.nextBeatAt);
  }
  if (room.phase !== "live") return;
  if (room.endsAt && now >= room.endsAt) { finish(room); return; }
  if (now - room.lastBotAt >= 2200) {
    room.lastBotAt = now;
    for (const p of shuffle(room.players.filter(p => p.bot))) {
      if (room.round === 2) {
        // Practice bots deliberately chase the trend early and sell late.
        if (!p.choice) p.choice = room.beat < 3 ? "buy" : room.beat === 3 ? "hold" : "sell";
      } else if (p.units < 3) {
        const limit = p.values[p.units];
        const elapsed = (now - (room.startedAt ?? now)) / (room.duration * 1000);
        const margin = Math.max(1, Math.round(26 * (1 - elapsed)) + randomInt(7));
        const price = p.role === "buyer" ? Math.max(1, limit - margin) : Math.min(200, limit + margin);
        placeOrder(room, p, price, now);
      }
    }
  }
}

export function act(room: Room, token: string, action: string, data: Record<string, unknown> = {}, now = Date.now()) {
  tick(room, now);
  const { host, player } = authenticate(room, token);
  if (["prepare", "start", "pause", "resume", "end", "next", "shock", "lock", "bots", "kick", "finish"].includes(action)) {
    check(host, "Only the host can control the room.", 403);
    if (action === "prepare") { check(room.phase === "lobby", "This room has already started."); check(room.players.length >= 2, "You need at least two players. Add practice traders to try it solo."); prepare(room); }
    if (action === "start") {
      check(room.phase === "briefing", "The round is not ready to start.");
      room.phase = "live"; room.startedAt = now; room.endsAt = now + room.duration * 1000; room.lastBotAt = now;
      if (room.round === 1) room.shockAt = now + room.duration * 500;
      if (room.round === 2) { room.prices = [{ at: now, price: 60 }]; room.nextBeatAt = now + room.duration * 1000 / 6; }
    }
    if (action === "pause") { check(room.phase === "live" && room.pausedAt === null, "The round is not running."); room.pausedAt = now; }
    if (action === "resume") {
      check(room.phase === "live" && room.pausedAt !== null, "The round is not paused.");
      const delay = now - room.pausedAt;
      room.endsAt! += delay; if (room.shockAt && !room.shocked) room.shockAt += delay;
      if (room.nextBeatAt) room.nextBeatAt += delay;
      room.pausedAt = null;
    }
    if (action === "end") { check(room.phase === "live", "No round is running."); finish(room); }
    if (action === "next") { check(room.phase === "results" && room.round < 2, "There is no next round."); room.round++; prepare(room); }
    if (action === "finish") { check(room.phase === "results" && room.round === 2, "Finish the last market first."); room.phase = "finished"; }
    if (action === "shock") { check(room.pausedAt === null, "Resume before releasing the news."); shock(room, now); }
    if (action === "lock") room.locked = !room.locked;
    if (action === "bots") {
      check(room.phase === "lobby", "Practice traders can only join the lobby.");
      check(room.players.filter(p => p.bot).length === 0, "Practice traders are already here.");
      ["Ada", "Nash", "Keynes", "Joan", "Smith", "Elinor", "Hayek", "Vernon"].forEach(name => joinRoom(room, `${name} [bot]`, true));
    }
    if (action === "kick") {
      check(room.phase === "lobby", "Players can be removed in the lobby.");
      room.players = room.players.filter(p => p.id !== data.id);
    }
    return;
  }
  check(player, "Join as a player to trade.", 403);
  check(room.phase === "live" && room.pausedAt === null, "Trading is closed. Wait for the host.");
  if (action === "order") placeOrder(room, player, Number(data.price), now);
  else if (action === "cancel") room.orders = room.orders.filter(o => o.playerId !== player.id);
  else if (action === "choice") {
    check(room.round === 2 && player.role === "trader", "You can join the next market.");
    check(["buy", "sell", "hold"].includes(String(data.choice)), "Pick buy, hold, or sell.");
    const choice = data.choice as Choice;
    check(choice !== "buy" || player.cash >= (room.prices.at(-1)?.price ?? 60), "You don't have enough cash to buy a share.");
    check(choice !== "sell" || player.shares > 0, "You have no shares left to sell.");
    player.choice = choice;
  } else throw new GameError("Unknown action.");
}

export function view(room: Room, token: string, now = Date.now()): RoomView {
  const { host, player } = authenticate(room, token);
  const { hostToken: _secret, players, lastBotAt: _botTime, fundamental, news, ...publicRoom } = room;
  const me = player ? (({ token: _token, ...rest }) => rest)(player) : null;
  const reveal = room.phase === "results" || room.phase === "finished";
  return { ...publicRoom, players: players.map(({ token: _t, values: _v, cash: _c, shares: _s, choice: _ch, ...p }) => p), me, isHost: host, serverNow: now, equilibrium: reveal && room.round < 2 ? equilibrium(room) : null, initialEquilibrium: reveal && room.round === 1 ? equilibrium(room, true) : null, choicesSubmitted: players.filter(p => p.choice !== null).length, currentPrice: room.prices.at(-1)?.price ?? 60, settlementValue: reveal && room.round === 2 ? fundamental : null, news: news.filter(n => n.beat <= room.beat).map(({ impact, explanation, ...n }) => reveal ? { ...n, impact, explanation } : n) };
}
