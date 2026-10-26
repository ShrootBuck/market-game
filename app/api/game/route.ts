import { act, authenticate, GameError, joinRoom, view } from "@/lib/engine";
import { createRoom, rateLimit, withRoom } from "@/lib/store";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, max-age=0" };
function errorResponse(error: unknown) {
  if (error instanceof GameError) return Response.json({ error: error.message }, { status: error.status, headers });
  console.error("Game request failed:", error instanceof Error ? error.message : "Unknown error");
  return Response.json({ error: "The exchange hit a snag. Please try again." }, { status: 500, headers });
}
const tokenFrom = (r: Request) => (r.headers.get("authorization") || "").replace(/^Bearer /, "");
export async function GET(request: Request) {
  try {
    const code = (new URL(request.url).searchParams.get("code") || "").toUpperCase();
    const state = withRoom(code, (room, now) => view(room, tokenFrom(request), now));
    return Response.json(state, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new GameError("Missing request.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new GameError("Request is too large.", 413); }
      chunks.push(value);
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new GameError("Invalid request."); }
    if (!body || Array.isArray(body) || typeof body !== "object") throw new GameError("Invalid request.");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (body.op === "create") {
      rateLimit(`create:${ip}`, 20, 3600000);
      const duration = Number(body.duration ?? 120);
      if (![90, 120, 180].includes(duration)) throw new GameError("Pick a 90-second, 2-minute, or 3-minute round.");
      const room = createRoom(String(body.title || ""), duration, body.company === "spacex" ? "spacex" : "tesla");
      return Response.json({ code: room.code, token: room.hostToken }, { status: 201, headers });
    }
    const code = String(body.code || "").toUpperCase();
    if (body.op === "join") {
      rateLimit(`join:${ip}`, 200, 60000);
      const result = withRoom(code, room => {
        const p = joinRoom(room, String(body.name || ""));
        return { code, token: p.token, id: p.id };
      });
      return Response.json(result, { status: 201, headers });
    }
    const token = tokenFrom(request);
    rateLimit(`act:${code}:${token.slice(0, 40)}`, 30, 10000);
    const result = withRoom(code, (room, now) => {
      authenticate(room, token);
      act(room, token, String(body.action || ""), body, now);
      return view(room, token, now);
    });
    return Response.json(result, { headers });
  } catch (error) { return errorResponse(error); }
}
