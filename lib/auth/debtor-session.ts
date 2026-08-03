import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "debtor_session";
const SESSION_HOURS = 24;

function secret(): Uint8Array {
  const s = process.env.DEBTOR_SESSION_SECRET;
  if (!s) throw new Error("DEBTOR_SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createDebtorSession(borrowerId: string): Promise<void> {
  const token = await new SignJWT({ typ: "debtor" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(borrowerId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

/** Returns the verified borrower_id, or null if absent/invalid/expired. */
export async function getDebtorSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.typ !== "debtor" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function clearDebtorSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
