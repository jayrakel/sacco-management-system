import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Gavel, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const api = axios.create({ baseURL: 'http://localhost:5000' });

export default function SecretaryDashboard({ user, onLogout }) {
  const [agenda, setAgenda] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if(!user || user.role !== 'SECRETARY') navigate('/');
    fetchAgenda();
  }, [user]);

  const fetchAgenda = async () => {
    try {
      const res = await api.get('/api/loan/agenda');
      setAgenda(res.data);
    } catch (err) { console.error(err); }
  };

  const handleTableLoan = async (loanId) => {
    setLoading(true);
    await api.post('/api/loan/table', { loanId });
    await fetchAgenda();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-purple-900 text-white p-4 flex justify-between items-center">
         <div className="flex items-center gap-2 font-bold"><Users /> Secretary Portal</div>
         <button onClick={onLogout} className="text-sm bg-purple-800 px-3 py-1 rounded hover:bg-purple-700 flex gap-2"><LogOut size={16}/> Logout</button>
      </nav>

      <main className="max-w-4xl mx-auto mt-8 p-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Meeting Agenda: Loan Applications</h2>
        
        {agenda.length === 0 ? (
          <div className="bg-white p-12 rounded-xl text-center text-slate-400 border-2 border-dashed border-slate-300">
            No new applications pending.
          </div>
        ) : (
          <div className="grid gap-4">
            {agenda.map(loan => (
              <div key={loan.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="font-bold text-lg text-slate-800">{loan.full_name || 'Member'}</h4>
                  <div className="text-sm text-slate-600 mt-1 space-y-1">
                    <p>Amount: <span className="font-mono font-bold">KES {loan.amount_requested}</span></p>
                    <p>Duration: {loan.repayment_weeks} Weeks</p>
                    <p className="italic text-slate-500">"{loan.purpose}"</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleTableLoan(loan.id)}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition shadow-sm"
                >
                  <Gavel size={18} /> Table Motion
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}