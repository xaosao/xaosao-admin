import React, { ChangeEvent, useRef } from "react"
import { ActionFunctionArgs, json, redirect } from "@remix-run/node"
import { Upload, LoaderCircle, UserRoundPlus, X } from "lucide-react"
import { Form, useActionData, useNavigate, useNavigation } from "@remix-run/react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import SelectTextfield from "~/components/ui/select"
import Password from "~/components/ui/password-textfield"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

// utils 
import { IModelInput } from "~/interfaces/model"
import { createModel } from "~/services/model.server"
import { useAuthStore } from "~/store/permissionStore"
import { validateModelInputs } from "~/services/validation.server"
import { uploadFileToBunnyServer } from "~/services/upload.server"
import { AvailableStatus, Gender, UserStatus } from "~/interfaces/base"
import { available_status, gender, getCurrentIP, status } from "~/utils"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

export default function CreateNewModelPage() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const fileInputRef = useRef<HTMLInputElement>(null)
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const validationErrors = useActionData<Partial<Record<keyof IModelInput, string>>>();

    const [imagePreview, setImagePreview] = React.useState<string | null>(null)
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

    function closeHandler() {
        navigate("..");
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

    const canCreate = hasPermission("model", "create");
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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5">
            <Form className="space-y-6" method="post" encType="multipart/form-data">
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
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="text"
                                id="first_name"
                                name="firstName"
                                title="First Name"
                                color="text-gray-500"
                                placeholder="Enter first name...."
                            />
                        </div>

                        <div className="space-y-2">
                            <Textfield
                                type="text"
                                id="last_name"
                                name="lastName"
                                title="Last Name"
                                color="text-gray-500"
                                placeholder="Enter last name...."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="date"
                                id="dob"
                                name="dob"
                                title="Date of Birth"
                                color="text-gray-500"
                                placeholder="Enter birthday...."
                            />
                        </div>

                        <div className="space-y-2">
                            <SelectTextfield
                                required
                                title="Gender"
                                name="gender"
                                option={gender}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <SelectTextfield
                                required
                                title="Status"
                                name="status"
                                option={status}
                            />
                        </div>

                        <div className="space-y-2">
                            <SelectTextfield
                                required
                                title="Available Status"
                                name="available_status"
                                option={available_status}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="number"
                                id="whatsapp"
                                name="whatsapp"
                                title="Whatsapp Number"
                                color="text-gray-500"
                                placeholder="Enter whatsapp number...."
                            />
                        </div>
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="text"
                                id="address"
                                name="address"
                                title="Address"
                                color="text-gray-500"
                                placeholder="Enter address...."
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Textfield
                            required
                            multiline
                            rows={2}
                            type="text"
                            id="bio"
                            name="bio"
                            title="Bio"
                            color="text-gray-500"
                            placeholder="Enter your bio..."
                        />
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
                <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={closeHandler}>
                        <X className="w-4 h-4" />
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : <UserRoundPlus className="w-4 h-4" />}
                        {isSubmitting ? "Adding..." : "Add model"}
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}


export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "model",
        action: "create",
    });
    const formData = await request.formData();
    const model = Object.fromEntries(formData) as Record<string, string>;
    const file = formData.get("profile");
    const ip = await getCurrentIP();
    const accessKey = process.env.APIIP_API_KEY || "";
    if (request.method === "POST") {
        try {
            if (file && file instanceof File && file.size > 0) {
                const buffer = Buffer.from(await file.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, file.name, file.type);
                model.profile = url;
            } else {
                model.profile = "";
            }
            const input: IModelInput = {
                firstName: model.firstName,
                lastName: model.lastName,
                username: model.username,
                password: model.password,
                gender: model.gender as Gender,
                dob: model.dob,
                whatsapp: Number(model.whatsapp),
                address: model.address,
                bio: model.bio,
                status: model.status as UserStatus,
                available_status: model.available_status as AvailableStatus,
                profile: model.profile,
            };
            await validateModelInputs(input);
            const res = await createModel(input, userId, ip, accessKey);
            if (res?.id) {
                return redirect("/dashboard/models?success=Create+new+model+successfully");
            }
        } catch (error: any) {
            console.log("ADD_CUSTOMER_FAILED", error);

            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}
