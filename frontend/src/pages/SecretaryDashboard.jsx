import React, { useState, useEffect } from 'react';
import api from '../api';
import { FileText, Mic, Play, CheckSquare, Calendar, RefreshCw } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function SecretaryDashboard({ user, onLogout }) {
    const [applications, setApplications] = useState([]);
    const [tally, setTally] = useState([]);
    const [meetingForm, setMeetingForm] = useState({ date: '', agenda: '' });
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchData = () => {
            api.get('/api/loan/agenda').then(res => setApplications(res.data)).catch(err => console.error(err));
            api.get('/api/loan/secretary/live-tally').then(res => setTally(res.data)).catch(err => console.error(err));
        };

        fetchData(); // Initial fetch
        
        const interval = setInterval(fetchData, 3000); // Live poll every 3s
        return () => clearInterval(interval);
    }, [refreshKey]);

    const tableLoan = async (loanId) => {
        try {
            await api.post('/api/loan/table', { loanId });
            setRefreshKey(k => k + 1); // Force refresh to update UI immediately
            alert("Loan tabled! Admin has been notified.");
        } catch (err) { alert("Error tabling loan"); }
    };

    const announceMeeting = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/loan/secretary/announce-meeting', { 
                meetingDate: meetingForm.date, 
                extraAgendas: meetingForm.agenda 
            });
            alert("Meeting Announced!");
            setMeetingForm({ date: '', agenda: '' });
        } catch (err) { alert("Failed to announce"); }
    };

    const finalizeVote = async (loanId, decision) => {
        if(!window.confirm(`Are you sure you want to ${decision} this loan?`)) return;
        try {
            await api.post('/api/loan/secretary/finalize', { loanId, decision });
            setRefreshKey(k => k + 1);
        } catch (err) { alert("Error finalizing"); }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <DashboardHeader user={user} onLogout={onLogout} title="Secretary Portal" />

            <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* LEFT COL: ACTIONS */}
                <div className="space-y-8">
                    
                    {/* Meeting Announcer */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-slate-700">
                            <Calendar className="text-purple-600"/> Call for Meeting
                        </h3>
                        <form onSubmit={announceMeeting} className="space-y-4">
                            <input type="datetime-local" required className="w-full border p-2 rounded-lg" value={meetingForm.date} onChange={e=>setMeetingForm({...meetingForm, date:e.target.value})}/>
                            <textarea rows="3" placeholder="Additional Agenda Items..." className="w-full border p-2 rounded-lg" value={meetingForm.agenda} onChange={e=>setMeetingForm({...meetingForm, agenda:e.target.value})}/>
                            <button className="w-full bg-purple-600 text-white py-2 rounded-lg font-bold">Send Notification</button>
                        </form>
                    </div>

                    {/* Incoming Applications */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-slate-700">
                            <FileText className="text-blue-600"/> Incoming Applications
                        </h3>
                        {applications.length === 0 ? <p className="text-slate-400 text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin"/> Waiting for new submissions...</p> : (
                            <div className="space-y-3">
                                {applications.map(app => (
                                    <div key={app.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-bold text-slate-700">{app.full_name}</span>
                                            <span className="text-blue-600 font-bold">KES {parseInt(app.amount_requested).toLocaleString()}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-3">{app.purpose}</p>
                                        <div className="flex gap-2 text-xs text-slate-400 mb-3">
                                            <span>{app.repayment_weeks} weeks</span>
                                        </div>
                                        <button onClick={() => tableLoan(app.id)} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition">Table Motion</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COL: LIVE VOTING */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-fit">
                    <h3 className="font-bold text-lg flex items-center gap-2 mb-6 text-slate-700">
                        <Mic className="text-red-500 animate-pulse"/> Live Voting Floor
                    </h3>
                    
                    {tally.length === 0 ? <p className="text-slate-400 text-center py-12">No active voting sessions.</p> : (
                        <div className="space-y-6">
                            {tally.map(t => (
                                <div key={t.id} className="border-b border-slate-100 pb-6 last:border-0">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">Loan #{t.id}</span>
                                            <h4 className="font-bold text-slate-800">{t.full_name}</h4>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${t.status === 'VOTING' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {t.status}
                                        </span>
                                    </div>

                                    <div className="flex gap-4 mb-4">
                                        <div className="flex-1 bg-green-50 border border-green-100 p-3 rounded-lg text-center">
                                            <span className="block text-2xl font-bold text-green-600">{t.yes_votes || 0}</span>
                                            <span className="text-xs text-green-800 uppercase font-bold">Yes</span>
                                        </div>
                                        <div className="flex-1 bg-red-50 border border-red-100 p-3 rounded-lg text-center">
                                            <span className="block text-2xl font-bold text-red-600">{t.no_votes || 0}</span>
                                            <span className="text-xs text-red-800 uppercase font-bold">No</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => finalizeVote(t.id, 'APPROVED')} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold text-sm">Approve</button>
                                        <button onClick={() => finalizeVote(t.id, 'REJECTED')} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold text-sm">Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}