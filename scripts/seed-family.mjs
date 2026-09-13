// One-time setup script: creates the family and its 3 member accounts.
// Run with: node --env-file=.env.local scripts/seed-family.mjs
//
// Edit MEMBERS below first, then run once. Re-running is safe for members
// that already exist (Supabase will just report "already registered").

import { createClient } from "@supabase/supabase-js";

const FAMILY_NAME = "우리 가족";

const MEMBERS = [
  { email: "parent1@example.com", password: "changeme123", name: "엄마", role: "parent" },
  { email: "parent2@example.com", password: "changeme123", name: "아빠", role: "parent" },
  { email: "child1@example.com", password: "changeme123", name: "아이", role: "child" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: family, error: familyError } = await admin
    .from("families")
    .insert({ name: FAMILY_NAME })
    .select("id")
    .single();

  if (familyError) throw familyError;
  console.log(`Created family "${FAMILY_NAME}" (${family.id})`);

  for (const member of MEMBERS) {
    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email: member.email,
      password: member.password,
      email_confirm: true,
    });

    if (userError) {
      console.error(`  ! ${member.email}: ${userError.message}`);
      continue;
    }

    const userId = created.user.id;

    await admin.from("profiles").insert({ id: userId, name: member.name });
    await admin.from("family_members").insert({ family_id: family.id, user_id: userId, role: member.role });

    console.log(`  + ${member.name} <${member.email}> added as ${member.role}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
