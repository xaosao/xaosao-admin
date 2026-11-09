import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import { Bot, LoaderCircle, Search, Send, Star, User, UserCheck } from "lucide-react";

import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { useAuthStore } from "~/store/permissionStore";
import type { AssistantMatchCard } from "~/services/assistant.server";
import {
    getAssistantConversation,
    searchModelsForSuggestion,
    sendAssistantSuggestion,
} from "~/services/assistant.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { formatDate1 } from "~/utils";

export default function AssistantConversationDetail() {
    const { conversation, candidates, filters } = useLoaderData<typeof loader>();
    const actionData = useActionData<{ text?: string; id?: string }>();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const sending = navigation.state !== "idle" && navigation.formMethod === "POST";
    const hasPermission = useAuthStore((s) => s.hasPermission);
    const [picked, setPicked] = useState<string[]>([]);

    function closeHandler() {
        navigate("/dashboard/assistant");
    }

    if (!hasPermission("chat", "view")) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This area requires additional permissions."
                />
            </div>
        );
    }
    const canReply = hasPermission("chat", "edit");

    const customerName =
        `${conversation.customer?.firstName ?? ""} ${conversation.customer?.lastName ?? ""}`.trim() ||
        "Customer";

    function toggle(id: string) {
        setPicked((current) =>
            current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
        );
    }

    return (
        <Modal onClose={closeHandler} className="flex h-[92vh] w-full max-w-3xl flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="shrink-0">
                    <h4 className="text-md font-bold text-gray-900">{customerName}</h4>
                    <p className="text-xs text-gray-500">
                        {conversation.messageCount} message(s) · last{" "}
                        {formatDate1(conversation.lastMessageAt as unknown as string)}
                    </p>
                </div>

                {/* The thread, exactly as the customer saw it. */}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3">
                    {conversation.messages.length === 0 && (
                        <p className="text-xs text-gray-400">No messages yet.</p>
                    )}
                    {conversation.messages.map((m) => (
                        <div key={m.id}>
                            <div className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
                                {m.role !== "user" && (
                                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white">
                                        {m.role === "admin" ? (
                                            <UserCheck className="h-3 w-3 text-emerald-600" />
                                        ) : (
                                            <Bot className="h-3 w-3 text-gray-400" />
                                        )}
                                    </div>
                                )}
                                <div
                                    className={`max-w-[75%] rounded-xl px-3 py-2 text-xs ${
                                        m.role === "user"
                                            ? "bg-rose-500 text-white"
                                            : m.role === "admin"
                                            ? "bg-emerald-50 text-emerald-900"
                                            : "bg-white text-gray-800"
                                    }`}
                                >
                                    {m.role === "admin" && (
                                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                            Sent by admin
                                        </p>
                                    )}
                                    {m.text}
                                </div>
                            </div>

                            {Array.isArray(m.matches) && m.matches.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1 pl-7">
                                    {(m.matches as any[]).map((match) => (
                                        <span
                                            key={match.id}
                                            className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-600 ring-1 ring-gray-200"
                                        >
                                            {match.name}
                                            {match.age ? ` · ${match.age}` : ""}
                                            {match.distanceKm != null
                                                ? ` · ${formatDistance(match.distanceKm)}`
                                                : ""}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {!canReply ? (
                    <p className="text-xs text-gray-500">
                        You can read this conversation but not reply to it.
                    </p>
                ) : (
                    <div className="shrink-0 space-y-3">
                        {/* Candidate picker. Same eligibility as discover, so an
                            admin cannot send someone the customer can't open. */}
                        <Form method="get" className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    name="q"
                                    defaultValue={filters.q}
                                    placeholder="Search models by name"
                                    className="pl-9 text-sm"
                                />
                            </div>
                            <Button type="submit" variant="outline">Find</Button>
                        </Form>

                        <div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                            {candidates.map((m) => (
                                <CandidateCard
                                    key={m.id}
                                    model={m}
                                    selected={picked.includes(m.id)}
                                    onToggle={() => toggle(m.id)}
                                />
                            ))}
                            {candidates.length === 0 && (
                                <p className="col-span-full py-3 text-center text-xs text-gray-400">
                                    No models match that search.
                                </p>
                            )}
                        </div>

                        <Form method="post" className="space-y-2">
                            {picked.map((id) => (
                                <input key={id} type="hidden" name="modelIds" value={id} />
                            ))}
                            <textarea
                                name="text"
                                rows={2}
                                maxLength={500}
                                placeholder="Message to send with the suggestions (optional)"
                                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                            />
                            {actionData?.text && (
                                <p className="text-xs text-red-600">{actionData.text}</p>
                            )}
                            {actionData?.id && <p className="text-xs text-red-600">{actionData.id}</p>}

                            <div className="flex items-center justify-between border-t pt-3">
                                <p className="text-xs text-gray-500">
                                    {picked.length} model(s) selected
                                </p>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={closeHandler}>
                                        Close
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={sending}
                                        className="bg-rose-500 text-white hover:bg-rose-600"
                                    >
                                        {sending ? (
                                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="mr-2 h-4 w-4" />
                                        )}
                                        Send to customer
                                    </Button>
                                </div>
                            </div>
                        </Form>
                    </div>
                )}
            </div>
        </Modal>
    );
}

/** One labelled line on a card: "Name  Somchai", "Distance  2.4 km". */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-baseline gap-1 text-[10px]">
            <span className="shrink-0 text-gray-400">{label}:</span>
            <span className="min-w-0 truncate">{children}</span>
        </div>
    );
}

function CandidateCard({
    model,
    selected,
    onToggle,
}: {
    model: AssistantMatchCard;
    selected: boolean;
    onToggle: () => void;
}) {
    // A profile URL can 404; fall back to the placeholder rather than
    // leaving a broken image in the picker.
    const [imageFailed, setImageFailed] = useState(false);
    const showImage = model.profile && !imageFailed;

    return (
        <button
            type="button"
            onClick={onToggle}
            className={`overflow-hidden rounded-lg border text-left transition-colors ${
                selected ? "border-rose-500 ring-2 ring-rose-200" : "border-gray-200"
            }`}
        >
            {showImage ? (
                <img
                    src={model.profile!}
                    alt=""
                    onError={() => setImageFailed(true)}
                    className="h-20 w-full bg-gray-100 object-cover"
                />
            ) : (
                <div className="flex h-20 w-full items-center justify-center bg-gray-100">
                    <User className="h-4 w-4 text-gray-400" />
                </div>
            )}
            <div className="space-y-0.5 p-1.5">
                <Field label="Name">
                    <span className="font-medium text-gray-900">{model.name}</span>
                </Field>
                <Field label="Age">
                    <span className="text-gray-700">{model.age ?? "—"}</span>
                </Field>
                <Field label="Distance">
                    <span className="text-gray-700">{formatDistance(model.distanceKm)}</span>
                </Field>
                {model.rating > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {model.rating.toFixed(1)}
                    </span>
                )}
            </div>
        </button>
    );
}

/**
 * Metres under a kilometre, otherwise km. An em dash when either side has
 * no coordinates — better than implying they are on top of each other.
 */
function formatDistance(km: number | null) {
    if (km == null) return "—";
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km} km`;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "chat", action: "view" });

    const conversation = await getAssistantConversation(params.id as string);
    if (!conversation) throw new Response("Not Found", { status: 404 });

    const q = new URL(request.url).searchParams.get("q") || "";
    const candidates = await searchModelsForSuggestion(
        q,
        24,
        conversation.customerId
    );

    return json({ conversation, candidates, filters: { q } });
}

export async function action({ request, params }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "chat", action: "edit" });

    const formData = await request.formData();
    const text = (formData.get("text") as string) || "";
    const modelIds = formData.getAll("modelIds").map(String).filter(Boolean);

    try {
        await sendAssistantSuggestion(params.id as string, userId, text, modelIds);
        return redirect("/dashboard/assistant?success=Suggestion+sent");
    } catch (error: any) {
        console.error("SEND_ASSISTANT_SUGGESTION_FAILED", error);
        return json(error?.fieldErrors ?? error?.errors ?? { text: "Failed to send" });
    }
}
