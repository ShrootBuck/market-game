export type Phase = "lobby" | "briefing" | "live" | "results" | "finished";
export type Role = "buyer" | "seller" | "trader" | "spectator";
export type Choice = "buy" | "sell" | "hold";
export type Company = "tesla" | "spacex";
export type News = { id: string; beat: number; text: string; context: string; impact: number; explanation: string };
export const COMPANIES = { tesla: { name: "Tesla", ticker: "TSLA", symbol: "T" }, spacex: { name: "SpaceX", ticker: "SPCX", symbol: "X" } };

export type Player = {
  id: string; token: string; name: string; avatar: number; bot: boolean;
  role: Role; score: number; roundScore: number; values: number[];
  units: number; cash: number; shares: number; choice: Choice | null;
};
export type Order = { id: string; playerId: string; name: string; side: "buy" | "sell"; price: number; at: number };
export type Trade = { id: string; buyer: string; seller: string; price: number; at: number };
export type PricePoint = { at: number; price: number };
export type RoundResult = { round: number; trades: number; average: number | null; equilibrium: number; scores: { id: string; name: string; score: number }[] };
export type Room = {
  code: string; hostToken: string; createdAt: number; updatedAt: number;
  title: string; duration: number; locked: boolean; phase: Phase; round: number;
  players: Player[]; orders: Order[]; trades: Trade[]; prices: PricePoint[];
  startedAt: number | null; endsAt: number | null; pausedAt: number | null;
  shockAt: number | null; shocked: boolean; beat: number; nextBeatAt: number | null;
  lastBotAt: number; history: RoundResult[];
  company: Company; fundamental: number; news: News[];
};
export type PublicPlayer = Omit<Player, "token" | "values" | "cash" | "shares" | "choice">;
export type Equilibrium = { price: number; low: number; high: number; quantity: number; surplus: number; demand: number[]; supply: number[] };
export type RoomView = Omit<Room, "hostToken" | "players" | "lastBotAt" | "fundamental" | "news"> & {
  players: PublicPlayer[]; me: Omit<Player, "token"> | null; isHost: boolean;
  serverNow: number; equilibrium: Equilibrium | null; initialEquilibrium: Equilibrium | null;
  choicesSubmitted: number; currentPrice: number;
  settlementValue: number | null; news: (Omit<News, "impact" | "explanation"> & { impact?: number; explanation?: string })[];
};

export const ROUNDS = [
  { name: "The invisible hand", short: "Free market", label: "FIND THE BALANCE", color: "blue", description: "Half the room buys. Half sells. Nobody knows everyone else's price. Can you find a deal?", lesson: "Private decisions. A public price. The whole class builds a market without anyone setting its price." },
  { name: "Plot twist.", short: "Supply shock", label: "EXPECT THE UNEXPECTED", color: "orange", description: "New roles, a fresh market, and a news alert that changes the rules halfway through.", lesson: "When production gets more expensive, the supply curve shifts. The old equilibrium is no longer the destination." },
  { name: "Elon has entered the chat.", short: "Tweet trader", label: "TRADE THE EXPECTATION", color: "purple", description: "Six trading waves. Surprise posts. Real news or empty hype? Read the room before you buy the top.", lesson: "News can change a company's value. Hype can change its price. They are not always the same thing." },
] as const;

export const AVATARS = ["#dce8fb", "#fbe4d8", "#daf1df", "#ebe1f8", "#f8edc8", "#d7eff1", "#f6dfe7", "#e6e6e1"];
export const money = (n: number) => `$${n.toFixed(n % 1 ? 1 : 0)}`;
