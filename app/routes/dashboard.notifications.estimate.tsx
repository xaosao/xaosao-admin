import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { estimateRecipients } from "~/services/broadcast.server";
import { requireUserSession } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserSession(request);

  const url = new URL(request.url);
  const targetUserType = url.searchParams.get("targetUserType") || "all";
  const targetGender = url.searchParams.get("targetGender") || null;
  const targetAgeMin = url.searchParams.get("targetAgeMin")
    ? Number(url.searchParams.get("targetAgeMin"))
    : null;
  const targetAgeMax = url.searchParams.get("targetAgeMax")
    ? Number(url.searchParams.get("targetAgeMax"))
    : null;
  const targetCountry = url.searchParams.get("targetCountry") || null;

  try {
    const count = await estimateRecipients({
      targetUserType,
      targetGender,
      targetAgeMin,
      targetAgeMax,
      targetCountry,
    });

    return json({ count });
  } catch (error) {
    console.error("ESTIMATE_RECIPIENTS_FAILED", error);
    return json({ count: 0 });
  }
}
