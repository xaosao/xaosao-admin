import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Gift, LoaderCircle, Pause, Play, Plus, Trash2, Users } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { RewardTabs } from "~/components/reward/reward-tabs";
import StatusBadge from "~/components/ui/status-badge";
import { useAuthStore } from "~/store/permissionStore";
import {
    createRewardSlot,
    deleteRewardSlot,
    getRewardSlots,
    toggleRewardSlot,
    updateRewardSlot,
} from "~/services/reward.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

/**
 * Rows as they arrive in the component: the loader serialises them to
 * JSON, so Dates come back as strings. Deriving from `useLoaderData`
 * keeps this honest rather than claiming they're still Dates.
 */
type SlotRow = ReturnType<typeof useLoaderData<typeof loader>>["slots"][number];

export default function RewardsPage() {
    const { slots, error } = useLoaderData<typeof loader>();
    const actionData = useActionData<Record<string, string>>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state !== "idle";
    const hasPermission = useAuthStore((s) => s.hasPermission);
    const [editing, setEditing] = useState<SlotRow | null>(null);
    const [showForm, setShowForm] = useState(false);

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

    const totalPaidToday = slots.reduce((sum, s) => sum + (s.paidToday ?? 0), 0);

    function openCreate() {
        setEditing(null);
        setShowForm(true);
    }
    function openEdit(slot: SlotRow) {
        setEditing(slot);
        setShowForm(true);
    }

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Daily rewards</h2>
                    <p className="text-sm text-gray-500">
                        Rewards appear to models at the time you set and disappear when
                        the window closes. Claimed money is credited to the model&apos;s
                        wallet exactly like a gift, and is withdrawable.
                    </p>
                </div>
                {canEdit && (
                    <Button onClick={openCreate} className="bg-rose-500 hover:bg-rose-600 text-white">
                        <Plus className="h-4 w-4 mr-1" /> New reward
                    </Button>
                )}
            </div>

            <RewardTabs active="slots" />

            {error && <p className="text-sm text-red-600">{error}</p>}
            {actionData?.error && <p className="text-sm text-red-600">{actionData.error}</p>}

            <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-3 text-sm text-amber-800">
                    Paid out today:{" "}
                    <span className="font-semibold">{totalPaidToday.toLocaleString()} LAK</span>
                    {" · "}
                    {slots.reduce((n, s) => n + (s.claimsToday ?? 0), 0)} claim(s)
                </CardContent>
            </Card>

            {showForm && canEdit && (
                <Card>
                    <CardContent className="p-4">
                        <h3 className="mb-3 text-sm font-semibold text-gray-900">
                            {editing ? `Edit "${editing.name}"` : "New reward"}
                        </h3>
                        <Form method="post" encType="multipart/form-data" className="space-y-3">
                            <input type="hidden" name="intent" value={editing ? "update" : "create"} />
                            {editing && <input type="hidden" name="id" value={editing.id} />}
                            {editing && <input type="hidden" name="existingImage" value={editing.image ?? ""} />}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <Labeled label="Name *" error={actionData?.name}>
                                    <input name="name" required defaultValue={editing?.name ?? ""} className={input} />
                                </Labeled>
                                <Labeled label="Amount (LAK) *" error={actionData?.amount}>
                                    <input name="amount" type="number" min={1} step={1} required defaultValue={editing?.amount ?? ""} className={input} />
                                </Labeled>
                                <Labeled label="Shows at (Lao time) *" error={actionData?.startTime}>
                                    <input name="startTime" type="time" required defaultValue={editing?.startTime ?? "19:00"} className={input} />
                                </Labeled>
                                <Labeled label="Stays open for (minutes) *" error={actionData?.durationMinutes}>
                                    <input name="durationMinutes" type="number" min={1} max={1440} required defaultValue={editing?.durationMinutes ?? 30} className={input} />
                                </Labeled>
                                <Labeled label="Daily cap (blank = unlimited)" error={actionData?.dailyCap}>
                                    <input name="dailyCap" type="number" min={0} step={1} defaultValue={editing?.dailyCap ?? ""} className={input} />
                                </Labeled>
                                <Labeled
                                    label={editing ? "Replace image (optional)" : "Image (optional)"}
                                    error={actionData?.image}
                                >
                                    <input name="imageFile" type="file" accept="image/*" className={input} />
                                    {editing?.image && (
                                        <label className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                                            <input type="checkbox" name="removeImage" value="1" className="h-3 w-3" />
                                            Remove the current picture
                                        </label>
                                    )}
                                </Labeled>
                            </div>

                            <p className="text-[11px] text-gray-400">
                                Without a picture the reward shows a gift icon. A
                                model who is not in the app during the window gets
                                nothing for it. Once the cap is reached, later models
                                are told today&apos;s rewards are finished.
                            </p>

                            <div className="flex justify-end gap-2 border-t pt-3">
                                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-rose-500 hover:bg-rose-600 text-white">
                                    {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                    {editing ? "Save changes" : "Create reward"}
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-2">
                {slots.length === 0 && (
                    <Card>
                        <CardContent className="p-6 text-center text-sm text-gray-500">
                            No rewards yet. Create one to start encouraging models to open
                            the app.
                        </CardContent>
                    </Card>
                )}

                {slots.map((slot) => (
                    <Card key={slot.id}>
                        <CardContent className="flex flex-wrap items-center gap-4 p-3">
                            {slot.image ? (
                                <img src={slot.image} alt={slot.name} className="h-12 w-12 rounded-lg object-cover" />
                            ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                                    <Gift className="h-5 w-5 text-gray-400" />
                                </div>
                            )}

                            <div className="min-w-[140px] flex-1">
                                <p className="text-sm font-semibold text-gray-900">{slot.name}</p>
                                <p className="text-xs text-gray-500">
                                    {slot.startTime} for {slot.durationMinutes} min ·{" "}
                                    {slot.amount.toLocaleString()} LAK ·{" "}
                                    {slot.dailyCap ? `cap ${slot.dailyCap}/day` : "no cap"}
                                </p>
                            </div>

                            <div className="text-xs text-gray-600">
                                <span className="inline-flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {slot.claimsToday} today
                                </span>
                                <span className="ml-2 text-gray-400">
                                    {(slot.paidToday ?? 0).toLocaleString()} LAK
                                </span>
                            </div>

                            <StatusBadge status={slot.status} />

                            {canEdit && (
                                <div className="flex items-center gap-1">
                                    <Button size="sm" variant="outline" onClick={() => openEdit(slot)}>
                                        Edit
                                    </Button>
                                    <Form method="post">
                                        <input type="hidden" name="intent" value="toggle" />
                                        <input type="hidden" name="id" value={slot.id} />
                                        <Button size="sm" variant="outline" type="submit" title={slot.status === "active" ? "Pause" : "Resume"}>
                                            {slot.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                        </Button>
                                    </Form>
                                    <Form method="post">
                                        <input type="hidden" name="intent" value="delete" />
                                        <input type="hidden" name="id" value={slot.id} />
                                        <Button size="sm" variant="outline" type="submit" className="text-red-500">
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </Form>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

const input =
    "mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";

function Labeled({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="text-xs font-medium text-gray-600">{label}</label>
            {children}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "setting", action: "view" });

    try {
        return json({ slots: await getRewardSlots(), error: null });
    } catch (error) {
        console.error("LOAD_REWARD_SLOTS_FAILED", error);
        // Typed empty array so the loader's two branches unify — otherwise
        // the component sees a union where every row looks nullable.
        const empty: Awaited<ReturnType<typeof getRewardSlots>> = [];
        return json({ slots: empty, error: "Failed to load rewards" });
    }
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "setting", action: "edit" });

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const id = formData.get("id") as string | null;

    try {
        if (intent === "toggle" && id) {
            await toggleRewardSlot(id, userId);
            return redirect("/dashboard/rewards");
        }
        if (intent === "delete" && id) {
            await deleteRewardSlot(id, userId);
            return redirect("/dashboard/rewards");
        }

        const capRaw = (formData.get("dailyCap") as string)?.trim();
        const payload = {
            name: (formData.get("name") as string) ?? "",
            image: formData.get("removeImage")
                ? null
                : ((formData.get("existingImage") as string) ?? null),
            imageFile: (formData.get("imageFile") as File) ?? undefined,
            amount: Number(formData.get("amount")),
            startTime: (formData.get("startTime") as string) ?? "",
            durationMinutes: Number(formData.get("durationMinutes")),
            dailyCap: capRaw ? Number(capRaw) : null,
        };

        if (intent === "update" && id) {
            await updateRewardSlot(id, payload, userId);
        } else {
            await createRewardSlot(payload, userId);
        }
        return redirect("/dashboard/rewards");
    } catch (error: any) {
        console.error("REWARD_SLOT_ACTION_FAILED", error);
        return json(error?.fieldErrors ?? error?.errors ?? { error: "Failed to save reward" });
    }
}
