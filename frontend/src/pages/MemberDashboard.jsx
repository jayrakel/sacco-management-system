import React, { useState, useEffect } from "react";
import api from "../api";
import {
  CreditCard,
  PiggyBank,
  TrendingUp,
  CheckCircle,
  Banknote,
  Clock,
  AlertCircle,
  UserPlus,
  Search,
  UserCheck,
  UserX,
  Inbox,
  Vote,
  ThumbsUp,
  ThumbsDown,
  Printer,
  FileText,
  Smartphone // Added for M-Pesa UI
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";

export default function MemberDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Data State
  const [savings, setSavings] = useState({ balance: 0, history: [] });
  const [loanState, setLoanState] = useState({
    status: "LOADING",
    amount_repaid: 0,
    amount_requested: 0,
  });
  const [votingQueue, setVotingQueue] = useState([]);

  // Guarantor State
  const [guarantors, setGuarantors] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Incoming Requests
  const [incomingRequests, setIncomingRequests] = useState([]);

  // System Settings
  const [multiplier, setMultiplier] = useState(3); 
  const [logo, setLogo] = useState(null); 

  // Forms
  const [loanForm, setLoanForm] = useState({
    amount: "",
    purpose: "",
    repaymentWeeks: "",
  });
  const [depositForm, setDepositForm] = useState({
    amount: "",
    phoneNumber: "",
  });
  const [repayForm, setRepayForm] = useState({ amount: "", mpesaRef: "" });
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    const fetchData = async () => {
      try {
        const [balanceRes, historyRes, loanRes, reqRes, voteRes, settingsRes] =
          await Promise.all([
            api.get("/api/deposits/balance"),
            api.get("/api/deposits/history"),
            api.get("/api/loan/status"),
            api.get("/api/loan/guarantors/requests"),
            api.get("/api/loan/vote/open"),
            api.get("/api/settings"),
          ]);

        setSavings({
          balance: balanceRes.data.balance,
          history: historyRes.data,
        });
        setIncomingRequests(reqRes.data);
        setVotingQueue(voteRes.data);

        if (Array.isArray(settingsRes.data)) {
          const multSetting = settingsRes.data.find(
            (s) => s.setting_key === "loan_multiplier"
          );
          if (multSetting) setMultiplier(parseFloat(multSetting.setting_value));

          const logoSetting = settingsRes.data.find((s) => s.setting_key === "sacco_logo");
          if (logoSetting) setLogo(logoSetting.setting_value);
        }

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
      } catch (err) {
        console.error("Data error", err);
      }
    };
    fetchData();
  }, [user, refreshKey, navigate]);

  const showNotify = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  // --- UPDATED: M-PESA DEPOSIT HANDLER ---
  const handleDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Trigger STK Push
      const res = await api.post("/api/payments/mpesa/stk-push", {
        amount: depositForm.amount,
        phoneNumber: depositForm.phoneNumber,
        type: 'DEPOSIT'
      });

      if (res.data.success) {
        alert(`STK Push Sent! Check your phone (${depositForm.phoneNumber}) to enter PIN.`);
        setDepositForm({ amount: "", phoneNumber: "" });
        setActiveTab("dashboard");
        // We don't refresh immediately because the callback takes a few seconds
        // You could implement polling here, but for now we wait for user to refresh
      }
    } catch (e) {
      showNotify("error", e.response?.data?.error || "M-Pesa Failed");
    }
    setLoading(false);
  };

  const handleRepayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/payments/repay-loan", {
        loanAppId: loanState.id,
        amount: repayForm.amount,
        mpesaRef: repayForm.mpesaRef || "REF",
      });
      showNotify("success", "Repayment received!");
      setRepayForm({ amount: "", mpesaRef: "" });
      setRefreshKey((o) => o + 1);
      setActiveTab("dashboard");
    } catch (e) {
      showNotify("error", "Failed");
    }
    setLoading(false);
  };

  const handleLoanStart = async () => {
    try {
      await api.post("/api/loan/init");
      setRefreshKey((o) => o + 1);
    } catch (e) {}
  };

  const handleLoanFeePayment = async () => {
    try {
      await api.post("/api/payments/pay-fee", {
        loanAppId: loanState.id,
        mpesaRef: "PAYMENT" + Math.floor(10000 + Math.random() * 90000),
      });
      showNotify("success", "Fee Paid Successfully!");
      setRefreshKey((o) => o + 1);
    } catch (e) {
      showNotify("error", "Payment Failed");
    }
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    const maxLoan = savings.balance * multiplier;
    if (parseInt(loanForm.amount) > maxLoan) {
      showNotify("error", `Limit exceeded! Max: ${maxLoan.toLocaleString()}`);
      return;
    }

    try {
      await api.post("/api/loan/submit", {
        loanAppId: loanState.id,
        ...loanForm,
      });
      setRefreshKey((o) => o + 1);
    } catch (e) {
      showNotify("error", e.response?.data?.error || "Submission failed");
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length > 2) {
      const res = await api.get(`/api/loan/members/search?q=${q}`);
      setSearchResults(res.data);
    } else setSearchResults([]);
  };

  const addGuarantor = async (guarantorId) => {
    try {
      await api.post("/api/loan/guarantors/add", {
        loanId: loanState.id,
        guarantorId,
      });
      setRefreshKey((o) => o + 1);
      setSearchResults([]);
      setSearchQuery("");
      showNotify("success", "Request Sent!");
    } catch (err) {
      showNotify("error", err.response?.data?.error || "Failed");
    }
  };

  const handleFinalSubmit = async () => {
    try {
      await api.post("/api/loan/final-submit", { loanAppId: loanState.id });
      setRefreshKey((o) => o + 1);
      showNotify("success", "Application Submitted!");
    } catch (e) {
      showNotify("error", "Failed");
    }
  };

  const handleGuarantorResponse = async (requestId, decision) => {
    try {
      await api.post("/api/loan/guarantors/respond", { requestId, decision });
      setRefreshKey((k) => k + 1);
      showNotify(
        decision === "ACCEPTED" ? "success" : "error",
        `Request ${decision}`
      );
    } catch (err) {
      showNotify("error", "Action Failed");
    }
  };

  const handleVote = async (loanId, decision) => {
    try {
      await api.post("/api/loan/vote", { loanId, decision });
      setRefreshKey((k) => k + 1);
      showNotify("success", "Vote Cast!");
    } catch (err) {
      showNotify("error", err.response?.data?.error || "Voting Failed");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 relative">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-slide-in bg-white print:hidden ${
            toast.type === "success"
              ? "text-emerald-600 border-emerald-100"
              : "text-red-600 border-red-100"
          }`}
        >
          <CheckCircle size={20} />{" "}
          <span className="font-medium">{toast.msg}</span>
        </div>
      )}

      <div className="print:hidden">
        <DashboardHeader user={user} onLogout={onLogout} title="Member Portal" />
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 print:mt-0 print:max-w-none">
        
        {/* Top Stats - Hidden in Print */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:hidden">
          <div className="md:col-span-2 bg-slate-900 rounded-2xl p-8 text-white shadow-2xl shadow-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <PiggyBank size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-slate-400 font-medium mb-1">
                Total Savings Balance
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold mb-6">
                KES {savings.balance.toLocaleString()}
              </h1>
              <div className="flex gap-3">
                <button
                  onClick={() => setActiveTab("deposit")}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition"
                >
                  <TrendingUp size={18} /> Deposit (M-Pesa)
                </button>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`px-6 py-3 rounded-xl font-bold border border-slate-700 hover:bg-slate-800 ${
                    activeTab === "dashboard" ? "hidden" : "block"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[250px]">
            <div className="flex items-center gap-2 text-slate-500 mb-4 font-bold text-sm uppercase tracking-wider">
              <Inbox size={16} /> Pending Actions
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {incomingRequests.length === 0 && votingQueue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                  <CheckCircle size={32} className="mb-2 opacity-20" />
                  All caught up!
                </div>
              ) : (
                <>
                  {incomingRequests.map((req) => (
                    <div key={`req-${req.id}`} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-800 mb-1">
                        <span className="font-bold">{req.applicant_name}</span> needs a guarantor.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleGuarantorResponse(req.id, "ACCEPTED")} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-xs font-bold">Accept</button>
                        <button onClick={() => handleGuarantorResponse(req.id, "DECLINED")} className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 py-1 rounded text-xs font-bold">Decline</button>
                      </div>
                    </div>
                  ))}
                  {votingQueue.map((vote) => (
                    <div key={`vote-${vote.id}`} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-purple-700">VOTE: {vote.full_name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleVote(vote.id, "YES")} className="flex-1 bg-purple-600 text-white py-1 rounded text-xs font-bold">Yes</button>
                        <button onClick={() => handleVote(vote.id, "NO")} className="flex-1 bg-white text-slate-600 border py-1 rounded text-xs font-bold">No</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* --- DEPOSIT FORM (M-PESA) --- */}
        {activeTab === "deposit" && (
          <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-8 max-w-2xl mx-auto print:hidden">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-green-600 text-white p-3 rounded-xl"><Smartphone size={24}/></div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">M-Pesa Deposit</h2>
                    <p className="text-sm text-slate-500">Enter amount and phone number to receive STK Push.</p>
                </div>
            </div>
            
            <form onSubmit={handleDeposit} className="space-y-5">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (KES)</label>
                  <input
                    type="number" required
                    className="w-full border p-3 rounded-xl font-bold text-lg"
                    placeholder="e.g. 500"
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">M-Pesa Phone Number</label>
                  <input
                    type="tel" required
                    className="w-full border p-3 rounded-xl"
                    placeholder="2547..."
                    value={depositForm.phoneNumber}
                    onChange={(e) => setDepositForm({ ...depositForm, phoneNumber: e.target.value })}
                  />
              </div>
              <button disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-100 transition">
                {loading ? "Sending Request..." : "Send M-Pesa Request"}
              </button>
            </form>
          </div>
        )}

        {/* ... (Repayment Tab and Dashboard content remains the same) ... */}
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
            <div className="print:hidden space-y-6">
                {/* Loan Status Cards (Same as before) */}
                {loanState.status === "LOADING" && <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">Loading...</div>}
                {loanState.status === "NO_APP" && (
                  <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div><h4 className="text-2xl font-bold">Apply for Loan</h4><p>Get up to <span className="font-bold text-yellow-300">{multiplier}x</span> savings.</p></div>
                    <button onClick={handleLoanStart} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold">Start Application</button>
                  </div>
                )}
                {/* ... Other loan states ... */}
            </div>

            {/* --- RECENT TRANSACTIONS --- */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:bg-white print:border-b-2 print:border-black">
                  <div className="flex items-center gap-3">
                      {logo && <img src={logo} alt="Logo" className="h-12 w-auto object-contain hidden print:block" />}
                      <div>
                          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                              <FileText size={18} className="text-slate-400 print:hidden"/> 
                              <span className="print:hidden">Contribution History</span>
                              <span className="hidden print:inline">Account Statement</span>
                          </h3>
                          <p className="text-xs text-slate-500 hidden print:block">Generated for {user.name} on {new Date().toLocaleDateString()}</p>
                      </div>
                  </div>
                  <button onClick={handlePrint} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition print:hidden">
                      <Printer size={16}/> Print Statement
                  </button>
              </div>

              {savings.history.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center"><AlertCircle size={48} className="mb-4 opacity-20"/><p>No contributions found.</p></div>
              ) : (
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs print:bg-white print:text-black print:border-b">
                              <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Reference</th><th className="px-6 py-4">Type</th><th className="px-6 py-4 text-right">Amount</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                              {savings.history.map((t) => (
                                  <tr key={t.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                                      <td className="px-6 py-4 text-slate-600">{new Date(t.created_at).toLocaleDateString()}</td>
                                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.transaction_ref || '-'}</td>
                                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold print:border print:border-slate-300 ${t.type === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t.type}</span></td>
                                      <td className={`px-6 py-4 text-right font-bold font-mono ${t.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-slate-600'}`}>{t.type === 'DEPOSIT' ? '+' : '-'} {parseFloat(t.amount).toLocaleString()}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
              <div className="hidden print:block mt-8 text-center text-xs text-slate-400 border-t pt-4"><p>End of Statement • System Generated</p></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}