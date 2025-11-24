import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, CreditCard, CheckCircle, Send, Clock, ShieldCheck, Calendar } from 'lucide-react';

const api = axios.create({ baseURL: 'http://localhost:5000' });

export default function App() {
  const [appState, setAppState] = useState({ status: 'LOADING' });
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    purpose: '',
    repaymentWeeks: '' // Empty default so they have to type it
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await api.get('/api/loan/status');
      setAppState(res.data); 
    } catch (err) {
      console.error("Server error", err);
    }
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
            loanAppId: appState.id, 
            amount: formData.amount, 
            purpose: formData.purpose,
            repaymentWeeks: formData.repaymentWeeks
        });
        await checkStatus();
    } catch (err) {
        alert("Error: " + (err.response?.data?.error || "Submission Failed"));
    }
    setLoading(false);
  };

  // --- RENDER STATES ---

  if (appState.status === 'LOADING') return <div className="flex h-screen items-center justify-center text-slate-500">Loading Portal...</div>;

  // 1. START
  if (appState.status === 'NO_APP') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border border-slate-200">
          <ShieldCheck className="mx-auto text-emerald-600 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Member Loan Portal</h2>
          <p className="text-slate-500 mb-6">Secure, transparent, and automated.</p>
          <button onClick={handleStart} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-lg w-full font-medium hover:bg-black transition">
            {loading ? 'Processing...' : 'Start New Application'}
          </button>
        </div>
      </div>
    );
  }

  // 2. LOCKED (PAY FEE)
  if (appState.status === 'FEE_PENDING') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-red-100 max-w-md w-full">
          <Lock className="mx-auto text-red-500 mb-4" size={40} />
          <h2 className="text-xl font-bold text-red-700 mb-2">Application Locked</h2>
          <p className="text-slate-600 mb-6">A standard fee of <strong>KES 500</strong> is required to access the loan form.</p>
          <button onClick={handlePayment} disabled={loading} className="bg-emerald-600 text-white px-6 py-3 rounded-lg w-full flex items-center justify-center gap-2 font-bold shadow-sm hover:bg-emerald-700 transition">
            <CreditCard size={20} />
            {loading ? 'Verifying Payment...' : 'Pay KES 500 via M-PESA'}
          </button>
        </div>
      </div>
    );
  }

  // 3. UNLOCKED (FILL FORM)
  if (appState.status === 'FEE_PAID') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-emerald-50 font-sans p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm max-w-lg w-full border border-emerald-100">
          <div className="flex items-center gap-3 text-emerald-800 mb-6 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
            <CheckCircle size={20} /> 
            <span className="font-medium text-sm">Fee Paid • Form Unlocked</span>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Loan Amount (KES)</label>
              <input 
                type="number" required min="500"
                className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. 50000"
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Repayment Period (Weeks)</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  type="number" 
                  required 
                  min="1"
                  className="w-full border border-slate-300 p-3 pl-10 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. 12"
                  value={formData.repaymentWeeks} 
                  onChange={e => setFormData({...formData, repaymentWeeks: e.target.value})}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Enter total number of weeks for repayment.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Purpose</label>
              <textarea 
                required rows="3"
                className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                placeholder="Describe exactly how the funds will be used..."
                value={formData.purpose} 
                onChange={e => setFormData({...formData, purpose: e.target.value})} 
              />
            </div>

            <button type="submit" disabled={loading} className="bg-slate-900 text-white px-6 py-4 rounded-lg w-full font-bold text-lg hover:bg-black transition flex items-center justify-center gap-2">
              {loading ? 'Submitting...' : <>Submit Application <Send size={18}/></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 4. SUBMITTED
  if (appState.status === 'SUBMITTED' || appState.status === 'TABLED') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-blue-50 font-sans">
        <div className="bg-white p-10 rounded-xl shadow-sm text-center max-w-md w-full border border-blue-100">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="text-blue-600" size={40} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Application Under Review</h2>
          <p className="text-slate-500 mb-6">Your application is being processed by the Secretary.</p>
          
          <div className="bg-slate-50 p-4 rounded-lg text-left text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Amount</span>
              <span className="font-bold text-slate-900">KES {appState.amount_requested}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duration</span>
              <span className="font-bold text-slate-900">{appState.repayment_weeks} Weeks</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div>Error</div>;
}