import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    Wallet, 
    TrendingUp, 
    Send, 
    CheckCircle, 
    PieChart,
    ArrowUpCircle,
    ArrowDownCircle
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function TreasurerDashboard({ user, onLogout }) {
    const [activeTab, setActiveTab] = useState('queue'); 
    const [financeSubTab, setFinanceSubTab] = useState('overview');

    // Data States
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState({ availableFunds: 0, totalDisbursed: 0 });
    const [transactions, setTransactions] = useState([]);
    
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

                // Only fetch full history if on finance tab
                if (activeTab === 'finance') {
                    const tRes = await api.get('/api/payments/admin/all');
                    setTransactions(tRes.data);
                }
            } catch (err) {
                console.error("Error loading treasury data", err);
            }
        };
        fetchData();
    }, [refreshKey, activeTab]);

    const handleDisburse = async (loanId, amount) => {
        // Client-side check
        if (stats.availableFunds < amount) {
            alert("Insufficient funds in the Sacco account.");
            return;
        }
        if (!window.confirm(`Confirm disbursement of KES ${amount.toLocaleString()}?`)) return;

        setLoading(true);
        try {
            await api.post('/api/loan/treasury/disburse', { loanId });
            alert("Funds disbursed successfully!");
            setRefreshKey(old => old + 1);
        } catch (err) {
            alert(err.response?.data?.error || "Disbursement failed");
        }
        setLoading(false);
    };

    // Filter Logic
    const renderFinanceRows = () => {
        let data = transactions;
        // Inflows: Not disbursement
        if (financeSubTab === 'in') data = transactions.filter(t => t.type !== 'LOAN_DISBURSEMENT');
        // Outflows: Disbursements only
        if (financeSubTab === 'out') data = transactions.filter(t => t.type === 'LOAN_DISBURSEMENT');
        
        return data.slice(0, 20).map((item) => (
            <tr key={item.id} className="hover:bg-slate-50 text-sm">
                <td className="px-6 py-4 font-medium text-slate-900">{item.full_name}</td>
                <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                        item.type === 'LOAN_DISBURSEMENT' ? 'bg-purple-100 text-purple-700' : 
                        item.type === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                        {item.type}
                    </span>
                </td>
                <td className="px-6 py-4 font-mono text-slate-700 font-bold">
                    {item.type === 'LOAN_DISBURSEMENT' ? '-' : '+'} KES {parseFloat(item.amount).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">
                    {item.description || '-'}
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleDateString()}
                </td>
            </tr>
        ));
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Treasury Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                
                {/* Navigation */}
                <div className="flex gap-6 mb-8 border-b border-slate-200">
                    <button onClick={() => setActiveTab('queue')} className={`pb-3 px-2 font-bold text-sm transition ${activeTab === 'queue' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Disbursement Queue</button>
                    <button onClick={() => setActiveTab('finance')} className={`pb-3 px-2 font-bold text-sm transition ${activeTab === 'finance' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>All Financial Records</button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2 opacity-90">
                                <Wallet size={20} /> <span className="text-sm font-bold uppercase tracking-wider">Available Liquidity</span>
                            </div>
                            <div className="text-3xl font-bold">KES {stats.availableFunds.toLocaleString()}</div>
                            <p className="text-emerald-100 text-xs mt-2 opacity-80">Net cash after all disbursements</p>
                        </div>
                        <PieChart className="absolute -right-4 -bottom-4 text-emerald-500 opacity-30" size={100} />
                    </div>

                    <div className="bg-blue-600 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2 opacity-90">
                                <TrendingUp size={20} /> <span className="text-sm font-bold uppercase tracking-wider">Total Disbursed</span>
                            </div>
                            <div className="text-3xl font-bold">KES {stats.totalDisbursed.toLocaleString()}</div>
                            <p className="text-blue-100 text-xs mt-2 opacity-80">Based on active loan contracts</p>
                        </div>
                        <TrendingUp className="absolute -right-4 -bottom-4 text-blue-500 opacity-30" size={100} />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-center shadow-sm">
                        <p className="text-slate-500 font-bold text-sm uppercase mb-1">Pending Approvals</p>
                        <div className="text-3xl font-bold text-slate-800">{queue.length}</div>
                        <p className="text-slate-400 text-xs mt-1">Loans awaiting funds</p>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'queue' ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Send className="text-indigo-600" /> Disbursement Queue
                            </h2>
                        </div>
                        {queue.length === 0 ? (
                            <div className="p-12 text-center text-slate-400"><CheckCircle size={48} className="mx-auto mb-4 opacity-50"/><p>All approved loans have been processed.</p></div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {queue.map(item => (
                                    <div key={item.id} className="p-6 flex flex-col md:flex-row justify-between gap-6 items-center hover:bg-slate-50 transition">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-slate-800">{item.full_name}</h3>
                                            <div className="text-sm text-slate-500 mt-1">
                                                Requesting <span className="font-bold text-slate-900">KES {parseFloat(item.amount_requested).toLocaleString()}</span>
                                                <span className="mx-2 text-slate-300">|</span>
                                                For: <span className="italic">"{item.purpose}"</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDisburse(item.id, parseFloat(item.amount_requested))} disabled={loading} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg flex items-center gap-2">
                                            <Send size={16}/> Disburse Funds
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex gap-4 overflow-x-auto">
                            <button onClick={() => setFinanceSubTab('overview')} className={`px-3 py-1 rounded-lg text-sm font-bold transition ${financeSubTab === 'overview' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}>All Records</button>
                            <button onClick={() => setFinanceSubTab('in')} className={`px-3 py-1 rounded-lg text-sm font-bold transition flex items-center gap-1 ${financeSubTab === 'in' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:bg-slate-100'}`}><ArrowUpCircle size={14}/> Inflows</button>
                            <button onClick={() => setFinanceSubTab('out')} className={`px-3 py-1 rounded-lg text-sm font-bold transition flex items-center gap-1 ${financeSubTab === 'out' ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:bg-slate-100'}`}><ArrowDownCircle size={14}/> Outflows</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-3">Entity</th>
                                        <th className="px-6 py-3">Type</th>
                                        <th className="px-6 py-3">Amount</th>
                                        <th className="px-6 py-3">Description</th>
                                        <th className="px-6 py-3">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">{renderFinanceRows()}</tbody>
                            </table>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}