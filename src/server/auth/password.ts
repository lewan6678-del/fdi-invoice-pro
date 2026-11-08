import bcrypt from "bcryptjs";
export const hashPassword = (pw: string) => bcrypt.hash(pw, 11);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Mật khẩu phải có cả chữ và số.";
  return null;
}
