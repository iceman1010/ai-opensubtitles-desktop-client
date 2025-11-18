import React from 'react';
import ReactPaginate from 'react-paginate';
import SubtitleCard from './SubtitleCard';
import { SubtitleSearchResult } from './SubtitleCard';

interface SearchResultsProps {
  results: SubtitleSearchResult[];
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onDownload: (fileId: number, fileName: string) => void;
  isLoading: boolean;
  downloadingIds: Set<number>;
}

function SearchResults({
  results,
  totalPages,
  currentPage,
  onPageChange,
  onDownload,
  isLoading,
  downloadingIds
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
          <div style={{ fontSize: '48px', marginBottom: '20px' }}><i className="fas fa-folder-open"></i></div>
          <div style={{ marginBottom: '8px' }}>No subtitles found</div>
          <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
            Try adjusting your search terms or filters
          </div>
        </div>
      </div>
    );
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
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'var(--text-primary)',
        }}>
          <i className="fas fa-list"></i> {results.length} subtitle{results.length !== 1 ? 's' : ''} found
          {totalPages > 1 && (
            <span style={{
              fontSize: '14px',
              fontWeight: 'normal',
              color: 'var(--text-secondary)',
              marginLeft: '8px',
            }}>
              (Page {currentPage + 1} of {totalPages})
            </span>
          )}
        </div>
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
            isDownloading={result.attributes.files.some(file =>
              downloadingIds.has(file.file_id)
            )}
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