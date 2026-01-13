import React, { useState, useEffect, createContext, useContext } from 'react';

// --- Configuration ---
const getEnv = (key, fallback) => {
  try {
    return import.meta.env[key] || fallback;
  } catch (e) {
    return fallback;
  }
};

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL", "https://zpmpbnjyapszxeprcnva.supabase.co"); 
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwbXBibmp5YXBzenhlcHJjbnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODcwOTUsImV4cCI6MjA4MzU2MzA5NX0.hVTkhf3WglUUuiIHi6lkcyfBWBxWDBIfVt1yGJlK0Ow"); 

import { 
  CheckCircle, LayoutDashboard, LogOut, ShieldCheck, 
  Zap, Loader2, Check, TrendingUp, Smartphone, 
  X, ArrowLeft, AlertCircle, RefreshCw, UserX, ChevronRight, Mail, Lock, ShieldAlert,
  Search, Bell, Settings, ExternalLink, Activity, Sparkles, Globe, User, Clock, Terminal,
  CreditCard, DollarSign, Send, Copy, FileText
} from 'lucide-react';

const ADMIN_EMAILS = ['admin@writingportal.com', 'kipronoleleito594@gmail.com'];
const PAYBILL_NUMBER = "0719273185"; 
const PAYPAL_EMAIL = "payments@apexgigs.com";

const PLANS = {
  A1: { 
    id: 'A1', 
    name: 'Premium Tier', 
    priceKes: 28000, 
    priceUsd: 215,
    color: 'bg-purple-600', 
    categories: ['Online writing accounts', 'Academic writing accounts', 'Mercor AI Accounts'],
    description: 'Elite access for high-volume writing professionals.'
  },
  A2: { 
    id: 'A2', 
    name: 'Standard Tier', 
    priceKes: 14500, 
    priceUsd: 112,
    color: 'bg-indigo-600', 
    categories: ['eBay tasks', 'Data entry tasks', 'Chat moderation'],
    description: 'Reliable accounts for consistent secondary income.'
  },
  A3: { 
    id: 'A3', 
    name: 'Basic Tier', 
    priceKes: 7500, 
    priceUsd: 58,
    color: 'bg-emerald-600', 
    categories: ['Map reviews', 'Data annotation', 'Handshake AI'],
    description: 'Entry-level tasks for growing your digital profile.'
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [client, setClient] = useState(null);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.async = true;
    script.onload = () => {
      try {
        const supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        setClient(supabaseInstance);
      } catch (err) { setConfigError(true); }
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!client) return;
    client.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(currentUser?.email && ADMIN_EMAILS.includes(currentUser.email));
      setLoading(false);
      if (currentUser) logActivity('Session Restored', 'User resumed existing session', 'info');
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(currentUser?.email && ADMIN_EMAILS.includes(currentUser.email));
      if (event === 'SIGNED_IN') logActivity('Login Success', 'User authenticated successfully', 'success');
    });
    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!user || !client) { setProfile(null); return; }
    const fetchProfile = async () => {
      const { data } = await client.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
      else setProfile({ is_subscribed: false });
    };
    fetchProfile();
    const channel = client.channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
      (payload) => { setProfile(payload.new); })
      .subscribe();
    return () => client.removeChannel(channel);
  }, [user, client]);

  const logActivity = async (action, details, status = 'info') => {
    if (!client || !user) return;
    await client.from('activity_logs').insert({
      user_id: user.id,
      action,
      details,
      status,
      timestamp: new Date().toISOString()
    });
  };

  const value = {
    user, profile, loading, isAdmin, supabase: client, logActivity,
    login: (email, password) => client.auth.signInWithPassword({ email, password }),
    register: (email, password, username) => client.auth.signUp({ 
      email, 
      password, 
      options: { data: { username } } 
    }),
    logout: () => client.auth.signOut(),
    submitManualPayment: async (planId, transactionCode) => {
      await logActivity('Payment Proof Submitted', `M-Pesa Code: ${transactionCode} for ${planId}`, 'warning');
      return true;
    },
    finalizeSubscription: async (planId, method) => {
      const plan = PLANS[planId];
      const { error } = await client.from('profiles').upsert({ 
        id: user.id, tier: planId, is_subscribed: true, 
        allowed_categories: plan.categories, payment_method: method, updated_at: new Date()
      });
      if (error) throw error;
      await logActivity('Subscription Finalized', `User upgraded to ${plan.name} via ${method}`, 'success');
    }
  };

  if (configError) return <div className="p-20 text-center font-bold text-red-500">System Configuration Error</div>;
  return <AuthContext.Provider value={value}>{!client ? <div className="h-screen flex items-center justify-center bg-black"><Loader2 className="animate-spin text-indigo-600" /></div> : children}</AuthContext.Provider>;
};

const useAuth = () => useContext(AuthContext);

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 flex items-center gap-5">
    <div className={`${color} p-4 rounded-2xl shadow-lg text-white`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  </div>
);

const ActivityLogView = () => {
  const { supabase, user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });
      
      if (!error) setLogs(data);
      setLoading(false);
    };

    fetchLogs();
    const subscription = supabase.channel('activity_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `user_id=eq.${user.id}` }, 
      (payload) => { setLogs(prev => [payload.new, ...prev]); })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [supabase, user]);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Audit Logs</h1>
          <p className="text-slate-500 font-medium">Real-time security and transaction history for your account.</p>
        </div>
        <div className="bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-xl border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <Terminal size={14} /> LIVE MONITORING
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Recent Events</span>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Timestamp (UTC)</span>
        </div>
        
        <div className="divide-y divide-white/5">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center text-slate-600 font-bold">No activity recorded yet.</div>
          ) : logs.map((log) => (
            <div key={log.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
              <div className="flex items-center gap-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  log.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                  log.status === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-indigo-500/10 text-indigo-500'
                }`}>
                  <Activity size={18} />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tight group-hover:text-white transition-colors">{log.action}</h4>
                  <p className="text-xs text-slate-500 font-medium">{log.details}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-slate-400 font-mono">
                  {new Date(log.timestamp).toLocaleDateString()}
                </div>
                <div className="text-[10px] font-black text-slate-600 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MarketplaceView = () => {
  const { profile, logActivity } = useAuth();
  
  const handleLaunch = async (cat) => {
    await logActivity('Portal Launch', `Attempted to open tunnel for ${cat}`, 'info');
    window.open('https://portal.writingportal.com', '_blank');
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">Apex Marketplace</h1>
          <p className="text-slate-500 font-medium">Browse and launch your high-tier professional writing portals.</p>
        </div>
        <div className="flex bg-[#0a0a0a] rounded-2xl border border-white/5 p-1">
          <button className="px-6 py-2 rounded-xl bg-white/5 text-white text-xs font-black uppercase tracking-widest">All Available</button>
          <button className="px-6 py-2 rounded-xl text-slate-600 text-xs font-black uppercase tracking-widest hover:text-slate-400 transition-colors">My Gigs</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatCard label="Active Accounts" value={profile?.allowed_categories?.length || 0} icon={Globe} color="bg-indigo-600" />
        <StatCard label="Market Status" value="Healthy" icon={Activity} color="bg-emerald-600" />
        <StatCard label="Security Level" value="High" icon={ShieldCheck} color="bg-purple-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profile?.allowed_categories?.map((cat) => (
          <div key={cat} className="group bg-[#0a0a0a] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 p-4">
              <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-indigo-500/20">Active</span>
            </div>
            <div className="bg-white/5 w-16 h-16 rounded-3xl flex items-center justify-center mb-8 border border-white/5 group-hover:scale-110 transition-transform">
              <TrendingUp className="text-indigo-500" size={32} />
            </div>
            <h3 className="text-2xl font-black mb-2 leading-tight uppercase italic">{cat}</h3>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed flex-1">
              High-authority {cat} verified account with active project pipeline and secure login tunnel.
            </p>
            <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Portal</span>
              </div>
              <button 
                onClick={() => handleLaunch(cat)}
                className="flex items-center gap-2 bg-white text-black text-xs font-black px-5 py-3 rounded-2xl hover:bg-indigo-500 hover:text-white transition-all shadow-xl group-hover:translate-x-1"
              >
                LAUNCH <ExternalLink size={14}/>
              </button>
            </div>
          </div>
        ))}
        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-[2.5rem] border border-dashed border-white/10 p-8 flex flex-col items-center justify-center text-center opacity-70 hover:opacity-100 transition-opacity">
          <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="text-indigo-400" />
          </div>
          <h4 className="font-black text-lg mb-2 uppercase italic tracking-tighter">Expand Access</h4>
          <p className="text-xs text-slate-500 mb-6">Upgrade to Premium to unlock Academic and Mercor AI accounts.</p>
          <button className="text-xs font-black uppercase tracking-widest py-2 px-6 border border-white/10 rounded-full hover:bg-white hover:text-black transition-all">View Plans</button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('marketplace'); 
  const displayName = user?.user_metadata?.username || user?.email?.split('@')[0];
  
  return (
    <div className="min-h-screen bg-[#020202] text-white flex font-sans">
      <aside className="w-72 border-r border-white/5 flex flex-col p-8 bg-[#050505] fixed h-full z-10">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.4)]">
            <ShieldCheck size={24} />
          </div>
          <span className="text-xl font-black italic uppercase tracking-tighter">Apex Gigs</span>
        </div>

        <nav className="flex-1 space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-4 ml-2">Main Menu</p>
          <button 
            onClick={() => setActiveTab('marketplace')}
            className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${activeTab === 'marketplace' ? 'bg-white/5 text-white border border-white/5' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
          >
            <LayoutDashboard size={20} className={activeTab === 'marketplace' ? "text-indigo-500" : ""} /> Marketplace
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${activeTab === 'activity' ? 'bg-white/5 text-white border border-white/5' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
          >
            <Activity size={20} className={activeTab === 'activity' ? "text-indigo-500" : ""} /> Activity Log
          </button>
          <button className="w-full text-left flex items-center gap-4 p-4 rounded-2xl text-slate-500 font-bold hover:bg-white/5 hover:text-white transition-all">
            <Settings size={20} /> Settings
          </button>
        </nav>

        <div className="mt-auto">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 mb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Session ID</p>
            <p className="text-[10px] font-bold truncate text-slate-300 font-mono">{user?.id}</p>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400/70 font-bold hover:bg-red-500/10 hover:text-red-400 transition-all">
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-72 flex flex-col">
        <header className="h-24 border-b border-white/5 px-10 flex items-center justify-between sticky top-0 bg-[#020202]/80 backdrop-blur-md z-10">
          <div className="relative w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18}/>
            <input type="text" placeholder="Search accounts, tasks, or gigs..." className="w-full bg-white/5 border border-white/5 rounded-full py-3 pl-12 pr-6 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium" />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-3 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-colors relative">
              <Bell size={20} className="text-slate-400" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-black"></span>
            </button>
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-full border border-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 border border-white/10 flex items-center justify-center font-black text-[10px]">
                {displayName ? displayName[0]?.toUpperCase() : '?'}
              </div>
              <span className="text-xs font-bold mr-2">{displayName}</span>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto w-full">
          {activeTab === 'marketplace' ? <MarketplaceView /> : <ActivityLogView />}
        </div>
      </main>
    </div>
  );
};

const PaymentModal = ({ plan, onClose }) => {
  const { logActivity, finalizeSubscription, submitManualPayment } = useAuth();
  const [method, setMethod] = useState(null); 
  const [transactionCode, setTransactionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleManualMpesa = async (e) => {
    e.preventDefault();
    if (transactionCode.length < 10) return setError("Please enter a valid M-Pesa Transaction Code.");
    setLoading(true); setError('');
    try {
      await submitManualPayment(plan.id, transactionCode);
      setSuccess(true);
    } catch (err) { setError("Verification failed. Try again."); setLoading(false); }
  };

  const handlePayPal = async () => {
    await logActivity('PayPal Initiated', `User clicked checkout for $${plan.priceUsd}`, 'info');
    window.open(`https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${PAYPAL_EMAIL}&item_name=${plan.name}&amount=${plan.priceUsd}&currency_code=USD`, '_blank');
    onClose();
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      await finalizeSubscription(plan.id, 'DEMO_CREDIT');
      onClose();
    } catch (err) { setError(err.message); setLoading(false); }
  };

  const copyToClipboard = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/5 rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl p-10 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X /></button>
        <h3 className="font-black text-3xl mb-8 italic uppercase tracking-tighter text-white">Select Method</h3>
        
        {error && <div className="bg-red-500/10 text-red-500 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest mb-6 flex gap-2"><AlertCircle size={14}/> {error}</div>}
        
        {!method ? (
          <div className="space-y-4">
            <button onClick={() => setMethod('mpesa_manual')} className="w-full flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-green-500/50 transition-all font-black text-white group">
              <div className="flex items-center gap-4 text-lg"><Smartphone className="text-green-500" /> M-Pesa Direct</div>
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={handlePayPal} className="w-full flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-blue-500/50 transition-all font-black text-white group">
              <div className="flex items-center gap-4 text-lg"><DollarSign className="text-blue-500" /> PayPal</div>
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={handleDemo} className="w-full flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-indigo-500/50 transition-all font-black text-white group">
              <div className="flex items-center gap-4 text-lg"><Zap className="text-indigo-500" /> Instant Demo</div>
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ) : method === 'mpesa_manual' ? (
          success ? (
            <div className="text-center py-8">
              <Clock className="text-amber-500 mx-auto mb-4 animate-pulse" size={64} />
              <h4 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">Under Review</h4>
              <p className="text-slate-500 font-medium mb-8">Verification of code <span className="text-white font-mono">{transactionCode}</span> is in progress. Access will be granted shortly.</p>
              <button onClick={onClose} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase">Close Window</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-500/10 p-6 rounded-3xl border border-indigo-500/20">
                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-4">Instructions</p>
                <ol className="text-xs text-slate-300 space-y-3 font-medium">
                  <li className="flex gap-2">1. Go to M-Pesa menu or App</li>
                  <li className="flex gap-2">2. Select <span className="text-white font-bold">Send Money</span></li>
                  <li className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                    <span>Number: <span className="text-white font-mono">{PAYBILL_NUMBER}</span></span>
                    <button onClick={() => copyToClipboard(PAYBILL_NUMBER)} className="hover:text-indigo-500"><Copy size={14}/></button>
                  </li>
                  <li className="flex gap-2">3. Amount: <span className="text-white font-bold">KES {plan.priceKes.toLocaleString()}</span></li>
                  <li className="flex gap-2">4. Once sent, enter the Transaction Code below:</li>
                </ol>
              </div>

              <form onSubmit={handleManualMpesa} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Transaction Code</label>
                  <div className="relative">
                    <FileText className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                    <input 
                      type="text" 
                      value={transactionCode} 
                      onChange={e => setTransactionCode(e.target.value.toUpperCase())} 
                      placeholder="e.g. RBT82..." 
                      className="w-full bg-white/5 border border-white/5 p-5 pl-14 rounded-2xl text-white font-black outline-none focus:border-indigo-500 transition-all tracking-[0.2em]" 
                      required 
                    />
                  </div>
                </div>
                <button disabled={loading} className="w-full bg-white text-black py-5 rounded-2xl font-black flex items-center justify-center gap-2 text-lg disabled:opacity-50 uppercase">
                  {loading ? <Loader2 className="animate-spin" /> : <><Send size={18}/> Submit Code</>}
                </button>
                <button type="button" onClick={() => setMethod(null)} className="w-full text-slate-500 font-bold text-[10px] uppercase tracking-widest">Go Back</button>
              </form>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};

const SubscriptionPage = () => {
  const { logout } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  return (
    <div className="min-h-screen bg-[#050505] py-16 px-6 text-white flex flex-col items-center">
      <div className="w-full max-w-6xl flex justify-between items-center mb-16">
        <div className="flex items-center gap-2 text-indigo-500">
          <ShieldCheck size={32} />
          <span className="font-black text-2xl italic tracking-tighter uppercase">Apex Gigs</span>
        </div>
        <button onClick={logout} className="text-slate-500 font-black text-sm hover:text-red-500 transition-colors uppercase tracking-widest">LOGOUT</button>
      </div>
      <div className="text-center mb-16 max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-black mb-4 italic uppercase tracking-tighter">Choose Your Tier</h1>
        <p className="text-slate-500 font-medium">Select a plan to unlock high-authority writing accounts and professional portals tailored to your expertise.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl">
        {Object.values(PLANS).map(plan => (
          <div key={plan.id} className="bg-[#0a0a0a] p-10 rounded-[3rem] border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col shadow-2xl group">
            <div className={`${plan.color} w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-xl`}><Zap size={32}/></div>
            <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
            <p className="text-slate-500 text-sm mb-6">{plan.description}</p>
            <div className="mb-8">
               <div className="text-4xl font-black text-indigo-500">KES {plan.priceKes.toLocaleString()}</div>
               <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-1">Approx. ${plan.priceUsd} USD</div>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {plan.categories.map(cat => (
                <li key={cat} className="flex items-center gap-3 text-slate-400 font-bold text-sm">
                  <div className="bg-green-500/10 p-1 rounded-full"><Check size={14} className="text-green-500" /></div> {cat}
                </li>
              ))}
              <li className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                 <div className="p-1 rounded-full bg-slate-500/5"><Check size={14} className="text-slate-700" /></div> 24/7 Support Tunnel
              </li>
            </ul>
            <button onClick={() => setSelectedPlan(plan)} className="w-full py-6 rounded-2xl bg-white text-black font-black hover:bg-indigo-600 hover:text-white transition-all shadow-xl uppercase">Purchase Access</button>
          </div>
        ))}
      </div>
      {selectedPlan && <PaymentModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  );
};

const AuthGate = () => {
  const { user, profile, loading, login, register } = useAuth();
  const [view, setView] = useState('welcome');
  const [formErr, setFormErr] = useState('');
  const [btnLoading, setBtnLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
      <span className="text-slate-600 font-black tracking-widest text-[10px] uppercase">Connecting to Server</span>
    </div>
  );
  
  if (!user) {
    if (view === 'welcome') return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-between p-8 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50"></div>
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 relative z-10">
          <div className="bg-[#0a0a0a] p-8 rounded-[3rem] border border-white/5 shadow-2xl relative">
             <div className="absolute -inset-1 bg-indigo-500/20 blur-xl rounded-full"></div>
             <ShieldCheck size={64} className="text-indigo-500 relative z-10" />
          </div>
          <div className="space-y-4">
            <h1 className="text-7xl font-black italic uppercase tracking-tighter">Apex <span className="text-slate-600">Gigs</span></h1>
            <p className="text-slate-500 font-medium text-lg max-w-sm">Secure high-tier writing portal and verified account marketplace.</p>
          </div>
        </div>
        <button onClick={() => setView('login')} className="w-full max-w-md bg-white text-black py-6 rounded-full font-black text-xl flex items-center justify-center gap-3 mb-12 hover:bg-slate-200 transition-all uppercase tracking-tighter relative z-10">ENTER MARKETPLACE <ChevronRight /></button>
      </div>
    );

    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white font-sans overflow-y-auto">
        <button onClick={() => { setView('welcome'); setFormErr(''); }} className="absolute top-8 left-8 text-slate-600 hover:text-white font-black text-[10px] tracking-widest flex items-center gap-2 uppercase"> <ArrowLeft size={16}/> Back Home</button>
        <div className="w-full max-w-md py-12">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-2">{view === 'login' ? 'Partner Login' : 'Register Account'}</h2>
            <p className="text-slate-500 font-medium">{view === 'login' ? 'Verify your credentials to proceed.' : 'Join the elite marketplace today.'}</p>
          </div>
          <div className="bg-[#0a0a0a] border border-white/5 rounded-[3rem] p-10 shadow-2xl relative">
            <form onSubmit={async (e) => {
              e.preventDefault();
              setFormErr('');
              if (view === 'reg') {
                if (!username.trim()) return setFormErr('Username is required.');
                if (password.length < 6) return setFormErr('Security threshold not met: Password must be at least 6 characters.');
                if (password !== confirmPassword) return setFormErr('Validation failed: Passwords do not match.');
              }
              setBtnLoading(true);
              try {
                const { error } = view === 'login' ? await login(email, password) : await register(email, password, username);
                if (error) throw error;
              } catch (err) { setFormErr(err.message); } finally { setBtnLoading(false); }
            }} className="space-y-5">
              {view === 'reg' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Preferred Username</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. ApexWriter101" className="w-full bg-white/5 border border-white/5 p-5 pl-14 rounded-3xl text-white font-bold outline-none focus:border-indigo-500 transition-all" required />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="yourname@domain.com" className="w-full bg-white/5 border border-white/5 p-5 pl-14 rounded-3xl text-white font-bold outline-none focus:border-indigo-500 transition-all" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Security Password</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" className="w-full bg-white/5 border border-white/5 p-5 pl-14 rounded-3xl text-white font-bold outline-none focus:border-indigo-500 transition-all" required />
                </div>
              </div>
              {view === 'reg' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Confirm Password</label>
                  <div className="relative">
                    <ShieldAlert className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="w-full bg-white/5 border border-white/5 p-5 pl-14 rounded-3xl text-white font-bold outline-none focus:border-indigo-500 transition-all" required />
                  </div>
                </div>
              )}
              {formErr && <div className="bg-red-500/10 text-red-500 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">{formErr}</div>}
              <button disabled={btnLoading} className="w-full bg-white text-black py-5 rounded-3xl font-black text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2 mt-4 uppercase">
                {btnLoading ? <Loader2 className="animate-spin" /> : (view === 'login' ? 'Sign In' : 'Create Account')}
              </button>
              <button type="button" onClick={() => { setView(view === 'login' ? 'reg' : 'login'); setFormErr(''); }} className="w-full text-slate-500 font-bold text-xs pt-4 hover:text-white transition-colors">
                {view === 'login' ? "Don't have an account? Join Apex" : "Already a partner? Secure Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }
  
  return profile?.is_subscribed ? <Dashboard /> : <SubscriptionPage />;
};

export default function App() { 
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  ); 
}