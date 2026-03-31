// components/SpatialAnalysisPanel.jsx
import React, { useState, useMemo, useCallback } from 'react';
import './SpatialAnalysisPanel.css';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import axios from 'axios';

// ─── Colour mapping ─────────────────────────────────────────────────────────
const gradientColor = (value) => {
  // Positive = heating (red), Negative = cooling (blue), ~0 = grey
  if (value > 2)   return '#ef4444';
  if (value > 0.5) return '#f97316';
  if (value > 0)   return '#fbbf24';
  if (value > -0.5) return '#64748b';
  if (value > -2)   return '#3b82f6';
  return '#1e40af';
};

const uniformityColor = (score) => {
  if (score >= 80) return '#10b981'; // Green - very uniform
  if (score >= 60) return '#eab308'; // Yellow
  if (score >= 40) return '#f97316'; // Orange
  return '#ef4444'; // Red - non-uniform
};

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, unit = '°C' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="spa-tooltip">
      <div className="spa-tooltip__label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="spa-tooltip__row">
          <span className="spa-tooltip__dot" style={{ background: p.color }} />
          <span className="spa-tooltip__name">{p.name}:</span>
          <span className="spa-tooltip__val">
            {p.value != null ? `${parseFloat(p.value).toFixed(3)}${unit}` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Direction Badge ────────────────────────────────────────────────────────
const DirectionBadge = ({ direction }) => {
  const map = {
    left_to_right: { label: '→ L→R Heat Flow', cls: 'spa-dir--lr' },
    right_to_left: { label: '← R→L Heat Flow', cls: 'spa-dir--rl' },
    bidirectional: { label: '↔ Bidirectional', cls: 'spa-dir--bi' },
    uniform:       { label: '━ Uniform',       cls: 'spa-dir--uni' },
  };
  const { label, cls } = map[direction] ?? map.uniform;
  return <span className={`spa-dir ${cls}`}>{label}</span>;
};

// ─── Tabs ───────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'profile',   icon: '📊', label: 'Temperature Profile' },
  { key: 'gradient',  icon: '🌡',  label: 'Spatial Gradient' },
  { key: 'animation', icon: '🎬', label: 'Time Animation' },
  { key: 'summary',   icon: '📋', label: 'Summary' },
];

// ══════════════════════════════════════════════════════════════════════════════
const SpatialAnalysisPanel = ({ data }) => {
  const [activeTab,     setActiveTab]     = useState('profile');
  const [selectedTime,  setSelectedTime]  = useState(0);
  const [animating,     setAnimating]     = useState(false);
  const [animSpeed,     setAnimSpeed]     = useState(200); // ms per frame
  const [useLocations,  setUseLocations]  = useState(false);
  const [locations,     setLocations]     = useState({});
  const [analysisData,  setAnalysisData]  = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  // Extract time values
  const times = useMemo(() => {
    if (!data?.time_series?.length) return [];
    const timeKey = Object.keys(data.time_series[0])[0];
    return data.time_series.map(row => parseFloat(row[timeKey]));
  }, [data]);

  const allPositions = useMemo(() => {
    if (!data?.time_series?.length) return [];
    return Object.keys(data.time_series[0]).filter(k => k !== Object.keys(data.time_series[0])[0]);
  }, [data]);

  // ─── Run analysis ──────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!data?.time_series?.length) return;
    setLoading(true);
    setError(null);

    try {
      const timeKey = Object.keys(data.time_series[0])[0];
      const payload = {
        time_series: data.time_series.map(row => ({
          time: parseFloat(row[timeKey]),
          temperatures: Object.fromEntries(
            Object.entries(row).filter(([k]) => k !== timeKey)
          ),
        })),
        position_locations: useLocations ? locations : null,
        use_indices_as_location: !useLocations,
      };

      const res = await axios.post(
        'http://localhost:8000/spatial/analyze',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      setAnalysisData(res.data);
      setSelectedTime(0);
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Animation control ─────────────────────────────────────────────────
  const toggleAnimation = useCallback(() => {
    if (!analysisData) return;
    setAnimating(prev => !prev);
  }, [analysisData]);

  React.useEffect(() => {
    if (!animating || !analysisData) return;
    
    const interval = setInterval(() => {
      setSelectedTime(prev => {
        const next = prev + 1;
        if (next >= analysisData.time_slices.length) {
          setAnimating(false);
          return 0;
        }
        return next;
      });
    }, animSpeed);

    return () => clearInterval(interval);
  }, [animating, animSpeed, analysisData]);

  // ─── Chart data builders ───────────────────────────────────────────────
  const currentSlice = analysisData?.time_slices?.[selectedTime];

  const profileData = useMemo(() => {
    if (!currentSlice) return [];
    return currentSlice.profile.map(p => ({
      position: p.position,
      location: p.location,
      temperature: p.temperature,
    }));
  }, [currentSlice]);

  const gradientData = useMemo(() => {
    if (!currentSlice) return [];
    return currentSlice.gradients.map(g => ({
      position: g.position,
      location: g.location,
      gradient: g.gradient,
    }));
  }, [currentSlice]);

  // ─── Render functions ──────────────────────────────────────────────────
  const renderProfile = () => (
    <div className="spa-chart-wrap">
      <div className="spa-chart-header">
        <h3 className="spa-chart-title">
          📊 Temperature Profile at t = {currentSlice?.time.toFixed(2)}s
        </h3>
        <div className="spa-stats-row">
          <div className="spa-stat">
            <span className="spa-stat__label">Max Temp:</span>
            <span className="spa-stat__val spa-stat__val--hot">
              {currentSlice?.max_temp_position} ({profileData.find(p => p.position === currentSlice?.max_temp_position)?.temperature?.toFixed(2) ?? '—'}°C)
            </span>
          </div>
          <div className="spa-stat">
            <span className="spa-stat__label">Min Temp:</span>
            <span className="spa-stat__val spa-stat__val--cold">
              {currentSlice?.min_temp_position} ({profileData.find(p => p.position === currentSlice?.min_temp_position)?.temperature?.toFixed(2) ?? '—'}°C)
            </span>
          </div>
          <div className="spa-stat">
            <span className="spa-stat__label">Range:</span>
            <span className="spa-stat__val">{currentSlice?.temperature_range.toFixed(2)}°C</span>
          </div>
          <div className="spa-stat">
            <span className="spa-stat__label">Uniformity:</span>
            <span 
              className="spa-uniformity-badge"
              style={{ background: uniformityColor(currentSlice?.uniformity_score ?? 0) }}
            >
              {currentSlice?.uniformity_score.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={profileData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <defs>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
          <XAxis
            dataKey="position"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{ 
              value: useLocations ? 'Position (mm)' : 'Position Index', 
              position: 'insideBottom', 
              offset: -20,
              fill: '#64748b',
              fontSize: 12
            }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{ 
              value: 'Temperature (°C)', 
              angle: -90, 
              position: 'insideLeft',
              fill: '#64748b',
              fontSize: 12
            }}
          />
          <Tooltip content={<CustomTooltip unit="°C" />} />
          <Area
            type="monotone"
            dataKey="temperature"
            stroke="#f97316"
            strokeWidth={3}
            fill="url(#tempGrad)"
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  const renderGradient = () => (
    <div className="spa-chart-wrap">
      <div className="spa-chart-header">
        <h3 className="spa-chart-title">
          🌡 Spatial Gradient (dT/dx) at t = {currentSlice?.time.toFixed(2)}s
        </h3>
        <div className="spa-stats-row">
          <div className="spa-stat">
            <span className="spa-stat__label">Direction:</span>
            <DirectionBadge direction={currentSlice?.gradient_direction ?? 'uniform'} />
          </div>
          <div className="spa-stat">
            <span className="spa-stat__label">Max Gradient:</span>
            <span className="spa-stat__val spa-stat__val--hot">
              {currentSlice?.max_gradient.toFixed(4)} °C/{useLocations ? 'mm' : 'pos'}
            </span>
          </div>
          <div className="spa-stat">
            <span className="spa-stat__label">Min Gradient:</span>
            <span className="spa-stat__val spa-stat__val--cold">
              {currentSlice?.min_gradient.toFixed(4)} °C/{useLocations ? 'mm' : 'pos'}
            </span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={gradientData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
          <XAxis
            dataKey="position"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{ 
              value: useLocations ? 'Position (mm)' : 'Position Index',
              position: 'insideBottom',
              offset: -20,
              fill: '#64748b',
              fontSize: 12
            }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{ 
              value: `dT/d${useLocations ? 'x' : 'pos'} (°C/${useLocations ? 'mm' : 'pos'})`,
              angle: -90,
              position: 'insideLeft',
              fill: '#64748b',
              fontSize: 12
            }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.4)" strokeDasharray="4 4" />
          <Tooltip content={<CustomTooltip unit={`°C/${useLocations ? 'mm' : 'pos'}`} />} />
          <Bar dataKey="gradient" radius={[4, 4, 0, 0]}>
            {gradientData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={gradientColor(entry.gradient ?? 0)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="spa-gradient-legend">
        <div className="spa-legend-item"><div className="spa-legend-box" style={{background:'#1e40af'}}/> Strong Cooling (&lt; -2)</div>
        <div className="spa-legend-item"><div className="spa-legend-box" style={{background:'#3b82f6'}}/> Cooling (-0.5 to -2)</div>
        <div className="spa-legend-item"><div className="spa-legend-box" style={{background:'#64748b'}}/> Neutral (-0.5 to +0.5)</div>
        <div className="spa-legend-item"><div className="spa-legend-box" style={{background:'#fbbf24'}}/> Heating (+0.5 to +2)</div>
        <div className="spa-legend-item"><div className="spa-legend-box" style={{background:'#ef4444'}}/> Strong Heating (&gt; +2)</div>
      </div>
    </div>
  );

  const renderAnimation = () => (
    <div className="spa-animation-wrap">
      <div className="spa-anim-controls">
        <button
          className={`spa-anim-btn ${animating ? 'spa-anim-btn--pause' : 'spa-anim-btn--play'}`}
          onClick={toggleAnimation}
        >
          {animating ? '⏸ Pause' : '▶ Play Animation'}
        </button>
        
        <div className="spa-speed-ctrl">
          <span className="spa-speed-label">Speed:</span>
          {[100, 200, 500, 1000].map(s => (
            <button
              key={s}
              onClick={() => setAnimSpeed(s)}
              className={`spa-speed-btn ${animSpeed === s ? 'spa-speed-btn--on' : 'spa-speed-btn--off'}`}
            >
              {s === 100 ? '2x' : s === 200 ? '1x' : s === 500 ? '0.5x' : '0.2x'}
            </button>
          ))}
        </div>
      </div>

      <div className="spa-timeline">
        <input
          type="range"
          min="0"
          max={(analysisData?.time_slices?.length ?? 1) - 1}
          value={selectedTime}
          onChange={(e) => {
            setSelectedTime(parseInt(e.target.value));
            setAnimating(false);
          }}
          className="spa-timeline-slider"
        />
        <div className="spa-timeline-label">
          Frame: {selectedTime + 1} / {analysisData?.time_slices?.length ?? 0} 
          &nbsp;|&nbsp; t = {currentSlice?.time.toFixed(2)}s
        </div>
      </div>

      {/* Show both charts in animation mode */}
      <div className="spa-dual-chart">
        {renderProfile()}
        {renderGradient()}
      </div>
    </div>
  );

  const renderSummary = () => {
    const gs = analysisData?.global_summary;
    if (!gs) return null;

    return (
      <div className="spa-summary">
        {/* Global cards */}
        <div className="spa-summary-cards">
          <div className="spa-card spa-card--orange">
            <div className="spa-card__val">{gs.total_time_slices}</div>
            <div className="spa-card__label">Time Slices</div>
          </div>
          <div className="spa-card spa-card--blue">
            <div className="spa-card__val">{gs.total_positions}</div>
            <div className="spa-card__label">Positions</div>
          </div>
          <div className="spa-card spa-card--red">
            <div className="spa-card__val">{gs.peak_gradient}</div>
            <div className="spa-card__label">Peak Gradient</div>
          </div>
          <div className="spa-card spa-card--green">
            <div className="spa-card__val">{gs.average_uniformity}%</div>
            <div className="spa-card__label">Avg Uniformity</div>
          </div>
        </div>

        {/* Direction distribution */}
        <div className="spa-section">
          <div className="spa-section__title">Heat Flow Direction Distribution</div>
          <div className="spa-dir-grid">
            {Object.entries(gs.gradient_direction_distribution).map(([dir, count]) => (
              <div key={dir} className="spa-dir-item">
                <DirectionBadge direction={dir} />
                <span className="spa-dir-count">{count} slices</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key findings */}
        <div className="spa-section">
          <div className="spa-section__title">Key Findings</div>
          <div className="spa-findings">
            <div className="spa-finding">
              <span className="spa-finding__icon">✅</span>
              <span>Most uniform at <strong>t = {gs.most_uniform_time}s</strong></span>
            </div>
            <div className="spa-finding">
              <span className="spa-finding__icon">⚠️</span>
              <span>Least uniform at <strong>t = {gs.least_uniform_time}s</strong></span>
            </div>
            <div className="spa-finding">
              <span className="spa-finding__icon">📏</span>
              <span>Spatial extent: <strong>{gs.spatial_extent}</strong></span>
            </div>
          </div>
        </div>

        {/* Per-time table */}
        <div className="spa-section">
          <div className="spa-section__title">Per-Time Slice Details (first 10)</div>
          <div className="spa-table-wrap">
            <table className="spa-table">
              <thead>
                <tr>
                  <th>Time (s)</th>
                  <th>Max Temp Pos</th>
                  <th>Temp Range</th>
                  <th>Heat Flow</th>
                  <th>Uniformity</th>
                </tr>
              </thead>
              <tbody>
                {analysisData.time_slices.slice(0, 10).map((ts, idx) => (
                  <tr key={idx} onClick={() => { setSelectedTime(idx); setActiveTab('profile'); }}>
                    <td>{ts.time.toFixed(2)}</td>
                    <td>{ts.max_temp_position}</td>
                    <td>{ts.temperature_range.toFixed(2)}°C</td>
                    <td><DirectionBadge direction={ts.gradient_direction} /></td>
                    <td>
                      <span 
                        className="spa-uniformity-badge"
                        style={{ background: uniformityColor(ts.uniformity_score) }}
                      >
                        {ts.uniformity_score.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────
  return (
    <div className="spa-panel">
      {/* Controls */}
      <div className="spa-controls">
        <div className="spa-controls__section">
          <label className="spa-checkbox">
            <input
              type="checkbox"
              checked={useLocations}
              onChange={(e) => setUseLocations(e.target.checked)}
            />
            <span>Use custom position locations (mm)</span>
          </label>

          {useLocations && (
            <div className="spa-locations-input">
              <div className="spa-locations-hint">
                Enter comma-separated locations for: {allPositions.join(', ')}
              </div>
              <input
                type="text"
                placeholder="e.g., 0, 10, 20, 30, 40, 50, ..."
                onChange={(e) => {
                  const vals = e.target.value.split(',').map(v => parseFloat(v.trim()));
                  const locs = {};
                  allPositions.forEach((pos, idx) => {
                    locs[pos] = vals[idx] ?? idx;
                  });
                  setLocations(locs);
                }}
                className="spa-locations-field"
              />
            </div>
          )}
        </div>

        <button
          className={`spa-run-btn ${loading ? 'spa-run-btn--loading' : ''}`}
          onClick={runAnalysis}
          disabled={loading}
        >
          {loading ? <><span className="spa-spinner" /> Analysing…</> : '▶ Run Spatial Analysis'}
        </button>

        {error && <div className="spa-error">⚠️ {error}</div>}
      </div>

      {/* Results */}
      {!analysisData && !loading && (
        <div className="spa-empty">
          <div className="spa-empty__icon">📊</div>
          <div className="spa-empty__title">No Analysis Yet</div>
          <div className="spa-empty__hint">
            Configure settings and click <strong>Run Spatial Analysis</strong>
          </div>
        </div>
      )}

      {analysisData && (
        <>
          {/* Tab bar */}
          <div className="spa-tab-bar">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`spa-tab ${activeTab === t.key ? 'spa-tab--on' : 'spa-tab--off'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="spa-tab-content">
            {activeTab === 'profile'    && renderProfile()}
            {activeTab === 'gradient'   && renderGradient()}
            {activeTab === 'animation'  && renderAnimation()}
            {activeTab === 'summary'    && renderSummary()}
          </div>
        </>
      )}
    </div>
  );
};

export default SpatialAnalysisPanel;