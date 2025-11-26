import React, { useState, useEffect, useRef } from 'react';
import api from '../api'; 
import { Wallet, LogOut, Bell, Archive, XCircle, AlertCircle, MailOpen, Clock } from 'lucide-react';

export default function DashboardHeader({ user, onLogout, title = "SaccoPortal" }) {
    const [notifications, setNotifications] = useState({ unread: [], history: [], archive: [] });
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [showArchive, setShowArchive] = useState(false);
    const notifRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [notifRef]);

    // Fetch Notifications on Mount (and every 30s to keep it live)
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await api.get('/api/loan/notifications');
                const rawNotifs = res.data;
                if (Array.isArray(rawNotifs)) {
                    setNotifications({ unread: rawNotifs, history: [], archive: [] });
                } else if (rawNotifs && typeof rawNotifs === 'object') {
                    setNotifications({
                        unread: rawNotifs.unread || [],
                        history: rawNotifs.history || [],
                        archive: rawNotifs.archive || []
                    });
                }
            } catch (err) { console.error("Notif Error", err); }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [user]);

    const handleMarkAsRead = async (id) => {
        try {
            const noteToMove = notifications.unread.find(n => n.id === id);
            if (!noteToMove) return;

            const updatedUnread = notifications.unread.filter(n => n.id !== id);
            const updatedHistory = [{...noteToMove, is_read: true}, ...notifications.history];

            setNotifications(prev => ({ ...prev, unread: updatedUnread, history: updatedHistory }));
            await api.put(`/api/loan/notifications/${id}/read`);
        } catch (err) { console.error(err); }
    };

    return (
        <>
            {/* --- ARCHIVE MODAL --- */}
            {showArchive && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scale-up">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-700">
                                <Archive size={20} className="text-slate-400"/> Notification Archive
                            </h3>
                            <button onClick={() => setShowArchive(false)} className="bg-white p-2 rounded-full shadow-sm hover:text-red-500"><XCircle size={24}/></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                            {notifications.archive.length === 0 ? <p className="text-center text-slate-400 text-sm">No archives.</p> : notifications.archive.map(note => (
                                <div key={note.id} className="pb-4 border-b border-slate-100">
                                    <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{note.message}</p>
                                    <p className="text-xs text-slate-400 font-mono mt-1">{new Date(note.created_at).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOP BANNER FOR UNREAD MESSAGES --- */}
            {notifications.unread.length > 0 && (
                <div className="bg-blue-600 text-white px-4 py-3 shadow-md sticky top-0 z-50">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MailOpen size={18} className="animate-pulse"/>
                            <span className="text-sm font-bold">{notifications.unread.length} New Notification{notifications.unread.length > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <div className="max-w-6xl mx-auto mt-3 space-y-2">
                        {notifications.unread.slice(0, 1).map(note => (
                            <div key={note.id} className="bg-white/10 backdrop-blur-sm border border-white/20 p-3 rounded-lg flex gap-3 items-start">
                                <p className="text-sm flex-1 whitespace-pre-line">{note.message}</p>
                                <button onClick={() => handleMarkAsRead(note.id)} className="text-xs bg-white text-blue-600 px-3 py-1 rounded-full font-bold hover:bg-blue-50">Mark Read</button>
                            </div>
                        ))}
                        {notifications.unread.length > 1 && <p className="text-xs text-blue-200 text-center">Check bell icon for more.</p>}
                    </div>
                </div>
            )}

            {/* --- NAVIGATION BAR --- */}
            <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-600 text-white p-2 rounded-lg shadow-emerald-200 shadow-lg"><Wallet size={20} /></div>
                    <span className="font-bold text-xl tracking-tight hidden sm:block">{title}</span>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Bell Icon */}
                    <div className="relative" ref={notifRef}>
                        <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="p-2 relative hover:bg-slate-100 rounded-full transition text-slate-600">
                            <Bell size={20} />
                            {notifications.unread.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                        </button>

                        {showNotifDropdown && (
                            <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in z-50">
                                <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Recent History</span>
                                    <button onClick={() => { setShowArchive(true); setShowNotifDropdown(false); }} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"><Archive size={12}/> Archive</button>
                                </div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                    {notifications.history.length === 0 && notifications.unread.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-xs italic">No notifications.</div>
                                    ) : (
                                        [...notifications.unread, ...notifications.history].slice(0,5).map(note => (
                                            <div key={note.id} onClick={() => !note.is_read && handleMarkAsRead(note.id)} className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer ${!note.is_read ? 'bg-blue-50/50' : ''}`}>
                                                <p className={`text-xs text-slate-600 line-clamp-2 mb-1 ${!note.is_read ? 'font-bold text-slate-800' : ''}`}>{note.message}</p>
                                                <p className="text-[10px] text-slate-400 text-right">{new Date(note.created_at).toLocaleDateString()}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                    <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{user?.role}</p>
                        <p className="text-sm font-bold text-slate-700">{user?.name}</p>
                    </div>
                    <button onClick={onLogout} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition">
                        <LogOut size={16}/> <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </nav>
        </>
    );
}