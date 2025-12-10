import React, { useState, useEffect } from 'react';
import api from '../api';
import { Save, Upload, Plus, Trash2, Globe } from 'lucide-react';

export default function WebsiteManager() {
    const [activeSection, setActiveSection] = useState('text'); // text, history, minutes
    const [textContent, setTextContent] = useState({ hero_title: '', about_us_text: '', welcome_message: '' });
    const [history, setHistory] = useState([]);
    const [minutes, setMinutes] = useState([]);
    
    // Forms
    const [newHistory, setNewHistory] = useState({ title: '', date: '', description: '' });
    const [newMinutes, setNewMinutes] = useState({ title: '', date: '', file: null });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const res = await api.get('/api/cms/content');
        if (res.data.text) setTextContent(prev => ({ ...prev, ...res.data.text }));
        setHistory(res.data.history || []);
        setMinutes(res.data.minutes || []);
    };

    const handleTextSave = async (key) => {
        await api.post('/api/cms/text', { key, value: textContent[key] });
        alert('Saved!');
    };

    const handleAddHistory = async (e) => {
        e.preventDefault();
        await api.post('/api/cms/history', newHistory);
        setNewHistory({ title: '', date: '', description: '' });
        fetchData();
    };

    const handleUploadMinutes = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', newMinutes.title);
        formData.append('date', newMinutes.date);
        formData.append('file', newMinutes.file);

        await api.post('/api/cms/minutes', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert("Uploaded!");
        setNewMinutes({ title: '', date: '', file: null });
        fetchData();
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Globe className="text-indigo-600"/> Website Content Manager</h2>
            
            <div className="flex gap-4 mb-6 border-b">
                <button onClick={() => setActiveSection('text')} className={`pb-2 px-4 ${activeSection==='text' ? 'border-b-2 border-indigo-600 font-bold text-indigo-600' : 'text-slate-500'}`}>General Text</button>
                <button onClick={() => setActiveSection('history')} className={`pb-2 px-4 ${activeSection==='history' ? 'border-b-2 border-indigo-600 font-bold text-indigo-600' : 'text-slate-500'}`}>History Timeline</button>
                <button onClick={() => setActiveSection('minutes')} className={`pb-2 px-4 ${activeSection==='minutes' ? 'border-b-2 border-indigo-600 font-bold text-indigo-600' : 'text-slate-500'}`}>Meeting Minutes</button>
            </div>

            {/* 1. TEXT EDITOR */}
            {activeSection === 'text' && (
                <div className="space-y-6 max-w-2xl">
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-slate-600">Website Hero Title</label>
                        <div className="flex gap-2">
                            <input className="border p-2 rounded w-full" value={textContent.hero_title} onChange={e => setTextContent({...textContent, hero_title: e.target.value})} />
                            <button onClick={() => handleTextSave('hero_title')} className="p-2 bg-indigo-50 text-indigo-600 rounded"><Save size={20}/></button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-slate-600">About Us / Group Story</label>
                        <textarea className="border p-2 rounded w-full h-32" value={textContent.about_us_text} onChange={e => setTextContent({...textContent, about_us_text: e.target.value})} />
                        <button onClick={() => handleTextSave('about_us_text')} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold">Save Story</button>
                    </div>
                </div>
            )}

            {/* 2. HISTORY MANAGER */}
            {activeSection === 'history' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <form onSubmit={handleAddHistory} className="space-y-4 h-fit bg-slate-50 p-4 rounded-xl">
                        <h3 className="font-bold text-slate-700">Add Milestone</h3>
                        <input className="border p-2 rounded w-full" placeholder="Event Title (e.g. Founded)" value={newHistory.title} onChange={e => setNewHistory({...newHistory, title: e.target.value})} required/>
                        <input type="date" className="border p-2 rounded w-full" value={newHistory.date} onChange={e => setNewHistory({...newHistory, date: e.target.value})} required/>
                        <textarea className="border p-2 rounded w-full" placeholder="Description" value={newHistory.description} onChange={e => setNewHistory({...newHistory, description: e.target.value})} />
                        <button className="w-full bg-indigo-600 text-white py-2 rounded font-bold">Add to Timeline</button>
                    </form>
                    <div className="space-y-4">
                        {history.map(h => (
                            <div key={h.id} className="border-l-4 border-indigo-200 pl-4 py-1">
                                <p className="text-xs font-bold text-indigo-500">{new Date(h.event_date).toLocaleDateString()}</p>
                                <p className="font-bold text-slate-800">{h.event_title}</p>
                                <p className="text-sm text-slate-600">{h.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. MINUTES MANAGER */}
            {activeSection === 'minutes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <form onSubmit={handleUploadMinutes} className="space-y-4 h-fit bg-slate-50 p-4 rounded-xl">
                        <h3 className="font-bold text-slate-700">Upload Minutes (PDF)</h3>
                        <input className="border p-2 rounded w-full" placeholder="Meeting Title" value={newMinutes.title} onChange={e => setNewMinutes({...newMinutes, title: e.target.value})} required/>
                        <input type="date" className="border p-2 rounded w-full" value={newMinutes.date} onChange={e => setNewMinutes({...newMinutes, date: e.target.value})} required/>
                        <input type="file" accept="application/pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" onChange={e => setNewMinutes({...newMinutes, file: e.target.files[0]})} required/>
                        <button className="w-full bg-indigo-600 text-white py-2 rounded font-bold flex items-center justify-center gap-2"><Upload size={16}/> Upload File</button>
                    </form>
                    <div className="space-y-2">
                        {minutes.map(m => (
                            <div key={m.id} className="flex justify-between items-center p-3 bg-white border rounded shadow-sm">
                                <div>
                                    <p className="font-bold text-sm">{m.title}</p>
                                    <p className="text-xs text-slate-400">{new Date(m.meeting_date).toLocaleDateString()}</p>
                                </div>
                                <a href={`http://localhost:5000${m.file_path}`} target="_blank" rel="noreferrer" className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">Download</a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}