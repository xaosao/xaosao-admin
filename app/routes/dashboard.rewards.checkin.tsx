import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { CalendarCheck, Coins, LoaderCircle, Users } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { RewardTabs } from "~/components/reward/reward-tabs";
import { useAuthStore } from "~/store/permissionStore";
import {
    getCheckinClaims,
    getCheckinWeek,
    saveCheckinWeek,
    WEEKDAYS,
} from "~/services/checkin.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { formatDate1 } from "~/utils";

const input =
    "mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";

export default function CheckinPage() {
    const { days, stats, claims, error } = useLoaderData<typeof loader>();
    const actionData = useActionData<Record<string, string>>();
    const navigation = useNavigation();
    const saving = navigation.state !== "idle";
    const hasPermission = useAuthStore((s) => s.hasPermission);

    if (!hasPermission("setting", "view")) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This area requires additional permissions."
                />
            </div>
        );
    }
    const canEdit = hasPermission("setting", "edit");

    return (
        <div className="space-y-4 p-4">
            <div>
                <h2 className="text-lg font-bold text-gray-900">Daily check-in</h2>
                <p className="text-sm text-gray-500">
                    A model who opens the app can check in once a day and is paid
                    straight away. Set what each weekday is worth — the money is
                    credited to their wallet exactly like a gift, and is
                    withdrawable. Missing a day breaks their streak.
                </p>
            </div>

            <RewardTabs active="checkin" />

            {error && <p className="text-sm text-red-600">{error}</p>}
            {actionData?.error && (
                <p className="text-sm text-red-600">{actionData.error}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                    icon={<Users className="h-4 w-4" />}
                    label="Checked in today"
                    value={`${stats.claimsToday}`}
                />
                <Stat
                    icon={<Coins className="h-4 w-4" />}
                    label="Paid today"
                    value={`${stats.paidToday.toLocaleString()} LAK`}
                />
                <Stat
                    icon={<CalendarCheck className="h-4 w-4" />}
                    label="Paid this week"
                    value={`${stats.paidThisWeek.toLocaleString()} LAK`}
                />
            </div>

            <Form method="post">
                <Card>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-gray-50 text-left text-xs text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">Day</th>
                                    <th className="px-3 py-2">Amount (LAK)</th>
                                    <th className="px-3 py-2">Cap (blank = unlimited)</th>
                                    <th className="px-3 py-2">On</th>
                                    <th className="px-3 py-2 text-right">This week</th>
                                </tr>
                            </thead>
                            <tbody>
                                {days.map((day) => (
                                    <tr
                                        key={day.weekday}
                                        className={`border-b last:border-0 ${
                                            day.isToday ? "bg-rose-50/60" : ""
                                        }`}
                                    >
                                        <td className="px-3 py-2">
                                            <p className="font-medium text-gray-900">
                                                {day.en}{" "}
                                                <span className="text-gray-400">({day.lo})</span>
                                            </p>
                                            <p className="text-[11px] text-gray-400">
                                                {day.date}
                                                {day.isToday ? " · today" : ""}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                name={`amount-${day.weekday}`}
                                                type="number"
                                                min={0}
                                                step={1000}
                                                defaultValue={day.amount || ""}
                                                disabled={!canEdit}
                                                placeholder="0"
                                                className={input}
                                            />
                                            {actionData?.[`day-${day.weekday}`] && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {actionData[`day-${day.weekday}`]}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                name={`cap-${day.weekday}`}
                                                type="number"
                                                min={0}
                                                step={1}
                                                defaultValue={day.dailyCap ?? ""}
                                                disabled={!canEdit}
                                                placeholder="unlimited"
                                                className={input}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                name={`active-${day.weekday}`}
                                                type="checkbox"
                                                defaultChecked={day.status === "active"}
                                                disabled={!canEdit}
                                                className="h-4 w-4 accent-rose-500"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right text-xs text-gray-600">
                                            {day.claims} check-in(s)
                                            <span className="ml-2 text-gray-400">
                                                {day.paid.toLocaleString()} LAK
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                <p className="mt-2 text-[11px] text-gray-400">
                    A day that is switched off pays nothing and shows as unavailable
                    to models. Once a day&apos;s cap is reached, later models are told
                    today&apos;s check-ins are finished.
                </p>

                {canEdit && (
                    <div className="mt-3 flex justify-end">
                        <Button
                            type="submit"
                            disabled={saving}
                            className="bg-rose-500 text-white hover:bg-rose-600"
                        >
                            {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Save the week
                        </Button>
                    </div>
                )}
            </Form>

            <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                    Recent check-ins
                </h3>
                <Card>
                    <CardContent className="p-0">
                        {claims.length === 0 ? (
                            <p className="p-6 text-center text-sm text-gray-500">
                                Nobody has checked in yet.
                            </p>
                        ) : (
                            <ul className="divide-y">
                                {claims.map((claim) => (
                                    <li
                                        key={claim.id}
                                        className="flex items-center gap-3 px-3 py-2 text-sm"
                                    >
                                        <span className="flex-1 truncate text-gray-900">
                                            {`${claim.model?.firstName ?? ""} ${
                                                claim.model?.lastName ?? ""
                                            }`.trim() || "Model"}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            day {claim.streak} streak
                                        </span>
                                        <span className="w-28 text-right text-xs text-gray-600">
                                            {claim.amount.toLocaleString()} LAK
                                        </span>
                                        <span className="w-40 text-right text-xs text-gray-400">
                                            {formatDate1(claim.claimedAt as unknown as string)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Stat({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                    {icon}
                </span>
                <div>
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="text-sm font-semibold text-gray-900">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "setting", action: "view" });

    try {
        const [week, claims] = await Promise.all([
            getCheckinWeek(),
            getCheckinClaims(25),
        ]);
        return json({ ...week, claims, error: null });
    } catch (error) {
        console.error("LOAD_CHECKIN_FAILED", error);
        // Typed empties so the loader's two branches unify — otherwise the
        // component sees a union where every field looks nullable.
        const week: Awaited<ReturnType<typeof getCheckinWeek>> = {
            days: WEEKDAYS.map((meta) => ({
                ...meta,
                id: null,
                amount: 0,
                dailyCap: null,
                status: "inactive",
                configured: false,
                date: "",
                isToday: false,
                claims: 0,
                paid: 0,
            })),
            stats: {
                claimsToday: 0,
                paidToday: 0,
                claimsThisWeek: 0,
                paidThisWeek: 0,
            },
        };
        const claims: Awaited<ReturnType<typeof getCheckinClaims>> = [];
        return json({ ...week, claims, error: "Failed to load check-in settings" });
    }
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "setting", action: "edit" });

    const formData = await request.formData();

    const rows = WEEKDAYS.map((meta) => {
        const capRaw = ((formData.get(`cap-${meta.weekday}`) as string) ?? "").trim();
        const amountRaw = ((formData.get(`amount-${meta.weekday}`) as string) ?? "").trim();
        return {
            weekday: meta.weekday,
            amount: amountRaw ? Number(amountRaw) : 0,
            dailyCap: capRaw ? Number(capRaw) : null,
            status: formData.get(`active-${meta.weekday}`) ? "active" : "inactive",
        };
    });

    try {
        await saveCheckinWeek(rows, userId);
        return redirect("/dashboard/rewards/checkin?success=Check-in+saved");
    } catch (error: any) {
        console.error("SAVE_CHECKIN_FAILED", error);
        return json(
            error?.fieldErrors ?? error?.errors ?? { error: "Failed to save check-in" }
        );
    }
}
