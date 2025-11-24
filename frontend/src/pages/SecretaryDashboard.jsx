import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Gavel, LogOut, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const api = axios.create({ baseURL: 'http://localhost:5000' });
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

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
      <nav className="bg-purple-900 text-white px-6 py-4 flex justify-between items-center shadow-lg">
         <div className="flex items-center gap-3">
             <div className="bg-purple-700 p-2 rounded"><Users size={20}/></div>
             <span className="font-bold tracking-wide">Secretary Portal</span>
         </div>
         <button onClick={onLogout} className="text-sm bg-purple-800 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 transition border border-purple-700">
            <LogOut size={16}/> Logout
         </button>
      </nav>

      <main className="max-w-5xl mx-auto mt-8 p-6">
        <header className="flex justify-between items-end mb-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Meeting Agenda</h1>
                <p className="text-slate-500 mt-1">Review and table pending loan applications.</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-slate-600 text-sm font-medium">
                Pending Items: <span className="text-purple-700 font-bold ml-1">{agenda.length}</span>
            </div>
        </header>
        
        {agenda.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">All Caught Up</h3>
            <p className="text-slate-500">There are no new applications to table at this moment.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {agenda.map(loan => (
              <div key={loan.id} className="bg-white p-0 rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
                
                {/* Left Border Indicator */}
                <div className="w-full md:w-2 bg-purple-500"></div>

                {/* Content */}
                <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="text-xl font-bold text-slate-800">{loan.full_name}</h4>
                            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mt-1">Member Loan Request</p>
                        </div>
                        <div className="bg-slate-100 px-3 py-1 rounded text-sm font-mono font-bold text-slate-700 border border-slate-200">
                            ID: #{loan.id.toString().padStart(4, '0')}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-4 text-sm">
                        <div>
                            <p className="text-slate-400 text-xs mb-1">Amount Requested</p>
                            <p className="font-bold text-slate-900 text-lg">KES {parseInt(loan.amount_requested).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs mb-1">Repayment Period</p>
                            <p className="font-bold text-slate-900 text-lg">{loan.repayment_weeks} Weeks</p>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-lg text-slate-600 text-sm italic border border-slate-100">
                        <FileText size={14} className="inline mr-2 text-slate-400"/>
                        "{loan.purpose}"
                    </div>
                </div>

                {/* Action Area */}
                <div className="bg-slate-50 p-6 md:w-64 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100">
                    <button 
                      onClick={() => handleTableLoan(loan.id)}
                      disabled={loading}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-md shadow-purple-200"
                    >
                      <Gavel size={18} /> Table Motion
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-3">
                        Moves status to <br/> "Tabled for Vote"
                    </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}