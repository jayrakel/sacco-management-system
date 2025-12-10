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
import SetupUsers from './pages/SetupUsers';
import ChangePassword from './pages/ChangePassword';
import VerifyEmail from './pages/VerifyEmail'; 
// import VerifyPhone from './pages/VerifyPhone'; // [MUTED]
import GroupWebsite from './pages/GroupWebsite';

import { Unauthorized, NotFound, ServerError } from './pages/ErrorPages';
import api from './api';

const INACTIVITY_LIMIT = 5 * 60 * 1000; 

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('sacco_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) { return null; }
  });

  const handleLogout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch (error) { console.error(error); }
    setUser(null);
    localStorage.removeItem('sacco_user');
  }, []);

  useEffect(() => {
    const init = async () => {
        try {
            const res = await api.get('/api/settings/branding');
            const name = res.data.find(s => s.setting_key === 'sacco_name');
            if (name) document.title = name.setting_value;
        } catch (e) {}
    };
    init();

    if (user) {
        let timer;
        const reset = () => {
            clearTimeout(timer);
            timer = setTimeout(() => handleLogout(), INACTIVITY_LIMIT);
        };
        ['click', 'mousemove', 'keydown'].forEach(e => window.addEventListener(e, reset));
        reset();
        return () => clearTimeout(timer);
    }
  }, [user, handleLogout]);

  // --- DASHBOARD ROUTER ---
  const DashboardController = () => {
    const location = useLocation();

    if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
    
    // [MUTED] Phone Check
    // if (user.isPhoneVerified === false) return <Navigate to="/verify-phone" replace />;

    // --- PASSWORD CHANGE CHECK ---
    if (user.mustChangePassword) return <Navigate to="/change-password" replace />;

    switch (user.role) {
      case 'ADMIN': return <AdminDashboard user={user} onLogout={handleLogout} />;
      case 'CHAIRPERSON': return <ChairpersonDashboard user={user} onLogout={handleLogout} />;
      case 'SECRETARY': return <SecretaryDashboard user={user} onLogout={handleLogout} />;
      case 'TREASURER': return <TreasurerDashboard user={user} onLogout={handleLogout} />;
      case 'LOAN_OFFICER': return <LoanOfficerDashboard user={user} onLogout={handleLogout} />;
      case 'MEMBER': return <MemberDashboard user={user} onLogout={handleLogout} />;
      default: return <Navigate to="/unauthorized" />;
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/portal" />} />
        <Route path="/" element={<GroupWebsite />} />
        
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/portal/verify-email" element={<Navigate to="/verify-email" />} />

        <Route path="/setup" element={<SetupUsers />} />

        {/* [MUTED] Route */}
        {/* <Route path="/verify-phone" element={user ? <VerifyPhone user={user} onLogout={handleLogout}/> : <Navigate to="/login" />} /> */}

        <Route path="/change-password" element={user ? <ChangePassword user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />

        <Route path="/portal/*" element={<DashboardController />} />
        
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}