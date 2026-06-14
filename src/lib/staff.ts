// Staff with no email sign in with a username + PIN. The username maps to a
// synthetic email so Supabase password auth works. Shared by the login action
// and the admin "add staff" action so they always agree on the address.
export function staffEmail(username: string): string {
  const slug = username.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${slug}@staff.local`;
}
