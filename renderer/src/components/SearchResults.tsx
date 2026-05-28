import React from 'react';
import ReactPaginate from 'react-paginate';
import SubtitleCard from './SubtitleCard';
import { SubtitleSearchResult } from './SubtitleCard';
import WorkflowDiagram from './WorkflowDiagram';

interface SearchResultsProps {
  results: SubtitleSearchResult[];
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onDownload: (fileId: number, fileName: string) => void;
  onPreview: (fileId: number, fileName: string) => void;
  isLoading: boolean;
  downloadingIds: Set<number>;
  previewLoadingId: number | null;
  searchType?: 'subtitles' | 'file';
  hasSearched?: boolean;
  downloadQueue?: SubtitleSearchResult[];
  onToggleQueueItem?: (result: SubtitleSearchResult) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  batchDownloading?: boolean;
}

function SearchResults({
  results,
  totalPages,
  currentPage,
  onPageChange,
  onDownload,
  onPreview,
  isLoading,
  downloadingIds,
  previewLoadingId,
  searchType = 'subtitles',
  hasSearched = false,
  downloadQueue = [],
  onToggleQueueItem,
  onSelectAll,
  onDeselectAll,
  batchDownloading = false,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        fontSize: '18px',
        color: 'var(--text-secondary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}><i className="fas fa-spinner fa-spin"></i></div>
          <div>Searching for subtitles...</div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return <WorkflowDiagram searchType={searchType} hasSearched={hasSearched} />;
  }

  const renderPagination = (marginStyles: React.CSSProperties) => (
    totalPages > 1 && (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        ...marginStyles,
      }}>
        <ReactPaginate
          pageCount={totalPages}
          forcePage={currentPage}
          onPageChange={({ selected }) => onPageChange(selected)}
          pageRangeDisplayed={5}
          marginPagesDisplayed={2}
          previousLabel="◀ Previous"
          nextLabel="Next ▶"
          breakLabel="..."
          containerClassName="pagination-container"
          pageClassName="pagination-page"
          pageLinkClassName="pagination-link"
          previousClassName="pagination-nav"
          nextClassName="pagination-nav"
          previousLinkClassName="pagination-nav-link"
          nextLinkClassName="pagination-nav-link"
          activeClassName="pagination-active"
          disabledClassName="pagination-disabled"
          breakClassName="pagination-break"
          breakLinkClassName="pagination-break-link"
        />
      </div>
    )
  );

  return (
    <div className="search-results">
      {/* Results Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '0 4px',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <i className="fas fa-list"></i> {results.length} subtitle{results.length !== 1 ? 's' : ''} found
          {totalPages > 1 && (
            <span style={{
              fontSize: '14px',
              fontWeight: 'normal',
              color: 'var(--text-secondary)',
            }}>
              (Page {currentPage + 1} of {totalPages})
            </span>
          )}
          {downloadQueue.length > 0 && (
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--primary-color)',
              background: 'var(--bg-tertiary)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}>
              {downloadQueue.length} selected
            </span>
          )}
        </div>
        {results.length > 0 && onToggleQueueItem && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onSelectAll}
              disabled={batchDownloading}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: '500',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: batchDownloading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-color)';
                e.currentTarget.style.color = 'var(--primary-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <i className="fas fa-check-double"></i> Select All
            </button>
            <button
              onClick={onDeselectAll}
              disabled={batchDownloading}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: '500',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: batchDownloading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--danger-color)';
                e.currentTarget.style.color = 'var(--danger-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <i className="fas fa-times"></i> Deselect All
            </button>
          </div>
        )}
      </div>

      {/* Top Pagination */}
      {renderPagination({ marginBottom: '20px' })}

      {/* Subtitle Cards */}
      <div className="subtitle-cards">
        {results.map((result) => (
          <SubtitleCard
            key={result.id}
            result={result}
            onDownload={onDownload}
            onPreview={onPreview}
            isDownloading={result.attributes.files.some(file =>
              downloadingIds.has(file.file_id)
            )}
            isLoadingPreview={result.attributes.files.some(file =>
              file.file_id === previewLoadingId
            )}
            isSelected={downloadQueue.some(q => q.id === result.id)}
            onToggleSelect={onToggleQueueItem}
            batchDownloading={batchDownloading}
          />
        ))}
      </div>

      {/* Bottom Pagination */}
      {renderPagination({ marginTop: '40px' })}

      <style>{`
        .pagination-container {
          display: flex;
          list-style: none;
          padding: 0;
          margin: 0;
          gap: 8px;
          align-items: center;
        }

        .pagination-page,
        .pagination-nav,
        .pagination-break {
          margin: 0;
        }

        .pagination-link,
        .pagination-nav-link {
          display: block;
          padding: 8px 12px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          text-decoration: none;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          min-width: 40px;
          text-align: center;
        }

        .pagination-link:hover,
        .pagination-nav-link:hover {
          background: var(--primary-color);
          color: var(--button-text);
          border-color: var(--primary-color);
        }

        .pagination-active .pagination-link {
          background: var(--primary-color);
          color: var(--button-text);
          border-color: var(--primary-color);
          font-weight: bold;
        }

        .pagination-disabled .pagination-nav-link {
          background: var(--bg-disabled);
          color: var(--text-disabled);
          cursor: not-allowed;
          border-color: var(--border-color);
        }

        .pagination-disabled .pagination-nav-link:hover {
          background: var(--bg-disabled);
          color: var(--text-disabled);
          border-color: var(--border-color);
        }

        .pagination-break-link {
          padding: 8px 4px;
          color: var(--text-secondary);
          font-weight: bold;
        }

        .subtitle-cards {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}

export default SearchResults;