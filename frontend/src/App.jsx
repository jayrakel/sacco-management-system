import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MemberDashboard from './pages/MemberDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TreasurerDashboard from './pages/TreasurerDashboard';
import LoanOfficerDashboard from './pages/LoanOfficerDashboard';
import ChairpersonDashboard from './pages/ChairpersonDashboard';
import { Unauthorized, NotFound, ServerError } from './pages/ErrorPages'; // Import Errors

const INACTIVITY_LIMIT = 5 * 60 * 1000; 

const ROUTES = {
    MEMBER:       "/u/8x92m",
    LOAN_OFFICER: "/u/k29s1",
    SECRETARY:    "/u/7d4a5",
    TREASURER:    "/u/9f3z2",
    CHAIRPERSON:  "/u/2p5l9",
    ADMIN:        "/u/x4r8q"
};

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogout = useCallback(() => {
    console.log("Logging out...");
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }, []);

  const getRedirectPath = (role) => {
    if (role === 'ADMIN') return ROUTES.ADMIN;
    if (role === 'CHAIRPERSON') return ROUTES.CHAIRPERSON;
    if (role === 'SECRETARY') return ROUTES.SECRETARY;
    if (role === 'TREASURER') return ROUTES.TREASURER;
    if (role === 'LOAN_OFFICER') return ROUTES.LOAN_OFFICER;
    return ROUTES.MEMBER;
  };

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

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={!user ? <Login setUser={setUser} /> : <Navigate to={getRedirectPath(user.role)} />} 
        />
        
        {/* Protected Routes */}
        <Route path={ROUTES.MEMBER} element={user && user.role === 'MEMBER' ? <MemberDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/unauthorized" />} />
        <Route path={ROUTES.LOAN_OFFICER} element={user && user.role === 'LOAN_OFFICER' ? <LoanOfficerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/unauthorized" />} />
        <Route path={ROUTES.SECRETARY} element={user && user.role === 'SECRETARY' ? <SecretaryDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/unauthorized" />} />
        <Route path={ROUTES.TREASURER} element={user && user.role === 'TREASURER' ? <TreasurerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/unauthorized" />} />
        <Route path={ROUTES.CHAIRPERSON} element={user && user.role === 'CHAIRPERSON' ? <ChairpersonDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/unauthorized" />} />
        <Route path={ROUTES.ADMIN} element={user && user.role === 'ADMIN' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/unauthorized" />} />
        
        {/* Error Routes */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/server-error" element={<ServerError />} />
        <Route path="/not-found" element={<NotFound />} />
        
        {/* Catch-all for 404 */}
        <Route path="*" element={<Navigate to="/not-found" />} />
      </Routes>
    </Router>
  );
}