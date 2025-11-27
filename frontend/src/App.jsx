import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import SetupUsers from './pages/SetupUsers';
import AdminDashboard from './pages/AdminDashboard';
import MemberDashboard from './pages/MemberDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import TreasurerDashboard from './pages/TreasurerDashboard';
import api from './api';

const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 Minutes

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Track if system is ready (all officers created)
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
  }, []);

  // --- 1. Inactivity Logic ---
  useEffect(() => {
    if (!user) return;

    const updateActivity = () => localStorage.setItem('lastActivity', Date.now());
    
    const checkInactivity = () => {
      const lastActivity = parseInt(localStorage.getItem('lastActivity') || Date.now());
      if (Date.now() - lastActivity > INACTIVITY_LIMIT) {
        handleLogout();
        window.location.href = '/';
      }
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    const interval = setInterval(checkInactivity, 30000);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      clearInterval(interval);
    };
  }, [user, handleLogout]);

  // --- 2. Setup Check Logic (Admin Only) ---
  useEffect(() => {
    if (user && user.role === 'ADMIN') {
        setIsLoadingSetup(true);
        api.get('/api/auth/setup-status')
           .then(res => {
               setIsSetupComplete(res.data.isComplete);
           })
           .catch(err => console.error("Setup check failed", err))
           .finally(() => setIsLoadingSetup(false));
    }
  }, [user]);

  const handlePasswordUpdated = () => {
    const updatedUser = { ...user, mustChangePassword: false };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const handleSetupDone = () => {
      setIsSetupComplete(true);
  };

  const getRedirectPath = (role) => {
    if (role === 'ADMIN') return '/admin';
    if (role === 'SECRETARY') return '/secretary';
    if (role === 'TREASURER') return '/treasurer';
    return '/member';
  };

  return (
    <Router>
      <Routes>
        {/* ROOT ROUTE LOGIC:
          1. Not Logged In -> Login
          2. Logged In + Must Change Password -> Change Password
          3. Admin + Setup Not Complete -> Setup Wizard
          4. Normal -> Dashboard
        */}
        <Route 
          path="/" 
          element={
            !user ? <Login setUser={setUser} /> : 
            user.mustChangePassword ? <Navigate to="/change-password" /> : 
            (user.role === 'ADMIN' && !isSetupComplete && !isLoadingSetup) ? <Navigate to="/setup" /> : 
            <Navigate to={getRedirectPath(user.role)} />
          } 
        />

        <Route 
          path="/change-password" 
          element={user && user.mustChangePassword ? <ChangePassword onPasswordChanged={handlePasswordUpdated} /> : <Navigate to="/" />} 
        />

        {/* SETUP WIZARD ROUTE */}
        <Route 
          path="/setup" 
          element={
            user && user.role === 'ADMIN' && !isSetupComplete 
            ? <SetupUsers onSetupComplete={handleSetupDone} /> 
            : <Navigate to="/" />
          } 
        />
        
        {/* DASHBOARDS */}
        <Route path="/member" element={user && user.role === 'MEMBER' ? <MemberDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/secretary" element={user && user.role === 'SECRETARY' ? <SecretaryDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        <Route path="/treasurer" element={user && user.role === 'TREASURER' ? <TreasurerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
        
        {/* Admin Dashboard: Protected by setup completion */}
        <Route 
          path="/admin" 
          element={
            user && user.role === 'ADMIN' 
            ? (isSetupComplete ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/setup" />) 
            : <Navigate to="/" />
          } 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}