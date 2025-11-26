import React, { useState, useEffect } from 'react';
import api from '../api'; 
import { CreditCard, PiggyBank, TrendingUp, History, CheckCircle, Percent, Banknote, Clock, AlertCircle, UserPlus, Search, UserCheck, UserX, Inbox, Vote, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';

export default function MemberDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); 

  // Data State
  const [savings, setSavings] = useState({ balance: 0, history: [] });
  const [loanState, setLoanState] = useState({ status: 'LOADING', amount_repaid: 0, amount_requested: 0 });
  const [votingQueue, setVotingQueue] = useState([]); // New: Voting Queue
  
  // Guarantor State (My Loan)
  const [guarantors, setGuarantors] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Incoming Requests (Other people asking ME)
  const [incomingRequests, setIncomingRequests] = useState([]);
  
  // Forms
  const [loanForm, setLoanForm] = useState({ amount: '', purpose: '', repaymentWeeks: '' });
  const [depositForm, setDepositForm] = useState({ amount: '', phoneNumber: '' });
  const [repayForm, setRepayForm] = useState({ amount: '', mpesaRef: '' });
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
     if(!user) { navigate('/'); return; }
     const fetchData = async () => {
        try {
            const [balanceRes, historyRes, loanRes, reqRes, voteRes] = await Promise.all([
                api.get('/api/deposits/balance'),
                api.get('/api/deposits/history'),
                api.get('/api/loan/status'),
                api.get('/api/loan/guarantors/requests'),
                api.get('/api/loan/vote/open') // Fetch open votes
            ]);

            setSavings({ balance: balanceRes.data.balance, history: historyRes.data });
            setIncomingRequests(reqRes.data);
            setVotingQueue(voteRes.data); // Set voting queue

            const loan = loanRes.data;
            if (loan.status !== 'NO_APP') {
                loan.amount_requested = parseFloat(loan.amount_requested || 0);
                loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
            }
            setLoanState(loan);

            // Fetch guarantors if pending (My Loan)
            if (loan.status === 'PENDING_GUARANTORS') {
                const gRes = await api.get('/api/loan/guarantors');
                setGuarantors(gRes.data);
            }
        } catch (err) { console.error("Data error", err); }
     };
     fetchData();
  }, [user, refreshKey, navigate]);

  const showNotify = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 5000); };

  // Handlers
  const handleDeposit = async (e) => { e.preventDefault(); setLoading(true); try { await api.post('/api/deposits', depositForm); showNotify('success', 'Deposit initiated!'); setDepositForm({ amount: '', phoneNumber: '' }); setRefreshKey(o=>o+1); setActiveTab('dashboard'); } catch (e) { showNotify('error', 'Failed'); } setLoading(false); };
  const handleRepayment = async (e) => { e.preventDefault(); setLoading(true); try { await api.post('/api/payment/repay-loan', { loanAppId: loanState.id, amount: repayForm.amount, mpesaRef: repayForm.mpesaRef || 'REF' }); showNotify('success', 'Repayment received!'); setRepayForm({ amount: '', mpesaRef: '' }); setRefreshKey(o=>o+1); setActiveTab('dashboard'); } catch (e) { showNotify('error', 'Failed'); } setLoading(false); };
  const handleLoanStart = async () => { try { await api.post('/api/loan/init'); setRefreshKey(o=>o+1); } catch(e){} };
  
  // Fixed Fee Payment
  const handleLoanFeePayment = async () => { 
      try { 
          await api.post('/api/payment/pay-fee', {
              loanAppId: loanState.id, 
              mpesaRef: 'PAYMENT' + Math.floor(10000 + Math.random() * 90000) 
          }); 
          showNotify('success', 'Fee Paid Successfully!'); 
          setRefreshKey(o=>o+1); 
      } catch(e){
          showNotify('error', 'Payment Failed'); 
      } 
  };

  const handleLoanSubmit = async (e) => { e.preventDefault(); try { await api.post('/api/loan/submit', {loanAppId:loanState.id, ...loanForm}); setRefreshKey(o=>o+1); } catch(e){} };
  
  // Guarantor Handlers (My Loan)
  const handleSearch = async (e) => {
      const q = e.target.value; setSearchQuery(q);
      if(q.length > 2) { const res = await api.get(`/api/loan/members/search?q=${q}`); setSearchResults(res.data); } else setSearchResults([]);
  };
  const addGuarantor = async (guarantorId) => {
      try {
          await api.post('/api/loan/guarantors/add', { loanId: loanState.id, guarantorId });
          setRefreshKey(o => o + 1); setSearchResults([]); setSearchQuery('');
          showNotify('success', 'Request Sent!');
      } catch (err) { showNotify('error', err.response?.data?.error || "Failed"); }
  };
  const handleFinalSubmit = async () => {
      try { await api.post('/api/loan/final-submit', { loanAppId: loanState.id }); setRefreshKey(o => o + 1); showNotify('success', 'Application Submitted!'); } catch(e){ showNotify('error', 'Failed'); }
  };

  // Request Response
  const handleGuarantorResponse = async (requestId, decision) => {
      try {
          await api.post('/api/loan/guarantors/respond', { requestId, decision });
          setRefreshKey(k => k + 1);
          showNotify(decision === 'ACCEPTED' ? 'success' : 'error', `Request ${decision}`);
      } catch (err) { showNotify('error', 'Action Failed'); }
  };

  // Voting Handler
  const handleVote = async (loanId, decision) => {
      try {
          await api.post('/api/loan/vote', { loanId, decision });
          setRefreshKey(k => k + 1);
          showNotify('success', 'Vote Cast!');
      } catch (err) { showNotify('error', err.response?.data?.error || 'Voting Failed'); }
  };

  const calculateProgress = () => { if (!loanState.amount_requested) return 0; return Math.min(100, (loanState.amount_repaid / loanState.amount_requested) * 100); };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 relative">
      {toast && (<div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-slide-in bg-white ${toast.type === 'success' ? 'text-emerald-600 border-emerald-100' : 'text-red-600 border-red-100'}`}><CheckCircle size={20}/> <span className="font-medium">{toast.msg}</span></div>)}
      
      <DashboardHeader user={user} onLogout={onLogout} title="Member Portal" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="md:col-span-2 bg-slate-900 rounded-2xl p-8 text-white shadow-2xl shadow-slate-200 relative overflow-hidden">
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
            
            {/* Incoming Requests & Voting Panel */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[250px]">
                <div className="flex items-center gap-2 text-slate-500 mb-4 font-bold text-sm uppercase tracking-wider">
                    <Inbox size={16}/> Pending Actions
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {incomingRequests.length === 0 && votingQueue.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                            <CheckCircle size={32} className="mb-2 opacity-20"/>
                            All caught up!
                        </div>
                    ) : (
                        <>
                            {incomingRequests.map(req => (
                                <div key={`req-${req.id}`} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-xs text-blue-800 mb-1">
                                        <span className="font-bold">{req.applicant_name}</span> needs a guarantor for <span className="font-bold">KES {parseInt(req.amount_requested).toLocaleString()}</span>
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => handleGuarantorResponse(req.id, 'ACCEPTED')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-xs font-bold">Accept</button>
                                        <button onClick={() => handleGuarantorResponse(req.id, 'DECLINED')} className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 py-1 rounded text-xs font-bold">Decline</button>
                                    </div>
                                </div>
                            ))}
                            {votingQueue.map(vote => (
                                <div key={`vote-${vote.id}`} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-purple-700">VOTE: {vote.full_name}</span>
                                        <span className="text-xs text-purple-600 font-bold">KES {parseFloat(vote.amount_requested).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs text-purple-800 mb-2 italic">"{vote.purpose}"</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleVote(vote.id, 'YES')} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-1 rounded text-xs font-bold flex items-center justify-center gap-1"><ThumbsUp size={12}/> Yes</button>
                                        <button onClick={() => handleVote(vote.id, 'NO')} className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 py-1 rounded text-xs font-bold flex items-center justify-center gap-1"><ThumbsDown size={12}/> No</button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>

        {activeTab === 'deposit' && <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-8 max-w-2xl mx-auto"><h2 className="text-2xl font-bold mb-4">Deposit Funds</h2><form onSubmit={handleDeposit} className="space-y-4"><input type="number" className="w-full border p-3 rounded-xl" placeholder="Amount" value={depositForm.amount} onChange={e=>setDepositForm({...depositForm, amount:e.target.value})} /><input type="tel" className="w-full border p-3 rounded-xl" placeholder="Phone" value={depositForm.phoneNumber} onChange={e=>setDepositForm({...depositForm, phoneNumber:e.target.value})} /><button disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">{loading ? '...' : 'Confirm'}</button></form></div>}
        {activeTab === 'repay' && <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 max-w-2xl mx-auto"><h2 className="text-2xl font-bold mb-4">Loan Repayment</h2><form onSubmit={handleRepayment} className="space-y-4"><input type="number" className="w-full border p-3 rounded-xl" placeholder="Amount" value={repayForm.amount} onChange={e => setRepayForm({...repayForm, amount: e.target.value})}/><input type="text" className="w-full border p-3 rounded-xl" placeholder="Code" value={repayForm.mpesaRef} onChange={e => setRepayForm({...repayForm, mpesaRef: e.target.value})}/><button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">{loading ? '...' : 'Submit'}</button></form></div>}
        
        {activeTab === 'dashboard' && (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><CreditCard className="text-blue-500"/> Loan Application Status</h3>
                {loanState.status === 'LOADING' && <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">Loading...</div>}
                {loanState.status === 'NO_APP' && <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6"><div><h4 className="text-2xl font-bold">Apply for Loan</h4><p>Get up to 3x savings.</p></div><button onClick={handleLoanStart} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold">Start Application</button></div>}
                {loanState.status === 'FEE_PENDING' && <div className="bg-white rounded-2xl shadow-sm border-l-4 border-amber-500 p-8 flex items-center justify-between"><div><h4 className="text-lg font-bold">Fee Required</h4><p className="text-slate-500">Pay KES 500 to proceed.</p></div><button onClick={handleLoanFeePayment} disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm">Pay Fee</button></div>}
                
                {loanState.status === 'FEE_PAID' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <h4 className="text-lg font-bold text-slate-800 mb-6">Loan Details</h4>
                        <form onSubmit={handleLoanSubmit} className="space-y-4 max-w-xl">
                            <input type="number" required className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Amount" value={loanForm.amount} onChange={e => setLoanForm({...loanForm, amount: e.target.value})} />
                            <input type="number" required className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Weeks" value={loanForm.repaymentWeeks} onChange={e => setLoanForm({...loanForm, repaymentWeeks: e.target.value})} />
                            <textarea required rows="3" className="w-full border p-3 rounded-xl bg-slate-50" placeholder="Purpose" value={loanForm.purpose} onChange={e => setLoanForm({...loanForm, purpose: e.target.value})} />
                            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Next: Add Guarantors</button>
                        </form>
                    </div>
                )}

                {/* --- GUARANTOR UI (My Loan) --- */}
                {loanState.status === 'PENDING_GUARANTORS' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <div className="mb-8 pb-6 border-b border-slate-100">
                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2"><UserPlus className="text-blue-600"/> Add Guarantors</h4>
                            <p className="text-slate-500 text-sm mt-1">Search for members to guarantee your loan. At least 1 accepted request is required.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Search Members</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                                    <input type="text" className="w-full pl-10 p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white transition" placeholder="Type name..." value={searchQuery} onChange={handleSearch} />
                                    {searchResults.length > 0 && (
                                        <div className="absolute top-full mt-2 left-0 w-full bg-white shadow-xl rounded-xl border border-slate-100 overflow-hidden z-10">
                                            {searchResults.map(r => (
                                                <button key={r.id} onClick={() => addGuarantor(r.id)} className="w-full text-left p-3 hover:bg-blue-50 flex justify-between items-center">
                                                    <span className="font-bold text-slate-700">{r.full_name}</span>
                                                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Request</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selected Guarantors</label>
                                {guarantors.length === 0 ? <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-sm">No guarantors added yet.</div> : (
                                    <div className="space-y-2">
                                        {guarantors.map(g => (
                                            <div key={g.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <span className="font-bold text-slate-700 text-sm">{g.full_name}</span>
                                                {g.status === 'PENDING' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold flex items-center gap-1"><Clock size={12}/> Pending</span>}
                                                {g.status === 'ACCEPTED' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold flex items-center gap-1"><UserCheck size={12}/> Accepted</span>}
                                                {g.status === 'DECLINED' && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold flex items-center gap-1"><UserX size={12}/> Declined</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button 
                                    onClick={handleFinalSubmit} 
                                    disabled={guarantors.filter(g => g.status === 'ACCEPTED').length < 1}
                                    className="w-full mt-6 bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition shadow-lg disabled:shadow-none"
                                >
                                    Final Submit for Review
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loan Status Progression */}
                {loanState.status === 'SUBMITTED' && <div className="bg-white p-10 rounded-2xl shadow-sm border border-blue-100 text-center"><Clock size={40} className="mx-auto text-blue-500 mb-4 animate-pulse"/><h3 className="text-2xl font-bold">Under Review</h3><p>Application submitted to secretary.</p></div>}
                {loanState.status === 'TABLED' && <div className="bg-white p-10 rounded-2xl shadow-sm border border-purple-100 text-center"><Vote size={40} className="mx-auto text-purple-500 mb-4"/><h3 className="text-2xl font-bold">Tabled</h3><p>Application is tabled for the upcoming meeting.</p></div>}
                {loanState.status === 'VOTING' && <div className="bg-white p-10 rounded-2xl shadow-sm border border-purple-100 text-center"><ThumbsUp size={40} className="mx-auto text-purple-500 mb-4 animate-bounce"/><h3 className="text-2xl font-bold text-purple-900">Voting in Progress</h3><p className="text-slate-500">Members are currently voting on your application.</p></div>}
                {loanState.status === 'APPROVED' && <div className="bg-white p-10 rounded-2xl shadow-sm border border-emerald-100 text-center"><CheckCircle size={40} className="mx-auto text-emerald-500 mb-4"/><h3 className="text-2xl font-bold text-emerald-700">Approved!</h3><p className="text-slate-500">Disbursement pending from Treasurer.</p></div>}
                {loanState.status === 'REJECTED' && <div className="bg-white p-10 rounded-2xl shadow-sm border border-red-100 text-center"><AlertCircle size={40} className="mx-auto text-red-500 mb-4"/><h3 className="text-2xl font-bold text-red-700">Rejected</h3><p className="text-slate-500">Your loan application was not approved.</p><button onClick={handleLoanStart} className="mt-4 text-blue-600 underline">Try Again</button></div>}

                {loanState.status === 'ACTIVE' && <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8"><div className="grid grid-cols-3 gap-6 mb-8 text-center"><div><p className="text-xs font-bold text-slate-500 uppercase">Principal</p><p className="text-xl font-bold">KES {loanState.amount_requested.toLocaleString()}</p></div><div><p className="text-xs font-bold text-slate-500 uppercase">Paid</p><p className="text-xl font-bold text-emerald-600">KES {loanState.amount_repaid.toLocaleString()}</p></div><div><p className="text-xs font-bold text-slate-500 uppercase">Balance</p><p className="text-xl font-bold text-red-600">KES {(loanState.amount_requested - loanState.amount_repaid).toLocaleString()}</p></div></div><div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-8"><div className="bg-emerald-500 h-4 rounded-full transition-all" style={{ width: `${calculateProgress()}%` }}></div></div><button onClick={() => setActiveTab('repay')} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">Make Repayment</button></div>}
                {loanState.status === 'COMPLETED' && <div className="bg-emerald-50 p-10 rounded-2xl text-center border border-emerald-100"><CheckCircle size={40} className="mx-auto text-emerald-500 mb-4"/><h3 className="text-2xl font-bold text-emerald-900">Loan Repaid!</h3><button onClick={handleLoanStart} className="mt-6 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold">Apply New Loan</button></div>}
            </div>
        )}
      </main>
    </div>
  );
}