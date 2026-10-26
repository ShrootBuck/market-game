# Market Game

A live classroom exchange with a shared host screen, phone controls, and three mini-games.

**Play:** https://market-game.zaydkrunz.com

## Run a class

1. Open the site on the computer you will share and choose **Host a game**.
2. Choose Tesla or SpaceX for Tweet Trader and a round length (two minutes recommended).
3. Share the host screen. Players scan the QR code or enter the five-character room code on their phones. No accounts or downloads.
4. Read each briefing before opening the market. The host advances between the three games; the timer does not run during briefings or results.
5. Use **Pause** whenever you need to explain something. Use the final leaderboard and CSV export for results.

Allow about 10–15 minutes including explanations. For a rehearsal, choose **Try a practice room** to add eight bots. Bot names are labeled. Keep the host tab in the browser where the room was created: the host key is stored there, not in the shared URL. Reloading the same browser reconnects your seat. Join links can be shared freely.

Before presenting, try one practice game and join from a phone on the actual classroom network. The deployment still depends on the server's power/internet, Cloudflare, and the school's network. Pause before closing the host screen or interrupting the session. Timers are server-authoritative and continue when browsers are disconnected. Rooms expire after 24 hours.

## Three mini-games

- **The Trading Floor:** Buyers and sellers each have three private marginal values/costs. They quote integer prices and earn the surplus from each matched trade. Orders match by price then time at the resting order's price. Orders that would lose money are rejected. There is one open order per person.
- **Supply Shock:** The roles swap. Halfway through, seller costs rise by $20 and outstanding orders are cancelled. The class discovers how a shifted supply curve changes price and quantity. The host can trigger the shock early.
- **Tweet Trader:** Everyone starts with $300 and three shares. Six waves let players buy, sell, or hold one share. Trades execute at the displayed quote; net demand changes the *next* quote. Three original parody posts appear on the shared screen. Business events change the hidden final cash-out value, while hype alone does not. Players must weigh actual news against what the crowd might do next.

Tweet Trader's market maker supplies liquidity, so unlike the first two games it does not require a student counterparty for each trade. Quotes move by `round(30 * (buys - sells) / players)`, bounded to $10–$180. Shares cash out at the hidden fundamental value at the end. No borrowing or shorting. The starting portfolio is $480, so the round score is final wealth minus $480. The three round scores add into one leaderboard.

The stocks and companies are real; all game prices, events, and posts are simulated and labeled. SpaceX's June 12, 2026 IPO and SPCX ticker were checked against its [investor FAQ](https://ir.spacex.com/faqs-and-contact/). There is no live stock-price dependency.

The **The economics** panel connects the experiment to linear supply/demand, stable price adjustment, and the expectations model in the class handout. The game's discrete rules are not represented as an exact solution of those differential equations.

## Local development

Requires Node.js 22.13+ (Node 22 is used in production) and Bun 1.4.4.

```sh
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:3000. SQLite data lives in `data/`, excluded from Git. Set `DATA_DIR` to change it.

```sh
bun run test
bun run build
bun run start
```

The live integration test creates its own labeled rehearsal room with 40 players, tests racing orders and 400 concurrent snapshot reads, then runs every timed news wave. It takes about two minutes and does not touch other rooms.

```sh
TEST_URL=http://localhost:3000 bun run test:live
```

Optional `QA_STATE_PATH=/private/tmp/market-qa.json` writes test session credentials with mode 0600 for restart verification. Do not commit or publish that file.

## Deployment

The Dockerfile builds a Next.js standalone application and runs it as the unprivileged `node` user on port 3000. Use the **Dockerfile** build pack in Coolify, repository `ShrootBuck/market-game`, branch `main`, and persistent storage at **`/app/data`**. `GET /api/health` checks actual database access. The Docker health check runs every 20 seconds.

The deployed route uses the existing Cloudflare tunnel: public HTTPS on `market-game.zaydkrunz.com`, encrypted tunnel to the server, then `http://localhost:80` to the local Coolify proxy. The Coolify origin domain is `http://market-game.zaydkrunz.com` and internal container port is 3000. Public TLS is handled by Cloudflare. Do not add an origin HTTPS redirect that loops back through the tunnel.

After pushing a change, use **Redeploy** in the Coolify Market Game project. GitHub automatic deployment webhooks are not configured. Keep the persistent volume attached across redeployments and restarts. Do not delete the volume while any results are needed. Use Coolify rollback to return to the previous image if needed.

For a separate local Docker deployment:

```sh
docker compose up --build -d
```

### Reliability model

One application replica uses a local SQLite database in WAL mode. Room mutations run in synchronous transactions, preventing duplicate fills and stale overwrites. Timers, scoring, private information, and host permissions are enforced on the server. Clients poll every second, automatically reconnect, and disable trading while disconnected. Host/player secrets never appear in share links or public snapshots. Actions have rate limits; request bodies and room sizes are bounded. Rooms allow up to 100 players; the integration rehearsal uses 40.

Run **one replica** against this local volume. Horizontal scaling across separate volumes would create separate game states; redesign storage before attempting it. The persistent volume protects against container replacement, not disk loss. Classroom results are temporary, and no off-server backup is configured. Avoid redeploying during the presentation.
