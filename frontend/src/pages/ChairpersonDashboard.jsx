import React, { useState, useEffect } from 'react';
import api from '../api';
import { Gavel, TrendingUp, Users, Settings, UserPlus, Save, DollarSign, FileText } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function ChairpersonDashboard({ user, onLogout }) {
    // Added 'settings' and 'register' tabs
    const [activeTab, setActiveTab] = useState('voting');
    
    // State
    const [agenda, setAgenda] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [users, setUsers] = useState([]);
    const [saccoSettings, setSaccoSettings] = useState([]); // Filtered Sacco Settings
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
                    const res = await api.get('/api/deposits/admin/all');
                    setDeposits(res.data);
                } else if (activeTab === 'members') {
                    const res = await api.get('/api/auth/users');
                    setUsers(res.data);
                } else if (activeTab === 'settings') {
                    const res = await api.get('/api/settings');
                    // Filter specifically for SACCO category
                    setSaccoSettings(res.data.filter(s => s.category === 'SACCO'));
                }
            } catch (err) { console.error("Fetch failed", err); }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    // ACTIONS
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${
                activeTab === id ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'
            }`}>
            {icon} {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Chairperson Panel" />

            <main className="max-w-7xl mx-auto px-6 mt-8 pb-12">
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3"><Gavel className="text-amber-400" /> Chairperson's Office</h1>
                            <p className="text-indigo-300 text-sm mt-1">Governance, Policy & Membership.</p>
                        </div>
                        <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50 overflow-x-auto">
                            {renderTabButton('voting', 'Voting', <Gavel size={16}/>)}
                            {renderTabButton('finance', 'Finance', <TrendingUp size={16}/>)}
                            {renderTabButton('members', 'Directory', <Users size={16}/>)}
                            {renderTabButton('settings', 'Sacco Policies', <Settings size={16}/>)}
                            {renderTabButton('register', 'Add Member', <UserPlus size={16}/>)}
                        </div>
                    </div>
                </div>

                {/* --- EXISTING TABS (Voting, Finance, Members) --- */}
                {/* (Keep the previous logic for 'voting', 'finance', 'members' here) */}
                {/* ... */}

                {/* 4. SACCO SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-indigo-100 p-8">
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