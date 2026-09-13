import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="text-base font-semibold text-neutral-800">
          ⭐ 하루별
        </Link>
      </header>
      <main className="flex-1 px-5 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
