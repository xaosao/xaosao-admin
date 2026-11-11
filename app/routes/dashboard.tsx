import { useState } from "react";
import { Menu, X } from "lucide-react";
import { json, Outlet, useLoaderData } from "@remix-run/react";

import { DashboardSidebar } from "~/components/dashboard-sidebar";
import { DashboardNavbar } from "~/components/dashboard-navbar";

// services
import { getAdmin } from "~/services/admin.server";
import { requireUserSession } from "~/services/auth.server";
import { getPendingCounts } from "~/services/dashboard.server";

export default function DashboardLayout() {
  const { admin, pendingCounts } = useLoaderData<typeof loader>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* The drawer on a phone, a column of the page on a desktop. Either
          way it owns a fixed width and its own height, so the menu scrolls
          inside it instead of running off the screen. */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col border-r bg-white transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:static lg:translate-x-0`}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 lg:hidden">
          <h2 className="font-bold text-lg">Menu</h2>
          <button onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <DashboardSidebar pendingCounts={pendingCounts} />
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="font-semibold">Dashboard</h1>
          <div />
        </div>

        <div className="hidden shrink-0 lg:block">
          <DashboardNavbar admin={admin!} />
        </div>
        <main className="relative min-h-0 flex-1 overflow-auto py-6">
          <div className="w-full min-w-0 px-2 sm:px-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export async function loader({ request }: { request: Request }) {
  const ID = await requireUserSession(request);
  try {
    const [admin, pendingCounts] = await Promise.all([
      getAdmin(ID),
      getPendingCounts(),
    ]);
    return json({ admin, pendingCounts });
  } catch (error) {
    console.log("LOAD_ADMIN_DATA_FAILED", error);
    throw new Error("Failed to fetch data");
  }
}
