"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "오늘", icon: "🏠" },
  { href: "/write", label: "기록", icon: "✏️" },
  { href: "/calendar", label: "달력", icon: "📅" },
  { href: "/family", label: "가족", icon: "💛" },
  { href: "/settings", label: "설정", icon: "⚙️" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-neutral-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="flex justify-around py-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs ${
                  active ? "text-amber-500" : "text-neutral-400"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
