import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function Brand() {
  return <Link href="/" className="brand" aria-label="The Market home"><span className="brand-icon"><ArrowUpRight size={23} strokeWidth={3} /></span>the market<span className="brand-period">.</span></Link>;
}
export function LiveDot({ children = "A live classroom experiment" }: { children?: React.ReactNode }) {
  return <span className="live-label"><span className="live-dot" />{children}</span>;
}
