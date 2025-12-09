import React, { useState, useEffect } from "react";
import api from "../api";
import {
  CreditCard, PiggyBank, TrendingUp, CheckCircle, Banknote, Clock, AlertCircle, UserPlus,
  Search, UserCheck, UserX, Inbox, Vote, ThumbsUp, ThumbsDown, Printer, FileText, Smartphone, Landmark, Globe,
  ShieldCheck, Download, Loader // Added Loader Icon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";

export default function MemberDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false); // New state for PDF download
  const [refreshKey, setRefreshKey] = useState(0);

  const [savings, setSavings] = useState({ balance: 0, history: [] });
  const [loanState, setLoanState] = useState({ status: "LOADING", amount_repaid: 0, amount_requested: 0 });
  const [votingQueue, setVotingQueue] = useState([]);
  const [guarantors, setGuarantors] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [incomingRequests, setIncomingRequests] = useState([]);
  
  // New State for Weekly Progress
  const [weeklyStats, setWeeklyStats] = useState({ total: 0, goal: 250, isComplete: false });

  const [multiplier, setMultiplier] = useState(3); 
  const [logo, setLogo] = useState(null);
  const [paymentChannels, setPaymentChannels] = useState([]); 

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
        const [balanceRes, historyRes, loanRes, reqRes, voteRes, settingsRes] = await Promise.all([
            api.get("/api/deposits/balance"),
            api.get("/api/deposits/history"), // We will filter this locally for weekly stats
            api.get("/api/loan/status"),
            api.get("/api/loan/guarantors/requests"),
            api.get("/api/loan/vote/open"),
            api.get("/api/settings"),
        ]);

        setSavings({ balance: balanceRes.data.balance, history: historyRes.data });
        setIncomingRequests(reqRes.data);
        setVotingQueue(voteRes.data);

        // Settings
        let minWeekly = 250;
        if (Array.isArray(settingsRes.data)) {
          const multSetting = settingsRes.data.find(s => s.setting_key === "loan_multiplier");
          if (multSetting) setMultiplier(parseFloat(multSetting.setting_value));
          const logoSetting = settingsRes.data.find(s => s.setting_key === "sacco_logo");
          if (logoSetting) setLogo(logoSetting.setting_value);
          const channels = settingsRes.data.find(s => s.setting_key === "payment_channels");
          if (channels) setPaymentChannels(JSON.parse(channels.setting_value || '[]'));
          const minSetting = settingsRes.data.find(s => s.setting_key === "min_weekly_deposit");
          if (minSetting) minWeekly = parseFloat(minSetting.setting_value);
        }

        // CALCULATE WEEKLY PROGRESS (Client Side Logic)
        // 1. Get start of week (Monday)
        const now = new Date();
        const day = now.getDay() || 7; // Get current day number, converting Sun (0) to 7
        if (day !== 1) now.setHours(-24 * (day - 1)); // Go back to Monday
        now.setHours(0, 0, 0, 0); // Start of Monday

        // 2. Sum deposits since Monday
        const weekTotal = (historyRes.data || [])
            .filter(t => t.type === 'DEPOSIT' && new Date(t.created_at) >= now)
            .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

        setWeeklyStats({ total: weekTotal, goal: minWeekly, isComplete: weekTotal >= minWeekly });

        // Loan Logic
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

  // Handlers
  const handleMpesaDeposit = async (e) => { e.preventDefault(); setLoading(true); try { const res = await api.post("/api/payments/mpesa/stk-push", { amount: depositForm.amount, phoneNumber: depositForm.phoneNumber, type: 'DEPOSIT' }); if (res.data.success) { alert(`STK Push Sent! Check your phone (${depositForm.phoneNumber}) to enter PIN.`); setDepositForm({ amount: "", phoneNumber: "" }); setActiveTab("dashboard"); } } catch (e) { showNotify("error", e.response?.data?.error || "M-Pesa Failed"); } setLoading(false); };
  const handleBankDeposit = async (e) => { e.preventDefault(); setLoading(true); try { await api.post('/api/payments/bank/deposit', bankForm); alert(`Success: Deposit recorded!`); setBankForm({ amount: '', reference: '', bankName: '' }); setActiveTab('dashboard'); setRefreshKey(k => k + 1); } catch (err) { showNotify("error", err.response?.data?.error || "Bank Deposit Failed"); } setLoading(false); };
  const handlePaypalDeposit = async (e) => { e.preventDefault(); setLoading(true); try { await api.post('/api/payments/paypal/deposit', paypalForm); alert("PayPal Transfer Recorded!"); setPaypalForm({ amount: '', reference: '' }); setActiveTab('dashboard'); setRefreshKey(k => k + 1); } catch (err) { showNotify("error", err.response?.data?.error || "PayPal Deposit Failed"); } setLoading(false); };
  const handleRepayment = async (e) => { e.preventDefault(); setLoading(true); try { await api.post("/api/payments/repay-loan", { loanAppId: loanState.id, amount: repayForm.amount, mpesaRef: repayForm.mpesaRef || "REF" }); showNotify("success", "Repayment received!"); setRepayForm({ amount: "", mpesaRef: "" }); setRefreshKey((o) => o + 1); setActiveTab("dashboard"); } catch (e) { showNotify("error", "Failed"); } setLoading(false); };
  const handleLoanStart = async () => { try { await api.post("/api/loan/init"); setRefreshKey(o=>o+1); } catch (e) {} };
  const handleLoanFeePayment = async () => { try { await api.post("/api/payments/pay-fee", { loanAppId: loanState.id, mpesaRef: "PAYMENT" + Math.floor(10000 + Math.random() * 90000) }); showNotify("success", "Fee Paid!"); setRefreshKey(o=>o+1); } catch (e) { showNotify("error", "Payment Failed"); } };
  const handleLoanSubmit = async (e) => { e.preventDefault(); const maxLoan = savings.balance * multiplier; if (parseInt(loanForm.amount) > maxLoan) { showNotify("error", `Limit exceeded! Max: ${maxLoan.toLocaleString()}`); return; } try { await api.post("/api/loan/submit", { loanAppId: loanState.id, ...loanForm }); setRefreshKey(o=>o+1); } catch (e) { showNotify("error", e.response?.data?.error || "Submission failed"); } };
  const handleSearch = async (e) => { const q = e.target.value; setSearchQuery(q); if (q.length > 2) { const res = await api.get(`/api/loan/members/search?q=${q}`); setSearchResults(res.data); } else setSearchResults([]); };
  const addGuarantor = async (guarantorId) => { try { await api.post("/api/loan/guarantors/add", { loanId: loanState.id, guarantorId }); setRefreshKey(o=>o+1); setSearchResults([]); setSearchQuery(""); showNotify("success", "Request Sent!"); } catch (err) { showNotify("error", err.response?.data?.error || "Failed"); } };
  const handleFinalSubmit = async () => { try { await api.post("/api/loan/final-submit", { loanAppId: loanState.id }); setRefreshKey(o=>o+1); showNotify("success", "Application Submitted!"); } catch (e) { showNotify("error", "Failed"); } };
  
  const handleGuarantorResponse = async (requestId, decision) => { 
    try { 
      await api.post("/api/loan/guarantors/respond", { requestId, decision }); 
      setRefreshKey(k=>k+1); 
      showNotify(decision === "ACCEPTED" ? "success" : "error", `Request ${decision}`); 
    } catch (err) { 
      showNotify("error", err.response?.data?.error || "Action Failed"); 
    } 
  };

  const handleVote = async (loanId, decision) => { try { await api.post("/api/loan/vote", { loanId, decision }); setRefreshKey(k=>k+1); showNotify("success", "Vote Cast!"); } catch (err) { showNotify("error", err.response?.data?.error || "Voting Failed"); } };
  const handlePrint = () => { window.print(); };

  // --- UPDATED: PDF Statement Download Handler ---
  const handleDownloadStatement = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      showNotify("success", "Generating PDF...");
      
      const response = await api.get('/api/reports/statement/me', {
        responseType: 'blob',
      });

      const safeName = user.name ? user.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Member';
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileName = `${safeName}_Statement_${dateStr}_${timeStr}.pdf`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
    } catch (err) {
      console.error(err);
      showNotify("error", "Failed to generate statement.");
    } finally {
        setDownloading(false);
    }
  };
  
  // Filter channels
  const bankChannels = paymentChannels.filter(c => c.type === 'BANK');
  const paypalChannels = paymentChannels.filter(c => c.type === 'PAYPAL');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 relative">
      {toast && <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-slide-in bg-white print:hidden ${toast.type === "success" ? "text-emerald-600 border-emerald-100" : "text-red-600 border-red-100"}`}><CheckCircle size={20} /> <span className="font-medium">{toast.msg}</span></div>}
      <div className="print:hidden"><DashboardHeader user={user} onLogout={onLogout} title="Member Portal" /></div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 print:mt-0 print:max-w-none">
        
        {/* TOP STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:hidden">
          
          {/* 1. BALANCE CARD */}
          <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><PiggyBank size={120} /></div>
            <div className="relative z-10">
              <p className="text-slate-400 font-medium mb-1">Total Savings Balance</p>
              <h1 className="text-4xl sm:text-5xl font-bold mb-6">KES {savings.balance.toLocaleString()}</h1>
              <div className="flex gap-3">
                <button onClick={() => setActiveTab("deposit")} className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition"><TrendingUp size={18} /> Deposit</button>
                <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-3 rounded-xl font-bold border border-slate-700 hover:bg-slate-800 ${activeTab === "dashboard" ? "hidden" : "block"}`}>Cancel</button>
              </div>
            </div>
          </div>

          {/* 2. WEEKLY GOAL TRACKER */}
          <div className={`rounded-2xl p-6 border shadow-sm flex flex-col justify-center ${weeklyStats.isComplete ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={20} className={weeklyStats.isComplete ? "text-emerald-600" : "text-amber-500"} />
                <h3 className={`text-sm font-bold uppercase tracking-wider ${weeklyStats.isComplete ? "text-emerald-700" : "text-slate-500"}`}>Weekly Goal</h3>
            </div>
            <div className="mb-4">
                <span className="text-3xl font-extrabold text-slate-800">KES {weeklyStats.total.toLocaleString()}</span>
                <span className="text-slate-400 text-sm ml-1">/ {weeklyStats.goal}</span>
            </div>
            {weeklyStats.isComplete ? (
                <div className="bg-emerald-100 text-emerald-700 text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-2">
                    <CheckCircle size={14}/> You are compliant for this week!
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min((weeklyStats.total / weeklyStats.goal) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-amber-600 font-medium">Deposit <b>KES {weeklyStats.goal - weeklyStats.total}</b> more to avoid fines.</p>
                </div>
            )}
          </div>

          {/* 3. NOTIFICATIONS */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="flex items-center gap-2 text-slate-500 mb-4 font-bold text-sm uppercase tracking-wider"><Inbox size={16} /> Actions</div>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-[150px]">
              {incomingRequests.length === 0 && votingQueue.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">No pending actions.</div> : 
              <>
                {incomingRequests.map(req => <div key={req.id} className="p-2 bg-blue-50 rounded border border-blue-100 text-xs flex justify-between items-center"><span><b>{req.applicant_name}</b> needs guarantor</span><button onClick={() => handleGuarantorResponse(req.id, "ACCEPTED")} className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold">Accept</button></div>)}
                {votingQueue.map(vote => <div key={vote.id} className="p-2 bg-purple-50 rounded border border-purple-100 text-xs flex justify-between items-center"><span>Vote: <b>{vote.full_name}</b></span><button onClick={() => handleVote(vote.id, "YES")} className="bg-purple-600 text-white px-2 py-0.5 rounded font-bold">Yes</button></div>)}
              </>}
            </div>
          </div>
        </div>

        {/* ... Deposit Form Tab ... */}
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

            {depositMethod === 'BANK' && (
                <form onSubmit={handleBankDeposit} className="space-y-5 animate-fade-in">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-2">
                        <p className="text-xs text-red-900 font-bold">Available Accounts</p>
                        {bankChannels.length === 0 ? <p className="text-xs text-red-600 italic">No bank accounts configured.</p> : 
                            <ul className="mt-2 space-y-2">
                                {bankChannels.map((b, i) => (
                                    <li key={i} className="text-xs text-slate-700 bg-white p-2 rounded border border-red-100">
                                        <span className="font-bold">{b.name}:</span> <span className="font-mono">{b.account}</span> <br/>
                                        <span className="text-[10px] text-slate-500">{b.instructions}</span>
                                    </li>
                                ))}
                            </ul>
                        }
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Bank Deposited To</label>
                        <select className="w-full border p-3 rounded-xl bg-white" value={bankForm.bankName} onChange={(e) => setBankForm({...bankForm, bankName: e.target.value})}>
                            <option value="" disabled>-- Select Bank --</option>
                            {bankChannels.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}
                        </select>
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (KES)</label><input type="number" required className="w-full border p-3 rounded-xl font-bold text-lg" value={bankForm.amount} onChange={(e) => setBankForm({ ...bankForm, amount: e.target.value })} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference Code</label><input type="text" required className="w-full border p-3 rounded-xl font-mono uppercase" value={bankForm.reference} onChange={(e) => setBankForm({ ...bankForm, reference: e.target.value })} /></div>
                    <button disabled={loading} className="w-full bg-red-900 hover:bg-red-800 text-white py-4 rounded-xl font-bold transition">{loading ? "Verifying..." : "Submit Deposit"}</button>
                </form>
            )}

            {depositMethod === 'PAYPAL' && (
                <form onSubmit={handlePaypalDeposit} className="space-y-5 animate-fade-in">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-2">
                        <p className="text-xs text-blue-900 font-bold">PayPal Details</p>
                        {paypalChannels.length === 0 ? <p className="text-xs text-blue-600 italic">No PayPal accounts configured.</p> : 
                            <ul className="mt-2 space-y-2">
                                {paypalChannels.map((p, i) => (
                                    <li key={i} className="text-xs text-slate-700 bg-white p-2 rounded border border-blue-100">
                                        <span className="font-bold">{p.name}:</span> <span className="font-mono">{p.account}</span> <br/>
                                        <span className="text-[10px] text-slate-500">{p.instructions}</span>
                                    </li>
                                ))}
                            </ul>
                        }
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (USD/KES)</label><input type="number" required className="w-full border p-3 rounded-xl font-bold text-lg" value={paypalForm.amount} onChange={(e) => setPaypalForm({ ...paypalForm, amount: e.target.value })} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Transaction ID</label><input type="text" required className="w-full border p-3 rounded-xl font-mono uppercase" value={paypalForm.reference} onChange={(e) => setPaypalForm({ ...paypalForm, reference: e.target.value })} /></div>
                    <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition">{loading ? "Verifying..." : "Submit Deposit"}</button>
                </form>
            )}
          </div>
        )}
        
        {/* Repayment Tab */}
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
        
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="print:hidden space-y-6">
                {loanState.status === "LOADING" && <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">Loading...</div>}
                {loanState.status === "NO_APP" && (<div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6"><div><h4 className="text-2xl font-bold">Apply for Loan</h4><p>Get up to <span className="font-bold text-yellow-300">{multiplier}x</span> savings.</p></div><button onClick={handleLoanStart} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold">Start Application</button></div>)}
                
                {/* Loan Application Steps */}
                {loanState.status === "FEE_PENDING" && <div className="bg-white p-8 rounded-2xl shadow-sm border border-orange-100"><h3 className="text-xl font-bold text-orange-800 mb-2">Step 1: Application Fee</h3><p className="text-slate-500 mb-4">Please pay the non-refundable processing fee of <b>KES {loanState.fee_amount || 500}</b>.</p><button onClick={handleLoanFeePayment} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold">Pay via M-Pesa</button></div>}
                {loanState.status === "FEE_PAID" && <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200"><h3 className="text-xl font-bold mb-4">Step 2: Loan Details</h3><form onSubmit={handleLoanSubmit} className="space-y-4"><input type="number" required placeholder="Amount (KES)" className="w-full border p-3 rounded-xl" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })} /><input type="text" required placeholder="Purpose (e.g. School Fees)" className="w-full border p-3 rounded-xl" value={loanForm.purpose} onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })} /><input type="number" required placeholder="Repayment Period (Weeks)" className="w-full border p-3 rounded-xl" value={loanForm.repaymentWeeks} onChange={(e) => setLoanForm({ ...loanForm, repaymentWeeks: e.target.value })} /><button className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold w-full">Next: Guarantors</button></form></div>}
                {loanState.status === "PENDING_GUARANTORS" && <div className="bg-white p-8 rounded-2xl shadow-sm border border-blue-100"><h3 className="text-xl font-bold mb-2">Step 3: Guarantors</h3><p className="text-slate-500 mb-4">Search and add at least 2 active members.</p><div className="flex gap-2 mb-4"><input type="text" placeholder="Search by name..." className="flex-1 border p-3 rounded-xl" value={searchQuery} onChange={handleSearch} /></div>{searchResults.length > 0 && <div className="bg-slate-50 p-2 rounded-xl mb-4 space-y-2">{searchResults.map(u => <div key={u.id} className="flex justify-between items-center p-2 bg-white rounded border"><span>{u.full_name}</span><button onClick={() => addGuarantor(u.id)} className="text-blue-600 font-bold text-sm"><UserPlus size={18} /></button></div>)}</div>}<div className="space-y-2 mb-6">{guarantors.map(g => <div key={g.id} className="flex justify-between p-3 bg-slate-50 rounded-xl"><span>{g.full_name}</span><span className={`text-xs font-bold px-2 py-1 rounded ${g.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 'bg-gray-200'}`}>{g.status}</span></div>)}</div><button onClick={handleFinalSubmit} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Submit Application</button></div>}
                
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
            
            {/* CONTRIBUTION HISTORY / STATEMENT */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:bg-white print:border-b-2 print:border-black">
                  <div className="flex items-center gap-3">{logo && <img src={logo} alt="Logo" className="h-12 w-auto object-contain hidden print:block" />}<div><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FileText size={18} className="text-slate-400 print:hidden"/> <span className="print:hidden">Contribution History</span><span className="hidden print:inline">Account Statement</span></h3><p className="text-xs text-slate-500 hidden print:block">Generated for {user.name} on {new Date().toLocaleDateString()}</p></div></div>
                  
                  {/* ACTIONS: PRINT AND DOWNLOAD */}
                  <div className="flex gap-2 print:hidden">
                    <button 
                        onClick={handleDownloadStatement} 
                        disabled={downloading}
                        className={`flex items-center gap-2 text-sm font-bold text-slate-700 hover:bg-slate-100 px-4 py-2 rounded-lg transition border border-slate-200 ${downloading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        {downloading ? <Loader size={16} className="animate-spin"/> : <Download size={16}/>}
                        {downloading ? "Generating..." : "PDF"}
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition"><Printer size={16}/> Print</button>
                  </div>
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