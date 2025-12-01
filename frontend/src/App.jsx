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

// --- INTERNAL COMPONENT (Defined Outside App to prevent crashes) ---
const DashboardController = ({ user, onLogout }) => {
    // If not logged in, kick out immediately
    if (!user) return <Navigate to="/" replace />;

    // Render based on Role
    switch (user.role) {
      case 'ADMIN': return <AdminDashboard user={user} onLogout={onLogout} />;
      case 'CHAIRPERSON': return <ChairpersonDashboard user={user} onLogout={onLogout} />;
      case 'SECRETARY': return <SecretaryDashboard user={user} onLogout={onLogout} />;
      case 'TREASURER': return <TreasurerDashboard user={user} onLogout={onLogout} />;
      case 'LOAN_OFFICER': return <LoanOfficerDashboard user={user} onLogout={onLogout} />;
      case 'MEMBER': return <MemberDashboard user={user} onLogout={onLogout} />;
      default: return <Navigate to="/unauthorized" />;
    }
};

export default function App() {
  const [user, setUser] = useState(() => {
    try {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
        return null;
    }
  });

  const handleLogout = useCallback(async () => {
    console.log("Logging out...");
    try {
        // Attempt to clear backend cookie
        await api.post('/api/auth/logout'); 
    } catch (error) {
        console.warn("Logout warning:", error);
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
        // Optional: Use a toast instead of alert for better UX
        // alert("For your security, you have been logged out due to inactivity.");
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

  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route 
          path="/" 
          element={!user ? <Login setUser={setUser} /> : <Navigate to="/portal" />} 
        />
        
        {/* Unified Secure Portal Route */}
        <Route path="/portal/*" element={<DashboardController user={user} onLogout={handleLogout} />} />
        
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