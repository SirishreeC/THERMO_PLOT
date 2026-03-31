// components/TemporalPanel.jsx
import React, { useState, useMemo, useCallback } from 'react';
import './TemporalPanel.css';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import axios from 'axios';

// ─── Colour palette ────────────────────────────────────────────────────────
const PALETTE = [
  '#f97316','#3b82f6','#10b981','#a855f7',
  '#ef4444','#eab308','#06b6d4','#ec4899',
];
const posColor = (idx) => PALETTE[idx % PALETTE.length];

// ─── Custom tooltip ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, unit = '°C' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tp-tooltip">
      <div className="tp-tooltip__time">t = {parseFloat(label).toFixed(2)}s</div>
      {payload.map((p, i) => (
        <div key={i} className="tp-tooltip__row">
          <span className="tp-tooltip__dot" style={{ background: p.color }} />
          <span className="tp-tooltip__name">{p.name}:</span>
          <span className="tp-tooltip__val">
            {p.value != null ? `${parseFloat(p.value).toFixed(3)}${unit}` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Trend badge ───────────────────────────────────────────────────────────
const TrendBadge = ({ trend }) => {
  const map = {
    heating: { label: '🔥 Heating',  cls: 'tp-badge--heat' },
    cooling: { label: '❄️ Cooling',  cls: 'tp-badge--cool' },
    stable:  { label: '✅ Stable',   cls: 'tp-badge--stable' },
  };
  const { label, cls } = map[trend] ?? map.stable;
  return <span className={`tp-badge ${cls}`}>{label}</span>;
};

// ─── Tab constants ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'lineplot',  icon: '📈', label: 'Line Plot' },
  { key: 'rate',      icon: '⚡', label: 'Rate of Change' },
  { key: 'rolling',   icon: '🔄', label: 'Rolling Stats' },
  { key: 'summary',   icon: '📋', label: 'Summary' },
];

// ══════════════════════════════════════════════════════════════════════════════
const TemporalPanel = ({ data }) => {
  const [activeTab,        setActiveTab]        = useState('lineplot');
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [rollingWindow,    setRollingWindow]    = useState(10);
  const [analysisData,     setAnalysisData]     = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState(null);
  const [ranOnce,          setRanOnce]          = useState(false);

  // All available positions
  const allPositions = useMemo(() => {
    if (!data?.time_series?.length) return [];
    return Object.keys(data.time_series[0]).filter(k => k !== Object.keys(data.time_series[0])[0]);
  }, [data]);

  const togglePosition = useCallback((pos) => {
    setSelectedPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  }, []);

  const selectAll  = () => setSelectedPositions([...allPositions]);
  const clearAll   = () => setSelectedPositions([]);

  // ─── Run analysis ──────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!data?.time_series?.length) return;
    setLoading(true);
    setError(null);

    try {
      // Transform time_series to the API shape
      const timeKey = Object.keys(data.time_series[0])[0];
      const payload = {
        time_series: data.time_series.map(row => ({
          time:   parseFloat(row[timeKey]),
          values: Object.fromEntries(
            Object.entries(row).filter(([k]) => k !== timeKey)
          ),
        })),
        positions:      selectedPositions.length ? selectedPositions : null,
        rolling_window: rollingWindow,
      };

      const res = await axios.post(
        'http://localhost:8000/temporal/analyze',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      setAnalysisData(res.data);
      setRanOnce(true);
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Analysis failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  // ─── Build chart datasets from analysisData ────────────────────────────
  const linePlotData = useMemo(() => {
    if (!analysisData) return [];
    const byTime = {};
    analysisData.positions.forEach(({ position, line_plot }, idx) => {
      line_plot.forEach(({ time, value }) => {
        if (!byTime[time]) byTime[time] = { time };
        byTime[time][position] = value;
      });
    });
    return Object.values(byTime).sort((a, b) => a.time - b.time);
  }, [analysisData]);

  const rateData = useMemo(() => {
    if (!analysisData) return [];
    const byTime = {};
    analysisData.positions.forEach(({ position, rate_of_change }) => {
      rate_of_change.forEach(({ time, rate }) => {
        if (!byTime[time]) byTime[time] = { time };
        byTime[time][position] = rate;
      });
    });
    return Object.values(byTime).sort((a, b) => a.time - b.time);
  }, [analysisData]);

  const rollingData = useMemo(() => {
    if (!analysisData) return [];
    const byTime = {};
    analysisData.positions.forEach(({ position, rolling_mean }) => {
      rolling_mean.forEach(({ time, mean, std }) => {
        if (!byTime[time]) byTime[time] = { time };
        byTime[time][`${position}_mean`] = mean;
        byTime[time][`${position}_upper`] = mean != null && std != null ? mean + std : null;
        byTime[time][`${position}_lower`] = mean != null && std != null ? mean - std : null;
      });
    });
    return Object.values(byTime).sort((a, b) => a.time - b.time);
  }, [analysisData]);

  const shownPositions = analysisData?.positions ?? [];

  // ─── Render helpers ────────────────────────────────────────────────────
  const renderLinePlot = () => (
    <div className="tp-chart-wrap">
      <h3 className="tp-chart-title">📈 Temperature vs Time</h3>
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={linePlotData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            label={{ value: 'Time (s)', position: 'insideBottom', offset: -4,
                     fill: '#64748b', fontSize: 12 }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft',
                     fill: '#64748b', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip unit="°C" />} />
          <Legend
            wrapperStyle={{ color: '#94a3b8', fontSize: 12, fontFamily: 'JetBrains Mono' }}
          />
          {shownPositions.map(({ position }, idx) => (
            <Line
              key={position}
              type="monotone"
              dataKey={position}
              stroke={posColor(idx)}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderRate = () => (
    <div className="tp-chart-wrap">
      <h3 className="tp-chart-title">⚡ Rate of Change (dT/dt)</h3>
      <p className="tp-chart-sub">Positive = heating, Negative = cooling, Near-zero = stable</p>
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={rateData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            label={{ value: 'Time (s)', position: 'insideBottom', offset: -4,
                     fill: '#64748b', fontSize: 12 }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            label={{ value: 'dT/dt (°C/s)', angle: -90, position: 'insideLeft',
                     fill: '#64748b', fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="6 3" />
          <Tooltip content={<CustomTooltip unit="°C/s" />} />
          <Legend
            wrapperStyle={{ color: '#94a3b8', fontSize: 12, fontFamily: 'JetBrains Mono' }}
          />
          {shownPositions.map(({ position }, idx) => (
            <Line
              key={position}
              type="monotone"
              dataKey={position}
              stroke={posColor(idx)}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderRolling = () => (
    <div className="tp-chart-wrap">
      <h3 className="tp-chart-title">🔄 Rolling Mean ± Std Dev</h3>
      <p className="tp-chart-sub">
        Window: {rollingWindow} samples — Shaded band = ±1 standard deviation
      </p>
      {shownPositions.map(({ position }, idx) => (
        <div key={position} className="tp-rolling-block">
          <div className="tp-rolling-block__label" style={{ color: posColor(idx) }}>
            {position}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={rollingData}
              margin={{ top: 5, right: 24, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={posColor(idx)} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={posColor(idx)} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.25)" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              />
              <Tooltip content={<CustomTooltip unit="°C" />} />
              {/* ±1σ band */}
              <Area
                type="monotone"
                dataKey={`${position}_upper`}
                stroke="none"
                fill={`url(#grad-${idx})`}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey={`${position}_lower`}
                stroke="none"
                fill="transparent"
                connectNulls
              />
              {/* Rolling mean line */}
              <Line
                type="monotone"
                dataKey={`${position}_mean`}
                stroke={posColor(idx)}
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );

  const renderSummary = () => {
    const gs = analysisData?.global_summary;
    return (
      <div className="tp-summary">
        {/* Global cards */}
        <div className="tp-summary__globals">
          <div className="tp-summary__gcard tp-summary__gcard--orange">
            <div className="tp-summary__gval">{gs?.total_positions_analysed ?? 0}</div>
            <div className="tp-summary__glabel">Positions Analysed</div>
          </div>
          <div className="tp-summary__gcard tp-summary__gcard--green">
            <div className="tp-summary__gval">{gs?.positions_at_steady_state ?? 0}</div>
            <div className="tp-summary__glabel">Reached Steady State</div>
          </div>
          <div className="tp-summary__gcard tp-summary__gcard--blue">
            <div className="tp-summary__gval">{gs?.time_span ?? 0}s</div>
            <div className="tp-summary__glabel">Time Span</div>
          </div>
          <div className="tp-summary__gcard tp-summary__gcard--red">
            <div className="tp-summary__gval" style={{ fontSize: '1rem' }}>
              {gs?.highest_noise_position ?? '—'}
            </div>
            <div className="tp-summary__glabel">Noisiest Position</div>
          </div>
        </div>

        {/* Trend breakdown */}
        {gs?.trend_breakdown && (
          <div className="tp-summary__trends">
            <div className="tp-summary__section-title">Trend Breakdown</div>
            <div className="tp-summary__trend-row">
              {Object.entries(gs.trend_breakdown).map(([t, n]) => (
                <div key={t} className="tp-summary__trend-item">
                  <TrendBadge trend={t} />
                  <span className="tp-summary__trend-count">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-position table */}
        <div className="tp-summary__section-title" style={{ marginTop: '1.5rem' }}>
          Per-Position Results
        </div>
        <div className="tp-pos-table-wrap">
          <table className="tp-pos-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Trend</th>
                <th>Steady State (s)</th>
                <th>Max dT/dt</th>
                <th>Min dT/dt</th>
                <th>Noise Level</th>
              </tr>
            </thead>
            <tbody>
              {shownPositions.map(({ position, trend, steady_state_time,
                                     max_rate, min_rate, noise_level }, idx) => (
                <tr key={position}>
                  <td>
                    <span className="tp-pos-dot" style={{ background: posColor(idx) }} />
                    {position}
                  </td>
                  <td><TrendBadge trend={trend} /></td>
                  <td>{steady_state_time != null ? `${steady_state_time.toFixed(2)}s` : '—'}</td>
                  <td className="tp-val--heat">{max_rate.toFixed(4)}°C/s</td>
                  <td className="tp-val--cool">{min_rate.toFixed(4)}°C/s</td>
                  <td>
                    <span className={`tp-noise ${noise_level > 0.5 ? 'tp-noise--high' : noise_level > 0.1 ? 'tp-noise--mid' : 'tp-noise--low'}`}>
                      {noise_level.toFixed(4)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────
  return (
    <div className="tp-panel">

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="tp-controls">
        {/* Position picker */}
        <div className="tp-controls__section">
          <div className="tp-controls__label">
            🎯 Positions
            <button className="tp-ctrl-link" onClick={selectAll}>All</button>
            <button className="tp-ctrl-link" onClick={clearAll}>Clear</button>
          </div>
          <div className="tp-pos-buttons">
            {allPositions.map((pos, idx) => (
              <button
                key={pos}
                onClick={() => togglePosition(pos)}
                className={`tp-pos-btn ${selectedPositions.includes(pos) ? 'tp-pos-btn--on' : 'tp-pos-btn--off'}`}
                style={selectedPositions.includes(pos)
                  ? { borderColor: posColor(idx), boxShadow: `0 0 0 1px ${posColor(idx)}40` }
                  : {}}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Rolling window */}
        <div className="tp-controls__section tp-controls__section--row">
          <div className="tp-controls__label">🔄 Rolling Window</div>
          <div className="tp-window-row">
            {[5, 10, 20, 50].map(w => (
              <button
                key={w}
                onClick={() => setRollingWindow(w)}
                className={`tp-win-btn ${rollingWindow === w ? 'tp-win-btn--on' : 'tp-win-btn--off'}`}
              >
                {w}
              </button>
            ))}
            <span className="tp-window-label">samples</span>
          </div>
        </div>

        {/* Run button */}
        <button
          className={`tp-run-btn ${loading ? 'tp-run-btn--loading' : ''}`}
          onClick={runAnalysis}
          disabled={loading}
        >
          {loading
            ? <><span className="tp-spinner" />  Analysing…</>
            : '▶ Run Temporal Analysis'}
        </button>

        {error && <div className="tp-error">⚠️ {error}</div>}
      </div>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {!ranOnce && !loading && (
        <div className="tp-empty">
          <div className="tp-empty__icon">📈</div>
          <div className="tp-empty__title">No Analysis Yet</div>
          <div className="tp-empty__hint">
            Select positions, set the rolling window, then click <strong>Run Temporal Analysis</strong>.
          </div>
        </div>
      )}

      {analysisData && (
        <>
          {/* Tab bar */}
          <div className="tp-tab-bar">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`tp-tab ${activeTab === t.key ? 'tp-tab--on' : 'tp-tab--off'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="tp-tab-content">
            {activeTab === 'lineplot'  && renderLinePlot()}
            {activeTab === 'rate'      && renderRate()}
            {activeTab === 'rolling'   && renderRolling()}
            {activeTab === 'summary'   && renderSummary()}
          </div>
        </>
      )}
    </div>
  );
};

export default TemporalPanel;