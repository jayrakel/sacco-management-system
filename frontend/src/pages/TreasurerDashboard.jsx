import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    Wallet, 
    TrendingUp, 
    Send, 
    AlertCircle, 
    CheckCircle, 
    DollarSign,
    PieChart
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function TreasurerDashboard({ user, onLogout }) {
    // Data States
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState({ availableFunds: 0, totalDisbursed: 0 });
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [qRes, sRes] = await Promise.all([
                    api.get('/api/loan/treasury/queue'),
                    api.get('/api/loan/treasury/stats')
                ]);
                setQueue(qRes.data);
                setStats(sRes.data);
            } catch (err) {
                console.error("Error loading treasury data", err);
            }
        };
        fetchData();
    }, [refreshKey]);

    // --- ACTIONS ---

    const handleDisburse = async (loanId, amount) => {
        if (stats.availableFunds < amount) {
            alert("Insufficient funds in the Sacco account to disburse this loan.");
            return;
        }

        if (!window.confirm(`Confirm disbursement of KES ${amount.toLocaleString()}? This action is irreversible.`)) return;

        setLoading(true);
        try {
            await api.post('/api/loan/treasury/disburse', { loanId });
            alert("Funds disbursed successfully!");
            setRefreshKey(old => old + 1); // Refresh data
        } catch (err) {
            alert(err.response?.data?.error || "Disbursement failed");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Treasury Panel" />

            <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                
                {/* 1. FINANCIAL OVERVIEW CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Liquidity Card */}
                    <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2 opacity-90">
                                <Wallet size={20} />
                                <span className="text-sm font-bold uppercase tracking-wider">Available Liquidity</span>
                            </div>
                            <div className="text-3xl font-bold">KES {stats.availableFunds.toLocaleString()}</div>
                            <p className="text-emerald-100 text-xs mt-2">Funds available for immediate disbursement</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 text-emerald-500 opacity-30">
                            <PieChart size={120} />
                        </div>
                    </div>

                    {/* Disbursed Card */}
                    <div className="bg-blue-600 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2 opacity-90">
                                <TrendingUp size={20} />
                                <span className="text-sm font-bold uppercase tracking-wider">Total Disbursed</span>
                            </div>
                            <div className="text-3xl font-bold">KES {stats.totalDisbursed.toLocaleString()}</div>
                            <p className="text-blue-100 text-xs mt-2">Total loan value currently active</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 text-blue-500 opacity-30">
                            <TrendingUp size={120} />
                        </div>
                    </div>

                    {/* Pending Queue Stats */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
                        <p className="text-slate-500 font-bold text-sm uppercase mb-1">Pending Approvals</p>
                        <div className="text-3xl font-bold text-slate-800">{queue.length}</div>
                        <p className="text-slate-400 text-xs mt-1">Loans awaiting disbursement</p>
                    </div>
                </div>

                {/* 2. DISBURSEMENT QUEUE */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Send className="text-indigo-600" /> Disbursement Queue
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">These loans have been voted on and approved. Authorization required to release funds.</p>
                    </div>

                    {queue.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-400 opacity-50"/>
                            <p>All approved loans have been disbursed. Good job!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {queue.map(item => (
                                <div key={item.id} className="p-6 hover:bg-slate-50 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    
                                    {/* Loan Details */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">APPROVED</span>
                                            <span className="text-slate-400 text-xs font-mono">REF: #{item.id}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800">{item.full_name}</h3>
                                        <div className="text-sm text-slate-500 mt-1 space-y-1">
                                            <p>Has requested <span className="text-slate-900 font-bold">KES {parseFloat(item.amount_requested).toLocaleString()}</span> for <span className="italic">"{item.purpose}"</span>.</p>
                                            <p className="text-xs flex items-center gap-2">
                                                <AlertCircle size={12}/> Repayment Period: {item.repayment_weeks} Weeks
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Area */}
                                    <div className="flex flex-col items-end gap-2 min-w-[180px]">
                                        <div className="text-right mb-2">
                                            <span className="block text-xs text-slate-400 uppercase font-bold">Amount to Send</span>
                                            <span className="text-xl font-bold text-emerald-600">KES {parseFloat(item.amount_requested).toLocaleString()}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleDisburse(item.id, parseFloat(item.amount_requested))}
                                            disabled={loading}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2"
                                        >
                                            {loading ? 'Processing...' : <><Send size={16}/> Disburse Funds</>}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}