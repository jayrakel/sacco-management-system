import React, { useState, useEffect } from "react";
import api from "../api";
import {
  CreditCard, PiggyBank, TrendingUp, CheckCircle, Banknote, Clock, AlertCircle, UserPlus,
  Search, Inbox, Vote, ThumbsUp, Printer, FileText, Smartphone, Landmark, Globe,
  ShieldCheck, Download, Loader, Send, User, Settings, Lock, Save, Camera, Coins, Layers
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";

export default function MemberDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false); 
  const [refreshKey, setRefreshKey] = useState(0);

  const [savings, setSavings] = useState({ balance: 0, history: [] });
  const [loanState, setLoanState] = useState({ status: "LOADING", amount_repaid: 0, amount_requested: 0 });
  const [votingQueue, setVotingQueue] = useState([]);
  const [guarantors, setGuarantors] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [customCategories, setCustomCategories] = useState([]); // NEW: Store custom categories
  
  const [weeklyStats, setWeeklyStats] = useState({ total: 0, goal: 250, isComplete: false });

  const [multiplier, setMultiplier] = useState(3); 
  const [logo, setLogo] = useState(null);
  const [paymentChannels, setPaymentChannels] = useState([]);
  const [loanProcessingFee, setLoanProcessingFee] = useState(0);
  const [categoryAmounts, setCategoryAmounts] = useState({}); 

  const [loanForm, setLoanForm] = useState({ amount: "", purpose: "", repaymentWeeks: "" });
  
  // Profile State
  const [profile, setProfile] = useState({
    full_name: "", email: "", phone_number: "", id_number: "", kra_pin: "",
    next_of_kin_name: "", next_of_kin_phone: "", next_of_kin_relation: "",
    profile_image: ""
  });
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });

  // Deposit State
  const [depositMethod, setDepositMethod] = useState('MPESA'); 
  const [mpesaMode, setMpesaMode] = useState('STK'); 
  const [depositPurpose, setDepositPurpose] = useState('DEPOSIT'); 
  const [depositForm, setDepositForm] = useState({ amount: "", phoneNumber: "", reference: "" });
  const [bankForm, setBankForm] = useState({ amount: "", reference: "", bankName: "" });
  const [paypalForm, setPaypalForm] = useState({ amount: "", reference: "" }); 
  
  const [repayForm, setRepayForm] = useState({ amount: "", mpesaRef: "" });
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    const fetchData = async () => {
      try {
        const [balanceRes, historyRes, loanRes, reqRes, voteRes, settingsRes, catRes] = await Promise.all([
            api.get("/api/deposits/balance"),
            api.get("/api/deposits/history"), 
            api.get("/api/loan/status"),
            api.get("/api/loan/guarantors/requests"),
            api.get("/api/loan/vote/open"),
            api.get("/api/settings"),
            api.get("/api/settings/categories"), // Fetch Categories
        ]);

        setSavings({ balance: balanceRes.data.balance, history: historyRes.data });
        setIncomingRequests(reqRes.data);
        setVotingQueue(voteRes.data);
        setCustomCategories(catRes.data); // Store categories

        // Settings
        let minWeekly = 250;
        let amountsMap = {};
        if (Array.isArray(settingsRes.data)) {
          const multSetting = settingsRes.data.find(s => s.setting_key === "loan_multiplier");
          if (multSetting) setMultiplier(parseFloat(multSetting.setting_value));
          const logoSetting = settingsRes.data.find(s => s.setting_key === "sacco_logo");
          if (logoSetting) setLogo(logoSetting.setting_value);
          const channels = settingsRes.data.find(s => s.setting_key === "payment_channels");
          if (channels) setPaymentChannels(JSON.parse(channels.setting_value || '[]'));
          const minSetting = settingsRes.data.find(s => s.setting_key === "min_weekly_deposit");
          if (minSetting) minWeekly = parseFloat(minSetting.setting_value);
          const feeSetting = settingsRes.data.find(s => s.setting_key === "loan_processing_fee");
          if (feeSetting) setLoanProcessingFee(parseFloat(feeSetting.setting_value));
          
          // Extract category amounts
          const welfareAmount = settingsRes.data.find(s => s.setting_key === "category_welfare_amount");
          if (welfareAmount) amountsMap.WELFARE = parseFloat(welfareAmount.setting_value);
          
          const penaltyAmount = settingsRes.data.find(s => s.setting_key === "category_penalty_amount");
          if (penaltyAmount) amountsMap.PENALTY = parseFloat(penaltyAmount.setting_value);
          
          const shareAmount = settingsRes.data.find(s => s.setting_key === "category_share_capital_amount");
          if (shareAmount) amountsMap.SHARE_CAPITAL = parseFloat(shareAmount.setting_value);
          
          const depositAmount = settingsRes.data.find(s => s.setting_key === "category_deposit_amount");
          if (depositAmount) amountsMap.DEPOSIT = parseFloat(depositAmount.setting_value);
          
          setCategoryAmounts(amountsMap);
        }

        // Weekly Progress
        const now = new Date();
        const day = now.getDay() || 7; 
        if (day !== 1) now.setHours(-24 * (day - 1)); 
        now.setHours(0, 0, 0, 0); 

        const weekTotal = (historyRes.data || [])
            .filter(t => t.type === 'DEPOSIT' && t.status === 'COMPLETED' && new Date(t.created_at) >= now)
            .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

        setWeeklyStats({ total: weekTotal, goal: minWeekly, isComplete: weekTotal >= minWeekly });

        // Loan State
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

  // Fetch Profile Data on Tab Switch
  useEffect(() => {
    if (activeTab === 'profile') {
        api.get('/api/auth/profile')
           .then(res => setProfile(res.data))
           .catch(err => showNotify("error", "Failed to load profile"));
    }
  }, [activeTab]);

  const showNotify = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 5000); };

  // Auto-fill amount when category is selected
  const handlePurposeChange = (e) => {
      const value = e.target.value;
      setDepositPurpose(value);
      let amountToFill = "";

      // 1. Check if it's a predefined category with amount in system settings
      if (categoryAmounts[value] && categoryAmounts[value] > 0) {
          amountToFill = categoryAmounts[value].toString();
      }
      
      // 2. Check if it's a custom category with predefined amount
      const category = customCategories.find(cat => cat.name === value);
      if (category && category.amount > 0) {
          amountToFill = category.amount.toString();
      }
      
      // 3. Check if it's LOAN_REPAYMENT and user has active loan
      if (value === 'LOAN_REPAYMENT' && loanState.status === 'ACTIVE') {
          const weeklyInstallment = Math.ceil(loanState.schedule?.weekly_installment || 0);
          if (weeklyInstallment > 0) {
              amountToFill = weeklyInstallment.toString();
          }
      }

      // 4. Check if it's LOAN_FORM_FEE (standard fee from system settings)
      if (value === 'LOAN_FORM_FEE' && loanProcessingFee > 0) {
          amountToFill = loanProcessingFee.toString();
      }

      // Update form with the calculated amount
      if (amountToFill) {
          setDepositForm({...depositForm, amount: amountToFill});
      } else {
          setDepositForm({...depositForm, amount: ""});
      }
  };

  // --- HANDLERS ---
  const handleMpesaDeposit = async (e) => { 
      e.preventDefault(); setLoading(true); 
      try { 
          if(mpesaMode === 'STK') {
              const res = await api.post("/api/payments/mpesa/stk-push", { 
                  amount: depositForm.amount, 
                  phoneNumber: depositForm.phoneNumber, 
                  type: depositPurpose 
              }); 
              if (res.data.success) { alert(`STK Push Sent! Enter PIN to confirm ${depositPurpose}.`); }
          } else {
              const res = await api.post("/api/payments/mpesa/manual", { 
                  reference: depositForm.reference,
                  purpose: depositPurpose
              });
              if (res.data.success) { 
                  showNotify("success", res.data.message); 
                  setActiveTab("dashboard"); 
                  setRefreshKey(k=>k+1); 
                  return; 
              }
          }
          setDepositForm({ amount: "", phoneNumber: "", reference: "" }); setActiveTab("dashboard");
      } catch (e) { showNotify("error", e.response?.data?.error || "M-Pesa Failed"); } 
      setLoading(false); 
  };

  const handleBankDeposit = async (e) => { 
      e.preventDefault(); setLoading(true); 
      try { 
          const res = await api.post('/api/payments/bank/deposit', { ...bankForm, type: depositPurpose }); 
          alert(res.data.message); 
          setBankForm({ amount: '', reference: '', bankName: '' }); setActiveTab('dashboard'); setRefreshKey(k => k + 1); 
      } catch (err) { showNotify("error", err.response?.data?.error || "Failed"); } 
      setLoading(false); 
  };

  const handlePaypalDeposit = async (e) => { 
      e.preventDefault(); setLoading(true); 
      try { 
          const res = await api.post('/api/payments/paypal/deposit', { ...paypalForm, type: depositPurpose }); 
          alert(res.data.message); 
          setPaypalForm({ amount: '', reference: '' }); setActiveTab('dashboard'); setRefreshKey(k => k + 1); 
      } catch (err) { showNotify("error", err.response?.data?.error || "Failed"); } 
      setLoading(false); 
  };

  const handleLoanStart = async () => { try { await api.post("/api/loan/init"); setRefreshKey(o=>o+1); } catch (e) { showNotify("error", e.response?.data?.error || "Init Failed"); } };
  const handleLoanFeePayment = async () => { setActiveTab('deposit'); setDepositPurpose('LOAN_FORM_FEE'); }; 
  const handleLoanSubmit = async (e) => { e.preventDefault(); const maxLoan = savings.balance * multiplier; if (parseInt(loanForm.amount) > maxLoan) { showNotify("error", `Limit exceeded! Max: ${maxLoan.toLocaleString()}`); return; } try { await api.post("/api/loan/submit", { loanAppId: loanState.id, ...loanForm }); setRefreshKey(o=>o+1); } catch (e) { showNotify("error", e.response?.data?.error || "Submission failed"); } };
  const handleSearch = async (e) => { const q = e.target.value; setSearchQuery(q); if (q.length > 2) { const res = await api.get(`/api/loan/members/search?q=${q}`); setSearchResults(res.data); } else setSearchResults([]); };
  const addGuarantor = async (guarantorId) => { try { await api.post("/api/loan/guarantors/add", { loanId: loanState.id, guarantorId }); setRefreshKey(o=>o+1); setSearchResults([]); setSearchQuery(""); showNotify("success", "Request Sent!"); } catch (err) { showNotify("error", err.response?.data?.error || "Failed"); } };
  const handleFinalSubmit = async () => { try { await api.post("/api/loan/final-submit", { loanAppId: loanState.id }); setRefreshKey(o=>o+1); showNotify("success", "Application Submitted!"); } catch (e) { showNotify("error", "Failed"); } };
  const handleGuarantorResponse = async (requestId, decision) => { try { await api.post("/api/loan/guarantors/respond", { requestId, decision }); setRefreshKey(k=>k+1); showNotify(decision === "ACCEPTED" ? "success" : "error", `Request ${decision}`); } catch (err) { showNotify("error", err.response?.data?.error || "Action Failed"); } };
  const handleVote = async (loanId, decision) => { try { await api.post("/api/loan/vote", { loanId, decision }); setRefreshKey(k=>k+1); showNotify("success", "Vote Cast!"); } catch (err) { showNotify("error", err.response?.data?.error || "Voting Failed"); } };
  const handlePrint = () => { window.print(); };
  const handleDownloadStatement = async () => { if (downloading) return; setDownloading(true); try { showNotify("success", "Generating PDF..."); const response = await api.get('/api/reports/statement/me', { responseType: 'blob' }); const safeName = user.name ? user.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Member'; const now = new Date(); const fileName = `${safeName}_Statement_${now.toISOString().split('T')[0]}.pdf`; const url = window.URL.createObjectURL(new Blob([response.data])); const link = document.createElement('a'); link.href = url; link.setAttribute('download', fileName); document.body.appendChild(link); link.click(); link.remove(); } catch (err) { console.error(err); showNotify("error", "Failed to generate statement."); } finally { setDownloading(false); } };
  
  // Profile Handlers
  const handleProfileUpdate = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
        await api.put('/api/auth/profile', profile);
        showNotify("success", "Profile Updated!");
    } catch (err) {
        showNotify("error", err.response?.data?.error || "Update Failed");
    }
    setLoading(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showNotify("error", "Image too large (Max 2MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, profile_image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        showNotify("error", "Passwords do not match"); return;
    }
    if (passwordForm.newPassword.length < 6) {
        showNotify("error", "Password too short"); return;
    }
    setLoading(true);
    try {
        await api.post('/api/auth/change-password', { newPassword: passwordForm.newPassword });
        showNotify("success", "Password Changed Successfully!");
        setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (err) {
        showNotify("error", err.response?.data?.error || "Failed");
    }
    setLoading(false);
  };

  const bankChannels = paymentChannels.filter(c => c.type === 'BANK');
  const paypalChannels = paymentChannels.filter(c => c.type === 'PAYPAL');
  const mpesaChannels = paymentChannels.filter(c => c.type === 'MPESA');

  const getTransactionStyle = (status) => status === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 relative">
      {toast && <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-slide-in bg-white print:hidden ${toast.type === "success" ? "text-emerald-600 border-emerald-100" : "text-red-600 border-red-100"}`}><CheckCircle size={20} /> <span className="font-medium">{toast.msg}</span></div>}
      <div className="print:hidden"><DashboardHeader user={user} onLogout={onLogout} title="Member Portal" /></div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 print:mt-0 print:max-w-none">
        
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-6 print:hidden overflow-x-auto pb-2">
            <button onClick={() => setActiveTab("dashboard")} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${activeTab === 'dashboard' ? 'bg-indigo-900 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                <TrendingUp size={18}/> Overview
            </button>
            <button onClick={() => setActiveTab("profile")} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${activeTab === 'profile' ? 'bg-indigo-900 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                <Settings size={18}/> Settings & Profile
            </button>
        </div>

        {/* TOP STATS (Only show on Dashboard) */}
        {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:hidden">
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
          <div className={`rounded-2xl p-6 border shadow-sm flex flex-col justify-center ${weeklyStats.isComplete ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-2 mb-2"><ShieldCheck size={20} className={weeklyStats.isComplete ? "text-emerald-600" : "text-amber-500"} /><h3 className={`text-sm font-bold uppercase tracking-wider ${weeklyStats.isComplete ? "text-emerald-700" : "text-slate-500"}`}>Weekly Goal</h3></div>
            <div className="mb-4"><span className="text-3xl font-extrabold text-slate-800">KES {weeklyStats.total.toLocaleString()}</span><span className="text-slate-400 text-sm ml-1">/ {weeklyStats.goal}</span></div>
            {weeklyStats.isComplete ? (<div className="bg-emerald-100 text-emerald-700 text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-2"><CheckCircle size={14}/> Compliant!</div>) : (<div className="space-y-2"><div className="w-full bg-slate-100 rounded-full h-2.5"><div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${Math.min((weeklyStats.total / weeklyStats.goal) * 100, 100)}%` }}></div></div><p className="text-xs text-amber-600 font-medium">Deposit <b>KES {weeklyStats.goal - weeklyStats.total}</b> more.</p></div>)}
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full"><div className="flex items-center gap-2 text-slate-500 mb-4 font-bold text-sm uppercase tracking-wider"><Inbox size={16} /> Actions</div><div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-[150px]">{incomingRequests.length === 0 && votingQueue.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">No pending actions.</div> : <>{incomingRequests.map(req => <div key={req.id} className="p-2 bg-blue-50 rounded border border-blue-100 text-xs flex justify-between items-center"><span><b>{req.applicant_name}</b> needs guarantor</span><button onClick={() => handleGuarantorResponse(req.id, "ACCEPTED")} className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold">Accept</button></div>)}{votingQueue.map(vote => <div key={vote.id} className="p-2 bg-purple-50 rounded border border-purple-100 text-xs flex justify-between items-center"><span>Vote: <b>{vote.full_name}</b></span><button onClick={() => handleVote(vote.id, "YES")} className="bg-purple-600 text-white px-2 py-0.5 rounded font-bold">Yes</button></div>)}</>}</div></div>
        </div>
        )}

        {/* --- PROFILE TAB --- */}
        {activeTab === "profile" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:hidden animate-fade-in">
                {/* Personal Details Form */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><User size={24}/></div>
                        <h2 className="text-xl font-bold text-slate-800">Personal Information</h2>
                    </div>
                    
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                        {/* Profile Image Section */}
                        <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="relative group cursor-pointer">
                                {profile.profile_image ? (
                                    <img src={profile.profile_image} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 border-2 border-white shadow-md"><User size={40}/></div>
                                )}
                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={20} className="text-white"/>
                                </div>
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-700">Profile Photo</p>
                                <p className="text-xs text-slate-500">Click image to update. Max 2MB.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label><input type="text" className="w-full border p-3 rounded-xl bg-slate-50" value={profile.full_name || ''} onChange={(e) => setProfile({...profile, full_name: e.target.value})} required /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label><input type="tel" className="w-full border p-3 rounded-xl bg-slate-50" value={profile.phone_number || ''} onChange={(e) => setProfile({...profile, phone_number: e.target.value})} required /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input type="email" disabled className="w-full border p-3 rounded-xl bg-slate-100 text-slate-500 cursor-not-allowed" value={profile.email || ''} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1">ID Number</label><input type="text" disabled className="w-full border p-3 rounded-xl bg-slate-100 text-slate-500 cursor-not-allowed" value={profile.id_number || ''} /></div>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100 mt-4">
                            <h3 className="text-sm font-bold text-slate-700 mb-3">Next of Kin Details</h3>
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1">Name</label><input type="text" className="w-full border p-3 rounded-xl" value={profile.next_of_kin_name || ''} onChange={(e) => setProfile({...profile, next_of_kin_name: e.target.value})} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold text-slate-500 uppercase mb-1">Phone</label><input type="tel" className="w-full border p-3 rounded-xl" value={profile.next_of_kin_phone || ''} onChange={(e) => setProfile({...profile, next_of_kin_phone: e.target.value})} /></div>
                                    <div><label className="text-xs font-bold text-slate-500 uppercase mb-1">Relation</label><input type="text" className="w-full border p-3 rounded-xl" value={profile.next_of_kin_relation || ''} onChange={(e) => setProfile({...profile, next_of_kin_relation: e.target.value})} /></div>
                                </div>
                            </div>
                        </div>

                        <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 transition">
                            {loading ? <Loader className="animate-spin" size={18}/> : <Save size={18}/>} Save Changes
                        </button>
                    </form>
                </div>

                {/* Security Settings */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-red-50 text-red-600 rounded-full"><Lock size={24}/></div>
                            <h2 className="text-xl font-bold text-slate-800">Security</h2>
                        </div>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
                                <input type="password" required minLength={6} className="w-full border p-3 rounded-xl" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Confirm Password</label>
                                <input type="password" required minLength={6} className="w-full border p-3 rounded-xl" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
                            </div>
                            <button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                                <Settings size={18}/> Update Password
                            </button>
                        </form>
                    </div>

                    <div className="bg-slate-100 rounded-2xl p-6 border border-slate-200 text-slate-500 text-sm">
                        <p className="flex items-center gap-2 mb-2 font-bold"><ShieldCheck size={16}/> Account Status</p>
                        <p>Your account is <span className="text-green-600 font-bold uppercase">{profile.is_active ? "Active" : "Inactive"}</span>.</p>
                        <p className="mt-1">Member since {new Date(profile.created_at).toLocaleDateString()}.</p>
                    </div>
                </div>
            </div>
        )}

        {/* --- DEPOSIT TAB --- */}
        {activeTab === "deposit" && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-2xl mx-auto print:hidden animate-fade-in">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">Deposit Funds</h2>
            
            {/* Payment Purpose Selector (UPDATED) */}
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm">
                <label className="block text-xs font-bold text-indigo-900 uppercase mb-2 flex items-center gap-2">
                    <Layers size={16}/> Select Purpose:
                </label>
                <div className="relative">
                    <select 
                        className="w-full border border-indigo-200 p-3 pl-10 rounded-xl bg-white font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                        value={depositPurpose}
                        onChange={handlePurposeChange}
                    >
                        {/* Default Options */}
                        <option value="DEPOSIT">Savings Deposit (General)</option>
                        <option value="SHARE_CAPITAL">Buy Shares (Share Capital)</option>
                        <option value="LOAN_REPAYMENT">Loan Repayment</option>
                        <option value="LOAN_FORM_FEE">Loan Application Fee</option>
                        <option value="WELFARE">Welfare Contribution</option>
                        <option value="PENALTY">Pay Penalty/Fine</option>
                        
                        {/* Custom Categories (Fetched from Backend) */}
                        {customCategories.length > 0 && (
                            <optgroup label="Custom Categories">
                                {customCategories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.description || cat.name}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    <Coins className="absolute left-3 top-3.5 text-indigo-400" size={18}/>
                </div>
                
                {/* Hints */}
                {depositPurpose === 'LOAN_REPAYMENT' && loanState.status === 'ACTIVE' && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle size={12}/> ✓ Weekly installment pre-filled: <span className="font-bold">KES {Math.ceil(loanState.schedule?.weekly_installment || 0).toLocaleString()}</span></p>}
                {depositPurpose === 'LOAN_REPAYMENT' && loanState.status !== 'ACTIVE' && <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><AlertCircle size={12}/> You don't have an active loan. Enter amount manually.</p>}
                {depositPurpose === 'LOAN_FORM_FEE' && loanProcessingFee > 0 && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle size={12}/> ✓ Fee pre-filled: <span className="font-bold">KES {loanProcessingFee.toLocaleString()}</span></p>}
                {depositPurpose === 'LOAN_FORM_FEE' && loanProcessingFee === 0 && <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1"><CheckCircle size={12}/> Pays the fee for your pending application.</p>}
                {(depositPurpose === 'WELFARE' || depositPurpose === 'PENALTY' || depositPurpose === 'SHARE_CAPITAL' || depositPurpose === 'DEPOSIT') && categoryAmounts[depositPurpose] > 0 && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle size={12}/> ✓ Amount pre-filled: <span className="font-bold">KES {categoryAmounts[depositPurpose].toLocaleString()}</span></p>}
                {depositPurpose !== 'DEPOSIT' && depositPurpose !== 'LOAN_REPAYMENT' && depositPurpose !== 'LOAN_FORM_FEE' && depositPurpose !== 'SHARE_CAPITAL' && depositPurpose !== 'WELFARE' && depositPurpose !== 'PENALTY' && depositForm.amount && customCategories.find(c => c.name === depositPurpose) && <p className="text-xs text-blue-600 mt-2 flex items-center gap-1"><CheckCircle size={12}/> ✓ Amount pre-filled: <span className="font-bold">KES {parseFloat(depositForm.amount).toLocaleString()}</span></p>}
            </div>

            <div className="flex gap-2 mb-6 border-b border-slate-100 pb-4 overflow-x-auto">
                <button onClick={() => setDepositMethod('MPESA')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${depositMethod === 'MPESA' ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Smartphone size={18} /> M-Pesa</button>
                <button onClick={() => setDepositMethod('BANK')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${depositMethod === 'BANK' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Landmark size={18} /> Bank</button>
                <button onClick={() => setDepositMethod('PAYPAL')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${depositMethod === 'PAYPAL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Globe size={18} /> PayPal</button>
            </div>

            {depositMethod === 'MPESA' && (
                <div>
                    <div className="flex gap-4 mb-4">
                        <button onClick={()=>setMpesaMode('STK')} className={`flex-1 text-xs py-2 rounded-lg font-bold border ${mpesaMode==='STK' ? 'bg-green-50 border-green-200 text-green-700' : 'border-slate-200'}`}>Automatic (STK Push)</button>
                        <button onClick={()=>setMpesaMode('MANUAL')} className={`flex-1 text-xs py-2 rounded-lg font-bold border ${mpesaMode==='MANUAL' ? 'bg-green-50 border-green-200 text-green-700' : 'border-slate-200'}`}>Claim Payment (Direct)</button>
                    </div>

                    <form onSubmit={handleMpesaDeposit} className="space-y-5">
                        {mpesaMode === 'STK' ? (
                            <>
                                <div className="bg-green-50 p-4 rounded-xl border border-green-100 mb-2"><p className="text-xs text-green-800 font-bold">STK Push</p><p className="text-[10px] text-green-600 mt-1">We will send a prompt to your phone.</p></div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                                        <span>Amount (KES)</span>
                                        {depositForm.amount && depositPurpose !== 'DEPOSIT' && <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded">Auto-filled</span>}
                                    </label>
                                    <input 
                                        type="number" 
                                        required 
                                        className={`w-full border p-3 rounded-xl font-bold text-lg transition ${depositForm.amount && depositPurpose !== 'DEPOSIT' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200'}`}
                                        value={depositForm.amount} 
                                        onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                                        placeholder="Enter amount"
                                    />
                                </div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">M-Pesa Phone</label><input type="tel" required className="w-full border p-3 rounded-xl" placeholder="2547..." value={depositForm.phoneNumber} onChange={(e) => setDepositForm({ ...depositForm, phoneNumber: e.target.value })} /></div>
                            </>
                        ) : (
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100 mb-2">
                                <p className="text-xs text-green-800 font-bold">Step 1: Send Money</p>
                                <p className="text-[10px] text-green-700 mb-2">Send funds via Paybill/Send Money to our Treasurer.</p>
                                <p className="text-xs text-green-800 font-bold">Step 2: Enter Reference Code</p>
                                <p className="text-[10px] text-green-600 mt-1">Once you receive the SMS from M-Pesa, enter the code here to verify and claim your payment.</p>
                                <div className="mt-4"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Transaction Code</label><input type="text" required placeholder="e.g. QWE12345..." className="w-full border p-3 rounded-xl uppercase font-mono" value={depositForm.reference} onChange={(e) => setDepositForm({ ...depositForm, reference: e.target.value })} /></div>
                            </div>
                        )}
                        
                        <button disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold transition">
                            {loading ? "Processing..." : (mpesaMode==='STK' ? "Send Request" : "Verify & Claim")}
                        </button>
                    </form>
                </div>
            )}

            {/* Bank and Paypal Forms */}
            {depositMethod === 'BANK' && (
                <form onSubmit={handleBankDeposit} className="space-y-5">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-2"><p className="text-xs text-red-900 font-bold">Bank Accounts</p>{bankChannels.length === 0 ? <p className="text-xs text-red-600 italic">No bank accounts configured.</p> : <ul className="mt-2 space-y-2">{bankChannels.map((b, i) => (<li key={i} className="text-xs text-slate-700 bg-white p-2 rounded border border-red-100"><span className="font-bold">{b.name}:</span> <span className="font-mono">{b.account}</span><br/><span className="text-[10px] text-slate-500">{b.instructions}</span></li>))}</ul>}</div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Bank</label><select className="w-full border p-3 rounded-xl bg-white" value={bankForm.bankName} onChange={(e) => setBankForm({...bankForm, bankName: e.target.value})}><option value="" disabled>-- Select Bank --</option>{bankChannels.map((b, i) => <option key={i} value={b.name}>{b.name}</option>)}</select></div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Amount (KES)</span>
                            {depositForm.amount && depositPurpose !== 'DEPOSIT' && <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded">Auto-filled</span>}
                        </label>
                        <input 
                            type="number" 
                            required 
                            className={`w-full border p-3 rounded-xl font-bold text-lg transition ${depositForm.amount && depositPurpose !== 'DEPOSIT' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200'}`}
                            value={depositForm.amount} 
                            onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                            placeholder="Enter amount"
                        />
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ref Code</label><input type="text" required className="w-full border p-3 rounded-xl font-mono uppercase" value={bankForm.reference} onChange={(e) => setBankForm({ ...bankForm, reference: e.target.value })} /></div>
                    <button disabled={loading} className="w-full bg-red-900 hover:bg-red-800 text-white py-4 rounded-xl font-bold transition">{loading ? "Submitting..." : "Submit for Verification"}</button>
                </form>
            )}

            {depositMethod === 'PAYPAL' && (
                <form onSubmit={handlePaypalDeposit} className="space-y-5">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-2"><p className="text-xs text-blue-900 font-bold">PayPal Info</p>{paypalChannels.length === 0 ? <p className="text-xs text-blue-600 italic">No PayPal accounts configured.</p> : <ul className="mt-2 space-y-2">{paypalChannels.map((p, i) => (<li key={i} className="text-xs text-slate-700 bg-white p-2 rounded border border-blue-100"><span className="font-bold">{p.name}:</span> <span className="font-mono">{p.account}</span><br/><span className="text-[10px] text-slate-500">{p.instructions}</span></li>))}</ul>}</div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Amount (KES)</span>
                            {depositForm.amount && depositPurpose !== 'DEPOSIT' && <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded">Auto-filled</span>}
                        </label>
                        <input 
                            type="number" 
                            required 
                            className={`w-full border p-3 rounded-xl font-bold text-lg transition ${depositForm.amount && depositPurpose !== 'DEPOSIT' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200'}`}
                            value={depositForm.amount} 
                            onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                            placeholder="Enter amount"
                        />
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Transaction ID</label><input type="text" required className="w-full border p-3 rounded-xl font-mono uppercase" value={paypalForm.reference} onChange={(e) => setPaypalForm({ ...paypalForm, reference: e.target.value })} /></div>
                    <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition">{loading ? "Submitting..." : "Submit for Verification"}</button>
                </form>
            )}
          </div>
        )}
        
        {/* REPAY TAB */}
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
        
        {/* DASHBOARD TAB (LOAN STATUS) */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="print:hidden space-y-6">
                {loanState.status === "LOADING" && <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">Loading...</div>}
                
                {/* NO LOAN - START */}
                {loanState.status === "NO_APP" && (
                    <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div>
                            <h4 className="text-2xl font-bold">Apply for Loan</h4>
                            <p>Get up to <span className="font-bold text-yellow-300">{multiplier}x</span> savings.</p>
                            {/* Warning Message if not eligible */}
                            {loanState.eligibility && !loanState.eligibility.eligible && (
                                <div className="mt-3 bg-red-500/20 border border-red-300/30 p-2 rounded-lg text-sm flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-200"/>
                                    <span>Requirement: KES {loanState.eligibility.min_savings.toLocaleString()} savings.</span>
                                </div>
                            )}
                        </div>
                        {loanState.eligibility && !loanState.eligibility.eligible ? (
                            <button disabled className="bg-slate-300 text-slate-500 px-6 py-3 rounded-xl font-bold cursor-not-allowed">
                                Locked 🔒
                            </button>
                        ) : (
                            <button onClick={handleLoanStart} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition">
                                Start Application
                            </button>
                        )}
                    </div>
                )}
                
                {/* ... (Loan status cards FPENDING, PAID, etc - Same as previous) ... */}
                {loanState.status === "FEE_PENDING" && <div className="bg-white p-8 rounded-2xl shadow-sm border border-orange-100"><h3 className="text-xl font-bold text-orange-800 mb-2">Step 1: Application Fee</h3><p className="text-slate-500 mb-4">Please pay the non-refundable processing fee of <b>KES {loanState.fee_amount || 500}</b>.</p><button onClick={handleLoanFeePayment} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold">Pay via M-Pesa</button></div>}
                {loanState.status === "FEE_PAID" && <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200"><h3 className="text-xl font-bold mb-4">Step 2: Loan Details</h3><form onSubmit={handleLoanSubmit} className="space-y-4"><input type="number" required placeholder="Amount (KES)" className="w-full border p-3 rounded-xl" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })} /><input type="text" required placeholder="Purpose (e.g. School Fees)" className="w-full border p-3 rounded-xl" value={loanForm.purpose} onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })} /><input type="number" required placeholder="Repayment Period (Weeks)" className="w-full border p-3 rounded-xl" value={loanForm.repaymentWeeks} onChange={(e) => setLoanForm({ ...loanForm, repaymentWeeks: e.target.value })} /><button className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold w-full">Next: Guarantors</button></form></div>}
                {loanState.status === "PENDING_GUARANTORS" && <div className="bg-white p-8 rounded-2xl shadow-sm border border-blue-100"><h3 className="text-xl font-bold mb-2">Step 3: Guarantors</h3><p className="text-slate-500 mb-4">Search and add at least 2 active members.</p><div className="flex gap-2 mb-4"><input type="text" placeholder="Search by name..." className="flex-1 border p-3 rounded-xl" value={searchQuery} onChange={handleSearch} /></div>{searchResults.length > 0 && <div className="bg-slate-50 p-2 rounded-xl mb-4 space-y-2">{searchResults.map(u => <div key={u.id} className="flex justify-between items-center p-2 bg-white rounded border"><span>{u.full_name}</span><button onClick={() => addGuarantor(u.id)} className="text-blue-600 font-bold text-sm"><UserPlus size={18} /></button></div>)}</div>}<div className="space-y-2 mb-6">{guarantors.map(g => <div key={g.id} className="flex justify-between p-3 bg-slate-50 rounded-xl"><span>{g.full_name}</span><span className={`text-xs font-bold px-2 py-1 rounded ${g.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 'bg-gray-200'}`}>{g.status}</span></div>)}</div><button onClick={handleFinalSubmit} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Submit Application</button></div>}
                {['SUBMITTED', 'VERIFIED'].includes(loanState.status) && (<div className="bg-white p-10 rounded-2xl shadow-sm border border-blue-100 text-center"><Clock size={40} className="mx-auto text-blue-500 mb-4 animate-pulse" /><h3 className="text-2xl font-bold">Under Review</h3><p className="text-slate-500 mb-2">{loanState.status === 'SUBMITTED' ? "Waiting for Credit Officer Appraisal..." : "Verified! Waiting for Secretary to Table."}</p></div>)}
                {loanState.status === "TABLED" && <div className="bg-white p-10 rounded-2xl shadow-sm border border-purple-100 text-center"><Vote size={40} className="mx-auto text-purple-500 mb-4"/><h3 className="text-2xl font-bold">Tabled</h3><p>Application is tabled for the upcoming meeting.</p></div>}
                {loanState.status === "VOTING" && <div className="bg-white p-10 rounded-2xl shadow-sm border border-purple-100 text-center"><ThumbsUp size={40} className="mx-auto text-purple-500 mb-4 animate-bounce"/><h3 className="text-2xl font-bold text-purple-900">Voting in Progress</h3><p className="text-slate-500">Members are currently voting on your application.</p></div>}
                {loanState.status === "APPROVED" && <div className="bg-white p-10 rounded-2xl shadow-sm border border-emerald-100 text-center"><CheckCircle size={40} className="mx-auto text-emerald-500 mb-4"/><h3 className="text-2xl font-bold text-emerald-700">Approved!</h3><p className="text-slate-500">Disbursement pending from Treasurer.</p></div>}
                {loanState.status === "REJECTED" && <div className="bg-white p-10 rounded-2xl shadow-sm border border-red-100 text-center"><AlertCircle size={40} className="mx-auto text-red-500 mb-4"/><h3 className="text-2xl font-bold text-red-700">Rejected</h3><p className="text-slate-500">Your loan application was not approved.</p><button onClick={handleLoanStart} className="mt-4 text-blue-600 underline">Try Again</button></div>}
                {loanState.status === 'ACTIVE' && (<div className="space-y-6"><div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden"><div className="p-6 bg-indigo-900 text-white flex justify-between items-center"><div><p className="text-indigo-200 text-xs uppercase font-bold">Current Loan Status</p><h3 className="text-2xl font-bold">Active Repayment</h3></div><div className="text-right"><p className="text-xs text-indigo-300 uppercase">Week</p><p className="text-xl font-bold font-mono">{loanState.schedule?.weeks_passed || 0} <span className="text-indigo-400 text-sm">/ {loanState.repayment_weeks}</span></p></div></div><div className="p-8"><div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8"><div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Loan Due</p><p className="text-lg font-bold text-slate-800">KES {loanState.total_due?.toLocaleString()}</p></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Repaid</p><p className="text-lg font-bold text-emerald-600">KES {loanState.amount_repaid.toLocaleString()}</p></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Weekly Installment</p><p className="text-lg font-bold text-indigo-600">KES {Math.ceil(loanState.schedule?.weekly_installment || 0).toLocaleString()}</p></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Balance Left</p><p className="text-lg font-bold text-red-600">KES {(loanState.total_due - loanState.amount_repaid).toLocaleString()}</p></div></div><button onClick={() => setActiveTab('repay')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2"><Banknote size={20}/> Make Weekly Installment</button></div></div></div>)}
                {loanState.status === "COMPLETED" && <div className="bg-emerald-50 p-10 rounded-2xl text-center border border-emerald-100"><CheckCircle size={40} className="mx-auto text-emerald-500 mb-4"/><h3 className="text-2xl font-bold text-emerald-900">Loan Repaid!</h3><button onClick={handleLoanStart} className="mt-6 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold">Apply New Loan</button></div>}
            </div>
            
            {/* HISTORY TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:bg-white print:border-b-2 print:border-black">
                  <div className="flex items-center gap-3">{logo && <img src={logo} alt="Logo" className="h-12 w-auto object-contain hidden print:block" />}<div><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FileText size={18} className="text-slate-400 print:hidden"/> <span className="print:hidden">Contribution History</span><span className="hidden print:inline">Account Statement</span></h3><p className="text-xs text-slate-500 hidden print:block">Generated for {user.name} on {new Date().toLocaleDateString()}</p></div></div>
                  <div className="flex gap-2 print:hidden">
                    <button onClick={handleDownloadStatement} disabled={downloading} className={`flex items-center gap-2 text-sm font-bold text-slate-700 hover:bg-slate-100 px-4 py-2 rounded-lg transition border border-slate-200 ${downloading ? "opacity-50 cursor-not-allowed" : ""}`}>{downloading ? <Loader size={16} className="animate-spin"/> : <Download size={16}/>} {downloading ? "Generating..." : "PDF"}</button>
                    <button onClick={handlePrint} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition"><Printer size={16}/> Print</button>
                  </div>
              </div>
              {savings.history.length === 0 ? <div className="p-12 text-center text-slate-400 flex flex-col items-center"><AlertCircle size={48} className="mb-4 opacity-20"/><p>No contributions found.</p></div> : 
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs print:bg-white print:text-black print:border-b">
                            <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Ref</th><th className="px-6 py-4">Description</th><th className="px-6 py-4">Type</th><th className="px-6 py-4 text-right">Amount</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                            {savings.history.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                                    <td className="px-6 py-4 text-slate-600">{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.reference_code || '-'}</td>
                                    <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate">{t.description || '-'}</td>
                                    <td className="px-6 py-4">
                                        {t.status === 'PENDING' 
                                            ? <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-[10px] font-bold">PENDING</span> 
                                            : <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getTransactionStyle(t.type)}`}>{t.type}</span>
                                        }
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold font-mono ${['DEPOSIT', 'SHARE_CAPITAL'].includes(t.type) && parseFloat(t.amount) > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                        {['DEPOSIT', 'SHARE_CAPITAL'].includes(t.type) && parseFloat(t.amount) > 0 ? '+' : ''} {parseFloat(t.amount).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              }
            </div>
          </div>
        )}
      </main>
    </div>
  );
}