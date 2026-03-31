import React, { useState, useMemo } from 'react';
import './SpatialPanel.css';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip);

const SpatialPanel = ({ data }) => {
  // ── Safely extract fields from whatever the backend sends ──────────────────
  const metadata       = data?.metadata       || {};
  const timeSeries     = data?.time_series     || [];
  const positionNames  = metadata?.position_names || [];

  // Build snapshots: sample every N rows so we get ≤20 snapshot buttons
  const snapshots = useMemo(() => {
    if (!timeSeries.length || !positionNames.length) return [];
    const step = Math.max(1, Math.floor(timeSeries.length / 20));
    return timeSeries.filter((_, i) => i % step === 0);
  }, [timeSeries, positionNames]);

  const timeCol = metadata?.time_column || Object.keys(snapshots[0] || {})[0] || 'time';

  const [activeIdx, setActiveIdx] = useState(0);

  const charts = useMemo(() =>
    snapshots.map(snapshot => {
      const temps = positionNames.map(p => snapshot[p] ?? null);
      return {
        time: snapshot[timeCol] ?? 0,
        chartData: {
          labels: positionNames,
          datasets: [{
            label: 'Temp (°C)',
            data: temps,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
            tension: 0.4,
            pointRadius: 7,
            pointHoverRadius: 11,
            pointBackgroundColor: '#f97316',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            fill: true,
            borderWidth: 3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.95)',
              callbacks: { label: ctx => `${ctx.parsed.y?.toFixed(2)}°C` },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Position', color: '#94a3b8',
                       font: { family: 'JetBrains Mono', size: 11 } },
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' },
                       maxRotation: 45, minRotation: 45 },
            },
            y: {
              title: { display: true, text: 'Temperature (°C)', color: '#94a3b8',
                       font: { family: 'JetBrains Mono', size: 11 } },
              grid: { color: 'rgba(71,85,105,0.2)' },
              ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' },
                       callback: v => v + '°C' },
            },
          },
        },
      };
    }),
    [snapshots, positionNames, timeCol]
  );

  const insights = useMemo(() => {
    if (!snapshots.length || !positionNames.length) return { gradient: '—', hotspot: '—', range: '—' };
    const snap  = snapshots[activeIdx] || snapshots[0];
    const temps = positionNames.map(p => snap[p] ?? 0).filter(v => v !== null && !isNaN(v));
    if (!temps.length) return { gradient: '—', hotspot: '—', range: '—' };
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const hotIdx  = temps.indexOf(maxTemp);
    return {
      gradient: `${((maxTemp - minTemp) / Math.max(positionNames.length, 1)).toFixed(2)}°C/pos`,
      hotspot:  positionNames[hotIdx] ?? '—',
      range:    `${minTemp.toFixed(1)}°C – ${maxTemp.toFixed(1)}°C`,
    };
  }, [snapshots, activeIdx, positionNames]);

  // ── Guard: no data yet ─────────────────────────────────────────────────────
  if (!positionNames.length || !snapshots.length) {
    return (
      <div className="sp2-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
        <p style={{ fontFamily: 'JetBrains Mono, monospace' }}>No spatial data available.</p>
      </div>
    );
  }

  const active = charts[activeIdx] || charts[0];

  return (
    <div className="sp2-panel">

      {/* Snapshot selector */}
      <div className="sp2-snapshot-bar">
        <h3 className="sp2-snapshot-bar__title">
          🗺️ Spatial Snapshots — t = {Number(active?.time ?? 0).toFixed(2)}s
        </h3>
        <div className="sp2-snapshot-scroll">
          {charts.map((c, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`sp2-snap-btn ${idx === activeIdx ? 'sp2-snap-btn--on' : 'sp2-snap-btn--off'}`}
            >
              t = {Number(c.time).toFixed(2)}s
            </button>
          ))}
        </div>
      </div>

      {/* Chart + insights */}
      <div className="sp2-grid">
        <div className="sp2-chart-box">
          <h4 className="sp2-chart-box__title">Spatial Temperature Gradient</h4>
          <div className="sp2-chart-inner">
            <Line data={active.chartData} options={active.options} />
          </div>
        </div>

        <div className="sp2-insights">
          <div className="sp2-insight sp2-insight--hot">
            <div className="sp2-insight__label">🔥 Hotspot</div>
            <div className="sp2-insight__value">{insights.hotspot}</div>
            <div className="sp2-insight__sub">{insights.range}</div>
          </div>
          <div className="sp2-insight sp2-insight--grad">
            <div className="sp2-insight__label">📏 Gradient Analysis</div>
            <div className="sp2-insight__rows">
              <div>Gradient: <span>{insights.gradient}</span></div>
              <div>Max ΔT: <span>{insights.range}</span></div>
              <div>Positions: <span style={{ color: '#34d399' }}>{positionNames.length}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Patterns */}
      <div className="sp2-patterns">
        <div className="sp2-patterns__title">🎯 Spatial Patterns Detected</div>
        <div className="sp2-patterns__grid">
          <div className="sp2-pattern-item sp2-pattern-item--green">
            <div className="sp2-pattern-item__icon">📈</div>
            <div className="sp2-pattern-item__name">Spatial Gradient</div>
            <div className="sp2-pattern-item__desc">Temperature varies across {positionNames.length} positions</div>
          </div>
          <div className="sp2-pattern-item sp2-pattern-item--orange">
            <div className="sp2-pattern-item__icon">🔥</div>
            <div className="sp2-pattern-item__name">Localized Heating</div>
            <div className="sp2-pattern-item__desc">{insights.hotspot} shows peak temperature</div>
          </div>
          <div className="sp2-pattern-item sp2-pattern-item--blue">
            <div className="sp2-pattern-item__icon">📏</div>
            <div className="sp2-pattern-item__name">{insights.gradient}</div>
            <div className="sp2-pattern-item__desc">Avg temperature gradient per position</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SpatialPanel;