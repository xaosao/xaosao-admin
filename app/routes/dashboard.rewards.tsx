import { Outlet } from "@remix-run/react"

export default function RewardsLayout() {
    return (
        <div className="w-full">
            <Outlet />
        </div>
    )
}
