import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

export default function Pagination({ currentPage = 1, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const page = currentPage;

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
      <Button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        variant="ghost"
        size="icon"
        className="border border-gray-700 text-gray-400 hover:border-neon-blue hover:text-white disabled:opacity-30"
      >
        <ChevronLeft size={18} />
      </Button>

      {getPageNumbers().map((num, i) =>
        num === '...' ? (
          <span key={`ellipsis-${i}`} className="text-gray-600 px-2 select-none">...</span>
        ) : (
          <Button
            key={num}
            onClick={() => onPageChange(num)}
            variant={currentPage === num ? 'primary' : 'ghost'}
            size="icon"
            className={currentPage === num ? 'bg-neon-blue text-black w-9 h-9' : 'border border-gray-700 text-gray-400 hover:border-neon-blue hover:text-white w-9 h-9'}
          >
            {num}
          </Button>
        )
      )}

      <Button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        variant="ghost"
        size="icon"
        className="border border-gray-700 text-gray-400 hover:border-neon-blue hover:text-white disabled:opacity-30"
      >
        <ChevronRight size={18} />
      </Button>
    </div>
  );
}
