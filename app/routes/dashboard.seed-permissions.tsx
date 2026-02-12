import { json } from "@remix-run/node";
import { requireUserSession } from "~/services/auth.server";
import { seedPermissionsData } from "~/services/role.server";

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);

    const created = await seedPermissionsData(userId);

    return json({
        message: `Seeded ${created.length} new permissions`,
        created: created.map((p) => `${p.groupName}:${p.name}`),
    });
}
