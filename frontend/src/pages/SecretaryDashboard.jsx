import React, { useState, useEffect } from 'react';
import api from '../api';
import { Users, Gavel, LogOut, BarChart3, Check, X, AlertCircle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SecretaryDashboard({ user, onLogout }) {
  const [agenda, setAgenda] = useState([]); // New Applications (Status: SUBMITTED)
  const [tally, setTally] = useState([]);   // Active Voting Process (Status: TABLED/VOTING)
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if(!user || user.role !== 'SECRETARY') navigate('/');
    
    // Initial Load
    fetchAgenda();
    fetchTally();

    // Poll for live votes every 3 seconds
    const interval = setInterval(fetchTally, 3000); 
    return () => clearInterval(interval);
  }, [user]);

  // Fetch Pending Applications
  const fetchAgenda = async () => {
    try {
      const res = await api.get('/api/loan/agenda');
      setAgenda(res.data);
    } catch (err) { console.error(err); }
  };

  // Fetch Live Votes
  const fetchTally = async () => {
    try {
      const res = await api.get('/api/loan/secretary/live-tally');
      setTally(res.data);
    } catch (err) { console.error(err); }
  };

  // Action: Table the Motion (Triggers notification to members)
  const handleTableLoan = async (loanId) => {
    setLoading(true);
    try {
        await api.post('/api/loan/table', { loanId });
        await fetchAgenda(); // Refresh agenda list
        await fetchTally();  // It should now appear in the monitor
        alert("Motion Tabled! Notification sent to all members.");
    } catch (err) { 
        alert("Error: " + (err.response?.data?.error || "Failed to table"));
    }
    setLoading(false);
  };

  // Action: Finalize Vote
  const finalize = async (loanId, decision) => {
      if(!confirm(`Confirm: ${decision} this loan based on the vote result?`)) return;
      try {
        await api.post('/api/loan/secretary/finalize', { loanId, decision });
        fetchTally(); // Should disappear from active monitor
      } catch (err) {
          alert("Action failed: " + (err.response?.data?.error || "Unknown error"));
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Navbar */}
      <nav className="bg-purple-900 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
         <div className="flex items-center gap-3">
             <div className="bg-purple-700 p-2 rounded"><Users size={20}/></div>
             <span className="font-bold tracking-wide">Secretary Portal</span>
         </div>
         <button onClick={onLogout} className="text-sm bg-purple-800 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 transition border border-purple-700">
            <LogOut size={16}/> Logout
         </button>
      </nav>

      <main className="max-w-6xl mx-auto mt-8 p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COLUMN 1: NEW AGENDA ITEMS (Pending Tabling) */}
        <div>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="text-purple-600"/> New Applications
            </h2>
            
            {agenda.length === 0 ? (
                <div className="bg-white p-8 rounded-xl text-center border-2 border-dashed border-slate-200">
                    <p className="text-slate-400">No new loan applications received.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {agenda.map(loan => (
                        <div key={loan.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-lg">{loan.full_name}</h4>
                                <span className="bg-purple-50 text-purple-700 text-xs font-bold px-2 py-1 rounded">SUBMITTED</span>
                            </div>
                            <p className="text-slate-600 text-sm mb-4">Requests <span className="font-bold">KES {parseInt(loan.amount_requested).toLocaleString()}</span> for "{loan.purpose}"</p>
                            
                            <button 
                                onClick={() => handleTableLoan(loan.id)}
                                disabled={loading}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
                            >
                                <Gavel size={16}/> Table Motion for AGM
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* COLUMN 2: LIVE VOTING MONITOR (Active Meetings) */}
        <div>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 className="text-emerald-600"/> Active Voting Sessions
            </h2>

            {tally.length === 0 ? (
                <div className="bg-white p-8 rounded-xl text-center border-2 border-dashed border-slate-200">
                    <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                        <AlertCircle size={24}/>
                    </div>
                    <p className="text-slate-400">No motions currently on the floor.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {tally.map(item => {
                        const yes = parseInt(item.yes_votes);
                        const no = parseInt(item.no_votes);
                        const total = yes + no;
                        const yesPercent = total === 0 ? 0 : (yes / total) * 100;

                        return (
                            <div key={item.id} className="bg-white p-6 rounded-xl shadow-md border border-slate-200 relative overflow-hidden">
                                {/* Live Badge */}
                                <div className="absolute top-0 right-0 p-4">
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                                        item.status === 'VOTING' 
                                        ? 'bg-red-100 text-red-600 animate-pulse' 
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {item.status === 'VOTING' ? '● LIVE' : 'WAITING'}
                                    </span>
                                </div>

                                <div className="mb-4 pr-12">
                                    <h3 className="font-bold text-slate-800">Loan #{item.id} - {item.full_name}</h3>
                                    <p className="text-xs text-slate-500">Amount: KES {parseInt(item.amount_requested).toLocaleString()}</p>
                                </div>

                                {/* Voting Visuals */}
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 mb-4">
                                    <div className="flex justify-between items-end mb-2 text-xs font-bold">
                                        <span className="text-emerald-600">{yes} YES</span>
                                        <span className="text-red-500">{no} NO</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                                        <div className="bg-emerald-500 h-full transition-all duration-1000 ease-out" style={{ width: `${yesPercent}%` }}></div>
                                        <div className="bg-red-500 h-full transition-all duration-1000 ease-out flex-1"></div>
                                    </div>
                                </div>

                                {/* Actions (Only available during Voting or if Tabled to force close) */}
                                {item.status === 'VOTING' ? (
                                    <div className="flex gap-2">
                                        <button onClick={() => finalize(item.id, 'APPROVED')} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-2 rounded font-bold text-xs flex items-center justify-center gap-1">
                                            <Check size={14}/> Pass
                                        </button>
                                        <button onClick={() => finalize(item.id, 'REJECTED')} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded font-bold text-xs flex items-center justify-center gap-1">
                                            <X size={14}/> Reject
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-center text-slate-400 italic">
                                        Waiting for Chair (Admin) to open voting...
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

      </main>
    </div>
  );
}