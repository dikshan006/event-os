"use client";
import { useEffect, useState } from "react";

export function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor(diff / 3_600_000) % 24;
  const m = Math.floor(diff / 60_000) % 60;
  return (
    <div className="s-count">
      {[[d, "Days"], [h, "Hours"], [m, "Minutes"]].map(([n, u]) => (
        <div className="t" key={u as string}><div className="n">{n as number}</div><div className="u">{u as string}</div></div>
      ))}
    </div>
  );
}
