import React, { useState } from 'react';
import './HeatmapPanel.css';

const getColor = (temp) => {
  const normalized = Math.max(0, Math.min(1, (temp - 15) / (80 - 15)));
  if (normalized < 0.33) {
    const i = normalized * 3;
    return `rgb(30,${Math.round(120 + i * 135)},255)`;
  } else if (normalized < 0.66) {
    const i = (normalized - 0.33) * 3;
    return `rgb(${Math.round(255 * i)},255,${Math.round(100 - i * 100)})`;
  } else {
    const i = (normalized - 0.66) * 3;
    return `rgb(255,${Math.round(100 - i * 100)},${Math.round(50 - i * 50)})`;
  }
};

const HeatmapPanel = ({ data }) => {
  const { time_series } = data;
  const [hoveredCell, setHoveredCell] = useState(null);

  const positionNames = Array.from(
    new Set(time_series.flatMap(row => Object.keys(row).slice(1)))
  ).slice(0, 12);

  const colCount = positionNames.length + 1;   // +1 for time column
  const gridStyle = {
    gridTemplateColumns: `120px repeat(${positionNames.length}, minmax(70px, 1fr))`,
  };

  return (
    <div className="hm-panel">
      {/* Legend */}
      <div className="hm-legend">
        <div className="hm-legend__row">
          <span className="hm-legend__cold">🧊 Cold</span>
          <span className="hm-legend__hot">🔥 Hot</span>
        </div>
        <div className="hm-legend__bar" />
        <div className="hm-legend__ticks">
          <span>15°C</span><span>47°C</span><span>80°C</span>
        </div>
      </div>

      {/* Grid */}
      <div className="hm-scroll">
        <div className="hm-grid" style={gridStyle}>
          {/* Header row */}
          <div className="hm-grid__time-header">⏱️ Time (s)</div>
          {positionNames.map(pos => (
            <div key={pos} className="hm-grid__col-header">{pos}</div>
          ))}

          {/* Data rows */}
          {time_series.slice(0, 50).map((row, rowIdx) => {
            const timeKey = Object.keys(row)[0];
            const timeValue = row[timeKey];
            return (
              <React.Fragment key={rowIdx}>
                <div className="hm-grid__time-cell">
                  {parseFloat(timeValue).toFixed(2)}
                </div>
                {positionNames.map(pos => {
                  const temp = row[pos];
                  const cellKey = `${rowIdx}-${pos}`;
                  return (
                    <div
                      key={cellKey}
                      className="hm-grid__cell"
                      style={{ backgroundColor: getColor(temp) }}
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {temp?.toFixed(0) ?? '--'}
                      {hoveredCell === cellKey && (
                        <div className="hm-tooltip">
                          🌡️ {pos}: {temp?.toFixed(2)}°C
                          <div className="hm-tooltip__sub">t = {parseFloat(timeValue).toFixed(2)}s</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {time_series.length > 50 && (
        <div className="hm-notice">
          📋 Showing first 50 time steps ({time_series.length - 50} more available)
        </div>
      )}
    </div>
  );
};

export default HeatmapPanel;