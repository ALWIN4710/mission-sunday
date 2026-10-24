import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="btn-ghost btn-sm disabled:opacity-40"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        const p = i + 1;
        return (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`btn-sm btn ${p === page ? 'btn-primary' : 'btn-ghost'}`}
          >
            {p}
          </button>
        );
      })}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        className="btn-ghost btn-sm disabled:opacity-40"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
