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
  CreditCard, DollarSign, Send, Copy, FileText, Users, Shield, CheckSquare, KeyRound
} from 'lucide-react';

const ADMIN_EMAILS = ['admin@writingportal.com', 'kipronoleleito594@gmail.com'];
const PAYBILL_NUMBER = "0781032460"; 
const PAYPAL_EMAIL = "payments@apexgigs.com";

const PLANS = {
  A1: { 
    id: 'A1', 
    name: 'Premium Tier', 
    priceKes: 28000, 
    priceUsd: 215,
    weeklyProfit: 12000,
    color: 'bg-purple-600', 
    categories: ['Online writing tasks', 'Academic writing tasks', 'Mercor AI tasks'],
    description: 'Elite access for high-volume writing professionals.'
  },
  A2: { 
    id: 'A2', 
    name: 'Standard Tier', 
    priceKes: 14500, 
    priceUsd: 112,
    weeklyProfit: 8500,
    color: 'bg-indigo-600', 
    categories: ['eBay tasks', 'Data entry tasks', 'Chat moderation'],
    description: 'Reliable accounts for consistent secondary income.'
  },
  A3: { 
    id: 'A3', 
    name: 'Basic Tier', 
    priceKes: 7500, 
    priceUsd: 58,
    weeklyProfit: 5500,
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
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(currentUser?.email && ADMIN_EMAILS.includes(currentUser.email));
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

  const logActivity = async (action, details, status = 'info', targetUserId = null) => {
    if (!client || !user) return;
    await client.from('activity_logs').insert({
      user_id: targetUserId || user.id,
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
    resetPassword: (email) => client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    }),
    updatePassword: (password) => client.auth.updateUser({ password }),
    logout: () => client.auth.signOut(),
    submitManualPayment: async (planId, transactionCode) => {
      await logActivity('Payment Proof Submitted', `M-Pesa Code: ${transactionCode} for ${planId}`, 'warning');
      return true;
    },
    finalizeSubscription: async (planId, method, targetUserId = null) => {
      const plan = PLANS[planId];
      const uid = targetUserId || user.id;
      const { error } = await client.from('profiles').upsert({ 
        id: uid, tier: planId, is_subscribed: true, 
        allowed_categories: plan.categories, payment_method: method, updated_at: new Date()
      });
      if (error) throw error;
      await logActivity('Subscription Finalized', `User upgraded to ${plan.name} via ${method}`, 'success', uid);
    }
  };

  if (configError) return <div className="p-20 text-center font-bold text-red-500">System Configuration Error</div>;
  return <AuthContext.Provider value={value}>{!client ? <div className="h-screen flex items-center justify-center bg-black"><Loader2 className="animate-spin text-indigo-600" /></div> : children}</AuthContext.Provider>;
};

const useAuth = () => useContext(AuthContext);

// --- Admin Components ---
const AdminPanel = () => {
  const { supabase, finalizeSubscription, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    const { data: activity, error: aErr } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    
    if (profiles) setUsers(profiles);
    if (activity) setLogs(activity);
    
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (userId, planId) => {
    setProcessingId(userId);
    try {
      await finalizeSubscription(planId, 'ADMIN_MANUAL', userId);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2 flex items-center gap-3">
            <Shield className="text-red-500" /> Command Center
          </h1>
          <p className="text-slate-500 font-medium">System-wide control for user approvals and auditing.</p>
        </div>
        <button 
          onClick={fetchData} 
          className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-white/10 transition-all font-black text-xs uppercase"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />} 
          Refresh Registry
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Management */}
        <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Users size={16}/> User Registry</h3>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded font-black">{users.length} TOTAL</span>
          </div>
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {users.length === 0 && !loading && (
              <div className="p-10 text-center text-slate-600 font-bold italic text-sm">No profiles detected. Ensure Table Permissions are active.</div>
            )}
            {users.map(u => (
              <div key={u.id} className={`p-6 flex items-center justify-between hover:bg-white/[0.02] ${u.id === user.id ? 'bg-indigo-500/5' : ''}`}>
                <div className="truncate pr-4">
                  <p className="text-xs font-mono text-slate-400 truncate">{u.id} {u.id === user.id && "(You)"}</p>
                  <p className="font-black text-sm uppercase italic">{u.tier || 'Pending Approval'}</p>
                </div>
                <div className="flex gap-2">
                  {!u.is_subscribed ? (
                    <div className="flex gap-1">
                      {['A3', 'A2', 'A1'].map(plan => (
                        <button 
                          key={plan}
                          onClick={() => handleApprove(u.id, plan)}
                          disabled={processingId === u.id}
                          className="px-3 py-1 bg-indigo-600 text-[10px] font-black rounded-lg hover:bg-white hover:text-black transition-all"
                        >
                          {processingId === u.id ? '...' : `ACTIVATE ${plan}`}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-emerald-500 text-[10px] font-black uppercase flex items-center gap-1">
                      <CheckCircle size={12}/> ACTIVE
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Activity */}
        <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-white/5 bg-white/5">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Activity size={16}/> Global System Logs</h3>
          </div>
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {logs.length === 0 && !loading && (
              <div className="p-10 text-center text-slate-600 font-bold italic text-sm">Activity feed empty.</div>
            )}
            {logs.map(log => (
              <div key={log.id} className="p-6 flex items-center justify-between text-xs hover:bg-white/[0.01]">
                <div>
                  <p className={`font-black uppercase tracking-tighter ${log.status === 'warning' ? 'text-amber-500' : log.status === 'success' ? 'text-emerald-400' : 'text-indigo-400'}`}>{log.action}</p>
                  <p className="text-slate-500 font-medium">{log.details}</p>
                  <p className="text-[8px] font-mono text-slate-700 mt-1">UID: {log.user_id}</p>
                </div>
                <p className="text-[10px] font-mono text-slate-700">{new Date(log.timestamp).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Views ---
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
  const { logout, user, isAdmin } = useAuth();
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

          {isAdmin && (
            <>
              <p className="text-[10px] font-black uppercase text-red-600/60 tracking-widest mt-8 mb-4 ml-2">Admin Tools</p>
              <button 
                onClick={() => setActiveTab('admin')}
                className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${activeTab === 'admin' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
              >
                <Shield size={20} /> Command Center
              </button>
            </>
          )}
        </nav>

        <div className="mt-auto">
          <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-400/70 font-bold hover:bg-red-500/10 hover:text-red-400 transition-all">
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-72 flex flex-col">
        <header className="h-24 border-b border-white/5 px-10 flex items-center justify-between sticky top-0 bg-[#020202]/80 backdrop-blur-md z-10">
          <div className="relative w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18}/>
            <input type="text" placeholder="Search accounts..." className="w-full bg-white/5 border border-white/5 rounded-full py-3 pl-12 pr-6 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-full border border-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 border border-white/10 flex items-center justify-center font-black text-[10px]">
                {displayName ? displayName[0]?.toUpperCase() : '?'}
              </div>
              <span className="text-xs font-bold mr-2">{displayName} {isAdmin && "(Admin)"}</span>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto w-full">
          {activeTab === 'marketplace' && <MarketplaceView />}
          {activeTab === 'activity' && <ActivityLogView />}
          {activeTab === 'admin' && <AdminPanel />}
        </div>
      </main>
    </div>
  );
};

// --- Modals & Overlays ---
const PaymentModal = ({ plan, onClose }) => {
  const { logActivity, submitManualPayment } = useAuth();
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
            <button className="w-full flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 opacity-50 cursor-not-allowed font-black text-white group">
              <div className="flex items-center gap-4 text-lg"><DollarSign className="text-blue-500" /> PayPal (Offline)</div>
            </button>
          </div>
        ) : method === 'mpesa_manual' ? (
          success ? (
            <div className="text-center py-8">
              <Clock className="text-amber-500 mx-auto mb-4 animate-pulse" size={64} />
              <h4 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">Under Review</h4>
              <p className="text-slate-500 font-medium mb-8">Verification of code <span className="text-white font-mono">{transactionCode}</span> is in progress. An administrator will activate your access shortly.</p>
              <button onClick={onClose} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase">Close Window</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-500/10 p-6 rounded-3xl border border-indigo-500/20">
                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-4">Instructions</p>
                <ol className="text-xs text-slate-300 space-y-3 font-medium">
                  <li className="flex gap-2">1. Send Money to <span className="text-white font-mono">{PAYBILL_NUMBER}</span></li>
                  <li className="flex gap-2">2. Amount: <span className="text-white font-bold">KES {plan.priceKes.toLocaleString()}</span></li>
                  <li className="flex gap-2">3. Once sent, enter the Transaction Code below:</li>
                </ol>
              </div>

              <form onSubmit={handleManualMpesa} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Transaction Code</label>
                  <input 
                    type="text" 
                    value={transactionCode} 
                    onChange={e => setTransactionCode(e.target.value.toUpperCase())} 
                    placeholder="e.g. RBT82..." 
                    className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-white font-black outline-none focus:border-indigo-500 transition-all tracking-[0.2em]" 
                    required 
                  />
                </div>
                <button disabled={loading} className="w-full bg-white text-black py-5 rounded-2xl font-black flex items-center justify-center gap-2 text-lg disabled:opacity-50 uppercase">
                  {loading ? <Loader2 className="animate-spin" /> : <><Send size={18}/> Submit Code</>}
                </button>
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
            <div className="mb-4">
               <div className="text-sm font-black uppercase text-slate-500 tracking-widest mb-1">Cost</div>
               <div className="text-3xl font-black text-white">KES {plan.priceKes.toLocaleString()}</div>
            </div>
            <div className="mb-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
               <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">Weekly Profit Goal</div>
               <div className="text-2xl font-black text-emerald-400">KES {plan.weeklyProfit.toLocaleString()} /wk</div>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {plan.categories.map(cat => (
                <li key={cat} className="flex items-center gap-3 text-slate-400 font-bold text-sm">
                  <div className="bg-green-500/10 p-1 rounded-full"><Check size={14} className="text-green-500" /></div> {cat}
                </li>
              ))}
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
  const { user, profile, loading, login, register, resetPassword, updatePassword } = useAuth();
  const [view, setView] = useState('welcome');
  const [formErr, setFormErr] = useState('');
  const [btnLoading, setBtnLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetSuccess, setIsResetSuccess] = useState(false);

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
        <button onClick={() => { setView('welcome'); setFormErr(''); setIsResetSuccess(false); }} className="absolute top-8 left-8 text-slate-600 hover:text-white font-black text-[10px] tracking-widest flex items-center gap-2 uppercase"> <ArrowLeft size={16}/> Back Home</button>
        <div className="w-full max-w-md py-12">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-2">
              {view === 'login' ? 'Partner Login' : view === 'reg' ? 'Register Account' : 'Reset Access'}
            </h2>
            <p className="text-slate-500 font-medium">
              {view === 'login' ? 'Verify your credentials to proceed.' : view === 'reg' ? 'Join the elite marketplace today.' : 'We will send a recovery link to your inbox.'}
            </p>
          </div>
          <div className="bg-[#0a0a0a] border border-white/5 rounded-[3rem] p-10 shadow-2xl relative">
            {isResetSuccess ? (
              <div className="text-center py-6 space-y-6">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Mail className="text-emerald-500" size={32} />
                </div>
                <div className="space-y-2">
                  <h4 className="font-black text-xl uppercase italic tracking-tighter">Link Dispatched</h4>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">Check your email for instructions to reset your password. The link expires in 1 hour.</p>
                </div>
                <button onClick={() => { setView('login'); setIsResetSuccess(false); }} className="w-full bg-white text-black py-4 rounded-3xl font-black uppercase text-sm">Return to Login</button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setFormErr('');
                setBtnLoading(true);
                try {
                  if (view === 'login') {
                    const { error } = await login(email, password);
                    if (error) throw error;
                  } else if (view === 'reg') {
                    if (!username.trim()) throw new Error('Username is required.');
                    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
                    if (password !== confirmPassword) throw new Error('Passwords do not match.');
                    const { error } = await register(email, password, username);
                    if (error) throw error;
                  } else {
                    const { error } = await resetPassword(email);
                    if (error) throw error;
                    setIsResetSuccess(true);
                  }
                } catch (err) { setFormErr(err.message); } finally { setBtnLoading(false); }
              }} className="space-y-5">
                {view === 'reg' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Username</label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="ApexWriter101" className="w-full bg-white/5 border border-white/5 p-5 rounded-3xl text-white font-bold outline-none focus:border-indigo-500 transition-all" required />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="yourname@domain.com" className="w-full bg-white/5 border border-white/5 p-5 rounded-3xl text-white font-bold outline-none focus:border-indigo-500 transition-all" required />
                </div>
                {view !== 'forgot' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-4 mr-2">
                      <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Password</label>
                      {view === 'login' && (
                        <button type="button" onClick={() => setView('forgot')} className="text-[10px] font-black uppercase text-indigo-500 hover:text-white transition-colors">Forgot?</button>
                      )}
                    </div>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" className="w-full bg-white/5 border border-white/5 p-5 rounded-3xl text-white font-bold outline-none focus:border-indigo-500 transition-all" required />
                  </div>
                )}
                {view === 'reg' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-600 ml-4 tracking-widest">Confirm Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="w-full bg-white/5 border border-white/5 p-5 rounded-3xl text-white font-bold outline-none focus:border-indigo-500 transition-all" required />
                  </div>
                )}
                {formErr && <div className="bg-red-500/10 text-red-500 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">{formErr}</div>}
                <button disabled={btnLoading} className="w-full bg-white text-black py-5 rounded-3xl font-black text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2 mt-4 uppercase">
                  {btnLoading ? <Loader2 className="animate-spin" /> : (view === 'login' ? 'Sign In' : view === 'reg' ? 'Create Account' : 'Dispatch Link')}
                </button>
                <button type="button" onClick={() => { setView(view === 'login' ? 'reg' : 'login'); setFormErr(''); }} className="w-full text-slate-500 font-bold text-xs pt-4 hover:text-white transition-colors">
                  {view === 'login' ? "Don't have an account? Join Apex" : "Already a partner? Secure Login"}
                </button>
              </form>
            )}
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