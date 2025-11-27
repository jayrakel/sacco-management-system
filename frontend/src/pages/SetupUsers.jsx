import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { UserPlus, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function SetupUsers({ onSetupComplete }) {
  const [status, setStatus] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', phoneNumber: '', role: ''
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  // Fetch status on load and after every creation
  const fetchStatus = async () => {
    try {
      const res = await api.get('/api/auth/setup-status');
      setStatus(res.data);
      
      // Automatically select the first missing role for convenience
      if (res.data.missingRoles.length > 0) {
        setFormData(prev => ({ ...prev, role: res.data.missingRoles[0] }));
      } else if (res.data.isComplete) {
         setFormData(prev => ({ ...prev, role: 'ASSISTANT_CHAIRPERSON' }));
      }
    } catch (err) {
      console.error("Failed to fetch setup status");
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    try {
      await api.post('/api/auth/create-key-user', formData);
      setMessage(`Success: ${formData.role} created successfully.`);
      
      // Clear form but keep some fields if needed
      setFormData({ fullName: '', email: '', password: '', phoneNumber: '', role: '' });
      
      // Refresh status to check if we are done
      fetchStatus();
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || "Error creating user");
    }
  };

  const handleFinish = () => {
    if (onSetupComplete) onSetupComplete(); 
    navigate('/admin');
  };

  if (!status) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Loading System Requirements...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center justify-center">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* Left Panel: Checklist */}
        <div className="w-full md:w-1/3 bg-slate-900 text-white p-10 flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <ShieldCheck className="text-emerald-400" size={36} /> 
              System Setup
            </h2>
            <p className="text-slate-400 mb-8">
              To ensure proper governance and separation of duties, you must appoint the following officers before the system goes live.
            </p>
            
            <div className="space-y-4">
              {['CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER'].map(role => {
                const isDone = !status.missingRoles.includes(role);
                return (
                  <div key={role} className={`flex items-center gap-4 p-3 rounded-lg transition-all ${isDone ? 'bg-emerald-900/30 text-emerald-400 translate-x-2' : 'bg-slate-800 text-slate-500'}`}>
                    {isDone ? <CheckCircle size={24} /> : <div className="w-6 h-6 border-2 border-slate-600 rounded-full" />}
                    <span className="font-semibold text-sm tracking-wide">{role.replace('_', ' ')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {status.isComplete && (
             <div className="mt-8 animate-fade-in">
               <div className="bg-emerald-500/20 p-4 rounded-lg mb-4 text-emerald-300 text-sm">
                  All mandatory roles have been filled. You may now proceed to the dashboard.
               </div>
               <button onClick={handleFinish} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-bold transition shadow-lg shadow-emerald-500/20">
                 Go to Dashboard
               </button>
             </div>
          )}
        </div>

        {/* Right Panel: Form */}
        <div className="w-full md:w-2/3 p-10 bg-white">
          <div className="max-w-md mx-auto">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Appoint Officer</h3>
            <p className="text-slate-500 mb-8 text-sm">Create a login account for a key system user.</p>
            
            {message && (
              <div className={`p-4 mb-6 rounded-lg flex items-center gap-3 ${isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {isError ? <AlertTriangle size={20}/> : <CheckCircle size={20}/>}
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                <select 
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none bg-slate-50"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  required
                >
                  <option value="" disabled>Select Role</option>
                  {status.missingRoles.map(r => <option key={r} value={r}>{r}</option>)}
                  {/* Allow adding assistants if required roles are done */}
                  {status.isComplete && (
                    <>
                        <option value="ASSISTANT_CHAIRPERSON">ASSISTANT CHAIRPERSON</option>
                        <option value="ASSISTANT_SECRETARY">ASSISTANT SECRETARY</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                  <input type="text" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" 
                    value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                  <input type="text" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" 
                    value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input type="email" required className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" 
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Temporary Password</label>
                <input type="text" required className="w-full p-3 border border-slate-300 rounded-lg font-mono bg-yellow-50 focus:ring-2 focus:ring-yellow-400 outline-none" 
                  placeholder="Enter a strong password"
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>

              <button className="w-full bg-slate-900 text-white py-4 rounded-lg hover:bg-slate-800 transition flex items-center justify-center gap-2 font-semibold mt-4">
                <UserPlus size={20} /> Create Officer Account
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}