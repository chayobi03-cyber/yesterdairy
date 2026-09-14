"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CategoryValue } from "@/lib/categories";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateName(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("닉네임을 입력해주세요.");

  const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/family");
}

export async function createFamily(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("family_name") ?? "").trim();
  const role = formData.get("role") === "child" ? "child" : "parent";
  if (!name) throw new Error("가족 이름을 입력해주세요.");

  const { data: family, error } = await supabase
    .from("families")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, user_id: user.id, role });
  if (memberError) throw new Error(memberError.message);

  redirect("/");
}

export async function joinFamily(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const code = String(formData.get("invite_code") ?? "").trim();
  const role = formData.get("role") === "child" ? "child" : "parent";
  if (!code) throw new Error("초대 코드를 입력해주세요.");

  const { data: matches, error: lookupError } = await supabase.rpc("find_family_by_invite_code", {
    code,
  });
  if (lookupError) throw new Error(lookupError.message);

  const family = matches?.[0];
  if (!family) throw new Error("초대 코드를 찾을 수 없어요.");

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, user_id: user.id, role });
  if (memberError) throw new Error(memberError.message);

  redirect("/");
}

export async function createEntry(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const entryDate = String(formData.get("entry_date"));
  const category = String(formData.get("category")) as CategoryValue;
  const content = String(formData.get("content") ?? "").trim();
  const visibility = formData.get("visibility") === "family" ? "family" : "private";

  if (!content) {
    throw new Error("내용을 입력해주세요.");
  }

  const { data: entry, error } = await supabase
    .from("diary_entries")
    .insert({
      user_id: user.id,
      entry_date: entryDate,
      category,
      content,
      visibility,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  for (const [index, file] of photos.slice(0, 5).entries()) {
    const path = `${user.id}/${entry.id}/${index}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("diary-media")
      .upload(path, file, { contentType: file.type });

    if (uploadError) continue;

    await supabase.from("media").insert({
      entry_id: entry.id,
      visibility,
      original_path: path,
      mime_type: file.type,
      size_original: file.size,
      sort_order: index,
    });
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/family");
  redirect("/");
}

export async function toggleReaction(entryId: string, emoji: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("entry_id", entryId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("reactions").insert({ entry_id: entryId, user_id: user.id, emoji });
  }

  revalidatePath("/family");
}
