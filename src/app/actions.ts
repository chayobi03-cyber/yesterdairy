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

export async function updateWorldType(worldType: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!["tree", "constellation", "planet", "color"].includes(worldType)) {
    throw new Error("알 수 없는 세계관이에요.");
  }

  const { error } = await supabase.from("profiles").update({ world_type: worldType }).eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath(`/room/${user.id}`);
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

  // Both inserts (families + family_members) happen inside a single
  // SECURITY DEFINER function — see 0005_create_family_rpc.sql for why
  // doing this as two separate client-side inserts hits an RLS chicken-
  // and-egg problem on the RETURNING read-back.
  const { error } = await supabase.rpc("create_family", { family_name: name, member_role: role });
  if (error) throw new Error(error.message);
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

export async function updateEntry(entryId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const category = String(formData.get("category")) as CategoryValue;
  const content = String(formData.get("content") ?? "").trim();
  const visibility = formData.get("visibility") === "family" ? "family" : "private";

  if (!content) {
    throw new Error("내용을 입력해주세요.");
  }

  const { error } = await supabase
    .from("diary_entries")
    .update({ category, content, visibility })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  // media.visibility is a separate copy checked by its own RLS policy --
  // keep it in sync or a photo could stay readable to family after the
  // entry itself is switched back to private.
  await supabase.from("media").update({ visibility }).eq("entry_id", entryId);

  const { count: existingPhotoCount } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId);

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const room = Math.max(0, 5 - (existingPhotoCount ?? 0));

  for (const [index, file] of photos.slice(0, room).entries()) {
    const sortOrder = (existingPhotoCount ?? 0) + index;
    const path = `${user.id}/${entryId}/${sortOrder}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("diary-media")
      .upload(path, file, { contentType: file.type });

    if (uploadError) continue;

    await supabase.from("media").insert({
      entry_id: entryId,
      visibility,
      original_path: path,
      mime_type: file.type,
      size_original: file.size,
      sort_order: sortOrder,
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

export async function createGoal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  const targetDate = String(formData.get("target_date") ?? "").trim() || null;
  const visibility = formData.get("visibility") === "family" ? "family" : "private";
  if (!title) throw new Error("목표를 입력해주세요.");

  const { error } = await supabase
    .from("goals")
    .insert({ user_id: user.id, title, target_date: targetDate, visibility });
  if (error) throw new Error(error.message);

  revalidatePath("/family");
}

export async function toggleGoalAchieved(goalId: string, currentlyAchieved: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("goals")
    .update({ achieved_at: currentlyAchieved ? null : new Date().toISOString() })
    .eq("id", goalId)
    .eq("user_id", user.id);

  revalidatePath("/family");
}

export async function toggleCheer(goalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("goal_cheers")
    .select("id")
    .eq("goal_id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("goal_cheers").delete().eq("id", existing.id);
  } else {
    await supabase.from("goal_cheers").insert({ goal_id: goalId, user_id: user.id });
  }

  revalidatePath("/family");
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const visibility = formData.get("visibility") === "family" ? "family" : "private";
  if (!title) throw new Error("일정 이름을 입력해주세요.");
  if (!eventDate) throw new Error("날짜를 선택해주세요.");

  const { error } = await supabase.from("events").insert({ user_id: user.id, title, event_date: eventDate, visibility });
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
}

export async function addComment(entryId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("댓글 내용을 입력해주세요.");

  const { error } = await supabase.from("comments").insert({ entry_id: entryId, user_id: user.id, content });
  if (error) throw new Error(error.message);

  revalidatePath("/family");
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id);

  revalidatePath("/family");
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveDailyColor(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hex = String(formData.get("hex") ?? "");
  const colorDate = String(formData.get("color_date") ?? "");
  const name = String(formData.get("name") ?? "") || null;
  const missionHex = String(formData.get("mission_hex") ?? "") || null;
  const missionName = String(formData.get("mission_name") ?? "") || null;
  const matchPercentRaw = formData.get("match_percent");
  const matchPercent = matchPercentRaw ? Number(matchPercentRaw) : null;

  if (!HEX_RE.test(hex)) throw new Error("잘못된 색상 값이에요.");
  if (!DATE_RE.test(colorDate)) throw new Error("잘못된 날짜예요.");
  if (missionHex && !HEX_RE.test(missionHex)) throw new Error("잘못된 미션 색상 값이에요.");
  if (matchPercent !== null && (!Number.isInteger(matchPercent) || matchPercent < 0 || matchPercent > 100)) {
    throw new Error("잘못된 매치율 값이에요.");
  }

  const { error } = await supabase.from("daily_colors").upsert(
    {
      user_id: user.id,
      color_date: colorDate,
      hex,
      name,
      mission_hex: missionHex,
      mission_name: missionName,
      match_percent: matchPercent,
    },
    { onConflict: "user_id,color_date" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/colors");
}
