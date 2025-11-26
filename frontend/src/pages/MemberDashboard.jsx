import React, { useState, useEffect } from 'react';
import api from '../api'; 
import { CreditCard, PiggyBank, TrendingUp, History, CheckCircle, Percent, Banknote, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';

export default function MemberDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); 

  // Financial Data
  const [savings, setSavings] = useState({ balance: 0, history: [] });
  const [loanState, setLoanState] = useState({ status: 'LOADING', amount_repaid: 0, amount_requested: 0 });
  
  // Forms
  const [loanForm, setLoanForm] = useState({ amount: '', purpose: '', repaymentWeeks: '' });
  const [depositForm, setDepositForm] = useState({ amount: '', phoneNumber: '' });
  const [repayForm, setRepayForm] = useState({ amount: '', mpesaRef: '' });
  
  // Local Toast (For deposit/repayment feedback only)
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
     if(!user) { navigate('/'); return; }
     const fetchData = async () => {
        try {
            // Note: We no longer fetch notifications here. The Header does it.
            const [balanceRes, historyRes, loanRes] = await Promise.all([
                api.get('/api/deposits/balance'),
                api.get('/api/deposits/history'),
                api.get('/api/loan/status')
            ]);

            setSavings({ balance: balanceRes.data.balance, history: historyRes.data });
            const loan = loanRes.data;
            if (loan.status !== 'NO_APP') {
                loan.amount_requested = parseFloat(loan.amount_requested || 0);
                loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
            }
            setLoanState(loan);
        } catch (err) { console.error("Data load error", err); }
     };
     fetchData();
  }, [user, refreshKey, navigate]);

  const showNotify = (type, msg) => {
      setToast({ type, msg });
      setTimeout(() => setToast(null), 5000);
  };

  // --- HANDLERS ---
  const handleDeposit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.post('/api/deposits', depositForm); showNotify('success', 'Deposit initiated!'); setDepositForm({ amount: '', phoneNumber: '' }); setRefreshKey(o=>o+1); setActiveTab('dashboard'); } 
    catch (e) { showNotify('error', 'Failed'); } setLoading(false);
  };
  const handleRepayment = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.post('/api/payment/repay-loan', { loanAppId: loanState.id, amount: repayForm.amount, mpesaRef: repayForm.mpesaRef || 'REF123' }); showNotify('success', 'Repayment received!'); setRepayForm({ amount: '', mpesaRef: '' }); setRefreshKey(o=>o+1); setActiveTab('dashboard'); } 
    catch (e) { showNotify('error', 'Failed'); } setLoading(false);
  };
  const handleLoanStart = async () => { try { await api.post('/api/loan/init'); setRefreshKey(o=>o+1); } catch(e){} };
  const handleLoanFeePayment = async () => { try { await api.post('/api/payment/pay-fee', {loanAppId:loanState.id, mpesaRef:'REF'}); setRefreshKey(o=>o+1); } catch(e){} };
  const handleLoanSubmit = async (e) => { e.preventDefault(); try { await api.post('/api/loan/submit', {loanAppId:loanState.id, ...loanForm}); setRefreshKey(o=>o+1); } catch(e){} };
  const calculateProgress = () => { if (!loanState.amount_requested) return 0; return Math.min(100, (loanState.amount_repaid / loanState.amount_requested) * 100); };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 relative">
      {toast && (
          <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-slide-in bg-white ${toast.type === 'success' ? 'text-emerald-600 border-emerald-100' : 'text-red-600 border-red-100'}`}>
              <CheckCircle size={20}/> <span className="font-medium">{toast.msg}</span>
          </div>
      )}
      
      {/* --- REUSABLE HEADER --- */}
      <DashboardHeader user={user} onLogout={onLogout} title="Member Portal" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
        {/* --- SAVINGS & HISTORY GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="md:col-span-2 bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
                <div className="absolute top-0 right-0 p-8 opacity-10"><PiggyBank size={120} /></div>
                <div className="relative z-10">
                    <p className="text-slate-400 font-medium mb-1">Total Savings Balance</p>
                    <h1 className="text-4xl sm:text-5xl font-bold mb-6">KES {savings.balance.toLocaleString()}</h1>
                    <div className="flex gap-3">
                        <button onClick={() => setActiveTab('deposit')} className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition"><TrendingUp size={18}/> Deposit</button>
                        <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-3 rounded-xl font-bold border border-slate-700 hover:bg-slate-800 ${activeTab === 'dashboard' ? 'hidden' : 'block'}`}>Cancel</button>
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[250px]">
                <div className="flex items-center gap-2 text-slate-500 mb-4 font-bold text-sm uppercase tracking-wider"><History size={16}/> Recent Transactions</div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {savings.history.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No transactions.</div> : 
                        savings.history.map(tx => (<div key={tx.id} className="flex justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"><div><p className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p></div><span className="font-bold text-emerald-600 text-sm">+ {parseInt(tx.amount).toLocaleString()}</span></div>))
                    }
                </div>
            </div>
        </div>

        {/* --- CONDITIONAL FORMS --- */}
        {activeTab === 'deposit' && (
            <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-8 max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold mb-4 text-slate-800">Deposit Funds</h2>
                <form onSubmit={handleDeposit} className="space-y-4">
                    <input type="number" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold" placeholder="Amount" value={depositForm.amount} onChange={e=>setDepositForm({...depositForm, amount:e.target.value})} />
                    <input type="tel" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl" placeholder="Phone" value={depositForm.phoneNumber} onChange={e=>setDepositForm({...depositForm, phoneNumber:e.target.value})} />
                    <button disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{loading ? '...' : 'Confirm'}</button>
                </form>
            </div>
        )}

        {activeTab === 'repay' && (
             <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold mb-4 text-slate-800">Loan Repayment</h2>
                <form onSubmit={handleRepayment} className="space-y-4">
                    <input type="number" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-bold" placeholder="Amount" value={repayForm.amount} onChange={e => setRepayForm({...repayForm, amount: e.target.value})}/>
                    <input type="text" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl" placeholder="Transaction Code" value={repayForm.mpesaRef} onChange={e => setRepayForm({...repayForm, mpesaRef: e.target.value})}/>
                    <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">{loading ? 'Verifying...' : 'Submit Payment'}</button>
                </form>
            </div>
        )}
        
        {/* --- LOAN DASHBOARD --- */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><CreditCard className="text-blue-500"/> Loan Application Status</h3>
                
                {loanState.status === 'LOADING' && <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">Loading...</div>}
                
                {loanState.status === 'NO_APP' && (
                    <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div><h4 className="text-2xl font-bold">Apply for Loan</h4><p>Get up to 3x your savings.</p></div>
                        <button onClick={handleLoanStart} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold">Start Application</button>
                    </div>
                )}

                {loanState.status === 'FEE_PENDING' && (
                     <div className="bg-white rounded-2xl shadow-sm border-l-4 border-amber-500 p-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-amber-100 p-3 rounded-full text-amber-600"><AlertCircle/></div>
                            <div><h4 className="text-lg font-bold text-slate-800">Fee Required</h4><p className="text-slate-500">Pay KES 500 to proceed.</p></div>
                        </div>
                        <button onClick={handleLoanFeePayment} disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition">Pay Fee</button>
                     </div>
                )}

                {loanState.status === 'FEE_PAID' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <h4 className="text-lg font-bold text-slate-800 mb-6">Loan Details</h4>
                        <form onSubmit={handleLoanSubmit} className="space-y-4 max-w-xl">
                            <input type="number" required className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Amount" value={loanForm.amount} onChange={e => setLoanForm({...loanForm, amount: e.target.value})} />
                            <input type="number" required className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Weeks" value={loanForm.repaymentWeeks} onChange={e => setLoanForm({...loanForm, repaymentWeeks: e.target.value})} />
                            <textarea required rows="3" className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Purpose" value={loanForm.purpose} onChange={e => setLoanForm({...loanForm, purpose: e.target.value})} />
                            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Submit</button>
                        </form>
                    </div>
                )}

                {(loanState.status === 'SUBMITTED' || loanState.status === 'TABLED') && (
                    <div className="bg-white p-10 rounded-2xl shadow-sm border border-blue-100 text-center">
                        <Clock size={40} className="mx-auto text-blue-500 mb-4 animate-pulse"/>
                        <h3 className="text-2xl font-bold text-slate-800">Under Review</h3>
                        <p className="text-slate-500">Your application for KES {loanState.amount_requested.toLocaleString()} is currently being processed.</p>
                    </div>
                )}

                {loanState.status === 'ACTIVE' && (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden p-8">
                        <div className="grid grid-cols-3 gap-6 mb-8 text-center">
                            <div><p className="text-xs text-slate-500 font-bold uppercase">Principal</p><p className="text-xl font-bold">KES {loanState.amount_requested.toLocaleString()}</p></div>
                            <div><p className="text-xs text-slate-500 font-bold uppercase">Paid</p><p className="text-xl font-bold text-emerald-600">KES {loanState.amount_repaid.toLocaleString()}</p></div>
                            <div><p className="text-xs text-slate-500 font-bold uppercase">Balance</p><p className="text-xl font-bold text-red-600">KES {(loanState.amount_requested - loanState.amount_repaid).toLocaleString()}</p></div>
                        </div>
                        <div className="mb-8 w-full bg-slate-100 rounded-full h-4 overflow-hidden"><div className="bg-emerald-500 h-4 rounded-full transition-all" style={{ width: `${calculateProgress()}%` }}></div></div>
                        <button onClick={() => setActiveTab('repay')} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">Make Repayment <Percent size={18}/></button>
                    </div>
                )}

                {loanState.status === 'COMPLETED' && (
                    <div className="bg-emerald-50 p-10 rounded-2xl text-center border border-emerald-100">
                        <CheckCircle size={40} className="mx-auto text-emerald-500 mb-4"/>
                        <h3 className="text-2xl font-bold text-emerald-900">Loan Repaid!</h3>
                        <button onClick={handleLoanStart} className="mt-6 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold">Apply New Loan</button>
                    </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
}