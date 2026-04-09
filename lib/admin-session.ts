/**
 * 超级管理员会话：HMAC 签名 Cookie，供 middleware 与 API 校验。
 * 依赖环境变量 ADMIN_SESSION_SECRET（建议 ≥32 字符随机串）。
 */

export const ADMIN_COOKIE_NAME = "admin_session";

function uint8ToHex(u: Uint8Array): string {
  return Array.from(u)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToUint8(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((b64url.length + 3) % 4);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return uint8ToHex(new Uint8Array(buf));
}

export async function verifyAdminPassword(
  inputPassword: string,
  expectedPlain: string | undefined
): Promise<boolean> {
  if (!expectedPlain) return false;
  const [a, b] = await Promise.all([sha256Hex(inputPassword), sha256Hex(expectedPlain)]);
  return timingSafeEqualHex(a, b);
}

export async function createAdminSessionToken(secret: string): Promise<string> {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ exp });
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const p64 = utf8ToBase64Url(payload);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(p64));
  return `${p64}.${uint8ToHex(new Uint8Array(sig))}`;
}

export async function verifyAdminSession(
  token: string | undefined,
  secret: string | undefined
): Promise<boolean> {
  if (!token || !secret || secret.length < 16) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const p64 = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);
  if (!/^[0-9a-f]+$/i.test(sigHex) || sigHex.length % 2) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sig = hexToUint8(sigHex);
    const sigCopy = new Uint8Array(sig.length);
    sigCopy.set(sig);
    const ok = await crypto.subtle.verify("HMAC", key, sigCopy, enc.encode(p64));
    if (!ok) return false;
    const payload = JSON.parse(base64UrlToUtf8(p64)) as { exp?: number };
    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch {
    return false;
  }
}
