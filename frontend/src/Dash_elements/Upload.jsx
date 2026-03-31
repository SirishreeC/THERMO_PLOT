// frontend/src/Dash_elements/Upload.jsx
import StatisticsPanel      from '../components/StatisticsPanel';
import HeatmapPanel         from '../components/HeatmapPanel';
import TimeSeriesPanel      from '../components/TimeSeriesPanel';
import SpatialPanel         from '../components/SpatialPanel';
import CorrelationPanel     from '../components/CorrelationPanel';
import AnomalyPanel         from '../components/AnomalyPanel';
import TemporalPanel        from '../components/TemporalPanel';
import SpatialAnalysisPanel from '../components/SpatialAnalysisPanel';
import { PanelExportButton } from './Exports';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation }          from 'react-router-dom';
import axios from 'axios';
import './Upload.css';

const API = 'http://127.0.0.1:8000';

const TABS = [
  { key: 'statistics',       label: '📊 Statistics',      fullLabel: 'Statistics'       },
  { key: 'heatmap',          label: '🔥 Heatmap',          fullLabel: 'Heatmap'           },
  { key: 'timeseries',       label: '📈 Time Series',      fullLabel: 'Time Series'       },
  { key: 'spatial',          label: '🗺️ Spatial',          fullLabel: 'Spatial'           },
  { key: 'correlation',      label: '⚡ Correlation',      fullLabel: 'Correlation'       },
  { key: 'anomalies',        label: '⚠️ Anomalies',        fullLabel: 'Anomalies'         },
  { key: 'temporal',         label: '⏱️ Temporal',          fullLabel: 'Temporal'          },
  { key: 'spatial_analysis', label: '🗺️ Spatial Analysis', fullLabel: 'Spatial Analysis'  },
];

// ── Export All card ──────────────────────────────────────────
const ExportAllCard = ({ data, projectName, fileName }) => {
  const token   = localStorage.getItem('token') || '';
  const formats = [
    { key: 'pdf',   label: '📄 PDF',   color: '#ef4444' },
    { key: 'excel', label: '📊 Excel', color: '#10b981' },
    { key: 'csv',   label: '📋 CSV',   color: '#3b82f6' },
    { key: 'word',  label: '📝 Word',  color: '#a855f7' },
  ];

  const handleExport = async (fmt) => {
    try {
      const ext = fmt === 'word' ? 'docx' : fmt === 'excel' ? 'xlsx' : fmt;
      const res = await axios.post(
        `${API}/export/${fmt}`,
        { data, section: 'all', token },
        { responseType: 'blob' }
      );
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ThermoPlot_${projectName}_${fileName}_all.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  return (
    <div className="upload-export-card">
      <div className="uec-header">
        <span className="uec-icon">📤</span>
        <div>
          <div className="uec-title">Export All</div>
          <div className="uec-meta">
            <span className="uec-chip">{projectName}</span>
            <span className="uec-sep">›</span>
            <span className="uec-chip uec-chip--file">{fileName}</span>
          </div>
        </div>
      </div>
      <div className="uec-btns">
        {formats.map(f => (
          <button key={f.key} className="uec-btn"
            style={{ '--uec-color': f.color }}
            onClick={() => handleExport(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Main Upload component ────────────────────────────────────
const Upload = ({ gatewayState: propGatewayState }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const token     = localStorage.getItem('token') || '';

  // Gateway state can come from prop (Projects.jsx) or router location state
  const gatewayState = propGatewayState
    || location.state?.gatewayState
    || null;

  // ── Breadcrumb dropdown state ────────────────────────────
  const [projects,     setProjects]     = useState([]);
  const [files,        setFiles]        = useState([]);
  const [selProject,   setSelProject]   = useState('');
  const [selFile,      setSelFile]      = useState('');
  const [projObj,      setProjObj]      = useState(null);
  const [fileObj,      setFileObj]      = useState(null);
  const [loadingProj,  setLoadingProj]  = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // ── ThermalVisuals state ─────────────────────────────────
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [activeTab, setActiveTab] = useState('statistics');
  const [autoLabel, setAutoLabel] = useState('');   // shown while auto-loading

  // ── Core: analyze a file by fetching it from the static endpoint ──
  const analyzeFromPath = useCallback(async (savedAs, filename) => {
    setLoading(true);
    setData(null);
    try {
      // Fetch the file bytes from backend static server
      const fileRes = await fetch(`${API}/static/${savedAs}`);
      if (!fileRes.ok) throw new Error(`Could not fetch file: ${fileRes.status}`);
      const blob    = await fileRes.blob();
      const file    = new File([blob], filename || savedAs, { type: blob.type });
      const fd      = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/thermal/analyze`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setData(res.data);
    } catch (err) {
      console.error('Auto-analyze failed:', err);
      alert('Could not load file for analysis: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-analyze when gatewayState is present ────────────
  // This fires immediately when navigated from Projects or data_visual
  useEffect(() => {
    if (!gatewayState?.savedAs) return;
    setAutoLabel(gatewayState.filename || gatewayState.savedAs);
    analyzeFromPath(gatewayState.savedAs, gatewayState.filename);
  }, [gatewayState?.savedAs]);   // only re-run if the file changes

  // ── Fetch projects for breadcrumb ────────────────────────
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

  // ── Fetch files when project dropdown changes ────────────
  const fetchFiles = useCallback(async (projectId) => {
    setLoadingFiles(true);
    setFiles([]); setSelFile(''); setFileObj(null);
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

  // ── Analyze file selected from breadcrumb dropdown ───────
  const handleAnalyzeSelected = async () => {
    if (!fileObj) return;
    await analyzeFromPath(fileObj.saved_as, fileObj.filename);
  };

  // ── Local file upload (manual, no project) ───────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setData(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post(`${API}/thermal/analyze`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setData(res.data);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    if (!data) return null;
    switch (activeTab) {
      case 'statistics':       return <StatisticsPanel      data={data} />;
      case 'heatmap':          return <HeatmapPanel         data={data} />;
      case 'timeseries':       return <TimeSeriesPanel      data={data} />;
      case 'spatial':          return <SpatialPanel         data={data} />;
      case 'correlation':      return <CorrelationPanel     data={data} />;
      case 'anomalies':        return <AnomalyPanel         data={data} />;
      case 'temporal':         return <TemporalPanel        data={data} />;
      case 'spatial_analysis': return <SpatialAnalysisPanel data={data} />;
      default:                 return <StatisticsPanel      data={data} />;
    }
  };

  const activeMeta   = TABS.find(t => t.key === activeTab);
  const canAnalyze   = !!selProject && !!selFile && !loading;
  const canExport    = !!data;

  // Determine project/file names for Export All card
  const exportProjName = gatewayState?.projectName || projObj?.name || '';
  const exportFileName = gatewayState?.filename    || fileObj?.filename || '';

  return (
    <div className="upload-page">

      {/* ── Breadcrumb ── */}
      <nav className="upload-breadcrumb">
        <button className="upload-bc-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <span className="upload-bc-sep">/</span>
        <span className="upload-bc-label">
          {gatewayState?.projectName
            ? `${gatewayState.projectName} › ${gatewayState.filename || 'ThermalVisuals'}`
            : 'ThermalVisuals'}
        </span>
        <div className="upload-bc-spacer" />

        {/* Only show dropdowns when NOT in gateway mode */}
        {!gatewayState && (
          <>
            <div className="upload-bc-dropdown">
              <label className="upload-bc-dlabel">Project</label>
              {loadingProj
                ? <span className="upload-bc-spin" />
                : <select className="upload-bc-select" value={selProject} onChange={handleProjectChange}>
                    <option value="">— Select Project —</option>
                    {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                  </select>
              }
            </div>

            <span className={`upload-bc-arrow ${selProject ? 'upload-bc-arrow--on' : ''}`}>›</span>

            <div className={`upload-bc-dropdown ${!selProject ? 'upload-bc-dropdown--off' : ''}`}>
              <label className="upload-bc-dlabel">File</label>
              {loadingFiles
                ? <span className="upload-bc-spin" />
                : <select className="upload-bc-select" value={selFile} onChange={handleFileChange} disabled={!selProject}>
                    <option value="">
                      {!selProject ? '— Select project first —' : files.length === 0 ? '— No files —' : '— Select File —'}
                    </option>
                    {files.map(f => <option key={f.id} value={String(f.id)}>{f.filename}</option>)}
                  </select>
              }
            </div>

            {canAnalyze && !data && (
              <button className="upload-bc-open" onClick={handleAnalyzeSelected}>
                Open in ThermalVisuals →
              </button>
            )}
          </>
        )}

        {/* In gateway mode, show a back button to the project */}
        {gatewayState && (
          <button className="upload-bc-back"
            onClick={() => navigate('/projects')}>
            ← Back to Projects
          </button>
        )}
      </nav>

      {/* ── Export All card (only when data is loaded) ── */}
      {canExport && exportProjName && (
        <ExportAllCard
          data={data}
          projectName={exportProjName}
          fileName={exportFileName}
        />
      )}

      {/* ── ThermalVisuals Header ── */}
      <div className="upload-header">
        <h1 className="upload-title">ThermalVisuals</h1>
        <h2 className="upload-subtitle">Spatial-Temporal Temperature Analysis</h2>
      </div>

      {/* ── Loading spinner ── */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <span>
            {autoLabel ? `Analysing ${autoLabel}…` : 'Analysing data…'}
          </span>
        </div>
      )}

      {/* ── Upload card (shown only when no data and not loading) ── */}
      {!data && !loading && (
        <div className="upload-card-wrapper">
          <div className="upload-card">
            <div className="upload-icon-box">📊</div>
            <h3 className="upload-card-title">
              {selFile ? `Ready: ${fileObj?.filename}` : 'Upload Temperature Data'}
            </h3>

            {/* If a file is selected from dropdown, show Analyse button */}
            {selFile ? (
              <button className="upload-btn" onClick={handleAnalyzeSelected}>
                Analyse {fileObj?.filename}
              </button>
            ) : (
              <>
                <input type="file" accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }} id="file-upload" />
                <label htmlFor="file-upload">
                  <span className="upload-btn">Choose Excel File</span>
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Data panels ── */}
      {data && !loading && (
        <>
          {/* Metadata summary cards */}
          <div className="meta-grid">
            <div className="meta-card blue">
              <div className="meta-value">{data.metadata?.total_rows?.toLocaleString() || 0}</div>
              <div className="meta-label">Time Points</div>
            </div>
            <div className="meta-card green">
              <div className="meta-value">{data.metadata?.position_columns || 0}</div>
              <div className="meta-label">Positions</div>
            </div>
            <div className="meta-card purple">
              <div className="meta-value">
                {data.metadata?.global_max != null ? `${data.metadata.global_max}°` : '—'}
              </div>
              <div className="meta-label">Peak Temp</div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="tab-bar-wrapper">
            <div className="tab-bar">
              {TABS.map(tab => (
                <button key={tab.key}
                  className={`tab-btn ${activeTab === tab.key ? 'tab-btn--active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Per-panel export button */}
          {activeMeta && (
            <div className="panel-export-row">
              <PanelExportButton
                data={data}
                section={activeMeta.fullLabel}
                label={`Export ${activeMeta.fullLabel}`}
              />
            </div>
          )}

          {/* Panel content */}
          <div className="panel-content">
            {renderTabContent()}
          </div>
        </>
      )}
    </div>
  );
};

export default Upload;