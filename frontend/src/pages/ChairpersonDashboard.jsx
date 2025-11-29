import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    Gavel, 
    TrendingUp, 
    Users, 
    Settings, 
    UserPlus, 
    Save, 
    DollarSign, 
    FileText,
    CheckCircle,
    AlertCircle,
    FileWarning,
    Briefcase
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function ChairpersonDashboard({ user, onLogout }) {
    // Main Tabs
    const [activeTab, setActiveTab] = useState('finance'); 
    
    // Finance Sub-Tabs
    const [financeSubTab, setFinanceSubTab] = useState('overview');

    // Data State
    const [agenda, setAgenda] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [transactions, setTransactions] = useState([]); // Stores fees, fines, penalties
    const [users, setUsers] = useState([]);
    const [saccoSettings, setSaccoSettings] = useState([]); 
    
    // Forms & UI State
    const [regForm, setRegForm] = useState({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (activeTab === 'voting') {
                    const res = await api.get('/api/loan/chair/agenda');
                    setAgenda(res.data);
                } else if (activeTab === 'finance') {
                    // Fetch both Deposits and General Transactions
                    const [resDeposits, resTrans] = await Promise.all([
                        api.get('/api/deposits/admin/all'),
                        api.get('/api/payments/admin/all')
                    ]);
                    setDeposits(resDeposits.data);
                    setTransactions(resTrans.data);
                } else if (activeTab === 'members') {
                    const res = await api.get('/api/auth/users');
                    setUsers(res.data);
                } else if (activeTab === 'settings') {
                    const res = await api.get('/api/settings');
                    setSaccoSettings(res.data.filter(s => s.category === 'SACCO'));
                }
            } catch (err) {
                console.error("Fetch failed", err);
            }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    // --- FINANCIAL CALCULATIONS ---
    const calcTotal = (type) => {
        if (type === 'DEPOSIT') return deposits.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
        return transactions
            .filter(t => t.type === type)
            .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
    };

    const stats = {
        deposits: calcTotal('DEPOSIT'),
        appFees: calcTotal('FEE_PAYMENT'),
        // Assuming types 'FINE', 'PENALTY', 'LOAN_FORM' exist in your system logic or will be added
        fines: calcTotal('FINE'),
        penalties: calcTotal('PENALTY'),
        loanForms: calcTotal('LOAN_FORM'),
    };

    const totalAssets = Object.values(stats).reduce((a, b) => a + b, 0);

    // --- ACTIONS ---
    const openVoting = async (loanId) => {
        if (!window.confirm("Open the floor for voting?")) return;
        try {
            await api.post('/api/loan/chair/open-voting', { loanId });
            setRefreshKey(k => k + 1);
            alert("Voting session opened!");
        } catch (err) { alert("Error opening voting"); }
    };

    const handleSettingUpdate = async (key, newValue) => {
        try {
            await api.post('/api/settings/update', { key, value: newValue });
            alert("Sacco Policy Updated.");
            setRefreshKey(k => k + 1);
        } catch (err) { alert(err.response?.data?.error || "Update failed"); }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/auth/register', regForm);
            alert("New Member Registered!");
            setRegForm({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
        } catch (err) { alert(err.response?.data?.error || "Registration failed"); }
        setLoading(false);
    };

    const renderTabButton = (id, label, icon) => (
        <button onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition whitespace-nowrap ${
                activeTab === id ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'
            }`}>
            {icon} {label}
        </button>
    );

    // Helper for Finance Cards
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

    // Helper to render table rows based on selected sub-tab
    const renderFinanceTableRows = () => {
        let data = [];
        let typeLabel = '';

        switch(financeSubTab) {
            case 'deposits':
                data = deposits;
                typeLabel = 'DEPOSIT';
                break;
            case 'app_fees':
                data = transactions.filter(t => t.type === 'FEE_PAYMENT');
                typeLabel = 'APP FEE';
                break;
            case 'fines':
                data = transactions.filter(t => t.type === 'FINE');
                typeLabel = 'FINE';
                break;
            case 'penalties':
                data = transactions.filter(t => t.type === 'PENALTY');
                typeLabel = 'PENALTY';
                break;
            case 'loan_forms':
                data = transactions.filter(t => t.type === 'LOAN_FORM');
                typeLabel = 'FORM FEE';
                break;
            default: // overview shows recent mixed
                const recentDeps = deposits.slice(0, 5).map(d => ({...d, type: 'DEPOSIT'}));
                const recentTrans = transactions.slice(0, 5);
                data = [...recentDeps, ...recentTrans].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                typeLabel = 'MIXED';
        }

        if (data.length === 0) {
            return <tr><td colSpan="4" className="p-8 text-center text-slate-400">No records found for this category.</td></tr>;
        }

        return data.map((item, idx) => (
            <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-medium text-slate-900">{item.full_name}</td>
                <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                        {item.type || typeLabel}
                    </span>
                </td>
                <td className="px-6 py-4 font-mono text-slate-700 font-bold">
                    KES {parseFloat(item.amount).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">
                    {item.transaction_ref || item.reference_code} <br/>
                    {new Date(item.created_at).toLocaleDateString()}
                </td>
            </tr>
        ));
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Chairperson Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                
                {/* Header & Navigation */}
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                <Gavel className="text-amber-400" /> Chairperson's Office
                            </h1>
                            <p className="text-indigo-300 text-sm mt-1">Governance, Policy & Membership.</p>
                        </div>
                        <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50 overflow-x-auto max-w-full">
                            {renderTabButton('voting', 'Voting', <Gavel size={16}/>)}
                            {renderTabButton('finance', 'Finance', <TrendingUp size={16}/>)}
                            {renderTabButton('members', 'Directory', <Users size={16}/>)}
                            {renderTabButton('settings', 'Policies', <Settings size={16}/>)}
                            {renderTabButton('register', 'Add Member', <UserPlus size={16}/>)}
                        </div>
                    </div>
                </div>

                {/* 1. VOTING TAB */}
                {activeTab === 'voting' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Gavel className="text-indigo-600" /> Motions on the Floor
                        </h2>
                        {agenda.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                                <p>No motions tabled by the Secretary.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {agenda.map(item => (
                                    <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100 gap-4">
                                        <div>
                                            <p className="font-bold text-slate-800 text-lg">{item.full_name}</p>
                                            <p className="text-sm text-slate-500">Request: <span className="font-bold">KES {parseFloat(item.amount_requested).toLocaleString()}</span></p>
                                            <p className="text-xs text-slate-400 italic mt-1">"{item.purpose}"</p>
                                        </div>
                                        <button onClick={() => openVoting(item.id)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition flex items-center gap-2">
                                            Open Voting <CheckCircle size={16}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. FINANCE TAB (EXPANDED) */}
                {activeTab === 'finance' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Main Total Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl p-8 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <p className="text-emerald-100 font-bold text-sm uppercase tracking-widest">Total Sacco Assets</p>
                                <h2 className="text-4xl font-extrabold mt-2">KES {totalAssets.toLocaleString()}</h2>
                                <p className="text-sm text-emerald-100 mt-2 opacity-80">Consolidated balance of all accounts</p>
                            </div>
                            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                                <DollarSign size={48} className="text-emerald-100" />
                            </div>
                        </div>

                        {/* Breakdown Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <FinanceCard 
                                title="Deposits" 
                                amount={stats.deposits} 
                                icon={<TrendingUp size={20}/>} 
                                activeId="deposits" 
                                colorClass="emerald"
                            />
                            <FinanceCard 
                                title="App Fees" 
                                amount={stats.appFees} 
                                icon={<Briefcase size={20}/>} 
                                activeId="app_fees" 
                                colorClass="blue"
                            />
                            <FinanceCard 
                                title="Loan Forms" 
                                amount={stats.loanForms} 
                                icon={<FileText size={20}/>} 
                                activeId="loan_forms" 
                                colorClass="indigo"
                            />
                            <FinanceCard 
                                title="Fines" 
                                amount={stats.fines} 
                                icon={<AlertCircle size={20}/>} 
                                activeId="fines" 
                                colorClass="amber"
                            />
                            <FinanceCard 
                                title="Penalties" 
                                amount={stats.penalties} 
                                icon={<FileWarning size={20}/>} 
                                activeId="penalties" 
                                colorClass="red"
                            />
                        </div>

                        {/* Detailed List */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <FileText size={16} className="text-slate-500"/> 
                                    {financeSubTab === 'overview' ? 'Recent Transactions' : 
                                     financeSubTab === 'deposits' ? 'Deposit History' :
                                     financeSubTab === 'app_fees' ? 'Application Fees' :
                                     financeSubTab === 'loan_forms' ? 'Loan Form Purchases' :
                                     financeSubTab === 'fines' ? 'Fines & Citations' : 'Penalty Log'}
                                </h3>
                                {financeSubTab !== 'overview' && (
                                    <button onClick={() => setFinanceSubTab('overview')} className="text-xs font-bold text-indigo-600 hover:underline">
                                        View All
                                    </button>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-slate-600 text-left">
                                    <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-6 py-3">Member</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3">Amount</th>
                                            <th className="px-6 py-3">Reference / Date</th>
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

                {/* 3. MEMBERS TAB */}
                {activeTab === 'members' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Users className="text-indigo-600"/> Member Directory
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                                    <tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Contact</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 font-medium text-slate-900">{u.full_name}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    u.role === 'CHAIRPERSON' ? 'bg-amber-100 text-amber-700' : 
                                                    u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'
                                                }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span>{u.email}</span>
                                                    <span className="text-xs text-slate-400">{u.phone_number}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && <tr><td colSpan="3" className="p-6 text-center text-slate-400">No users found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. SACCO SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Settings className="text-indigo-600" /> Sacco Policy Configuration
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">Manage core business rules like interest rates and grace periods.</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {saccoSettings.length === 0 ? <p className="p-8 text-center text-slate-400">No Sacco settings found.</p> :
                            saccoSettings.map((setting) => (
                                <div key={setting.setting_key} className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4 hover:bg-slate-50">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800 capitalize">{setting.setting_key.replace(/_/g, ' ')}</h3>
                                        <p className="text-slate-500 text-sm mt-1">{setting.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="text" defaultValue={setting.setting_value} id={`input-${setting.setting_key}`} className="border p-2 rounded-lg w-32 text-right font-mono" />
                                        <button onClick={() => handleSettingUpdate(setting.setting_key, document.getElementById(`input-${setting.setting_key}`).value)} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"><Save size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. REGISTER MEMBER TAB */}
                {activeTab === 'register' && (
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-indigo-100 p-8 animate-fade-in">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <UserPlus className="text-emerald-600"/> Onboard New Member
                        </h2>
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <input required type="text" placeholder="Full Name" className="border p-3 rounded-xl w-full" value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} />
                                <input required type="tel" placeholder="Phone Number" className="border p-3 rounded-xl w-full" value={regForm.phoneNumber} onChange={e => setRegForm({...regForm, phoneNumber: e.target.value})} />
                            </div>
                            <input required type="email" placeholder="Email Address" className="border p-3 rounded-xl w-full" value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <input required type="text" placeholder="Default Password" className="border p-3 rounded-xl w-full" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} />
                                <select className="border p-3 rounded-xl w-full bg-white" value={regForm.role} onChange={e => setRegForm({...regForm, role: e.target.value})}>
                                    <option value="MEMBER">Member</option>
                                    <option value="SECRETARY">Secretary</option>
                                    <option value="TREASURER">Treasurer</option>
                                    <option value="LOAN_OFFICER">Loan Officer</option>
                                    <option value="ADMIN">System Admin</option>
                                </select>
                            </div>
                            <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition">
                                {loading ? 'Processing...' : 'Create Account'}
                            </button>
                        </form>
                    </div>
                )}

            </main>
        </div>
    );
}