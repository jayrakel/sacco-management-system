import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    ClipboardList, CheckCircle, FileText, Megaphone, 
    BarChart3, XCircle, Calendar, Clock, List, Globe,
    Landmark, Receipt // Added for Assets & Expenses
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import WebsiteManager from '../components/WebsiteManager';

export default function SecretaryDashboard({ user, onLogout }) {
    // Tabs: 'review', 'meetings', 'portfolio', 'assets', 'expenses'
    const [activeTab, setActiveTab] = useState('review', 'minutes');
    
    // Data States
    const [reviewQueue, setReviewQueue] = useState([]); // Loans waiting to be tabled
    const [liveTally, setLiveTally] = useState([]);     // Loans currently being voted on
    const [portfolio, setPortfolio] = useState([]);     // Active Loans for Reporting
    
    // NEW: Assets & Expenses State
    const [assets, setAssets] = useState([]);
    const [expenses, setExpenses] = useState([]);
    
    // Forms
    const [meetingForm, setMeetingForm] = useState({ meetingDate: '', extraAgendas: '' });
    const [newAsset, setNewAsset] = useState({ name: '', type: 'LAND', value: '', location: '', description: '' });
    const [newExpense, setNewExpense] = useState({ title: '', category: 'GENERAL', amount: '', description: '' });

    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (activeTab === 'review') {
                    // Fetch submitted loans waiting for secretary review
                    const res = await api.get('/api/loan/agenda');
                    setReviewQueue(res.data || []);
                } else if (activeTab === 'meetings') {
                    // Fetch live voting results
                    const res = await api.get('/api/loan/secretary/live-tally');
                    setLiveTally(res.data || []);
                } else if (activeTab === 'portfolio') {
                    // Fetch all active loans
                    const res = await api.get('/api/reports/active-portfolio');
                    setPortfolio(res.data || []);
                } 
                // NEW: Fetch Assets
                else if (activeTab === 'assets') {
                    const res = await api.get('/api/management/assets');
                    setAssets(res.data || []);
                } 
                // NEW: Fetch Expenses
                else if (activeTab === 'expenses') {
                    const res = await api.get('/api/management/expenses');
                    setExpenses(res.data || []);
                }
            } catch (err) {
                console.error("Error loading data", err);
            }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    // --- ACTIONS ---

    const handleTableMotion = async (loanId) => {
        if (!window.confirm("Table this application? It will become visible to the Chairperson/Admin.")) return;
        setLoading(true);
        try {
            await api.post('/api/loan/table', { loanId });
            alert("Motion tabled successfully! Admin can now open voting.");
            setRefreshKey(old => old + 1);
        } catch (err) {
            alert(err.response?.data?.error || "Failed to table motion");
        }
        setLoading(false);
    };

    const handleFinalize = async (loanId, decision) => {
        const action = decision === 'APPROVED' ? 'APPROVE' : 'REJECT';
        if (!window.confirm(`Are you sure you want to ${action} this loan based on the votes?`)) return;
        try {
            await api.post('/api/loan/secretary/finalize', { loanId, decision });
            alert(`Loan ${action}D successfully!`);
            setRefreshKey(old => old + 1);
        } catch (err) {
            alert("Failed to finalize vote");
        }
    };

    const handleAnnounce = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/loan/secretary/announce-meeting', meetingForm);
            alert("Meeting notification sent to all members!");
            setMeetingForm({ meetingDate: '', extraAgendas: '' });
        } catch (err) {
            alert("Failed to send announcement");
        }
    };

    // --- NEW HANDLERS FOR ASSETS & EXPENSES ---
    const handleAddAsset = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/management/assets', newAsset);
            alert("Asset Added Successfully!");
            setNewAsset({ name: '', type: 'LAND', value: '', location: '', description: '' });
            // Refresh list immediately
            const res = await api.get('/api/management/assets');
            setAssets(res.data);
        } catch(e) { 
            alert(e.response?.data?.error || "Failed to add asset"); 
        }
        setLoading(false);
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/management/expenses', newExpense);
            alert("Expense Recorded Successfully!");
            setNewExpense({ title: '', category: 'GENERAL', amount: '', description: '' });
            // Refresh list immediately
            const res = await api.get('/api/management/expenses');
            setExpenses(res.data);
        } catch(e) { 
            alert(e.response?.data?.error || "Failed to record expense"); 
        }
        setLoading(false);
    };

    // --- UI HELPERS ---
    const renderTabButton = (id, label, icon) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition ${
                activeTab === id ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
            }`}
        >
            {icon} {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Secretary Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                
                {/* Header */}
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <ClipboardList className="text-indigo-400" /> Secretary Dashboard
                        </h1>
                        <p className="text-indigo-300 text-sm mt-1">Prepare agendas, record minutes, and track portfolio.</p>
                    </div>
                    <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50 overflow-x-auto gap-2">
                        {renderTabButton('review', 'Motions', <FileText size={16}/>)}
                        {renderTabButton('meetings', 'Voting', <BarChart3 size={16}/>)}
                        {renderTabButton('portfolio', 'Loans', <List size={16}/>)}
                        {/* New Buttons */}
                        {renderTabButton('assets', 'Assets', <Landmark size={16}/>)}
                        {renderTabButton('expenses', 'Expenses', <Receipt size={16}/>)}
                        {renderTabButton('website', 'Website & Minutes', <ClipboardList size={16}/>)}
                        {/* <button onClick={() => setActiveTab('website')} className={`px-4 py-2 rounded-lg ${activeTab === 'website' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>
                        Website & Minutes
                    </button> */}
                    </div>
                </div>

                {/* 1. REVIEW & TABLE SECTION */}
                {activeTab === 'review' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                        {/* LIST OF PENDING LOANS */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Clock className="text-amber-500" /> Applications Pending Tabling
                                </h2>
                                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
                                    {reviewQueue.length} Pending
                                </span>
                            </div>
                            
                            {reviewQueue.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 italic">
                                    No new applications to review.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {reviewQueue.map(item => (
                                        <div key={item.id} className="p-6 hover:bg-slate-50 transition">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-lg">{item.full_name}</h3>
                                                    <span className="text-xs font-mono text-slate-400">REF: #{item.id}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-2xl font-bold text-indigo-600">
                                                        KES {parseFloat(item.amount_requested).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 border border-slate-100 mb-4">
                                                <span className="font-bold text-slate-400 uppercase text-xs">Purpose:</span> "{item.purpose}"
                                            </div>
                                            <button 
                                                onClick={() => handleTableMotion(item.id)}
                                                disabled={loading}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2"
                                            >
                                                {loading ? 'Processing...' : <><FileText size={16}/> Table Motion for Agenda</>}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* MEETING ANNOUNCER */}
                        <div className="bg-indigo-600 text-white rounded-2xl p-6 shadow-lg h-fit">
                            <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                                <Megaphone size={20}/> Call Meeting
                            </h3>
                            <form onSubmit={handleAnnounce} className="space-y-4">
                                <div>
                                    <label className="text-xs uppercase font-bold text-indigo-200 block mb-1">Date & Time</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-3 text-indigo-500" size={16}/>
                                        <input 
                                            type="datetime-local" 
                                            required
                                            className="w-full p-2.5 pl-10 rounded-lg bg-white text-slate-800 text-sm border-none outline-none"
                                            value={meetingForm.meetingDate}
                                            onChange={e => setMeetingForm({...meetingForm, meetingDate: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs uppercase font-bold text-indigo-200 block mb-1">Extra Agenda Items</label>
                                    <textarea 
                                        rows="3"
                                        className="w-full p-3 rounded-lg bg-white text-slate-800 text-sm border-none outline-none"
                                        placeholder="e.g. Review annual budget..."
                                        value={meetingForm.extraAgendas}
                                        onChange={e => setMeetingForm({...meetingForm, extraAgendas: e.target.value})}
                                    ></textarea>
                                </div>
                                <button className="w-full bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-3 rounded-xl transition shadow-lg">
                                    Send Notification
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 2. MEETINGS & VOTING SECTION */}
                {activeTab === 'meetings' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <div className="border-b border-slate-100 pb-4 mb-4">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <BarChart3 className="text-emerald-600" /> Live Voting Tally
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">Monitor votes in real-time and finalize decisions.</p>
                            </div>

                            {liveTally.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                                    No active voting sessions.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {liveTally.map(item => (
                                        <div key={item.id} className="border border-slate-200 rounded-xl p-5 hover:border-indigo-200 transition bg-slate-50">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-bold text-slate-800">{item.full_name}</h3>
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${item.status === 'VOTING' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                            
                                            {/* Progress Bar */}
                                            <div className="mb-4">
                                                <div className="flex justify-between text-xs mb-1 font-bold">
                                                    <span className="text-emerald-600">YES: {item.yes_votes}</span>
                                                    <span className="text-red-600">NO: {item.no_votes}</span>
                                                </div>
                                                <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden flex">
                                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ flex: item.yes_votes }}></div>
                                                    <div className="h-full bg-red-500 transition-all duration-500" style={{ flex: item.no_votes }}></div>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <button 
                                                    onClick={() => handleFinalize(item.id, 'APPROVED')}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle size={16}/> Approve
                                                </button>
                                                <button 
                                                    onClick={() => handleFinalize(item.id, 'REJECTED')}
                                                    className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                                                >
                                                    <XCircle size={16}/> Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. ACTIVE PORTFOLIO */}
                {activeTab === 'portfolio' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <List className="text-indigo-600"/> Master Loan List
                            </h3>
                            <button onClick={() => window.print()} className="text-xs text-indigo-600 font-bold hover:underline">Print List</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="px-6 py-3">Member</th>
                                        <th className="px-6 py-3">Disbursed Date</th>
                                        <th className="px-6 py-3">Loan Amount</th>
                                        <th className="px-6 py-3">Balance</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {portfolio.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-400">No active loans found.</td></tr> :
                                    portfolio.map(loan => (
                                        <tr key={loan.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">{loan.full_name}</td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 font-bold">KES {parseFloat(loan.total_due).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-red-600 font-bold">KES {parseFloat(loan.outstanding_balance).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded">ACTIVE</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. ASSETS TAB (NEW) */}
                {activeTab === 'assets' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm h-fit border border-slate-200">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Landmark size={20} className="text-indigo-600"/> Register Fixed Asset</h3>
                            <form onSubmit={handleAddAsset} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Asset Name</label>
                                    <input type="text" placeholder="e.g. Juja Plot LR/2023" className="w-full border p-2 rounded-lg text-sm" value={newAsset.name} onChange={e=>setNewAsset({...newAsset, name: e.target.value})} required/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                                    <select className="w-full border p-2 rounded-lg text-sm bg-slate-50" value={newAsset.type} onChange={e=>setNewAsset({...newAsset, type: e.target.value})}>
                                        <option value="LAND">Land</option>
                                        <option value="BUILDING">Building</option>
                                        <option value="VEHICLE">Vehicle</option>
                                        <option value="EQUIPMENT">Equipment</option>
                                        <option value="INVESTMENT">Investment</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Current Valuation (KES)</label>
                                    <input type="number" className="w-full border p-2 rounded-lg text-sm" value={newAsset.value} onChange={e=>setNewAsset({...newAsset, value: e.target.value})} required/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Location / Serial No</label>
                                    <input type="text" className="w-full border p-2 rounded-lg text-sm" value={newAsset.location} onChange={e=>setNewAsset({...newAsset, location: e.target.value})} />
                                </div>
                                <button disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition">
                                    {loading ? 'Saving...' : '+ Add Asset'}
                                </button>
                            </form>
                        </div>
                        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-lg mb-4 text-slate-800">Asset Register</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <tr><th className="p-3">Asset Name</th><th className="p-3">Type</th><th className="p-3">Valuation</th><th className="p-3">Date Added</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {assets.length === 0 ? <tr><td colSpan="4" className="p-4 text-center text-slate-400">No assets recorded.</td></tr> : 
                                        assets.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50">
                                                <td className="p-3 font-bold text-slate-700">{a.name}<br/><span className="text-xs font-normal text-slate-400">{a.location}</span></td>
                                                <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{a.type}</span></td>
                                                <td className="p-3 text-emerald-600 font-bold">KES {parseFloat(a.value).toLocaleString()}</td>
                                                <td className="p-3 text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. EXPENSES TAB (NEW) */}
                {activeTab === 'expenses' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm h-fit border border-slate-200">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Receipt size={20} className="text-rose-600"/> Record Expense</h3>
                            <form onSubmit={handleAddExpense} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Expense Title</label>
                                    <input type="text" placeholder="e.g. Office Rent - March" className="w-full border p-2 rounded-lg text-sm" value={newExpense.title} onChange={e=>setNewExpense({...newExpense, title: e.target.value})} required/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                                    <select className="w-full border p-2 rounded-lg text-sm bg-slate-50" value={newExpense.category} onChange={e=>setNewExpense({...newExpense, category: e.target.value})}>
                                        <option value="GENERAL">General</option>
                                        <option value="RENT">Rent</option>
                                        <option value="UTILITIES">Utilities</option>
                                        <option value="TRANSPORT">Transport</option>
                                        <option value="SALARY">Salary/Allowances</option>
                                        <option value="MARKETING">Marketing</option>
                                        <option value="REPAIRS">Repairs</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Amount (KES)</label>
                                    <input type="number" className="w-full border p-2 rounded-lg text-sm" value={newExpense.amount} onChange={e=>setNewExpense({...newExpense, amount: e.target.value})} required/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Description / Notes</label>
                                    <textarea className="w-full border p-2 rounded-lg text-sm" rows="2" value={newExpense.description} onChange={e=>setNewExpense({...newExpense, description: e.target.value})} />
                                </div>
                                <button disabled={loading} className="w-full bg-rose-600 text-white py-2 rounded-lg font-bold hover:bg-rose-700 transition">
                                    {loading ? 'Saving...' : 'Record Expense'}
                                </button>
                            </form>
                        </div>
                        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-lg mb-4 text-slate-800">Operational Expenses History</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <tr><th className="p-3">Title</th><th className="p-3">Category</th><th className="p-3">Amount</th><th className="p-3">Date</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {expenses.length === 0 ? <tr><td colSpan="4" className="p-4 text-center text-slate-400">No expenses recorded.</td></tr> : 
                                        expenses.map(ex => (
                                            <tr key={ex.id} className="hover:bg-slate-50">
                                                <td className="p-3 font-bold text-slate-700">{ex.title}</td>
                                                <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{ex.category}</span></td>
                                                <td className="p-3 text-rose-600 font-bold">KES {parseFloat(ex.amount).toLocaleString()}</td>
                                                <td className="p-3 text-xs text-slate-500">{new Date(ex.expense_date).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'website' && (
                    <div className="animate-fade-in">
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                            <p className="text-sm text-blue-700">
                                <strong>Note:</strong> Files uploaded here will be publicly visible on the group website immediately.
                            </p>
                        </div>
                        <WebsiteManager />
                    </div>
                )}

            </main>
        </div>
    );
}