import React, { useState, useEffect } from 'react';
import api from '../api'; // Use central secure API
import { 
  Wallet, CreditCard, LogOut, PiggyBank, TrendingUp, 
  History, AlertCircle, CheckCircle, XCircle, Percent, Banknote,
  Clock, Bell // <--- Added Bell icon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MemberDashboard({ user, onLogout }) {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); 

  // Financial Data
  const [savings, setSavings] = useState({ balance: 0, history: [] });
  
  // Loan Data
  const [loanState, setLoanState] = useState({ status: 'LOADING', amount_repaid: 0, amount_requested: 0 });
  const [loanForm, setLoanForm] = useState({ amount: '', purpose: '', repaymentWeeks: '' });

  // Notification Data (Server Side)
  const [serverNotifications, setServerNotifications] = useState([]);

  // Forms
  const [depositForm, setDepositForm] = useState({ amount: '', phoneNumber: '' });
  const [repayForm, setRepayForm] = useState({ amount: '', mpesaRef: '' });
  
  // Toast Notification State
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();

  // --- INITIAL DATA FETCHING ---
  useEffect(() => {
     if(!user) { navigate('/'); return; }

     const fetchData = async () => {
        try {
            const [balanceRes, historyRes, loanRes, notifyRes] = await Promise.all([
                api.get('/api/deposits/balance'),
                api.get('/api/deposits/history'),
                api.get('/api/loan/status'),
                api.get('/api/loan/notifications') 
            ]);

            setSavings({
                balance: balanceRes.data.balance,
                history: historyRes.data
            });
            
            const loan = loanRes.data;
            if (loan.status !== 'NO_APP') {
                loan.amount_requested = parseFloat(loan.amount_requested || 0);
                loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
            }
            setLoanState(loan);

            // Store fetched notifications
            setServerNotifications(notifyRes.data);

        } catch (err) {
            console.error("Error loading dashboard data", err);
        }
     };

     fetchData();
  }, [user, refreshKey, navigate]);

  // --- HELPERS ---
  const showNotify = (type, msg) => {
      setNotification({ type, msg });
      setTimeout(() => setNotification(null), 5000);
  };

  const calculateProgress = () => {
      if (!loanState.amount_requested) return 0;
      return Math.min(100, (loanState.amount_repaid / loanState.amount_requested) * 100);
  };

  // --- HANDLERS ---
  const handleDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        await api.post('/api/deposits', depositForm);
        showNotify('success', `Deposit of KES ${depositForm.amount} initiated!`);
        setDepositForm({ amount: '', phoneNumber: '' });
        setRefreshKey(old => old + 1);
        setActiveTab('dashboard');
    } catch (err) {
        showNotify('error', err.response?.data?.error || "Deposit Failed");
    }
    setLoading(false);
  };

  const handleRepayment = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
          const randomPart = Math.random().toString(36).substring(2, 12).toUpperCase();
          const finalRef = repayForm.mpesaRef || `PAY${randomPart}`;
          
          await api.post('/api/payment/repay-loan', {
              loanAppId: loanState.id,
              amount: repayForm.amount,
              mpesaRef: finalRef
          });

          showNotify('success', `Repayment of KES ${repayForm.amount} received!`);
          setRepayForm({ amount: '', mpesaRef: '' });
          setRefreshKey(old => old + 1);
          setActiveTab('dashboard');
      } catch (err) {
          showNotify('error', err.response?.data?.error || "Repayment Failed");
      }
      setLoading(false);
  };

  const handleLoanStart = async () => {
    setLoading(true);
    try {
        await api.post('/api/loan/init');
        setRefreshKey(old => old + 1);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleLoanFeePayment = async () => {
    setLoading(true);
    const mockRef = 'MP' + Math.random().toString(36).substring(2, 10).toUpperCase();
    try {
        await api.post('/api/payment/pay-fee', { loanAppId: loanState.id, mpesaRef: mockRef });
        setRefreshKey(old => old + 1);
        showNotify('success', 'Fee paid successfully!');
    } catch (err) { 
        console.error(err);
        showNotify('error', err.response?.data?.error || "Payment Failed"); 
    }
    setLoading(false);
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        await api.post('/api/loan/submit', { 
            loanAppId: loanState.id, ...loanForm
        });
        setRefreshKey(old => old + 1);
        showNotify('success', 'Application Submitted!');
    } catch (err) { showNotify('error', err.response?.data?.error || "Failed"); }
    setLoading(false);
  };

  // --- UI COMPONENTS ---

  const NotificationBanner = () => (
    notification && (
        <div className={`fixed top-20 right-6 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 animate-slide-in ${
            notification.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' : 'bg-white border-red-100 text-red-800'
        }`}>
            {notification.type === 'success' ? <CheckCircle size={20} className="text-emerald-500"/> : <XCircle size={20} className="text-red-500"/>}
            <span className="font-medium">{notification.msg}</span>
        </div>
    )
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      <NotificationBanner />

      {/* --- NAVIGATION --- */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-40 flex justify-between items-center">
         <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-lg shadow-emerald-200 shadow-lg"><Wallet size={20} /></div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">SaccoPortal</span>
         </div>
         <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                 <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Member</p>
                 <p className="text-sm font-bold text-slate-700">{user?.name}</p>
             </div>
             <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
             <button onClick={onLogout} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition">
                <LogOut size={16}/> <span className="hidden sm:inline">Logout</span>
             </button>
         </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">

        {/* --- TOP NOTIFICATION ALERT AREA --- */}
        {/* Only renders if there are notifications */}
        {serverNotifications.length > 0 && (
            <div className="mb-8 bg-white rounded-2xl shadow-lg border-l-4 border-blue-500 p-6 animate-fade-in relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                        <Bell size={24} /> 
                    </div>
                    <h3 className="font-bold text-xl text-slate-800">
                        New Notifications <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{serverNotifications.length}</span>
                    </h3>
                </div>
                
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                    {serverNotifications.map((note) => (
                        <div key={note.id} className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-4 items-start hover:bg-blue-100 transition">
                             <div className="mt-1 text-blue-500"><AlertCircle size={18}/></div>
                             <div className="flex-1">
                                 <p className="text-sm text-slate-800 font-medium leading-snug">{note.message}</p>
                                 <p className="text-xs text-slate-500 mt-1 font-mono">
                                    {new Date(note.created_at).toLocaleDateString()} • {new Date(note.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </p>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
        
        {/* --- SAVINGS & HISTORY GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Balance Card */}
            <div className="md:col-span-2 bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
                <div className="absolute top-0 right-0 p-8 opacity-10"><PiggyBank size={120} /></div>
                <div className="relative z-10">
                    <p className="text-slate-400 font-medium mb-1">Total Savings Balance</p>
                    <h1 className="text-4xl sm:text-5xl font-bold mb-6">KES {savings.balance.toLocaleString()}</h1>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setActiveTab('deposit')}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition"
                        >
                            <TrendingUp size={18}/> Deposit Funds
                        </button>
                        <button 
                             onClick={() => setActiveTab('dashboard')}
                             className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition border border-slate-700 hover:bg-slate-800 ${activeTab === 'dashboard' ? 'hidden' : 'block'}`}
                        >
                             Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* History Column (Full Height) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[250px]">
                <div className="flex items-center gap-2 text-slate-500 mb-4 font-bold text-sm uppercase tracking-wider">
                    <History size={16}/> Recent Transactions
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {savings.history.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                            No transactions yet.
                        </div>
                    ) : (
                        savings.history.map(tx => (
                            <div key={tx.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-emerald-200 transition">
                                <div>
                                    <p className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                                    <p className="text-xs font-mono text-slate-500">{tx.transaction_ref}</p>
                                </div>
                                <span className="font-bold text-emerald-600 text-sm">+ {parseInt(tx.amount).toLocaleString()}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* --- CONDITIONAL CONTENT AREA --- */}
        
        {/* 1. DEPOSIT FORM */}
        {activeTab === 'deposit' && (
            <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-8 animate-fade-in max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <PiggyBank className="text-emerald-500"/> Make a Deposit
                </h2>
                <p className="text-slate-500 mb-8">Funds will be added to your savings via M-PESA.</p>
                
                <form onSubmit={handleDeposit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Amount to Save</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-400 font-bold">KES</span>
                                <input 
                                    type="number" min="50" required 
                                    className="w-full border border-slate-200 bg-slate-50 pl-14 p-3 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                    value={depositForm.amount}
                                    onChange={e => setDepositForm({...depositForm, amount: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">M-Pesa Phone Number</label>
                            <input 
                                type="tel" required placeholder="2547..."
                                className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                value={depositForm.phoneNumber}
                                onChange={e => setDepositForm({...depositForm, phoneNumber: e.target.value})}
                            />
                        </div>
                    </div>
                    <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-100 transition flex items-center justify-center gap-2">
                        {loading ? 'Processing...' : <>Confirm Deposit <CheckCircle size={20}/></>}
                    </button>
                </form>
            </div>
        )}

        {/* 2. REPAYMENT FORM */}
        {activeTab === 'repay' && (
            <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 animate-fade-in max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Banknote className="text-blue-500"/> Loan Repayment
                </h2>
                <p className="text-slate-500 mb-8">Reduce your outstanding loan balance of KES {(loanState.amount_requested - loanState.amount_repaid).toLocaleString()}.</p>
                
                <form onSubmit={handleRepayment} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Amount to Repay</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-400 font-bold">KES</span>
                                <input 
                                    type="number" min="50" required 
                                    className="w-full border border-slate-200 bg-slate-50 pl-14 p-3 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    value={repayForm.amount}
                                    onChange={e => setRepayForm({...repayForm, amount: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">M-Pesa Transaction Code</label>
                            <input 
                                type="text" placeholder="e.g. QX92J..." 
                                className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition uppercase"
                                value={repayForm.mpesaRef}
                                onChange={e => setRepayForm({...repayForm, mpesaRef: e.target.value})}
                            />
                            <p className="text-xs text-slate-400 mt-2">Enter the code from the SMS you received after paying to Paybill 123456.</p>
                        </div>
                    </div>
                    <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition flex items-center justify-center gap-2">
                        {loading ? 'Verifying...' : <>Submit Payment <CheckCircle size={20}/></>}
                    </button>
                </form>
            </div>
        )}


        {/* 3. LOAN DASHBOARD */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard className="text-blue-500"/> Loan Application Status
                </h3>

                {/* Loading State */}
                {loanState.status === 'LOADING' && (
                    <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                        Loading loan details...
                    </div>
                )}

                {/* No Active Loan */}
                {loanState.status === 'NO_APP' && (
                    <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div>
                            <h4 className="text-2xl font-bold mb-2">Need Financial Boost?</h4>
                            <p className="text-blue-100 max-w-md">You are eligible to apply for a loan up to 3x your savings balance.</p>
                        </div>
                        <button onClick={handleLoanStart} disabled={loading} className="bg-white text-blue-600 px-8 py-3 rounded-xl font-bold shadow-xl hover:bg-blue-50 transition whitespace-nowrap">
                            Start Application
                        </button>
                    </div>
                )}

                {/* Fee Pending */}
                {loanState.status === 'FEE_PENDING' && (
                    <div className="bg-white rounded-2xl shadow-sm border-l-4 border-amber-500 p-8">
                         <div className="flex items-start gap-4">
                            <div className="bg-amber-100 p-3 rounded-full text-amber-600"><AlertCircle size={24}/></div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-slate-800">Application Fee Required</h4>
                                <p className="text-slate-500 mt-1 mb-4">A standard processing fee of <span className="font-bold text-slate-900">KES 500</span> is required to proceed.</p>
                                <button onClick={handleLoanFeePayment} disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition">
                                    {loading ? 'Processing...' : 'Pay KES 500 via M-Pesa'}
                                </button>
                            </div>
                         </div>
                    </div>
                )}

                {/* Fee Paid - Show Form */}
                {loanState.status === 'FEE_PAID' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <div className="mb-8 pb-6 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h4 className="text-lg font-bold text-slate-800">Loan Details Form</h4>
                                <p className="text-sm text-slate-500">Please fill in the details carefully.</p>
                            </div>
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">Fee Paid</span>
                        </div>
                        
                        <form onSubmit={handleLoanSubmit} className="space-y-6 max-w-xl">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Loan Amount</label>
                                <input type="number" required className="w-full border border-slate-300 p-3 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 transition" placeholder="Enter amount"
                                    value={loanForm.amount} onChange={e => setLoanForm({...loanForm, amount: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Repayment (Weeks)</label>
                                <input type="number" required min="1" max="52" className="w-full border border-slate-300 p-3 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 transition" placeholder="e.g. 12"
                                    value={loanForm.repaymentWeeks} onChange={e => setLoanForm({...loanForm, repaymentWeeks: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Purpose</label>
                                <textarea required rows="3" className="w-full border border-slate-300 p-3 rounded-xl text-slate-600 outline-none focus:border-blue-500 transition" placeholder="Describe the loan purpose..."
                                    value={loanForm.purpose} onChange={e => setLoanForm({...loanForm, purpose: e.target.value})} />
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition">
                                Submit for Review
                            </button>
                        </form>
                    </div>
                )}

                {/* Submitted / Review Status */}
                {(loanState.status === 'SUBMITTED' || loanState.status === 'TABLED') && (
                    <div className="bg-white p-10 rounded-2xl shadow-sm border border-blue-100 text-center">
                        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <Clock size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">Application Under Review</h3>
                        <p className="text-slate-500 max-w-md mx-auto">Your application for <span className="font-bold text-slate-900">KES {loanState.amount_requested.toLocaleString()}</span> is currently being processed by the committee.</p>
                    </div>
                )}

                {/* ACTIVE LOAN (REPAYMENT DASHBOARD) */}
                {loanState.status === 'ACTIVE' && (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div>
                                <h4 className="text-lg font-bold">Active Loan #{loanState.id}</h4>
                                <p className="text-slate-400 text-xs">Disbursed and Active</p>
                            </div>
                            <div className="bg-emerald-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full">Active</div>
                        </div>
                        
                        <div className="p-8">
                            <div className="grid grid-cols-3 gap-6 mb-8 text-center">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Principal</p>
                                    <p className="text-xl font-bold text-slate-800">KES {loanState.amount_requested.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Paid</p>
                                    <p className="text-xl font-bold text-emerald-600">KES {loanState.amount_repaid.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Balance</p>
                                    <p className="text-xl font-bold text-red-600">KES {(loanState.amount_requested - loanState.amount_repaid).toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-8">
                                <div className="flex justify-between text-sm font-bold text-slate-600 mb-2">
                                    <span>Repayment Progress</span>
                                    <span>{calculateProgress().toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-4 rounded-full transition-all duration-1000 ease-out" 
                                        style={{ width: `${calculateProgress()}%` }}
                                    ></div>
                                </div>
                            </div>

                            <button 
                                onClick={() => setActiveTab('repay')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition flex items-center justify-center gap-2"
                            >
                                Make a Repayment <Percent size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* COMPLETED LOAN */}
                {loanState.status === 'COMPLETED' && (
                    <div className="bg-emerald-50 p-10 rounded-2xl text-center border border-emerald-100">
                        <div className="w-20 h-20 bg-white text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <CheckCircle size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-900 mb-2">Loan Fully Repaid!</h3>
                        <p className="text-emerald-700 max-w-md mx-auto mb-6">Congratulations! You have successfully cleared your loan. You are now eligible to apply for a new one.</p>
                        <button onClick={handleLoanStart} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition">
                            Apply for New Loan
                        </button>
                    </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
}