import { json } from "@remix-run/node";
import { destroyUserSession } from "~/services/auth.server";

export function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    throw json({ message: "Invalid request method" }, { status: 400 });
  }

  return destroyUserSession(request);
}
