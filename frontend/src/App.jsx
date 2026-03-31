// frontend/src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthPage       from './AuthPage';
import Dashboard      from './Dashboard';
import Search         from './Dash_elements/Search';
import Upload         from './Dash_elements/Upload';
import Projects       from './Dash_elements/Projects';
import DataVisual     from './Dash_elements/data_visual';
import Exports        from './Dash_elements/Exports';
import Settings       from './Dash_elements/Settings';
import DashboardLayout from './layouts/DashboardLayout';

function App() {
  return (
    <Routes>
      {/* No sidebar */}
      <Route path="/" element={<AuthPage />} />

      {/* With sidebar */}
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard"   element={<Dashboard />}  />
        <Route path="/search"      element={<Search />}     />
        <Route path="/upload"      element={<Upload />}     />
        <Route path="/projects"    element={<Projects />}   />
        <Route path="/data_visual" element={<DataVisual />} />
        <Route path="/exports"     element={<Exports />}    />
        <Route path="/settings"    element={<Settings />}   />
      </Route>
    </Routes>
  );
}

export default App;