import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { 
    Gavel, TrendingUp, Users, Settings, UserPlus, Save, 
    DollarSign, FileText, CheckCircle, AlertCircle, 
    FileWarning, PlusCircle, Calculator, ShieldAlert
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

const TAB_MAP = { 'voting': 'gov-01', 'finance': 'fin-88', 'members': 'dir-x2', 'settings': 'cfg-99', 'register': 'new-00' };
const CODE_TO_TAB = Object.entries(TAB_MAP).reduce((acc, [key, val]) => { acc[val] = key; return acc; }, {});

export default function ChairpersonDashboard({ user, onLogout }) {
    const navigate = useNavigate();
    const location = useLocation();

    // Safe URL parsing
    const getTabFromUrl = () => {
        try {
            const pathParts = location.pathname.split('/');
            const code = pathParts[pathParts.length - 1]; 
            if (!code || code === 'portal') return 'finance';
            return CODE_TO_TAB[code] || 'finance';
        } catch (e) { return 'finance'; }
    };

    const activeTab = getTabFromUrl();
    const [financeSubTab, setFinanceSubTab] = useState('overview');

    // Data State
    const [agenda, setAgenda] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [transactions, setTransactions] = useState([]); 
    const [users, setUsers] = useState([]);
    const [saccoSettings, setSaccoSettings] = useState([]); 
    
    // Dynamic Policy State
    const [currentRegFee, setCurrentRegFee] = useState(1500);
    const [finePresets, setFinePresets] = useState([]);

    // Forms
    const [regForm, setRegForm] = useState({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER', paymentRef: '' });
    const [transForm, setTransForm] = useState({ userId: '', type: 'FINE', amount: '', reference: '', description: '' });
    const [arrearsInput, setArrearsInput] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const switchTab = (tabName) => navigate(`/portal/${TAB_MAP[tabName]}`);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const resSettings = await api.get('/api/settings');
                if (resSettings.data) {
                    const allSettings = resSettings.data;
                    setSaccoSettings(allSettings.filter(s => s.category === 'SACCO'));
                    
                    const regFeeSetting = allSettings.find(s => s.setting_key === 'registration_fee');
                    if (regFeeSetting) setCurrentRegFee(parseFloat(regFeeSetting.setting_value));

                    // DYNAMIC FINE PRESETS
                    const f1h = allSettings.find(s => s.setting_key === 'fine_lateness_1h');
                    const f2h = allSettings.find(s => s.setting_key === 'fine_lateness_2h');
                    const f3h = allSettings.find(s => s.setting_key === 'fine_lateness_3h');
                    const fAbs = allSettings.find(s => s.setting_key === 'fine_absenteeism');
                    const fUni = allSettings.find(s => s.setting_key === 'fine_no_uniform');
                    const fMis = allSettings.find(s => s.setting_key === 'fine_misconduct');

                    setFinePresets([
                        { label: "Late (< 1h)", amount: f1h ? f1h.setting_value : 50 },
                        { label: "Late (1-2h)", amount: f2h ? f2h.setting_value : 100 },
                        { label: "Late (3h+)", amount: f3h ? f3h.setting_value : 200 },
                        { label: "Absent", amount: fAbs ? fAbs.setting_value : 200 },
                        { label: "No Uniform", amount: fUni ? fUni.setting_value : 50 },
                        { label: "Misconduct", amount: fMis ? fMis.setting_value : 500 }
                    ]);
                }

                const resUsers = await api.get('/api/auth/users');
                setUsers(resUsers.data || []);

                if (activeTab === 'voting') {
                    const res = await api.get('/api/loan/chair/agenda');
                    setAgenda(res.data || []);
                } else if (activeTab === 'finance') {
                    const [resDeposits, resTrans] = await Promise.all([
                        api.get('/api/deposits/admin/all'),
                        api.get('/api/payments/admin/all')
                    ]);
                    setDeposits(resDeposits.data || []);
                    setTransactions(resTrans.data || []);
                } 
            } catch (err) { console.error("Fetch failed", err); }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    // Calculations
    const safeSum = (arr) => arr ? arr.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0) : 0;
    const sumByType = (type) => transactions.filter(t => t.type === type).reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    
    const loanFormTotal = transactions.filter(t => ['FEE_PAYMENT', 'LOAN_FORM_FEE'].includes(t.type)).reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);

    const stats = {
        deposits: safeSum(deposits.filter(d => d.type !== 'DEDUCTION')), 
        deductions: safeSum(deposits.filter(d => d.type === 'DEDUCTION')),
        regFees: sumByType('REGISTRATION_FEE'),
        loanForms: loanFormTotal,
        fines: sumByType('FINE'),
        penalties: sumByType('PENALTY'),
    };
    
    const totalAssets = stats.deposits + stats.deductions + stats.regFees + stats.fines + stats.penalties + stats.loanForms;

    // --- NEW: Helper values for dynamic text ---
    const minWeeklyDeposit = saccoSettings.find(s => s.setting_key === 'min_weekly_deposit')?.setting_value || 250;
    const missedDepositPenalty = saccoSettings.find(s => s.setting_key === 'penalty_missed_savings')?.setting_value || 50;

    // Styles for Transaction Types
    const getTypeStyle = (type) => {
        switch (type) {
            case 'DEPOSIT': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
            case 'DEDUCTION': return 'bg-rose-100 text-rose-700 border border-rose-200';
            case 'FINE': return 'bg-amber-100 text-amber-800 border border-amber-200';
            case 'PENALTY': return 'bg-red-100 text-red-800 border border-red-200';
            case 'REGISTRATION_FEE': return 'bg-blue-100 text-blue-700 border border-blue-200';
            case 'LOAN_FORM_FEE': 
            case 'FEE_PAYMENT': return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
            case 'LOAN_REPAYMENT': return 'bg-teal-100 text-teal-700 border border-teal-200';
            default: return 'bg-slate-100 text-slate-600 border border-slate-200';
        }
    };

    // Handlers
    const handleRecordTransaction = async (e) => {
        e.preventDefault();
        if(!transForm.userId) return alert("Select a member");
        setLoading(true);
        try {
            await api.post('/api/payments/admin/record', transForm);
            alert("Transaction Recorded. If ref code was blank, savings were auto-deducted.");
            setTransForm({ userId: '', type: 'FINE', amount: '', reference: '', description: '' });
            setRefreshKey(k => k + 1);
        } catch (err) { alert(err.response?.data?.error || "Failed to record"); }
        setLoading(false);
    };

    const handleRunCompliance = async () => {
        if(!window.confirm("Run Weekly Compliance Check?\nThis will fine members who haven't saved the minimum this week and auto-deduct from their savings.")) return;
        setLoading(true);
        try {
            const res = await api.post('/api/payments/admin/run-weekly-compliance');
            alert(res.data.message);
            setRefreshKey(k => k + 1);
        } catch (err) { alert("Compliance check failed."); }
        setLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/auth/register', { ...regForm, paymentRef: regForm.paymentRef });
            alert(`New Member Registered! KES ${currentRegFee} recorded.`);
            setRegForm({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER', paymentRef: '' });
        } catch (err) { alert(err.response?.data?.error || "Registration failed."); }
        setLoading(false);
    };

    const handleFinePresetChange = (e) => {
        const label = e.target.value;
        const preset = finePresets.find(p => p.label === label);
        if (preset) {
            setTransForm({ 
                ...transForm, 
                amount: preset.amount, 
                description: preset.label,
                type: 'FINE'
            });
        }
    };

    const calculatePenalty = () => {
        const arrears = parseFloat(arrearsInput);
        if(!arrears) return;
        const setting = saccoSettings.find(s => s.setting_key === 'penalty_arrears_rate');
        const rate = setting ? parseFloat(setting.setting_value) : 10;
        const penalty = Math.ceil(arrears * (rate / 100));
        setTransForm({ ...transForm, amount: penalty, description: `${rate}% Penalty on arrears ${arrears}`, type: 'PENALTY' });
    };

    const openVoting = async (loanId) => {
        if (!window.confirm("Open voting?")) return;
        try {
            await api.post('/api/loan/chair/open-voting', { loanId });
            setRefreshKey(k => k + 1);
            alert("Voting opened!");
        } catch (err) { alert("Error opening voting"); }
    };

    const handleSettingUpdate = async (key, val) => {
        try {
            await api.post('/api/settings/update', { key, value: val });
            alert("Updated.");
            setRefreshKey(k => k + 1);
        } catch (err) { alert("Update failed"); }
    };

    const renderTabButton = (id, label, icon) => (
        <button onClick={() => switchTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === id ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'}`}>{icon} {label}</button>
    );

    const FinanceCard = ({ title, amount, icon, activeId, colorClass }) => (
        <div onClick={() => setFinanceSubTab(activeId)} className={`cursor-pointer p-5 rounded-xl border transition-all ${financeSubTab === activeId ? `bg-white shadow-md ring-2 ring-${colorClass}-200` : 'bg-white border-slate-100 hover:border-slate-300'}`}>
            <div className="flex items-center justify-between mb-2"><div className={`p-2 rounded-lg bg-${colorClass}-50 text-${colorClass}-600`}>{icon}</div></div>
            <p className="text-slate-500 text-xs font-bold uppercase">{title}</p>
            <h3 className="text-xl font-bold text-slate-800">KES {amount.toLocaleString()}</h3>
        </div>
    );

    const renderFinanceTableRows = () => {
        let data = [];
        if(financeSubTab === 'deposits') data = deposits.filter(d => d.type !== 'DEDUCTION');
        else if (financeSubTab === 'deductions') data = deposits.filter(d => d.type === 'DEDUCTION');
        else if(financeSubTab === 'reg_fees') data = transactions.filter(t => t.type === 'REGISTRATION_FEE');
        else if(financeSubTab === 'loan_forms') data = transactions.filter(t => ['FEE_PAYMENT', 'LOAN_FORM_FEE'].includes(t.type));
        else if(financeSubTab === 'fines') data = transactions.filter(t => t.type === 'FINE');
        else if(financeSubTab === 'penalties') data = transactions.filter(t => t.type === 'PENALTY');
        else data = transactions.slice(0, 15);

        if (!data.length) return <tr><td colSpan="5" className="p-8 text-center text-slate-400">No records found for this category.</td></tr>;

        return data.map((item, idx) => (
            <tr key={item.id || idx} className="hover:bg-slate-50 transition text-sm group">
                <td className="px-6 py-4 font-medium text-slate-900">{item.full_name || 'Member'}</td>
                <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold ${getTypeStyle(item.type)}`}>
                        {item.type === 'FEE_PAYMENT' ? 'LOAN_FORM_FEE' : item.type}
                    </span>
                </td>
                <td className="px-6 py-4 text-slate-600 text-xs max-w-[200px] truncate" title={item.description}>
                    {item.description || '-'}
                </td>
                <td className={`px-6 py-4 font-mono font-bold ${item.amount < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                    KES {Math.abs(parseFloat(item.amount)).toLocaleString()}
                    {item.amount < 0 && <span className="text-xs font-normal text-red-400 ml-1">(Dr)</span>}
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleDateString()}
                    <div className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">{item.transaction_ref || item.reference_code}</div>
                </td>
            </tr>
        ));
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Chairperson Panel" />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                {/* Header Area */}
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                <Gavel className="text-amber-400" /> Chairperson's Office
                            </h1>
                            <p className="text-indigo-300 text-sm mt-1">Governance, Policy & Membership.</p>
                        </div>
                        <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50 overflow-x-auto max-w-full">
                            {renderTabButton('voting', 'Voting', <Gavel size={16}/>)}
                            {renderTabButton('finance', 'Finance', <TrendingUp size={16}/>)}
                            {renderTabButton('members', 'Directory', <Users size={16}/>)}
                            {renderTabButton('settings', 'Policies', <Settings size={16}/>)}
                            {renderTabButton('register', 'Add Member', <UserPlus size={16}/>)}
                        </div>
                    </div>
                </div>

                {/* --- TAB CONTENT --- */}

                {activeTab === 'voting' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Gavel className="text-indigo-600" /> Motions on the Floor
                        </h2>
                        {agenda.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                                <p>No motions tabled by the Secretary.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {agenda.map(item => (
                                    <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100 gap-4">
                                        <div>
                                            <p className="font-bold text-slate-800 text-lg">{item.full_name}</p>
                                            <p className="text-sm text-slate-500">Request: <span className="font-bold">KES {parseFloat(item.amount_requested).toLocaleString()}</span></p>
                                            <p className="text-xs text-slate-400 italic mt-1">"{item.purpose}"</p>
                                        </div>
                                        <button onClick={() => openVoting(item.id)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition flex items-center gap-2">
                                            Open Voting <CheckCircle size={16}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'finance' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Total Assets Banner */}
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl p-8 shadow-lg flex justify-between items-center">
                                <div>
                                    <p className="text-emerald-100 font-bold text-sm uppercase tracking-widest">Total Net Assets</p>
                                    <h2 className="text-4xl font-extrabold mt-2">KES {totalAssets.toLocaleString()}</h2>
                                </div>
                                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm"><DollarSign size={48} className="text-emerald-100" /></div>
                            </div>

                            {/* Finance Summary Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <FinanceCard title="Deposits" amount={stats.deposits} icon={<TrendingUp size={20}/>} activeId="deposits" colorClass="emerald" />
                                <FinanceCard title="Deductions" amount={stats.deductions} icon={<TrendingUp size={20} className="rotate-180"/>} activeId="deductions" colorClass="rose" />
                                <FinanceCard title="Reg Fees" amount={stats.regFees} icon={<UserPlus size={20}/>} activeId="reg_fees" colorClass="blue" />
                                <FinanceCard title="Loan Forms" amount={stats.loanForms} icon={<FileText size={20}/>} activeId="loan_forms" colorClass="indigo" />
                                <FinanceCard title="Fines" amount={stats.fines} icon={<AlertCircle size={20}/>} activeId="fines" colorClass="amber" />
                                <FinanceCard title="Penalties" amount={stats.penalties} icon={<FileWarning size={20}/>} activeId="penalties" colorClass="red" />
                            </div>

                            {/* Transactions Table */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <FileText size={16} className="text-slate-500"/> 
                                        {financeSubTab.replace('_', ' ').toUpperCase()} Records
                                    </h3>
                                    {financeSubTab !== 'overview' && <button onClick={() => setFinanceSubTab('overview')} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-slate-600 text-left">
                                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                            <tr>
                                                <th className="px-6 py-3">Member</th>
                                                <th className="px-6 py-3">Type</th>
                                                <th className="px-6 py-3">Description</th>
                                                <th className="px-6 py-3">Amount</th>
                                                <th className="px-6 py-3">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {renderFinanceTableRows()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Weekly Compliance Automation */}
                            <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 shadow-sm">
                                <h3 className="font-bold text-indigo-900 text-lg flex items-center gap-2 mb-2">
                                    <ShieldAlert size={20}/> Automated Compliance
                                </h3>
                                {/* --- MODIFIED: Dynamic Text from Settings --- */}
                                <p className="text-xs text-indigo-700 mb-4">
                                    Detect members who haven't made the weekly deposit (KES {parseFloat(minWeeklyDeposit).toLocaleString()}) and apply the penalty (KES {parseFloat(missedDepositPenalty).toLocaleString()}).
                                </p>
                                <button 
                                    onClick={handleRunCompliance} 
                                    disabled={loading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Checking...' : <>Run Weekly Compliance Check <CheckCircle size={16}/></>}
                                </button>
                            </div>

                            {/* Manual Transaction Form */}
                            <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6">
                                <div className="mb-6 pb-4 border-b border-slate-100">
                                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        <PlusCircle className="text-indigo-600"/> Record Receipt
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Manually log offline payments. Fines/Penalties will auto-deduct from savings if no Ref Code is entered.
                                    </p>
                                </div>

                                <form onSubmit={handleRecordTransaction} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Member</label>
                                        <select 
                                            className="w-full border p-2 rounded-lg text-sm bg-slate-50"
                                            value={transForm.userId}
                                            onChange={e => setTransForm({...transForm, userId: e.target.value})}
                                            required
                                        >
                                            <option value="">Select Member...</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                        <select 
                                            className="w-full border p-2 rounded-lg text-sm bg-slate-50"
                                            value={transForm.type}
                                            onChange={e => setTransForm({...transForm, type: e.target.value, amount: '', description: ''})}
                                        >
                                            <option value="FINE">Fine (Misconduct/Lateness)</option>
                                            <option value="PENALTY">Penalty (Arrears/Breach)</option>
                                            <option value="DEPOSIT">Manual Deposit</option>
                                            <option value="REGISTRATION_FEE">Registration Fee</option>
                                            <option value="LOAN_FORM_FEE">Loan Form Fee</option>
                                        </select>
                                    </div>

                                    {transForm.type === 'FINE' && (
                                        <div className="mb-2">
                                            <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Select Violation</label>
                                            <select 
                                                className="w-full border p-2 rounded-lg text-sm bg-amber-50 border-amber-200 text-amber-900"
                                                onChange={handleFinePresetChange}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>-- Choose Violation --</option>
                                                {finePresets.map((p, i) => (
                                                    <option key={i} value={p.label}>
                                                        {p.label} (KES {parseFloat(p.amount).toLocaleString()})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {transForm.type === 'PENALTY' && (
                                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 mb-2">
                                            <label className="block text-xs font-bold text-red-800 mb-1 flex items-center gap-1">
                                                <Calculator size={12}/> Calc Penalty
                                            </label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number" placeholder="Arrears Amount"
                                                    className="w-full text-xs border p-1 rounded"
                                                    value={arrearsInput}
                                                    onChange={e => setArrearsInput(e.target.value)}
                                                />
                                                <button type="button" onClick={calculatePenalty} className="text-xs bg-red-600 text-white px-2 rounded font-bold">Apply</button>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (KES)</label>
                                        <input 
                                            type="number" required
                                            className="w-full border p-2 rounded-lg font-mono font-bold text-slate-700"
                                            value={transForm.amount}
                                            onChange={e => setTransForm({...transForm, amount: e.target.value})}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                        <input 
                                            type="text" placeholder="e.g. Late for AGM"
                                            className="w-full border p-2 rounded-lg text-sm"
                                            value={transForm.description}
                                            onChange={e => setTransForm({...transForm, description: e.target.value})}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ref Code</label>
                                        <input 
                                            type="text" 
                                            placeholder="Leave blank to auto-deduct"
                                            className="w-full border p-2 rounded-lg text-sm"
                                            value={transForm.reference}
                                            onChange={e => setTransForm({...transForm, reference: e.target.value})}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">If blank, system will deduct from member's savings.</p>
                                    </div>

                                    <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-md transition mt-4">
                                        {loading ? 'Saving...' : 'Save Record'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. MEMBERS TAB */}
                {activeTab === 'members' && (
                     <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Users className="text-indigo-600"/> Member Directory
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                                    <tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Contact</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 font-medium text-slate-900">{u.full_name}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    u.role === 'CHAIRPERSON' ? 'bg-amber-100 text-amber-700' : 
                                                    u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'
                                                }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span>{u.email}</span>
                                                    <span className="text-xs text-slate-400">{u.phone_number}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. SETTINGS TAB */}
                {activeTab === 'settings' && (
                     <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Settings className="text-indigo-600" /> Sacco Policy Configuration
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">Manage core business rules like interest rates and grace periods.</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {saccoSettings.length === 0 ? <p className="p-8 text-center text-slate-400">No Sacco settings found.</p> :
                            saccoSettings.map((setting) => (
                                <div key={setting.setting_key} className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4 hover:bg-slate-50">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800 capitalize">{setting.setting_key.replace(/_/g, ' ')}</h3>
                                        <p className="text-slate-500 text-sm mt-1">{setting.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="text" defaultValue={setting.setting_value} id={`input-${setting.setting_key}`} className="border p-2 rounded-lg w-32 text-right font-mono" />
                                        <button onClick={() => handleSettingUpdate(setting.setting_key, document.getElementById(`input-${setting.setting_key}`).value)} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"><Save size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. REGISTER MEMBER TAB */}
                {activeTab === 'register' && (
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-indigo-100 p-8 animate-fade-in">
                        <div className="mb-6 pb-6 border-b border-slate-100">
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <UserPlus className="text-emerald-600"/> Onboard New Member
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Mandatory KES {currentRegFee.toLocaleString()} Registration Fee required for all new members.
                            </p>
                        </div>
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <input required type="text" placeholder="Full Name" className="border p-3 rounded-xl w-full" value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} />
                                <input required type="tel" placeholder="Phone Number" className="border p-3 rounded-xl w-full" value={regForm.phoneNumber} onChange={e => setRegForm({...regForm, phoneNumber: e.target.value})} />
                            </div>
                            <input required type="email" placeholder="Email Address" className="border p-3 rounded-xl w-full" value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <input required type="text" placeholder="Default Password" className="border p-3 rounded-xl w-full" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} />
                                <select className="border p-3 rounded-xl w-full bg-white" value={regForm.role} onChange={e => setRegForm({...regForm, role: e.target.value})}>
                                    <option value="MEMBER">Member</option>
                                    <option value="SECRETARY">Secretary</option>
                                    <option value="TREASURER">Treasurer</option>
                                    <option value="LOAN_OFFICER">Loan Officer</option>
                                    <option value="ADMIN">System Admin</option>
                                </select>
                            </div>

                            {regForm.role === 'MEMBER' && (
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                    <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">Registration Fee Ref (KES {currentRegFee.toLocaleString()})</label>
                                    <input 
                                        required 
                                        type="text" 
                                        placeholder="Enter M-Pesa/Cash Receipt Code" 
                                        className="border p-3 rounded-xl w-full border-emerald-200" 
                                        value={regForm.paymentRef || ''} 
                                        onChange={e => setRegForm({...regForm, paymentRef: e.target.value})} 
                                    />
                                </div>
                            )}

                            <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition shadow-lg">
                                {loading ? 'Processing...' : 'Confirm Payment & Create Account'}
                            </button>
                        </form>
                    </div>
                )}

            </main>
        </div>
    );
}