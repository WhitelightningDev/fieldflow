function getSupabaseProjectRef() {
  const fromEnv = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  const match = /^https:\/\/([^.]+)\.supabase\.co\/?/.exec(url.trim());
  return match?.[1] ?? null;
}

export function clearSupabaseAuthStorage() {
  const ref = getSupabaseProjectRef();
  const prefix = ref ? `sb-${ref}-` : "sb-";

  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix)) localStorage.removeItem(key);
  }
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  }
}

