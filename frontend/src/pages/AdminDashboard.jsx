import React, { useState, useEffect } from 'react';
import api from '../api';
import { Users, Gavel, CheckCircle, XCircle } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function AdminDashboard({ user, onLogout }) {
    const [agenda, setAgenda] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        api.get('/api/loan/admin/agenda').then(res => setAgenda(res.data)).catch(console.error);
    }, [refreshKey]);

    const openVoting = async (loanId) => {
        try {
            await api.post('/api/loan/admin/open-voting', { loanId });
            setRefreshKey(old => old + 1);
            alert("Voting session opened for Loan #" + loanId);
        } catch (err) {
            alert("Error opening voting");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Chairperson Panel" />

            <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
                <div className="bg-indigo-900 text-white rounded-2xl p-8 mb-8 shadow-lg">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Gavel size={32} /> Chairperson Dashboard
                    </h1>
                    <p className="text-indigo-200 mt-2">Manage meeting agendas and open voting sessions.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Users className="text-indigo-600" /> Loans Ready for Voting
                    </h2>

                    {agenda.length === 0 ? (
                        <p className="text-slate-500 italic">No tabled loans available for voting.</p>
                    ) : (
                        <div className="space-y-4">
                            {agenda.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div>
                                        <p className="font-bold text-slate-700">{item.full_name}</p>
                                        <p className="text-sm text-slate-500">Requesting: KES {parseFloat(item.amount_requested).toLocaleString()}</p>
                                        <p className="text-xs text-slate-400 mt-1 italic">"{item.purpose}"</p>
                                    </div>
                                    <button 
                                        onClick={() => openVoting(item.id)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                                    >
                                        Open Voting <CheckCircle size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}