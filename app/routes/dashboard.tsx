import { useState } from "react";
import { Menu, X } from "lucide-react";
import { json, Outlet, useLoaderData } from "@remix-run/react";

import { DashboardSidebar } from "~/components/dashboard-sidebar";
import { DashboardNavbar } from "~/components/dashboard-navbar";

// services
import { getAdmin } from "~/services/admin.server";
import { requireUserSession } from "~/services/auth.server";

export default function DashboardLayout() {
  const { admin } = useLoaderData<typeof loader>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-bold text-lg">Menu</h2>
          <button onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <DashboardSidebar />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="font-semibold">Dashboard</h1>
          <div />
        </div>

        <div className="hidden lg:block">
          <DashboardNavbar admin={admin!} />
        </div>
        <main className="flex-1 overflow-y-auto py-6">
          <div className="mx-auto px-2 sm:px-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export async function loader({ request }: { request: Request }) {
  // await requireUserSession(request);
  // return getUserFromSession(request);
  const ID = await requireUserSession(request);
  try {
    const admin = await getAdmin(ID)
    return json({ admin });
  } catch (error) {
    console.log("LOAD_ADMIN_DATA_FAILED", error);
    throw new Error("Failed to fetch data");
  }
}
