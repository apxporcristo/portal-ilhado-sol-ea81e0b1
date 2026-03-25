/**
 * Password hashing utility using SHA-256.
 * Works in both browser and Deno environments.
 */

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  return computed === storedHash;
}
