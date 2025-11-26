import React, { useState, useEffect } from 'react';
import api from '../api';
import { DollarSign, Send, BarChart3, CheckCircle } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function TreasurerDashboard({ user, onLogout }) {
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState({ availableFunds: 0, totalDisbursed: 0 });
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        api.get('/api/loan/treasury/queue').then(res => setQueue(res.data));
        api.get('/api/loan/treasury/stats').then(res => setStats(res.data));
    }, [refreshKey]);

    const disburseLoan = async (loanId) => {
        if(!window.confirm("Confirm disbursement of funds?")) return;
        try {
            await api.post('/api/loan/treasury/disburse', { loanId });
            setRefreshKey(k => k + 1);
            alert("Funds Disbursed Successfully!");
        } catch (err) {
            alert(err.response?.data?.error || "Disbursement Failed");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Treasury Portal" />

            <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
                
                {/* STATS ROW */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-emerald-900 text-white rounded-2xl p-8 shadow-lg flex items-center justify-between">
                        <div>
                            <p className="text-emerald-200 font-medium mb-1">Available Liquid Funds</p>
                            <h2 className="text-4xl font-bold">KES {stats.availableFunds?.toLocaleString()}</h2>
                        </div>
                        <div className="bg-white/10 p-4 rounded-full"><DollarSign size={32}/></div>
                    </div>
                    <div className="bg-white text-slate-800 rounded-2xl p-8 shadow-sm border border-slate-200 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 font-medium mb-1">Total Disbursed (All Time)</p>
                            <h2 className="text-4xl font-bold text-blue-600">KES {stats.totalDisbursed?.toLocaleString()}</h2>
                        </div>
                        <div className="bg-blue-50 text-blue-600 p-4 rounded-full"><BarChart3 size={32}/></div>
                    </div>
                </div>

                {/* QUEUE */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <Send className="text-emerald-600"/> Approved Loans Pending Disbursement
                        </h3>
                    </div>
                    
                    {queue.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 italic">No pending disbursements.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {queue.map(loan => (
                                <div key={loan.id} className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-bold text-slate-800 text-lg">{loan.full_name}</h4>
                                            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-bold">APPROVED</span>
                                        </div>
                                        <p className="text-slate-500 text-sm">
                                            Amount: <span className="font-bold text-slate-900">KES {parseInt(loan.amount_requested).toLocaleString()}</span> • 
                                            Phone: <span className="font-mono">{loan.phone_number}</span>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">Votes received: {loan.yes_votes} YES</p>
                                    </div>
                                    <button 
                                        onClick={() => disburseLoan(loan.id)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 transition flex items-center gap-2 whitespace-nowrap"
                                    >
                                        Disburse Funds <CheckCircle size={18}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}