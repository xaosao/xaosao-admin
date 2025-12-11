import { default as bcrypt } from "bcryptjs";

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { ISigninCredentials } from "~/interfaces";
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { getUserWithPermissions } from "./role.server";

const { compare } = bcrypt;
const SESSION_SECRET = process.env.SESSION_SECRET!;

const sessionStorage = createCookieSessionStorage({
  cookie: {
    // secure: process.env.NODE_ENV === "production",
    secure: false,
    secrets: [SESSION_SECRET],
    sameSite: "lax",
    maxAge: 1 * 24 * 60 * 60, // 1 days
    httpOnly: true,
  },
});

async function createUserSession(userId: string, redirectPath: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectPath, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function getUserFromSession(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const userId = session.get("userId");

  if (!userId) {
    return null;
  }

  return userId;
}

export async function requireUserSession(request: Request) {
  const userId = await getUserFromSession(request);

  if (!userId) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const publicPaths = ["/signin", "/signup", "/forgot-password"];
    const isPublic = publicPaths.includes(pathname);

    if (!isPublic) {
      throw redirect("/signin");
    }
  }

  return userId;
}

export async function destroyUserSession(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  return redirect("/signin", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function login({ email, password }: ISigninCredentials) {
  const existingUser = await prisma.user.findFirst({
    where: { email },
  });

  const auditBase = {
    action: "LOGIN",
    user: existingUser?.id,
  };

  if (!existingUser) {
    const error = new Error(
      "Could not log you in, please check the provided credentials."
    ) as Error & {
      status?: number;
    };
    error.status = 401;

    await createAuditLogs({
      ...auditBase,
      description: `Login failed, not user founded`,
      status: "failed",
      onError: error,
    });
    throw error;
  }

  const passwordCorrect = await compare(password, existingUser.password);
  if (!passwordCorrect) {
    const error = new Error(
      "Could not log you in, please check the provided credentials."
    ) as Error & {
      status?: number;
    };
    error.status = 401;

    await createAuditLogs({
      ...auditBase,
      description: `Login failed, password incorrect!`,
      status: "failed",
      onError: error,
    });
    throw error;
  }

  await createAuditLogs({
    ...auditBase,
    description: `Login with: ${email}, ${password},successfully.`,
    status: "success",
    onSuccess: existingUser,
  });
  return createUserSession(existingUser.id, "/dashboard");
}

// ========= Route protected:
export async function requireUserPermission({
  userId,
  group,
  action,
}: {
  userId: string;
  group: string;
  action: string;
}) {
  const user = await getUserWithPermissions(userId);

  const hasPermission = user.permissions.some(
    (perm) =>
      perm.groupName === group &&
      perm.name === action &&
      perm.status === "active"
  );

  if (!hasPermission) {
    throw redirect("/dashboard/unallow");
  }
  return true;
}
