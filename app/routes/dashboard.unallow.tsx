import { ForbiddenCard } from "~/components/ui/forbidden-card";

export default function Page() {
    return (
        <main className="min-h-[80dvh] w-full bg-white dark:bg-black">
            <div className="container mx-auto grid h-[80dvh] place-items-center px-4">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        </main>
    )
}
