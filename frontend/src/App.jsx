import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MemberDashboard from './pages/MemberDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TreasurerDashboard from './pages/TreasurerDashboard';
import LoanOfficerDashboard from './pages/LoanOfficerDashboard';
import ChairpersonDashboard from './pages/ChairpersonDashboard';
import { Unauthorized, NotFound, ServerError } from './pages/ErrorPages';
import api from './api';

const INACTIVITY_LIMIT = 5 * 60 * 1000; 

// 1. We remove the "ROUTES" constant entirely.
// No more secret strings to guess.

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogout = useCallback(async () => {
    console.log("Logging out...");
    try {
        await api.post('/api/auth/logout'); 
    } catch (error) {
        console.error("Logout error", error);
    }
    
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }, []);

  // Inactivity Timer Logic
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

  // 2. The Internal "Traffic Cop" Component
  // This decides what to show based on the User object in memory, not the URL.
  const DashboardController = () => {
    if (!user) return <Navigate to="/" replace />;

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
        {/* Public Login Route */}
        <Route 
          path="/" 
          element={!user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" />} 
        />
        
        {/* 3. The Unified Secure Route */}
        {/* Everyone goes to /dashboard. What they see depends on who they are. */}
        <Route path="/dashboard" element={<DashboardController />} />
        
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