import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MemberDashboard from './pages/MemberDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';

export default function App() {
  // Load user from local storage to keep them logged in on refresh
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <Router>
      <Routes>
        {/* Public Route: Login */}
        <Route 
          path="/" 
          element={!user ? <Login setUser={setUser} /> : <Navigate to={user.role === 'SECRETARY' ? "/secretary" : "/member"} />} 
        />

        {/* Protected Route: Member */}
        <Route 
          path="/member" 
          element={user && user.role === 'MEMBER' ? <MemberDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />

        {/* Protected Route: Secretary */}
        <Route 
          path="/secretary" 
          element={user && user.role === 'SECRETARY' ? <SecretaryDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />

        {/* Protected Route: Treasurer (Placeholder for future) */}
        <Route 
          path="/treasurer" 
          element={<div>Treasurer Dashboard (Coming Soon) <button onClick={handleLogout}>Logout</button></div>} 
        />
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}