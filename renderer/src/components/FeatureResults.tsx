import React from 'react';
import ReactPaginate from 'react-paginate';
import FeatureCard from './FeatureCard';
import { Feature } from '../services/api';

interface FeatureResultsProps {
  results: Feature[];
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onFindSubtitles?: (feature: Feature) => void;
  isLoading: boolean;
}

function FeatureResults({
  results,
  totalPages,
  currentPage,
  onPageChange,
  onFindSubtitles,
  isLoading
}: FeatureResultsProps) {
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
          <div>Searching for movies and TV shows...</div>
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
          <div style={{ fontSize: '48px', marginBottom: '20px' }}><i className="fas fa-film"></i></div>
          <div style={{ marginBottom: '8px' }}>No movies or TV shows found</div>
          <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
            Try adjusting your search terms
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
    <div className="feature-results">
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
          <i className="fas fa-film"></i> {results.length} result{results.length !== 1 ? 's' : ''} found
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

      {/* Feature Cards Grid */}
      <div className="feature-grid">
        {results.map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            onFindSubtitles={onFindSubtitles}
          />
        ))}
      </div>

      {/* Bottom Pagination */}
      {renderPagination({ marginTop: '40px' })}

      <style>{`
        /* Pagination styles - reuse from SearchResults */
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

        /* Responsive Grid Layout */
        .feature-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        }

        /* Responsive breakpoints */
        @media (max-width: 600px) {
          .feature-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
        }

        @media (min-width: 601px) and (max-width: 900px) {
          .feature-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
        }

        @media (min-width: 901px) and (max-width: 1200px) {
          .feature-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 18px;
          }
        }

        @media (min-width: 1201px) {
          .feature-grid {
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
          }
        }

        /* Ensure cards maintain aspect ratio */
        .feature-grid > * {
          min-height: 320px;
        }

        @media (max-width: 600px) {
          .feature-grid > * {
            min-height: 280px;
          }
        }
      `}</style>
    </div>
  );
}

export default FeatureResults;