import React from 'react';
import './StatisticsPanel.css';

const StatisticsPanel = ({ data }) => {
  if (!data || !data.metadata || !data.statistics) {
    return (
      <div className="sp-empty">
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Data Yet</div>
        <div style={{ fontSize: '1rem', opacity: 0.7 }}>Upload an Excel file to see statistics</div>
      </div>
    );
  }

  const { metadata, statistics } = data;

  const cvClass = (cv) =>
    cv > 30 ? 'sp-badge sp-badge--high' :
    cv > 15 ? 'sp-badge sp-badge--mid'  :
              'sp-badge sp-badge--low';

  return (
    <div className="sp-panel">
      {/* Quality summary */}
      <div className="sp-quality">
        <h3 className="sp-quality__title">📊 Data Quality Overview</h3>
        <div className="sp-quality__grid">
          <div className="sp-quality__item">
            <div className="sp-quality__value sp-quality__value--normal">
              {metadata.rows?.toLocaleString?.() ?? '0'}
            </div>
            <div className="sp-quality__label">Time Points</div>
          </div>
          <div className="sp-quality__item">
            <div className={`sp-quality__value ${metadata.missing_values > 0 ? 'sp-quality__value--warning' : 'sp-quality__value--ok'}`}>
              {metadata.missing_values?.toLocaleString?.() ?? '0'}
            </div>
            <div className="sp-quality__label">Missing Values</div>
          </div>
          <div className="sp-quality__item">
            <div className="sp-quality__value sp-quality__value--ok">
              {metadata.completeness ?? 0}%
            </div>
            <div className="sp-quality__label">Completeness</div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="sp-cards">
        {Object.entries(statistics ?? {}).map(([posName, stats = {}]) => (
          <div key={posName} className="sp-card">
            <div className="sp-card__title">📊 {posName}</div>
            <div className="sp-card__rows">
              <div className="sp-card__row">
                <span className="sp-card__row-label">Mean</span>
                <span className="sp-card__row-val sp-card__row-val--mean">{stats.mean ?? 0}°C</span>
              </div>
              <div className="sp-card__row">
                <span className="sp-card__row-label">Median</span>
                <span className="sp-card__row-val">{stats.median ?? 0}°C</span>
              </div>
              <div className="sp-card__row">
                <span className="sp-card__row-label">Std Dev</span>
                <span className="sp-card__row-val">{stats.std ?? 0}°C</span>
              </div>
              <div className="sp-card__row">
                <span className="sp-card__row-label">Min</span>
                <span className="sp-card__row-val sp-card__row-val--min">{stats.min ?? 0}°C</span>
              </div>
              <div className="sp-card__row">
                <span className="sp-card__row-label">Max</span>
                <span className="sp-card__row-val sp-card__row-val--max">{stats.max ?? 0}°C</span>
              </div>
              <div className="sp-card__row">
                <span className="sp-card__row-label">Range</span>
                <span className="sp-card__row-val">{stats.range ?? 0}°C</span>
              </div>
              <div className="sp-card__row">
                <span className="sp-card__row-label">CV</span>
                <span className={cvClass(stats.cv ?? 0)}>{stats.cv ?? 0}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatisticsPanel;