import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Pages
import Login from './pages/Login';
import MemberDashboard from './pages/MemberDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TreasurerDashboard from './pages/TreasurerDashboard';
import LoanOfficerDashboard from './pages/LoanOfficerDashboard';
import ChairpersonDashboard from './pages/ChairpersonDashboard';

// Initialization Pages
import SetupUsers from './pages/SetupUsers';
import ChangePassword from './pages/ChangePassword';

// Error Pages
import { Unauthorized, NotFound, ServerError } from './pages/ErrorPages';
import api from './api';

const INACTIVITY_LIMIT = 5 * 60 * 1000; 

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) { return null; }
  });

  const handleLogout = useCallback(async () => {
    console.log("Logging out...");
    try { await api.post('/api/auth/logout'); } catch (error) { console.error(error); }
    
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }, []);

  // --- NEW: Dynamic Branding (Favicon & Title) ---
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await api.get('/api/settings/branding');
        const settings = res.data || [];

        // 1. Set Page Title (Sacco Name)
        const nameSetting = settings.find(s => s.setting_key === 'sacco_name');
        if (nameSetting && nameSetting.setting_value) {
          document.title = nameSetting.setting_value;
        }

        // 2. Set Favicon
        const favSetting = settings.find(s => s.setting_key === 'sacco_favicon');
        if (favSetting && favSetting.setting_value) {
          const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
          link.type = 'image/png'; // Or detect type if needed
          link.rel = 'icon';
          link.href = favSetting.setting_value;
          document.getElementsByTagName('head')[0].appendChild(link);
        }
      } catch (err) {
        console.warn("Branding sync failed", err);
      }
    };
    fetchBranding();
  }, []);

  // Inactivity Timer
  useEffect(() => {
    if (!user) return;
    let timeoutId;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert("For your security, you have been logged out due to inactivity.");
        handleLogout();
      }, INACTIVITY_LIMIT);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user, handleLogout]);

  // --- UNIFIED DASHBOARD CONTROLLER ---
  const DashboardController = () => {
    const location = useLocation();

    // 1. Authentication Check
    if (!user) return <Navigate to="/" replace />;

    // 2. Security Check: Force Password Change
    if (user.mustChangePassword) {
        return <Navigate to="/change-password" replace />;
    }

    // 3. Role-Based Rendering
    const commonProps = { user, onLogout: handleLogout };

    switch (user.role) {
      case 'ADMIN': return <AdminDashboard {...commonProps} />;
      case 'CHAIRPERSON': return <ChairpersonDashboard {...commonProps} />;
      case 'SECRETARY': return <SecretaryDashboard {...commonProps} />;
      case 'TREASURER': return <TreasurerDashboard {...commonProps} />;
      case 'LOAN_OFFICER': return <LoanOfficerDashboard {...commonProps} />;
      case 'MEMBER': return <MemberDashboard {...commonProps} />;
      default: return <Navigate to="/unauthorized" />;
    }
  };

  return (
    <Router>
      <Routes>
        {/* Public Login */}
        <Route 
          path="/" 
          element={!user ? <Login setUser={setUser} /> : <Navigate to="/portal" />} 
        />
        
        {/* --- INITIALIZATION ROUTES --- */}
        <Route 
            path="/change-password" 
            element={user ? <ChangePassword onPasswordChanged={() => {
                const updated = { ...user, mustChangePassword: false };
                setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated));
            }}/> : <Navigate to="/" />} 
        />

        <Route 
            path="/setup-users" 
            element={user?.role === 'ADMIN' ? <SetupUsers /> : <Navigate to="/portal" />} 
        />

        {/* --- SECURE UNIFIED ROUTE --- */}
        {/* This keeps your URL structure as /portal/ for everyone */}
        <Route path="/portal/*" element={<DashboardController />} />
        
        {/* Error Routes */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/server-error" element={<ServerError />} />
        <Route path="/not-found" element={<NotFound />} />
        
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/not-found" />} />
      </Routes>
    </Router>
  );
}