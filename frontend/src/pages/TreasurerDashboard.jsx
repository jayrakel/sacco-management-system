// frontend/src/pages/TreasurerDashboard.jsx
import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    Wallet, 
    TrendingUp, 
    Send, 
    CheckCircle, 
    PieChart,
    FileText,
    AlertCircle,
    FileWarning,
    Briefcase,
    DollarSign,
    Users,
    Clock
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function TreasurerDashboard({ user, onLogout }) {
    // Main Tabs: 'queue' (Disbursements) or 'finance' (Records)
    const [activeTab, setActiveTab] = useState('queue'); 
    const [financeSubTab, setFinanceSubTab] = useState('overview');

    // Data State
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState({ availableFunds: 0, totalDisbursed: 0 });
    
    // Financial Records
    const [deposits, setDeposits] = useState([]);
    const [transactions, setTransactions] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Queue & Basic Treasury Stats
                const [qRes, sRes] = await Promise.all([
                    api.get('/api/loan/treasury/queue'),
                    api.get('/api/loan/treasury/stats')
                ]);
                setQueue(qRes.data);
                setStats(sRes.data);

                // 2. Fetch Full Financial History
                // Always fetching this to ensure data is ready when switching tabs
                const [resDeposits, resTrans] = await Promise.all([
                    api.get('/api/deposits/admin/all'),
                    api.get('/api/payments/admin/all')
                ]);
                setDeposits(resDeposits.data || []);
                setTransactions(resTrans.data || []);
                
            } catch (err) {
                console.error("Error loading treasury data", err);
            }
        };
        fetchData();
    }, [refreshKey]);

    // --- CALCULATIONS FOR FINANCE TAB (Restored Original Logic) ---
    const safeSum = (arr) => {
        if (!Array.isArray(arr)) return 0;
        return arr.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    };

    const sumByType = (type) => {
        if (!Array.isArray(transactions)) return 0;
        return transactions
            .filter(t => t.type === type)
            .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    };

    const sumLoanForms = () => {
        if (!Array.isArray(transactions)) return 0;
        return transactions.reduce((acc, t) => {
            const amt = parseFloat(t.amount) || 0;
            if (t.type === 'LOAN_FORM_FEE') return acc + amt;
            if (t.type === 'FEE_PAYMENT') return acc + amt; 
            return acc;
        }, 0);
    };

    // Breakdown Statistics
    const breakdown = {
        deposits: safeSum(deposits),
        regFees: sumByType('REGISTRATION_FEE'),
        loanForms: sumLoanForms(),
        fines: sumByType('FINE'),
        penalties: sumByType('PENALTY'),
        disbursements: sumByType('LOAN_DISBURSEMENT')
    };

    // --- ACTIONS ---
    const handleDisburse = async (loanId, amount) => {
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

    // --- HELPER COMPONENT (Restored) ---
    const FinanceCard = ({ title, amount, icon, activeId, colorClass }) => (
        <div 
            onClick={() => setFinanceSubTab(activeId)}
            className={`cursor-pointer p-5 rounded-xl border transition-all duration-200 ${
                financeSubTab === activeId 
                ? `bg-white shadow-md border-${colorClass}-500 ring-2 ring-${colorClass}-200` 
                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
            }`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg bg-${colorClass}-50 text-${colorClass}-600`}>{icon}</div>
                {financeSubTab === activeId && <CheckCircle size={16} className={`text-${colorClass}-600`} />}
            </div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</p>
            <h3 className="text-xl font-bold text-slate-800 mt-1">KES {amount.toLocaleString()}</h3>
        </div>
    );

    // --- TABLE ROWS RENDERER (Restored) ---
    const renderFinanceTableRows = () => {
        let data = [];
        let typeLabel = '';

        switch(financeSubTab) {
            case 'deposits':
                data = deposits;
                typeLabel = 'DEPOSIT';
                break;
            case 'reg_fees':
                data = transactions.filter(t => t.type === 'REGISTRATION_FEE');
                typeLabel = 'REG FEE';
                break;
            case 'loan_forms':
                data = transactions.filter(t => ['FEE_PAYMENT', 'LOAN_FORM_FEE'].includes(t.type));
                typeLabel = 'FORM FEE';
                break;
            case 'fines':
                data = transactions.filter(t => t.type === 'FINE');
                typeLabel = 'FINE';
                break;
            case 'penalties':
                data = transactions.filter(t => t.type === 'PENALTY');
                typeLabel = 'PENALTY';
                break;
            case 'disbursements':
                data = transactions.filter(t => t.type === 'LOAN_DISBURSEMENT');
                typeLabel = 'OUTFLOW';
                break;
            default: // overview
                const recentDeps = deposits.slice(0, 10).map(d => ({...d, type: 'DEPOSIT'}));
                const recentTrans = transactions.slice(0, 15);
                data = [...recentDeps, ...recentTrans].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                typeLabel = 'MIXED';
        }

        if (!data || data.length === 0) {
            return <tr><td colSpan="5" className="p-8 text-center text-slate-400">No records found for this category.</td></tr>;
        }

        return data.map((item, idx) => (
            <tr key={item.id || idx} className="hover:bg-slate-50 transition text-sm">
                <td className="px-6 py-4 font-medium text-slate-900">{item.full_name}</td>
                <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                        item.type === 'LOAN_DISBURSEMENT' ? 'bg-purple-100 text-purple-700' :
                        item.type === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-700' :
                        item.type === 'FINE' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                    }`}>
                        {item.type === 'FEE_PAYMENT' ? 'LOAN_FORM_FEE' : item.type || typeLabel}
                    </span>
                </td>
                <td className="px-6 py-4 text-slate-600 text-xs max-w-[200px] truncate">
                    {item.description || '-'}
                </td>
                <td className="px-6 py-4 font-mono text-slate-700 font-bold">
                     {item.type === 'LOAN_DISBURSEMENT' ? '-' : '+'} KES {parseFloat(item.amount).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleDateString()}
                </td>
            </tr>
        ));
    };

    // Queue Calculations for Redesigned Tab
    const totalPendingPayouts = queue.reduce((acc, item) => acc + parseFloat(item.amount_requested), 0);
    const liquidityStatus = stats.availableFunds >= totalPendingPayouts ? 'healthy' : 'critical';

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Treasury Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                
                {/* Navigation Tabs */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex gap-2">
                        <button 
                            onClick={() => setActiveTab('queue')} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'queue' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Disbursement Queue {queue.length > 0 && <span className="ml-1 bg-white/20 px-1.5 rounded text-xs">{queue.length}</span>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('finance')} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'finance' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Financial Records
                        </button>
                    </div>
                </div>

                {/* 1. REDESIGNED DISBURSEMENT QUEUE */}
                {activeTab === 'queue' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Queue Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Available Funds */}
                            <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2 opacity-90">
                                        <Wallet size={20} /> <span className="text-sm font-bold uppercase tracking-wider">Liquidity</span>
                                    </div>
                                    <div className="text-3xl font-extrabold">KES {stats.availableFunds.toLocaleString()}</div>
                                    <p className="text-emerald-100 text-xs mt-2 opacity-80">Available cash for lending</p>
                                </div>
                                <DollarSign size={80} className="absolute -right-4 -bottom-4 text-emerald-500 opacity-30" />
                            </div>

                            {/* Pending Payouts */}
                            <div className={`rounded-2xl p-6 shadow-lg border relative overflow-hidden ${liquidityStatus === 'healthy' ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                                        <Clock size={20} /> <span className="text-sm font-bold uppercase tracking-wider">Pending Payouts</span>
                                    </div>
                                    <div className={`text-3xl font-extrabold ${liquidityStatus === 'healthy' ? 'text-slate-800' : 'text-red-600'}`}>
                                        KES {totalPendingPayouts.toLocaleString()}
                                    </div>
                                    {liquidityStatus === 'critical' && (
                                        <p className="text-red-500 text-xs mt-2 font-bold flex items-center gap-1">
                                            <AlertCircle size={12} /> Liquidity Low! Cannot clear queue.
                                        </p>
                                    )}
                                    {liquidityStatus === 'healthy' && (
                                        <p className="text-slate-400 text-xs mt-2">Total approved awaiting transfer</p>
                                    )}
                                </div>
                            </div>

                            {/* Total Disbursed */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                                    <Send size={20} /> <span className="text-sm font-bold uppercase tracking-wider">Total Disbursed</span>
                                </div>
                                <div className="text-3xl font-extrabold text-slate-800">KES {stats.totalDisbursed.toLocaleString()}</div>
                                <p className="text-slate-400 text-xs mt-2">Lifetime disbursements</p>
                            </div>
                        </div>

                        {/* Queue Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Users size={18} className="text-slate-500" /> 
                                    Approved Loans ({queue.length})
                                </h2>
                            </div>

                            {queue.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <CheckCircle size={48} className="mx-auto mb-4 opacity-50"/>
                                    <p>All approved loans have been processed.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                            <tr>
                                                <th className="px-6 py-3">Member</th>
                                                <th className="px-6 py-3">Amount</th>
                                                <th className="px-6 py-3">Purpose</th>
                                                <th className="px-6 py-3">Approved On</th>
                                                <th className="px-6 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {queue.map(item => (
                                                <tr key={item.id} className="hover:bg-slate-50 transition">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-800">{item.full_name}</div>
                                                        <div className="text-xs text-slate-400">{item.phone_number}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                                                            KES {parseFloat(item.amount_requested).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                                                        {item.purpose}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 text-xs">
                                                        {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => handleDisburse(item.id, parseFloat(item.amount_requested))} 
                                                            disabled={loading || stats.availableFunds < parseFloat(item.amount_requested)} 
                                                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition ${
                                                                loading || stats.availableFunds < parseFloat(item.amount_requested)
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                            }`}
                                                        >
                                                            <Send size={14}/> Disburse
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. ORIGINAL FINANCIAL OVERVIEW (Restored) */}
                {activeTab === 'finance' && (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* Main Header */}
                        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white rounded-2xl p-8 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <p className="text-indigo-200 font-bold text-sm uppercase tracking-widest">Total Sacco Assets</p>
                                <h2 className="text-4xl font-extrabold mt-2">KES {(breakdown.deposits + breakdown.regFees + breakdown.loanForms + breakdown.fines + breakdown.penalties).toLocaleString()}</h2>
                                <p className="text-sm text-indigo-200 mt-2 opacity-80">Consolidated balance of all inflows</p>
                            </div>
                            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                                <TrendingUp size={48} className="text-indigo-100" />
                            </div>
                        </div>

                        {/* Breakdown Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <FinanceCard title="Deposits" amount={breakdown.deposits} icon={<TrendingUp size={20}/>} activeId="deposits" colorClass="emerald" />
                            <FinanceCard title="Reg Fees" amount={breakdown.regFees} icon={<Briefcase size={20}/>} activeId="reg_fees" colorClass="blue" />
                            <FinanceCard title="Loan Forms" amount={breakdown.loanForms} icon={<FileText size={20}/>} activeId="loan_forms" colorClass="indigo" />
                            <FinanceCard title="Fines" amount={breakdown.fines} icon={<AlertCircle size={20}/>} activeId="fines" colorClass="amber" />
                            <FinanceCard title="Penalties" amount={breakdown.penalties} icon={<FileWarning size={20}/>} activeId="penalties" colorClass="red" />
                            <FinanceCard title="Disbursed" amount={breakdown.disbursements} icon={<Send size={20}/>} activeId="disbursements" colorClass="purple" />
                        </div>

                        {/* Detailed List */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <FileText size={16} className="text-slate-500"/> 
                                    {financeSubTab.replace('_', ' ').toUpperCase()} Records
                                </h3>
                                {financeSubTab !== 'overview' && <button onClick={() => setFinanceSubTab('overview')} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-slate-600 text-left">
                                    <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-6 py-3">Entity</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3">Amount</th>
                                            <th className="px-6 py-3">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {renderFinanceTableRows()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}