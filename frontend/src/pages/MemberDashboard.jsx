import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, CreditCard, CheckCircle, Send, Clock, Calendar, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const api = axios.create({ baseURL: 'http://localhost:5000' });

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

  // ... (Include handleStart, handlePayment, handleSubmit from previous code)
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
            loanAppId: appState.id, amount: formData.amount, 
            purpose: formData.purpose, repaymentWeeks: formData.repaymentWeeks
        });
        await checkStatus();
    } catch (err) { alert("Error: " + (err.response?.data?.error || "Fail")); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200 p-4 flex justify-between items-center">
         <span className="font-bold text-slate-700">Welcome, {user?.name || 'Member'}</span>
         <button onClick={onLogout} className="text-sm text-red-600 flex items-center gap-1 hover:underline"><LogOut size={14}/> Logout</button>
      </nav>

      {/* Render States Logic (Same as before) */}
      {appState.status === 'LOADING' && <div className="p-10 text-center">Loading...</div>}
      
      {appState.status === 'NO_APP' && (
        <div className="p-10 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Apply for a Loan</h2>
          <button onClick={handleStart} className="bg-slate-900 text-white px-6 py-3 rounded-lg">Start Application</button>
        </div>
      )}

      {appState.status === 'FEE_PENDING' && (
        <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-xl shadow-sm border border-red-100 text-center">
          <Lock className="mx-auto text-red-500 mb-4" size={32} />
          <h2 className="text-lg font-bold text-red-700">Application Locked</h2>
          <p className="text-slate-500 mb-4">Pay KES 500 fee.</p>
          <button onClick={handlePayment} disabled={loading} className="w-full bg-emerald-600 text-white py-2 rounded-lg flex justify-center gap-2"><CreditCard size={20}/> Pay M-PESA</button>
        </div>
      )}

      {appState.status === 'FEE_PAID' && (
        <div className="max-w-lg mx-auto mt-10 p-8 bg-white rounded-xl shadow-sm border border-emerald-100">
          <div className="flex items-center gap-2 text-emerald-700 mb-6 bg-emerald-50 p-2 rounded"><CheckCircle size={20}/> Fee Paid</div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="number" required placeholder="Amount (KES)" className="w-full border p-3 rounded-lg" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
            <div className="relative">
                <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                <input type="number" required min="1" placeholder="Duration (Weeks)" className="w-full border p-3 pl-10 rounded-lg" value={formData.repaymentWeeks} onChange={e => setFormData({...formData, repaymentWeeks: e.target.value})} />
            </div>
            <textarea required placeholder="Purpose" className="w-full border p-3 rounded-lg" value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} />
            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-lg flex justify-center gap-2">Submit <Send size={18}/></button>
          </form>
        </div>
      )}

      {(appState.status === 'SUBMITTED' || appState.status === 'TABLED') && (
        <div className="max-w-md mx-auto mt-10 p-10 bg-white rounded-xl shadow-sm text-center border border-blue-100">
          <Clock className="mx-auto text-blue-500 mb-4" size={40} />
          <h2 className="text-xl font-bold text-slate-800">Application Submitted</h2>
          <p className="text-slate-500">Waiting for Secretary to table.</p>
        </div>
      )}
    </div>
  );
}