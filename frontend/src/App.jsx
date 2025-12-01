import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

  // Unified Dashboard Controller
  // This component decides what to render based on the user's role.
  // The URL remains "/portal/..." for everyone, hiding the role.
  const DashboardController = () => {
    const location = useLocation();
    
    if (!user) return <Navigate to="/" replace />;

    // Pass the current sub-path logic down if needed, or let components handle it
    const commonProps = { user, onLogout };

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
        
        {/* Secure Unified Route */}
        {/* We use "/portal/*" to allow sub-paths like /portal/wx-99 */}
        <Route path="/portal/*" element={<DashboardController />} />
        
        {/* Error Routes */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/server-error" element={<ServerError />} />
        <Route path="/not-found" element={<NotFound />} />
        
        <Route path="*" element={<Navigate to="/not-found" />} />
      </Routes>
    </Router>
  );
}