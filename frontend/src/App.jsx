import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import MemberDashboard from './pages/MemberDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import TreasurerDashboard from './pages/TreasurerDashboard';
import LoanOfficerDashboard from './pages/LoanOfficerDashboard';
import ChairpersonDashboard from './pages/ChairpersonDashboard';
import ErrorPages from './pages/ErrorPages';
import SetupUsers from './pages/SetupUsers';
import ChangePassword from './pages/ChangePassword';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login setUser={setUser} />} />
        
        {/* --- NEW ROUTES --- */}
        <Route path="/change-password" element={user ? <ChangePassword /> : <Navigate to="/" />} />
        <Route path="/setup-users" element={user?.role === 'ADMIN' ? <SetupUsers /> : <Navigate to="/" />} />
        {/* ------------------ */}

        <Route path="/admin" element={user?.role === 'ADMIN' ? <AdminDashboard user={user} /> : <Navigate to="/" />} />
        <Route path="/secretary" element={user?.role === 'SECRETARY' ? <SecretaryDashboard /> : <Navigate to="/" />} />
        <Route path="/treasurer" element={user?.role === 'TREASURER' ? <TreasurerDashboard /> : <Navigate to="/" />} />
        <Route path="/loan-officer" element={user?.role === 'LOAN_OFFICER' ? <LoanOfficerDashboard /> : <Navigate to="/" />} />
        <Route path="/chairperson" element={user?.role === 'CHAIRPERSON' ? <ChairpersonDashboard /> : <Navigate to="/" />} />
        <Route path="/member" element={user?.role === 'MEMBER' ? <MemberDashboard /> : <Navigate to="/" />} />
        
        <Route path="*" element={<ErrorPages />} />
      </Routes>
    </Router>
  );
}

export default App;