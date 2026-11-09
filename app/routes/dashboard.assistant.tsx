import { Outlet } from "@remix-run/react"

export default function AssistantLayout() {
    return (
        <div className="w-full">
            <Outlet />
        </div>
    )
}
