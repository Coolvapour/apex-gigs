import React, { useState, useEffect, createContext, useContext } from 'react';

// --- Configuration ---
const SUPABASE_URL = "https://zpmpbnjyapszxeprcnva.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwbXBibmp5YXBzenhlcHJjbnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODcwOTUsImV4cCI6MjA4MzU2MzA5NX0.hVTkhf3WglUUuiIHi6lkcyfBWBxWDBIfVt1yGJlK0Ow"; 

import { 
  CheckCircle, LayoutDashboard, LogOut, ShieldCheck, 
  Zap, Loader2, Check, TrendingUp, Smartphone, Send, 
  X, ArrowLeft, AlertCircle, RefreshCw, UserX
} from 'lucide-react';

const ADMIN_EMAILS = ['admin@writingportal.com', 'kipronoleleito594@gmail.com'];

const PLANS = {
  A1: { id: 'A1', name: 'Premium Tier', priceKes: 28000, color: 'bg-purple-600', categories: ['Online writing', 'Academic writing', 'Mercor AI'] },
  A2: { id: 'A2', name: 'Standard Tier', priceKes: 14500, color: 'bg-indigo-600', categories: ['eBay tasks', 'Data entry', 'Chat moderation'] },
  A3: { id: 'A3', name: 'Basic Tier', priceKes: 7500, color: 'bg-emerald-600', categories: ['Map reviews', 'Data annotation', 'Handshake AI'] }
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
      } catch (err) {
        setConfigError(true);
      }
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
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(currentUser?.email && ADMIN_EMAILS.includes(currentUser.email));
    });
    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!user || !client) {
      setProfile(null);
      return;
    }
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

  const value = {
    user, profile, loading, isAdmin, supabase: client,
    login: (email, password) => client.auth.signInWithPassword({ email, password }),
    register: (email, password) => client.auth.signUp({ email, password }),
    logout: () => client.auth.signOut(),
    triggerMpesaPush: async (planId, phone) => {
      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
      if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) formattedPhone = '254' + formattedPhone;
      const { data, error } = await client.functions.invoke('mpesa-push', {
        body: { planId, phone: formattedPhone, amount: PLANS[planId].priceKes, userId: user.id }
      });
      if (error) throw error;
      return data;
    },
    finalizeSubscription: async (planId, method) => {
      const plan = PLANS[planId];
      const { error } = await client.from('profiles').upsert({ 
        id: user.id, tier: planId, is_subscribed: true, 
        allowed_categories: plan.categories, payment_method: method, updated_at: new Date()
      });
      if (error) throw error;
    }
  };

  if (configError) return <div className="p-20 text-center font-bold text-red-500">Config Error: Check Supabase URL/Key</div>;
  return (
    <AuthContext.Provider value={value}>
      {!client ? <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div> : children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- Admin Component ---
const AdminUserList = () => {
  const { supabase } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const revokeAccess = async (userId) => {
    setActionLoading(userId);
    await supabase.from('profiles').update({ 
      is_subscribed: false, tier: null, allowed_categories: [] 
    }).eq('id', userId);
    await fetchUsers();
    setActionLoading(null);
  };

  return (
    <div className="mt-16 bg-white rounded-[2.5rem] p-8 border border-red-100 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase italic">
          <ShieldCheck className="text-red-600" /> Admin Console
        </h3>
        <button onClick={fetchUsers} className="text-slate-400 hover:text-indigo-600">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-50">
              <th className="pb-4 px-4">User ID</th>
              <th className="pb-4 px-4 text-center">Status</th>
              <th className="pb-4 px-4 text-center">Tier</th>
              <th className="pb-4 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0">
                <td className="py-4 px-4 font-medium text-xs text-slate-500 font-mono">{u.id}</td>
                <td className="py-4 px-4 text-center">
                  {u.is_subscribed ? 
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Active</span> : 
                    <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">Revoked</span>
                  }
                </td>
                <td className="py-4 px-4 text-center font-bold text-slate-800 text-xs">{u.tier || '-'}</td>
                <td className="py-4 px-4 text-right">
                  {u.is_subscribed && (
                    <button 
                      disabled={actionLoading === u.id}
                      onClick={() => revokeAccess(u.id)}
                      className="text-red-500 hover:text-red-700 font-bold text-xs inline-flex items-center gap-1"
                    >
                      {actionLoading === u.id ? <Loader2 className="animate-spin" size={12}/> : <UserX size={12} />} Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PaymentModal = ({ plan, onClose }) => {
  const { triggerMpesaPush, finalizeSubscription } = useAuth();
  const [method, setMethod] = useState(null); 
  const [phone, setPhone] = useState('2547');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleMpesa = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Initiating...');
    try {
      await triggerMpesaPush(plan.id, phone);
      setSuccess(true);
    } catch (err) {
      setError("M-Pesa STK Push Error.");
      setLoading(false);
    }
  };

  const handleDemoPayment = async () => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      await finalizeSubscription(plan.id, 'DEMO');
      onClose();
    } catch (err) { setError(err.message); setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-xl text-slate-800">Checkout</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
        </div>
        <div className="p-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-4">{error}</div>}
          {!method ? (
            <div className="space-y-3">
              <button onClick={() => setMethod('mpesa')} className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-green-500 hover:bg-green-50 transition font-bold"><div className="flex items-center gap-3"><Smartphone className="text-green-500" /> M-Pesa STK</div><CheckCircle className="text-slate-200" /></button>
              <button onClick={handleDemoPayment} className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition font-bold"><div className="flex items-center gap-3"><Zap className="text-indigo-600" /> Demo Unlock</div><CheckCircle className="text-slate-200" /></button>
            </div>
          ) : success ? (
            <div className="text-center py-6">
              <Check className="mx-auto text-green-500 mb-4" size={40} />
              <h4 className="font-black text-xl mb-2">PIN Prompt Sent</h4>
              <p className="text-slate-500 text-sm">Enter PIN on phone.</p>
            </div>
          ) : (
            <form onSubmit={handleMpesa} className="space-y-4">
              <input type="text" className="w-full p-4 rounded-2xl border-2 border-slate-100 outline-none" value={phone} onChange={e => setPhone(e.target.value)} />
              <button disabled={loading} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold">{loading ? status : 'Pay'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const SubscriptionPage = () => {
  const { logout } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <button onClick={logout} className="mb-8 flex items-center gap-2 text-slate-400 font-bold mx-auto hover:text-indigo-600"><ArrowLeft size={16}/> Sign Out</button>
        <h1 className="text-5xl font-black text-slate-900 mb-12 italic uppercase tracking-tighter">Apex Gigs</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.values(PLANS).map(plan => (
            <div key={plan.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
              <div className={`${plan.color} w-14 h-14 rounded-3xl flex items-center justify-center text-white mb-6 mx-auto`}><Zap /></div>
              <h3 className="text-2xl font-black mb-1">{plan.name}</h3>
              <div className="mb-8 font-black text-3xl text-indigo-600">KES {plan.priceKes.toLocaleString()}</div>
              <button onClick={() => setSelectedPlan(plan)} className="w-full py-5 rounded-2xl bg-slate-900 text-white font-black">Choose Plan</button>
            </div>
          ))}
        </div>
        {selectedPlan && <PaymentModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { profile, logout, user, isAdmin } = useAuth();
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-80 bg-slate-950 text-white p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-indigo-600 p-2 rounded-xl"><ShieldCheck size={24}/></div>
          <span className="text-xl font-black italic uppercase tracking-tighter">Apex Gigs</span>
        </div>
        <nav className="flex-1">
          <button className="w-full text-left flex items-center gap-3 p-4 rounded-2xl bg-indigo-600 font-bold"><LayoutDashboard size={20} /> Dashboard</button>
        </nav>
        <button onClick={logout} className="flex items-center gap-3 text-slate-500 font-bold p-4"><LogOut size={20} /> Sign Out</button>
      </aside>
      <main className="flex-1 p-8 md:p-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-black text-slate-900 mb-8 italic">Welcome back</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profile?.allowed_categories?.map(cat => (
              <div key={cat} className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
                <TrendingUp className="text-indigo-600 mb-4" />
                <h4 className="font-black text-slate-800 text-lg mb-2">{cat}</h4>
                <button className="text-sm font-bold text-indigo-600">Launch Portal</button>
              </div>
            ))}
          </div>
          {isAdmin && <AdminUserList />}
        </div>
      </main>
    </div>
  );
};

const AuthGate = () => {
  const { user, profile, loading, login, register } = useAuth();
  const [view, setView] = useState('login');
  const [formErr, setFormErr] = useState('');
  const [btnLoading, setBtnLoading] = useState(false);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-10">Apex Gigs</h1>
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-slate-100">
        <h2 className="text-3xl font-black mb-8 italic">{view === 'login' ? 'Login' : 'Register'}</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setFormErr(''); setBtnLoading(true);
          try {
            const { error } = view === 'login' ? await login(e.target.email.value, e.target.password.value) : await register(e.target.email.value, e.target.password.value);
            if (error) throw error;
          } catch (err) { setFormErr(err.message); } finally { setBtnLoading(false); }
        }} className="space-y-4">
          <input name="email" type="email" placeholder="Email" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold" required />
          <input name="password" type="password" placeholder="Password" className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold" required />
          {formErr && <p className="text-red-500 text-xs font-bold">{formErr}</p>}
          <button disabled={btnLoading} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg">
            {btnLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Continue'}
          </button>
          <button type="button" onClick={() => setView(view === 'login' ? 'reg' : 'login')} className="w-full text-slate-400 text-xs font-bold pt-2">
            {view === 'login' ? "New here? Register" : "Have account? Login"}
          </button>
        </form>
      </div>
    </div>
  );
  return profile?.is_subscribed ? <Dashboard /> : <SubscriptionPage />;
};

export default function App() { return <AuthProvider><AuthGate /></AuthProvider>; }