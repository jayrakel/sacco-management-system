import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
    Save, Upload, Plus, Trash2, Globe, FileText, 
    Download, PenTool, Edit2, X, Calendar 
} from 'lucide-react';
import jsPDF from 'jspdf';
import ReactQuill from 'react-quill-new'; // UPDATED IMPORT
import 'react-quill-new/dist/quill.snow.css'; // UPDATED CSS IMPORT

export default function WebsiteManager() {
    // --- STATE MANAGEMENT ---
    const [activeSection, setActiveSection] = useState('text'); // 'text', 'history', 'minutes'
    const [loading, setLoading] = useState(false);
    
    // 1. Text Content State
    const [textContent, setTextContent] = useState({ 
        hero_title: '', 
        about_us_text: '', 
        welcome_message: '' 
    });

    // 2. History State
    const [history, setHistory] = useState([]);
    const [historyMode, setHistoryMode] = useState('ADD'); // 'ADD' or 'EDIT'
    const [editHistoryId, setEditHistoryId] = useState(null);
    const [historyForm, setHistoryForm] = useState({ 
        title: '', 
        date: '', 
        description: '' 
    });

    // 3. Minutes State
    const [minutes, setMinutes] = useState([]);
    const [minutesMode, setMinutesMode] = useState('UPLOAD'); // 'UPLOAD' or 'WRITE'
    
    // Minutes: Upload Form
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadMeta, setUploadMeta] = useState({ title: '', date: '' });
    
    // Minutes: Live Write Form
    const [liveDoc, setLiveDoc] = useState({ title: '', date: '', content: '' });

    // --- CONFIGURATION ---
    // Toolbar options for the Rich Text Editor
    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [{'list': 'ordered'}, {'list': 'bullet'}],
            ['link'],
            ['clean']
        ],
    };

    // --- INITIAL DATA FETCH ---
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/cms/content');
            if (res.data.text) {
                setTextContent(prev => ({ ...prev, ...res.data.text }));
            }
            setHistory(res.data.history || []);
            setMinutes(res.data.minutes || []);
        } catch (e) {
            console.error("Failed to load CMS content", e);
        }
    };

    // ==========================================
    // 1. TEXT CONTENT HANDLERS
    // ==========================================
    const handleTextSave = async (key) => {
        setLoading(true);
        try {
            await api.post('/api/cms/text', { key, value: textContent[key] });
            alert('Content updated successfully!');
        } catch (e) {
            alert('Failed to save content.');
        }
        setLoading(false);
    };

    // ==========================================
    // 2. HISTORY HANDLERS (CRUD)
    // ==========================================
    const handleHistorySubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (historyMode === 'ADD') {
                await api.post('/api/cms/history', historyForm);
                alert("Milestone added to timeline!");
            } else {
                await api.put(`/api/cms/history/${editHistoryId}`, historyForm);
                alert("Milestone updated successfully!");
                resetHistoryForm();
            }
            fetchData();
        } catch (e) {
            alert("Operation failed. Please check your input.");
        }
        setLoading(false);
    };

    const handleEditHistory = (item) => {
        setHistoryMode('EDIT');
        setEditHistoryId(item.id);
        // Format date to YYYY-MM-DD for the input field
        const dateStr = item.event_date ? new Date(item.event_date).toISOString().split('T')[0] : '';
        setHistoryForm({ 
            title: item.event_title, 
            date: dateStr, 
            description: item.description 
        });
        // Scroll to top of form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteHistory = async (id) => {
        if (!window.confirm("Are you sure you want to delete this event?")) return;
        try {
            await api.delete(`/api/cms/history/${id}`);
            fetchData();
        } catch (e) {
            alert("Failed to delete event.");
        }
    };

    const resetHistoryForm = () => {
        setHistoryMode('ADD');
        setEditHistoryId(null);
        setHistoryForm({ title: '', date: '', description: '' });
    };

    // ==========================================
    // 3. MINUTES HANDLERS (Upload & Live Write)
    // ==========================================
    
    // A. Upload Existing PDF
    const handleUploadMinutes = async (e) => {
        e.preventDefault();
        if (!uploadFile) return alert("Please select a file.");
        
        setLoading(true);
        const formData = new FormData();
        formData.append('title', uploadMeta.title);
        formData.append('date', uploadMeta.date);
        formData.append('file', uploadFile);

        try {
            await api.post('/api/cms/minutes', formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });
            alert("Document uploaded successfully!");
            setUploadMeta({ title: '', date: '' });
            setUploadFile(null);
            fetchData();
        } catch (e) {
            alert("Upload failed.");
        }
        setLoading(false);
    };

    // B. Generate PDF from Text (Live Write)
    const handlePublishLiveMinutes = async (e) => {
        e.preventDefault();
        if (!liveDoc.content || !liveDoc.title || !liveDoc.date) {
            return alert("Please fill in all fields.");
        }
        
        setLoading(true);
        try {
            const doc = new jsPDF();
            
            // PDF Header
            doc.setFontSize(22);
            doc.setTextColor(40, 40, 40);
            doc.text(liveDoc.title, 20, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Date Held: ${new Date(liveDoc.date).toLocaleDateString()}`, 20, 30);
            doc.line(20, 35, 190, 35); // Horizontal divider

            // PDF Content (Auto-wrap)
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            const splitText = doc.splitTextToSize(liveDoc.content, 170);
            doc.text(splitText, 20, 45);

            // PDF Footer (Page Numbers)
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.text(`Page ${i} of ${pageCount} - Official Record`, 100, 290, null, null, "center");
            }

            // Convert PDF to Blob for upload
            const pdfBlob = doc.output('blob');
            const fileName = `${liveDoc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

            // Upload generated PDF
            const formData = new FormData();
            formData.append('title', liveDoc.title);
            formData.append('date', liveDoc.date);
            formData.append('file', pdfBlob, fileName);

            await api.post('/api/cms/minutes', formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });
            
            alert("Minutes generated and published successfully!");
            setLiveDoc({ title: '', date: '', content: '' });
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to generate/publish minutes.");
        }
        setLoading(false);
    };

    const handleDeleteMinutes = async (id) => {
        if (!window.confirm("Delete this document permanently?")) return;
        try {
            await api.delete(`/api/cms/minutes/${id}`);
            fetchData();
        } catch (e) {
            alert("Delete failed.");
        }
    };

    // ==========================================
    // RENDER UI
    // ==========================================
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
            {/* --- Header & Tabs --- */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-slate-100 pb-4 gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <Globe className="text-indigo-600"/> Website Content Manager
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['text', 'history', 'minutes'].map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveSection(tab)} 
                            className={`px-6 py-2 rounded-md text-sm font-bold capitalize transition-all ${
                                activeSection === tab 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab === 'text' ? 'General Info' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- 1. GENERAL TEXT SECTION --- */}
            {activeSection === 'text' && (
                <div className="space-y-8 max-w-4xl">
                    {/* Hero Title */}
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-slate-600 uppercase tracking-wide">Website Hero Title</label>
                        <div className="flex gap-2">
                            <input 
                                className="border border-slate-300 p-3 rounded-xl w-full focus:ring-2 focus:ring-indigo-200 outline-none transition" 
                                value={textContent.hero_title} 
                                onChange={e => setTextContent({...textContent, hero_title: e.target.value})} 
                                placeholder="e.g., Empowering Our Community"
                            />
                            <button 
                                onClick={() => handleTextSave('hero_title')} 
                                disabled={loading}
                                className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition"
                            >
                                <Save size={20}/>
                            </button>
                        </div>
                    </div>

                    {/* Welcome Message */}
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-slate-600 uppercase tracking-wide">Welcome Message (Short)</label>
                        <div className="flex gap-2">
                            <textarea 
                                className="border border-slate-300 p-3 rounded-xl w-full h-24 focus:ring-2 focus:ring-indigo-200 outline-none transition resize-none" 
                                value={textContent.welcome_message} 
                                onChange={e => setTextContent({...textContent, welcome_message: e.target.value})} 
                                placeholder="A short greeting on the home page..."
                            />
                            <button 
                                onClick={() => handleTextSave('welcome_message')} 
                                disabled={loading}
                                className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition h-fit"
                            >
                                <Save size={20}/>
                            </button>
                        </div>
                    </div>
                    
                    {/* About Us (Rich Text) */}
                    <div className="space-y-2">
                        <label className="font-bold text-sm text-slate-600 uppercase tracking-wide">About Us / Group Story</label>
                        <div className="bg-white rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-200 transition">
                            <ReactQuill 
                                theme="snow" 
                                value={textContent.about_us_text} 
                                onChange={val => setTextContent({...textContent, about_us_text: val})} 
                                modules={quillModules} 
                                className="h-64 mb-12" // Margin bottom for toolbar space
                            />
                        </div>
                        <button 
                            onClick={() => handleTextSave('about_us_text')} 
                            disabled={loading}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 mt-4 transition shadow-lg shadow-indigo-100"
                        >
                            {loading ? 'Saving...' : 'Save About Us Content'}
                        </button>
                    </div>
                </div>
            )}

            {/* --- 2. HISTORY / TIMELINE SECTION --- */}
            {activeSection === 'history' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Form Side */}
                    <form 
                        onSubmit={handleHistorySubmit} 
                        className={`space-y-4 h-fit p-6 rounded-2xl border ${
                            historyMode === 'EDIT' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h3 className={`font-bold flex items-center gap-2 ${historyMode === 'EDIT' ? 'text-amber-700' : 'text-slate-700'}`}>
                                {historyMode === 'EDIT' ? <><Edit2 size={18}/> Edit Milestone</> : <><Plus size={18}/> Add Milestone</>}
                            </h3>
                            {historyMode === 'EDIT' && (
                                <button type="button" onClick={resetHistoryForm} className="text-xs text-amber-600 hover:underline font-bold flex items-center gap-1">
                                    <X size={14}/> Cancel
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            <input 
                                className="border border-slate-300 p-3 rounded-xl w-full bg-white outline-none focus:ring-2 focus:ring-indigo-200" 
                                placeholder="Event Title (e.g. Group Founded)" 
                                value={historyForm.title} 
                                onChange={e => setHistoryForm({...historyForm, title: e.target.value})} 
                                required
                            />
                            <input 
                                type="date" 
                                className="border border-slate-300 p-3 rounded-xl w-full bg-white outline-none focus:ring-2 focus:ring-indigo-200 text-slate-600" 
                                value={historyForm.date} 
                                onChange={e => setHistoryForm({...historyForm, date: e.target.value})} 
                                required
                            />
                            <div className="bg-white rounded-xl border border-slate-300 overflow-hidden">
                                <ReactQuill 
                                    theme="snow" 
                                    value={historyForm.description} 
                                    onChange={val => setHistoryForm({...historyForm, description: val})} 
                                    modules={quillModules} 
                                    placeholder="Describe this milestone..."
                                    className="h-40 mb-10"
                                />
                            </div>
                        </div>

                        <button 
                            disabled={loading} 
                            className={`w-full text-white py-3 rounded-xl font-bold shadow-lg transition mt-4 ${
                                historyMode === 'EDIT' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {loading ? 'Saving...' : (historyMode === 'EDIT' ? 'Update Milestone' : 'Add to Timeline')}
                        </button>
                    </form>
                    
                    {/* List Side */}
                    <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                        {history.length === 0 && <p className="text-slate-400 italic text-center py-10">No history events recorded yet.</p>}
                        
                        {history.map(h => (
                            <div key={h.id} className="relative pl-6 pb-6 border-l-2 border-indigo-100 last:border-0 group hover:border-indigo-300 transition-colors">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-indigo-600 group-hover:bg-indigo-600 transition-colors"></div>
                                <div className="flex justify-between items-start bg-white p-4 rounded-xl border border-slate-100 shadow-sm group-hover:shadow-md transition">
                                    <div className="w-full">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">
                                                {new Date(h.event_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-lg mb-2">{h.event_title}</h4>
                                        <div 
                                            className="text-sm text-slate-600 prose prose-sm max-w-none" 
                                            dangerouslySetInnerHTML={{ __html: h.description }}
                                        ></div>
                                    </div>
                                    <div className="flex flex-col gap-2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditHistory(h)} className="p-2 bg-slate-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="Edit">
                                            <Edit2 size={16}/>
                                        </button>
                                        <button onClick={() => handleDeleteHistory(h.id)} className="p-2 bg-slate-50 text-red-600 rounded-lg hover:bg-red-100" title="Delete">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- 3. MINUTES SECTION --- */}
            {activeSection === 'minutes' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Creation Area */}
                    <div className="space-y-6">
                        {/* Toggle Mode */}
                        <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                            <button 
                                onClick={() => setMinutesMode('UPLOAD')} 
                                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${minutesMode === 'UPLOAD' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <Upload size={14}/> Upload PDF
                            </button>
                            <button 
                                onClick={() => setMinutesMode('WRITE')} 
                                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${minutesMode === 'WRITE' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <PenTool size={14}/> Write Live
                            </button>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            {minutesMode === 'UPLOAD' ? (
                                <form onSubmit={handleUploadMinutes} className="space-y-4 animate-fade-in">
                                    <h3 className="font-bold text-slate-800 mb-4">Upload Existing Document</h3>
                                    <input className="border p-3 rounded-xl w-full" placeholder="Meeting Title (e.g. AGM 2024)" value={uploadMeta.title} onChange={e => setUploadMeta({...uploadMeta, title: e.target.value})} required/>
                                    <input type="date" className="border p-3 rounded-xl w-full" value={uploadMeta.date} onChange={e => setUploadMeta({...uploadMeta, date: e.target.value})} required/>
                                    
                                    <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-100 transition cursor-pointer">
                                        <input type="file" accept="application/pdf" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={e => setUploadFile(e.target.files[0])} required/>
                                        <div className="pointer-events-none text-slate-500">
                                            {uploadFile ? <span className="text-indigo-600 font-bold">{uploadFile.name}</span> : <span>Click to select PDF file</span>}
                                        </div>
                                    </div>

                                    <button disabled={loading} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition shadow-lg">
                                        {loading ? "Uploading..." : <><Upload size={18}/> Upload Document</>}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handlePublishLiveMinutes} className="space-y-4 animate-fade-in">
                                    <h3 className="font-bold text-emerald-800 mb-4">Draft & Publish Minutes</h3>
                                    <input className="border p-3 rounded-xl w-full" placeholder="Meeting Title" value={liveDoc.title} onChange={e => setLiveDoc({...liveDoc, title: e.target.value})} required/>
                                    <input type="date" className="border p-3 rounded-xl w-full" value={liveDoc.date} onChange={e => setLiveDoc({...liveDoc, date: e.target.value})} required/>
                                    <textarea 
                                        className="border p-3 rounded-xl w-full h-64 text-sm resize-none focus:ring-2 focus:ring-emerald-200 outline-none" 
                                        placeholder="Type minutes here... (Introduction, Agenda, Resolutions...)" 
                                        value={liveDoc.content} 
                                        onChange={e => setLiveDoc({...liveDoc, content: e.target.value})} 
                                        required
                                    ></textarea>
                                    <button disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-100">
                                        {loading ? "Generating..." : <><FileText size={18}/> Publish to Website (PDF)</>}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* List Area */}
                    <div>
                        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2 border-b pb-2">
                            <FileText size={20} className="text-indigo-600"/> Archived Documents
                        </h3>
                        <div className="space-y-3">
                            {minutes.length === 0 ? <p className="text-slate-400 italic text-sm text-center py-8 bg-slate-50 rounded-xl border border-dashed">No documents found.</p> :
                            minutes.map(m => (
                                <div key={m.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition group">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-red-50 text-red-600 p-2.5 rounded-lg">
                                            <FileText size={20}/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{m.title}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <Calendar size={10}/> {new Date(m.meeting_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <a 
                                            href={`http://localhost:5000${m.file_path}`} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="bg-indigo-50 text-indigo-600 p-2 rounded-lg hover:bg-indigo-100 transition flex items-center gap-2 text-xs font-bold"
                                        >
                                            <Download size={16}/> <span className="hidden sm:inline">Download</span>
                                        </a>
                                        <button 
                                            onClick={() => handleDeleteMinutes(m.id)} 
                                            className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition opacity-0 group-hover:opacity-100"
                                            title="Delete Document"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}