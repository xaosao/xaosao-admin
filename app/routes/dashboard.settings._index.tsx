import { toast } from "react-toastify";
import React, { ChangeEvent, useRef } from "react"
import { Form, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { DollarSign, Users, Coins, Gauge, Landmark, Upload, LoaderCircle } from "lucide-react"

import { Input } from "~/components/ui/input"
import { Switch } from "~/components/ui/switch"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

// service, utils and interface
import { useAuthStore } from "~/store/permissionStore";
import { extractFilenameFromCDNSafe } from "~/utils"
import { ISettingInputs, ISettingResponse } from "~/interfaces"
import { getSettings, updateSettings } from "~/services/setting.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"
import { deleteFileFromBunny, uploadFileToBunnyServer } from "~/services/upload.server"
import { validateSettingInputs } from "~/services/validation.server";
import { getPaymentMethods, savePaymentMethods } from "~/services/payment-method.server";
// From a client-safe module: the component below renders the network list,
// and Remix won't let client code reach into a `.server` file.
import { CRYPTO_NETWORKS, type PaymentMethods } from "~/utils/constands/payment";

type LoaderData = {
    settings: ISettingResponse,
    paymentMethods: PaymentMethods,
    success: string
}

export default function SettingsPage() {
    const navigate = useNavigate();
    const navigation = useNavigation()
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = React.useState<string | null>(null)
    const { settings, paymentMethods, success } = useLoaderData<LoaderData>();
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH"
    const validationErrors = useActionData<Partial<Record<keyof ISettingInputs, string>>>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const canAccess = hasPermission("setting", "view");
    const canEdit = hasPermission("setting", "edit");

    function handleImageUpload() {
        fileInputRef.current?.click()
    }

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const files = event.target.files
        if (!files || files.length === 0) return

        const file = files[0]
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file')
                return
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB')
                return
            }

            const previewUrl = URL.createObjectURL(file)
            setImagePreview(previewUrl)
        }
    }

    React.useEffect(() => {
        if (success) {
            toast.success(success);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("success");
            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, navigate]);

    if (!canAccess) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900">Platform Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Configure your dating platform preferences</p>
                </div>
            </div>

            <Form method="patch" className="space-y-6 bg-white p-4 rounded-md" encType="multipart/form-data">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="border-0 border rounded-md h-auto">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold flex items-center">
                                <DollarSign className="h-4 w-4 mr-2" />
                                Payment Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="platform-fee" className="text-xs font-medium text-gray-500">
                                        Platform Fee (%)
                                    </label>
                                    <Input id="platform-fee" name="platform_fee_percent" defaultValue={settings?.platform_fee_percent} type="number" className="text-sm" />
                                    <Input id="id" name="id" defaultValue={settings?.id} type="text" className="text-sm hidden" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="min-payout" className="text-xs font-medium text-gray-500">
                                        Min Payout ($)
                                    </label>
                                    <Input id="min-payout" name="min_payout" defaultValue={settings?.min_payout} className="text-sm" />
                                </div>
                            </div>
                            <Separator />
                            <CardTitle className="text-sm flex items-center jutify-start">
                                <Gauge className="size-4 text-muted-foreground" aria-hidden="true" /> &nbsp;
                                withdrawal limits
                            </CardTitle>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="chat-rate" className="text-xs font-medium text-gray-500">
                                        Maximum / day ($)
                                    </label>
                                    <Input id="chat-rate" name="max_withdrawal_day" defaultValue={settings?.max_withdrawal_day} className="text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="video-rate" className="text-xs font-medium text-gray-500">
                                        Maximum / week ($)
                                    </label>
                                    <Input id="video-rate" name="max_withdrawal_week" defaultValue={settings?.max_withdrawal_week} className="text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="video-rate" className="text-xs font-medium text-gray-500">
                                        Maximum / month ($)
                                    </label>
                                    <Input id="video-rate" name="max_withdrawal_month" defaultValue={settings?.max_withdrawal_month} className="text-sm" />
                                </div>
                            </div>
                            <Separator />
                            <CardTitle className="text-sm flex items-center jutify-start">
                                <Coins className="size-4 text-muted-foreground" aria-hidden="true" /> &nbsp;
                                Exchange rate
                            </CardTitle>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="chat-rate" className="text-xs font-medium text-gray-500">
                                        Dollar US
                                    </label>
                                    <Input id="chat-rate" defaultValue="$1" className="text-sm" disabled />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="video-rate" className="text-xs font-medium text-gray-500">
                                        Lao Kip
                                    </label>
                                    <Input id="video-rate" defaultValue={settings?.exchange_rate} className="text-sm" disabled />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="video-rate" className="text-xs font-medium text-gray-500">
                                        Exchange rate
                                    </label>
                                    <Input id="video-rate" name="exchange_rate" defaultValue={settings?.exchange_rate} className="text-sm" />
                                </div>
                            </div>
                            <Separator />
                            <CardTitle className="text-sm flex items-center jutify-start">
                                <Landmark className="size-4 text-muted-foreground" aria-hidden="true" /> &nbsp;
                                Default System Payment Info
                            </CardTitle>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="chat-rate" className="text-xs font-medium text-gray-500">
                                        Bank Account Name
                                    </label>
                                    <Input id="chat-rate" name="bank_account_name" defaultValue={settings?.bank_account_name} className="text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="video-rate" className="text-xs font-medium text-gray-500">
                                        Bank Account Number
                                    </label>
                                    <Input id="video-rate" name="bank_account_number" defaultValue={settings?.bank_account_number} className="text-sm" />
                                </div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage
                                        src={imagePreview ? imagePreview : settings?.qr_code || ""}
                                        alt="Admin avatar"
                                    />
                                    <AvatarFallback className="text-lg">
                                        U
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <Button type="button" variant="outline" size="sm" onClick={handleImageUpload}>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload QR code
                                    </Button>
                                    <p className="text-xs text-gray-500 mt-2">JPG, PNG up to 5MB</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        name="qr_code"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <input className="hidden" name="dbQrCode" defaultValue={settings?.qr_code ?? ""} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Rendered outside the settings <Form> on purpose: it
                        saves to system_config through its own POST, while
                        everything around it PATCHes the `setting` document. */}
                    <PaymentMethodsCard methods={paymentMethods} />

                    <Card className="border-0 border rounded-md h-auto">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold flex items-center">
                                <Users className="h-4 w-4 mr-2" />
                                User Management
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Two Factory Authentication</label>
                                    <p className="text-xs text-gray-500">Require 2FA for new Admin user!</p>
                                </div>
                                <Switch name="require_2fa_admin" defaultChecked={settings?.require_2fa_admin} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Auto-approve Models</label>
                                    <p className="text-xs text-gray-500">Automatically approve new model profiles</p>
                                </div>
                                <Switch name="auto_approve_models" defaultChecked={settings?.auto_approve_models} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Email Verification</label>
                                    <p className="text-xs text-gray-500">Require email verification for new users</p>
                                </div>
                                <Switch name="require_email_verification" defaultChecked={settings?.require_email_verification} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Phone Verification</label>
                                    <p className="text-xs text-gray-500">Require phone number verification for new users</p>
                                </div>
                                <Switch name="require_phone_verification" defaultChecked={settings?.require_phone_verification} />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <label htmlFor="min-age" className="text-xs font-medium text-gray-500">
                                    Minimum Age
                                </label>
                                <Input id="min-age" name="min_age" defaultValue={settings?.min_age} type="number" className="text-sm" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div>
                    {validationErrors && Object.keys(validationErrors).length > 0 && (
                        <div>
                            {Object.values(validationErrors).map((error, index) => (
                                <div key={index} className="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800" role="alert">
                                    <svg className="shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
                                    </svg>
                                    <span className="sr-only">Info</span>
                                    <div>
                                        {error}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {canEdit && (
                    <div className="w-full flex items-center justify-end mt-4">
                        <Button type="submit" className="bg-dark-pink hover:opacity-90 text-white" disabled={isSubmitting}>
                            {isSubmitting ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : ""}
                            {isSubmitting ? "Saving..." : "Save Change"}
                        </Button>
                    </div>
                )}
            </Form>
        </div>
    )
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "setting",
        action: "view",
    });
    const url = new URL(request.url);
    const success = url.searchParams.get("success");
    try {
        const [settings, paymentMethods] = await Promise.all([
            getSettings(),
            getPaymentMethods(),
        ]);
        return json({
            settings,
            paymentMethods,
            success
        });
    } catch (error) {
        console.error("Failed to fetch setting data:", error);
        throw new Response("Failed to fetch setting data", { status: 500 });
    }
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "setting",
        action: "edit",
    });

    const formData = await request.formData();

    // Payment methods save through POST and live in `system_config`; the
    // rest of this page PATCHes the `setting` document. Handled first so
    // the two never read each other's fields.
    if (request.method === "POST" && formData.get("intent") === "payment_methods") {
        try {
            await savePaymentMethods(
                {
                    bankEnabled: formData.get("bankEnabled") === "on",
                    bankQrCode: (formData.get("existingQr") as string) ?? "",
                    bankQrFile: (formData.get("bankQrFile") as File) ?? undefined,
                    cryptoEnabled: formData.get("cryptoEnabled") === "on",
                    cryptoAddress: (formData.get("cryptoAddress") as string) ?? "",
                    cryptoNetwork: (formData.get("cryptoNetwork") as string) ?? "BEP20",
                    usdRate: Number(formData.get("usdRate")),
                },
                userId
            );
            return redirect("/dashboard/settings?success=Payment+methods+saved");
        } catch (error: any) {
            console.error("SAVE_PAYMENT_METHODS_FAILED", error);
            return json(error?.fieldErrors ?? error?.errors ?? { error: "Failed to save payment methods" });
        }
    }

    const settingData = Object.fromEntries(formData);
    const file = formData.get("qr_code") as File;
    const dbQrCode = formData.get("dbQrCode");
    const id = formData.get("id") as string;

    if (request.method === "PATCH") {
        try {
            if (file && file instanceof File && file.size > 0) {
                const buffer = Buffer.from(await file.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, file.name, file.type);
                settingData.qr_code = url;
            } else {
                settingData.qr_code = dbQrCode as string;
            }

            const input: ISettingInputs = {
                id: settingData.id as string,
                platform_fee_percent: parseFloat(settingData.platform_fee_percent as string),
                min_payout: parseFloat(settingData.min_payout as string),
                max_withdrawal_day: parseFloat(settingData.max_withdrawal_day as string),
                max_withdrawal_week: parseFloat(settingData.max_withdrawal_week as string),
                max_withdrawal_month: parseFloat(settingData.max_withdrawal_month as string),
                exchange_rate: parseFloat(settingData.exchange_rate as string),
                bank_account_name: settingData.bank_account_name as string,
                bank_account_number: settingData.bank_account_number as string,
                qr_code: settingData.qr_code as string,
                require_2fa_admin: settingData.require_2fa_admin === "on" ? true : false,
                auto_approve_models: settingData.auto_approve_models === "on" ? true : false,
                require_email_verification: settingData.require_email_verification === "on" ? true : false,
                require_phone_verification: settingData.require_phone_verification === "on" ? true : false,
                min_age: parseInt(settingData.min_age as string, 10),
            }
            await validateSettingInputs(input);
            const res = await updateSettings(id, input, userId);
            if (res.id) {
                // Delete old file ONLY after database update succeeds
                if (dbQrCode && file && file instanceof File && file.size > 0) {
                    await deleteFileFromBunny(extractFilenameFromCDNSafe(dbQrCode as string)).catch((err) =>
                        console.error("[BunnyCDN] Failed to clean up old QR code image:", err)
                    );
                }
                return redirect("/dashboard/settings?success=Update+setting+information+successfully");
            }
        } catch (error: any) {
            console.error("UPDATE_SETTING_FAILED", error);
            if (error.fieldErrors) {
                return error.fieldErrors;
            }
            return { error: error?.message || "Failed to update settings!" };
        }
    }

    return json({ error: "Invalid request method!" });
}

/**
 * Customer payment methods.
 *
 * Saves through its own POST because the surrounding settings form is a
 * PATCH against the `setting` document, while these live in
 * `system_config` — the store the customer top-up screen actually reads.
 */
function PaymentMethodsCard({ methods }: { methods: PaymentMethods }) {
    const navigation = useNavigation();
    const errors = useActionData<Partial<Record<string, string>>>();
    const saving = navigation.state !== "idle" && navigation.formMethod === "POST";

    const [bankOn, setBankOn] = React.useState(methods.bankEnabled);
    const [cryptoOn, setCryptoOn] = React.useState(methods.cryptoEnabled);
    const [network, setNetwork] = React.useState(methods.cryptoNetwork);
    const [qrPreview, setQrPreview] = React.useState<string | null>(null);

    return (
        <Card className="border-0 border rounded-md h-auto">
            <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center">
                    <Landmark className="h-4 w-4 mr-2" />
                    Customer Payment Methods
                </CardTitle>
                <p className="text-xs text-gray-500">
                    What customers can pay with when topping up their wallet.
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                <Form method="post" encType="multipart/form-data" className="space-y-6">
                    <input type="hidden" name="intent" value="payment_methods" />
                    <input type="hidden" name="existingQr" value={methods.bankQrCode} />

                    {/* ── Bank ─────────────────────────────────────────── */}
                    <div className="rounded-md border p-4 space-y-3">
                        <label className="flex items-center justify-between">
                            <span>
                                <span className="block text-sm font-medium text-gray-800">Bank transfer</span>
                                <span className="block text-xs text-gray-500">
                                    Customer scans your QR code and uploads the slip.
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                name="bankEnabled"
                                checked={bankOn}
                                onChange={(e) => setBankOn(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-rose-500"
                            />
                        </label>

                        {bankOn && (
                            <div className="flex items-center gap-4">
                                {(qrPreview || methods.bankQrCode) ? (
                                    <img
                                        src={qrPreview || methods.bankQrCode}
                                        alt="Payment QR"
                                        className="h-24 w-24 rounded-md border object-cover"
                                    />
                                ) : (
                                    <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed text-[11px] text-gray-400">
                                        No QR yet
                                    </div>
                                )}
                                <div>
                                    <input
                                        type="file"
                                        name="bankQrFile"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) setQrPreview(URL.createObjectURL(f));
                                        }}
                                        className="text-xs"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">JPG or PNG. Replaces the current QR.</p>
                                    {errors?.bankQrCode && (
                                        <p className="mt-1 text-xs text-red-600">{errors.bankQrCode}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Crypto ───────────────────────────────────────── */}
                    <div className="rounded-md border p-4 space-y-3">
                        <label className="flex items-center justify-between">
                            <span>
                                <span className="block text-sm font-medium text-gray-800">Cryptocurrency</span>
                                <span className="block text-xs text-gray-500">
                                    Customer sends to your wallet address and uploads proof.
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                name="cryptoEnabled"
                                checked={cryptoOn}
                                onChange={(e) => setCryptoOn(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-rose-500"
                            />
                        </label>

                        {cryptoOn && (
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500">Network</label>
                                    <select
                                        name="cryptoNetwork"
                                        value={network}
                                        onChange={(e) => setNetwork(e.target.value as typeof network)}
                                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                    >
                                        {Object.entries(CRYPTO_NETWORKS).map(([key, net]) => (
                                            <option key={key} value={key}>{net.label}</option>
                                        ))}
                                    </select>
                                    {errors?.cryptoNetwork && (
                                        <p className="mt-1 text-xs text-red-600">{errors.cryptoNetwork}</p>
                                    )}
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="text-xs font-medium text-gray-500">
                                        Exchange rate — kip per 1 USD
                                    </label>
                                    <Input
                                        name="usdRate"
                                        type="number"
                                        min={1}
                                        step={1}
                                        defaultValue={methods.usdRate}
                                        className="text-sm"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Customers paying in crypto see dollar amounts
                                        priced at this rate. It only has to be roughly
                                        right — you confirm the exact kip to credit when
                                        you approve the top-up.
                                    </p>
                                    {errors?.usdRate && (
                                        <p className="mt-1 text-xs text-red-600">{errors.usdRate}</p>
                                    )}
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-medium text-gray-500">Wallet address</label>
                                    <Input
                                        name="cryptoAddress"
                                        defaultValue={methods.cryptoAddress}
                                        placeholder={CRYPTO_NETWORKS[network].example}
                                        className="text-sm font-mono"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        BEP20 is the default Binance withdrawal network. Paste the
                                        address exactly — a wrong one loses the customer&apos;s money.
                                    </p>
                                    {errors?.cryptoAddress && (
                                        <p className="mt-1 text-xs text-red-600">{errors.cryptoAddress}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {errors?.bankEnabled && (
                        <p className="text-xs text-red-600">{errors.bankEnabled}</p>
                    )}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={saving} className="bg-rose-500 hover:bg-rose-600 text-white">
                            {saving ? "Saving..." : "Save payment methods"}
                        </Button>
                    </div>
                </Form>
            </CardContent>
        </Card>
    );
}
