import { useId } from "react";
import type { Equilibrium, PricePoint } from "@/lib/game-types";
export function MarketChart({ points, start, end, equilibrium, shockAt, label = "Trading price over time", sample = false }: { points: PricePoint[]; start: number; end: number; equilibrium?: number | null; shockAt?: number | null; label?: string; sample?: boolean }) {
  const id = useId().replace(/:/g, "");
  const width = 800, height = 260, left = 48, right = 30, top = 24, bottom = 36;
  const prices = points.map(p => p.price);
  const low = Math.max(0, Math.floor((Math.min(30, ...prices, equilibrium ?? 60) - 10) / 20) * 20);
  const high = Math.ceil((Math.max(90, ...prices, equilibrium ?? 60) + 15) / 20) * 20;
  const maxTime = Math.max(end, ...points.map(p => p.at), start + 1);
  const x = (time: number) => left + (time - start) / (maxTime - start) * (width - left - right);
  const y = (price: number) => height - bottom - (price - low) / (high - low) * (height - bottom - top);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.at)},${y(p.price)}`).join(" ");
  const last = points.at(-1);
  return <div className={`chart-wrap ${sample ? "sample-chart" : ""}`}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}><title>{label}</title><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2864e8" stopOpacity=".13" /><stop offset="100%" stopColor="#2864e8" stopOpacity="0" /></linearGradient></defs>
    {[0, 1, 2, 3, 4].map(i => { const p = low + (high - low) * i / 4; return <g key={i}><line x1={left} x2={width - right} y1={y(p)} y2={y(p)} stroke="#e7e9ec" strokeDasharray="3 5" /><text x={left - 12} y={y(p) + 4} textAnchor="end" className="chart-axis">${Math.round(p)}</text></g>; })}
    {equilibrium != null && <g><line x1={left} x2={width - right} y1={y(equilibrium)} y2={y(equilibrium)} stroke="#138965" strokeWidth="2" strokeDasharray="6 5" /><text x={left + 8} y={y(equilibrium) - 9} fill="#138965" fontSize="11" fontWeight="600">Equilibrium / value ${equilibrium.toFixed(0)}</text></g>}
    {shockAt != null && <g><line x1={x(shockAt)} x2={x(shockAt)} y1={top} y2={height - bottom} stroke="#ed8a4b" strokeDasharray="4 4" /><text x={x(shockAt) + 7} y={top + 10} fill="#b9602c" fontSize="11">News breaks</text></g>}
    {points.length > 1 && <path d={`${line} L${x(last!.at)},${height - bottom} L${x(points[0].at)},${height - bottom} Z`} fill={`url(#${id})`} />}<path d={line} fill="none" stroke="#2864e8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{last && <><circle cx={x(last.at)} cy={y(last.price)} r="8" fill="#2864e8" opacity=".12" /><circle cx={x(last.at)} cy={y(last.price)} r="4" fill="#2864e8" /></>}{!points.length && <text x={width / 2} y={height / 2} textAnchor="middle" fill="#8b909a" fontSize="15">The first trade starts the story.</text>}<text x={left} y={height - 8} className="chart-axis">OPEN</text><text x={width - right} y={height - 8} textAnchor="end" className="chart-axis">{sample ? "CLOSE" : `${Math.round((maxTime - start) / 1000)}s`}</text></svg></div>;
}
export function SupplyDemandChart({ data }: { data: Equilibrium }) {
  const count = Math.max(data.demand.length, data.supply.length, 1);
  const x = (i: number) => 45 + i / count * 590, y = (v: number) => 220 - v / 140 * 195;
  const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)} L${x(i + 1)},${y(v)}`).join(" ");
  return <svg viewBox="0 0 680 260" role="img" aria-label="Supply and demand from the class's private values and costs" className="supply-chart"><title>Supply and demand from assigned values and costs</title>{[20, 60, 100].map(v => <g key={v}><line x1="45" x2="640" y1={y(v)} y2={y(v)} stroke="#e7e9ec" /><text x="35" y={y(v) + 4} textAnchor="end" className="chart-axis">${v}</text></g>)}<path d={path(data.demand)} fill="none" stroke="#2864e8" strokeWidth="3" /><path d={path(data.supply)} fill="none" stroke="#eb8157" strokeWidth="3" /><circle cx={x(data.quantity)} cy={y(data.price)} r="6" fill="#171a20" /><text x="50" y="250" className="chart-axis">0</text><text x="640" y="250" textAnchor="end" className="chart-axis">UNITS →</text></svg>;
}
