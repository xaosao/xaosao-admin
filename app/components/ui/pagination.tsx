import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    baseUrl: string;
    searchParams: URLSearchParams;
}

export default function Pagination({
    currentPage,
    totalPages,
    totalCount,
    limit,
    hasNextPage,
    hasPreviousPage,
    baseUrl,
    searchParams,
}: PaginationProps) {
    const createPageUrl = (page: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", page.toString());
        return `${baseUrl}?${params.toString()}`;
    };

    const startResult = (currentPage - 1) * limit + 1;
    const endResult = Math.min(currentPage * limit, totalCount);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 gap-2">
            <div className="flex items-center text-sm text-gray-700">
                Showing {startResult} to {endResult} of {totalCount} results
            </div>
            <div className="flex items-center space-x-2">
                {hasPreviousPage ? (
                    <Button variant="outline" size="sm" asChild>
                        <Link to={createPageUrl(currentPage - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden sm:flex">Previous</span>
                        </Link>
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" disabled>
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:flex">Previous</span>
                    </Button>
                )}
                <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                </span>
                {hasNextPage ? (
                    <Button variant="outline" size="sm" asChild>
                        <Link to={createPageUrl(currentPage + 1)}>
                            <span className="hidden sm:flex">Next</span>
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" disabled>
                        <span className="hidden sm:flex">Next</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}