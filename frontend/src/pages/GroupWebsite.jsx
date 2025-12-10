import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
    Download, History, Users, ArrowRight, 
    PiggyBank, HandCoins, HeartHandshake, TrendingUp, Quote 
} from 'lucide-react';
import api from '../api';

// Helper component to safely render HTML from ReactQuill
const RichText = ({ content, className = "" }) => (
    <div className={`prose prose-slate max-w-none ${className}`} dangerouslySetInnerHTML={{ __html: content }} />
);

export default function GroupWebsite() {
    const [data, setData] = useState({ text: {}, history: [], minutes: [] });
    // NEW: State to hold dynamic branding info
    const [branding, setBranding] = useState({ name: 'BetterLink Group', logo: null });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch CMS content and Branding settings in parallel
                const [cmsRes, brandRes] = await Promise.all([
                    api.get('/api/cms/content'),
                    api.get('/api/settings/branding') // This public route returns logo & name
                ]);

                setData(cmsRes.data);

                // Process branding data
                if (brandRes.data) {
                    const brandMap = {};
                    brandRes.data.forEach(item => {
                        brandMap[item.setting_key] = item.setting_value;
                    });
                    
                    setBranding({
                        name: brandMap['sacco_name'] || 'BetterLink Group',
                        logo: brandMap['sacco_logo'] || null
                    });
                }

                setLoading(false);
            } catch (err) {
                console.error("Failed to load website content", err);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if(loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-12 w-12 bg-indigo-200 rounded-full mb-4"></div>
                <div className="h-4 w-32 bg-indigo-100 rounded"></div>
            </div>
        </div>
    );

    const { text, history, minutes } = data;

    // --- STATIC CONTENT FOR FOUNDING VISION ---
    const pillars = [
        { title: "Unity", desc: "Building a community that supports its own.", icon: <Users size={24} /> },
        { title: "Savings Culture", desc: "Encouraging consistent, disciplined saving.", icon: <PiggyBank size={24} /> },
        { title: "Affordable Credit", desc: "Providing members with fair, accessible loans.", icon: <HandCoins size={24} /> },
        { title: "Welfare Support", desc: "Ensuring no member faces hardship alone.", icon: <HeartHandshake size={24} /> },
        { title: "Growth & Empowerment", desc: "Supporting financial independence and ventures.", icon: <TrendingUp size={24} /> }
    ];

    return (
        <div className="font-sans text-slate-800 scroll-smooth">
            {/* 1. NAVIGATION */}
            <nav className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        <div className="flex items-center gap-2">
                            {/* DYNAMIC LOGO: Render image if available, else fallback icon */}
                            {branding.logo ? (
                                <img src={branding.logo} alt="Logo" className="h-10 w-auto object-contain" />
                            ) : (
                                <div className="bg-indigo-600 text-white p-2 rounded-lg">
                                    <Users size={24} />
                                </div>
                            )}
                            {/* DYNAMIC NAME */}
                            <span className="font-bold text-xl tracking-tight text-slate-900">{branding.name}</span>
                        </div>
                        <div className="hidden md:flex gap-8 items-center text-sm font-bold text-slate-500">
                            <a href="#vision" className="hover:text-indigo-600 transition">Our Vision</a>
                            <a href="#about" className="hover:text-indigo-600 transition">About Us</a>
                            <a href="#history" className="hover:text-indigo-600 transition">History</a>
                            <a href="#minutes" className="hover:text-indigo-600 transition">Downloads</a>
                            <Link to="/login" className="bg-slate-900 text-white px-6 py-2.5 rounded-full hover:bg-slate-800 transition shadow-lg shadow-slate-200">Member Portal</Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* 2. HERO SECTION */}
            <header className="relative bg-indigo-900 text-white py-32 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/90 to-indigo-900/50"></div>
                
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <span className="inline-block py-1 px-3 rounded-full bg-indigo-800 border border-indigo-700 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6">Established 2005</span>
                    <h1 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tight leading-tight">
                        {text.hero_title || "Empowering Our Community Together"}
                    </h1>
                    <p className="text-indigo-100 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed opacity-90">
                        {text.welcome_message || "Welcome to the official digital home of our investment group. Transparency, Growth, and Unity."}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-white text-indigo-900 px-8 py-4 rounded-full font-bold hover:bg-indigo-50 transition shadow-xl">
                            Access Dashboard <ArrowRight size={20}/>
                        </Link>
                        <a href="#vision" className="inline-flex items-center justify-center gap-2 bg-indigo-800/50 backdrop-blur-sm text-white border border-indigo-700 px-8 py-4 rounded-full font-bold hover:bg-indigo-800 transition">
                            Read Our Story
                        </a>
                    </div>
                </div>
            </header>

            {/* 3. FOUNDING VISION (5 Pillars) */}
            <section id="vision" className="py-24 bg-white border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        
                        {/* Narrative Side */}
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 text-indigo-600 font-bold uppercase text-xs tracking-widest">
                                <span className="w-8 h-0.5 bg-indigo-600"></span> The Beginning
                            </div>
                            <h2 className="text-4xl font-bold text-slate-900 leading-tight">
                                On the afternoon of <span className="text-indigo-600">January 2005</span>...
                            </h2>
                            <div className="text-lg text-slate-600 leading-relaxed space-y-6">
                                <p>
                                    Twelve individuals met with a singular, shared aspiration that would lay the foundation for everything we have built today.
                                </p>
                                <blockquote className="relative p-6 bg-slate-50 border-l-4 border-indigo-500 rounded-r-xl italic text-slate-700 font-medium">
                                    <Quote className="absolute top-2 right-4 text-slate-200 opacity-50" size={40} />
                                    “To uplift each other through disciplined savings, shared knowledge, and mutual support.”
                                </blockquote>
                                <p>
                                    From that first meeting, a clear vision emerged, anchored by five unshakeable pillars that continue to guide our journey.
                                </p>
                            </div>
                        </div>

                        {/* Pillars Grid Side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {pillars.map((pillar, idx) => (
                                <div key={idx} className={`p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 bg-white ${idx === 4 ? 'sm:col-span-2 bg-gradient-to-r from-indigo-50 to-white' : ''}`}>
                                    <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
                                        {pillar.icon}
                                    </div>
                                    <h3 className="font-bold text-slate-900 mb-2">{pillar.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{pillar.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

             {/* 4. ABOUT SECTION (Dynamic Rich Text) */}
             <section id="about" className="py-24 bg-slate-50">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-10">
                        <div className="inline-block p-3 bg-emerald-100 text-emerald-700 rounded-full mb-6"><Users size={32}/></div>
                        <h2 className="text-3xl font-bold text-slate-900">About Us</h2>
                    </div>
                    
                    <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200">
                        <RichText content={text.about_us_text || "<p class='text-center text-slate-500 italic'>Admin has not added the 'About Us' content yet.</p>"} className="text-lg text-slate-600 leading-relaxed space-y-4" />
                    </div>
                </div>
            </section>

            {/* 5. HISTORY TIMELINE (Dynamic Rich Text) */}
            <section id="history" className="py-24 bg-white relative">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <div className="inline-block p-3 bg-indigo-100 text-indigo-700 rounded-full mb-4"><History size={32}/></div>
                        <h2 className="text-3xl font-bold text-slate-900">Our Journey</h2>
                        <p className="text-slate-500 mt-2">Milestones that define who we are.</p>
                    </div>
                    
                    <div className="relative">
                        {/* Vertical Line */}
                        <div className="absolute left-4 md:left-1/2 h-full w-0.5 bg-slate-200 -translate-x-1/2 hidden md:block"></div>
                        <div className="absolute left-4 h-full w-0.5 bg-slate-200 md:hidden"></div>

                        <div className="space-y-12">
                            {history.length === 0 ? (
                                <div className="text-center text-slate-400 italic">No historical events recorded yet.</div>
                            ) : (
                                history.map((event, idx) => (
                                    <div key={event.id} className={`relative flex items-center md:justify-between ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                                        
                                        {/* Spacer for alternate side */}
                                        <div className="hidden md:block w-5/12"></div>

                                        {/* Dot */}
                                        <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-white shadow-sm z-10 mt-1.5 md:mt-0"></div>

                                        {/* Card */}
                                        <div className="w-full md:w-5/12 pl-12 md:pl-0">
                                            <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition group">
                                                <span className="text-indigo-500 font-bold text-sm tracking-wider font-mono block mb-2">
                                                    {new Date(event.event_date).getFullYear()}
                                                </span>
                                                <h3 className="text-xl font-bold text-slate-800 mb-3">{event.event_title}</h3>
                                                
                                                {/* Rich Text Description */}
                                                <RichText content={event.description} className="text-sm text-slate-600" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* 6. MINUTES DOWNLOADS */}
            <section id="minutes" className="py-24 bg-slate-50">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-10 border-b border-slate-200 pb-6 gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900">Meeting Archive</h2>
                            <p className="text-slate-500 mt-2">Access official records and minutes.</p>
                        </div>
                    </div>
                    
                    <div className="grid gap-4">
                        {minutes.length === 0 ? (
                            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                                <History className="mx-auto text-slate-300 mb-3" size={48} />
                                <p className="text-slate-400">No documents available yet.</p>
                            </div>
                        ) : (
                            minutes.map(doc => (
                                <div key={doc.id} className="group flex items-center justify-between p-5 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                                            <History size={24}/>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition">{doc.title}</h4>
                                            <p className="text-sm text-slate-400">Date Held: {new Date(doc.meeting_date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <a 
                                        href={`http://localhost:5000${doc.file_path}`} 
                                        download
                                        className="hidden sm:flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition"
                                    >
                                        <Download size={16}/> Download
                                    </a>
                                    <a 
                                        href={`http://localhost:5000${doc.file_path}`} 
                                        download
                                        className="sm:hidden p-2 text-indigo-600 bg-indigo-50 rounded-lg"
                                    >
                                        <Download size={20}/>
                                    </a>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* 7. FOOTER */}
            <footer className="bg-slate-900 text-slate-400 py-16 border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    <div>
                        <h4 className="text-white font-bold text-lg mb-4">{branding.name}</h4>
                        <p className="text-sm leading-relaxed opacity-80">
                            Empowering our members through unity and financial growth since 2005.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-lg mb-4">Quick Links</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#vision" className="hover:text-white transition">Our Vision</a></li>
                            <li><a href="#about" className="hover:text-white transition">About Us</a></li>
                            <li><a href="#history" className="hover:text-white transition">History</a></li>
                            <li><Link to="/login" className="hover:text-white transition">Member Login</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-lg mb-4">Contact</h4>
                        <p className="text-sm opacity-80">info@betterlinkgroup.com</p>
                    </div>
                </div>
                <div className="text-center pt-8 border-t border-slate-800 text-xs opacity-60">
                    <p>&copy; {new Date().getFullYear()} {branding.name}. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}