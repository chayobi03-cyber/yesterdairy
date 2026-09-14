import { cookies } from "next/headers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The viewer's own local "today" (yyyy-mm-dd), read from a cookie kept in
// sync by <LocalDateSync/> (mounted in the root layout). Server components
// can't otherwise know the viewer's timezone -- a plain `new Date()` here
// uses the server's clock (UTC on Vercel), so a family member writing just
// after midnight KST could get their entry stamped with the previous day.
// Falls back to the server's own clock only for the very first request,
// before the client has had a chance to set the cookie.
export async function getTodayISO(): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("local_date")?.value;
  if (fromCookie && DATE_RE.test(fromCookie)) return fromCookie;
  return new Date().toLocaleDateString("sv-SE");
}
