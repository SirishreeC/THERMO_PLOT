// frontend/src/Dash_elements/Search.jsx
// Uses real backend endpoints:
//   GET  /search?q=&token=      — query searchable_items, auto-saves to search_history
//   GET  /search/history?token= — load history from DB
//   DELETE /search/history      — clear history from DB
//   POST /search/index          — rebuild index (called on mount if needed)
// Clicking a result navigates to the correct page.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Search.css';

const API = 'http://127.0.0.1:8000';

const TYPE_META = {
  project: { icon: '📁', color: '#f97316', label: 'Project'  },
  file:    { icon: '📊', color: '#3b82f6', label: 'File'     },
  page:    { icon: '🔗', color: '#10b981', label: 'Page'     },
};

const Search = () => {
  const navigate = useNavigate();
  const token    = localStorage.getItem('token') || '';

  const [searchTerm,    setSearchTerm]    = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory,   setShowHistory]   = useState(true);
  const [searching,     setSearching]     = useState(false);
  const [indexBuilt,    setIndexBuilt]    = useState(false);
  const [indexing,      setIndexing]      = useState(false);
  const [resultCount,   setResultCount]   = useState(null);

  const debounceRef = useRef(null);

  // ── On mount: build index + load history from DB ─────────
  useEffect(() => {
    buildIndex();
    loadHistory();
  }, []);

  const buildIndex = async () => {
    if (!token) return;
    setIndexing(true);
    try {
      await axios.post(`${API}/search/index`, null, { params: { token } });
      setIndexBuilt(true);
    } catch { setIndexBuilt(true); } // fail silently, search still works
    finally  { setIndexing(false); }
  };

  const loadHistory = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/search/history`, { params: { token, limit: 10 } });
      setSearchHistory(res.data?.history ?? []);
    } catch { setSearchHistory([]); }
  };

  // ── Search against the backend ────────────────────────────
  const runSearch = useCallback(async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      setResultCount(null);
      setShowHistory(true);
      return;
    }
    setSearching(true);
    setShowHistory(false);
    try {
      const res = await axios.get(`${API}/search`, {
        params: { q: term.trim(), token }
      });
      const results = res.data?.results ?? [];
      setSearchResults(results);
      setResultCount(res.data?.result_count ?? results.length);
      // Refresh history since backend just saved this search
      loadHistory();
    } catch {
      setSearchResults([]);
      setResultCount(0);
    } finally {
      setSearching(false);
    }
  }, [token]);

  // ── Live search with debounce ─────────────────────────────
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setResultCount(null);
      setShowHistory(true);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(searchTerm), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, runSearch]);

  // ── Form submit ───────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) runSearch(searchTerm);
  };

  // ── Clear history in DB + state ───────────────────────────
  const clearHistory = async () => {
    try {
      await axios.delete(`${API}/search/history`, { params: { token } });
      setSearchHistory([]);
    } catch { setSearchHistory([]); }
  };

  // ── Click history item ────────────────────────────────────
  const handleHistoryClick = (item) => {
    setSearchTerm(item.search_term);
    runSearch(item.search_term);
  };

  // ── Click result → navigate ───────────────────────────────
  const handleResultClick = (result) => {
    const extra = result.extra_data || {};

    if (result.item_type === 'project') {
      navigate('/projects');

    } else if (result.item_type === 'file') {
      navigate('/upload', {
        state: {
          gatewayState: {
            projectId:   extra.project_id   ?? null,
            projectName: extra.project_name ?? '',
            fileId:      result.item_id,
            filename:    result.name,
            savedAs:     extra.saved_as     ?? '',
            filePath:    extra.file_path    ?? '',
          }
        }
      });

    } else if (result.item_type === 'page') {
      navigate(extra.route || '/dashboard');
    }
  };

  // ── Group results by type ─────────────────────────────────
  const grouped = {
    project: searchResults.filter(r => r.item_type === 'project'),
    file:    searchResults.filter(r => r.item_type === 'file'),
    page:    searchResults.filter(r => r.item_type === 'page'),
  };

  const hasResults = searchResults.length > 0;

  return (
    <div className="search-page">

      {/* ── Header ── */}
      <div className="search-header">
        <h1>🔍 Search ThermoPlot</h1>
        <p className="search-header-sub">Search across your projects, files and pages</p>
        {indexing && <p className="search-indexing">⚙️ Building search index…</p>}
      </div>

      {/* ── Search bar ── */}
      <div className="search-container">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search projects, files, pages…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button type="button" className="search-clear-btn"
                onClick={() => { setSearchTerm(''); setSearchResults([]); setResultCount(null); setShowHistory(true); }}>
                ✕
              </button>
            )}
            <button type="submit" className="search-button" disabled={searching}>
              {searching ? <span className="search-spinner" /> : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* ── DB-backed history ── */}
      {showHistory && searchHistory.length > 0 && !searchTerm && (
        <div className="search-history">
          <div className="history-header">
            <h3>🕐 Recent Searches</h3>
            <button className="clear-history-btn" onClick={clearHistory}>Clear All</button>
          </div>
          <div className="history-list">
            {searchHistory.map((h) => (
              <div key={h.id} className="history-item" onClick={() => handleHistoryClick(h)}>
                <div className="history-left">
                  <span className="history-term">🔍 {h.search_term}</span>
                  {h.result_count != null && (
                    <span className="history-count">{h.result_count} result{h.result_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <span className="history-time">
                  {h.searched_at
                    ? new Date(h.searched_at).toLocaleString('en-IN', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Grouped results ── */}
      {hasResults && (
        <div className="search-results-wrapper">
          <div className="search-results-summary">
            Found <strong>{resultCount ?? searchResults.length}</strong> result{(resultCount ?? searchResults.length) !== 1 ? 's' : ''} for "<em>{searchTerm}</em>"
          </div>

          {grouped.project.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">📁 Projects ({grouped.project.length})</div>
              <div className="results-list">
                {grouped.project.map(item => (
                  <ResultCard key={item.id ?? item.name} item={item} onClick={() => handleResultClick(item)} />
                ))}
              </div>
            </div>
          )}

          {grouped.file.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">📊 Uploaded Files ({grouped.file.length})</div>
              <div className="results-list">
                {grouped.file.map(item => (
                  <ResultCard key={item.id ?? item.name} item={item} onClick={() => handleResultClick(item)} />
                ))}
              </div>
            </div>
          )}

          {grouped.page.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">🔗 Pages ({grouped.page.length})</div>
              <div className="results-list">
                {grouped.page.map(item => (
                  <ResultCard key={item.id ?? item.name} item={item} onClick={() => handleResultClick(item)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── No results ── */}
      {searchTerm && !hasResults && !searching && (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>No results for "<em>{searchTerm}</em>"</h3>
          <p>Try a different keyword, or check that the search index is up to date.</p>
          <button className="search-reindex-btn" onClick={buildIndex} disabled={indexing}>
            {indexing ? '⚙️ Rebuilding…' : '🔄 Rebuild Index'}
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!searchTerm && searchHistory.length === 0 && (
        <div className="search-empty-state">
          <div className="search-empty-icon">🌡️</div>
          <h3>Start searching</h3>
          <p>Type a project name, filename, or page to get started.</p>
          <div className="search-suggestions">
            {['project', 'thermal', 'xlsx', 'analysis', 'export'].map(s => (
              <button key={s} className="search-suggestion-chip"
                onClick={() => { setSearchTerm(s); runSearch(s); }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Result card ───────────────────────────────────────────────
const ResultCard = ({ item, onClick }) => {
  const meta  = TYPE_META[item.item_type] || TYPE_META.page;
  const extra = item.extra_data || {};

  const dateLine = item.item_type === 'file'
    ? extra.uploaded_at ? new Date(extra.uploaded_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''
    : '';

  return (
    <div className="search-result-item" onClick={onClick}>
      <div className="result-icon"
        style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}40` }}>
        {meta.icon}
      </div>
      <div className="result-info">
        <div className="result-name">{item.name}</div>
        <div className="result-meta">
          <span className="result-type"
            style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}35` }}>
            {meta.label}
          </span>
          {item.description && <span className="result-desc">{item.description}</span>}
          {extra.project_name && (
            <span className="result-proj">📁 {extra.project_name}</span>
          )}
          {dateLine && <span className="result-date">· {dateLine}</span>}
        </div>
      </div>
      <div className="result-arrow">→</div>
    </div>
  );
};

export default Search;