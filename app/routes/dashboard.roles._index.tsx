import React from "react";
import { toast } from "react-toastify";
import { json, Link, useLoaderData, useNavigate } from "@remix-run/react";
import {
  Key,
  Edit,
  Lock,
  Plus,
  Trash2,
  Shield,
  CheckCircle,
  TrendingUp,
  Users,
  ArrowLeft,
} from "lucide-react";

// components
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { Card, CardContent } from "~/components/ui/card";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import {
  Table,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
} from "~/components/ui/table";

// backend
import { formatDate1 } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { getRoles, getRoleStats } from "~/services/role.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

const iconMap = {
  Shield,
  CheckCircle,
  Key,
  Lock
};


export default function Roles() {
  const navigate = useNavigate()
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { roles, roleStats, success } = useLoaderData<typeof loader>();

  React.useEffect(() => {
    if (success) {
      toast.success(success);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("success");

      navigate(newUrl.pathname + newUrl.search, { replace: true });
    }
  }, [success, navigate]);

  const canView = hasPermission("role", "view");
  if (!canView) {
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-md sm:text-lg font-semibold text-gray-900 mb-2">Roles management</h1>
          <Breadcrumb
            items={[
              { label: "Dashboard", value: "/dashboard" },
              { label: "Admins", value: "/dashboard/admins" },
              { label: "Roles Management", value: "/dashboard/roles" },
            ]}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/admins")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button className="bg-dark-pink hover:opacity-90 text-white">
            <Link to="/dashboard/roles/create" className="flex items-center space-x-4">
              <Plus className="h-4 w-4" />
              Create New
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roleStats.map((stat) => {
          const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
          return (
            <Card key={stat.title} className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.title}</p>
                    <p className="text-xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50">
                    {IconComponent && (
                      <IconComponent className={`h-4 w-4 ${stat.color}`} />
                    )}
                  </div>
                </div>
                <p className="flex items-start mt-2 text-xs">
                  <TrendingUp className="text-green-500 mr-2" width={15} height={15} />
                  {stat.title === "Total Permissions" ? "Permissions" : "Roles"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100">
                  <TableHead className="font-semibold">No</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Users</TableHead>
                  <TableHead className="font-semibold">Permissions</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Created At</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles && roles.length > 0 ? roles.map((role, index: number) => (
                  <TableRow key={role.id} className="text-gray-500 border-gray-50 hover:bg-gray-50">
                    <TableCell className="text-gray-500">{index + 1}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className={`p-2 rounded-lg ${role.status === "active" ? "bg-green-100" : "bg-red-100"}`}>
                            <Shield className={`h-4 w-4 ${role.status === "active" ? "text-green-800" : "text-red-800"}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">{role.name}</p>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{role.userCount}</span>
                        <span className="text-sm text-gray-500">Users</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Key className="h-3 w-3 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{role.permissionCount}</span>
                        <span className="text-sm text-gray-500">Permissions</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={role.status} />
                    </TableCell>
                    <TableCell>
                      {formatDate1(role.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="text-gray-500 flex items-center space-x-4">
                        <Link to={`${role.id}`}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                        <Link to={`delete/${role.id}`}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <EmptyPage
                      title="No role found!"
                      description="There is role in the database yet!"
                    />
                  </TableCell>
                </TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export async function loader({ request }: { request: Request }) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "role",
    action: "view",
  });
  const url = new URL(request.url);
  const success = url.searchParams.get("success");

  try {
    const [roles, roleStats] = await Promise.all([
      getRoles(),
      getRoleStats()
    ]);
    return json(
      {
        roles,
        roleStats,
        success,
      }
    );
  } catch (error) {
    console.error("LOADER_FAILED", error);
    throw new Error("Failed to fetch data");
  }
}