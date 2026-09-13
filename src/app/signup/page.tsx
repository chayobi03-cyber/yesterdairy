"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createProfile } from "@/app/actions";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message.includes("already registered") ? "이미 가입된 이메일이에요." : "가입에 실패했어요.");
      return;
    }

    await createProfile(name);

    setLoading(false);
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <div className="text-4xl">⭐</div>
        <h1 className="mt-2 text-xl font-semibold text-neutral-800">하루별 가입</h1>
        <p className="mt-1 text-sm text-neutral-500">우리 가족만 쓰는 다이어리예요</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          required
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
        />
        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
        />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <p className="text-center text-xs text-neutral-400">
        이미 계정이 있나요? <Link href="/login" className="underline">로그인</Link>
      </p>
    </main>
  );
}
