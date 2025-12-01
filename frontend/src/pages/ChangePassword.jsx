import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Lock, CheckCircle } from 'lucide-react';

export default function ChangePassword({ onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      await api.post('/api/auth/change-password', { newPassword });
      setSuccess(true);
      
      // Update local user state via prop callback
      if (onPasswordChanged) {
        onPasswordChanged();
      }

      // Redirect to the Unified Portal
      setTimeout(() => {
        navigate('/portal'); 
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.error || "Failed to update password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <div className="bg-amber-100 p-4 rounded-full inline-block mb-4">
            <Lock className="text-amber-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Security Update Required</h2>
          <p className="text-slate-500 mt-2">You must change your default password before continuing.</p>
        </div>

        {success ? (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-center flex flex-col items-center gap-2">
            <CheckCircle size={32} />
            <p>Password updated successfully! Redirecting to Portal...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input 
                type="password" required 
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new secure password"
              />
            </div>

            <button className="w-full bg-slate-900 text-white py-3 rounded-lg hover:bg-slate-800 transition">
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}