import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, CreditCard, CheckCircle, Send, Clock, Calendar, LogOut, Wallet, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Secure API
const api = axios.create({ baseURL: 'http://localhost:5000' });
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default function MemberDashboard({ user, onLogout }) {
  const [appState, setAppState] = useState({ status: 'LOADING' });
  const [formData, setFormData] = useState({ amount: '', purpose: '', repaymentWeeks: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
     if(!user) navigate('/');
     else checkStatus();
  }, [user]);

  const checkStatus = async () => {
    try {
      const res = await api.get('/api/loan/status');
      setAppState(res.data);
    } catch (err) { console.error(err); }
  };

  const handleStart = async () => {
    setLoading(true);
    await api.post('/api/loan/init');
    await checkStatus();
    setLoading(false);
  };

  const handlePayment = async () => {
    setLoading(true);
    const mockRef = `MP-${Math.floor(Math.random() * 1000000)}`;
    await api.post('/api/payment/pay-fee', { loanAppId: appState.id, mpesaRef: mockRef });
    await checkStatus();
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        await api.post('/api/loan/submit', { 
            loanAppId: appState.id, ...formData
        });
        await checkStatus();
    } catch (err) { alert("Submission Error: " + (err.response?.data?.error || "Failed")); }
    setLoading(false);
  };

  // --- RENDERERS ---

  const StatusCard = ({ icon: Icon, title, desc, color }) => (
    <div className={`bg-white p-8 rounded-xl shadow-sm border-l-4 border-${color}-500 flex items-start gap-4`}>
      <div className={`p-3 bg-${color}-50 rounded-lg text-${color}-600`}><Icon size={24} /></div>
      <div>
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
        <p className="text-slate-500 text-sm mt-1">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
         <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-lg"><Wallet size={20} /></div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Member Portal</span>
         </div>
         <div className="flex items-center gap-4">
             <span className="text-sm font-medium text-slate-600 hidden sm:block">Hi, {user?.name}</span>
             <button onClick={onLogout} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition">
                <LogOut size={16}/> Logout
             </button>
         </div>
      </nav>

      <main className="max-w-3xl mx-auto p-6 mt-6">
        
        {appState.status === 'LOADING' && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-pulse">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
                Loading your financial data...
            </div>
        )}

        {appState.status === 'NO_APP' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
            <div className="bg-slate-900 p-10 text-center text-white">
              <h2 className="text-3xl font-bold mb-2">Quick Loan</h2>
              <p className="text-slate-400">Get funding up to KES 1,000,000 instantly.</p>
            </div>
            <div className="p-10 text-center">
                <div className="grid grid-cols-3 gap-4 mb-8 text-left">
                    <StatusCard icon={Clock} title="Fast" desc="24h Approval" color="blue" />
                    <StatusCard icon={Lock} title="Secure" desc="Bank-grade" color="emerald" />
                    <StatusCard icon={Calendar} title="Flexible" desc="Weekly Pay" color="purple" />
                </div>
                <button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 transition w-full sm:w-auto">
                    Start New Application
                </button>
            </div>
          </div>
        )}

        {appState.status === 'FEE_PENDING' && (
          <div className="bg-white rounded-2xl shadow-lg border border-red-100 overflow-hidden">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4 text-red-800">
                <AlertCircle />
                <span className="font-bold">Action Required</span>
            </div>
            <div className="p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Unlock Application Form</h2>
                <p className="text-slate-600 mb-6">To maintain system integrity, a small processing fee of <span className="font-bold text-slate-900">KES 500</span> is required.</p>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 flex justify-between items-center">
                    <span className="text-slate-500 text-sm">Fee Amount</span>
                    <span className="font-mono font-bold text-slate-900">KES 500.00</span>
                </div>

                <button onClick={handlePayment} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-100 transition flex items-center justify-center gap-3">
                    <CreditCard size={20}/> 
                    {loading ? 'Processing Transaction...' : 'Pay Now via M-PESA'}
                </button>
            </div>
          </div>
        )}

        {appState.status === 'FEE_PAID' && (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-emerald-100">
            <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 p-4 rounded-xl mb-8 border border-emerald-100">
                <CheckCircle size={24} /> 
                <div>
                    <h4 className="font-bold">Fee Paid Successfully</h4>
                    <p className="text-xs text-emerald-600">Ref: {appState.fee_transaction_ref}</p>
                </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">How much do you need?</label>
                    <div className="relative">
                        <span className="absolute left-4 top-4 text-slate-400 font-bold">KES</span>
                        <input type="number" required className="w-full border border-slate-300 pl-14 p-4 rounded-xl text-lg font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00"
                            value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Repayment Duration</label>
                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <div className="bg-white p-3 rounded-lg shadow-sm"><Calendar size={20} className="text-slate-400"/></div>
                        <input type="number" required min="1" max="52" className="bg-transparent w-full outline-none font-bold text-slate-700" placeholder="Weeks"
                            value={formData.repaymentWeeks} onChange={e => setFormData({...formData, repaymentWeeks: e.target.value})} />
                        <span className="text-slate-400 font-medium pr-4">Weeks</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Purpose of Loan</label>
                    <textarea required rows="3" className="w-full border border-slate-300 p-4 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="E.g. School fees, Business stock..."
                        value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition shadow-xl flex items-center justify-center gap-2">
                    Submit Application <Send size={18}/>
                </button>
            </form>
          </div>
        )}

        {(appState.status === 'SUBMITTED' || appState.status === 'TABLED') && (
          <div className="bg-white p-12 rounded-2xl shadow-lg text-center border border-blue-100">
            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Application Under Review</h2>
            <p className="text-slate-500 mb-8">Your application has been forwarded to the Secretary for tabling.</p>
            
            <div className="bg-slate-50 rounded-xl p-6 max-w-sm mx-auto text-left space-y-3 border border-slate-200">
                <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">Amount</span>
                    <span className="font-bold text-slate-900">KES {appState.amount_requested}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">Duration</span>
                    <span className="font-bold text-slate-900">{appState.repayment_weeks} Weeks</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 mt-2">
                    <span className="text-slate-500 text-sm">Status</span>
                    <span className="font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded text-xs uppercase">{appState.status}</span>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}