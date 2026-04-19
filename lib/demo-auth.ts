import { DEMO_USERS } from "./demo-data";

export const DEMO_COOKIE = "v3_demo_session";
export const IS_DEMO_MODE = false;

export function demoLogin(email: string, password: string) {
  const user = DEMO_USERS.find(
    (u) => u.email === email && u.password === password
  );
  return user ?? null;
}

export function getDemoUser(userId: string) {
  return DEMO_USERS.find((u) => u.id === userId) ?? null;
}
