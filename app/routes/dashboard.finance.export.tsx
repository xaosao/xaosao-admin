import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getFinanceCSVData } from "~/services/finance.server";

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "finance",
        action: "view",
    });

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const period = searchParams.get("period") || "all";
    const identifier = searchParams.get("identifier") || "all";
    const status = searchParams.get("status") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";

    const csvData = await getFinanceCSVData({
        identifier,
        status,
        period,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
    });

    if (csvData.length === 0) {
        return new Response("No data to export", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    const headers = Object.keys(csvData[0]);
    const csvRows = [
        headers.join(","),
        ...csvData.map((row) =>
            headers
                .map((h) => {
                    const val = String(row[h as keyof typeof row] ?? "");
                    return val.includes(",") || val.includes('"')
                        ? `"${val.replace(/"/g, '""')}"`
                        : val;
                })
                .join(",")
        ),
    ];

    const dateStr = new Date().toISOString().split("T")[0];

    return new Response("\uFEFF" + csvRows.join("\n"), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="finance-report-${dateStr}.csv"`,
        },
    });
}
