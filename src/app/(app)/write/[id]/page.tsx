import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { updateEntry } from "@/app/actions";
import { EntryForm } from "../entry-form";
import type { CategoryValue } from "@/lib/categories";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("diary_entries")
    .select("category, content, visibility")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!entry) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateEntry(id, formData);
  }

  return (
    <EntryForm
      action={action}
      defaultCategory={entry.category as CategoryValue}
      defaultContent={entry.content}
      defaultVisibility={entry.visibility === "family" ? "family" : "private"}
      photoLabel="사진 추가 (기존 사진에 더해서, 최대 5장)"
      submitLabel="수정하기"
      pendingLabel="수정 중..."
      title="기록 수정"
      subtitle="내용을 고쳐볼까요?"
    />
  );
}
