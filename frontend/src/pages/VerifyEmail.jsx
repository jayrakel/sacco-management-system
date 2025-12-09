import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const [status, setStatus] = useState('verifying');
    
    // 🔒 The Lock: Prevents React from firing twice
    const hasFired = useRef(false);

    useEffect(() => {
        if (!token) {
            setStatus('error');
            return;
        }

        // If we already fired, stop here.
        if (hasFired.current) return;
        hasFired.current = true;

        const verify = async () => {
            try {
                await api.post('/api/auth/verify-email', { token });
                setStatus('success');
                setTimeout(() => navigate('/login'), 3000); 
            } catch (err) {
                console.error("Verification Error:", err);
                // If it fails, it might be because it was already verified.
                // We'll show a friendlier error.
                setStatus('error');
            }
        };
        verify();
    }, [token, navigate]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                {status === 'verifying' && (
                    <>
                        <Loader className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-800">Verifying Email...</h2>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-800">Verified!</h2>
                        <p className="text-slate-500 mt-2">Redirecting to login...</p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-800">Link Expired or Invalid</h2>
                        <p className="text-slate-500 mt-2 text-sm">
                           If you already verified your email, you can ignore this.
                        </p>
                        <button onClick={() => navigate('/login')} className="mt-6 bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-900 transition">
                            Go to Login
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}