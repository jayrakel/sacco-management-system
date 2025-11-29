import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MemberDashboard from './pages/MemberDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TreasurerDashboard from './pages/TreasurerDashboard';
import LoanOfficerDashboard from './pages/LoanOfficerDashboard';
import ChairpersonDashboard from './pages/ChairpersonDashboard';

// SECURITY SETTING: Time in milliseconds before auto-logout
// 5 minutes * 60 seconds * 1000 milliseconds
const INACTIVITY_LIMIT = 5 * 60 * 1000; 

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // 1. Define Logout Function (memoized with useCallback)
  const handleLogout = useCallback(() => {
    console.log("Logging out...");
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    // Optional: Call backend logout route here if you implement server-side session destruction
  }, []);

  const getRedirectPath = (role) => {
    if (role === 'ADMIN') return '/admin';
    if (role === 'CHAIRPERSON') return '/chairperson';
    if (role === 'SECRETARY') return '/secretary';
    if (role === 'TREASURER') return '/treasurer';
    if (role === 'LOAN_OFFICER') return '/loan-officer';
    return '/member';
  };

  // 2. NEW: Inactivity Monitor
  useEffect(() => {
    // Only activate listener if a user is logged in
    if (!user) return;

    let timeoutId;

    const resetTimer = () => {
      // Clear the existing timer
      if (timeoutId) clearTimeout(timeoutId);
      
      // Set a new timer
      timeoutId = setTimeout(() => {
        alert("For your security, you have been logged out due to inactivity.");
        handleLogout();
      }, INACTIVITY_LIMIT);
    };

    // Events that define "activity"
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Attach listeners
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Start the timer immediately upon login/load
    resetTimer();

    // Cleanup function (runs when component unmounts or user logs out)
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user, handleLogout]); // Dependencies ensure this runs when user state changes

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={!user ? <Login setUser={setUser} /> : <Navigate to={getRedirectPath(user.role)} />} 
        />
        
        <Route 
          path="/member" 
          element={user && user.role === 'MEMBER' ? <MemberDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />
        
        <Route 
          path="/loan-officer" 
          element={user && user.role === 'LOAN_OFFICER' ? <LoanOfficerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />

        <Route 
          path="/secretary" 
          element={user && user.role === 'SECRETARY' ? <SecretaryDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />

        <Route 
          path="/treasurer" 
          element={user && user.role === 'TREASURER' ? <TreasurerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />

        <Route 
          path="/chairperson" 
          element={user && user.role === 'CHAIRPERSON' ? <ChairpersonDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />
        
        <Route 
          path="/admin" 
          element={user && user.role === 'ADMIN' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}