
import { useNavigate } from "@remix-run/react"
import { Lock, ArrowLeft, ShieldAlert } from 'lucide-react'

// components
import { cn } from "~/utils"
import { Badge } from "./badge"
import { Button } from "./button"

type ForbiddenCardProps = {
    className?: string
    title?: string
    subtitle?: string
    reason?: string
}

export function ForbiddenCard({
    className,
    title = "Access restricted",
    subtitle = "Your admin account doesn’t have permission to view this page.",
    reason = "403 — Forbidden",
}: ForbiddenCardProps) {

    const navigate = useNavigate()
    function closeHandler() {
        navigate("..")
    }

    return (
        <section
            aria-labelledby="forbidden-title"
            className={cn(
                "relative w-full max-w-xl rounded-xl border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                "shadow-sm",
                className
            )}
        >
            <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
            />
            <div className="flex flex-col items-center gap-5 px-5 pb-5 pt-6 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="inline-flex size-6 items-center justify-center rounded-full border">
                        <Lock className="size-3.5" aria-hidden="true" />
                    </span>
                    <Badge variant="outline" className="h-6 px-2 text-[10px] font-medium tracking-wide">
                        Admin
                    </Badge>
                </div>

                <header className="text-center">
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{reason}</p>
                    <h1 id="forbidden-title" className="text-lg font-semibold leading-tight">
                        {title}
                    </h1>
                    <p className="mt-1 text-muted-foreground">{subtitle}</p>
                </header>

                <ul className="w-full list-none space-y-2 rounded-md border p-3 text-muted-foreground">
                    <li className="flex items-center gap-2">
                        <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">You may need elevated role or explicit permission.</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">If this is unexpected, contact an administrator.</span>
                    </li>
                </ul>

                <div className="flex w-full items-center justify-between gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        onClick={closeHandler}
                        aria-label="Go back"
                    >
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                        <span>Back</span>
                    </Button>
                </div>
            </div>
        </section>
    )
}
