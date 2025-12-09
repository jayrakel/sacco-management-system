import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    Wallet, TrendingUp, Send, CheckCircle, PieChart, FileText, AlertCircle, FileWarning, Briefcase, DollarSign, Users, Clock, Shield, List, Settings, FolderPlus, Trash2
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import AdvancedReporting from '../components/AdvancedReporting';

export default function TreasurerDashboard({ user, onLogout }) {
    // Main Tabs: 'queue', 'verification', 'finance', 'portfolio', 'reports'
    const [activeTab, setActiveTab] = useState('queue'); 
    const [financeSubTab, setFinanceSubTab] = useState('overview');

    // Data State
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState({ availableFunds: 0, totalDisbursed: 0 });
    const [pendingDeposits, setPendingDeposits] = useState([]); 
    const [portfolio, setPortfolio] = useState([]); // NEW: Active Loans
    
    // Category Management
    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState({ name: "", description: "", amount: "" });
    
    // Financial Records
    const [deposits, setDeposits] = useState([]);
    const [transactions, setTransactions] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Queue, Basic Stats & Pending Deposits
                const [qRes, sRes, depPendingRes, catRes] = await Promise.all([
                    api.get('/api/loan/treasury/queue'),
                    api.get('/api/loan/treasury/stats'),
                    api.get('/api/payments/admin/deposits/pending'),
                    api.get('/api/settings/categories')
                ]);
                setQueue(qRes.data);
                setStats(sRes.data);
                setPendingDeposits(depPendingRes.data);
                setCategories(catRes.data || []);

                // 2. Fetch Full Financial History
                const [resDeposits, resTrans] = await Promise.all([
                    api.get('/api/deposits/admin/all'),
                    api.get('/api/payments/admin/all')
                ]);
                setDeposits(resDeposits.data || []);
                setTransactions(resTrans.data || []);

                // 3. Fetch Portfolio (If tab is active or pre-fetch)
                if(activeTab === 'portfolio') {
                    const resPort = await api.get('/api/reports/active-portfolio');
                    setPortfolio(resPort.data || []);
                }
                
            } catch (err) {
                console.error("Error loading treasury data", err);
            }
        };
        fetchData();
    }, [refreshKey, activeTab]);

    // --- CALCULATIONS FOR FINANCE TAB ---
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

    const handleDepositDecision = async (depositId, decision) => {
        if(!window.confirm(`${decision} this deposit?`)) return;
        setLoading(true);
        try {
            await api.post('/api/payments/admin/deposits/review', { depositId, decision });
            alert(`Deposit ${decision}!`);
            setRefreshKey(k=>k+1);
        } catch (e) { 
            alert("Failed to update status"); 
        }
        setLoading(false);
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if(!newCat.name) return;
        setLoading(true);
        try {
            await api.post('/api/settings/categories', newCat);
            setNewCat({ name: "", description: "", amount: "" });
            const res = await api.get('/api/settings/categories');
            setCategories(res.data);
            alert("Category Added!");
        } catch(err) {
            alert(err.response?.data?.error || "Failed");
        }
        setLoading(false);
    };

    const handleDeleteCategory = async (id) => {
        if(!window.confirm("Are you sure? This hides the category from future deposits.")) return;
        try {
            await api.delete(`/api/settings/categories/${id}`);
            const res = await api.get('/api/settings/categories');
            setCategories(res.data);
        } catch(err) { alert("Failed"); }
    };

    // --- HELPER COMPONENT ---
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

    const totalPendingPayouts = queue.reduce((acc, item) => acc + parseFloat(item.amount_requested), 0);
    const liquidityStatus = stats.availableFunds >= totalPendingPayouts ? 'healthy' : 'critical';

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Treasury Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                
                {/* Navigation Tabs */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex gap-2 flex-wrap justify-center">
                        <button 
                            onClick={() => setActiveTab('queue')} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'queue' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Disbursements {queue.length > 0 && <span className="ml-1 bg-indigo-500 text-white px-1.5 rounded-full text-xs">{queue.length}</span>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('verification')} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'verification' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Verify Deposits {pendingDeposits.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingDeposits.length}</span>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('portfolio')} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'portfolio' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Active Portfolio
                        </button>
                        <button 
                            onClick={() => setActiveTab('finance')} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'finance' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Financial Records
                        </button>
                        <button 
                            onClick={() => setActiveTab('reports')} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <PieChart size={16}/> Advanced Reports
                        </button>
                        <button 
                            onClick={() => setActiveTab('settings')} 
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Settings size={16}/> Categories
                        </button>
                    </div>
                </div>

                {/* 1. DISBURSEMENT QUEUE */}
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

                {/* 2. VERIFICATION TAB (NEW) */}
                {activeTab === 'verification' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                                <h3 className="font-bold text-amber-800 flex items-center gap-2"><Shield size={18}/> Pending Deposit Verifications</h3>
                            </div>
                            {pendingDeposits.length === 0 ? <div className="p-12 text-center text-slate-400">All deposits have been processed.</div> : 
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Member</th><th className="px-6 py-3">Reference</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3 text-right">Decision</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pendingDeposits.map(d => (
                                            <tr key={d.id} className="hover:bg-amber-50/50">
                                                <td className="px-6 py-4 text-slate-500 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 font-bold text-slate-700">{d.full_name}</td>
                                                <td className="px-6 py-4 font-mono text-xs">{d.transaction_ref}<br/><span className="text-[10px] text-slate-400">{d.description}</span></td>
                                                <td className="px-6 py-4 font-bold text-emerald-600">KES {parseFloat(d.amount).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button onClick={()=>handleDepositDecision(d.id, 'COMPLETED')} disabled={loading} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm flex items-center gap-1"><CheckCircle size={14}/> Approve</button>
                                                    <button onClick={()=>handleDepositDecision(d.id, 'REJECTED')} disabled={loading} className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200 border border-red-200">Reject</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>}
                        </div>
                    </div>
                )}

                {/* 3. FINANCE RECORDS */}
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

                {/* 4. ACTIVE PORTFOLIO (NEW) */}
                {activeTab === 'portfolio' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <List className="text-indigo-600"/> Active Loan Portfolio
                            </h3>
                            <span className="text-xs font-bold bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-600">
                                {portfolio.length} Active Loans
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="px-6 py-3">Member</th>
                                        <th className="px-6 py-3">Disbursed On</th>
                                        <th className="px-6 py-3">Principal + Interest</th>
                                        <th className="px-6 py-3">Amount Repaid</th>
                                        <th className="px-6 py-3">Balance</th>
                                        <th className="px-6 py-3 text-center">Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {portfolio.map(loan => (
                                        <tr key={loan.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">{loan.full_name}</td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-700">KES {parseFloat(loan.total_due).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-emerald-600 font-bold">KES {parseFloat(loan.amount_repaid).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-red-600 font-bold">KES {parseFloat(loan.outstanding_balance).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{width: `${loan.progress}%`}}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-indigo-600">{loan.progress}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {portfolio.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400">No active loans found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ADVANCED REPORTS TAB */}
                {activeTab === 'reports' && (
                    <AdvancedReporting />
                )}

                {/* CATEGORY MANAGEMENT TAB */}
                {activeTab === 'settings' && (
                    <div className="max-w-4xl mx-auto animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FolderPlus size={20}/></div>
                                <h2 className="text-lg font-bold text-slate-800">Contribution Categories</h2>
                            </div>

                            <form onSubmit={handleAddCategory} className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Create New Category</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <input 
                                        type="text" 
                                        placeholder="Category Name (e.g. Welfare, Plot Project)" 
                                        className="w-full border p-2 rounded-lg text-sm"
                                        value={newCat.name}
                                        onChange={(e) => setNewCat({...newCat, name: e.target.value})}
                                        required
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Short Description (Optional)" 
                                        className="w-full border p-2 rounded-lg text-sm"
                                        value={newCat.description}
                                        onChange={(e) => setNewCat({...newCat, description: e.target.value})}
                                    />
                                    <input 
                                        type="number" 
                                        placeholder="Default Amount (KES) - Optional" 
                                        className="w-full border p-2 rounded-lg text-sm font-mono"
                                        value={newCat.amount}
                                        onChange={(e) => setNewCat({...newCat, amount: e.target.value})}
                                        min="0"
                                    />
                                    <button disabled={loading} className="bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition">
                                        {loading ? "Adding..." : "+ Add Category"}
                                    </button>
                                </div>
                            </form>

                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Active Categories</h3>
                                {categories.length === 0 ? <p className="text-sm text-slate-400 italic">No custom categories defined.</p> : (
                                    <div className="space-y-2">
                                        {categories.map(cat => (
                                            <div key={cat.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800">{cat.description || cat.name}</p>
                                                    <p className="text-xs text-slate-400 font-mono">Code: {cat.name} {cat.amount > 0 && `• Amount: KES ${parseFloat(cat.amount).toLocaleString()}`}</p>
                                                </div>
                                                <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}