// Calls to the auth API, and reading the cookies it sets.
import request from "supertest";
import type { Response, Test } from "supertest";

import { app } from "../../src/app.ts";

export const register = (body: object): Test => request(app).post("/api/auth/register").send(body);
export const login = (body: object): Test => request(app).post("/api/auth/login").send(body);
export const googleSignIn = (body: object): Test =>
  request(app).post("/api/auth/google").send(body);

export const me = (access: string): Test =>
  request(app).get("/api/me").set("Cookie", `access_token=${access}`);

export const refreshWith = (token: string): Test =>
  request(app).post("/api/auth/refresh").set("Cookie", `refresh_token=${token}`);

export const logoutWith = (token: string): Test =>
  request(app).post("/api/auth/logout").set("Cookie", `refresh_token=${token}`);

export function setCookies(reply: Response): string[] {
  const value = reply.headers["set-cookie"] as string | string[] | undefined;
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function cookieLine(reply: Response, name: string): string | undefined {
  return setCookies(reply).find((line) => line.startsWith(`${name}=`));
}

export function cookieValue(reply: Response, name: string): string | undefined {
  return cookieLine(reply, name)
    ?.split(";")[0]
    ?.slice(name.length + 1);
}
