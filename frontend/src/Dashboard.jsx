import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8000';

const Dashboard = () => {
  const token = localStorage.getItem('token') || '';

  const [stats,   setStats]   = useState({
    total_files: 0, total_analyses: 0, active_projects: 0, total_projects: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/dashboard/stats`, { params: { token } });
        setStats(res.data);
      } catch {

      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  const cards = [
    { value: stats.total_files,     label: 'Total Files'      },
    { value: stats.total_analyses,  label: 'Total Analyses'   },
    { value: stats.active_projects, label: 'Active Projects'  },
    { value: stats.total_projects,  label: 'Total Projects'   }, 
  ];

  return (
    <>
      <div className="welcome-section">
        <h1 className="welcome-title">Welcome to Dashboard</h1>
        <p style={{ fontSize: '20px', opacity: 0.9 }}>
          Integrated Thermal Research Platform
        </p>
      </div>

      <div className="stats-grid">
        {cards.map(({ value, label }) => (
          <div className="stat-card" key={label}>
            <h3 className="stat-number">{loading ? '…' : value}</h3>
            <p className="stat-label">{label}</p>
          </div>
        ))}
      </div>
    </>
  );
};

export default Dashboard;