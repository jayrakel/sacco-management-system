import React, { useState, useEffect } from 'react';
import api from '../api'; // Use central secure API
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, LogOut, Banknote, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TreasurerDashboard({ user, onLogout }) {
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ availableFunds: 0, totalDisbursed: 0 });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if(!user || user.role !== 'TREASURER') navigate('/');
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [queueRes, statsRes] = await Promise.all([
        api.get('/api/loan/treasury/queue'),
        api.get('/api/loan/treasury/stats')
      ]);
      setQueue(queueRes.data);
      setStats(statsRes.data);
    } catch (err) { console.error(err); }
  };

  const handleDisburse = async (loanId, amount) => {
    if (!confirm(`Confirm transfer of KES ${amount}? This cannot be undone.`)) return;
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      await api.post('/api/loan/treasury/disburse', { loanId });
      setSuccessMsg(`Successfully disbursed funds for Loan #${loanId}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Transaction Failed");
      setTimeout(() => setErrorMsg(''), 4000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-50">
         <div className="flex items-center gap-3">
             <div className="bg-amber-500 p-2 rounded text-slate-900"><Wallet size={20}/></div>
             <span className="font-bold tracking-wide text-lg">Treasury & Finance</span>
         </div>
         <button onClick={onLogout} className="text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition border border-slate-700">
            <LogOut size={16}/> Logout
         </button>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        
        {/* Financial Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Available Cash Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Net Liquid Capital</p>
                        <h3 className="text-3xl font-bold text-emerald-700 mt-2">KES {stats.availableFunds.toLocaleString()}</h3>
                    </div>
                    <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600"><ArrowDownLeft size={24}/></div>
                </div>
                <p className="text-emerald-600 text-xs font-bold mt-4 flex items-center gap-1">
                    <TrendingUp size={14}/> Cash Available for Disbursement
                </p>
            </div>

            {/* Disbursement Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-amber-100 relative overflow-hidden">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Total Assets (Loans)</p>
                        <h3 className="text-3xl font-bold text-slate-900 mt-2">KES {stats.totalDisbursed.toLocaleString()}</h3>
                    </div>
                    <div className="bg-amber-100 p-3 rounded-lg text-amber-600"><ArrowUpRight size={24}/></div>
                </div>
                <p className="text-amber-600 text-xs font-bold mt-4 flex items-center gap-1">
                    <Wallet size={14}/> Money owed by members
                </p>
            </div>
        </div>

        {/* Notifications */}
        {successMsg && (
            <div className="bg-emerald-600 text-white p-4 rounded-xl shadow-lg mb-8 flex items-center gap-3">
                <CheckCircle className="text-emerald-200" /> 
                <span className="font-medium">{successMsg}</span>
            </div>
        )}
        {errorMsg && (
            <div className="bg-red-600 text-white p-4 rounded-xl shadow-lg mb-8 flex items-center gap-3">
                <AlertTriangle className="text-red-200" /> 
                <span className="font-medium">{errorMsg}</span>
            </div>
        )}

        {/* Disbursement Queue */}
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            <Banknote className="text-slate-400"/> Approved Loans (Ready for Disbursement)
        </h2>

        {queue.length === 0 ? (
            <div className="bg-white p-12 rounded-xl text-center border-2 border-dashed border-slate-300">
                <p className="text-slate-400 text-lg">No approved loans pending disbursement.</p>
                <p className="text-sm text-slate-400 mt-2">Loans must be Voted on and Approved by Secretary first.</p>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-medium">
                            <tr>
                                <th className="p-4">Member</th>
                                <th className="p-4">Contact</th>
                                <th className="p-4 text-right">Amount</th>
                                <th className="p-4 text-center">Votes (Yes)</th>
                                <th className="p-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {queue.map(loan => (
                                <tr key={loan.id} className="hover:bg-slate-50 transition">
                                    <td className="p-4 font-medium text-slate-900">
                                        {loan.full_name}
                                        <div className="text-xs text-slate-500 italic">"{loan.purpose}"</div>
                                    </td>
                                    <td className="p-4 text-slate-500">{loan.phone_number}</td>
                                    <td className="p-4 text-right font-mono font-bold text-slate-800">
                                        {parseInt(loan.amount_requested).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="bg-blue-100 text-blue-700 py-1 px-2 rounded text-xs font-bold">
                                            {loan.yes_votes}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={() => handleDisburse(loan.id, loan.amount_requested)}
                                            disabled={loading}
                                            className="bg-slate-900 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm shadow-sm"
                                        >
                                            {loading ? 'Processing...' : 'Disburse Funds'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}