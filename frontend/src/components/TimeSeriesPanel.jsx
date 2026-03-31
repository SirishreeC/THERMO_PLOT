import React, { useState, useMemo } from 'react';
import './TimeSeriesPanel.css';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const TimeSeriesPanel = ({ data }) => {
  const { time_series } = data;
  const [selectedPositions, setSelectedPositions] = useState([]);

  const positionNames = useMemo(() =>
    Array.from(new Set(time_series.flatMap(row => Object.keys(row).slice(1)))).slice(0, 15),
    [time_series]
  );

  const togglePosition = (pos) => {
    setSelectedPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos].slice(0, 6)
    );
  };

  const chartData = useMemo(() => ({
    labels: time_series.slice(0, 100).map(row => {
      const k = Object.keys(row)[0];
      return parseFloat(row[k]).toFixed(2);
    }),
    datasets: selectedPositions.map((pos, idx) => ({
      label: pos,
      data: time_series.slice(0, 100).map(row => row[pos] ?? null),
      borderColor: `hsl(${(idx * 60) % 360},70%,55%)`,
      backgroundColor: `hsla(${(idx * 60) % 360},70%,55%,0.12)`,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 8,
      borderWidth: 3,
      pointBackgroundColor: `hsl(${(idx * 60) % 360},70%,55%)`,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    })),
  }), [time_series, selectedPositions]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: {
        position: 'top',
        labels: { usePointStyle: true, padding: 18, color: '#e5e7eb',
                  font: { family: 'JetBrains Mono', size: 11 } },
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.95)',
        titleColor: '#f8fafc', bodyColor: '#f8fafc', cornerRadius: 10,
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}°C`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Time (s)', color: '#94a3b8',
                 font: { family: 'JetBrains Mono', size: 12 } },
        grid: { color: 'rgba(71,85,105,0.2)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } },
      },
      y: {
        title: { display: true, text: 'Temperature (°C)', color: '#94a3b8',
                 font: { family: 'JetBrains Mono', size: 12 } },
        grid: { color: 'rgba(71,85,105,0.2)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' },
                 callback: v => v + '°C' },
      },
    },
    animation: { duration: 1600, easing: 'easeInOutQuart' },
  };

  return (
    <div className="ts-panel">
      <div className="ts-selector">
        <h3 className="ts-selector__title">🎯 Select Positions (max 6)</h3>
        <div className="ts-selector__buttons">
          {positionNames.map(pos => (
            <button
              key={pos}
              onClick={() => togglePosition(pos)}
              className={`ts-btn ${selectedPositions.includes(pos) ? 'ts-btn--on' : 'ts-btn--off'}`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="ts-chart">
        {selectedPositions.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="ts-empty">
            <div className="ts-empty__icon">📈</div>
            <div className="ts-empty__title">No Positions Selected</div>
            <div className="ts-empty__hint">Click position buttons above to view time series data</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeSeriesPanel;