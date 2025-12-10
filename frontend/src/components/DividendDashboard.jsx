import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, DollarSign, Users, TrendingUp } from 'lucide-react';

export default function DividendDashboard() {
  const [dividends, setDividends] = useState([]);
  const [selectedDividend, setSelectedDividend] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    financial_year: new Date().getFullYear(),
    dividend_rate: '',
    total_amount: '',
    description: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });

  // Fetch dividends
  useEffect(() => {
    fetchDividends();
  }, []);

  const fetchDividends = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dividends', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setDividends(data);
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to load dividends' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeclare = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await fetch('/api/dividends/declare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: 'Dividend declared successfully' });
        setFormData({ financial_year: new Date().getFullYear(), dividend_rate: '', total_amount: '', description: '' });
        fetchDividends();
      } else {
        setStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async (dividendId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dividends/${dividendId}/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ calculation_method: 'SHARE_BASED' })
      });

      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: `Calculated allocations for ${data.summary.allocations_count} members` });
        fetchDividends();
      } else {
        setStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (dividendId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dividends/${dividendId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: 'Dividend approved' });
        fetchDividends();
      } else {
        setStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayments = async (dividendId, method) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dividends/${dividendId}/process-payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ payment_method: method })
      });

      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: `Processed ${data.processed_count} payments` });
        fetchDividends();
      } else {
        setStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      PROCESSING: 'bg-purple-100 text-purple-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      PENDING: <Clock className="w-4 h-4" />,
      APPROVED: <CheckCircle className="w-4 h-4" />,
      COMPLETED: <CheckCircle className="w-4 h-4" />,
      CANCELLED: <AlertCircle className="w-4 h-4" />
    };
    return icons[status] || <Clock className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {status.message && (
        <div className={`p-4 rounded-lg ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {status.message}
        </div>
      )}

      {/* Declare New Dividend */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Declare New Dividend</h2>
        <form onSubmit={handleDeclare} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Financial Year</label>
              <input
                type="number"
                value={formData.financial_year}
                onChange={(e) => setFormData({ ...formData, financial_year: parseInt(e.target.value) })}
                className="mt-1 block w-full border border-gray-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dividend Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.dividend_rate}
                onChange={(e) => setFormData({ ...formData, dividend_rate: e.target.value })}
                placeholder="e.g., 5.5"
                className="mt-1 block w-full border border-gray-300 rounded-lg p-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Total Amount (KES)</label>
            <input
              type="number"
              step="0.01"
              value={formData.total_amount}
              onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
              placeholder="e.g., 50000"
              className="mt-1 block w-full border border-gray-300 rounded-lg p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="mt-1 block w-full border border-gray-300 rounded-lg p-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Declare Dividend'}
          </button>
        </form>
      </div>

      {/* Dividends List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Dividends</h2>
        </div>
        {loading && !dividends.length ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Year</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Members</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dividends.map((div) => (
                  <tr key={div.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">{div.financial_year}</td>
                    <td className="px-6 py-3">{div.dividend_rate}%</td>
                    <td className="px-6 py-3">KES {parseFloat(div.total_amount).toLocaleString()}</td>
                    <td className="px-6 py-3">{div.allocation_count || 0}</td>
                    <td className="px-6 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${getStatusColor(div.status)}`}>
                        {getStatusIcon(div.status)}
                        {div.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm space-x-2">
                      {div.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleCalculate(div.id)}
                            className="text-blue-600 hover:underline"
                          >
                            Calculate
                          </button>
                          <button
                            onClick={() => handleApprove(div.id)}
                            className="text-green-600 hover:underline"
                          >
                            Approve
                          </button>
                        </>
                      )}
                      {div.status === 'APPROVED' && (
                        <>
                          <button
                            onClick={() => handleProcessPayments(div.id, 'INTERNAL')}
                            className="text-indigo-600 hover:underline"
                          >
                            Pay Internal
                          </button>
                          <button
                            onClick={() => handleProcessPayments(div.id, 'MPESA')}
                            className="text-purple-600 hover:underline"
                          >
                            Pay M-Pesa
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
