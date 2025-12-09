import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import api from '../api';
import { Lock, Save, AlertCircle } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

export default function ChangePassword({ user, onLogout }) {
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Hook for redirection
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (passwords.new !== passwords.confirm) {
            setError("Passwords do not match");
            return;
        }

        if (passwords.new.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/auth/change-password', { newPassword: passwords.new });
            
            // --- 🔧 CRITICAL FIX: UPDATE LOCAL STORAGE ---
            // We verify the user object exists before modifying it
            const savedUser = JSON.parse(localStorage.getItem('sacco_user') || '{}');
            savedUser.mustChangePassword = false; // Flip the flag
            localStorage.setItem('sacco_user', JSON.stringify(savedUser));
            
            alert("Password Changed Successfully! Redirecting to Dashboard...");
            
            // Force a hard reload to ensure App.jsx reads the new LocalStorage state
            window.location.href = '/portal'; 
            
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Failed to update password");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
             {/* Only show logout since header navigation is blocked */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h1 className="font-bold text-xl text-slate-800">Security Check</h1>
                <button onClick={onLogout} className="text-red-600 font-bold text-sm hover:underline">Logout</button>
            </div>

            <main className="max-w-md mx-auto mt-16 px-4">
                <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 overflow-hidden">
                    <div className="bg-indigo-900 p-6 text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="text-white" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Change Password</h2>
                        <p className="text-indigo-200 text-sm mt-2">
                            For security, you must update your default password before proceeding.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle size={16}/> {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                value={passwords.new}
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                value={passwords.confirm}
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                            />
                        </div>

                        <button 
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                        >
                            {loading ? 'Updating...' : <>Update & Continue <Save size={18}/></>}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}