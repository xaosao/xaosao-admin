import { Link } from "@remix-run/react";

/**
 * The two halves of the reward feature. Timed slots a model has to catch,
 * and the all-day check-in — different enough to deserve their own pages,
 * related enough that an admin expects them side by side.
 */
export function RewardTabs({ active }: { active: "slots" | "checkin" }) {
    const base =
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors";
    const on = "bg-rose-500 text-white";
    const off = "bg-gray-100 text-gray-600 hover:bg-gray-200";

    return (
        <div className="flex gap-2">
            <Link
                to="/dashboard/rewards"
                className={`${base} ${active === "slots" ? on : off}`}
            >
                Timed rewards
            </Link>
            <Link
                to="/dashboard/rewards/checkin"
                className={`${base} ${active === "checkin" ? on : off}`}
            >
                Daily check-in
            </Link>
        </div>
    );
}
