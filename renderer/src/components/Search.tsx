import React, { useState } from 'react';
import { useAPI } from '../contexts/APIContext';
import { SubtitleSearchParams, FeatureSearchParams, Feature } from '../services/api';
import SearchForm from './SearchForm';
import SearchResults from './SearchResults';
import FeatureResults from './FeatureResults';
import { SubtitleSearchResult } from './SubtitleCard';

interface SearchProps {
  setAppProcessing: (processing: boolean, task?: string) => void;
}

type SearchTab = 'subtitles' | 'features';

function Search({ setAppProcessing }: SearchProps) {
  const { searchSubtitles, downloadSubtitle, searchForFeatures } = useAPI();

  // Tab state
  const [activeTab, setActiveTab] = useState<SearchTab>('subtitles');

  // Subtitle search state
  const [searchResults, setSearchResults] = useState<SubtitleSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  const [lastSearchParams, setLastSearchParams] = useState<SubtitleSearchParams | null>(null);

  // Feature search state
  const [featureResults, setFeatureResults] = useState<Feature[]>([]);
  const [isFeatureSearching, setIsFeatureSearching] = useState(false);
  const [hasFeatureSearched, setHasFeatureSearched] = useState(false);
  const [featureCurrentPage, setFeatureCurrentPage] = useState(0);
  const [featureTotalPages, setFeatureTotalPages] = useState(0);
  const [lastFeatureSearchParams, setLastFeatureSearchParams] = useState<FeatureSearchParams | null>(null);

  // Form initial values state
  const [formInitialValues, setFormInitialValues] = useState<any>(undefined);

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

  const handleFeatureSearch = async (params: FeatureSearchParams, page: number = 0) => {
    try {
      setIsFeatureSearching(true);
      setHasFeatureSearched(true);
      setAppProcessing(true, 'Searching movies and TV shows');

      // Note: Feature search doesn't use page-based pagination in the same way
      // We'll implement this based on actual API behavior
      const response = await searchForFeatures(params);

      if (response.success && response.data) {
        setFeatureResults(response.data.data || []);
        setFeatureCurrentPage(page);

        // Handle pagination similar to subtitle search
        const totalPagesFromApi = response.data.total_pages;
        if (totalPagesFromApi && totalPagesFromApi > 0) {
          setFeatureTotalPages(totalPagesFromApi);
        } else {
          const totalResults = response.data.total_count || response.data.data?.length || 0;
          setFeatureTotalPages(Math.ceil(totalResults / RESULTS_PER_PAGE));
        }

        setLastFeatureSearchParams(params);
      } else {
        console.error('Feature search failed:', response.error);
        setFeatureResults([]);
        setFeatureTotalPages(0);
      }
    } catch (error) {
      console.error('Feature search error:', error);
      setFeatureResults([]);
      setFeatureTotalPages(0);
    } finally {
      setIsFeatureSearching(false);
      setAppProcessing(false);
    }
  };

  const handleFeaturePageChange = (page: number) => {
    if (lastFeatureSearchParams) {
      handleFeatureSearch(lastFeatureSearchParams, page);
    }
  };

  const handleFindSubtitles = (feature: Feature) => {
    // Switch to subtitle tab
    setActiveTab('subtitles');

    // Pre-fill form with IMDb ID and open advanced options
    if (feature.attributes.imdb_id) {
      setFormInitialValues({
        imdb_id: feature.attributes.imdb_id.toString(),
        showAdvanced: true,
      });
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


  return (
    <div className="search-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '20px',
      overflow: 'auto',
    }}>
      {/* Header */}
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
          <i className="fas fa-search"></i> Search {activeTab === 'subtitles' ? 'Subtitles' : 'Movies & TV Shows'}
        </h1>
        <p style={{
          margin: 0,
          fontSize: '16px',
          color: 'var(--text-secondary)',
        }}>
          {activeTab === 'subtitles' ?
            'Find and download subtitles for movies and TV shows' :
            'Discover movies and TV shows, then find their subtitles'
          }
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'subtitles' ? 'active' : ''}`}
            onClick={() => setActiveTab('subtitles')}
          >
            <i className="fas fa-film"></i> Search Subtitles
          </button>
          <button
            className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            <i className="fas fa-video"></i> Search Movies
          </button>
        </div>
      </div>

      {/* Search Form */}
      <SearchForm
        activeTab={activeTab}
        onSearch={activeTab === 'subtitles' ?
          (params) => handleSearch(params as SubtitleSearchParams, 0) :
          (params) => handleFeatureSearch(params as FeatureSearchParams, 0)
        }
        isLoading={activeTab === 'subtitles' ? isSearching : isFeatureSearching}
        initialValues={formInitialValues}
      />

      {/* Results */}
      {activeTab === 'subtitles' && hasSearched && (
        <SearchResults
          results={searchResults}
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onDownload={handleDownload}
          isLoading={isSearching}
          downloadingIds={downloadingIds}
        />
      )}

      {activeTab === 'features' && hasFeatureSearched && (
        <FeatureResults
          results={featureResults}
          totalPages={featureTotalPages}
          currentPage={featureCurrentPage}
          onPageChange={handleFeaturePageChange}
          onFindSubtitles={handleFindSubtitles}
          isLoading={isFeatureSearching}
        />
      )}

      <style>{`
        .tab-navigation {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }

        .tab-button {
          flex: 1;
          padding: 12px 20px;
          background: transparent;
          color: var(--text-secondary);
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .tab-button:hover {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .tab-button.active {
          background: var(--primary-color);
          color: var(--button-text);
          font-weight: 600;
        }

        @media (max-width: 600px) {
          .tab-button {
            padding: 10px 16px;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}

export default Search;