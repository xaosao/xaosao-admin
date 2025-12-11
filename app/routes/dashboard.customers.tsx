import { Outlet } from "@remix-run/react";
export default function Customers() {
  return (
    <div className="space-y-4">
      <Outlet />
    </div>
  );
}