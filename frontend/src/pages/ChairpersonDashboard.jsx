import React, { useState, useEffect } from 'react';
import api from '../api';
import { Gavel, CheckCircle, TrendingUp, Users, DollarSign, FileText } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function ChairpersonDashboard({ user, onLogout }) {
    // Governance Tasks: Voting, Financial Overview, Member List
    const [activeTab, setActiveTab] = useState('voting');
    
    const [agenda, setAgenda] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [users, setUsers] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (activeTab === 'voting') {
                    const res = await api.get('/api/loan/chair/agenda');
                    setAgenda(res.data);
                } else if (activeTab === 'finance') {
                    const res = await api.get('/api/deposits/admin/all'); // Authorized for Chair now
                    setDeposits(res.data);
                } else if (activeTab === 'members') {
                    const res = await api.get('/api/auth/users'); // Authorized for Chair now
                    setUsers(res.data);
                }
            } catch (err) {
                console.error("Fetch failed", err);
            }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    const openVoting = async (loanId) => {
        if (!window.confirm("Open the floor for voting?")) return;
        try {
            await api.post('/api/loan/chair/open-voting', { loanId });
            setRefreshKey(k => k + 1);
            alert("Voting session opened!");
        } catch (err) { alert("Error opening voting"); }
    };

    const totalSavings = deposits.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

    const renderTabButton = (id, label, icon) => (
        <button onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold text-sm transition ${
                activeTab === id ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
            }`}>
            {icon} {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Chairperson Panel" />

            <main className="max-w-7xl mx-auto px-6 mt-8 pb-12">
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <Gavel className="text-amber-400" /> Governance Dashboard
                        </h1>
                        <p className="text-indigo-300 text-sm mt-1">Oversee voting, finances, and membership.</p>
                    </div>
                    <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50">
                        {renderTabButton('voting', 'Voting Agenda', <Gavel size={16}/>)}
                        {renderTabButton('finance', 'Financials', <TrendingUp size={16}/>)}
                        {renderTabButton('members', 'Member List', <Users size={16}/>)}
                    </div>
                </div>

                {/* 1. VOTING TAB */}
                {activeTab === 'voting' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
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
                                    <div key={item.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
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

                {/* 2. FINANCE TAB */}
                {activeTab === 'finance' && (
                    <div className="space-y-6">
                        <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg flex items-center justify-between">
                            <div>
                                <p className="text-emerald-100 font-bold text-sm uppercase">Total Sacco Assets</p>
                                <h2 className="text-3xl font-bold mt-1">KES {totalSavings.toLocaleString()}</h2>
                            </div>
                            <div className="bg-white/20 p-3 rounded-xl"><DollarSign size={32} /></div>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={16}/> Deposit History</h3>
                            </div>
                            <table className="w-full text-sm text-slate-600 text-left">
                                <thead className="bg-slate-50 text-xs uppercase font-bold">
                                    <tr><th className="px-6 py-3">Member</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3">Date</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {deposits.map(d => (
                                        <tr key={d.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 font-medium text-slate-900">{d.full_name}</td>
                                            <td className="px-6 py-3 font-mono text-emerald-600 font-bold">+{parseFloat(d.amount).toLocaleString()}</td>
                                            <td className="px-6 py-3 text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. MEMBERS TAB */}
                {activeTab === 'members' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-800">Member Directory</h2></div>
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                                <tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Contact</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 font-medium text-slate-900">{u.full_name}</td>
                                        <td className="px-6 py-3"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                                        <td className="px-6 py-3">{u.email}<br/><span className="text-xs text-slate-400">{u.phone_number}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}