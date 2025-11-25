import React, { useState, useEffect } from 'react';
import api from '../api';
import { Users, LogOut, BarChart3, Check, X, AlertCircle } from 'lucide-react';

export default function SecretaryDashboard({ user, onLogout }) {
  const [tally, setTally] = useState([]);

  // Poll for live votes every 3 seconds
  useEffect(() => {
    const fetchTally = async () => {
      try {
        const res = await api.get('/api/loan/secretary/live-tally');
        setTally(res.data);
      } catch (err) { console.error(err); }
    };

    fetchTally(); // Initial fetch
    const interval = setInterval(fetchTally, 3000); 
    return () => clearInterval(interval);
  }, []);

  const finalize = async (loanId, decision) => {
      if(!confirm(`Are you sure you want to ${decision} this loan? This action is final and notifications will be sent.`)) return;
      try {
        await api.post('/api/loan/secretary/finalize', { loanId, decision });
        // Optimistic update or let the poller refresh it
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

      <main className="max-w-4xl mx-auto mt-8 p-6">
        <div className="flex items-center gap-3 mb-8">
            <div className="bg-white p-3 rounded-xl shadow-sm text-purple-600 border border-purple-100"><BarChart3 size={24}/></div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Live Voting Monitor</h1>
                <p className="text-slate-500">Track member votes and finalize loan decisions.</p>
            </div>
        </div>
        
        {tally.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border-2 border-dashed border-slate-300">
                <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <AlertCircle size={32}/>
                </div>
                <p className="text-slate-500 text-lg font-medium">No active motions</p>
                <p className="text-sm text-slate-400 mt-1">Table loans to start the voting process.</p>
            </div>
        ) : (
            <div className="grid gap-6">
                {tally.map(item => {
                    const yes = parseInt(item.yes_votes);
                    const no = parseInt(item.no_votes);
                    const total = yes + no;
                    const yesPercent = total === 0 ? 0 : (yes / total) * 100;
                    const isPassing = total > 0 && yesPercent > 50;

                    return (
                        <div key={item.id} className="bg-white p-6 rounded-xl shadow-md border border-slate-200 relative overflow-hidden">
                            {/* Status Badge */}
                            <div className="absolute top-6 right-6">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                    item.status === 'VOTING' 
                                    ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' 
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                    {item.status === 'VOTING' ? '● LIVE VOTING' : item.status}
                                </span>
                            </div>

                            <div className="mb-6 pr-24">
                                <h3 className="font-bold text-xl text-slate-800">{item.full_name}</h3>
                                <p className="text-sm text-slate-500 mt-1">Requesting <span className="font-bold text-slate-900">KES {parseInt(item.amount_requested).toLocaleString()}</span></p>
                            </div>

                            {/* Voting Visuals */}
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mb-6">
                                <div className="flex justify-between items-end mb-2 text-sm font-bold">
                                    <span className="text-emerald-600">{yes} YES</span>
                                    <span className="text-red-500">{no} NO</span>
                                </div>
                                <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden flex">
                                    <div className="bg-emerald-500 h-full transition-all duration-1000 ease-out" style={{ width: `${yesPercent}%` }}></div>
                                    <div className="bg-red-500 h-full transition-all duration-1000 ease-out flex-1"></div>
                                </div>
                                <div className="mt-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Total Votes: {total}
                                </div>
                            </div>

                            {/* Actions (Only available during Voting) */}
                            {item.status === 'VOTING' && (
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => finalize(item.id, 'APPROVED')} 
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition"
                                    >
                                        <Check size={18}/> Pass Motion
                                    </button>
                                    <button 
                                        onClick={() => finalize(item.id, 'REJECTED')} 
                                        className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
                                    >
                                        <X size={18}/> Fail Motion
                                    </button>
                                </div>
                            )}
                            
                            {item.status === 'TABLED' && (
                                <div className="text-center bg-slate-50 p-3 rounded-lg text-slate-400 text-sm italic">
                                    Waiting for Chairperson to open voting...
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
      </main>
    </div>
  );
}