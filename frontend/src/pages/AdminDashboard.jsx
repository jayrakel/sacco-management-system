import React, { useState } from 'react';
import api from '../api'; // Use central secure API
import { UserPlus, Shield, LogOut, Smartphone, Mail, Lock, Check } from 'lucide-react';

export default function AdminDashboard({ user, onLogout }) {
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', role: 'MEMBER', phoneNumber: ''
  });
  const [status, setStatus] = useState({ type: '', msg: '' });

  const handleRegister = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', msg: 'Creating user account...' });
    try {
      await api.post('/auth/register', formData);
      setStatus({ type: 'success', msg: `Successfully registered ${formData.fullName}` });
      setFormData({ fullName: '', email: '', password: '', role: 'MEMBER', phoneNumber: '' }); // Reset
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.error || "Registration failed" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-200">
      <nav className="bg-black/50 backdrop-blur border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
         <div className="flex items-center gap-3 font-bold text-emerald-500">
            <Shield className="fill-emerald-500/20" /> 
            <span className="text-white">System Admin</span>
         </div>
         <div className="flex items-center gap-4">
             <span className="text-xs font-mono text-slate-500 hidden sm:block">{user.email}</span>
             <button onClick={onLogout} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 flex gap-2 transition border border-slate-700">
                <LogOut size={14}/> Logout
             </button>
         </div>
      </nav>

      <div className="max-w-2xl mx-auto mt-10 p-6">
        <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <UserPlus size={20} className="text-emerald-500"/> User Registration
                </h2>
                <p className="text-sm text-slate-400 mt-1">Create new accounts for Members or Officials.</p>
            </div>
          </div>

          <div className="p-8">
            {status.msg && (
                <div className={`mb-6 p-4 rounded-lg text-sm flex items-center gap-2 ${
                    status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                    status.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                    'bg-blue-500/10 text-blue-400'
                }`}>
                    {status.type === 'success' && <Check size={16}/>}
                    {status.msg}
                </div>
            )}

            <form onSubmit={handleRegister} className="space-y-6">
                
                <div className="grid grid-cols-1 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">Full Name</label>
                        <input className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition" 
                            value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required placeholder="e.g. John Doe"/>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-2"><Mail size={12}/> Email</label>
                        <input type="email" className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition" 
                            value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required placeholder="user@sacco.com"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-2"><Smartphone size={12}/> Phone</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition" 
                            value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} required placeholder="0700..." />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider flex items-center gap-2"><Lock size={12}/> Password</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition" 
                            placeholder="Initial password"
                            value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">Role Permission</label>
                        <select className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition appearance-none"
                            value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                            <option value="MEMBER">Member</option>
                            <option value="SECRETARY">Secretary</option>
                            <option value="TREASURER">Treasurer</option>
                            <option value="ADMIN">System Admin</option>
                        </select>
                    </div>
                </div>

                <div className="pt-4">
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition flex justify-center items-center gap-2">
                        <UserPlus size={18}/> Create Account
                    </button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}