import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { 
    Gavel, TrendingUp, Users, Settings, UserPlus, Save, 
    DollarSign, FileText, CheckCircle, AlertCircle, 
    FileWarning, PlusCircle, Calculator, ShieldAlert,
    Printer, PieChart, Loader 
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

// Added 'reports' to the TAB_MAP
const TAB_MAP = { 'voting': 'gov-01', 'finance': 'fin-88', 'members': 'dir-x2', 'settings': 'cfg-99', 'register': 'new-00', 'reports': 'rep-77' };
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
    
    // Report Data State
    const [reportData, setReportData] = useState(null);
    const [logo, setLogo] = useState(null);
    const [saccoName, setSaccoName] = useState('Sacco');
    const [downloading, setDownloading] = useState(false); 
    
    // Dynamic Policy State
    const [currentRegFee, setCurrentRegFee] = useState(1500);
    const [finePresets, setFinePresets] = useState([]);

    // Forms
    // --- UPDATED: Includes KYC Fields to prevent 400 Error ---
    const [regForm, setRegForm] = useState({ 
        fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER', paymentRef: '',
        idNumber: '', kraPin: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelation: ''
    });
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
                    
                    const logoSetting = allSettings.find(s => s.setting_key === 'sacco_logo');
                    if (logoSetting) setLogo(logoSetting.setting_value);

                    const nameSetting = allSettings.find(s => s.setting_key === 'sacco_name');
                    if (nameSetting) setSaccoName(nameSetting.setting_value);

                    const regFeeSetting = allSettings.find(s => s.setting_key === 'registration_fee');
                    if (regFeeSetting) setCurrentRegFee(parseFloat(regFeeSetting.setting_value));

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
                } else if (activeTab === 'reports') {
                    const resRep = await api.get('/api/reports/summary');
                    setReportData(resRep.data);
                }
            } catch (err) { console.error("Fetch failed", err); }
        };
        fetchData();
    }, [activeTab, refreshKey]);

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/auth/register', regForm);
            alert(`Member Registered! Verification email sent to ${regForm.email}.`);
            // Reset form
            setRegForm({ 
                fullName: '', email: '', password: '', phoneNumber: '', role: 'MEMBER', paymentRef: '',
                idNumber: '', kraPin: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelation: ''
            });
        } catch (err) { alert(err.response?.data?.error || "Registration failed."); }
        setLoading(false);
    };

    // ... (rest of helper functions remain same: handleRecordTransaction, handleRunCompliance, etc.) ...
    // Keeping only what's necessary for brevity, assume other handlers exist as before.
    const handleRecordTransaction = async (e) => {
        e.preventDefault();
        if(!transForm.userId) return alert("Select a member");
        setLoading(true);
        try {
            await api.post('/api/payments/admin/record', transForm);
            alert("Transaction Recorded.");
            setTransForm({ userId: '', type: 'FINE', amount: '', reference: '', description: '' });
            setRefreshKey(k => k + 1);
        } catch (err) { alert(err.response?.data?.error || "Failed"); }
        setLoading(false);
    };

    const renderTabButton = (id, label, icon) => (
        <button onClick={() => switchTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === id ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'}`}>{icon} {label}</button>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <div className="print:hidden">
                <DashboardHeader user={user} onLogout={onLogout} title="Chairperson Panel" />
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pb-12 print:p-0 print:max-w-none">
                <div className="bg-indigo-900 text-white rounded-2xl p-6 mb-8 shadow-lg print:hidden">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3"><Gavel className="text-amber-400" /> Chairperson's Office</h1>
                        </div>
                        <div className="flex bg-indigo-950/50 p-1.5 rounded-xl border border-indigo-800/50 overflow-x-auto max-w-full">
                            {renderTabButton('voting', 'Voting', <Gavel size={16}/>)}
                            {renderTabButton('finance', 'Finance', <TrendingUp size={16}/>)}
                            {renderTabButton('reports', 'Reports', <PieChart size={16}/>)}
                            {renderTabButton('members', 'Directory', <Users size={16}/>)}
                            {renderTabButton('settings', 'Policies', <Settings size={16}/>)}
                            {renderTabButton('register', 'Add Member', <UserPlus size={16}/>)}
                        </div>
                    </div>
                </div>

                {/* --- REGISTER TAB (UPDATED FORM) --- */}
                {activeTab === 'register' && (
                    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-indigo-100 p-8 animate-fade-in print:hidden">
                        <div className="mb-6 pb-6 border-b border-slate-100">
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <UserPlus className="text-emerald-600"/> Onboard New Member
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Mandatory KES {currentRegFee.toLocaleString()} Registration Fee. Email verification will be sent.
                            </p>
                        </div>
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Personal Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <input required type="text" placeholder="Full Name" className="border p-3 rounded-xl w-full" value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} />
                                    <input required type="text" placeholder="ID Number" className="border p-3 rounded-xl w-full" value={regForm.idNumber} onChange={e => setRegForm({...regForm, idNumber: e.target.value})} />
                                    <input required type="tel" placeholder="Phone Number" className="border p-3 rounded-xl w-full" value={regForm.phoneNumber} onChange={e => setRegForm({...regForm, phoneNumber: e.target.value})} />
                                    <input required type="email" placeholder="Email Address" className="border p-3 rounded-xl w-full" value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} />
                                    <input type="text" placeholder="KRA PIN (Optional)" className="border p-3 rounded-xl w-full" value={regForm.kraPin} onChange={e => setRegForm({...regForm, kraPin: e.target.value})} />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Next of Kin (KYC)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <input required type="text" placeholder="Name" className="border p-3 rounded-xl w-full" value={regForm.nextOfKinName} onChange={e => setRegForm({...regForm, nextOfKinName: e.target.value})} />
                                    <input required type="tel" placeholder="Phone" className="border p-3 rounded-xl w-full" value={regForm.nextOfKinPhone} onChange={e => setRegForm({...regForm, nextOfKinPhone: e.target.value})} />
                                    <input required type="text" placeholder="Relation" className="border p-3 rounded-xl w-full" value={regForm.nextOfKinRelation} onChange={e => setRegForm({...regForm, nextOfKinRelation: e.target.value})} />
                                </div>
                            </div>
                            
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

                {/* (Keep other tabs: voting, finance, members, settings, reports as they were) */}
            </main>
        </div>
    );
}