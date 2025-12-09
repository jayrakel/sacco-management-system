import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    FileText, CheckCircle, XCircle, Search, 
    AlertTriangle, TrendingUp, Users, DollarSign,
    Briefcase, Calendar
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function LoanOfficerDashboard({ user, onLogout }) {
    // Tabs: 'appraisals' (New Applications) | 'portfolio' (Active Loans) | 'defaulters' (Risk)
    const [activeTab, setActiveTab] = useState('appraisals');
    
    const [applications, setApplications] = useState([]);
    const [portfolio, setPortfolio] = useState([]);
    const [stats, setStats] = useState({ totalLoans: 0, activeValue: 0, atRisk: 0 });
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // FIXED: Use correct endpoint for both tabs
                const res = await api.get('/api/loan/officer/applications');
                
                if (activeTab === 'appraisals') {
                    // Filter for pending loans
                    const pending = res.data.filter(l => ['SUBMITTED', 'PENDING_GUARANTORS'].includes(l.status));
                    setApplications(pending);
                } else if (activeTab === 'portfolio' || activeTab === 'defaulters') {
                    // Filter for active loans
                    const active = res.data.filter(l => ['ACTIVE', 'IN_ARREARS', 'OVERDUE'].includes(l.status));
                    setPortfolio(active);
                    
                    // Calculate basic stats
                    const totalVal = active.reduce((acc, curr) => acc + parseFloat(curr.amount_requested), 0);
                    setStats({ 
                        totalLoans: active.length, 
                        activeValue: totalVal,
                        atRisk: active.filter(l => l.status === 'IN_ARREARS' || l.status === 'OVERDUE').length 
                    });
                }
            } catch (err) {
                console.error("Failed to fetch loan data", err);
            }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    // --- ACTIONS ---

    const verifyApplication = async (loanId) => {
        if (!window.confirm("Verify this application? It will be marked as reviewed.")) return;
        setLoading(true);
        try {
            await api.post('/api/loan/officer/verify', { loanId });
            alert("Application verified successfully!");
            setRefreshKey(k => k + 1);
        } catch (err) {
            alert(err.response?.data?.error || "Verification failed");
        }
        setLoading(false);
    };

    // --- UI HELPERS ---

    const renderTabButton = (id, label, icon) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold text-sm transition ${
                activeTab === id ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
            }`}
        >
            {icon} {label}
        </button>
    );

    const filteredApps = applications.filter(a => 
        a.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.purpose?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Loan Officer Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                
                {/* Header Section */}
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                <Briefcase className="text-indigo-400" /> Credit Department
                            </h1>
                            <p className="text-indigo-300 text-sm mt-1">Appraise applications and monitor portfolio health.</p>
                        </div>
                        <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50">
                            {renderTabButton('appraisals', 'Appraisals', <FileText size={16}/>)}
                            {renderTabButton('portfolio', 'Active Portfolio', <TrendingUp size={16}/>)}
                            {renderTabButton('defaulters', 'Risk Watch', <AlertTriangle size={16}/>)}
                        </div>
                    </div>
                </div>

                {/* TAB 1: APPRAISALS */}
                {activeTab === 'appraisals' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="text-indigo-600" /> Pending Applications
                            </h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input type="text" placeholder="Search applicant..." 
                                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {filteredApps.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 italic">No applications pending review.</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredApps.map(app => (
                                    <div key={app.id} className="p-6 hover:bg-slate-50 transition flex flex-col md:flex-row items-start justify-between gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-bold text-slate-800 text-lg">{app.full_name}</h3>
                                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">{app.status}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 mb-2">
                                                <p><span className="font-bold">Requested:</span> KES {parseFloat(app.amount_requested).toLocaleString()}</p>
                                                <p><span className="font-bold">Period:</span> {app.repayment_weeks} Weeks</p>
                                                <p className="col-span-2"><span className="font-bold">Purpose:</span> "{app.purpose}"</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => verifyApplication(app.id)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg transition"
                                            >
                                                <CheckCircle size={16}/> Verify & Recommend
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2 & 3: PORTFOLIO / RISK */}
                {(activeTab === 'portfolio' || activeTab === 'defaulters') && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-slate-500 text-xs font-bold uppercase">Active Loans</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.totalLoans}</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-slate-500 text-xs font-bold uppercase">Portfolio Value</p>
                                <p className="text-2xl font-bold text-emerald-600">KES {stats.activeValue.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-slate-500 text-xs font-bold uppercase">Loans at Risk</p>
                                <p className="text-2xl font-bold text-red-600">{stats.atRisk}</p>
                            </div>
                        </div>

                        {/* List */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-bold text-slate-800">
                                    {activeTab === 'defaulters' ? 'High Risk Accounts (In Arrears)' : 'Active Loan Portfolio'}
                                </h3>
                            </div>
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="px-6 py-3">Member</th>
                                        <th className="px-6 py-3">Loan Amount</th>
                                        <th className="px-6 py-3">Balance</th>
                                        <th className="px-6 py-3">Progress</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {portfolio.map(loan => {
                                        const repaid = parseFloat(loan.amount_repaid);
                                        const due = parseFloat(loan.total_due);
                                        const progress = due > 0 ? (repaid / due) * 100 : 0;
                                        const balance = due - repaid;
                                        
                                        return (
                                            <tr key={loan.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    {loan.full_name} <br/> 
                                                    <span className="text-xs text-slate-400 font-mono">REF: {loan.id}</span>
                                                </td>
                                                <td className="px-6 py-4">KES {due.toLocaleString()}</td>
                                                <td className="px-6 py-4 font-bold text-slate-700">
                                                    KES {balance.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="w-24 bg-slate-200 rounded-full h-1.5">
                                                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                                    </div>
                                                    <span className="text-xs text-slate-400">{progress.toFixed(0)}% Repaid</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${['IN_ARREARS', 'OVERDUE'].includes(loan.status) ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {loan.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {portfolio.length === 0 && (
                                        <tr><td colSpan="5" className="p-8 text-center text-slate-400">No loans found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}