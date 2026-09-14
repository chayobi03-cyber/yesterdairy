"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps a `local_date` cookie in sync with the viewer's own device clock, so
// server components can read the viewer's actual local "today" (lib/today.ts)
// instead of the server's clock (UTC on Vercel) -- otherwise an entry written
// just after midnight KST could get silently stamped with the previous day.
export function LocalDateSync() {
  const router = useRouter();

  useEffect(() => {
    const sync = () => {
      const today = new Date().toLocaleDateString("sv-SE");
      const match = document.cookie.match(/(?:^|; )local_date=([^;]*)/);
      const current = match ? decodeURIComponent(match[1]) : undefined;
      if (current !== today) {
        document.cookie = `local_date=${today}; path=/; max-age=86400; samesite=lax`;
        router.refresh();
      }
    };
    sync();
    const id = setInterval(sync, 60_000);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
