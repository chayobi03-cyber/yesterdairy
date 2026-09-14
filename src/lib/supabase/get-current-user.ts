import { cache } from "react";
import { createClient } from "./server";

// Memoized per request (React's cache(), not a long-lived cache): the app
// layout and the page it wraps each need the current user, and without
// this they'd trigger two separate network round trips to Supabase's auth
// server for the exact same check within the same render pass. It also
// closes a real race we hit in production — layout and page seeing
// different results for the same request when one of the two independent
// calls happened to time out under load.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
