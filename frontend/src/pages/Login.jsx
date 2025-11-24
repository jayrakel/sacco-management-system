import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, LogIn } from 'lucide-react';

export default function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Added Password
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/auth/login', { email, password });
      
      // 1. Save Token and User
      const { token, user } = res.data;
      localStorage.setItem('token', token); // CRITICAL: Store the token
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      // 2. Redirect
      if (user.role === 'SECRETARY') navigate('/secretary');
      else navigate('/member');
      
    } catch (err) {
      alert("Login failed: " + (err.response?.data?.error || "Server Error"));
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
        <div className="flex justify-center mb-6 text-emerald-400"><ShieldCheck size={48} /></div>
        <h2 className="text-2xl font-bold text-center mb-6">Secure Login</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Email</label>
            <input type="email" required className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Password</label>
            <input type="password" required className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 p-3 rounded-lg font-bold flex items-center justify-center gap-2">
            {loading ? 'Authenticating...' : <>Log In <LogIn size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}