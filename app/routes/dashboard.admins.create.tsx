import { ActionFunctionArgs } from "@remix-run/node";
import { useRef, useState, ChangeEvent } from "react";
import { LoaderCircle, Upload, UserRoundPlus } from "lucide-react"
import { Form, json, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import Textfield from "~/components/ui/text-field";
import SelectTextfield from "~/components/ui/select";
import Password from "~/components/ui/password-textfield";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

// libs and Backend
import { gender, status } from "~/utils"
import { IAdminInput } from "~/interfaces";
import { getRoles } from "~/services/role.server";
import { createAdmin } from "~/services/admin.server";
import { useAuthStore } from "~/store/permissionStore";
import { validateAdminInput } from "~/services/validation.server";
import { uploadFileToBunnyServer } from "~/services/upload.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

type Role = {
    id: string;
    name: string;
};

export default function AdminCreation() {
    const navigate = useNavigate()
    const navigation = useNavigation()
    const rawRoles = useLoaderData<typeof loader>() as Role[]
    const roles = rawRoles.map(({ id, name }) => ({
        label: name,
        value: id
    }));
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST"
    const validationErrors = useActionData<Partial<Record<keyof IAdminInput, string>>>();

    function closeHandler() {
        navigate("..")
    }

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

    const canCreate = hasPermission("admin", "create");
    if (!canCreate) {
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
        <Modal onClose={closeHandler} className="w-3/5">
            <h4 className="text-md font-bold text-primary mb-2">Create new admin form:</h4>
            <Form method="post" className="space-y-6 mt-2" encType="multipart/form-data">
                <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage
                            src={imagePreview || ""}
                            alt="Admin avatar"
                        />
                        <AvatarFallback className="text-lg">
                            U
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
                    </div>
                </div>
                {/* <Separator /> */}
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
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="text"
                                id="username"
                                name="username"
                                title="Username"
                                color="text-gray-500"
                                placeholder="Enter username...."
                            />
                        </div>
                        <div className="space-y-2">
                            <Password
                                required
                                id="password"
                                name="password"
                                title="Password"
                                color="text-gray-500"
                                placeholder="Enter your password..."
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
                                placeholder="2078856184"
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
                            />
                        </div>
                        <div className="space-y-2">
                            <SelectTextfield
                                required
                                title="Roles"
                                name="role"
                                option={roles}
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
                        {isSubmitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <UserRoundPlus className="w-4 h-4" />}
                        {isSubmitting ? "Creating..." : "Create"}
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "admin",
        action: "create",
    });
    const rawRoles = await getRoles();
    return rawRoles;
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "admin",
        action: "create",
    });
    const formData = await request.formData();
    const adminData = Object.fromEntries(formData) as Partial<IAdminInput>;
    const file = formData.get("profile") as File;
    if (request.method === "POST") {
        try {
            if (file && file instanceof File && file.size > 0) {
                const buffer = Buffer.from(await file.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, file.name, file.type);
                adminData.profile = url;
            } else {
                adminData.profile = "";
            }
            adminData.tel = Number(adminData.tel);
            await validateAdminInput(adminData);
            const res = await createAdmin(adminData as IAdminInput, userId as string);
            if (res.id) {
                return redirect("/dashboard/admins?success=Create+new+admin+successfully");
            }
        } catch (error: any) {
            console.error("CREATE_ADMIN_FAILED", error);

            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}