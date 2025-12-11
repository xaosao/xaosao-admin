import { Loader2, Shield } from "lucide-react"
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node"
import { Form, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"

// Types and backend
import { IPermission } from "~/interfaces"
import { useAuthStore } from "~/store/permissionStore"
import { capitalizeFirstLetter, status } from "~/utils"
import { validateRoleInput } from "~/services/validation.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"
import { getRoleWithPermissions, getPermissions, updateRole } from "~/services/role.server"

// Components
import Modal from "~/components/ui/modal"
import EmptyPage from "~/components/ui/empty"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import { Checkbox } from "~/components/ui/checkbox"
import SelectTextfield from "~/components/ui/select"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function UpdateRole() {
    const navigate = useNavigate()
    const navigation = useNavigation()
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { permissions, rolePermissions, name, roleStatus } = useLoaderData<typeof loader>() as unknown as {
        permissions: IPermission[]
        rolePermissions: {
            id: string
            permissionId: string
            permission: IPermission
        }[]
        name: string
        roleStatus: string
    }

    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH"
    const validationErrors = useActionData<Partial<Record<keyof string, string>>>();

    const assignedIds = new Set(rolePermissions.map(p => p.permissionId))
    const groupedPermissions = permissions.reduce((acc, permission) => {
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

    const canEdit = hasPermission("role", "edit");
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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5">
            <h4 className="flex items-center justify-start text-lg font-bold text-gray-800 mb-4">
                <Shield />&nbsp; Update role and permission
            </h4>
            <Form method="patch" encType="multipart/form-data">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Textfield
                            required
                            type="text"
                            id="name"
                            name="name"
                            title="Role name"
                            color="text-gray-500"
                            placeholder="Enter role name...."
                            defaultValue={name}
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="space-y-2">
                            <SelectTextfield
                                required
                                title="Status"
                                name="status"
                                option={status}
                                defaultValue={roleStatus}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between border-b">
                        <h3 className="text-sm font-semibold">All permissions:</h3>
                    </div>

                    {groupNames && groupNames.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4">
                            {groupNames.map(groupName => {
                                const groupPermissions = groupedPermissions[groupName]
                                return (
                                    <Card key={groupName} className="text-gray-500 border-b py-2 px-2">
                                        <CardHeader className="p-1">
                                            <CardTitle className="text-sm text-black font-bold">
                                                {capitalizeFirstLetter(groupName)}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-2 flex flex-col gap-2.5 text-xs">
                                            {groupPermissions.map(permission => (
                                                <div
                                                    key={permission.id}
                                                    className="flex items-center justify-start space-x-2"
                                                >
                                                    <Checkbox
                                                        id={permission.id}
                                                        name="permissions"
                                                        value={permission.id}
                                                        defaultChecked={assignedIds.has(permission.id)}
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
                    ) : (
                        <div className="w-full flex items-center jutify-center">
                            <EmptyPage
                                title="No permissions found!"
                                description="There is permissions in the database yet!"
                            />
                        </div>
                    )}
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
        group: "role",
        action: "edit",
    });
    const roleId = params.id
    if (!roleId) throw new Error("Role ID is required")
    const permissions = await getPermissions()
    const role = await getRoleWithPermissions(roleId)
    return json({ permissions, rolePermissions: role?.permissionRoles, name: role?.name, roleStatus: role?.status })
}

export async function action({ request, params }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    const id = await params.id;
    const formData = await request.formData()
    const name = formData.get("name") as string;
    const status = formData.get("status") as string;
    const selectedPermissions = formData.getAll("permissions")
    const permissions = selectedPermissions.map(val => String(val))
    if (request.method === "PATCH") {
        try {
            await validateRoleInput({ name, permissions });
            const res = await updateRole(id || "", name, status, permissions, userId)
            if (res.id) {
                return redirect("/dashboard/roles?success=Update+role+successfully");
            }
        } catch (error: any) {
            console.error("ERROR_UPDATE_ROLE", error)
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}