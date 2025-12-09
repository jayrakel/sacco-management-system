import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api'; 
import { ShieldCheck, Lock, Mail, ChevronRight, AlertTriangle } from 'lucide-react';

export default function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logo, setLogo] = useState(null); 
  const [saccoName, setSaccoName] = useState('SecureSacco'); 

  const navigate = useNavigate();

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await api.get('/api/settings/branding');
        const logoData = res.data.find(s => s.setting_key === 'sacco_logo');
        if (logoData?.setting_value) setLogo(logoData.setting_value);
        const nameData = res.data.find(s => s.setting_key === 'sacco_name');
        if (nameData?.setting_value) setSaccoName(nameData.setting_value);
      } catch (err) { console.warn("Branding load error", err); }
    };
    fetchBranding();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { user } = res.data;
      
      // 1. Save User
      localStorage.setItem('sacco_user', JSON.stringify(user));
      setUser(user);

      // 2. Security Check (Only if flag is explicitly TRUE)
      if (user.mustChangePassword) {
        navigate('/change-password');
        return;
      }

      // 3. SIMPLE REDIRECT (Fixes the "Empty Dashboard" issue)
      // We send everyone to the main portal. The App.jsx handles the rest.
      navigate('/portal');
      
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.response?.data?.error || "Connection failed.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Side */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col justify-center items-center p-12 text-white relative">
        <div className="relative z-10 text-center">
          <div className="bg-emerald-500/20 p-6 rounded-full inline-block mb-8">
            <ShieldCheck size={64} className="text-emerald-400" />
          </div>
          <h1 className="text-5xl font-bold mb-6">{saccoName}</h1>
          <p className="text-slate-400 text-xl max-w-md mx-auto">
            Secure, Transparent, and Automated Sacco Management.
          </p>
        </div>
      </div>

      {/* Right Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-100">
            {logo && <img src={logo} alt="Logo" className="h-20 w-auto mx-auto mb-6 object-contain" />}
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h2>
            <p className="text-slate-500 mb-8">Enter your credentials to access the portal.</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex gap-2">
                <AlertTriangle size={18} /> {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="text-sm font-bold text-slate-700">Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                  <input type="email" required className="w-full border p-3 pl-10 rounded-xl" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                  <input type="password" required className="w-full border p-3 pl-10 rounded-xl" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              </div>
              <button disabled={loading} className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition flex justify-center gap-2">
                {loading ? "Verifying..." : <>Sign In <ChevronRight /></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}