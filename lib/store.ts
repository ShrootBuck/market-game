import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { GameError, makeCode, makeRoom, tick } from "./engine";
import type { Room } from "./game-types";

const globals = globalThis as unknown as { marketDb?: DatabaseSync };
export function db() {
  if (!globals.marketDb) {
    const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    const database = new DatabaseSync(path.join(dir, "market.sqlite"));
    database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);");
    globals.marketDb = database;
  }
  return globals.marketDb;
}
export function rateLimit(key: string, max: number, windowMs: number) {
  const database = db(), now = Date.now();
  database.prepare("DELETE FROM limits WHERE expires < ?").run(now);
  const row = database.prepare("INSERT INTO limits (key, count, expires) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count").get(key, now + windowMs) as { count: number };
  if (row.count > max) throw new GameError("A little too fast. Wait a moment and try again.", 429);
}
export function createRoom(title: string, duration: number, company: "tesla" | "spacex" = "tesla") {
  const database = db(), now = Date.now();
  database.prepare("DELETE FROM rooms WHERE expires < ?").run(now);
  const count = database.prepare("SELECT COUNT(*) AS n FROM rooms").get() as { n: number };
  if (count.n >= 200) throw new GameError("The exchange is full. Try again later.", 503);
  for (let attempt = 0; attempt < 10; attempt++) {
    const room = makeRoom(makeCode(), title, duration, now);
    room.company = company;
    const result = database.prepare("INSERT OR IGNORE INTO rooms (code, state, expires) VALUES (?, ?, ?)").run(room.code, JSON.stringify(room), now + 86400000);
    if (result.changes) return room;
  }
  throw new GameError("Couldn't create a room. Please try again.", 503);
}
export function withRoom<T>(code: string, fn: (room: Room, now: number) => T): T {
  if (!/^[A-Z2-9]{5}$/.test(code)) throw new GameError("Enter the five-character room code.", 400);
  const database = db(), now = Date.now();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT state FROM rooms WHERE code = ? AND expires > ?").get(code, now) as { state: string } | undefined;
    if (!row) throw new GameError("Room not found. Check the code with your host.", 404);
    const room = JSON.parse(row.state) as Room;
    tick(room, now);
    const result = fn(room, now);
    if (JSON.stringify(room) !== row.state) {
      room.updatedAt = now;
      database.prepare("UPDATE rooms SET state = ? WHERE code = ?").run(JSON.stringify(room), code);
    }
    database.exec("COMMIT");
    return result;
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}
