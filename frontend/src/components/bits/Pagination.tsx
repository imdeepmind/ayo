import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

const MAX_PAGE_SIZE = 50;

function getPageItems(current: number, totalPages: number): Array<number | '...'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const candidates = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...candidates]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | '...'> = [];
  let previous = 0;
  for (const pageNumber of sorted) {
    if (pageNumber - previous > 1) {
      items.push('...');
    }
    items.push(pageNumber);
    previous = pageNumber;
  }
  return items;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageItems = getPageItems(page, totalPages);

  const buttonBase =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const buttonIdle =
    'text-text-subtle hover:bg-surface-muted/80 hover:text-text dark:hover:bg-surface-hover';
  const buttonActive = 'bg-primary text-white hover:bg-primary-hover';

  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm">
      <label className="flex items-center gap-2 text-text-subtle">
        <span className="whitespace-nowrap">Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-primary dark:border-border-strong dark:bg-surface-alt"
        >
          {pageSizeOptions
            .filter((size) => size <= MAX_PAGE_SIZE)
            .map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
        </select>
      </label>

      <span className="whitespace-nowrap text-text-faint">
        {start}–{end} of {total}
      </span>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`${buttonBase} ${buttonIdle}`}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageItems.map((item, index) =>
          item === '...' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-text-faint">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={`${buttonBase} ${item === page ? buttonActive : buttonIdle}`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={`${buttonBase} ${buttonIdle}`}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
