import React, { useState } from 'react';
import { useAPI } from '../contexts/APIContext';
import { SubtitleSearchParams } from '../services/api';
import SearchForm from './SearchForm';
import SearchResults from './SearchResults';
import SubtitlePreview from './SubtitlePreview';
import { SubtitleSearchResult } from './SubtitleCard';

interface SearchProps {
  setAppProcessing: (processing: boolean, task?: string) => void;
}

function Search({ setAppProcessing }: SearchProps) {
  const { searchSubtitles, downloadSubtitle } = useAPI();
  const [searchResults, setSearchResults] = useState<SubtitleSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  const [previewResult, setPreviewResult] = useState<SubtitleSearchResult | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [lastSearchParams, setLastSearchParams] = useState<SubtitleSearchParams | null>(null);

  const RESULTS_PER_PAGE = 20;

  const handleSearch = async (params: SubtitleSearchParams, page: number = 0) => {
    try {
      setIsSearching(true);
      setHasSearched(true);
      setAppProcessing(true, 'Searching subtitles');

      const searchParamsWithPage = {
        ...params,
        page: page + 1, // API uses 1-based pagination
      };

      const response = await searchSubtitles(searchParamsWithPage);

      if (response.success && response.data) {
        setSearchResults(response.data.data || []);
        setCurrentPage(page);

        // Use total_pages from API response, fallback to calculation if not available
        const totalPagesFromApi = response.data.total_pages;
        if (totalPagesFromApi && totalPagesFromApi > 0) {
          setTotalPages(totalPagesFromApi);
        } else {
          // Fallback: calculate from total_count if total_pages not available
          const totalResults = response.data.total_count || response.data.data?.length || 0;
          setTotalPages(Math.ceil(totalResults / RESULTS_PER_PAGE));
        }

        setLastSearchParams(params);
      } else {
        console.error('Search failed:', response.error);
        setSearchResults([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setTotalPages(0);
    } finally {
      setIsSearching(false);
      setAppProcessing(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (lastSearchParams) {
      handleSearch(lastSearchParams, page);
    }
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    try {
      setDownloadingIds(prev => new Set(prev).add(fileId));
      setAppProcessing(true, `Downloading ${fileName}`);

      const response = await downloadSubtitle({ file_id: fileId });

      if (response.success && response.data?.link) {
        // Open download URL in default browser/download manager
        window.open(response.data.link, '_blank');
      } else {
        console.error('Download failed:', response.error);
      }
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
      setAppProcessing(false);
    }
  };

  const handlePreview = (result: SubtitleSearchResult) => {
    setPreviewResult(result);
    setIsPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setIsPreviewOpen(false);
    setPreviewResult(null);
  };

  return (
    <div className="search-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '20px',
      overflow: 'auto',
    }}>
      <div style={{
        marginBottom: '20px',
      }}>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: '28px',
          fontWeight: 'bold',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          🔍 Search Subtitles
        </h1>
        <p style={{
          margin: 0,
          fontSize: '16px',
          color: 'var(--text-secondary)',
        }}>
          Find and download subtitles for movies and TV shows
        </p>
      </div>

      <SearchForm
        onSearch={(params) => handleSearch(params, 0)}
        isLoading={isSearching}
      />

      {hasSearched && (
        <SearchResults
          results={searchResults}
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onDownload={handleDownload}
          onPreview={handlePreview}
          isLoading={isSearching}
          downloadingIds={downloadingIds}
        />
      )}

      <SubtitlePreview
        result={previewResult}
        isOpen={isPreviewOpen}
        onClose={handlePreviewClose}
        onDownload={handleDownload}
      />
    </div>
  );
}

export default Search;