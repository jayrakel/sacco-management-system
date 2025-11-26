import React, { useState, useEffect } from 'react';
import api from '../api';
import { Users, Gavel, CheckCircle, UserPlus, AlertCircle } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function AdminDashboard({ user, onLogout }) {
    // Tabs: 'voting' | 'register'
    const [activeTab, setActiveTab] = useState('voting');
    
    // Voting Data
    const [agenda, setAgenda] = useState([]);
    
    // Register Form Data
    const [regForm, setRegForm] = useState({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
    const [loading, setLoading] = useState(false);
    
    // Refresh trigger
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        api.get('/api/loan/admin/agenda').then(res => setAgenda(res.data)).catch(console.error);
    }, [refreshKey]);

    const openVoting = async (loanId) => {
        try {
            await api.post('/api/loan/admin/open-voting', { loanId });
            setRefreshKey(old => old + 1);
            alert("Voting session opened!");
        } catch (err) {
            alert("Error opening voting");
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/auth/register', regForm);
            alert("Member registered successfully!");
            // Reset form
            setRegForm({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER' });
        } catch (err) {
            alert(err.response?.data?.error || "Registration failed");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Admin & Chairperson Panel" />

            <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
                {/* Page Header */}
                <div className="bg-indigo-900 text-white rounded-2xl p-8 mb-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Gavel size={32} /> Admin Dashboard
                        </h1>
                        <p className="text-indigo-200 mt-2">Manage system users and oversee loan voting sessions.</p>
                    </div>
                    
                    {/* Tab Switcher */}
                    <div className="flex bg-indigo-800/50 p-1 rounded-xl">
                        <button 
                            onClick={() => setActiveTab('voting')}
                            className={`px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'voting' ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-300 hover:text-white'}`}
                        >
                            Loan Voting
                        </button>
                        <button 
                            onClick={() => setActiveTab('register')}
                            className={`px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'register' ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-300 hover:text-white'}`}
                        >
                            Register Users
                        </button>
                    </div>
                </div>

                {/* CONTENT AREA */}
                
                {/* 1. VOTING SECTION */}
                {activeTab === 'voting' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Users className="text-indigo-600" /> Loans Pending Vote Opening
                        </h2>

                        {agenda.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                                <Gavel size={48} className="mx-auto mb-4 opacity-20"/>
                                <p>No tabled loans available for voting.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {agenda.map(item => (
                                    <div key={item.id} className="flex flex-col sm:flex-row items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition">
                                        <div className="mb-4 sm:mb-0">
                                            <p className="font-bold text-slate-800 text-lg">{item.full_name}</p>
                                            <div className="text-sm text-slate-500 flex items-center gap-4 mt-1">
                                                <span><span className="font-bold text-slate-700">Amount:</span> KES {parseFloat(item.amount_requested).toLocaleString()}</span>
                                                <span className="hidden sm:inline text-slate-300">|</span>
                                                <span className="italic">"{item.purpose}"</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => openVoting(item.id)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 transition flex items-center gap-2"
                                        >
                                            Open Floor <CheckCircle size={18}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. REGISTER SECTION */}
                {activeTab === 'register' && (
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-indigo-100 p-8 animate-fade-in">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <UserPlus className="text-emerald-600"/> Register New Member
                        </h2>
                        
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                    <input required type="text" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                                        value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                                    <input required type="tel" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                                        value={regForm.phoneNumber} onChange={e => setRegForm({...regForm, phoneNumber: e.target.value})} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                                <input required type="email" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                                    value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Default Password</label>
                                    <input required type="text" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                                        value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System Role</label>
                                    <select className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
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