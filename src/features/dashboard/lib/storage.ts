export function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

