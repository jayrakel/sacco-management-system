import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    Users, UserPlus, Search, Shield, Settings, 
    Save, Trash2, Key
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function AdminDashboard({ user, onLogout }) {
    // Added 'register' back to activeTab
    const [activeTab, setActiveTab] = useState('users');
    
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState([]); 
    const [searchTerm, setSearchTerm] = useState('');
    // Added registration form state
    const [regForm, setRegForm] = useState({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (activeTab === 'users') {
                    const res = await api.get('/api/auth/users');
                    setUsers(res.data);
                } else if (activeTab === 'settings') {
                    const res = await api.get('/api/settings');
                    // Admin sees ONLY 'SYSTEM' settings
                    setSettings(res.data.filter(s => s.category === 'SYSTEM'));
                }
            } catch (err) {
                console.error("Fetch Error", err);
            }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    // --- ACTIONS ---

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/auth/register', regForm);
            alert("User registered successfully!");
            setRegForm({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
        } catch (err) {
            alert(err.response?.data?.error || "Registration failed");
        }
        setLoading(false);
    };

    const handlePasswordReset = async (userId, name) => {
        if(!window.confirm(`Reset password for ${name} to default '123456'?`)) return;
        try {
            await api.post(`/api/auth/users/${userId}/reset-password`);
            alert("Password reset successfully.");
        } catch(e) { alert("Failed to reset password"); }
    };

    const handleDeleteUser = async (userId) => {
        if(!window.confirm("Are you sure? This will delete the user and all their data!")) return;
        try {
            await api.delete(`/api/auth/users/${userId}`);
            setUsers(users.filter(u => u.id !== userId));
            alert("User deleted.");
        } catch(e) { alert("Failed to delete user"); }
    };

    const handleSettingUpdate = async (key, newValue) => {
        try {
            await api.post('/api/settings/update', { key, value: newValue });
            setSettings(prev => prev.map(s => s.setting_key === key ? { ...s, setting_value: newValue } : s));
            alert("Configuration saved.");
        } catch (err) { alert("Update failed"); }
    };

    // --- RENDER HELPERS ---

    const filteredUsers = users.filter(u => u.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

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
            <DashboardHeader user={user} onLogout={onLogout} title="System Administrator" />

            <main className="max-w-7xl mx-auto px-6 mt-8 pb-12">
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <Shield className="text-blue-400" /> IT & System Management
                        </h1>
                        <p className="text-indigo-300 text-sm mt-1">Manage user access and system configuration.</p>
                    </div>
                    <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50">
                        {renderTabButton('users', 'User Management', <Users size={16}/>)}
                        {renderTabButton('register', 'Add User', <UserPlus size={16}/>)}
                        {renderTabButton('settings', 'System Config', <Settings size={16}/>)}
                    </div>
                </div>

                {/* 1. USERS TAB */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">System Users</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input type="text" placeholder="Search..." 
                                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                                <tr><th className="px-6 py-3">User</th><th className="px-6 py-3">Role</th><th className="px-6 py-3 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 font-medium text-slate-900">{u.full_name}<br/><span className="text-xs text-slate-400">{u.email}</span></td>
                                        <td className="px-6 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                                        <td className="px-6 py-3 text-right flex justify-end gap-2">
                                            <button onClick={() => handlePasswordReset(u.id, u.full_name)} className="p-2 text-amber-600 hover:bg-amber-50 rounded" title="Reset Password"><Key size={16}/></button>
                                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Delete User"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 2. SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings className="text-slate-600" /> Global System Configuration</h2>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {settings.length === 0 ? <p className="p-8 text-center text-slate-400">No System settings found.</p> :
                            settings.map((setting) => (
                                <div key={setting.setting_key} className="p-6 flex justify-between items-center gap-4 hover:bg-slate-50">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800 capitalize">{setting.setting_key.replace(/_/g, ' ')}</h3>
                                        <p className="text-slate-500 text-sm mt-1">{setting.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="text" defaultValue={setting.setting_value} id={`input-${setting.setting_key}`} className="border rounded-lg px-4 py-2 w-32 text-right font-mono" />
                                        <button onClick={() => handleSettingUpdate(setting.setting_key, document.getElementById(`input-${setting.setting_key}`).value)} className="bg-indigo-600 text-white p-2 rounded-lg"><Save size={20} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. REGISTER TAB (RESTORED) */}
                {activeTab === 'register' && (
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-indigo-100 p-8">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><UserPlus className="text-emerald-600"/> Create New Account</h2>
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <input required type="text" placeholder="Full Name" className="border p-3 rounded-xl w-full" value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} />
                                <input required type="tel" placeholder="Phone" className="border p-3 rounded-xl w-full" value={regForm.phoneNumber} onChange={e => setRegForm({...regForm, phoneNumber: e.target.value})} />
                            </div>
                            <input required type="email" placeholder="Email" className="border p-3 rounded-xl w-full" value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <input required type="text" placeholder="Password" className="border p-3 rounded-xl w-full" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} />
                                <select className="border p-3 rounded-xl w-full bg-white" value={regForm.role} onChange={e => setRegForm({...regForm, role: e.target.value})}>
                                    <option value="MEMBER">Member</option>
                                    <option value="LOAN_OFFICER">Loan Officer</option>
                                    <option value="SECRETARY">Secretary</option>
                                    <option value="TREASURER">Treasurer</option>
                                    <option value="CHAIRPERSON">Chairperson</option>
                                    <option value="ADMIN">System Admin</option>
                                </select>
                            </div>
                            <button disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{loading ? 'Creating...' : 'Create Account'}</button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}