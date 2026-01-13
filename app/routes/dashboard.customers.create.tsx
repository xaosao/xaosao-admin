import { useRef } from "react";
import { ActionFunctionArgs } from "@remix-run/node";
import { UserRoundPlus, X, Upload, Trash2, LoaderCircle } from "lucide-react";
import { Form, useNavigate, useNavigation, useActionData, redirect, json } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import Textfield from "~/components/ui/text-field";
import SelectTextfield from "~/components/ui/select";
import { getCurrentIP, truncateText } from "~/utils";
import Password from "~/components/ui/password-textfield";

// types & Backend
import { ICustomer } from "~/interfaces";
import { customer_type, status, gender } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { addCustomer } from "~/services/customer.server";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { uploadFileToBunnyServer } from "~/services/upload.server";
import { validateCustomerInput } from "~/services/validation.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

export default function CustomersCreateNew() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";
    const fileInfoRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLImageElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const placeholderRef = useRef<HTMLDivElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const validationErrors = useActionData<Partial<Record<keyof ICustomer, string>>>();

    function closeHandler() {
        navigate("..");
    }

    // Handle file selection and preview
    function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        const preview = previewRef.current;
        const fileInfo = fileInfoRef.current;
        const placeholder = placeholderRef.current;

        if (file && file.type.startsWith('image/') && preview && fileInfo && placeholder) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target?.result as string;
                preview.style.display = 'block';
                placeholder.style.display = 'none';

                fileInfo.innerHTML = `
                    <p class="font-medium">File: ${truncateText(file.name, 25)}</p>
                    <p class="text-muted-foreground">Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                `;
                fileInfo.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    function handleFileButtonClick() {
        fileInputRef.current?.click();
    }

    function removeFile() {
        const preview = previewRef.current;
        const fileInfo = fileInfoRef.current;
        const placeholder = placeholderRef.current;

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        if (preview && fileInfo && placeholder) {
            preview.style.display = 'none';
            fileInfo.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    }


    const canCreate = hasPermission("customer", "create");
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
            <h4 className="text-md font-bold text-primary">Create new customer form:</h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                <div className="lg:col-span-2">
                    <Form className="space-y-4" method="post" encType="multipart/form-data">
                        <div className="grid grid-cols-2 gap-4">
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Textfield
                                    required
                                    type="date"
                                    id="dob"
                                    name="dob"
                                    title="Date of Birth"
                                    color="text-gray-500"
                                    placeholder="Enter date of birth...."
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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Textfield
                                    type="text"
                                    id="username"
                                    name="username"
                                    title="Username (Optional)"
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
                                    title="Status"
                                    name="status"
                                    option={status}
                                />
                            </div>
                            <div className="space-y-2">
                                <SelectTextfield
                                    required
                                    title="Customer type"
                                    name="tier"
                                    option={customer_type}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <Textfield
                                minLength={10}
                                required
                                type="number"
                                id="whatsapp"
                                name="whatsapp"
                                title="Whatsapp"
                                color="text-gray-500"
                                placeholder="Enter whatsapp...."
                            />
                        </div>

                        {/* Profile Image Upload */}
                        <div className="space-y-2">
                            <label htmlFor="profile_image" className="text-xs text-gray-500">Profile Image</label>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    id="profile_image"
                                    name="profile"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleFileButtonClick}
                                    className="flex items-center gap-2 text-xs text-gray-500"
                                >
                                    <Upload className="w-4 h-4" />
                                    Select Image
                                </Button>

                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={removeFile}
                                >
                                    <Trash2 />
                                </Button>
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
                                {isSubmitting ? "Adding..." : "Add Customer"}
                            </Button>
                        </div>
                    </Form>
                </div>

                {/* Preview Section - No State Required */}
                <div className="lg:col-span-1">
                    <div className="sticky top-0">
                        <h5 className="text-xs font-semibold mb-4 text-gray-500">Profile Preview</h5>
                        <div className="border rounded-lg p-4 bg-muted/50">
                            <div className="space-y-4">
                                <div className="aspect-square w-full max-w-48 mx-auto">
                                    <img
                                        ref={previewRef}
                                        alt="Profile preview"
                                        className="w-full h-full object-cover rounded-lg border"
                                        style={{ display: 'none' }}
                                    />
                                    <div
                                        ref={placeholderRef}
                                        className="aspect-square w-full border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center"
                                    >
                                        <div className="text-center text-muted-foreground">
                                            <Upload className="w-8 h-8 mx-auto mb-2" />
                                            <p className="text-sm">No image selected</p>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    ref={fileInfoRef}
                                    className="text-sm text-center"
                                    style={{ display: 'none' }}
                                >
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "customer",
        action: "create",
    });
    const formData = await request.formData();
    const customerData = Object.fromEntries(formData) as Partial<ICustomer>;
    const file = formData.get("profile");
    const ip = await getCurrentIP();
    const accessKey = process.env.APIIP_API_KEY || "";
    if (request.method === "POST") {
        try {
            if (file && file instanceof File && file.size > 0) {
                const buffer = Buffer.from(await file.arrayBuffer());
                const url = await uploadFileToBunnyServer(buffer, file.name, file.type);
                customerData.profile = url;
            } else {
                customerData.profile = "";
            }
            customerData.whatsapp = Number(customerData.whatsapp);
            await validateCustomerInput(customerData);
            const res = await addCustomer(customerData as ICustomer, userId, ip, accessKey);
            if (res.id) {
                return redirect("/dashboard/customers?success=Create+new+customer+successfully");
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
