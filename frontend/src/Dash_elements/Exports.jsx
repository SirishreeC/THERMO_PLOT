// frontend/src/Dash_elements/Exports.jsx
// Full Doc Exports page:
//   • Breadcrumb: ← Dashboard / Doc Exports
//   • Project dropdown → File dropdown → auto-fetches & analyzes
//   • Document preview (PDF/Word layout mockup) before exporting
//   • Export All card with PDF / Excel / CSV / Word buttons
//   • PanelExportButton (unchanged named export for Upload.jsx)

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Exports.css';

const API = 'http://127.0.0.1:8000';

// ─────────────────────────────────────────────────────────────
// PanelExportButton — unchanged, used by Upload.jsx
// ─────────────────────────────────────────────────────────────
const EXPORT_FORMATS = [
  { key: 'pdf',   label: 'PDF Report',      icon: '📄', ext: 'pdf',  cls: 'peb-item--pdf'   },
  { key: 'excel', label: 'Excel Workbook',  icon: '📊', ext: 'xlsx', cls: 'peb-item--excel' },
  { key: 'csv',   label: 'CSV Data',        icon: '📋', ext: 'csv',  cls: 'peb-item--csv'   },
  { key: 'word',  label: 'Word Document',   icon: '📝', ext: 'docx', cls: 'peb-item--word'  },
];

export const PanelExportButton = ({ panelKey, panelLabel, data }) => {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(null);
  const [toast,   setToast]   = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleDownload = async (fmt) => {
    setLoading(fmt.key);
    setOpen(false);
    try {
      const res = await fetch(`${API}/export/${fmt.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: panelKey, data }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `ThermoPlot_${panelLabel}.${fmt.ext}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setToast({ ok: true, msg: `${fmt.label} downloaded!` });
    } catch {
      window.location.href = `${API}/export/${fmt.key}?section=${panelKey}`;
      setToast({ ok: true, msg: 'Download started!' });
    } finally { setLoading(null); }
  };

  return (
    <div className="peb-wrap" ref={wrapRef}>
      <button className={`peb-trigger ${open ? 'peb-trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}>
        {loading ? <><span className="export-spinner" /> Generating…</> : <>📤 Export {panelLabel} ▾</>}
      </button>
      {open && (
        <div className="peb-dropdown">
          {EXPORT_FORMATS.map(fmt => (
            <button key={fmt.key} className={`peb-item ${fmt.cls}`}
              onClick={() => handleDownload(fmt)}
              disabled={!!loading}>
              <div className="peb-item__left">
                <span className="peb-item__icon">{fmt.icon}</span>
                <span className="peb-item__label">{fmt.label}</span>
              </div>
              <span className="peb-dropdown__arrow">.{fmt.ext}</span>
            </button>
          ))}
        </div>
      )}
      {toast && (
        <div className={`peb-toast ${toast.ok ? 'peb-toast--ok' : 'peb-toast--err'}`}>
          {toast.ok ? '✅' : '❌'} {toast.msg}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Document Preview — shows a visual mockup of what PDF/Word looks like
// ─────────────────────────────────────────────────────────────
const DocumentPreview = ({ data, projectName, fileName, previewType, setPreviewType }) => {
  if (!data) return null;

  const meta   = data.metadata   || {};
  const stats  = data.statistics || {};
  const anom   = data.anomalies  || {};
  const positions = meta.position_names || Object.keys(stats).slice(0, 6);
  const tr     = meta.time_range || [0, 0];

  const isPDF  = previewType === 'pdf';

  return (
    <div className="exp-preview-section">
      <div className="exp-preview-header">
        <h3 className="exp-preview-title">📋 Document Preview</h3>
        <div className="exp-preview-tabs">
          <button className={`exp-ptab ${isPDF ? 'exp-ptab--active' : ''}`}
            onClick={() => setPreviewType('pdf')}>📄 PDF / Report</button>
          <button className={`exp-ptab ${!isPDF ? 'exp-ptab--active' : ''}`}
            onClick={() => setPreviewType('word')}>📝 Word Doc</button>
        </div>
      </div>

      {/* Simulated document page */}
      <div className={`exp-doc-page ${isPDF ? 'exp-doc-page--pdf' : 'exp-doc-page--word'}`}>

        {/* Cover / header */}
        <div className="exp-doc-cover">
          <div className="exp-doc-logo">🌡️ ThermoPlot</div>
          <div className="exp-doc-cover-title">Thermal Analysis Report</div>
          <div className="exp-doc-cover-sub">
            {isPDF ? 'Integrated Thermal Research Platform' : 'Spatial-Temporal Temperature Analysis'}
          </div>
          <div className="exp-doc-cover-meta">
            <span>Project: <strong>{projectName}</strong></span>
            <span>File: <strong>{fileName}</strong></span>
            <span>Generated: <strong>{new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</strong></span>
          </div>
          <div className="exp-doc-divider" />
        </div>

        {/* Dataset overview table */}
        <div className="exp-doc-section">
          <div className="exp-doc-section-title">Dataset Overview</div>
          <table className="exp-doc-table">
            <tbody>
              <tr><td>Total Time Points</td><td><strong>{meta.rows ?? '—'}</strong></td></tr>
              <tr><td>Sensor Positions</td><td><strong>{meta.position_columns ?? '—'}</strong></td></tr>
              <tr><td>Time Range</td><td><strong>{tr[0]?.toFixed(2)}s – {tr[1]?.toFixed(2)}s</strong></td></tr>
              <tr><td>Global Max Temp</td><td><strong>{meta.global_max ?? '—'}°C</strong></td></tr>
              <tr><td>Global Min Temp</td><td><strong>{meta.global_min ?? '—'}°C</strong></td></tr>
              <tr><td>Completeness</td><td><strong>{meta.completeness ?? 100}%</strong></td></tr>
            </tbody>
          </table>
        </div>

        {/* Statistics preview */}
        {Object.keys(stats).length > 0 && (
          <div className="exp-doc-section">
            <div className="exp-doc-section-title">Statistical Summary</div>
            <table className="exp-doc-table exp-doc-table--stats">
              <thead>
                <tr>
                  <th>Position</th><th>Mean (°C)</th><th>Std Dev</th><th>Min</th><th>Max</th>
                </tr>
              </thead>
              <tbody>
                {positions.slice(0, 5).map(pos => (
                  <tr key={pos}>
                    <td>{pos}</td>
                    <td>{stats[pos]?.mean?.toFixed(2) ?? '—'}</td>
                    <td>{stats[pos]?.std?.toFixed(3)  ?? '—'}</td>
                    <td>{stats[pos]?.min?.toFixed(2)  ?? '—'}</td>
                    <td>{stats[pos]?.max?.toFixed(2)  ?? '—'}</td>
                  </tr>
                ))}
                {positions.length > 5 && (
                  <tr className="exp-doc-table-more">
                    <td colSpan={5}>+ {positions.length - 5} more positions…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Chart placeholders */}
        <div className="exp-doc-section">
          <div className="exp-doc-section-title">Charts Included</div>
          <div className="exp-doc-charts-grid">
            {['Temperature vs Time', 'Thermal Heatmap', 'Statistical Summary', 'Spatial Profile', 'Correlation Matrix', 'Anomaly Detection'].map(name => (
              <div key={name} className="exp-doc-chart-stub">
                <div className="exp-doc-chart-icon">📊</div>
                <div className="exp-doc-chart-name">{name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomaly summary if present */}
        {Object.keys(anom).length > 0 && (
          <div className="exp-doc-section">
            <div className="exp-doc-section-title" style={{ color: '#ef4444' }}>⚠️ Anomaly Detection</div>
            <table className="exp-doc-table">
              <thead>
                <tr><th>Position</th><th>Outlier Count</th><th>Percentage</th></tr>
              </thead>
              <tbody>
                {Object.entries(anom).slice(0, 4).map(([pos, a]) => (
                  <tr key={pos}>
                    <td>{pos}</td>
                    <td>{a.count ?? a.outliers?.length ?? 0}</td>
                    <td>{a.percentage ?? '—'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="exp-doc-footer">
          Generated by ThermoPlot · Integrated Thermal Research Platform
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main ExportDashboard
// ─────────────────────────────────────────────────────────────
function ExportDashboard() {
  const navigate  = useNavigate();
  const token     = localStorage.getItem('token') || '';

  // Dropdowns
  const [projects,     setProjects]     = useState([]);
  const [files,        setFiles]        = useState([]);
  const [selProject,   setSelProject]   = useState('');
  const [selFile,      setSelFile]      = useState('');
  const [projObj,      setProjObj]      = useState(null);
  const [fileObj,      setFileObj]      = useState(null);
  const [loadingProj,  setLoadingProj]  = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Analysis data + export state
  const [data,        setData]        = useState(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [previewType, setPreviewType] = useState('pdf');
  const [exporting,   setExporting]   = useState(null);
  const [toast,       setToast]       = useState(null);

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch projects
  useEffect(() => {
    (async () => {
      try {
        const res  = await axios.get(`${API}/projects`, { params: { token } });
        const list = res.data?.projects ?? res.data ?? [];
        setProjects(Array.isArray(list) ? list : []);
      } catch { setProjects([]); }
      finally  { setLoadingProj(false); }
    })();
  }, [token]);

  // Fetch files for selected project
  const fetchFiles = useCallback(async (projectId) => {
    setLoadingFiles(true);
    setFiles([]); setSelFile(''); setFileObj(null); setData(null);
    try {
      const res = await axios.get(`${API}/upload/list`, {
        params: { token, project_id: projectId },
      });
      const all = res.data?.files ?? [];
      setFiles(Array.isArray(all) ? all : []);
    } catch { setFiles([]); }
    finally  { setLoadingFiles(false); }
  }, [token]);

  const handleProjectChange = (e) => {
    const id = e.target.value;
    setSelProject(id);
    setSelFile(''); setFileObj(null); setData(null);
    if (id) {
      setProjObj(projects.find(p => String(p.id) === id) || null);
      fetchFiles(Number(id));
    } else {
      setProjObj(null); setFiles([]);
    }
  };

  const handleFileChange = (e) => {
    const id = e.target.value;
    setSelFile(id);
    setData(null);
    const f = files.find(x => String(x.id) === id);
    setFileObj(f || null);
  };

  // Auto-analyze when file selected
  const analyzeFile = useCallback(async (savedAs, filename) => {
    if (!savedAs) return;
    setAnalyzing(true);
    setData(null);
    try {
      const fileRes = await fetch(`${API}/static/${savedAs}`);
      if (!fileRes.ok) throw new Error(`Cannot fetch file: ${fileRes.status}`);
      const blob = await fileRes.blob();
      const file = new File([blob], filename || savedAs, { type: blob.type });
      const fd   = new FormData();
      fd.append('file', file);
      const res  = await axios.post(`${API}/thermal/analyze`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setData(res.data);
    } catch (err) {
      setToast({ ok: false, msg: 'Could not analyse file: ' + (err?.response?.data?.detail || err.message) });
    } finally { setAnalyzing(false); }
  }, []);

  // Trigger analysis when file obj is set
  useEffect(() => {
    if (fileObj?.saved_as) {
      analyzeFile(fileObj.saved_as, fileObj.filename);
    }
  }, [fileObj?.saved_as]);

  // Export handler
  const handleExport = async (fmt) => {
    if (!data) return;
    const ext = fmt === 'word' ? 'docx' : fmt === 'excel' ? 'xlsx' : fmt;
    setExporting(fmt);
    try {
      const res = await axios.post(`${API}/export/${fmt}`,
        { data, section: 'all', token,
          project_id:     projObj?.id    ?? null,
          file_upload_id: fileObj?.id    ?? null },
        { responseType: 'blob' }
      );
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ThermoPlot_${projObj?.name || 'Export'}_${fileObj?.filename || 'report'}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ ok: true, msg: `${fmt.toUpperCase()} exported successfully!` });
    } catch (err) {
      setToast({ ok: false, msg: 'Export failed: ' + (err?.response?.data?.detail || err.message) });
    } finally { setExporting(null); }
  };

  const EXPORT_BTNS = [
    { fmt: 'pdf',   label: 'Download PDF',         icon: '📄', cls: 'pdf-btn'   },
    { fmt: 'excel', label: 'Download Excel',        icon: '📊', cls: 'excel-btn' },
    { fmt: 'csv',   label: 'Download CSV',          icon: '📋', cls: 'csv-btn'   },
    { fmt: 'word',  label: 'Download Word (.docx)', icon: '📝', cls: 'word-btn'  },
  ];

  const canExport    = !!data && !analyzing;
  const showPreview  = !!data && !analyzing;

  return (
    <div className="exp-page">

      {/* ── Breadcrumb ── */}
      <nav className="exp-breadcrumb">
        <button className="exp-back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <span className="exp-bc-sep">/</span>
        <span className="exp-bc-label">Doc Exports</span>
        <div className="exp-bc-spacer" />

        {/* Project dropdown */}
        <div className="exp-bc-dropdown">
          <label className="exp-bc-dlabel">Project</label>
          {loadingProj
            ? <span className="exp-bc-spin" />
            : <select className="exp-bc-select" value={selProject} onChange={handleProjectChange}>
                <option value="">— Select Project —</option>
                {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
          }
        </div>

        <span className={`exp-bc-arrow ${selProject ? 'exp-bc-arrow--on' : ''}`}>›</span>

        {/* File dropdown — unlocks after project selected */}
        <div className={`exp-bc-dropdown ${!selProject ? 'exp-bc-dropdown--off' : ''}`}>
          <label className="exp-bc-dlabel">File</label>
          {loadingFiles
            ? <span className="exp-bc-spin" />
            : <select className="exp-bc-select" value={selFile} onChange={handleFileChange} disabled={!selProject}>
                <option value="">
                  {!selProject ? '— Select project first —' : files.length === 0 ? '— No files —' : '— Select File —'}
                </option>
                {files.map(f => <option key={f.id} value={String(f.id)}>{f.filename}</option>)}
              </select>
          }
        </div>
      </nav>

      {/* ── Hero header ── */}
      <div className="exp-hero">
        <div className="exp-hero-icon">📦</div>
        <h1 className="exp-hero-title">Document Export</h1>
        <p className="exp-hero-sub">Select a project and file to preview and export your analysis report</p>
      </div>

      {/* ── Analyzing spinner ── */}
      {analyzing && (
        <div className="exp-analyzing">
          <span className="export-spinner exp-analyzing-spin" />
          <span>Analysing <strong>{fileObj?.filename}</strong>…</span>
        </div>
      )}

      {/* ── Empty state instructions ── */}
      {!selProject && !analyzing && (
        <div className="exp-steps">
          <div className="exp-step exp-step--active">
            <span className="exp-step-num">1</span>
            <div><strong>Select a Project</strong><span>Use the dropdown in the breadcrumb above</span></div>
          </div>
          <div className="exp-step-connector" />
          <div className={`exp-step ${selProject ? 'exp-step--active' : ''}`}>
            <span className="exp-step-num">2</span>
            <div><strong>Select a File</strong><span>Available after choosing a project</span></div>
          </div>
          <div className="exp-step-connector" />
          <div className={`exp-step ${canExport ? 'exp-step--active' : ''}`}>
            <span className="exp-step-num">3</span>
            <div><strong>Preview & Export</strong><span>See document preview then download</span></div>
          </div>
        </div>
      )}

      {selProject && !selFile && !analyzing && (
        <div className="exp-waiting">
          <span className="exp-waiting-icon">📄</span>
          <p>Now select a file from the dropdown to generate the export preview.</p>
        </div>
      )}

      {/* ── Document preview ── */}
      {showPreview && (
        <DocumentPreview
          data={data}
          projectName={projObj?.name || ''}
          fileName={fileObj?.filename || ''}
          previewType={previewType}
          setPreviewType={setPreviewType}
        />
      )}

      {/* ── Export All card ── */}
      {canExport && (
        <div className="exp-export-card">
          <div className="exp-export-card-header">
            <div className="exp-export-card-info">
              <span className="exp-export-card-icon">📤</span>
              <div>
                <div className="exp-export-card-title">Export All Sections</div>
                <div className="exp-export-card-meta">
                  <span className="exp-chip">{projObj?.name}</span>
                  <span className="exp-chip-sep">›</span>
                  <span className="exp-chip exp-chip--file">{fileObj?.filename}</span>
                  <span className="exp-chip-sep">·</span>
                  <span className="exp-chip exp-chip--rows">{data?.metadata?.rows?.toLocaleString()} rows</span>
                  <span className="exp-chip-sep">·</span>
                  <span className="exp-chip exp-chip--pos">{data?.metadata?.position_columns} positions</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ExportDashboard">
            <div style={{ padding: 0, boxShadow: 'none', background: 'transparent', border: 'none' }}>
              <div className="export-grid">
                {EXPORT_BTNS.map(btn => (
                  <button key={btn.fmt}
                    className={`export-btn ${btn.cls} ${exporting === btn.fmt ? 'export-btn--busy' : ''}`}
                    onClick={() => handleExport(btn.fmt)}
                    disabled={!!exporting}>
                    {exporting === btn.fmt
                      ? <><span className="export-spinner" /> Generating…</>
                      : <>{btn.icon} {btn.label}</>
                    }
                  </button>
                ))}
              </div>
            </div>
          </div>

          {toast && (
            <div className={`export-toast export-toast--${toast.ok ? 'ok' : 'err'}`}>
              {toast.ok ? '✅' : '❌'} {toast.msg}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export { ExportDashboard };
export default ExportDashboard;