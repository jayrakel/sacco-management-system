import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { UserPlus, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function SetupUsers() {
  const [status, setStatus] = useState(null);
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', phoneNumber: '', role: '' });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    try {
      const res = await api.get('/api/auth/setup-status');
      setStatus(res.data);
      if (res.data.missingRoles.length > 0) {
        setFormData(prev => ({ ...prev, role: res.data.missingRoles[0] }));
      }
    } catch (err) { console.error("Failed to fetch setup status"); }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); setIsError(false);
    try {
      await api.post('/api/auth/create-key-user', formData);
      setMessage(`Success: ${formData.role} created.`);
      setFormData({ fullName: '', email: '', password: '', phoneNumber: '', role: '' });
      fetchStatus();
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || "Error creating user");
    }
  };

  if (!status) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center justify-center">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        <div className="w-full md:w-1/3 bg-slate-900 text-white p-10 flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3"><ShieldCheck className="text-emerald-400" size={36} /> System Setup</h2>
            <p className="text-slate-400 mb-8">Appoint key officers to initialize the system.</p>
            <div className="space-y-4">
              {['CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER'].map(role => (
                <div key={role} className={`flex items-center gap-4 p-3 rounded-lg ${!status.missingRoles.includes(role) ? 'bg-emerald-900/30 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  {!status.missingRoles.includes(role) ? <CheckCircle size={24} /> : <div className="w-6 h-6 border-2 border-slate-600 rounded-full" />}
                  <span className="font-semibold text-sm tracking-wide">{role.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
          {status.isComplete && <button onClick={() => navigate('/admin')} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-bold mt-8">Go to Dashboard</button>}
        </div>

        <div className="w-full md:w-2/3 p-10 bg-white">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Appoint Officer</h3>
            {message && <div className={`p-4 mb-6 rounded-lg flex items-center gap-3 ${isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{isError ? <AlertTriangle size={20}/> : <CheckCircle size={20}/>} {message}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                    <select className="w-full p-3 border border-slate-300 rounded-lg" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} required>
                        <option value="" disabled>Select Role</option>
                        {status.missingRoles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Full Name" required className="p-3 border rounded-lg" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    <input type="text" placeholder="Phone" required className="p-3 border rounded-lg" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
                </div>
                <input type="email" placeholder="Email" required className="w-full p-3 border rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <input type="text" placeholder="Temporary Password" required className="w-full p-3 border rounded-lg bg-yellow-50" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                <button className="w-full bg-slate-900 text-white py-4 rounded-lg hover:bg-slate-800"><UserPlus size={20} className="inline mr-2"/> Create Account</button>
            </form>
        </div>
      </div>
    </div>
  );
}