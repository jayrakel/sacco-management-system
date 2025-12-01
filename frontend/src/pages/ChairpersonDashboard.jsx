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
    const [agenda, setAgenda] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [transactions, setTransactions] = useState([]); 
    const [users, setUsers] = useState([]);
    const [saccoSettings, setSaccoSettings] = useState([]); 
    const [currentRegFee, setCurrentRegFee] = useState(1500);
    const [finePresets, setFinePresets] = useState([]);
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

                    setFinePresets([
                        { label: "Late (0-1h)", amount: f1h ? f1h.setting_value : 50 },
                        { label: "Late (1-2h)", amount: f2h ? f2h.setting_value : 100 },
                        { label: "Late (3h+)", amount: f3h ? f3h.setting_value : 200 },
                        { label: "Absent", amount: fAbs ? fAbs.setting_value : 200 },
                        { label: "No Uniform", amount: fUni ? fUni.setting_value : 50 },
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

    const handleRecordTransaction = async (e) => {
        e.preventDefault();
        if(!transForm.userId) return alert("Select a member");
        setLoading(true);
        try {
            await api.post('/api/payments/admin/record', transForm);
            alert("Transaction Recorded. If member had savings, fine was auto-deducted.");
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
            alert(`Registered! KES ${currentRegFee} recorded.`);
            setRegForm({ fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER', paymentRef: '' });
        } catch (err) { alert(err.response?.data?.error || "Registration failed."); }
        setLoading(false);
    };

    const applyFinePreset = (amount, label) => setTransForm({ ...transForm, amount: amount, description: label, type: 'FINE' });

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
        <div onClick={() => setFinanceSubTab(activeId)} className={`cursor-pointer p-5 rounded-xl border transition-all ${financeSubTab === activeId ? `bg-white shadow-md ring-2 ring-${colorClass}-200` : 'bg-white border-slate-100'}`}>
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

        if (!data.length) return <tr><td colSpan="5" className="p-8 text-center text-slate-400">No records.</td></tr>;

        return data.map((item, idx) => (
            <tr key={item.id || idx} className="hover:bg-slate-50 transition text-sm">
                <td className="px-6 py-4 font-medium text-slate-900">{item.full_name || 'Member'}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600">{item.type}</span></td>
                <td className="px-6 py-4 text-slate-600 text-xs max-w-[150px] truncate">{item.description || '-'}</td>
                <td className={`px-6 py-4 font-mono font-bold ${item.amount < 0 ? 'text-red-600' : 'text-slate-700'}`}>KES {parseFloat(item.amount).toLocaleString()}</td>
                <td className="px-6 py-4 text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</td>
            </tr>
        ));
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Chairperson Panel" />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12">
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div><h1 className="text-2xl font-bold flex items-center gap-3"><Gavel className="text-amber-400" /> Chairperson's Office</h1><p className="text-indigo-300 text-sm mt-1">Governance, Policy & Membership.</p></div>
                        <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50 overflow-x-auto">
                            {renderTabButton('voting', 'Voting', <Gavel size={16}/>)}
                            {renderTabButton('finance', 'Finance', <TrendingUp size={16}/>)}
                            {renderTabButton('members', 'Directory', <Users size={16}/>)}
                            {renderTabButton('settings', 'Policies', <Settings size={16}/>)}
                            {renderTabButton('register', 'Add Member', <UserPlus size={16}/>)}
                        </div>
                    </div>
                </div>

                {activeTab === 'voting' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Gavel className="text-indigo-600" /> Motions</h2>
                        {agenda.length === 0 ? <div className="p-12 text-center text-slate-400 border-2 border-dashed rounded-xl">No motions.</div> : 
                        <div className="grid gap-4">{agenda.map(item => (
                            <div key={item.id} className="flex justify-between p-5 bg-slate-50 rounded-xl border">
                                <div><p className="font-bold">{item.full_name}</p><p className="text-sm">Request: KES {parseFloat(item.amount_requested).toLocaleString()}</p></div>
                                <button onClick={() => openVoting(item.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Open Voting</button>
                            </div>
                        ))}</div>}
                    </div>
                )}

                {activeTab === 'finance' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl p-8 shadow-lg flex justify-between">
                                <div><p className="text-emerald-100 font-bold text-sm uppercase">Net Assets</p><h2 className="text-4xl font-extrabold mt-2">KES {totalAssets.toLocaleString()}</h2></div>
                                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm"><DollarSign size={48} className="text-emerald-100" /></div>
                            </div>
                            
                            {/* RESTORED: All Finance Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <FinanceCard title="Deposits" amount={stats.deposits} icon={<TrendingUp size={20}/>} activeId="deposits" colorClass="emerald" />
                                <FinanceCard title="Deductions" amount={stats.deductions} icon={<TrendingUp size={20} className="rotate-180"/>} activeId="deductions" colorClass="red" />
                                <FinanceCard title="Reg Fees" amount={stats.regFees} icon={<UserPlus size={20}/>} activeId="reg_fees" colorClass="blue" />
                                <FinanceCard title="Loan Forms" amount={stats.loanForms} icon={<FileText size={20}/>} activeId="loan_forms" colorClass="indigo" />
                                <FinanceCard title="Fines" amount={stats.fines} icon={<AlertCircle size={20}/>} activeId="fines" colorClass="amber" />
                                <FinanceCard title="Penalties" amount={stats.penalties} icon={<FileWarning size={20}/>} activeId="penalties" colorClass="orange" />
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                                <div className="p-5 border-b bg-slate-50 flex justify-between"><h3 className="font-bold text-slate-800">{financeSubTab.replace('_', ' ').toUpperCase()}</h3><button onClick={() => setFinanceSubTab('overview')} className="text-xs text-blue-600 font-bold">View All</button></div>
                                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold"><tr><th className="px-6 py-3">Member</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Desc</th><th className="px-6 py-3">Amt</th><th className="px-6 py-3">Date</th></tr></thead><tbody className="divide-y">{renderFinanceTableRows()}</tbody></table></div>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            {/* WEEKLY COMPLIANCE */}
                            <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 shadow-sm">
                                <h3 className="font-bold text-indigo-900 text-lg flex items-center gap-2 mb-2"><ShieldAlert size={20}/> Automated Compliance</h3>
                                <p className="text-xs text-indigo-700 mb-4">Detect members who haven't saved the minimum weekly deposit and auto-fine/deduct.</p>
                                <button onClick={handleRunCompliance} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-md transition">{loading ? 'Checking...' : 'Run Weekly Check'}</button>
                            </div>

                            {/* MANUAL RECORDING */}
                            <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6">
                                <h3 className="font-bold text-slate-800 text-lg mb-4">Record Transaction</h3>
                                <form onSubmit={handleRecordTransaction} className="space-y-4">
                                    <select className="w-full border p-2 rounded text-sm" value={transForm.userId} onChange={e => setTransForm({...transForm, userId: e.target.value})} required>
                                        <option value="">Select Member...</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                                    </select>
                                    <select className="w-full border p-2 rounded text-sm" value={transForm.type} onChange={e => setTransForm({...transForm, type: e.target.value})}>
                                        <option value="FINE">Fine</option><option value="PENALTY">Penalty</option><option value="DEPOSIT">Deposit</option>
                                    </select>
                                    
                                    {/* TIERED FINES */}
                                    {transForm.type === 'FINE' && <div className="grid grid-cols-2 gap-2">{finePresets.map((p, i) => <button key={i} type="button" onClick={() => applyFinePreset(p.amount, p.label)} className="text-xs border bg-amber-50 text-amber-800 py-1 rounded">{p.label} ({p.amount})</button>)}</div>}
                                    
                                    <input type="number" required placeholder="Amount" className="w-full border p-2 rounded font-bold" value={transForm.amount} onChange={e => setTransForm({...transForm, amount: e.target.value})} />
                                    <input type="text" placeholder="Ref Code" className="w-full border p-2 rounded" value={transForm.reference} onChange={e => setTransForm({...transForm, reference: e.target.value})} required />
                                    <button disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded font-bold">{loading ? 'Saving...' : 'Save Record'}</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

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

                {activeTab === 'settings' && (
                    <div className="bg-white rounded-2xl shadow-sm border p-6">
                        <h2 className="text-xl font-bold mb-4">Sacco Policies</h2>
                        {saccoSettings.map(s => (
                            <div key={s.setting_key} className="flex justify-between items-center py-3 border-b">
                                <div><p className="font-bold">{s.setting_key.replace(/_/g, ' ')}</p><p className="text-xs text-slate-500">{s.description}</p></div>
                                <div className="flex gap-2"><input id={`inp-${s.setting_key}`} defaultValue={s.setting_value} className="border w-24 text-right px-2 rounded"/><button onClick={() => handleSettingUpdate(s.setting_key, document.getElementById(`inp-${s.setting_key}`).value)} className="bg-blue-600 text-white px-3 rounded"><Save size={16}/></button></div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'register' && (
                    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg border p-8">
                        <h2 className="text-2xl font-bold mb-6">Register Member</h2>
                        <form onSubmit={handleRegister} className="space-y-4">
                            <input required placeholder="Full Name" className="border w-full p-3 rounded" value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} />
                            <input required placeholder="Email" className="border w-full p-3 rounded" value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} />
                            <input required placeholder="Phone" className="border w-full p-3 rounded" value={regForm.phoneNumber} onChange={e => setRegForm({...regForm, phoneNumber: e.target.value})} />
                            <input required placeholder="Password" className="border w-full p-3 rounded" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} />
                            <select className="border w-full p-3 rounded" value={regForm.role} onChange={e => setRegForm({...regForm, role: e.target.value})}><option value="MEMBER">Member</option><option value="SECRETARY">Secretary</option><option value="TREASURER">Treasurer</option><option value="LOAN_OFFICER">Loan Officer</option><option value="ADMIN">Admin</option></select>
                            {regForm.role === 'MEMBER' && <input required placeholder={`Fee Ref (KES ${currentRegFee})`} className="border w-full p-3 rounded" value={regForm.paymentRef} onChange={e => setRegForm({...regForm, paymentRef: e.target.value})} />}
                            <button disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded font-bold">{loading ? 'Processing...' : 'Register'}</button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}