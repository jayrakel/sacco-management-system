import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    Users, Gavel, CheckCircle, UserPlus, Search, 
    Shield, Mail, Phone, Calendar, FileText, 
    DollarSign, TrendingUp, Briefcase 
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function AdminDashboard({ user, onLogout }) {
    // Tabs: 'voting' | 'users' | 'finance' | 'register'
    const [activeTab, setActiveTab] = useState('voting');
    
    // Data States
    const [agenda, setAgenda] = useState([]);
    const [users, setUsers] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Register Form Data
    const [regForm, setRegForm] = useState({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
    const [loading, setLoading] = useState(false);
    
    // Refresh trigger
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (activeTab === 'voting') {
                    const res = await api.get('/api/loan/admin/agenda');
                    setAgenda(res.data);
                } else if (activeTab === 'users') {
                    const res = await api.get('/api/auth/users');
                    setUsers(res.data);
                } else if (activeTab === 'finance') {
                    // Fetch all deposits
                    const res = await api.get('/api/deposits/admin/all');
                    setDeposits(res.data);
                }
            } catch (err) {
                console.error("Failed to fetch data", err);
            }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    // --- ACTIONS ---

    const openVoting = async (loanId) => {
        if (!window.confirm("Open voting for this loan?")) return;
        try {
            await api.post('/api/loan/admin/open-voting', { loanId });
            setRefreshKey(k => k + 1);
            alert("Voting opened!");
        } catch (err) { alert("Action failed"); }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/auth/register', regForm);
            alert("Member registered!");
            setRegForm({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
        } catch (err) { alert(err.response?.data?.error || "Failed"); }
        setLoading(false);
    };

    // --- UI HELPERS ---

    const filteredUsers = users.filter(u => 
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderTabButton = (id, label, icon) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition ${
                activeTab === id ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
            }`}
        >
            {icon} {label}
        </button>
    );

    // Calculate Total Savings
    const totalSavings = deposits.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Admin & Chairperson Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                {/* Page Header */}
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                <Shield className="text-indigo-400" /> Administration
                            </h1>
                            <p className="text-indigo-300 text-sm mt-1">System Overview and Management</p>
                        </div>
                        <div className="flex bg-indigo-950/50 p-1.5 rounded-xl overflow-x-auto max-w-full border border-indigo-800/50">
                            {renderTabButton('voting', 'Voting', <Gavel size={16}/>)}
                            {renderTabButton('users', 'Members', <Users size={16}/>)}
                            {renderTabButton('finance', 'Finances', <TrendingUp size={16}/>)}
                            {renderTabButton('register', 'New User', <UserPlus size={16}/>)}
                        </div>
                    </div>
                </div>

                {/* 1. VOTING TAB */}
                {activeTab === 'voting' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Gavel className="text-indigo-600" /> Action Items: Loans Pending Vote
                        </h2>
                        {agenda.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                                <p>No tabled loans available for voting.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {agenda.map(item => (
                                    <div key={item.id} className="flex flex-col sm:flex-row items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
                                        <div>
                                            <p className="font-bold text-slate-800 text-lg">{item.full_name}</p>
                                            <p className="text-sm text-slate-500">Requesting: KES {parseFloat(item.amount_requested).toLocaleString()}</p>
                                            <p className="text-xs text-slate-400 italic mt-1">"{item.purpose}"</p>
                                        </div>
                                        <button onClick={() => openVoting(item.id)}
                                            className="mt-4 sm:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition flex items-center gap-2">
                                            Open Floor <CheckCircle size={16}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. MEMBERS TAB */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                            <h2 className="text-xl font-bold text-slate-800">Member Directory</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input type="text" placeholder="Search members..." 
                                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                                    <tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Contact</th><th className="px-6 py-3">Joined</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 font-medium text-slate-900">{u.full_name}</td>
                                            <td className="px-6 py-3"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                                            <td className="px-6 py-3">{u.email}<br/><span className="text-xs text-slate-400">{u.phone_number}</span></td>
                                            <td className="px-6 py-3">{new Date(u.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. FINANCIALS TAB (DEPOSITS) */}
                {activeTab === 'finance' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Summary Card */}
                        <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg flex items-center justify-between">
                            <div>
                                <p className="text-emerald-100 font-bold text-sm uppercase">Total Sacco Assets (Deposits)</p>
                                <h2 className="text-3xl font-bold mt-1">KES {totalSavings.toLocaleString()}</h2>
                            </div>
                            <div className="bg-white/20 p-3 rounded-xl">
                                <DollarSign size={32} />
                            </div>
                        </div>

                        {/* Detailed List */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                <FileText className="text-slate-500"/> <h3 className="font-bold text-slate-800">Deposit History Log</h3>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto">
                                <table className="w-full text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-xs uppercase font-bold sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3 text-left">Member</th>
                                            <th className="px-6 py-3 text-left">Reference</th>
                                            <th className="px-6 py-3 text-right">Amount</th>
                                            <th className="px-6 py-3 text-center">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {deposits.length === 0 ? (
                                            <tr><td colSpan="4" className="p-8 text-center text-slate-400 italic">No deposits recorded yet.</td></tr>
                                        ) : deposits.map(d => (
                                            <tr key={d.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-medium text-slate-900">{d.full_name}</td>
                                                <td className="px-6 py-3 font-mono text-xs text-slate-500">{d.transaction_ref}</td>
                                                <td className="px-6 py-3 text-right font-mono text-emerald-600 font-bold">+{parseFloat(d.amount).toLocaleString()}</td>
                                                <td className="px-6 py-3 text-xs text-slate-400 text-center">{new Date(d.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. REGISTER TAB */}
                {activeTab === 'register' && (
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-indigo-100 p-8 animate-fade-in">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <UserPlus className="text-emerald-600"/> Register New Member
                        </h2>
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                    <input required type="text" className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                                    <input required type="tel" className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={regForm.phoneNumber} onChange={e => setRegForm({...regForm, phoneNumber: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                                <input required type="email" className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                    value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Default Password</label>
                                    <input required type="text" className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                                    <select className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        value={regForm.role} onChange={e => setRegForm({...regForm, role: e.target.value})}>
                                        <option value="MEMBER">Member</option>
                                        <option value="SECRETARY">Secretary</option>
                                        <option value="TREASURER">Treasurer</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-100 transition mt-4">
                                {loading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}