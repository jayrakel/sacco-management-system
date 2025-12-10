import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, History, Users, ArrowRight, Menu } from 'lucide-react';
import api from '../api';

export default function GroupWebsite() {
    const [data, setData] = useState({ text: {}, history: [], minutes: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/cms/content')
           .then(res => { setData(res.data); setLoading(false); })
           .catch(err => { console.error(err); setLoading(false); });
    }, []);

    if(loading) return <div className="min-h-screen flex items-center justify-center">Loading Website...</div>;

    const { text, history, minutes } = data;

    return (
        <div className="font-sans text-slate-800">
            {/* NAVIGATION */}
            <nav className="bg-white border-b sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="font-bold text-2xl text-indigo-900 tracking-tight">BetterLink Group</div>
                        <div className="hidden md:flex gap-8 items-center text-sm font-medium text-slate-600">
                            <a href="#about" className="hover:text-indigo-600">About Us</a>
                            <a href="#history" className="hover:text-indigo-600">Our History</a>
                            <a href="#minutes" className="hover:text-indigo-600">Downloads</a>
                            <Link to="/login" className="bg-indigo-600 text-white px-5 py-2 rounded-full hover:bg-indigo-700 transition">Member Portal</Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <header className="bg-indigo-900 text-white py-24 text-center px-4">
                <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight">{text.hero_title || "Empowering Our Community Together"}</h1>
                <p className="text-indigo-200 text-lg md:text-xl max-w-2xl mx-auto mb-10">{text.welcome_message || "Welcome to the official digital home of our investment group. Transparency, Growth, and Unity."}</p>
                <Link to="/login" className="inline-flex items-center gap-2 bg-white text-indigo-900 px-8 py-3 rounded-full font-bold hover:bg-indigo-50 transition">Access Member Dashboard <ArrowRight size={20}/></Link>
            </header>

            {/* ABOUT SECTION */}
            <section id="about" className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-block p-3 bg-emerald-100 text-emerald-700 rounded-full mb-6"><Users size={32}/></div>
                    <h2 className="text-3xl font-bold mb-6">About Us</h2>
                    <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-line">
                        {text.about_us_text || "We are a dedicated group of individuals committed to financial growth and mutual support. Founded on principles of trust..."}
                    </p>
                </div>
            </section>

            {/* HISTORY TIMELINE */}
            <section id="history" className="py-20 bg-slate-50">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <div className="inline-block p-3 bg-indigo-100 text-indigo-700 rounded-full mb-4"><History size={32}/></div>
                        <h2 className="text-3xl font-bold">Our Journey</h2>
                        <p className="text-slate-500">Milestones that define who we are.</p>
                    </div>
                    
                    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                        {history.map((event, idx) => (
                            <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-hover:bg-indigo-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                    <time className="font-caveat font-bold text-indigo-500">{new Date(event.event_date).getFullYear()}</time>
                                    <h3 className="text-lg font-bold text-slate-800">{event.event_title}</h3>
                                    <p className="text-slate-500 text-sm mt-2">{event.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* MINUTES DOWNLOADS */}
            <section id="minutes" className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-6">
                    <h2 className="text-3xl font-bold mb-10 text-center">Meeting Minutes Archive</h2>
                    <div className="grid gap-4">
                        {minutes.length === 0 ? <p className="text-center text-slate-400">No documents available yet.</p> : 
                        minutes.map(doc => (
                            <div key={doc.id} className="flex flex-col sm:flex-row justify-between items-center p-6 bg-slate-50 hover:bg-slate-100 rounded-2xl transition border border-slate-100">
                                <div className="mb-4 sm:mb-0">
                                    <h4 className="font-bold text-lg text-slate-800">{doc.title}</h4>
                                    <p className="text-sm text-slate-500">Date Held: {new Date(doc.meeting_date).toLocaleDateString()}</p>
                                </div>
                                <a 
                                    href={`http://localhost:5000${doc.file_path}`} 
                                    download
                                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                                >
                                    <Download size={18}/> Download PDF
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="bg-slate-900 text-slate-400 py-12 text-center">
                <p>&copy; {new Date().getFullYear()} BetterLink Group. All rights reserved.</p>
            </footer>
        </div>
    );
}