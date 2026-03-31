// frontend > src > Dash_elements > UploadGateway.jsx
//
// Sits at the /upload route when accessed from the Dashboard sidebar.
// Shows a sticky breadcrumb with:
//   1. Project dropdown  →  unlocks
//   2. File dropdown     →  "Open in ThermalVisuals" button
//
// Once confirmed it renders the real <Upload /> component inline,
// passing the selected project + file via location state so Upload.jsx
// can pre-load or display context.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Upload from './Upload';          // the real analysis page
import './UploadGateway.css';

const API = 'http://127.0.0.1:8000';

const UploadGateway = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // If we arrived here already carrying a confirmed selection
  // (e.g. from Projects sidebar "View" button) skip the gateway
  const passedState = location.state || {};

  const [projects,      setProjects]      = useState([]);
  const [files,         setFiles]         = useState([]);
  const [selProject,    setSelProject]    = useState('');   // project id string
  const [selFile,       setSelFile]       = useState('');   // file id string
  const [loadingProj,   setLoadingProj]   = useState(true);
  const [loadingFiles,  setLoadingFiles]  = useState(false);
  const [confirmed,     setConfirmed]     = useState(false);
  const [projObj,       setProjObj]       = useState(null);
  const [fileObj,       setFileObj]       = useState(null);

  const token = localStorage.getItem('token') || '';

  /* ── Fetch projects ─────────────────────────────────────── */
  const fetchProjects = useCallback(async () => {
    setLoadingProj(true);
    try {
      const res = await axios.get(`${API}/projects`, {
        params: token ? { token } : {},
      });
      const list = res.data?.projects ?? res.data ?? [];
      setProjects(Array.isArray(list) ? list : []);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProj(false);
    }
  }, [token]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  /* ── Fetch files for selected project ──────────────────── */
  const fetchFiles = useCallback(async (projectId) => {
    setLoadingFiles(true);
    setFiles([]);
    setSelFile('');
    setFileObj(null);
    try {
      // Pass project_id so backend returns only files for that project
      const params = {
        ...(token      ? { token }                  : {}),
        ...(projectId  ? { project_id: projectId }  : {}),
      };
      const res = await axios.get(`${API}/upload/list`, { params });
      const all = res.data?.files ?? res.data ?? [];
      setFiles(Array.isArray(all) ? all : []);
    } catch (e) {
      console.error('fetchFiles error:', e?.response?.status, e?.message);
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [token]);

  /* ── When project changes ───────────────────────────────── */
  const handleProjectChange = (e) => {
    const id = e.target.value;
    setSelProject(id);
    setSelFile('');
    setFileObj(null);
    setConfirmed(false);
    if (id) {
      const proj = projects.find(p => String(p.id) === id);
      setProjObj(proj || null);
      fetchFiles(Number(id));   // ✅ pass numeric project_id to backend
    } else {
      setProjObj(null);
      setFiles([]);
    }
  };

  /* ── When file changes ──────────────────────────────────── */
  const handleFileChange = (e) => {
    const id = e.target.value;
    setSelFile(id);
    setConfirmed(false);
    const f = files.find(x => String(x.id) === id);
    setFileObj(f || null);
  };

  /* ── Confirm → render Upload inline ────────────────────── */
  const handleOpen = () => {
    if (!selProject || !selFile) return;
    setConfirmed(true);
  };

  /* ── Reset back to gateway ──────────────────────────────── */
  const handleReset = () => {
    setConfirmed(false);
  };

  /* ── If confirmed, render actual Upload.jsx inline ─────── */
  if (confirmed && projObj && fileObj) {
    return (
      <>
        {/* Sticky gateway breadcrumb stays visible above Upload */}
        <div className="ugw-sticky-bar">
          <button className="ugw-back-btn" onClick={handleReset}>
            ← Change Selection
          </button>
          <div className="ugw-sticky-crumbs">
            <span className="ugw-crumb">📋 {projObj.name}</span>
            <span className="ugw-crumb-sep">›</span>
            <span className="ugw-crumb ugw-crumb--file">📄 {fileObj.original_filename}</span>
          </div>
        </div>
        {/* Render the real Upload component, passing context via location state */}
        <Upload
          gatewayState={{
            projectId:   projObj.id,
            projectName: projObj.name,
            fileId:      fileObj.id,
            filename:    fileObj.original_filename,
          }}
        />
      </>
    );
  }

  /* ── Gateway UI ─────────────────────────────────────────── */
  const canSelectFile = !!selProject && !loadingFiles;
  const canOpen       = !!selProject && !!selFile;

  return (
    <div className="ugw-page">

      {/* ── Breadcrumb bar ──────────────────────────────────── */}
      <nav className="ugw-breadcrumb">

        {/* Back to Dashboard */}
        <button className="ugw-back-btn" onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>

        <span className="ugw-bc-sep">/</span>
        <span className="ugw-bc-label">Upload Files</span>

        <div className="ugw-bc-spacer" />

        {/* ── Dropdown 1: Project ── */}
        <div className="ugw-dropdown-wrap">
          <label className="ugw-dropdown-label">Project</label>
          <div className="ugw-select-wrap">
            {loadingProj
              ? <div className="ugw-select-loading">Loading…</div>
              : (
                <select
                  className="ugw-select"
                  value={selProject}
                  onChange={handleProjectChange}
                >
                  <option value="">— Select Project —</option>
                  {projects.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )
            }
          </div>
        </div>

        {/* Arrow between dropdowns */}
        <span className={`ugw-arrow ${selProject ? 'ugw-arrow--active' : ''}`}>›</span>

        {/* ── Dropdown 2: File (unlocks after project selected) ── */}
        <div className={`ugw-dropdown-wrap ${!selProject ? 'ugw-dropdown-wrap--disabled' : ''}`}>
          <label className="ugw-dropdown-label">File</label>
          <div className="ugw-select-wrap">
            {loadingFiles ? (
              <div className="ugw-select-loading">Loading…</div>
            ) : (
              <select
                className="ugw-select"
                value={selFile}
                onChange={handleFileChange}
                disabled={!canSelectFile}
              >
                <option value="">
                  {!selProject
                    ? '— Select a project first —'
                    : files.length === 0
                      ? '— No files found —'
                      : '— Select File —'}
                </option>
                {files.map(f => (
                  <option key={f.id} value={String(f.id)}>
                    {f.original_filename}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Open button ── */}
        <button
          className={`ugw-open-btn ${canOpen ? 'ugw-open-btn--ready' : ''}`}
          onClick={handleOpen}
          disabled={!canOpen}
        >
          Open in ThermalVisuals →
        </button>

      </nav>

      {/* ── Main body ────────────────────────────────────────── */}
      <div className="ugw-body">

        {/* Hero / instruction card */}
        <div className="ugw-hero">
          <div className="ugw-hero-icon">🌡️</div>
          <h1 className="ugw-hero-title">ThermalVisuals</h1>
          <p className="ugw-hero-sub">Spatial-Temporal Temperature Analysis</p>

          <div className="ugw-steps">
            <div className={`ugw-step ${selProject ? 'ugw-step--done' : 'ugw-step--active'}`}>
              <span className="ugw-step__num">1</span>
              <div className="ugw-step__text">
                <strong>Select a Project</strong>
                <span>
                  {selProject && projObj
                    ? `✅ ${projObj.name}`
                    : 'Choose from the dropdown above'}
                </span>
              </div>
            </div>

            <div className="ugw-step-connector" />

            <div className={`ugw-step ${selFile ? 'ugw-step--done' : selProject ? 'ugw-step--active' : ''}`}>
              <span className="ugw-step__num">2</span>
              <div className="ugw-step__text">
                <strong>Select a File</strong>
                <span>
                  {selFile && fileObj
                    ? `✅ ${fileObj.original_filename}`
                    : selProject
                      ? 'Now choose a file from the second dropdown'
                      : 'Available after selecting a project'}
                </span>
              </div>
            </div>

            <div className="ugw-step-connector" />

            <div className={`ugw-step ${canOpen ? 'ugw-step--active' : ''}`}>
              <span className="ugw-step__num">3</span>
              <div className="ugw-step__text">
                <strong>Open ThermalVisuals</strong>
                <span>Click the button to begin analysis</span>
              </div>
            </div>
          </div>

          {/* CTA when both selected */}
          {canOpen && (
            <button className="ugw-cta-btn" onClick={handleOpen}>
              Open in ThermalVisuals →
            </button>
          )}
        </div>

        {/* ── Projects summary cards ─────────────────────────── */}
        {!loadingProj && projects.length > 0 && (
          <div className="ugw-proj-grid-section">
            <h3 className="ugw-section-title">Your Projects</h3>
            <div className="ugw-proj-grid">
              {projects.map(p => (
                <div
                  key={p.id}
                  className={`ugw-proj-card ${String(p.id) === selProject ? 'ugw-proj-card--selected' : ''}`}
                  onClick={() => handleProjectChange({ target: { value: String(p.id) } })}
                >
                  <span className="ugw-proj-card__icon">📁</span>
                  <span className="ugw-proj-card__name">{p.name}</span>
                  <span className={`ugw-proj-card__status ugw-proj-card__status--${p.status}`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Files list for selected project ───────────────── */}
        {selProject && (
          <div className="ugw-files-section">
            <h3 className="ugw-section-title">
              Files in <em>{projObj?.name}</em>
            </h3>
            {loadingFiles ? (
              <div className="ugw-files-loading">
                <span className="ugw-spinner" /> Loading files…
              </div>
            ) : files.length === 0 ? (
              <p className="ugw-files-empty">
                No files found. Upload one via the Projects workspace.
              </p>
            ) : (
              <div className="ugw-files-list">
                {files.map(f => (
                  <div
                    key={f.id}
                    className={`ugw-file-row ${String(f.id) === selFile ? 'ugw-file-row--selected' : ''}`}
                    onClick={() => handleFileChange({ target: { value: String(f.id) } })}
                  >
                    <span className="ugw-file-row__icon">📄</span>
                    <div className="ugw-file-row__info">
                      <span className="ugw-file-row__name">{f.original_filename}</span>
                      <span className="ugw-file-row__meta">
                        {f.rows_count ? `${f.rows_count.toLocaleString()} rows` : ''}
                        {f.file_size_mb ? ` · ${f.file_size_mb} MB` : ''}
                        {f.uploaded_at
                          ? ` · ${new Date(f.uploaded_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
                          : ''}
                      </span>
                    </div>
                    {String(f.id) === selFile && (
                      <span className="ugw-file-row__check">✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>{/* /ugw-body */}
    </div>
  );
};

export default UploadGateway;