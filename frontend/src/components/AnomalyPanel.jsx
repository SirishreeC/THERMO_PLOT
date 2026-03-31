import React from 'react';
import './AnomalyPanel.css';

const AnomalyPanel = ({ data }) => {

  if (!data || !data.anomalies) {
    return (
      <div className="an-clear">
        <div className="an-clear__icon">⏳</div>
        <div className="an-clear__title">Loading...</div>
        <div className="an-clear__body">Fetching anomaly data.</div>
      </div>
    );
  }

  const { anomalies } = data;
  const positions = Object.keys(anomalies);

  if (positions.length === 0) {
    return (
      <div className="an-clear">
        <div className="an-clear__icon">✅</div>
        <div className="an-clear__title">All Clear!</div>
        <div className="an-clear__body">
          No anomalies detected. All temperature readings are within expected ranges
          across all positions.
        </div>
      </div>
    );
  }

  return (
    <div className="an-panel">
      {/* Header */}
      <div className="an-header">
        <div className="an-header__title">⚠️ Anomalies Detected</div>
        <p className="an-header__sub">
          Found {positions.length} position(s) with temperature outliers
        </p>
      </div>

      {/* Cards */}
      <div className="an-cards">
        {positions.map(pos => {
          const a = anomalies[pos];

          // ✅ Fix 2: Skip rendering if anomaly entry itself is malformed
          if (!a) return null;

          // ✅ Fix 3: Safely fall back to an empty array if outliers is missing/undefined
          const outliers = Array.isArray(a.outliers) ? a.outliers : [];

          return (
            <div key={pos} className="an-card">
              <div className="an-card__title">⚠️ {pos}</div>
              <div className="an-card__meta">
                <div className="an-card__meta-left">
                  <span className="an-card__meta-label">Outliers</span>
                  {/* ✅ Fix 4: Fall back to outliers.length if a.count is missing */}
                  <span className="an-card__meta-count">{a.count ?? outliers.length}</span>
                  <span className="an-card__meta-label">Percentage</span>
                  <span className="an-card__meta-pct">
                    {a.percentage != null ? `${a.percentage}%` : 'N/A'}
                  </span>
                </div>
                <div className="an-card__meta-right">
                  <span className="an-card__meta-lo">
                    Lower: {a.lower_bound != null ? `${a.lower_bound}°C` : 'N/A'}
                  </span>
                  <span className="an-card__meta-hi">
                    Upper: {a.upper_bound != null ? `${a.upper_bound}°C` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="an-card__outliers">
                <div className="an-card__outliers-label">Outlier Values:</div>
                <div className="an-card__outlier-list">
                  {outliers.length === 0 ? (
                    <div className="an-card__outlier-row">
                      <span style={{ color: '#94a3b8' }}>No outlier details available</span>
                    </div>
                  ) : (
                    outliers.map((o, idx) => (
                      <div key={idx} className="an-card__outlier-row">
                        {/* ✅ Fix 5: Guard o.time — may be missing or non-numeric */}
                        <span>
                          t = {o?.time != null ? Number(o.time).toFixed(2) : '?'}s
                        </span>
                        <span className="an-card__outlier-val">
                          {o?.value != null ? `${o.value}°C` : 'N/A'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* IQR explanation */}
      <div className="an-iqr">
        <div className="an-iqr__title">📐 IQR Outlier Detection Method</div>
        <div className="an-iqr__grid">
          <div className="an-iqr__box an-iqr__box--lo">
            <div className="an-iqr__box-title">Lower Bound</div>
            <div className="an-iqr__box-formula">Q1 − 1.5 × IQR</div>
            <div className="an-iqr__box-desc">
              <strong>Q1:</strong> 25th percentile (first quartile)<br />
              <strong>IQR:</strong> Interquartile range (Q3 − Q1)
            </div>
          </div>
          <div className="an-iqr__box an-iqr__box--hi">
            <div className="an-iqr__box-title">Upper Bound</div>
            <div className="an-iqr__box-formula">Q3 + 1.5 × IQR</div>
            <div className="an-iqr__box-desc">
              <strong>Q3:</strong> 75th percentile (third quartile)<br />
              <strong>Values:</strong> Outside these bounds = outliers
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnomalyPanel;