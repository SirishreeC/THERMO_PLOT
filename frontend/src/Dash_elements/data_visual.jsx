// frontend/src/Dash_elements/data_visual.jsx
// Thermal Analysis page:
//   • Lists all projects as expandable folders
//   • Each project shows its uploaded files
//   • View button → /upload (ThermalVisuals) with file pre-loaded

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './data_visual.css';

const API = 'http://127.0.0.1:8000';

const STATUS_COLORS = {
  active:    { bg: '#064e3b', text: '#34d399', border: '#065f46' },
  completed: { bg: '#1e3a5f', text: '#60a5fa', border: '#1d4ed8' },
  archived:  { bg: '#3b1f2b', text: '#f87171', border: '#7f1d1d' },
};

const DataVisual = () => {
  const navigate = useNavigate();
  const token    = localStorage.getItem('token') || '';

  const [projects,    setProjects]    = useState([]);
  const [openFolders, setOpenFolders] = useState({});  // { [projectId]: bool }
  const [files,       setFiles]       = useState({});  // { [projectId]: [] }
  const [loadingProj, setLoadingProj] = useState(true);
  const [loadingFile, setLoadingFile] = useState({});

  // ── Fetch projects ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/projects`, { params: { token } });
        const list = res.data?.projects ?? res.data ?? [];
        setProjects(Array.isArray(list) ? list : []);
      } catch { setProjects([]); }
      finally  { setLoadingProj(false); }
    })();
  }, [token]);

  // ── Fetch files for a project (lazy) ────────────────────
  const fetchFiles = useCallback(async (projectId) => {
    if (files[projectId]) return;   // already loaded
    setLoadingFile(prev => ({ ...prev, [projectId]: true }));
    try {
      const res = await axios.get(`${API}/upload/list`, { params: { token, project_id: projectId } });
      const all = res.data?.files ?? [];
      setFiles(prev => ({ ...prev, [projectId]: Array.isArray(all) ? all : [] }));
    } catch {
      setFiles(prev => ({ ...prev, [projectId]: [] }));
    } finally {
      setLoadingFile(prev => ({ ...prev, [projectId]: false }));
    }
  }, [token, files]);

  // ── Toggle folder ────────────────────────────────────────
  const toggleFolder = (projId) => {
    const opening = !openFolders[projId];
    setOpenFolders(prev => ({ ...prev, [projId]: opening }));
    if (opening) fetchFiles(projId);
  };

  // ── View file → ThermalVisuals ───────────────────────────
  const handleView = (project, file) => {
    navigate('/upload', {
      state: {
        gatewayState: {
          projectId:   project.id,
          projectName: project.name,
          fileId:      file.id,
          filename:    file.filename,
          filePath:    file.file_path,
          savedAs:     file.saved_as,
        }
      }
    });
  };

  // ── Render ───────────────────────────────────────────────
  if (loadingProj) {
    return (
      <div className="dv-page">
        <div className="dv-loading"><span className="dv-spinner" />Loading projects…</div>
      </div>
    );
  }

  return (
    <div className="dv-page">

      {/* Header */}
      <div className="dv-header">
        <div className="dv-header-left">
          <h1 className="dv-title">Thermal Analysis</h1>
          <p className="dv-sub">Browse your projects and open any file in ThermalVisuals</p>
        </div>
        <div className="dv-tv-badge">
          <span className="dv-tv-label">ThermalVisuals</span>
          <span className="dv-tv-sub">Spatial-Temporal Engine</span>
        </div>
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="dv-empty">
          <span className="dv-empty-icon">📂</span>
          <p>No projects yet. Create one in the Projects section.</p>
          <button className="dv-goto-btn" onClick={() => navigate('/projects')}>
            Go to Projects →
          </button>
        </div>
      ) : (
        <div className="dv-folder-list">
          {projects.map(proj => {
            const sc      = STATUS_COLORS[proj.status] || STATUS_COLORS.active;
            const isOpen  = !!openFolders[proj.id];
            const projFiles = files[proj.id] || [];
            const isLoading = !!loadingFile[proj.id];

            return (
              <div key={proj.id} className={`dv-folder ${isOpen ? 'dv-folder--open' : ''}`}>

                {/* Folder header */}
                <div className="dv-folder-header" onClick={() => toggleFolder(proj.id)}>
                  <span className="dv-folder-chevron">{isOpen ? '▾' : '▸'}</span>
                  <span className="dv-folder-icon">{isOpen ? '📂' : '📁'}</span>
                  <span className="dv-folder-name">{proj.name}</span>
                  <span
                    className="dv-status-badge"
                    style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                  >{proj.status}</span>
                  {proj.description && (
                    <span className="dv-folder-desc">{proj.description}</span>
                  )}
                  <div className="dv-folder-spacer" />
                  <span className="dv-folder-date">
                    {proj.created_at
                      ? new Date(proj.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                      : ''}
                  </span>
                </div>

                {/* Files inside folder */}
                {isOpen && (
                  <div className="dv-folder-body">
                    {isLoading ? (
                      <div className="dv-loading dv-loading--inner">
                        <span className="dv-spinner" />Loading files…
                      </div>
                    ) : projFiles.length === 0 ? (
                      <div className="dv-folder-empty">
                        <span>No files in this project.</span>
                        <button
                          className="dv-upload-btn"
                          onClick={(e) => { e.stopPropagation(); navigate('/upload'); }}
                        >
                          + Upload Files
                        </button>
                      </div>
                    ) : (
                      <div className="dv-file-grid">
                        {projFiles.map(f => (
                          <div key={f.id} className="dv-file-card">
                            <div className="dv-file-card-top">
                              <span className="dv-file-icon">📊</span>
                              <span className="dv-file-status">{f.status}</span>
                            </div>
                            <div className="dv-file-name">{f.filename}</div>
                            <div className="dv-file-meta">
                              {f.rows ? `${f.rows.toLocaleString()} rows` : ''}
                              {f.file_size_mb ? ` · ${f.file_size_mb} MB` : ''}
                            </div>
                            {f.uploaded_at && (
                              <div className="dv-file-date">
                                {new Date(f.uploaded_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                              </div>
                            )}
                            <button
                              className="dv-view-btn"
                              onClick={(e) => { e.stopPropagation(); handleView(proj, f); }}
                            >
                              🔥 Open in ThermalVisuals
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DataVisual;