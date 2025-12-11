import { createCookieSessionStorage } from "@remix-run/node";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    secure: process.env.NODE_ENV === "production",
    secrets: ["your-secret"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
