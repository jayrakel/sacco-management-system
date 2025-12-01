import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, Server } from 'lucide-react';

const ErrorLayout = ({ icon, title, message, action }) => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full border border-slate-100">
            <div className="flex justify-center mb-6">{icon}</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
            <p className="text-slate-500 mb-8">{message}</p>
            {action}
        </div>
    </div>
);

export function Unauthorized() {
    const navigate = useNavigate();
    return (
        <ErrorLayout 
            icon={<Lock size={48} className="text-amber-500" />}
            title="Access Denied"
            message="You do not have permission to view this specific page."
            action={
                <button onClick={() => navigate('/')} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition">
                    Return Home
                </button>
            }
        />
    );
}

export function NotFound() {
    const navigate = useNavigate();
    return (
        <ErrorLayout 
            icon={<AlertTriangle size={48} className="text-slate-400" />}
            title="Page Not Found"
            message="The link you followed may be broken, or the page may have been removed."
            action={
                <button onClick={() => navigate('/')} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition">
                    Go Dashboard
                </button>
            }
        />
    );
}

export function ServerError() {
    return (
        <ErrorLayout 
            icon={<Server size={48} className="text-red-500" />}
            title="System Error"
            message="Something went wrong on our end. Please try again later."
            action={
                <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition">
                    Reload Page
                </button>
            }
        />
    );
}