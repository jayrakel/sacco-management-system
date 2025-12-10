import React, { useState, useEffect } from 'react';
import api from '../api';
import { Save, Upload, Plus, Trash2, Globe, FileText, Download, PenTool, Edit2, X } from 'lucide-react';
import jsPDF from 'jspdf';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Import standard styles

export default function WebsiteManager() {
    const [activeSection, setActiveSection] = useState('text'); 
    const [textContent, setTextContent] = useState({ hero_title: '', about_us_text: '', welcome_message: '' });
    const [history, setHistory] = useState([]);
    const [minutes, setMinutes] = useState([]);
    
    // History State
    const [historyMode, setHistoryMode] = useState('ADD'); 
    const [editHistoryId, setEditHistoryId] = useState(null);
    const [historyForm, setHistoryForm] = useState({ title: '', date: '', description: '' });

    // Minutes State
    const [minutesMode, setMinutesMode] = useState('UPLOAD'); 
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadMeta, setUploadMeta] = useState({ title: '', date: '' });
    const [liveDoc, setLiveDoc] = useState({ title: '', date: '', content: '' });

    const [loading, setLoading] = useState(false);

    // Quill Toolbar Settings
    const modules = {
        toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [{'list': 'ordered'}, {'list': 'bullet'}],
            ['link'],
            ['clean']
        ],
    };

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/cms/content');
            if (res.data.text) setTextContent(prev => ({ ...prev, ...res.data.text }));
            setHistory(res.data.history || []);
            setMinutes(res.data.minutes || []);
        } catch (e) { console.error("Failed to load content"); }
    };

    // --- TEXT HANDLERS ---
    const handleTextSave = async (key) => {
        await api.post('/api/cms/text', { key, value: textContent[key] });
        alert('Website content updated!');
    };

    // --- HISTORY HANDLERS ---
    const handleHistorySubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (historyMode === 'ADD') {
                await api.post('/api/cms/history', historyForm);
                alert("Event added!");
            } else {
                await api.put(`/api/cms/history/${editHistoryId}`, historyForm);
                alert("Event updated!");
                resetHistoryForm();
            }
            fetchData();
        } catch(e) { alert("Operation failed"); }
        setLoading(false);
    };

    const handleEditHistory = (item) => {
        setHistoryMode('EDIT');
        setEditHistoryId(item.id);
        const dateStr = new Date(item.event_date).toISOString().split('T')[0];
        setHistoryForm({ title: item.event_title, date: dateStr, description: item.description });
    };

    const handleDeleteHistory = async (id) => {
        if(!window.confirm("Delete this event?")) return;
        try { await api.delete(`/api/cms/history/${id}`); fetchData(); } catch(e) {}
    };

    const resetHistoryForm = () => {
        setHistoryMode('ADD');
        setEditHistoryId(null);
        setHistoryForm({ title: '', date: '', description: '' });
    };

    // --- MINUTES HANDLERS ---
    const handleUploadMinutes = async (e) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData();
        formData.append('title', uploadMeta.title);
        formData.append('date', uploadMeta.date);
        formData.append('file', uploadFile);

        try {
            await api.post('/api/cms/minutes', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            alert("Document uploaded!");
            setUploadMeta({ title: '', date: '' });
            setUploadFile(null);
            fetchData();
        } catch (e) { alert("Upload failed"); }
        setLoading(false);
    };

    const handleDeleteMinutes = async (id) => {
        if(!window.confirm("Delete this document?")) return;
        try { await api.delete(`/api/cms/minutes/${id}`); fetchData(); } catch(e) {}
    };

    const handlePublishLiveMinutes = async (e) => {
        e.preventDefault();
        if(!liveDoc.content || !liveDoc.title) return alert("Please fill in all fields");
        setLoading(true);
        try {
            const doc = new jsPDF();
            // ... (PDF Generation Logic from previous step) ...
            // Simplified for brevity in this snippet, ensure you keep your existing PDF logic here
             doc.setFontSize(18); doc.text(liveDoc.title, 20, 20);
             doc.setFontSize(12); doc.text(doc.splitTextToSize(liveDoc.content, 180), 20, 40);
            
            const formData = new FormData();
            formData.append('title', liveDoc.title);
            formData.append('date', liveDoc.date);
            formData.append('file', doc.output('blob'), `${liveDoc.title}.pdf`);

            await api.post('/api/cms/minutes', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            alert("Minutes Published!");
            setLiveDoc({ title: '', date: '', content: '' });
            fetchData();
        } catch (err) { alert("Failed"); }
        setLoading(false);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Globe className="text-indigo-600"/> Website Content Manager</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['text', 'history', 'minutes'].map(tab => (
                        <button key={tab} onClick={() => setActiveSection(tab)} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition ${activeSection === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
                    ))}
                </div>
            </div>

            {/* 1. TEXT EDITOR (RICH TEXT) */}
            {activeSection === 'text' && (
                <div className="space-y-6 max-w-3xl">
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-slate-600 uppercase">Website Hero Title</label>
                        <div className="flex gap-2">
                            <input className="border p-3 rounded-xl w-full" value={textContent.hero_title} onChange={e => setTextContent({...textContent, hero_title: e.target.value})} />
                            <button onClick={() => handleTextSave('hero_title')} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Save size={20}/></button>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-slate-600 uppercase">About Us / Group Story</label>
                        <div className="bg-white rounded-xl overflow-hidden">
                            <ReactQuill theme="snow" value={textContent.about_us_text} onChange={val => setTextContent({...textContent, about_us_text: val})} modules={modules} />
                        </div>
                        <button onClick={() => handleTextSave('about_us_text')} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 mt-2">Save Story</button>
                    </div>

                    <div className="space-y-2">
                         <label className="font-bold text-sm text-slate-600 uppercase">Welcome Message (Short)</label>
                         <textarea className="border p-3 rounded-xl w-full h-20" value={textContent.welcome_message} onChange={e => setTextContent({...textContent, welcome_message: e.target.value})} />
                         <button onClick={() => handleTextSave('welcome_message')} className="text-xs font-bold text-indigo-600 hover:underline">Save Message</button>
                    </div>
                </div>
            )}

            {/* 2. HISTORY MANAGER (RICH TEXT) */}
            {activeSection === 'history' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <form onSubmit={handleHistorySubmit} className={`space-y-4 h-fit p-6 rounded-2xl border ${historyMode === 'EDIT' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className={`font-bold flex items-center gap-2 ${historyMode === 'EDIT' ? 'text-amber-700' : 'text-slate-700'}`}>
                                {historyMode === 'EDIT' ? <><Edit2 size={18}/> Edit Milestone</> : <><Plus size={18}/> Add Milestone</>}
                            </h3>
                            {historyMode === 'EDIT' && <button type="button" onClick={resetHistoryForm} className="text-xs text-amber-600 hover:underline">Cancel</button>}
                        </div>
                        <input className="border p-3 rounded-xl w-full bg-white" placeholder="Event Title" value={historyForm.title} onChange={e => setHistoryForm({...historyForm, title: e.target.value})} required/>
                        <input type="date" className="border p-3 rounded-xl w-full bg-white" value={historyForm.date} onChange={e => setHistoryForm({...historyForm, date: e.target.value})} required/>
                        
                        {/* Rich Text for History */}
                        <div className="bg-white rounded-lg">
                            <ReactQuill theme="snow" value={historyForm.description} onChange={val => setHistoryForm({...historyForm, description: val})} modules={modules} placeholder="Tell the story..." />
                        </div>

                        <button disabled={loading} className={`w-full text-white py-3 rounded-xl font-bold shadow-lg transition ${historyMode === 'EDIT' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                            {loading ? 'Saving...' : (historyMode === 'EDIT' ? 'Update Event' : 'Add to Timeline')}
                        </button>
                    </form>
                    
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {history.map(h => (
                            <div key={h.id} className="relative pl-6 pb-6 border-l-2 border-indigo-200 last:border-0 group">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-white"></div>
                                <div className="flex justify-between items-start">
                                    <div className="w-full">
                                        <p className="text-xs font-bold text-indigo-500 mb-1">{new Date(h.event_date).toLocaleDateString()}</p>
                                        <p className="font-bold text-slate-800 text-lg mb-2">{h.event_title}</p>
                                        {/* Render HTML Preview */}
                                        <div className="text-sm text-slate-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: h.description }}></div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition ml-2">
                                        <button onClick={() => handleEditHistory(h)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><Edit2 size={14}/></button>
                                        <button onClick={() => handleDeleteHistory(h.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. MINUTES MANAGER (Existing Code) */}
            {activeSection === 'minutes' && (
                // ... (Keep existing minutes code here) ...
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">Minutes Manager (Same as before)</div>
            )}
        </div>
    );
}