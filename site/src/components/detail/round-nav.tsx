"use client";
import { useEffect, useState } from "react";
import type { InterviewRound } from "@/lib/types";

export function RoundNav({ rounds }: { rounds: InterviewRound[] }) {
  const [active, setActive] = useState(rounds[0]?.id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible) setActive(Number(visible.target.id.replace("round-", "")));
      },
      { rootMargin: "-130px 0px -55% 0px", threshold: 0 },
    );
    rounds.forEach((round) => {
      const element = document.getElementById(`round-${round.id}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [rounds]);
  return (
    <nav className="round-nav" aria-label="轮次导航">
      {rounds.map((round) => (
        <a
          href={`#round-${round.id}`}
          key={round.id}
          aria-current={active === round.id ? "location" : undefined}
          onClick={() => setActive(round.id)}
        >
          <span>{round.displayName}</span>
          <span className="round-count">{round.questions.length}</span>
        </a>
      ))}
    </nav>
  );
}
