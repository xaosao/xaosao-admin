import { Loader2, Shield } from "lucide-react"
import { ActionFunctionArgs, redirect } from "@remix-run/node"
import { Form, json, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"

// type and backend
import { IPermission } from "~/interfaces"
import { capitalizeFirstLetter } from "~/utils"
import { useAuthStore } from "~/store/permissionStore"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"
import { createRole, getPermissions } from "~/services/role.server"
import { validateRoleInput } from "~/services/validation.server"

// components
import Modal from "~/components/ui/modal"
import EmptyPage from "~/components/ui/empty"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import { Checkbox } from "~/components/ui/checkbox"
import { Separator } from "~/components/ui/separator"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function RoleCreation() {
    const navigate = useNavigate()
    const navigation = useNavigation()
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const permissionData = useLoaderData<typeof loader>() as IPermission[]
    const validationErrors = useActionData<Partial<Record<keyof string, string>>>();

    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST"

    // Group permissions by groupName
    const groupedPermissions = permissionData.reduce((acc, permission) => {
        if (permission.status === "active") {
            if (!acc[permission.groupName]) acc[permission.groupName] = []
            acc[permission.groupName].push(permission)
        }
        return acc
    }, {} as Record<string, IPermission[]>)

    const groupNames = Object.keys(groupedPermissions)

    function closeHandler() {
        navigate("..")
    }

    const canCreate = hasPermission("role", "create");
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
            <h4 className="flex items-center justify-start text-lg font-bold text-gray-800 mb-4">
                <Shield />&nbsp; Create new role
            </h4>
            <Form method="post" encType="multipart/form-data">
                <div className="space-y-2">
                    <Textfield
                        required
                        type="text"
                        id="name"
                        name="name"
                        title="Role name"
                        color="text-gray-500"
                        placeholder="Enter role name...."
                    />
                </div>
                <div className="w-full space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-500">Asign permissions to role:</h3>
                    </div>
                    <Separator />
                    {groupNames && groupNames.length > 0 ?
                        <div className="grid grid-cols-2 md:grid-cols-4">
                            {groupNames.map((groupName) => {
                                const groupPermissions = groupedPermissions[groupName]
                                return (
                                    <Card key={groupName} className="text-gray-500 border-b py-2 px-2">
                                        <CardHeader className="p-1">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-sm text-gray-500 font-bold">
                                                    {capitalizeFirstLetter(groupName)}
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-2 flex flex-col gap-2.5 text-xs">
                                            {groupPermissions.map((permission) => (
                                                <div key={permission.id} className="flex items-center justify-start space-x-2">
                                                    <Checkbox
                                                        id={permission.id}
                                                        name="permissions"
                                                        value={permission.id}
                                                    />
                                                    <div className="flex-1 min-w-0 font-normal">
                                                        <label htmlFor={permission.id} className="text-sm cursor-pointer">
                                                            {capitalizeFirstLetter(permission.name)}
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                        : <div className="w-full flex items-center jutify-center">
                            <EmptyPage
                                title="No permissions found!"
                                description="There is permissions in the database yet!"
                            />
                        </div>}
                </div>
                <div className="mt-2">
                    {validationErrors && Object.keys(validationErrors).length > 0 && (
                        <div>
                            {Object.values(validationErrors).map((error, index) => (
                                <div key={index} className="flex items-center p-2 mb-2 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800" role="alert">
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
                <div className="mt-4 flex items-center justify-start space-x-4">
                    <Button type="button" variant="outline" onClick={closeHandler}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-dark-pink hover:bg-dark-pink/90"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ""}
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
        group: "role",
        action: "create",
    });
    const permissions = await getPermissions();
    if (!permissions) throw new Error("Failed to fetch permissions!");
    return json(permissions)
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    const formData = await request.formData()
    const name = formData.get("name") as string
    const permissions = formData.getAll("permissions") as string[]
    if (request.method === "POST") {
        try {
            await validateRoleInput({ name, permissions });
            const res = await createRole(name, permissions, userId);
            if (res.id) {
                return redirect("/dashboard/roles?success=Create+new+role+successfully");
            }
        } catch (error: any) {
            console.error("ERROR_CREATE_ROLE", error)
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}
