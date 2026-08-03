import "server-only";

import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

export function generateAccessCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function hashAccessCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyAccessCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
