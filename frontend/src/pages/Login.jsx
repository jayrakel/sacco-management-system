import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, LogIn } from 'lucide-react';

export default function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Call our new Auth Backend
      const res = await axios.post('http://localhost:5000/auth/login', { email });
      
      // Save user state globally
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      // Redirect based on Role
      if (res.data.user.role === 'SECRETARY') navigate('/secretary');
      else if (res.data.user.role === 'TREASURER') navigate('/treasurer');
      else navigate('/member');
      
    } catch (err) {
      alert("Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
        <div className="flex justify-center mb-6 text-emerald-400">
          <ShieldCheck size={48} />
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">SecureSacco Login</h2>
        <p className="text-slate-400 text-center mb-8 text-sm">Enter your official email to access the portal.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
              placeholder="member@sacco.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          
          <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 p-3 rounded-lg font-bold transition flex items-center justify-center gap-2">
            {loading ? 'Authenticating...' : <>Log In <LogIn size={18} /></>}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700 text-xs text-slate-500 text-center">
          <p>Tip: Use <strong>secretary@test.com</strong> to access Secretary Dashboard</p>
        </div>
      </div>
    </div>
  );
}