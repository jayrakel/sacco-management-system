import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, Users, DollarSign, AlertCircle, FileText, LayoutDashboard, File } from 'lucide-react';

export default function AdvancedReporting() {
  const [activeReport, setActiveReport] = useState('dashboard');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true); // Start true to prevent flash
  const [error, setError] = useState(null);
  
  // Use local date strings to prevent timezone offset issues
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(today.getMonth() - 1);

  const [dateRange, setDateRange] = useState({
    start_date: lastMonth.toLocaleDateString('en-CA'), // YYYY-MM-DD local
    end_date: today.toLocaleDateString('en-CA')
  });

  const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const fetchReport = async (reportType) => {
    try {
      setLoading(true);
      setError(null);
      let url = '';

      switch (reportType) {
        case 'dashboard':
          url = `/api/advanced-reports/dashboard-summary`;
          break;
        case 'balance-sheet':
          url = `/api/advanced-reports/financial/balance-sheet?date=${dateRange.end_date}`;
          break;
        case 'income-statement':
          url = `/api/advanced-reports/financial/income-statement?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`;
          break;
        case 'cash-flow':
          url = `/api/advanced-reports/financial/cash-flow?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`;
          break;
        case 'loan-analytics':
          url = '/api/advanced-reports/analytics/loans';
          break;
        case 'deposit-analytics':
          url = '/api/advanced-reports/analytics/deposits';
          break;
        case 'member-performance':
          url = '/api/advanced-reports/member-performance';
          break;
        case 'transaction-summary':
          url = `/api/advanced-reports/transaction-summary?period=daily&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`;
          break;
        default:
          setLoading(false);
          return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Failed to fetch report:', error);
      setError(error.message);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeReport);
  }, [activeReport, dateRange]);

  // Handler to safely switch reports
  const handleReportSwitch = (reportId) => {
    setReportData(null); // CRITICAL: Clear old data to prevent rendering crash
    setLoading(true);
    setActiveReport(reportId);
  };

  const handleExport = async (format) => {
    try {
      const url = `/api/advanced-reports/export/${activeReport}?format=${format}&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const ext = format === 'csv' ? 'csv' : 'pdf';
      a.download = `${activeReport}_${new Date().toISOString().slice(0,10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error('Export failed:', error);
      alert("Failed to download report");
    }
  };

  // --- RENDER FUNCTIONS (With Safety Checks) ---

  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100">Total Assets</p>
            <p className="text-3xl font-bold">KES {reportData?.assets?.total ? parseFloat(reportData.assets.total).toLocaleString() : '0'}</p>
          </div>
          <DollarSign className="w-12 h-12 opacity-20" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100">Total Liabilities</p>
            <p className="text-3xl font-bold">KES {reportData?.liabilities?.total ? parseFloat(reportData.liabilities.total).toLocaleString() : '0'}</p>
          </div>
          <TrendingUp className="w-12 h-12 opacity-20" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100">Active Loans</p>
            <p className="text-3xl font-bold">{reportData?.summary?.active_loans || '0'}</p>
          </div>
          <AlertCircle className="w-12 h-12 opacity-20" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100">Default Rate</p>
            <p className="text-3xl font-bold">{reportData?.ratios?.default_rate || '0%'}</p>
          </div>
          <Users className="w-12 h-12 opacity-20" />
        </div>
      </div>
    </div>
  );

  const renderBalanceSheet = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 text-blue-800">Assets (What Sacco Owns)</h3>
          {reportData?.assets && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Liquid Cash & Equivalents</span>
                <span className="font-semibold">KES {parseFloat(reportData.assets.cash_at_hand || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loan Portfolio (Outstanding)</span>
                <span className="font-semibold">KES {parseFloat(reportData.assets.loans_outstanding || 0).toLocaleString()}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between text-lg font-bold text-blue-600">
                <span>Total Assets</span>
                <span>KES {parseFloat(reportData.assets.total || 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4 text-red-800">Liabilities (What Sacco Owes)</h3>
            {reportData?.liabilities && (
                <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-600">Member Deposits</span>
                    <span className="font-semibold">KES {parseFloat(reportData.liabilities.member_savings || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Emergency Fund</span>
                    <span className="font-semibold">KES {parseFloat(reportData.liabilities.emergency_fund || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Welfare Fund</span>
                    <span className="font-semibold">KES {parseFloat(reportData.liabilities.welfare_fund || 0).toLocaleString()}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold text-red-600">
                    <span>Total Liabilities</span>
                    <span>KES {parseFloat(reportData.liabilities.total || 0).toLocaleString()}</span>
                </div>
                </div>
            )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4 text-green-800">Equity</h3>
            {reportData?.equity && (
                <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-600">Share Capital</span>
                    <span className="font-semibold">KES {parseFloat(reportData.equity.share_capital || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Retained Earnings</span>
                    <span className="font-semibold">KES {parseFloat(reportData.equity.retained_earnings || 0).toLocaleString()}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold text-green-600">
                    <span>Total Equity</span>
                    <span>KES {parseFloat(reportData.equity.total || 0).toLocaleString()}</span>
                </div>
                </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );

  const renderIncomeStatement = () => (
    <div className="bg-white p-6 rounded-lg shadow space-y-4">
      {reportData?.revenue && (
        <>
          <div className="border-b pb-4">
            <h3 className="text-lg font-bold mb-3">Revenue</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Interest Earned</span>
                <span className="font-semibold">KES {parseFloat(reportData.revenue.interest_earned || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Penalties</span>
                <span className="font-semibold">KES {parseFloat(reportData.revenue.penalties_collected || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total Revenue</span>
                <span>KES {parseFloat(reportData.revenue.total || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="border-b pb-4">
            <h3 className="text-lg font-bold mb-3">Expenses</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Dividends Paid</span>
                <span className="font-semibold">KES {parseFloat(reportData.expenses.dividends_paid || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total Expenses</span>
                <span>KES {parseFloat(reportData.expenses.total || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-3">Net Income</h3>
            <div className="text-3xl font-bold text-green-600">KES {parseFloat(reportData.net_income || 0).toLocaleString()}</div>
            <div className="text-gray-600">Profit Margin: {reportData.profit_margin}</div>
          </div>
        </>
      )}
    </div>
  );

  const renderCashFlow = () => (
    <div className="bg-white p-6 rounded-lg shadow space-y-6">
      {reportData?.operating_activities && (
        <>
          <div className="border-b pb-4">
            <h3 className="text-lg font-bold mb-3">Operating Activities</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Inflows</p>
                <p className="text-2xl font-bold text-green-600">KES {parseFloat(reportData.operating_activities.inflow.total || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Outflows</p>
                <p className="text-2xl font-bold text-red-600">KES {parseFloat(reportData.operating_activities.outflow.total || 0).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-lg font-bold mt-3">Net: KES {parseFloat(reportData.operating_activities.net || 0).toLocaleString()}</p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-3">Investing Activities</h3>
            <p className="text-lg font-bold">Dividend Distributions: KES {parseFloat(reportData.investing_activities.outflow.dividend_distributions || 0).toLocaleString()}</p>
          </div>

          <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
            <p className="text-gray-600">Net Cash Flow</p>
            <p className="text-3xl font-bold text-blue-600">KES {parseFloat(reportData.net_cash_flow || 0).toLocaleString()}</p>
          </div>
        </>
      )}
    </div>
  );

  const renderLoanAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Active Loans</p>
          <p className="text-3xl font-bold">{reportData?.summary?.active_loans || '0'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Total Portfolio</p>
          <p className="text-3xl font-bold">KES {parseFloat(reportData?.summary?.total_portfolio || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Default Rate</p>
          <p className="text-3xl font-bold text-red-600">{reportData?.ratios?.default_rate || '0%'}</p>
        </div>
      </div>

      {reportData?.summary && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Loan Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Active', value: parseInt(reportData.summary.active_loans || 0) },
                  { name: 'Repaid', value: Math.max((parseInt(reportData.summary.total_loans || 0) - parseInt(reportData.summary.active_loans || 0)), 0) },
                  { name: 'Defaulted', value: parseInt(reportData.summary.total_defaulted || 0) }
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
              >
                {COLORS.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  const renderDepositAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Summary</h3>
          {reportData?.summary && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Members</span>
                <span className="font-semibold">{reportData.summary.total_members}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Deposits</span>
                <span className="font-semibold">KES {parseFloat(reportData.summary.total_amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg per Member</span>
                <span className="font-semibold">KES {parseFloat(reportData.averages?.average_per_member || 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">By Category</h3>
          {reportData?.by_category && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Share Capital</span>
                <span className="font-semibold">KES {parseFloat(reportData.by_category.share_capital || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Emergency Fund</span>
                <span className="font-semibold">KES {parseFloat(reportData.by_category.emergency_fund || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Welfare</span>
                <span className="font-semibold">KES {parseFloat(reportData.by_category.welfare || 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Report Selector */}
      <div className="flex flex-wrap gap-2 bg-white p-4 rounded-lg shadow">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'balance-sheet', label: 'Balance Sheet', icon: FileText },
          { id: 'income-statement', label: 'Income Statement', icon: TrendingUp },
          { id: 'cash-flow', label: 'Cash Flow', icon: DollarSign },
          { id: 'loan-analytics', label: 'Loan Analytics', icon: AlertCircle },
          { id: 'deposit-analytics', label: 'Deposit Analytics', icon: Users }
        ].map((report) => (
          <button
            key={report.id}
            onClick={() => handleReportSwitch(report.id)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeReport === report.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {report.label}
          </button>
        ))}
      </div>

      {/* Date Range Filter & Export Buttons */}
      <div className="bg-white p-4 rounded-lg shadow flex gap-4 items-end flex-wrap justify-between">
        <div className="flex gap-4 items-end">
            <div>
            <label className="block text-sm font-medium text-gray-700">From</label>
            <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                className="mt-1 border border-gray-300 rounded-lg p-2"
            />
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700">To</label>
            <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                className="mt-1 border border-gray-300 rounded-lg p-2"
            />
            </div>
        </div>

        <div className="flex gap-2">
            <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
                <Download className="w-4 h-4" />
                Export CSV
            </button>
            <button
                onClick={() => handleExport('pdf')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
                <File className="w-4 h-4" />
                Export PDF
            </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
          <p className="font-semibold">Error loading report:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Report Content */}
      {loading ? (
        <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">Loading report...</div>
      ) : reportData ? (
        <>
          {activeReport === 'dashboard' && renderDashboard()}
          {activeReport === 'balance-sheet' && renderBalanceSheet()}
          {activeReport === 'income-statement' && renderIncomeStatement()}
          {activeReport === 'cash-flow' && renderCashFlow()}
          {activeReport === 'loan-analytics' && renderLoanAnalytics()}
          {activeReport === 'deposit-analytics' && renderDepositAnalytics()}
        </>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">No data available for the selected report</div>
      )}
    </div>
  );
}