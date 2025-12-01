import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, FileQuestion, RefreshCw, Home, ArrowLeft } from 'lucide-react';

// Shared Layout for all error pages
const ErrorLayout = ({ icon, title, message, actionLabel, onAction, secondaryAction }) => (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center animate-fade-in">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full">
            <div className="flex justify-center mb-6">
                <div className="p-4 bg-slate-50 rounded-full border border-slate-100">
                    {icon}
                </div>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 mb-2">{title}</h1>
            <p className="text-slate-500 mb-8 leading-relaxed">{message}</p>
            
            <div className="flex flex-col gap-3">
                <button 
                    onClick={onAction}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
                >
                    {actionLabel}
                </button>
                
                {secondaryAction && (
                    <button 
                        onClick={secondaryAction.onClick}
                        className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
                    >
                        {secondaryAction.label}
                    </button>
                )}
            </div>
        </div>
        <p className="mt-8 text-xs text-slate-400 font-mono">Sacco Management System v1.0</p>
    </div>
);

// 403 - Forbidden / Unauthorized
export const Unauthorized = () => {
    const navigate = useNavigate();
    return (
        <ErrorLayout 
            icon={<ShieldAlert size={48} className="text-amber-500" />}
            title="Access Denied"
            message="You do not have the required permissions to view this page. If you believe this is an error, please contact the System Administrator."
            actionLabel="Return to Dashboard"
            onAction={() => navigate('/')}
            secondaryAction={{ label: "Log in as different user", onClick: () => navigate('/') }}
        />
    );
};

// 404 - Not Found
export const NotFound = () => {
    const navigate = useNavigate();
    return (
        <ErrorLayout 
            icon={<FileQuestion size={48} className="text-indigo-500" />}
            title="Page Not Found"
            message="The page you are looking for does not exist or has been moved. Check the URL or return home."
            actionLabel="Go Home"
            onAction={() => navigate('/')}
            secondaryAction={{ label: "Go Back", onClick: () => navigate(-1) }}
        />
    );
};

// 500 - Server Error
export const ServerError = () => {
    return (
        <ErrorLayout 
            icon={<AlertTriangle size={48} className="text-red-500" />}
            title="System Error"
            message="Our servers encountered an unexpected issue. The administrators have been notified. Please try again later."
            actionLabel="Refresh Page"
            onAction={() => window.location.reload()}
            secondaryAction={{ label: "Return Home", onClick: () => window.location.href = '/' }}
        />
    );
};