import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:border-neon-blue hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronLeft size={18} />
      </button>

      {getPageNumbers().map((num, i) =>
        num === '...' ? (
          <span key={`ellipsis-${i}`} className="text-gray-600 px-2 select-none">...</span>
        ) : (
          <button
            key={num}
            onClick={() => onPageChange(num)}
            className={`w-9 h-9 rounded-lg text-sm font-bold transition ${
              page === num
                ? 'bg-neon-blue text-black'
                : 'border border-gray-700 text-gray-400 hover:border-neon-blue hover:text-white'
            }`}
          >
            {num}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:border-neon-blue hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
