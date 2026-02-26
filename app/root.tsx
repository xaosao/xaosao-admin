import React from "react";

import {
  json,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";

import "./tailwind.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { requireUserSession } from "./services/auth.server";
import { getUserWithPermissions } from "./services/role.server";
import { useAuthStore } from "./store/permissionStore";
// import DevToolsRedirect from "./components/DevToolsRedirect";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];


export async function loader({ request }: { request: Request }) {
  const userId = await requireUserSession(request);
  try {
    const user = await getUserWithPermissions(userId);
    return json({ user });
  } catch {
    return json({ user: null });
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>

      <ToastContainer />
    </html>
  );
}

export default function App() {
  const { user } = useLoaderData<typeof loader>();

  const setRole = useAuthStore((state) => state.setRole);
  const setPermissions = useAuthStore((state) => state.setPermissions);
  const setAuthReady = useAuthStore((state) => state.setAuthReady);

  React.useEffect(() => {
    if (user) {
      setRole(user.role);
      setPermissions(user.permissions);
    }
    setAuthReady();
  }, [user, setRole, setPermissions, setAuthReady]);

  return (
    <>
      {/* <DevToolsRedirect /> */}
      <Outlet />
    </>
  );
}
