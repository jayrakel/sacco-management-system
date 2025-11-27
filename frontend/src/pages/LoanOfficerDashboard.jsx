import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import DashboardHeader from '../components/DashboardHeader';
import { 
  Briefcase, CheckCircle, XCircle, Clock, 
  Search, Eye, FileText, AlertCircle 
} from 'lucide-react';

export default function LoanOfficerDashboard({ user, onLogout }) {
  const [data, setData] = useState({ stats: {}, loans: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [actionProcessing, setActionProcessing] = useState(false);

  const navigate = useNavigate();

  // Fetch Data
  const fetchDashboard = async () => {
    try {
      const res = await api.get('/api/officer/dashboard-data');
      setData(res.data);
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Handle Approval/Rejection
  const handleReview = async (decision) => {
    if(!window.confirm(`Are you sure you want to ${decision} this loan?`)) return;
    
    setActionProcessing(true);
    try {
      await api.post('/api/officer/review-loan', {
        loanId: selectedLoan.id,
        decision: decision
      });
      alert(`Loan ${decision} Successfully`);
      setSelectedLoan(null);
      fetchDashboard(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.error || "Action failed");
    } finally {
      setActionProcessing(false);
    }
  };

  // Filtering
  const filteredLoans = data.loans.filter(loan => 
    loan.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Status Badge Helper
  const getStatusBadge = (status) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-blue-100 text-blue-800",
      ACTIVE: "bg-emerald-100 text-emerald-800",
      REJECTED: "bg-red-100 text-red-800",
      COMPLETED: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status] || "bg-gray-100"}`}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Officer Panel...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <DashboardHeader user={user} onLogout={onLogout} title="Loan Officer Portal" />

      <div className="max-w-7xl mx-auto px-4 mt-8">
        
        {/* 1. Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-yellow-400 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Pending Review</p>
              <p className="text-2xl font-bold text-slate-800">{data.stats.pending || 0}</p>
            </div>
            <Clock className="text-yellow-400 opacity-50" size={32} />
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Approved (Waiting)</p>
              <p className="text-2xl font-bold text-slate-800">{data.stats.approved || 0}</p>
            </div>
            <CheckCircle className="text-blue-500 opacity-50" size={32} />
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-emerald-500 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Active Loans</p>
              <p className="text-2xl font-bold text-slate-800">{data.stats.active || 0}</p>
            </div>
            <Briefcase className="text-emerald-500 opacity-50" size={32} />
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-400 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Rejected</p>
              <p className="text-2xl font-bold text-slate-800">{data.stats.rejected || 0}</p>
            </div>
            <XCircle className="text-red-400 opacity-50" size={32} />
          </div>
        </div>

        {/* 2. Main Content Area */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText size={20} className="text-slate-500" /> Loan Applications
            </h2>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search applicant..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-sm uppercase font-semibold">
                <tr>
                  <th className="p-4">Applicant</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Purpose</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-slate-400">No loans found</td></tr>
                ) : (
                  filteredLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-slate-50 transition">
                      <td className="p-4">
                        <div className="font-medium text-slate-800">{loan.full_name}</div>
                        <div className="text-xs text-slate-500">{loan.phone_number}</div>
                      </td>
                      <td className="p-4 font-mono font-medium">
                        KES {parseFloat(loan.amount_requested).toLocaleString()}
                      </td>
                      <td className="p-4 max-w-xs truncate text-slate-600">{loan.purpose}</td>
                      <td className="p-4 text-sm text-slate-500">
                        {new Date(loan.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">{getStatusBadge(loan.status)}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => setSelectedLoan(loan)}
                          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-slate-700 flex items-center gap-1 ml-auto"
                        >
                          <Eye size={14} /> Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Review Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
              <h3 className="text-xl font-bold">Application Review</h3>
              <button onClick={() => setSelectedLoan(null)} className="hover:bg-slate-700 p-1 rounded">
                <XCircle />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Applicant</label>
                  <p className="text-lg font-semibold text-slate-800">{selectedLoan.full_name}</p>
                  <p className="text-sm text-slate-500">{selectedLoan.email}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Request Amount</label>
                  <p className="text-xl font-bold text-emerald-600">KES {parseFloat(selectedLoan.amount_requested).toLocaleString()}</p>
                  <p className="text-sm text-slate-500">{selectedLoan.repayment_weeks} weeks term</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Loan Purpose</label>
                <p className="text-slate-700">{selectedLoan.purpose}</p>
              </div>

              {/* Guarantor Info could go here if fetchable */}
              
              <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                <AlertCircle size={18} />
                <span>Ensure you have physically verified the guarantors and collateral before approving.</span>
              </div>

              {/* Actions - Only show if PENDING */}
              {(selectedLoan.status === 'PENDING' || selectedLoan.status === 'FEE_PAID') ? (
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button 
                    disabled={actionProcessing}
                    onClick={() => handleReview('REJECTED')}
                    className="py-3 rounded-lg border-2 border-red-100 text-red-600 font-bold hover:bg-red-50 transition"
                  >
                    Reject Application
                  </button>
                  <button 
                     disabled={actionProcessing}
                     onClick={() => handleReview('APPROVED')}
                     className="py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"
                  >
                    Approve Loan
                  </button>
                </div>
              ) : (
                <div className="text-center p-4 bg-slate-100 rounded text-slate-500 font-medium">
                  This loan is currently <strong>{selectedLoan.status}</strong> and cannot be modified.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}