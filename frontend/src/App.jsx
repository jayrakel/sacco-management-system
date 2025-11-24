import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MemberDashboard from './pages/MemberDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TreasurerDashboard from './pages/TreasurerDashboard'; // IMPORT THIS

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
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
        <Route 
          path="/" 
          element={!user ? <Login setUser={setUser} /> : <Navigate to={getRedirectPath(user.role)} />} 
        />
        
        <Route 
          path="/member" 
          element={user && user.role === 'MEMBER' ? <MemberDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />
        
        <Route 
          path="/secretary" 
          element={user && user.role === 'SECRETARY' ? <SecretaryDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
        />

        {/* NEW TREASURER ROUTE */}
        <Route 
          path="/treasurer" 
          element={user && user.role === 'TREASURER' ? <TreasurerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} 
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