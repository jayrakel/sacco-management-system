import React, { useState, useEffect } from 'react';
import api from '../api';
import { UserPlus, Shield, LogOut, Megaphone, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function AdminDashboard({ user, onLogout }) {
  // Registration State
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', role: 'MEMBER', phoneNumber: ''
  });
  const [status, setStatus] = useState({ type: '', msg: '' });

  // Meeting Control State
  const [agenda, setAgenda] = useState([]);
  const [votingStatus, setVotingStatus] = useState({ type: '', msg: '' });
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Fetch Agenda (Tabled Loans)
  useEffect(() => {
      const fetchAgenda = async () => {
          try {
              const res = await api.get('/api/loan/admin/agenda');
              setAgenda(res.data);
          } catch (err) {
              console.error("Failed to fetch agenda");
          }
      };
      fetchAgenda();
  }, [refreshKey]);

  // 2. Handle Register User
  const handleRegister = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', msg: 'Creating user account...' });
    try {
      await api.post('/auth/register', formData);
      setStatus({ type: 'success', msg: `Successfully registered ${formData.fullName}` });
      setFormData({ fullName: '', email: '', password: '', role: 'MEMBER', phoneNumber: '' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.error || "Registration failed" });
    }
  };

  // 3. Handle Open Voting
  const handleOpenVoting = async (loanId) => {
      try {
          await api.post('/api/loan/admin/open-voting', { loanId });
          setVotingStatus({ type: 'success', msg: `Voting opened for Loan #${loanId}` });
          setTimeout(() => setVotingStatus({ type: '', msg: '' }), 3000);
          setRefreshKey(old => old + 1); // Refresh list
      } catch (err) {
          setVotingStatus({ type: 'error', msg: 'Failed to start voting session' });
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-200">
      {/* Top Navigation */}
      <nav className="bg-black/50 backdrop-blur border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
         <div className="flex items-center gap-3 font-bold text-emerald-500">
            <Shield className="fill-emerald-500/20" /> 
            <span className="text-white">System Chairperson</span>
         </div>
         <div className="flex items-center gap-4">
             <span className="text-xs font-mono text-slate-500 hidden sm:block">{user.email}</span>
             <button onClick={onLogout} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 flex gap-2 transition border border-slate-700">
                <LogOut size={14}/> Logout
             </button>
         </div>
      </nav>

      <div className="max-w-5xl mx-auto mt-10 p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* --- LEFT: MEETING CONTROL (NEW) --- */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
             <div className="p-6 border-b border-slate-700 bg-slate-800/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Megaphone className="text-amber-500" size={20}/> AGM Meeting Control
                </h2>
                <p className="text-sm text-slate-400 mt-1">Control the floor and open voting sessions.</p>
            </div>

            <div className="p-6 flex-1">
                {votingStatus.msg && (
                    <div className={`mb-4 p-3 rounded text-sm flex items-center gap-2 ${votingStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {votingStatus.type === 'success' ? <CheckCircle size={16}/> : <XCircle size={16}/>}
                        {votingStatus.msg}
                    </div>
                )}

                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-4">Tabled Motions (Pending Vote)</h3>
                
                <div className="space-y-3">
                    {agenda.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-xl">
                            No tabled motions found.
                        </div>
                    ) : (
                        agenda.map(item => (
                            <div key={item.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-white text-sm">{item.full_name}</h4>
                                    <p className="text-xs text-slate-400">Request: KES {parseInt(item.amount_requested).toLocaleString()}</p>
                                </div>
                                <button 
                                    onClick={() => handleOpenVoting(item.id)}
                                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg shadow-amber-900/20"
                                >
                                    Open Voting
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* --- RIGHT: USER REGISTRATION (EXISTING) --- */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700 bg-slate-800/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus size={20} className="text-emerald-500"/> Member Registry
            </h2>
            <p className="text-sm text-slate-400 mt-1">Create new accounts for Members or Officials.</p>
          </div>

          <div className="p-6">
            {status.msg && (
                <div className={`mb-6 p-3 rounded-lg text-sm flex items-center gap-2 ${
                    status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                    status.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400'
                }`}>
                    {status.msg}
                </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
                <div className="grid grid-cols-1 gap-5">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Full Name</label>
                        <input className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition text-sm" 
                            value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required placeholder="John Doe"/>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Email</label>
                        <input type="email" className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition text-sm" 
                            value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required placeholder="user@sacco.com"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Phone</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition text-sm" 
                            value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} required placeholder="0700..." />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Password</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition text-sm" 
                            placeholder="Initial pass"
                            value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Role</label>
                        <select className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:border-emerald-500 outline-none transition appearance-none text-sm"
                            value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                            <option value="MEMBER">Member</option>
                            <option value="SECRETARY">Secretary</option>
                            <option value="TREASURER">Treasurer</option>
                            <option value="ADMIN">System Admin</option>
                        </select>
                    </div>
                </div>

                <div className="pt-2">
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition flex justify-center items-center gap-2 text-sm">
                        {status.type === 'loading' ? <Loader className="animate-spin" size={18}/> : <><UserPlus size={18}/> Create Account</>}
                    </button>
                </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}