import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Smartphone, CheckCircle, ArrowRight, Loader } from 'lucide-react';

export default function VerifyPhone({ user, onLogout }) { // Accepts user prop
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.post('/api/auth/verify-phone', { code });
            
            // Update LocalStorage
            const savedUser = JSON.parse(localStorage.getItem('sacco_user') || '{}');
            savedUser.isPhoneVerified = true;
            localStorage.setItem('sacco_user', JSON.stringify(savedUser));

            alert("Phone Verified Successfully!");
            
            // Redirect to Portal (App.jsx will handle next steps like Change Password)
            window.location.href = '/portal'; 
        } catch (err) {
            setError(err.response?.data?.error || "Invalid Code. Check the terminal/SMS.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden">
                <div className="bg-indigo-900 p-6 text-center text-white">
                    <Smartphone size={48} className="mx-auto mb-3 opacity-80" />
                    <h2 className="text-2xl font-bold">2-Step Verification</h2>
                    <p className="text-indigo-200 text-sm mt-1">Check your phone for a 6-digit code.</p>
                </div>
                
                <div className="p-8">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 text-center border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleVerify} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-center">Enter 6-Digit Code</label>
                            <input 
                                type="text" 
                                maxLength="6"
                                className="w-full text-center text-3xl font-mono tracking-widest border-2 border-slate-200 rounded-xl py-3 focus:border-indigo-500 focus:ring-0 outline-none transition"
                                placeholder="000000"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                        </div>

                        <button 
                            disabled={loading || code.length !== 6}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader className="animate-spin" /> : <>Verify & Continue <ArrowRight size={18} /></>}
                        </button>
                    </form>

                    <button onClick={onLogout} className="w-full text-center text-slate-400 text-sm mt-6 hover:text-slate-600">
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
}