// frontend/src/Dash_elements/Projects.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Projects.css';

const API = 'http://127.0.0.1:8000';

const STATUS_COLORS = {
  active:    { bg: '#064e3b', text: '#34d399', border: '#065f46' },
  completed: { bg: '#1e3a5f', text: '#60a5fa', border: '#1d4ed8' },
  archived:  { bg: '#3b1f2b', text: '#f87171', border: '#7f1d1d' },
};

const Projects = () => {
  const navigate     = useNavigate();
  const token        = localStorage.getItem('token') || '';
  const fileInputRef = useRef(null);
  const replaceRef   = useRef(null);

  const [projects,     setProjects]     = useState([]);
  const [selProject,   setSelProject]   = useState(null);
  const [files,        setFiles]        = useState([]);
  const [loadingProj,  setLoadingProj]  = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newDesc,      setNewDesc]      = useState('');
  const [newStatus,    setNewStatus]    = useState('active');
  const [deleteConf,   setDeleteConf]   = useState(null);
  const [replaceId,    setReplaceId]    = useState(null);

  // ── Fetch projects ───────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoadingProj(true);
    try {
      const res  = await axios.get(`${API}/projects`, { params: { token } });
      const list = res.data?.projects ?? res.data ?? [];
      setProjects(Array.isArray(list) ? list : []);
    } catch { setProjects([]); }
    finally  { setLoadingProj(false); }
  }, [token]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ── Fetch files — STRICT: only files with this project_id ─
  const fetchFiles = useCallback(async (projectId) => {
    setLoadingFiles(true);
    setFiles([]);
    try {
      const res = await axios.get(`${API}/upload/list`, {
        params: { token, project_id: projectId },
      });
      const all = res.data?.files ?? [];
      setFiles(Array.isArray(all) ? all : []);
    } catch { setFiles([]); }
    finally  { setLoadingFiles(false); }
  }, [token]);

  const handleSelectProject = (proj) => {
    setSelProject(proj);
    fetchFiles(proj.id);
  };

  // ── Create project ───────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await axios.post(`${API}/projects`,
        { name: newName.trim(), description: newDesc.trim(), status: newStatus },
        { params: { token } }
      );
      setNewName(''); setNewDesc(''); setNewStatus('active'); setShowForm(false);
      fetchProjects();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to create project');
    } finally { setCreating(false); }
  };

  // ── Upload file directly into this project ───────────────
  // Passes project_id so the file is linked from the start
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selProject) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      await axios.post(`${API}/upload/`, fd, {
        params:  { token, project_id: selProject.id },
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Refresh this project's file list
      fetchFiles(selProject.id);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Replace file ─────────────────────────────────────────
  const handleReplaceFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !replaceId) return;
    try {
      await axios.delete(`${API}/upload/${replaceId}`, { params: { token } });
      const fd = new FormData();
      fd.append('files', file);
      await axios.post(`${API}/upload/`, fd, {
        params:  { token, project_id: selProject?.id },
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchFiles(selProject.id);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Replace failed');
    } finally {
      setReplaceId(null);
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  // ── Delete file ──────────────────────────────────────────
  const handleDeleteFile = async (fileId) => {
    try {
      await axios.delete(`${API}/upload/${fileId}`, { params: { token } });
      setFiles(prev => prev.filter(f => f.id !== fileId));
      setDeleteConf(null);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Delete failed');
    }
  };

  // ── View → ThermalVisuals (auto-analyzes on arrival) ─────
  const handleView = (file) => {
    navigate('/upload', {
      state: {
        gatewayState: {
          projectId:   selProject.id,
          projectName: selProject.name,
          fileId:      file.id,
          filename:    file.filename,
          savedAs:     file.saved_as,    // ✅ needed for auto-analyze
          filePath:    file.file_path,
        }
      }
    });
  };

  // ── Delete project ───────────────────────────────────────
  const handleDeleteProject = async (projId) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await axios.delete(`${API}/projects/${projId}`, { params: { token } });
      setSelProject(null); setFiles([]);
      fetchProjects();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Delete failed');
    }
  };

  if (loadingProj) return (
    <div className="proj-page">
      <div className="proj-loading"><span className="proj-spinner" />Loading projects…</div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // PROJECT LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (!selProject) return (
    <div className="proj-page">
      <input type="file" ref={fileInputRef} style={{ display:'none' }}
        accept=".xlsx,.xls,.csv" onChange={handleUploadFile} />
      <input type="file" ref={replaceRef}   style={{ display:'none' }}
        accept=".xlsx,.xls,.csv" onChange={handleReplaceFile} />

      <nav className="proj-breadcrumb">
        <button className="proj-back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <span className="proj-bc-sep">/</span>
        <span className="proj-bc-label">Projects</span>
        <div className="proj-bc-spacer" />
        <button className="proj-new-btn" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New Project'}
        </button>
      </nav>

      {showForm && (
        <form className="proj-create-form" onSubmit={handleCreate}>
          <h3 className="proj-form-title">Create New Project</h3>
          <div className="proj-form-row">
            <input className="proj-input" placeholder="Project name *"
              value={newName} onChange={e => setNewName(e.target.value)} required />
            <select className="proj-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <textarea className="proj-textarea" placeholder="Description (optional)"
            value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
          <button className="proj-submit-btn" type="submit" disabled={creating}>
            {creating ? 'Creating…' : '✓ Create Project'}
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="proj-empty">
          <span className="proj-empty-icon">📂</span>
          <p>No projects yet. Create your first project above.</p>
        </div>
      ) : (
        <div className="proj-grid">
          {projects.map(p => {
            const sc = STATUS_COLORS[p.status] || STATUS_COLORS.active;
            return (
              <div key={p.id} className="proj-card" onClick={() => handleSelectProject(p)}>
                <div className="proj-card-top">
                  <span className="proj-card-icon">📁</span>
                  <span className="proj-status-badge"
                    style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                    {p.status}
                  </span>
                </div>
                <h3 className="proj-card-name">{p.name}</h3>
                {p.description && <p className="proj-card-desc">{p.description}</p>}
                <div className="proj-card-meta">
                  {p.created_at && new Date(p.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </div>
                <div className="proj-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="proj-action-btn proj-action-view"
                    onClick={() => handleSelectProject(p)}>View Files</button>
                  <button className="proj-action-btn proj-action-delete"
                    onClick={() => handleDeleteProject(p.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // PROJECT DETAIL VIEW
  // ══════════════════════════════════════════════════════════
  const sc = STATUS_COLORS[selProject.status] || STATUS_COLORS.active;
  return (
    <div className="proj-page">
      <input type="file" ref={fileInputRef} style={{ display:'none' }}
        accept=".xlsx,.xls,.csv" onChange={handleUploadFile} />
      <input type="file" ref={replaceRef}   style={{ display:'none' }}
        accept=".xlsx,.xls,.csv" onChange={handleReplaceFile} />

      <nav className="proj-breadcrumb">
        <button className="proj-back-btn" onClick={() => { setSelProject(null); setFiles([]); }}>
          ← Back to Projects
        </button>
        <span className="proj-bc-sep">/</span>
        <span className="proj-bc-label">{selProject.name}</span>
        <span className="proj-status-badge"
          style={{ background: sc.bg, color: sc.text, border:`1px solid ${sc.border}`, marginLeft:'0.6rem' }}>
          {selProject.status}
        </span>
        {/* ↩ New Upload — uploads directly into this project */}
        {!loadingFiles && (
          <button className="proj-reupload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}>
            {uploading ? '⏳ Uploading…' : '↩ New Upload'}
          </button>
        )}
        <div className="proj-bc-spacer" />
        <button className="proj-new-btn" onClick={() => navigate('/upload')}>
          + Upload Files
        </button>
      </nav>

      <div className="proj-detail-layout">

        {/* LEFT: Files list */}
        <div className="proj-files-panel">
          <h2 className="proj-panel-title">📄 Uploaded Files</h2>

          {loadingFiles ? (
            <div className="proj-loading"><span className="proj-spinner" />Loading files…</div>
          ) : files.length === 0 ? (
            <div className="proj-empty">
              <span className="proj-empty-icon">📭</span>
              <p>No files yet. Click "↩ New Upload" to add a file to this project.</p>
              <button className="proj-new-btn" onClick={() => fileInputRef.current?.click()}>
                + Upload File
              </button>
            </div>
          ) : (
            <div className="proj-files-list">
              {files.map(f => (
                <div key={f.id} className="proj-file-row">
                  <span className="proj-file-icon">📊</span>
                  <div className="proj-file-info">
                    <span className="proj-file-name">{f.filename}</span>
                    <span className="proj-file-meta">
                      {f.rows         ? `${f.rows.toLocaleString()} rows` : ''}
                      {f.file_size_mb ? ` · ${f.file_size_mb} MB` : ''}
                      {f.uploaded_at  ? ` · ${new Date(f.uploaded_at).toLocaleDateString('en-IN',{dateStyle:'medium'})}` : ''}
                    </span>
                  </div>
                  <div className="proj-file-actions">
                    <button className="pfa pfa-view"    onClick={() => handleView(f)}>View</button>
                    <button className="pfa pfa-replace" onClick={() => { setReplaceId(f.id); replaceRef.current?.click(); }}>Replace</button>
                    {deleteConf === f.id ? (
                      <>
                        <button className="pfa pfa-confirm" onClick={() => handleDeleteFile(f.id)}>✓ Yes</button>
                        <button className="pfa pfa-cancel"  onClick={() => setDeleteConf(null)}>✕</button>
                      </>
                    ) : (
                      <button className="pfa pfa-delete" onClick={() => setDeleteConf(f.id)}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: ThermalVisuals info panel */}
        <div className="proj-tv-panel">
          <div className="proj-tv-header">
            <h1 className="proj-tv-title">ThermalVisuals</h1>
            <p className="proj-tv-sub">Spatial-Temporal Temperature Analysis</p>
            <div className="proj-tv-divider" />
            <p className="proj-tv-desc">
              Select any file on the left to open it in ThermalVisuals — full statistics,
              heatmaps, time-series, spatial profiles, anomaly detection and more.
            </p>
            <div className="proj-tv-stats">
              <div className="proj-tv-stat">
                <span className="proj-tv-stat-val">{files.length}</span>
                <span className="proj-tv-stat-lbl">Files</span>
              </div>
              <div className="proj-tv-stat">
                <span className="proj-tv-stat-val">
                  {files.reduce((s,f) => s+(f.rows||0), 0).toLocaleString()}
                </span>
                <span className="proj-tv-stat-lbl">Total Rows</span>
              </div>
              <div className="proj-tv-stat">
                <span className="proj-tv-stat-val">
                  {files.reduce((s,f) => s+(parseFloat(f.file_size_mb)||0), 0).toFixed(1)} MB
                </span>
                <span className="proj-tv-stat-lbl">Total Size</span>
              </div>
            </div>
            {files.length > 0 && (
              <button className="proj-tv-open-btn" onClick={() => handleView(files[0])}>
                Open Latest in ThermalVisuals →
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Projects;