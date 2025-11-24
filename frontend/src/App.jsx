import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, CreditCard, CheckCircle, FileText } from 'lucide-react';

// Setup connection to our Backend
const api = axios.create({
  baseURL: 'http://localhost:5000', 
});

export default function App() {
  const [appState, setAppState] = useState({ status: 'LOADING' });
  const [loading, setLoading] = useState(false);

  // 1. On load, ask Backend: "What is my status?"
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await api.get('/api/loan/status');
      setAppState(res.data); 
    } catch (err) {
      console.error("Server error", err);
    }
  };

  // 2. Button: Start Application
  const handleStart = async () => {
    setLoading(true);
    await api.post('/api/loan/init');
    await checkStatus(); // Refresh to see new status
    setLoading(false);
  };

  // 3. Button: Pay Fee
  const handlePayment = async () => {
    setLoading(true);
    // Simulate a random M-PESA code
    const mockRef = `MP-${Math.floor(Math.random() * 1000000)}`;
    
    await api.post('/api/loan/pay-fee', {
      loanAppId: appState.id,
      mpesaRef: mockRef
    });
    
    await checkStatus(); // Refresh to see if gate unlocked
    setLoading(false);
  };

  // --- RENDERING (What the user sees) ---

  if (appState.status === 'LOADING') return <div className="p-10">Loading...</div>;

  // SCENE 1: New User
  if (appState.status === 'NO_APP') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md text-center">
          <h1 className="text-2xl font-bold mb-4">Sacco Loan Portal</h1>
          <button 
            onClick={handleStart}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Start New Application
          </button>
        </div>
      </div>
    );
  }

  // SCENE 2: The Gate (Locked)
  if (appState.status === 'FEE_PENDING') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50">
        <div className="bg-white p-8 rounded shadow-md text-center border-t-4 border-red-500 max-w-md">
          <Lock className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-red-700 mb-2">Application Locked</h2>
          <p className="text-gray-600 mb-6">
            You must pay the application fee of <strong>KES 500</strong> to access the form.
          </p>
          <button 
            onClick={handlePayment}
            disabled={loading}
            className="w-full bg-emerald-600 text-white px-6 py-3 rounded flex justify-center gap-2 items-center hover:bg-emerald-700"
          >
            <CreditCard size={20} />
            {loading ? "Processing..." : "Pay KES 500 via M-PESA"}
          </button>
        </div>
      </div>
    );
  }

  // SCENE 3: The Form (Unlocked)
  if (appState.status === 'FEE_PAID') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-emerald-50">
         <div className="bg-white p-8 rounded shadow-md max-w-2xl w-full border-t-4 border-emerald-500">
           <div className="flex items-center gap-2 text-emerald-700 mb-6 font-bold bg-emerald-100 p-2 rounded">
             <CheckCircle size={20} /> Fee Paid Successfully
           </div>
           
           <h2 className="text-2xl font-bold mb-4">Official Loan Application Form</h2>
           <form className="space-y-4">
             <div>
               <label className="block text-sm font-medium">Loan Amount</label>
               <input type="number" className="w-full border p-2 rounded" placeholder="50000" />
             </div>
             <div>
               <label className="block text-sm font-medium">Purpose</label>
               <textarea className="w-full border p-2 rounded" placeholder="School fees..."></textarea>
             </div>
             <button className="bg-black text-white px-6 py-2 rounded w-full">Submit Application</button>
           </form>
         </div>
      </div>
    );
  }

  return <div>Unknown State</div>;
}