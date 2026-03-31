import React, { useMemo, useState, useRef, useEffect } from 'react';
import './CorrelationPanel.css';

/* ─── helpers ─────────────────────────────────────────────────── */
const pearson = (a, b) => {
  const n = a.length;
  if (n === 0) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; dA += da * da; dB += db * db;
  }
  return dA === 0 || dB === 0 ? 0 : num / Math.sqrt(dA * dB);
};

const corrColor = (r) => {
  // negative → blue, zero → dark, positive → orange/red
  if (r > 0) {
    const t = r;
    const red   = Math.round(249 * t);
    const green = Math.round(115 * t);
    const blue  = Math.round(22  * t);
    return `rgba(${red},${green},${blue},${0.15 + Math.abs(r) * 0.85})`;
  } else {
    const t = Math.abs(r);
    return `rgba(59,${Math.round(130 * (1 - t))},246,${0.15 + t * 0.85})`;
  }
};

const textColor = (r) => {
  const abs = Math.abs(r);
  if (abs < 0.2) return 'rgba(148,163,184,0.7)';
  if (r > 0)     return abs > 0.6 ? '#fff' : '#fdba74';
  return abs > 0.6 ? '#fff' : '#93c5fd';
};

/* ─── component ───────────────────────────────────────────────── */
const CorrelationPanel = ({ data }) => {
  const { time_series } = data;
  const canvasRef = useRef(null);
  const [hovered, setHovered] = useState(null);   // {r, c, val}
  const [sortBy, setSortBy]   = useState('name');  // 'name' | 'variance'
  const [threshold, setThreshold] = useState(0);   // show only |r| >= threshold

  /* position names */
  const positions = useMemo(() => {
    const s = new Set();
    time_series.forEach(row => Object.keys(row).slice(1).forEach(k => s.add(k)));
    return Array.from(s);
  }, [time_series]);

  /* series data */
  const series = useMemo(() =>
    Object.fromEntries(
      positions.map(pos => [pos, time_series.map(row => parseFloat(row[pos] ?? NaN)).filter(v => !isNaN(v))])
    ),
    [positions, time_series]
  );

  /* variance per position (for sort) */
  const variances = useMemo(() => {
    const v = {};
    positions.forEach(pos => {
      const vals = series[pos];
      const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
      v[pos] = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length;
    });
    return v;
  }, [positions, series]);

  /* sorted positions */
  const sortedPositions = useMemo(() => {
    const p = [...positions];
    if (sortBy === 'variance') p.sort((a, b) => variances[b] - variances[a]);
    else p.sort();
    return p;
  }, [positions, sortBy, variances]);

  /* full correlation matrix */
  const matrix = useMemo(() => {
    const n = sortedPositions.length;
    const mat = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = i; j < n; j++) {
        const r = i === j ? 1 : pearson(series[sortedPositions[i]], series[sortedPositions[j]]);
        mat[i][j] = r; mat[j][i] = r;
      }
    return mat;
  }, [sortedPositions, series]);

  /* top correlations list */
  const topPairs = useMemo(() => {
    const pairs = [];
    const n = sortedPositions.length;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        pairs.push({ a: sortedPositions[i], b: sortedPositions[j], r: matrix[i][j] });
    pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
    return pairs.slice(0, 8);
  }, [matrix, sortedPositions]);

  /* stats */
  const stats = useMemo(() => {
    const vals = [];
    const n = sortedPositions.length;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) vals.push(matrix[i][j]);
    if (!vals.length) return {};
    const strong = vals.filter(v => Math.abs(v) >= 0.8).length;
    const moderate = vals.filter(v => Math.abs(v) >= 0.5 && Math.abs(v) < 0.8).length;
    const weak = vals.filter(v => Math.abs(v) < 0.5).length;
    const avg = vals.reduce((s, v) => s + Math.abs(v), 0) / vals.length;
    return { total: vals.length, strong, moderate, weak, avg };
  }, [matrix, sortedPositions]);

  const n = sortedPositions.length;

  return (
    <div className="corr-panel">

      {/* ── Header ─────────────────────────────────── */}
      <div className="corr-header">
        <div className="corr-title-block">
          <span className="corr-icon">⚡</span>
          <div>
            <h2 className="corr-title">Correlation Matrix</h2>
            <p className="corr-sub">Pearson r between all position temperature series</p>
          </div>
        </div>

        <div className="corr-controls">
          <div className="ctrl-group">
            <span className="ctrl-label">Sort positions by</span>
            <div className="seg-buttons">
              <button className={`seg-btn ${sortBy === 'name' ? 'active' : ''}`} onClick={() => setSortBy('name')}>Name</button>
              <button className={`seg-btn ${sortBy === 'variance' ? 'active' : ''}`} onClick={() => setSortBy('variance')}>Variance ↓</button>
            </div>
          </div>
          <div className="ctrl-group">
            <span className="ctrl-label">Min |r| shown: <b className="ctrl-val">{threshold.toFixed(2)}</b></span>
            <input type="range" min={0} max={0.99} step={0.01} value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))} className="corr-slider" />
          </div>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────── */}
      <div className="corr-stats-row">
        <div className="corr-stat-chip">
          <span className="csc-val orange">{stats.strong ?? 0}</span>
          <span className="csc-lbl">Strong |r| ≥ 0.8</span>
        </div>
        <div className="corr-stat-chip">
          <span className="csc-val yellow">{stats.moderate ?? 0}</span>
          <span className="csc-lbl">Moderate 0.5–0.8</span>
        </div>
        <div className="corr-stat-chip">
          <span className="csc-val muted">{stats.weak ?? 0}</span>
          <span className="csc-lbl">Weak &lt; 0.5</span>
        </div>
        <div className="corr-stat-chip">
          <span className="csc-val blue">{(stats.avg ?? 0).toFixed(3)}</span>
          <span className="csc-lbl">Avg |r|</span>
        </div>
        <div className="corr-stat-chip">
          <span className="csc-val green">{n}</span>
          <span className="csc-lbl">Positions</span>
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────── */}
      <div className="corr-legend-row">
        <span className="leg-item blue-dot">● Strong negative (−1)</span>
        <span className="leg-item muted-dot">● Near zero (0)</span>
        <span className="leg-item orange-dot">● Strong positive (+1)</span>
        <div className="leg-gradient" />
        <div className="leg-ticks">
          <span>−1</span><span>−0.5</span><span>0</span><span>+0.5</span><span>+1</span>
        </div>
      </div>

      {/* ── Matrix ─────────────────────────────────── */}
      <div className="corr-matrix-wrapper">
        <div className="corr-matrix-scroll">
          <table className="corr-table" style={{ '--n': n }}>
            <thead>
              <tr>
                <th className="corr-corner">pos ↓ / pos →</th>
                {sortedPositions.map(pos => (
                  <th key={pos} className="corr-col-header">
                    <span className="col-label">{pos}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPositions.map((rowPos, ri) => (
                <tr key={rowPos}>
                  <td className="corr-row-header">{rowPos}</td>
                  {sortedPositions.map((colPos, ci) => {
                    const r = matrix[ri]?.[ci] ?? 0;
                    const abs = Math.abs(r);
                    const show = ri === ci || abs >= threshold;
                    const isHov = hovered && (hovered.r === ri || hovered.c === ci);
                    const isSelf = ri === ci;
                    return (
                      <td
                        key={colPos}
                        className={`corr-cell ${isSelf ? 'self' : ''} ${isHov ? 'highlight' : ''} ${!show ? 'hidden' : ''}`}
                        style={show ? {
                          backgroundColor: isSelf ? 'rgba(249,115,22,0.25)' : corrColor(r),
                          color: isSelf ? '#f97316' : textColor(r),
                        } : {}}
                        onMouseEnter={() => setHovered({ r: ri, c: ci, val: r, posA: rowPos, posB: colPos })}
                        onMouseLeave={() => setHovered(null)}
                      >
                        {isSelf ? '—' : show ? r.toFixed(2) : '·'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Hover tooltip inside matrix area */}
        {hovered && hovered.r !== hovered.c && (
          <div className="corr-hover-info">
            <span className="chi-pair">{hovered.posA} × {hovered.posB}</span>
            <span className="chi-r" style={{ color: hovered.val >= 0 ? '#f97316' : '#60a5fa' }}>
              r = {hovered.val.toFixed(4)}
            </span>
            <span className="chi-strength">
              {Math.abs(hovered.val) >= 0.8 ? '🔴 Strong' :
               Math.abs(hovered.val) >= 0.5 ? '🟡 Moderate' :
               Math.abs(hovered.val) >= 0.2 ? '🟢 Weak' : '⚪ Negligible'}
            </span>
          </div>
        )}
      </div>

      {/* ── Top Pairs ──────────────────────────────── */}
      <div className="corr-top-section">
        <h3 className="top-title">🏆 Top Correlated Pairs</h3>
        <div className="top-pairs-grid">
          {topPairs.map(({ a, b, r }, idx) => (
            <div key={`${a}-${b}`} className={`top-pair-card ${r >= 0 ? 'pos' : 'neg'}`}>
              <div className="tpc-rank">#{idx + 1}</div>
              <div className="tpc-names">
                <span>{a}</span>
                <span className="tpc-arrow">{r >= 0 ? '⇄' : '⇅'}</span>
                <span>{b}</span>
              </div>
              <div className="tpc-r" style={{ color: r >= 0 ? '#f97316' : '#60a5fa' }}>
                {r.toFixed(4)}
              </div>
              <div className="tpc-bar-track">
                <div
                  className={`tpc-bar-fill ${r >= 0 ? 'bar-pos' : 'bar-neg'}`}
                  style={{ width: `${Math.abs(r) * 100}%` }}
                />
              </div>
              <div className="tpc-label">
                {Math.abs(r) >= 0.8 ? 'Strong' : Math.abs(r) >= 0.5 ? 'Moderate' : 'Weak'}
                {r >= 0 ? ' positive' : ' negative'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Interpretation Guide ───────────────────── */}
      <div className="corr-guide">
        <h3 className="guide-title">📐 Interpretation Guide</h3>
        <div className="guide-grid">
          <div className="guide-card">
            <div className="gc-badge orange">|r| ≥ 0.8</div>
            <div className="gc-head">Strong Correlation</div>
            <div className="gc-body">Positions heat/cool together — likely same thermal zone or direct conduction path</div>
          </div>
          <div className="guide-card">
            <div className="gc-badge yellow">0.5 ≤ |r| &lt; 0.8</div>
            <div className="gc-head">Moderate Correlation</div>
            <div className="gc-body">Partial thermal coupling — influenced by same source but with lag or loss</div>
          </div>
          <div className="guide-card">
            <div className="gc-badge muted">|r| &lt; 0.5</div>
            <div className="gc-head">Weak / No Correlation</div>
            <div className="gc-body">Thermally independent positions — different heat sources or well-isolated regions</div>
          </div>
          <div className="guide-card">
            <div className="gc-badge blue">r &lt; 0</div>
            <div className="gc-head">Negative Correlation</div>
            <div className="gc-body">Inverse relationship — when one heats up, the other cools (e.g. heat sink behaviour)</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default CorrelationPanel;
