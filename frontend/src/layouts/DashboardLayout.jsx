import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '../Dashboard.css';

const NAV_ITEMS = [
  { icon: '🏠', label: 'Dashboard',       path: '/dashboard'   },
  { icon: '🔍', label: 'Search',           path: '/search'      },
  { icon: '📁', label: 'Upload Files',     path: '/upload'      },
  { icon: '📋', label: 'Projects',         path: '/projects'    },
  { icon: '🔥', label: 'Thermal Analysis', path: '/data_visual' },
  { icon: '📄', label: 'Doc Exports',      path: '/exports'     },

];

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user,       setUser]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile,   setIsMobile]   = useState(window.innerWidth <= 768);

  /* ── fetch user ── */
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/'); return; }
        const res = await axios.get('http://127.0.0.1:8000/user', { params: { token } });
        setUser(res.data);
      } catch {
        localStorage.removeItem('token');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  /* ── track screen size ── */
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  /* ── close mobile drawer on route change ── */
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleHamburger = () => {
    if (isMobile) setMobileOpen(prev => !prev);
    else          setCollapsed(prev => !prev);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">Loading…</div>
      </div>
    );
  }

  const displayName = user?.full_name || user?.username || 'User';
  const shortName   = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const sidebarOpen = isMobile ? mobileOpen : !collapsed;

  return (
    <div className={`dashboard-container ${collapsed && !isMobile ? 'sidebar-collapsed' : ''}`}>

      {/* Backdrop — mobile only */}
      {mobileOpen && isMobile && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* ══════ HAMBURGER — always visible on all screens ══════ */}
      <button
        className={`hamburger-btn ${sidebarOpen ? 'is-open' : ''}`}
        onClick={handleHamburger}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <span className="ham-line" />
        <span className="ham-line" />
        <span className="ham-line" />
      </button>

      {/* ══════ SIDEBAR ══════ */}
      <aside className={`sidebar ${mobileOpen && isMobile ? 'mobile-open' : ''}`}>

        {/* Logo + company name */}
        <div className="logo-section">
          <div className="dashboard-header-company">
            <img src="/logo.jpg" alt="ITR Logo" className="dashboard-logo" />
            <div className="company-text">
              <h1 className="company-name">INTEGRATED THERMAL RESEARCH</h1>
            </div>
          </div>
        </div>

        {/* Product title */}
        <h2 className="dashboard-product-title">
          <span className="title-full">THERMOPLOT</span>
          <span className="title-short">TP</span>
        </h2>

        {/* User info */}
        <div className="user-info">
          <div className="user-avatar">{shortName}</div>
          <div className="user-details">
            <div className="user-name">👤 {displayName}</div>
            <div className="user-welcome">Welcome back!</div>
          </div>
        </div>

        {/* Nav menu — labels always visible */}
        <nav className="sidebar-menu">
          {NAV_ITEMS.map(({ icon, label, path }) => (
            <button
              key={path}
              className={`sidebar-btn ${location.pathname === path ? 'active' : ''}`}
              onClick={() => navigate(path)}
              title={label}
            >
              <span className="btn-icon">{icon}</span>
              <span className="btn-label">{label}</span>
            </button>
          ))}
          <button className="sidebar-btn logout-btn" onClick={handleLogout} title="Logout">
            <span className="btn-icon">🚪</span>
            <span className="btn-label">Logout</span>
          </button>
        </nav>
      </aside>

      {/* ══════ MAIN CONTENT ══════ */}
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;