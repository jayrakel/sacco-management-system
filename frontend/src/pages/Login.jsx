import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { ShieldCheck, Lock, Mail, ChevronRight } from "lucide-react";

export default function Login({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { user } = res.data;

      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);

      // --- INTEGRATION: Force Password Change ---
      if (user.mustChangePassword) {
        navigate("/change-password");
        return;
      }
      // ------------------------------------------

      const paths = {
        ADMIN: "/admin",
        SECRETARY: "/secretary",
        MEMBER: "/member",
        TREASURER: "/treasurer",
        CHAIRPERSON: "/chairperson" // Added chairperson support
      };
      navigate(paths[user.role] || "/member");

    } catch (err) {
      console.error("Login Error:", err);
      setError(err.response?.data?.error || "Connection failed.");
    }
    setLoading(false);
  };

  // ... (Rest of the UI remains exactly the same) ...
  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col justify-center items-center p-12 text-white relative overflow-hidden">
        <div className="relative z-10 text-center">
          <div className="bg-emerald-500/20 p-6 rounded-full inline-block mb-8 backdrop-blur-sm">
            <ShieldCheck size={64} className="text-emerald-400" />
          </div>
          <h1 className="text-5xl font-bold mb-6">SecureSacco</h1>
          <p className="text-slate-400 text-xl max-w-md mx-auto leading-relaxed">
            Empowering members with transparent, automated, and secure financial growth.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-100">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h2>
            <p className="text-slate-500 mb-8">Please enter your credentials to access your account.</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded flex items-center animate-pulse">
                <Lock size={16} className="mr-2" /> {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 text-slate-400" size={20} />
                  <input
                    type="email" required
                    className="w-full border border-slate-200 pl-12 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                    placeholder="name@sacco.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
                  <input
                    type="password" required
                    className="w-full border border-slate-200 pl-12 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                    placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button disabled={loading} className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold py-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group">
                {loading ? "Verifying..." : <>Sign In <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>
          </div>
          <p className="text-center text-slate-400 text-sm mt-8">© 2025 SecureSacco System</p>
        </div>
      </div>
    </div>
  );
}