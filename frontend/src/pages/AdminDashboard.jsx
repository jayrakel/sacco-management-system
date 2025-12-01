import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { 
    Users, UserPlus, Search, Shield, Settings, 
    Upload, Image as ImageIcon, Edit2, Save, X
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function AdminDashboard({ user, onLogout }) {
    // Default to 'users' since voting/finance are gone
    const [activeTab, setActiveTab] = useState('users');
    
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState([]); 
    const [searchTerm, setSearchTerm] = useState('');
    
    // Member Management State
    const [editingUser, setEditingUser] = useState(null); // The user object currently being edited
    const [editForm, setEditForm] = useState({ fullName: '', email: '', phoneNumber: '', role: '', password: '' });

    // Registration Form
    const [regForm, setRegForm] = useState({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    
    const navigate = useNavigate();

    // --- SECURITY: FIRST-TIME SETUP CHECK ---
    useEffect(() => {
        const checkSetup = async () => {
            try {
                const res = await api.get('/api/auth/setup-status');
                if (!res.data.isComplete) {
                    navigate('/setup-users');
                }
            } catch (err) {
                console.error("Setup check failed", err);
            }
        };
        checkSetup();
    }, [navigate]);

    // Filter Users
    const filteredUsers = users.filter(user => 
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (activeTab === 'users') {
                    const res = await api.get('/api/auth/users');
                    setUsers(res.data);
                } else if (activeTab === 'settings') {
                    const res = await api.get('/api/settings');
                    setSettings(res.data);
                }
            } catch (err) {
                console.error("Failed to fetch data", err);
            }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    // --- MEMBER ACTIONS ---
    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/auth/register', regForm);
            alert("Member registered successfully!");
            setRegForm({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
        } catch (err) {
            alert(err.response?.data?.error || "Registration failed");
        }
        setLoading(false);
    };

    const startEditUser = (user) => {
        setEditingUser(user);
        setEditForm({
            fullName: user.full_name,
            email: user.email,
            phoneNumber: user.phone_number,
            role: user.role,
            password: '' // Empty by default
        });
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!editingUser) return;
        setLoading(true);
        try {
            await api.put(`/api/auth/admin/update/${editingUser.id}`, editForm);
            alert("User updated successfully!");
            setEditingUser(null); // Close modal
            setRefreshKey(k => k + 1); // Refresh list
        } catch (err) {
            alert(err.response?.data?.error || "Update failed");
        }
        setLoading(false);
    };

    // --- SETTINGS ACTIONS ---
    const handleSettingUpdate = async (key, newValue) => {
        const valStr = String(newValue);
        try {
            await api.post('/api/settings/update', { key, value: valStr });
            setSettings(prev => {
                const exists = prev.find(s => s.setting_key === key);
                if (exists) {
                    return prev.map(s => s.setting_key === key ? { ...s, setting_value: valStr } : s);
                } else {
                    return [...prev, { setting_key: key, setting_value: valStr, description: 'System Setting' }];
                }
            });
            alert("Setting saved!");
        } catch (err) {
            console.error(err);
            alert("Failed to update setting. Ensure file is < 10MB");
        }
    };

    const getSettingValue = (key) => {
        const s = settings.find(x => x.setting_key === key);
        return s ? s.setting_value : ''; 
    };

    const handleFileUpload = (key, e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { // 10MB Limit
            alert("File size too large. Max 10MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => { handleSettingUpdate(key, reader.result); };
        reader.readAsDataURL(file);
    };

    // --- RENDERERS ---
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

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Admin Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                <Shield className="text-indigo-400" /> Administration
                            </h1>
                            <p className="text-indigo-300 text-sm mt-1">System Overview and Management</p>
                        </div>
                        <div className="flex bg-indigo-950/50 p-1.5 rounded-xl overflow-x-auto max-w-full border border-indigo-800/50 scrollbar-hide">
                            {/* Updated Tabs: Removed Voting & Finance */}
                            {renderTabButton('users', 'Members', <Users size={16}/>)}
                            {renderTabButton('settings', 'Branding', <Settings size={16}/>)}
                            {renderTabButton('register', 'New User', <UserPlus size={16}/>)}
                        </div>
                    </div>
                </div>

                {/* 1. MEMBERS TAB (Enhanced) */}
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
                                    <tr>
                                        <th className="px-6 py-3">Name</th>
                                        <th className="px-6 py-3">Role</th>
                                        <th className="px-6 py-3">Contact</th>
                                        <th className="px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 font-medium text-slate-900">{u.full_name}</td>
                                            <td className="px-6 py-3"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                                            <td className="px-6 py-3">{u.email}<br/><span className="text-xs text-slate-400">{u.phone_number}</span></td>
                                            <td className="px-6 py-3">
                                                <button 
                                                    onClick={() => startEditUser(u)}
                                                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
                                                >
                                                    <Edit2 size={12}/> Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. CONFIGURATION TAB (Simplified) */}
                {activeTab === 'settings' && (
                    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
                        {/* SYSTEM BRANDING ONLY */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
                            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-2">
                                <ImageIcon className="text-indigo-600" size={20}/>
                                <h3 className="text-lg font-bold text-slate-800">System Branding</h3>
                            </div>
                            
                            <div className="mb-8">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Organization Group Name</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                                        defaultValue={getSettingValue('sacco_name')}
                                        onBlur={(e) => handleSettingUpdate('sacco_name', e.target.value)}
                                        placeholder="e.g. Secure Sacco"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <p className="font-bold text-slate-700 mb-2">Organization Logo</p>
                                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition relative bg-slate-50/50">
                                        {getSettingValue('sacco_logo') ? (
                                            <img src={getSettingValue('sacco_logo')} alt="Logo" className="h-24 object-contain mb-3" />
                                        ) : (
                                            <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300"><ImageIcon size={32}/></div>
                                        )}
                                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload('sacco_logo', e)} />
                                        <button className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 pointer-events-none">
                                            <Upload size={14}/> {getSettingValue('sacco_logo') ? 'Change Logo' : 'Upload Logo'}
                                        </button>
                                        <p className="text-[10px] text-slate-400 mt-2">Recommended: PNG/JPG (Max 10MB)</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="font-bold text-slate-700 mb-2">System Favicon</p>
                                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition relative bg-slate-50/50">
                                        {getSettingValue('sacco_favicon') ? (
                                            <img src={getSettingValue('sacco_favicon')} alt="Favicon" className="h-12 w-12 object-contain mb-3" />
                                        ) : (
                                            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300"><ImageIcon size={20}/></div>
                                        )}
                                        <input type="file" accept="image/x-icon,image/png" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload('sacco_favicon', e)} />
                                        <button className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 pointer-events-none">
                                            <Upload size={14}/> {getSettingValue('sacco_favicon') ? 'Change Favicon' : 'Upload Favicon'}
                                        </button>
                                        <p className="text-[10px] text-slate-400 mt-2">Recommended: ICO/PNG 32x32 (Max 10MB)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. REGISTER TAB */}
                {activeTab === 'register' && (
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-indigo-100 p-8 animate-fade-in">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <UserPlus className="text-emerald-600"/> Register New Member
                        </h2>
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <input required type="text" placeholder="Full Name" className="w-full border p-3 rounded-xl" value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} />
                                <input required type="tel" placeholder="Phone" className="w-full border p-3 rounded-xl" value={regForm.phoneNumber} onChange={e => setRegForm({...regForm, phoneNumber: e.target.value})} />
                            </div>
                            <input required type="email" placeholder="Email" className="w-full border p-3 rounded-xl" value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <input required type="text" placeholder="Password" className="w-full border p-3 rounded-xl" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} />
                                <select className="w-full border p-3 rounded-xl bg-white" value={regForm.role} onChange={e => setRegForm({...regForm, role: e.target.value})}>
                                    <option value="MEMBER">Member</option>
                                    <option value="SECRETARY">Secretary</option>
                                    <option value="TREASURER">Treasurer</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <button disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold mt-4">
                                {loading ? 'Creating...' : 'Create Account'}
                            </button>
                        </form>
                    </div>
                )}

                {/* --- EDIT MEMBER MODAL --- */}
                {editingUser && (
                    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Edit2 size={18} className="text-indigo-600"/> Edit Member
                                </h3>
                                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-red-500 transition"><X size={24}/></button>
                            </div>
                            
                            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                    <input 
                                        type="text" required 
                                        className="w-full border p-2 rounded-lg"
                                        value={editForm.fullName}
                                        onChange={e => setEditForm({...editForm, fullName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                                    <input 
                                        type="email" required 
                                        className="w-full border p-2 rounded-lg"
                                        value={editForm.email}
                                        onChange={e => setEditForm({...editForm, email: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                                        <input 
                                            type="tel" required 
                                            className="w-full border p-2 rounded-lg"
                                            value={editForm.phoneNumber}
                                            onChange={e => setEditForm({...editForm, phoneNumber: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                                        <select 
                                            className="w-full border p-2 rounded-lg bg-white"
                                            value={editForm.role}
                                            onChange={e => setEditForm({...editForm, role: e.target.value})}
                                        >
                                            <option value="MEMBER">Member</option>
                                            <option value="SECRETARY">Secretary</option>
                                            <option value="TREASURER">Treasurer</option>
                                            <option value="CHAIRPERSON">Chairperson</option>
                                            <option value="LOAN_OFFICER">Loan Officer</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Reset Password (Optional)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter new password to reset"
                                        className="w-full border border-indigo-200 bg-indigo-50 p-2 rounded-lg"
                                        value={editForm.password}
                                        onChange={e => setEditForm({...editForm, password: e.target.value})}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Leave blank to keep current password.</p>
                                </div>

                                <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg mt-2 flex items-center justify-center gap-2">
                                    {loading ? 'Saving...' : <><Save size={18}/> Save Changes</>}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}