import { router } from '@inertiajs/react';

interface PaginatorShape {
    current_page: number;
    last_page: number;
    total?: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

/**
 * Standard pagination footer for Laravel paginators. Renders nothing for a
 * single page. Pass `className` to adjust the outer margin (default mt-6).
 */
export default function Paginator({
    paginator,
    className = 'mt-6',
}: {
    paginator: PaginatorShape;
    className?: string;
}) {
    if (paginator.last_page <= 1) return null;

    return (
        <div className={`flex items-center justify-between gap-3 ${className}`}>
            <span className="text-xs text-neutral-500">
                Page {paginator.current_page} of {paginator.last_page}
                {typeof paginator.total === 'number' && ` · ${paginator.total.toLocaleString()} total`}
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={!paginator.prev_page_url}
                    onClick={() => paginator.prev_page_url && router.get(paginator.prev_page_url)}
                    className="btn-secondary px-3 py-1.5 text-xs"
                >
                    Previous
                </button>
                <button
                    type="button"
                    disabled={!paginator.next_page_url}
                    onClick={() => paginator.next_page_url && router.get(paginator.next_page_url)}
                    className="btn-secondary px-3 py-1.5 text-xs"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
