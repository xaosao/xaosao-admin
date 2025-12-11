import React, { ChangeEvent, useRef } from "react";
import { LoaderCircle, Upload, UserPen } from "lucide-react"
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, json, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import Textfield from "~/components/ui/text-field";
import SelectTextfield from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

// libs and interfaces
import { IAdminUpdateInput } from "~/interfaces";
import { getRoles } from "~/services/role.server";
import { useAuthStore } from "~/store/permissionStore";
import { Gender, UserStatus } from "~/interfaces/base";
import { getAdmin, updateAdmin } from "~/services/admin.server";
import { extractFilenameFromCDNSafe, gender, status } from "~/utils"
import { validateUpdateAdminInputs } from "~/services/validation.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { deleteFileFromBunny, uploadFileToBunnyServer } from "~/services/upload.server";

export default function UpdateAdmin() {
    const navigate = useNavigate()
    const navigation = useNavigation()
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { admin, rawRoles } = useLoaderData<typeof loader>();
    const roles = rawRoles.map(({ id, name }) => ({
        label: name,
        value: id
    }));
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [imagePreview, setImagePreview] = React.useState<string | null>(null)
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH"
    const validationErrors = useActionData<Partial<Record<keyof IAdminUpdateInput, string>>>();

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

    function closeHandler() {
        navigate("..")
    }

    const canEdit = hasPermission("admin", "edit");
    if (!canEdit) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        )
    }

    return (
        <Modal onClose={closeHandler} className="w11/12 sm:w-3/5">
            <h4 className="text-md font-bold text-primary mb-2">Update Admin Information Form:</h4>
            <Form method="patch" className="space-y-6 mt-2" encType="multipart/form-data">
                <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={imagePreview ? imagePreview : admin.profile ?? ""} alt="Admin avatar" />
                        <AvatarFallback className="text-lg">
                            {admin.firstName.charAt(0)}
                            {admin?.lastName?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <Button type="button" variant="outline" size="sm" onClick={handleImageUpload}>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Photo
                        </Button>
                        <p className="text-xs text-gray-500 mt-2">JPG, PNG up to 5MB</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            name="profile"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <input className="hidden" name="dbProfile" defaultValue={admin.profile ?? ""} />
                    </div>
                </div>
                <Separator />
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="text"
                                id="firstName"
                                name="firstName"
                                title="First Name"
                                color="text-gray-500"
                                placeholder="Enter first name...."
                                defaultValue={admin.firstName}
                            />
                        </div>
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="text"
                                id="lastName"
                                name="lastName"
                                title="Last Name"
                                color="text-gray-500"
                                placeholder="Enter last name...."
                                defaultValue={admin.lastName ?? ""}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <SelectTextfield
                                required
                                title="Gender"
                                name="gender"
                                option={gender}
                                defaultValue={admin.gender}
                            />
                        </div>
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="number"
                                id="tel"
                                name="tel"
                                title="Phone Number"
                                color="text-gray-500"
                                placeholder="02078856184"
                                defaultValue={admin.tel}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="email"
                                id="email"
                                name="email"
                                title="Email"
                                color="text-gray-500"
                                placeholder="Enter email address..."
                                defaultValue={admin.email}
                            />
                        </div>
                        <div className="space-y-2">
                            <SelectTextfield
                                required
                                title="Roles"
                                name="role"
                                option={roles}
                                defaultValue={admin.role.id}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="space-y-2">
                                <SelectTextfield
                                    required
                                    title="Status"
                                    name="status"
                                    option={status}
                                    defaultValue={admin.status}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Textfield
                                required
                                multiline
                                rows={1}
                                type="text"
                                id="address"
                                name="address"
                                title="Address"
                                color="text-gray-500"
                                placeholder="Enter your address..."
                                defaultValue={admin.address ?? ""}
                            />
                        </div>
                    </div>
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

                <div className="flex items-center justify-start space-x-2">
                    <Button type="button" variant="outline" onClick={closeHandler}>
                        Cancel
                    </Button>
                    <Button type="submit" className="bg-dark-pink hover:opacity-90 text-white" disabled={isSubmitting}>
                        {isSubmitting ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : <UserPen className="w-4 h-4" />}
                        {isSubmitting ? "Updating..." : "Update"}
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "admin",
        action: "edit",
    });
    const admin = await getAdmin(params.id!);
    const rawRoles = await getRoles();
    if (!admin) {
        throw new Response("Admin not found", { status: 404 });
    }
    return json({ admin, rawRoles });
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "admin",
        action: "edit",
    });

    const adminId = params.id || "";
    if (!adminId) {
        return json({ error: "Invalid customer ID" });
    }
    const formData = await request.formData();
    const admin = Object.fromEntries(formData) as Record<string, string>;
    const file = formData.get("profile") as File;
    const dbProfile = formData.get("dbProfile");

    if (request.method === "PATCH") {
        try {
            if (file && file instanceof File && file.size > 0) {
                if (dbProfile) {
                    await deleteFileFromBunny(extractFilenameFromCDNSafe(dbProfile as string))
                }
                const buffer = Buffer.from(await file.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, file.name, file.type);
                admin.profile = url;
            } else {
                admin.profile = "";
            }
            const input: IAdminUpdateInput = {
                firstName: admin.firstName,
                lastName: admin.lastName,
                gender: admin.gender as Gender,
                tel: Number(admin.tel),
                email: admin.email,
                role: admin.role,
                address: admin.address,
                status: admin.status as UserStatus,
                profile: admin.profile,
            };
            await validateUpdateAdminInputs(input);
            const res = await updateAdmin(adminId, input, userId);
            if (res.id) {
                return redirect("/dashboard/admins?success=Update+admin+information+successfully");
            }
        } catch (error: any) {
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}