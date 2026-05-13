import { supabase } from "@/integrations/supabase/client";

const UNLOCK_KEY = "streamio.premiumUnlockUntil";
const DEVICE_KEY = "streamio.deviceId";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function isPremiumUnlocked(): boolean {
  const v = localStorage.getItem(UNLOCK_KEY);
  if (!v) return false;
  const ts = Number(v);
  if (!Number.isFinite(ts)) return false;
  return ts > Date.now();
}

export function getUnlockExpiry(): number | null {
  const v = localStorage.getItem(UNLOCK_KEY);
  if (!v) return null;
  const ts = Number(v);
  return Number.isFinite(ts) && ts > Date.now() ? ts : null;
}

export async function redeemPremiumCode(code: string): Promise<{ ok: boolean; message: string; until?: number }> {
  const c = code.trim().toUpperCase();
  if (c.length !== 6) return { ok: false, message: "Code must be 6 characters" };
  const device = getDeviceId();

  const { data, error } = await supabase
    .from("premium_codes")
    .select("code,expires_at,used_by")
    .eq("code", c)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Invalid code" };

  const until = new Date(data.expires_at).getTime();
  if (until <= Date.now()) return { ok: false, message: "Code expired" };

  if (data.used_by && data.used_by !== device) {
    return { ok: false, message: "Code already used on another device" };
  }

  if (!data.used_by) {
    const { data: claimed, error: upErr } = await supabase
      .from("premium_codes")
      .update({ used_by: device, used_at: new Date().toISOString() })
      .eq("code", c)
      .is("used_by", null)
      .select("code")
      .maybeSingle();
    if (upErr) return { ok: false, message: upErr.message };
    if (!claimed) return { ok: false, message: "Code already used on another device" };
  }

  const cur = Number(localStorage.getItem(UNLOCK_KEY) || "0");
  localStorage.setItem(UNLOCK_KEY, String(Math.max(cur, until)));
  return { ok: true, message: "Unlocked!", until };
}

export function generateCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars: string[] = [];
  for (let i = 0; i < 2; i++) chars.push(letters[Math.floor(Math.random() * letters.length)]);
  for (let i = 0; i < 2; i++) chars.push(digits[Math.floor(Math.random() * digits.length)]);
  for (let i = 0; i < 2; i++) chars.push(all[Math.floor(Math.random() * all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function fmtDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
