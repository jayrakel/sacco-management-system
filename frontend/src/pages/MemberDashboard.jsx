import React, { useState, useEffect } from "react";
import api from "../api";
import {
  CreditCard, PiggyBank, TrendingUp, CheckCircle, Banknote, Clock, AlertCircle, UserPlus,
  Search, UserCheck, UserX, Inbox, Vote, ThumbsUp, ThumbsDown, Printer, FileText, Smartphone, Landmark, Globe,
  ShieldCheck, Calculator, Users, ArrowRight // Added Icons
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";

export default function MemberDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Data State
  const [savings, setSavings] = useState({ balance: 0, history: [] });
  const [loanState, setLoanState] = useState({ status: "LOADING", amount_repaid: 0, amount_requested: 0 });
  const [votingQueue, setVotingQueue] = useState([]);
  const [guarantors, setGuarantors] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [incomingRequests, setIncomingRequests] = useState([]);
  
  // New State for Features
  const [weeklyStats, setWeeklyStats] = useState({ total: 0, goal: 250, isComplete: false });
  const [myLiabilities, setMyLiabilities] = useState([]); // Loans I guaranteed
  const [calcForm, setCalcForm] = useState({ amount: '', months: '' }); // Calculator
  const [calcResult, setCalcResult] = useState(null);

  // Settings
  const [settings, setSettings] = useState({}); 
  const [multiplier, setMultiplier] = useState(3); 
  const [logo, setLogo] = useState(null);
  const [paymentChannels, setPaymentChannels] = useState([]); 

  // Transaction Forms
  const [loanForm, setLoanForm] = useState({ amount: "", purpose: "", repaymentWeeks: "" });
  const [depositMethod, setDepositMethod] = useState('MPESA'); 
  const [depositForm, setDepositForm] = useState({ amount: "", phoneNumber: "" });
  const [bankForm, setBankForm] = useState({ amount: "", reference: "", bankName: "" });
  const [paypalForm, setPaypalForm] = useState({ amount: "", reference: "" }); 
  const [repayForm, setRepayForm] = useState({ amount: "", mpesaRef: "" });
  
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    const fetchData = async () => {
      try {
        const [balanceRes, historyRes, loanRes, reqRes, voteRes, settingsRes, liabilitiesRes] = await Promise.all([
            api.get("/api/deposits/balance"),
            api.get("/api/deposits/history"),
            api.get("/api/loan/status"),
            api.get("/api/loan/guarantors/requests"),
            api.get("/api/loan/vote/open"),
            api.get("/api/settings"),
            api.get("/api/loan/guarantors/liabilities"), // Fetch Liabilities
        ]);

        setSavings({ balance: balanceRes.data.balance, history: historyRes.data });
        setIncomingRequests(reqRes.data);
        setVotingQueue(voteRes.data);
        setMyLiabilities(liabilitiesRes.data || []);

        // Process Settings
        let minWeekly = 250;
        if (Array.isArray(settingsRes.data)) {
          const settingsObj = settingsRes.data.reduce((acc, curr) => ({ ...acc, [curr.setting_key]: curr.setting_value }), {});
          setSettings(settingsObj);

          if (settingsObj.loan_multiplier) setMultiplier(parseFloat(settingsObj.loan_multiplier));
          if (settingsObj.sacco_logo) setLogo(settingsObj.sacco_logo);
          if (settingsObj.payment_channels) setPaymentChannels(JSON.parse(settingsObj.payment_channels || '[]'));
          if (settingsObj.min_weekly_deposit) minWeekly = parseFloat(settingsObj.min_weekly_deposit);
        }

        // Weekly Progress Logic
        const now = new Date();
        const day = now.getDay() || 7; 
        if (day !== 1) now.setHours(-24 * (day - 1)); 
        now.setHours(0, 0, 0, 0); 
        const weekTotal = (historyRes.data || [])
            .filter(t => t.type === 'DEPOSIT' && new Date(t.created_at) >= now)
            .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
        setWeeklyStats({ total: weekTotal, goal: minWeekly, isComplete: weekTotal >= minWeekly });

        // Loan Status
        const loan = loanRes.data;
        if (loan.status !== "NO_APP") {
          loan.amount_requested = parseFloat(loan.amount_requested || 0);
          loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
        }
        setLoanState(loan);

        if (loan.status === "PENDING_GUARANTORS") {
          const gRes = await api.get("/api/loan/guarantors");
          setGuarantors(gRes.data);
        }
      } catch (err) { console.error("Data error", err); }
    };
    fetchData();
  }, [user, refreshKey, navigate]);

  const showNotify = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 5000); };

  // --- CALCULATOR LOGIC ---
  const handleCalculate = (e) => {
    e.preventDefault();
    const principal = parseFloat(calcForm.amount);
    const months = parseFloat(calcForm.months);
    if(!principal || !months) return;

    const rate = parseFloat(settings.loan_interest_rate || 12) / 100;
    // Simple Interest Estimate: P * R * (T/12)
    const interest = principal * rate * (months / 12);
    const total = principal + interest;
    const monthly = total / months;
    
    setCalcResult({ interest, total, monthly });
  };

  // --- HANDLERS ---
  const handleMpesaDeposit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await api.post("/api/payments/mpesa/stk-push", { amount: depositForm.amount, phoneNumber: depositForm.phoneNumber, type: 'DEPOSIT' });
      if (res.data.success) { alert(`STK Push Sent! Check your phone (${depositForm.phoneNumber}) to enter PIN.`); setDepositForm({ amount: "", phoneNumber: "" }); setActiveTab("dashboard"); }
    } catch (e) { showNotify("error", e.response?.data?.error || "M-Pesa Failed"); }
    setLoading(false);
  };
  const handleBankDeposit = async (e) => { e.preventDefault(); setLoading(true); try { await api.post('/api/payments/bank/deposit', bankForm); alert(`Success: Deposit recorded!`); setBankForm({ amount: '', reference: '', bankName: '' }); setActiveTab('dashboard'); setRefreshKey(k => k + 1); } catch (err) { showNotify("error", err.response?.data?.error || "Bank Deposit Failed"); } setLoading(false); };
  const handlePaypalDeposit = async (e) => { e.preventDefault(); setLoading(true); try { await api.post('/api/payments/paypal/deposit', paypalForm); alert("PayPal Transfer Recorded!"); setPaypalForm({ amount: '', reference: '' }); setActiveTab('dashboard'); setRefreshKey(k => k + 1); } catch (err) { showNotify("error", err.response?.data?.error || "PayPal Deposit Failed"); } setLoading(false); };
  const handleRepayment = async (e) => { e.preventDefault(); setLoading(true); try { await api.post("/api/payments/repay-loan", { loanAppId: loanState.id, amount: repayForm.amount, mpesaRef: repayForm.mpesaRef || "REF" }); showNotify("success", "Repayment received!"); setRepayForm({ amount: "", mpesaRef: "" }); setRefreshKey((o) => o + 1); setActiveTab("dashboard"); } catch (e) { showNotify("error", "Failed"); } setLoading(false); };
  // Loan/Guarantor Handlers
  const handleLoanStart = async () => { try { await api.post("/api/loan/init"); setRefreshKey(o=>o+1); } catch (e) {} };
  const handleLoanFeePayment = async () => { try { await api.post("/api/payments/pay-fee", { loanAppId: loanState.id, mpesaRef: "PAYMENT" + Math.floor(10000 + Math.random() * 90000) }); showNotify("success", "Fee Paid!"); setRefreshKey(o=>o+1); } catch (e) { showNotify("error", "Payment Failed"); } };
  const handleLoanSubmit = async (e) => { e.preventDefault(); const maxLoan = savings.balance * multiplier; if (parseInt(loanForm.amount) > maxLoan) { showNotify("error", `Limit exceeded! Max: ${maxLoan.toLocaleString()}`); return; } try { await api.post("/api/loan/submit", { loanAppId: loanState.id, ...loanForm }); setRefreshKey(o=>o+1); } catch (e) { showNotify("error", e.response?.data?.error || "Submission failed"); } };
  const handleSearch = async (e) => { const q = e.target.value; setSearchQuery(q); if (q.length > 2) { const res = await api.get(`/api/loan/members/search?q=${q}`); setSearchResults(res.data); } else setSearchResults([]); };
  const addGuarantor = async (guarantorId) => { try { await api.post("/api/loan/guarantors/add", { loanId: loanState.id, guarantorId }); setRefreshKey(o=>o+1); setSearchResults([]); setSearchQuery(""); showNotify("success", "Request Sent!"); } catch (err) { showNotify("error", err.response?.data?.error || "Failed"); } };
  const handleFinalSubmit = async () => { try { await api.post("/api/loan/final-submit", { loanAppId: loanState.id }); setRefreshKey(o=>o+1); showNotify("success", "Application Submitted!"); } catch (e) { showNotify("error", "Failed"); } };
  const handleGuarantorResponse = async (requestId, decision) => { try { await api.post("/api/loan/guarantors/respond", { requestId, decision }); setRefreshKey(k=>k+1); showNotify(decision === "ACCEPTED" ? "success" : "error", `Request ${decision}`); } catch (err) { showNotify("error", "Action Failed"); } };
  const handleVote = async (loanId, decision) => { try { await api.post("/api/loan/vote", { loanId, decision }); setRefreshKey(k=>k+1); showNotify("success", "Vote Cast!"); } catch (err) { showNotify("error", err.response?.data?.error || "Voting Failed"); } };
  const handlePrint = () => { window.print(); };
  
  // Filter channels
  const bankChannels = paymentChannels.filter(c => c.type === 'BANK');
  const paypalChannels = paymentChannels.filter(c => c.type === 'PAYPAL');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 relative">
      {toast && <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-slide-in bg-white print:hidden ${toast.type === "success" ? "text-emerald-600 border-emerald-100" : "text-red-600 border-red-100"}`}><CheckCircle size={20} /> <span className="font-medium">{toast.msg}</span></div>}
      <div className="print:hidden"><DashboardHeader user={user} onLogout={onLogout} title="Member Portal" /></div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 print:mt-0 print:max-w-none">
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 print:hidden">
             <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border'}`}>Dashboard</button>
             <button onClick={() => setActiveTab('deposit')} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition ${activeTab === 'deposit' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border'}`}>Deposit</button>
             <button onClick={() => setActiveTab('repay')} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition ${activeTab === 'repay' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}>Repay Loan</button>
             {/* NEW TABS */}
             <button onClick={() => setActiveTab('calculator')} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition ${activeTab === 'calculator' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border'}`}>Calc</button>
             <button onClick={() => setActiveTab('guarantors')} className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition ${activeTab === 'guarantors' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 border'}`}>Guarantors</button>
        </div>

        {/* --- LOAN CALCULATOR --- */}
        {activeTab === "calculator" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-purple-100">
                    <div className="flex items-center gap-3 mb-6 text-purple-800"><Calculator size={28}/><h2 className="text-2xl font-bold">Loan Calculator</h2></div>
                    <form onSubmit={handleCalculate} className="space-y-4">
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loan Amount (KES)</label><input type="number" className="w-full border p-3 rounded-xl font-bold text-lg" value={calcForm.amount} onChange={e => setCalcForm({...calcForm, amount: e.target.value})} placeholder="e.g. 50000" required/></div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Repayment Period (Months)</label><input type="number" className="w-full border p-3 rounded-xl font-bold text-lg" value={calcForm.months} onChange={e => setCalcForm({...calcForm, months: e.target.value})} placeholder="e.g. 12" required/></div>
                        <button className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition">Calculate</button>
                    </form>
                    <div className="mt-6 bg-purple-50 p-4 rounded-xl text-xs text-purple-700">
                        <p><b>Note:</b> Interest Rate is <b>{settings.loan_interest_rate}%</b> p.a. (Simple Interest). This is an estimate.</p>
                    </div>
                </div>
                <div className="bg-purple-900 p-8 rounded-2xl shadow-lg text-white flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-10"><PiggyBank size={150} /></div>
                    {calcResult ? (
                        <div className="relative z-10 space-y-6">
                            <div><p className="text-purple-300 text-sm font-bold uppercase">Monthly Installment</p><h2 className="text-4xl font-bold">KES {calcResult.monthly.toLocaleString(undefined, {maximumFractionDigits: 0})}</h2></div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-purple-700">
                                <div><p className="text-purple-300 text-xs uppercase">Total Interest</p><p className="text-xl font-bold">KES {calcResult.interest.toLocaleString()}</p></div>
                                <div><p className="text-purple-300 text-xs uppercase">Total Repayment</p><p className="text-xl font-bold text-emerald-300">KES {calcResult.total.toLocaleString()}</p></div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-purple-300"><p>Enter details to see breakdown.</p></div>
                    )}
                </div>
            </div>
        )}

        {/* --- GUARANTOR DASHBOARD --- */}
        {activeTab === "guarantors" && (
            <div className="space-y-8 animate-fade-in">
                {/* 1. MY GUARANTORS */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2"><Users className="text-slate-500"/><h3 className="font-bold text-lg text-slate-800">My Loan Guarantors</h3></div>
                    {guarantors.length === 0 ? <div className="p-8 text-center text-slate-400">You haven't requested any guarantors yet.</div> : 
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase"><tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Date</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{guarantors.map(g => <tr key={g.id}><td className="px-6 py-4 font-medium">{g.full_name}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${g.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : g.status === 'DECLINED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{g.status}</span></td><td className="px-6 py-4 text-slate-400">{new Date(g.created_at).toLocaleDateString()}</td></tr>)}</tbody>
                        </table>
                    }
                </div>

                {/* 2. LOANS I HAVE GUARANTEED (Liabilities) */}
                <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                    <div className="p-6 border-b border-red-50 bg-red-50/30 flex items-center gap-2"><AlertCircle className="text-red-500"/><h3 className="font-bold text-lg text-red-900">My Active Liabilities (Guaranteed Loans)</h3></div>
                    {myLiabilities.length === 0 ? <div className="p-8 text-center text-slate-400">You are not guaranteeing any loans.</div> : 
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-50 text-red-800 font-bold text-xs uppercase"><tr><th className="px-6 py-3">Borrower</th><th className="px-6 py-3">Loan Amount</th><th className="px-6 py-3">Outstanding</th><th className="px-6 py-3">Loan Status</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {myLiabilities.map(l => (
                                    <tr key={l.loan_id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium">{l.borrower_name}</td>
                                        <td className="px-6 py-4">KES {parseFloat(l.amount_requested).toLocaleString()}</td>
                                        <td className="px-6 py-4 font-bold text-red-600">KES {(parseFloat(l.total_due || l.amount_requested) - parseFloat(l.amount_repaid || 0)).toLocaleString()}</td>
                                        <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold">{l.loan_status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    }
                    <div className="p-4 bg-red-50 text-xs text-red-700 border-t border-red-100">
                        <b>Warning:</b> If these members default, you may be liable for a portion of the outstanding debt.
                    </div>
                </div>
            </div>
        )}

        {/* ... (DEPOSIT TAB from previous turn) ... */}
        {activeTab === "deposit" && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-2xl mx-auto print:hidden">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">Deposit Funds</h2>
            <div className="flex gap-2 mb-6 border-b border-slate-100 pb-4 overflow-x-auto">
                <button onClick={() => setDepositMethod('MPESA')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${depositMethod === 'MPESA' ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Smartphone size={18} /> M-Pesa</button>
                <button onClick={() => setDepositMethod('BANK')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${depositMethod === 'BANK' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Landmark size={18} /> Bank</button>
                <button onClick={() => setDepositMethod('PAYPAL')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${depositMethod === 'PAYPAL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Globe size={18} /> PayPal</button>
            </div>

            {depositMethod === 'MPESA' && (
                <form onSubmit={handleMpesaDeposit} className="space-y-5 animate-fade-in">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 mb-2"><p className="text-xs text-green-800 font-bold">Automatic STK Push</p><p className="text-[10px] text-green-600 mt-1">Enter phone to receive PIN prompt.</p></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (KES)</label><input type="number" required className="w-full border p-3 rounded-xl font-bold text-lg" value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">M-Pesa Phone</label><input type="tel" required className="w-full border p-3 rounded-xl" placeholder="2547..." value={depositForm.phoneNumber} onChange={(e) => setDepositForm({ ...depositForm, phoneNumber: e.target.value })} /></div>
                    <button disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold transition">{loading ? "Sending..." : "Send Request"}</button>
                </form>
            )}
            
            {/* ... (Bank & PayPal forms match previous logic) ... */}
            {depositMethod === 'BANK' && (
                <form onSubmit={handleBankDeposit} className="space-y-5 animate-fade-in">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-2">
                        <p className="text-xs text-red-900 font-bold">Available Accounts</p>
                        {bankChannels.length === 0 ? <p className="text-xs text-red-600 italic">No bank accounts configured.</p> : <ul className="mt-2 space-y-2">{bankChannels.map((b, i) => (<li key={i} className="text-xs text-slate-700 bg-white p-2 rounded border border-red-100"><span className="font-bold">{b.name}:</span> <span className="font-mono">{b.account}</span><br/><span className="text-[10px] text-slate-500">{b.instructions}</span></li>))}</ul>}
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Bank</label><select className="w-full border p-3 rounded-xl bg-white" value={bankForm.bankName} onChange={(e) => setBankForm({...bankForm, bankName: e.target.value})}><option value="" disabled>-- Select Bank --</option>{bankChannels.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label><input type="number" required className="w-full border p-3 rounded-xl font-bold text-lg" value={bankForm.amount} onChange={(e) => setBankForm({ ...bankForm, amount: e.target.value })} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference Code</label><input type="text" required className="w-full border p-3 rounded-xl font-mono uppercase" value={bankForm.reference} onChange={(e) => setBankForm({ ...bankForm, reference: e.target.value })} /></div>
                    <button disabled={loading} className="w-full bg-red-900 hover:bg-red-800 text-white py-4 rounded-xl font-bold transition">{loading ? "Verifying..." : "Submit Deposit"}</button>
                </form>
            )}
            {depositMethod === 'PAYPAL' && (
                <form onSubmit={handlePaypalDeposit} className="space-y-5 animate-fade-in">
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-2">
                        <p className="text-xs text-blue-900 font-bold">PayPal Details</p>
                        {paypalChannels.length === 0 ? <p className="text-xs text-blue-600 italic">No PayPal accounts configured.</p> : <ul className="mt-2 space-y-2">{paypalChannels.map((p, i) => (<li key={i} className="text-xs text-slate-700 bg-white p-2 rounded border border-blue-100"><span className="font-bold">{p.name}:</span> <span className="font-mono">{p.account}</span><br/><span className="text-[10px] text-slate-500">{p.instructions}</span></li>))}</ul>}
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label><input type="number" required className="w-full border p-3 rounded-xl font-bold text-lg" value={paypalForm.amount} onChange={(e) => setPaypalForm({ ...paypalForm, amount: e.target.value })} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Transaction ID</label><input type="text" required className="w-full border p-3 rounded-xl font-mono uppercase" value={paypalForm.reference} onChange={(e) => setPaypalForm({ ...paypalForm, reference: e.target.value })} /></div>
                    <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition">{loading ? "Verifying..." : "Submit Deposit"}</button>
                </form>
            )}
          </div>
        )}
        
        {/* ... (Repay and Dashboard tabs logic kept the same) ... */}
        {activeTab === "repay" && (
            <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 max-w-2xl mx-auto print:hidden">
                <h2 className="text-2xl font-bold mb-4">Loan Repayment</h2>
                <form onSubmit={handleRepayment} className="space-y-4">
                <input type="number" className="w-full border p-3 rounded-xl" placeholder="Amount" value={repayForm.amount} onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })} />
                <input type="text" className="w-full border p-3 rounded-xl" placeholder="Code" value={repayForm.mpesaRef} onChange={(e) => setRepayForm({ ...repayForm, mpesaRef: e.target.value })} />
                <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">{loading ? "..." : "Submit"}</button>
                </form>
            </div>
        )}
        
        {activeTab === "dashboard" && (
          <div className="space-y-6">
             {/* (Loan Status and Transactions Table components kept from previous logic) */}
             {/* Top Stats & Weekly Goal are handled in the top section now */}
             <div className="print:hidden space-y-6">
                {loanState.status === "LOADING" && <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">Loading...</div>}
                {loanState.status === "NO_APP" && (<div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6"><div><h4 className="text-2xl font-bold">Apply for Loan</h4><p>Get up to <span className="font-bold text-yellow-300">{multiplier}x</span> savings.</p></div><button onClick={handleLoanStart} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold">Start Application</button></div>)}
                {/* ... Other loan statuses ... */}
                {['SUBMITTED', 'VERIFIED'].includes(loanState.status) && (<div className="bg-white p-10 rounded-2xl shadow-sm border border-blue-100 text-center"><Clock size={40} className="mx-auto text-blue-500 mb-4 animate-pulse" /><h3 className="text-2xl font-bold">Under Review</h3><p className="text-slate-500 mb-2">{loanState.status === 'SUBMITTED' ? "Waiting for Credit Officer Appraisal..." : "Verified! Waiting for Secretary to Table."}</p></div>)}
                {loanState.status === "TABLED" && <div className="bg-white p-10 rounded-2xl shadow-sm border border-purple-100 text-center"><Vote size={40} className="mx-auto text-purple-500 mb-4"/><h3 className="text-2xl font-bold">Tabled</h3><p>Application is tabled for the upcoming meeting.</p></div>}
                {loanState.status === "VOTING" && <div className="bg-white p-10 rounded-2xl shadow-sm border border-purple-100 text-center"><ThumbsUp size={40} className="mx-auto text-purple-500 mb-4 animate-bounce"/><h3 className="text-2xl font-bold text-purple-900">Voting in Progress</h3><p className="text-slate-500">Members are currently voting on your application.</p></div>}
                {loanState.status === "APPROVED" && <div className="bg-white p-10 rounded-2xl shadow-sm border border-emerald-100 text-center"><CheckCircle size={40} className="mx-auto text-emerald-500 mb-4"/><h3 className="text-2xl font-bold text-emerald-700">Approved!</h3><p className="text-slate-500">Disbursement pending from Treasurer.</p></div>}
                {loanState.status === "REJECTED" && <div className="bg-white p-10 rounded-2xl shadow-sm border border-red-100 text-center"><AlertCircle size={40} className="mx-auto text-red-500 mb-4"/><h3 className="text-2xl font-bold text-red-700">Rejected</h3><p className="text-slate-500">Your loan application was not approved.</p><button onClick={handleLoanStart} className="mt-4 text-blue-600 underline">Try Again</button></div>}
                {loanState.status === 'ACTIVE' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                            <div className="p-6 bg-indigo-900 text-white flex justify-between items-center">
                                <div><p className="text-indigo-200 text-xs uppercase font-bold">Current Loan Status</p><h3 className="text-2xl font-bold">Active Repayment</h3></div>
                                <div className="text-right"><p className="text-xs text-indigo-300 uppercase">Week</p><p className="text-xl font-bold font-mono">{loanState.schedule?.weeks_passed || 0} <span className="text-indigo-400 text-sm">/ {loanState.repayment_weeks}</span></p></div>
                            </div>
                            <div className="p-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Loan Due</p><p className="text-lg font-bold text-slate-800">KES {loanState.total_due?.toLocaleString()}</p></div>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Repaid</p><p className="text-lg font-bold text-emerald-600">KES {loanState.amount_repaid.toLocaleString()}</p></div>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Weekly Installment</p><p className="text-lg font-bold text-indigo-600">KES {Math.ceil(loanState.schedule?.weekly_installment || 0).toLocaleString()}</p></div>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Balance Left</p><p className="text-lg font-bold text-red-600">KES {(loanState.total_due - loanState.amount_repaid).toLocaleString()}</p></div>
                                </div>
                                <button onClick={() => setActiveTab('repay')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2"><Banknote size={20}/> Make Weekly Installment</button>
                            </div>
                        </div>
                    </div>
                )}
                {loanState.status === "COMPLETED" && <div className="bg-emerald-50 p-10 rounded-2xl text-center border border-emerald-100"><CheckCircle size={40} className="mx-auto text-emerald-500 mb-4"/><h3 className="text-2xl font-bold text-emerald-900">Loan Repaid!</h3><button onClick={handleLoanStart} className="mt-6 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold">Apply New Loan</button></div>}
             </div>

             {/* Transactions Table */}
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:bg-white print:border-b-2 print:border-black">
                  <div className="flex items-center gap-3">{logo && <img src={logo} alt="Logo" className="h-12 w-auto object-contain hidden print:block" />}<div><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FileText size={18} className="text-slate-400 print:hidden"/> <span className="print:hidden">Contribution History</span><span className="hidden print:inline">Account Statement</span></h3><p className="text-xs text-slate-500 hidden print:block">Generated for {user.name} on {new Date().toLocaleDateString()}</p></div></div>
                  <button onClick={handlePrint} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition print:hidden"><Printer size={16}/> Print Statement</button>
              </div>
              {savings.history.length === 0 ? <div className="p-12 text-center text-slate-400 flex flex-col items-center"><AlertCircle size={48} className="mb-4 opacity-20"/><p>No contributions found.</p></div> : 
                  <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs print:bg-white print:text-black print:border-b"><tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Reference</th><th className="px-6 py-4">Type</th><th className="px-6 py-4 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100 print:divide-slate-200">{savings.history.map((t) => <tr key={t.id} className="hover:bg-slate-50 print:hover:bg-transparent"><td className="px-6 py-4 text-slate-600">{new Date(t.created_at).toLocaleDateString()}</td><td className="px-6 py-4 font-mono text-xs text-slate-500">{t.transaction_ref || '-'}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold print:border print:border-slate-300 ${t.type === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t.type}</span></td><td className={`px-6 py-4 text-right font-bold font-mono ${t.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-slate-600'}`}>{t.type === 'DEPOSIT' ? '+' : '-'} {parseFloat(t.amount).toLocaleString()}</td></tr>)}</tbody></table></div>
              }
              <div className="hidden print:block mt-8 text-center text-xs text-slate-400 border-t pt-4"><p>End of Statement • System Generated</p></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}