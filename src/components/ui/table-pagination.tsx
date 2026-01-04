import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ 
  currentPage, 
  totalItems, 
  pageSize, 
  onPageChange 
}: TablePaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <p className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

interface LoadMoreProps {
  currentCount: number;
  totalCount: number;
  onLoadMore: () => void;
  isLoading?: boolean;
}

export function LoadMoreButton({ 
  currentCount, 
  totalCount, 
  onLoadMore, 
  isLoading = false 
}: LoadMoreProps) {
  if (currentCount >= totalCount) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {currentCount} of {totalCount}
      </p>
      <Button 
        variant="outline" 
        onClick={onLoadMore}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Load More'}
      </Button>
    </div>
  );
}
