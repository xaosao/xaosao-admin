import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getAuditLogsByEntity } from "~/services/log.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "subscription",
        action: "view",
    });

    const customerId = params.customerId!;
    const result = await getAuditLogsByEntity({ customerId, limit: 20 });

    return json(result);
}
