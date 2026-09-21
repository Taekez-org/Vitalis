"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function RevisionsNav() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch(`/api/revisoes?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { total?: number };
      if (active) setCount(data.total ?? 0);
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return <Button variant="ghost" size="sm" asChild><Link href="/revisoes">Revisões{count > 0 && <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-risk px-1.5 text-[11px] font-bold text-white">{count > 99 ? "99+" : count}</span>}</Link></Button>;
}
