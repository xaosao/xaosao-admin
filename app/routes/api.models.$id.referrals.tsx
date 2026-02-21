import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireUserSession } from "~/services/auth.server";
import { getReferredModels, getReferredCustomers } from "~/services/model.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireUserSession(request);
  const modelId = params.id!;
  const url = new URL(request.url);
  const type = url.searchParams.get("type"); // "models" or "customers"

  if (type === "models") {
    const referredModels = await getReferredModels(modelId);
    return json({ referredModels });
  }

  if (type === "customers") {
    const referredCustomers = await getReferredCustomers(modelId);
    return json({ referredCustomers });
  }

  return json({ error: "Invalid type" }, { status: 400 });
}
