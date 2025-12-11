import { Outlet } from "@remix-run/react";
export default function ChatsLayout() {
    return (
        <div className="space-y-4">
            <Outlet />
        </div>
    );
}