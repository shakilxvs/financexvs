import { useState, useEffect, useRef } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, provider, db } from "./firebase";

const defaultData = { income: [], pending: [], expenses: [], plans: [] };
const EXPENSE_CATS = ["Food", "Transport", "Software", "Office", "Utilities", "Entertainment", "Other"];
const INCOME_CATS  = ["Project", "Salary", "Bonus", "Retainer", "Other"];
const PLAN_CATS    = ["Equipment", "Software", "Travel", "Education", "Marketing", "Office", "Other"];

function today() { return new Date().toISOString().split("T")[0]; }
function fmtAmt(n, currency, rate) {
  const num = Number(n) || 0;
  if (currency === "USD") return "$ " + (num / rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "৳ " + num.toLocaleString("en-BD");
}
async function loadFromCloud(uid) {
  try { const snap = await getDoc(doc(db, "users", uid)); return snap.exists() ? snap.data().finance : defaultData; }
  catch { return defaultData; }
}
async function saveToCloud(uid, data) {
  try { await setDoc(doc(db, "users", uid), { finance: data }, { merge: true }); }
  catch (e) { console.error("Save error:", e); }
}

// ─── SVG Icons ───────────────────────────────────────────────
function WalletIcon({ size = 18, color = "#00e5a0" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill={color} style={{ flexShrink: 0 }}>
      <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192H48c-8.8 0-16-7.2-16-16s7.2-16 16-16H448V96c0-35.3-28.7-64-64-64H64zM448 256v96H400c-26.5 0-48-21.5-48-48s21.5-48 48-48H448z"/>
    </svg>
  );
}
function BarsIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 448 512" fill={color} style={{ flexShrink: 0 }}>
      <path d="M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM64 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z"/>
    </svg>
  );
}

// ─── Themes ──────────────────────────────────────────────────
const THEMES = {
  dark: {
    pageBg: "#0d1117", headerBg: "rgba(13,33,55,0.85)", headerBorder: "rgba(30,58,95,0.8)",
    sectionBg: "rgba(255,255,255,0.03)", sectionBorder: "#1e3a5f",
    cardBg: "rgba(255,255,255,0.02)", cardBorder: "#1e3a5f",
    inputBg: "#0a1628", inputBorder: "#1e3a5f",
    text: "#e6edf3", subText: "#4a7fa5", dimText: "#6b8fa8",
    popupBg: "#0d2137", tabInactive: "#4a7fa5", tabBg: "rgba(255,255,255,0.05)",
  },
  light: {
    pageBg: "#eef2f7", headerBg: "rgba(255,255,255,0.88)", headerBorder: "rgba(180,210,240,0.8)",
    sectionBg: "rgba(255,255,255,0.85)", sectionBorder: "#c5d8ee",
    cardBg: "rgba(255,255,255,0.9)", cardBorder: "#c5d8ee",
    inputBg: "#ffffff", inputBorder: "#b0c8e0",
    text: "#1a2f45", subText: "#4a7fa5", dimText: "#5a8fba",
    popupBg: "#ffffff", tabInactive: "#5a8fba", tabBg: "rgba(0,0,0,0.06)",
  }
};

// ─── Confirm Popup ───────────────────────────────────────────
function ConfirmPopup({ message, onConfirm, onCancel, t }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: t.popupBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 32, maxWidth: 320, width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 8 }}>Are you sure?</div>
        <div style={{ fontSize: 13, color: t.subText, marginBottom: 28, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px", background: "transparent", border: `1px solid ${t.cardBorder}`, borderRadius: 12, color: t.subText, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "11px", background: "rgba(255,92,92,0.15)", border: "1px solid #ff5c5c60", borderRadius: 12, color: "#ff5c5c", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── 3-Dot Menu ──────────────────────────────────────────────
function ThreeDotMenu({ options, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "transparent", border: `1px solid ${t.cardBorder}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: t.subText, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>⋯</button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: t.popupBg, border: `1px solid ${t.cardBorder}`, borderRadius: 14, zIndex: 500, minWidth: 165, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", overflow: "hidden" }}>
          {options.map((opt, i) => (
            <button key={i} onClick={() => { opt.action(); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: "transparent", border: "none", color: opt.danger ? "#ff5c5c" : t.text, cursor: "pointer", fontSize: 13, fontWeight: opt.danger ? 700 : 500, borderBottom: i < options.length - 1 ? `1px solid ${t.cardBorder}` : "none", textAlign: "left" }}>
              <span>{opt.icon}</span>{opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hamburger Menu ──────────────────────────────────────────
function HamburgerMenu({ onLogout, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${t.headerBorder}`, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text }}>
        <BarsIcon size={16} color={t.text} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: t.popupBg, border: `1px solid ${t.cardBorder}`, borderRadius: 16, zIndex: 9999, minWidth: 180, boxShadow: "0 12px 40px rgba(0,0,0,0.35)", overflow: "hidden" }}>
          <a href="https://shakilxvs.wordpress.com/" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", color: t.text, textDecoration: "none", fontSize: 14, fontWeight: 500, borderBottom: `1px solid ${t.cardBorder}` }}>
            <span>💬</span> Support
          </a>
          <button onClick={() => { onLogout(); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "13px 18px", background: "transparent", border: "none", color: "#ff5c5c", cursor: "pointer", fontSize: 14, fontWeight: 700, textAlign: "left" }}>
            <span>🚪</span> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline Edit ─────────────────────────────────────────────
function InlineEdit({ item, fields, onSave, onCancel, t }) {
  const [vals, setVals] = useState(() => { const o = {}; fields.forEach(f => { o[f.key] = item[f.key] || ""; }); return o; });
  return (
    <div style={{ background: t.inputBg, border: `1px solid #00e5a040`, borderRadius: 12, padding: 16, marginTop: 12 }}>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: t.subText, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{f.label}</div>
          {f.type === "select"
            ? <select style={iSt(t)} value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}>{f.options.map(o => <option key={o}>{o}</option>)}</select>
            : <input style={iSt(t)} type={f.type || "text"} value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} />}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => onSave(vals)} style={{ ...bSt("#00e5a0"), padding: "7px 16px", fontSize: 12 }}>✅ Save</button>
        <button onClick={onCancel} style={{ ...bSt("#4a7fa5"), padding: "7px 16px", fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Currency Dropdown ────────────────────────────────────────
function CurrencyDropdown({ currency, setCurrency, rate, rateLoading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.35)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: "#00e5a0", fontSize: 12, fontWeight: 700 }}>
        <span style={{ fontSize: 14 }}>{currency === "BDT" ? "🇧🇩" : "🇺🇸"}</span>
        <span>{currency}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 14, zIndex: 9999, minWidth: 190, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", borderBottom: "1px solid #1e3a5f", fontSize: 10, color: "#4a7fa5" }}>{rateLoading ? "⏳ Fetching live rate..." : `🔴 Live · 1 USD = ৳ ${rate.toFixed(2)}`}</div>
          {[{ code: "BDT", flag: "🇧🇩", label: "Bangladeshi Taka" }, { code: "USD", flag: "🇺🇸", label: "US Dollar" }].map(c => (
            <button key={c.code} onClick={() => { setCurrency(c.code); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: currency === c.code ? "rgba(0,229,160,0.1)" : "transparent", border: "none", cursor: "pointer", color: currency === c.code ? "#00e5a0" : "#e6edf3", fontSize: 13, fontWeight: currency === c.code ? 700 : 400 }}>
              <span style={{ fontSize: 20 }}>{c.flag}</span>
              <div style={{ textAlign: "left" }}><div>{c.code}</div><div style={{ fontSize: 10, color: "#4a7fa5" }}>{c.label}</div></div>
              {currency === c.code && <span style={{ marginLeft: "auto" }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(null);
  const [data,        setData]        = useState(defaultData);
  const [tab,         setTab]         = useState("dashboard");
  const [syncing,     setSyncing]     = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currency,    setCurrency]    = useState("BDT");
  const [usdRate,     setUsdRate]     = useState(122);
  const [rateLoading, setRateLoading] = useState(true);
  const [theme,       setTheme]       = useState("dark");
  const [confirm,     setConfirm]     = useState(null);

  const t = THEMES[theme];

  useEffect(() => {
    async function fetchRate() {
      try { setRateLoading(true); const res = await fetch("https://open.er-api.com/v6/latest/USD"); const json = await res.json(); if (json?.rates?.BDT) setUsdRate(json.rates.BDT); }
      catch {} finally { setRateLoading(false); }
    }
    fetchRate();
    const iv = setInterval(fetchRate, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) { setSyncing(true); const cloud = await loadFromCloud(u.uid); setData({ ...defaultData, ...cloud }); setSyncing(false); }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => saveToCloud(user.uid, data), 800);
    return () => clearTimeout(timer);
  }, [data, user]);

  const login  = () => signInWithPopup(auth, provider);
  const logout = () => { signOut(auth); setData(defaultData); setTab("dashboard"); };
  const f = (n) => fmtAmt(n, currency, usdRate);

  const addItem    = (type, item)         => setData(d => ({ ...d, [type]: [item, ...d[type]] }));
  const updateItem = (type, id, fields)   => setData(d => ({ ...d, [type]: d[type].map(i => i.id === id ? { ...i, ...fields } : i) }));
  const deleteItem = (type, id)           => setData(d => ({ ...d, [type]: d[type].filter(i => i.id !== id) }));
  const confirmDelete = (type, id, name)  => setConfirm({ message: `"${name}" will be permanently deleted.`, onConfirm: () => { deleteItem(type, id); setConfirm(null); } });

  const markPaid = (id) => {
    const it = data.pending.find(p => p.id === id);
    if (!it) return;
    setData(d => ({ ...d, pending: d.pending.filter(p => p.id !== id), income: [{ ...it, id: Date.now(), date: today(), category: "Project", note: "From pending: " + it.client }, ...d.income] }));
  };
  const completePlan = (id, completionDate) => {
    const plan = data.plans.find(p => p.id === id);
    if (!plan) return;
    setData(d => ({ ...d, plans: d.plans.map(p => p.id === id ? { ...p, completed: true, completionDate } : p), expenses: [{ id: Date.now(), category: plan.category || "Other", amount: plan.budget, date: completionDate, note: "From plan: " + plan.title }, ...d.expenses] }));
  };

  const totalIncome   = data.income.reduce((s, i) => s + Number(i.amount), 0);
  const totalPending  = data.pending.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = data.expenses.reduce((s, i) => s + Number(i.amount), 0);
  const netBalance    = totalIncome - totalExpenses;
  const thisMonth     = new Date().toISOString().slice(0, 7);
  const monthIncome   = data.income.filter(i => i.date?.startsWith(thisMonth)).reduce((s, i) => s + Number(i.amount), 0);
  const monthExpenses = data.expenses.filter(i => i.date?.startsWith(thisMonth)).reduce((s, i) => s + Number(i.amount), 0);

  if (authLoading) return <Splash />;
  if (!user)       return <LoginScreen onGoogleLogin={login} />;

  const tabs = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "income",    label: "💚 Income" },
    { id: "pending",   label: "⏳ Pending" },
    { id: "expenses",  label: "🔴 Expenses" },
    { id: "plans",     label: "🎯 Plans" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, fontFamily: "'Segoe UI',system-ui,sans-serif", color: t.text, transition: "background 0.3s" }}>
      {confirm && <ConfirmPopup message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} t={t} />}

      {/* ── Floating Header ── */}
      <div style={{ padding: "14px 14px 0" }}>
        <div style={{ background: t.headerBg, border: `1px solid ${t.headerBorder}`, borderRadius: 18, padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", position: "sticky", top: 14, zIndex: 100 }}>
          {/* Left */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <WalletIcon size={20} color="#00e5a0" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#00e5a0", letterSpacing: "-0.5px", lineHeight: 1.2 }}>Finance Flow</div>
                <div style={{ fontSize: 10, color: t.subText }}>Personal finance manager</div>
              </div>
            </div>
            <CurrencyDropdown currency={currency} setCurrency={setCurrency} rate={usdRate} rateLoading={rateLoading} />
            {syncing && <div style={{ fontSize: 10, color: t.subText, background: "rgba(74,127,165,0.1)", border: `1px solid ${t.cardBorder}`, borderRadius: 99, padding: "2px 8px" }}>☁️ Syncing…</div>}
          </div>
          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", borderRadius: 10, padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "#00e5a0", whiteSpace: "nowrap" }}>Net: {f(netBalance)}</div>
            <button onClick={() => setTheme(th => th === "dark" ? "light" : "dark")} style={{ background: theme === "dark" ? "rgba(255,200,0,0.1)" : "rgba(100,150,255,0.15)", border: `1px solid ${theme === "dark" ? "#f0a50050" : "#6496ff50"}`, borderRadius: 9, padding: "6px 9px", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <img src={user.photoURL} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid #00e5a040", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: t.dimText, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName?.split(" ")[0]}</span>
            <HamburgerMenu onLogout={logout} t={t} />
          </div>
        </div>
      </div>

      {/* ── Tabs — centered on desktop, scrollable on mobile ── */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 14px 0" }}>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", background: t.tabBg, borderRadius: 14, padding: "5px 6px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{ background: tab === tb.id ? "rgba(0,229,160,0.18)" : "transparent", border: tab === tb.id ? "1px solid rgba(0,229,160,0.5)" : "1px solid transparent", color: tab === tb.id ? "#00e5a0" : t.tabInactive, borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: tab === tb.id ? 700 : 400, whiteSpace: "nowrap", transition: "all 0.2s", flexShrink: 0 }}>{tb.label}</button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "14px 14px 48px" }}>
        {tab === "dashboard" && <Dashboard totalIncome={totalIncome} totalPending={totalPending} totalExpenses={totalExpenses} netBalance={netBalance} monthIncome={monthIncome} monthExpenses={monthExpenses} data={data} userName={user.displayName?.split(" ")[0]} f={f} t={t} />}
        {tab === "income"    && <IncomeTab   data={data.income}   onAdd={i => addItem("income", i)}   onUpdate={(id, v) => updateItem("income", id, v)}   onDelete={(id, n) => confirmDelete("income", id, n)}   f={f} t={t} />}
        {tab === "pending"   && <PendingTab  data={data.pending}  onAdd={i => addItem("pending", i)}  onMarkPaid={markPaid} onUpdate={(id, v) => updateItem("pending", id, v)} onDelete={(id, n) => confirmDelete("pending", id, n)}  f={f} t={t} />}
        {tab === "expenses"  && <ExpensesTab data={data.expenses} onAdd={i => addItem("expenses", i)} onUpdate={(id, v) => updateItem("expenses", id, v)} onDelete={(id, n) => confirmDelete("expenses", id, n)} f={f} t={t} />}
        {tab === "plans"     && <PlansTab    data={data.plans}    onAdd={i => addItem("plans", i)}    onUpdate={(id, v) => updateItem("plans", id, v)}    onDelete={(id, n) => confirmDelete("plans", id, n)}    onComplete={completePlan} f={f} t={t} />}
      </div>
    </div>
  );
}

// ─── SPLASH ──────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0d1117", gap: 16 }}>
      <WalletIcon size={48} color="#00e5a0" />
      <div style={{ color: "#00e5a0", fontWeight: 800, fontSize: 22 }}>Finance Flow</div>
      <div style={{ color: "#4a7fa5", fontSize: 13 }}>Loading your data…</div>
    </div>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────
function LoginScreen({ onGoogleLogin }) {
  const [mode,     setMode]     = useState("signin"); // "signin" | "signup"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const friendlyError = (code) => {
    const map = {
      "auth/user-not-found":       "No account found with this email.",
      "auth/wrong-password":       "Incorrect password. Try again.",
      "auth/email-already-in-use": "This email is already registered. Sign in instead.",
      "auth/weak-password":        "Password must be at least 6 characters.",
      "auth/invalid-email":        "Please enter a valid email address.",
      "auth/too-many-requests":    "Too many attempts. Please try again later.",
      "auth/invalid-credential":   "Incorrect email or password.",
    };
    return map[code] || "Something went wrong. Please try again.";
  };

  const handleEmail = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      if (mode === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else                   await signInWithEmailAndPassword(auth, email, password);
    } catch (e) { setError(friendlyError(e.code)); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#0f1923 100%)", fontFamily: "'Segoe UI',system-ui,sans-serif", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 400, width: "100%" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <WalletIcon size={52} color="#00e5a0" />
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#00e5a0", letterSpacing: "-1px", marginBottom: 8 }}>Finance Flow</div>
        <div style={{ fontSize: 14, color: "#4a7fa5", marginBottom: 32, lineHeight: 1.6 }}>Your personal finance manager.<br />Track income, pending payments & expenses.</div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginBottom: 32 }}>
          {["💚 Track Income", "⏳ Pending Payments", "🔴 Daily Expenses", "🎯 Budget Plans", "☁️ Cloud Sync", "🔒 Private & Secure"].map(lbl => (
            <div key={lbl} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a5f", borderRadius: 99, padding: "4px 13px", fontSize: 11, color: "#6b8fa8" }}>{lbl}</div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a5f", borderRadius: 20, padding: "28px 24px" }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {["signin", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: "9px", background: mode === m ? "rgba(0,229,160,0.18)" : "transparent", border: mode === m ? "1px solid rgba(0,229,160,0.4)" : "1px solid transparent", borderRadius: 10, color: mode === m ? "#00e5a0" : "#4a7fa5", cursor: "pointer", fontSize: 13, fontWeight: mode === m ? 700 : 400, transition: "all 0.2s" }}>
                {m === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Email field */}
          <div style={{ marginBottom: 12, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "#4a7fa5", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>Email</div>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} placeholder="you@example.com" style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 10, color: "#e6edf3", padding: "11px 14px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
          </div>

          {/* Password field */}
          <div style={{ marginBottom: error ? 10 : 18, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "#4a7fa5", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>Password</div>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} placeholder={mode === "signup" ? "Min. 6 characters" : "Enter your password"} onKeyDown={e => e.key === "Enter" && handleEmail()} style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 10, color: "#e6edf3", padding: "11px 14px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
          </div>

          {/* Error */}
          {error && <div style={{ fontSize: 12, color: "#ff5c5c", background: "rgba(255,92,92,0.1)", border: "1px solid #ff5c5c30", borderRadius: 8, padding: "8px 12px", marginBottom: 14, textAlign: "left" }}>⚠️ {error}</div>}

          {/* Email button */}
          <button onClick={handleEmail} disabled={loading} style={{ width: "100%", padding: "13px", background: loading ? "rgba(0,229,160,0.1)" : "rgba(0,229,160,0.18)", border: "1px solid rgba(0,229,160,0.5)", borderRadius: 12, color: "#00e5a0", cursor: loading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, marginBottom: 14, transition: "all 0.2s" }}>
            {loading ? "Please wait…" : mode === "signup" ? "Create Account" : "Sign In"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: "#1e3a5f" }} />
            <div style={{ fontSize: 11, color: "#4a7fa5" }}>or</div>
            <div style={{ flex: 1, height: 1, background: "#1e3a5f" }} />
          </div>

          {/* Google button */}
          <button onClick={onGoogleLogin} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "13px 20px", background: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#1a1a1a", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <div style={{ fontSize: 11, color: "#2a4a65", marginTop: 16 }}>Join free today · Your data stays private · No credit card needed</div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────
function Dashboard({ totalIncome, totalPending, totalExpenses, netBalance, monthIncome, monthExpenses, data, userName, f, t }) {
  const activePlans = (data.plans || []).filter(p => !p.completed).length;
  const cards = [
    { label: "Total Income",    value: totalIncome,   color: "#00e5a0", icon: "💚" },
    { label: "Pending Payment", value: totalPending,  color: "#f0a500", icon: "⏳" },
    { label: "Total Expenses",  value: totalExpenses, color: "#ff5c5c", icon: "🔴" },
    { label: "Net Balance",     value: netBalance,    color: netBalance >= 0 ? "#00e5a0" : "#ff5c5c", icon: "💰" },
  ];
  const recentTx = [...(data.income||[]).map(i => ({ ...i, type: "income" })), ...(data.expenses||[]).map(i => ({ ...i, type: "expense" })), ...(data.pending||[]).map(i => ({ ...i, type: "pending" }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 18, marginTop: 6 }}>👋 Hey, {userName}! <span style={{ fontSize: 13, color: t.subText, fontWeight: 400, marginLeft: 10 }}>{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: `${c.color}12`, border: `1px solid ${c.color}30`, borderRadius: 18, padding: "20px 18px" }}>
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 10, color: t.subText, marginTop: 10, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.color, marginTop: 4 }}>{f(c.value)}</div>
          </div>
        ))}
      </div>
      {activePlans > 0 && <div style={{ background: "rgba(147,112,219,0.08)", border: "1px solid rgba(147,112,219,0.3)", borderRadius: 16, padding: "13px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }}>🎯</span>
        <div><div style={{ fontSize: 14, fontWeight: 700, color: "#9370db" }}>{activePlans} Active Plan{activePlans > 1 ? "s" : ""}</div><div style={{ fontSize: 12, color: t.subText }}>Budget plans in progress</div></div>
      </div>}
      <div style={{ background: t.sectionBg, border: `1px solid ${t.sectionBorder}`, borderRadius: 18, padding: 20, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📅 This Month</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[["EARNED", monthIncome, "#00e5a0"], ["SPENT", monthExpenses, "#ff5c5c"], ["SAVED", monthIncome - monthExpenses, monthIncome - monthExpenses >= 0 ? "#00e5a0" : "#ff5c5c"]].map(([l, v, c]) => (
            <div key={l}><div style={{ fontSize: 11, color: t.subText }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c }}>{f(v)}</div></div>
          ))}
        </div>
        {monthIncome > 0 && <div style={{ marginTop: 14 }}><div style={{ background: t.sectionBorder, borderRadius: 99, height: 8, overflow: "hidden" }}><div style={{ width: Math.min(100, (monthExpenses / monthIncome) * 100) + "%", background: monthExpenses / monthIncome > 0.8 ? "#ff5c5c" : "#00e5a0", height: "100%", borderRadius: 99, transition: "width 0.6s" }} /></div><div style={{ fontSize: 11, color: t.subText, marginTop: 5 }}>{Math.round((monthExpenses / monthIncome) * 100)}% of income spent</div></div>}
      </div>
      <div style={{ background: t.sectionBg, border: `1px solid ${t.sectionBorder}`, borderRadius: 18, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🕐 Recent Transactions</div>
        {recentTx.length === 0 && <div style={{ color: t.subText, fontSize: 13 }}>No transactions yet. Add some!</div>}
        {recentTx.map(tx => (
          <div key={tx.id + tx.type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${t.sectionBorder}` }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{tx.type === "income" ? "💚" : tx.type === "pending" ? "⏳" : "🔴"} {tx.client || tx.category || "—"}</div><div style={{ fontSize: 11, color: t.subText }}>{tx.date}</div></div>
            <div style={{ fontWeight: 800, fontSize: 14, color: tx.type === "income" ? "#00e5a0" : tx.type === "pending" ? "#f0a500" : "#ff5c5c" }}>{tx.type === "expense" ? "−" : "+"}{f(tx.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── INCOME TAB ───────────────────────────────────────────────
function IncomeTab({ data, onAdd, onUpdate, onDelete, f, t }) {
  const [form, setForm]     = useState({ client: "", amount: "", date: today(), category: "Project", note: "" });
  const [show, setShow]     = useState(false);
  const [editId, setEditId] = useState(null);
  const submit = () => { if (!form.client || !form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ client: "", amount: "", date: today(), category: "Project", note: "" }); setShow(false); };
  const total = data.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>💚 Income</div>
        <button onClick={() => setShow(!show)} style={bSt("#00e5a0")}>+ Add Income</button>
      </div>
      <div style={{ fontSize: 13, color: "#00e5a0", fontWeight: 700, marginBottom: 18 }}>Total Income: {f(total)}</div>
      {show && <FormCard color="#00e5a0" t={t}>
        <FR label="Client / Source" t={t}><input style={iSt(t)} value={form.client} onChange={e => setForm(v => ({ ...v, client: e.target.value }))} placeholder="e.g. Fiverr Client" /></FR>
        <FR label="Amount (৳ BDT)" t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} placeholder="5000" /></FR>
        <FR label="Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></FR>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>{INCOME_CATS.map(c => <option key={c}>{c}</option>)}</select></FR>
        <FR label="Note (optional)" t={t}><input style={iSt(t)} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. Logo design project" /></FR>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}><button onClick={submit} style={bSt("#00e5a0")}>✅ Save</button><button onClick={() => setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {data.length === 0 && !show && <ES t={t} text="No income yet. Add your first!" />}
      {data.map(item => (
        <Card key={item.id} color="#00e5a0" t={t}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{item.client}</div><div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{item.date} · {item.category}{item.note ? " · " + item.note : ""}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10 }}>
              <div style={{ fontWeight: 800, color: "#00e5a0", fontSize: 15, whiteSpace: "nowrap" }}>{f(item.amount)}</div>
              <ThreeDotMenu t={t} options={[{ icon: "✏️", label: "Edit", action: () => setEditId(editId === item.id ? null : item.id) }, { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.client) }]} />
            </div>
          </div>
          {editId === item.id && <InlineEdit t={t} item={item} fields={[{ key: "client", label: "Client / Source" }, { key: "amount", label: "Amount (৳ BDT)", type: "number" }, { key: "date", label: "Date", type: "date" }, { key: "category", label: "Category", type: "select", options: INCOME_CATS }, { key: "note", label: "Note" }]} onSave={v => { onUpdate(item.id, v); setEditId(null); }} onCancel={() => setEditId(null)} />}
        </Card>
      ))}
    </div>
  );
}

// ─── PENDING TAB ─────────────────────────────────────────────
function PendingTab({ data, onAdd, onMarkPaid, onUpdate, onDelete, f, t }) {
  const [form, setForm]     = useState({ client: "", amount: "", date: today(), dueDate: "", note: "" });
  const [show, setShow]     = useState(false);
  const [editId, setEditId] = useState(null);
  const submit = () => { if (!form.client || !form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ client: "", amount: "", date: today(), dueDate: "", note: "" }); setShow(false); };
  const total = data.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>⏳ Pending</div>
        <button onClick={() => setShow(!show)} style={bSt("#f0a500")}>+ Add Pending</button>
      </div>
      <div style={{ fontSize: 13, color: "#f0a500", fontWeight: 700, marginBottom: 18 }}>Total Awaiting: {f(total)}</div>
      {show && <FormCard color="#f0a500" t={t}>
        <FR label="Client Name" t={t}><input style={iSt(t)} value={form.client} onChange={e => setForm(v => ({ ...v, client: e.target.value }))} placeholder="e.g. XYZ Company" /></FR>
        <FR label="Amount (৳ BDT)" t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} placeholder="10000" /></FR>
        <FR label="Invoice Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></FR>
        <FR label="Due Date" t={t}><input style={iSt(t)} type="date" value={form.dueDate} onChange={e => setForm(v => ({ ...v, dueDate: e.target.value }))} /></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. Website project final payment" /></FR>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}><button onClick={submit} style={bSt("#f0a500")}>✅ Save</button><button onClick={() => setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {data.length === 0 && !show && <ES t={t} text="No pending payments 🎉 All clear!" />}
      {data.map(item => {
        const overdue = item.dueDate && new Date(item.dueDate) < new Date();
        return (
          <div key={item.id} style={{ background: "rgba(240,165,0,0.07)", border: `1px solid ${overdue ? "#ff5c5c50" : "#f0a50035"}`, borderRadius: 14, padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{item.client}</div>
                {item.note && <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>{item.note}</div>}
                <div style={{ fontSize: 11, color: t.subText, marginTop: 3 }}>Invoice: {item.date}{item.dueDate && <span style={{ color: overdue ? "#ff5c5c" : t.subText, marginLeft: 8 }}>{overdue ? "⚠️ Overdue: " : "Due: "}{item.dueDate}</span>}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 6 }}>
                <div style={{ fontWeight: 800, color: "#f0a500", fontSize: 15, whiteSpace: "nowrap" }}>{f(item.amount)}</div>
                <ThreeDotMenu t={t} options={[{ icon: "✅", label: "Mark as Paid", action: () => onMarkPaid(item.id) }, { icon: "✏️", label: "Edit", action: () => setEditId(editId === item.id ? null : item.id) }, { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.client) }]} />
              </div>
            </div>
            {editId === item.id && <InlineEdit t={t} item={item} fields={[{ key: "client", label: "Client Name" }, { key: "amount", label: "Amount (৳ BDT)", type: "number" }, { key: "date", label: "Invoice Date", type: "date" }, { key: "dueDate", label: "Due Date", type: "date" }, { key: "note", label: "Note" }]} onSave={v => { onUpdate(item.id, v); setEditId(null); }} onCancel={() => setEditId(null)} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── EXPENSES TAB ─────────────────────────────────────────────
function ExpensesTab({ data, onAdd, onUpdate, onDelete, f, t }) {
  const [form, setForm]           = useState({ category: "Food", amount: "", date: today(), note: "" });
  const [show, setShow]           = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [mFilter, setMFilter]     = useState("All");
  const [editId, setEditId]       = useState(null);
  const submit = () => { if (!form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ category: "Food", amount: "", date: today(), note: "" }); setShow(false); };
  const months   = ["All", ...Array.from(new Set(data.map(i => i.date?.slice(0, 7)).filter(Boolean))).sort().reverse()];
  const filtered = data.filter(i => (catFilter === "All" || i.category === catFilter) && (mFilter === "All" || i.date?.startsWith(mFilter)));
  const filtTotal = filtered.reduce((s, i) => s + Number(i.amount), 0);
  const pMonth = m => m === "All" ? "All Months" : new Date(m + "-01").toLocaleString("default", { month: "short", year: "numeric" });
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🔴 Expenses</div>
        <button onClick={() => setShow(!show)} style={bSt("#ff5c5c")}>+ Add Expense</button>
      </div>
      {show && <FormCard color="#ff5c5c" t={t}>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>{EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></FR>
        <FR label="Amount (৳ BDT)" t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} placeholder="500" /></FR>
        <FR label="Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. Lunch with client" /></FR>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}><button onClick={submit} style={bSt("#ff5c5c")}>✅ Save</button><button onClick={() => setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      <Pills label="📅 Month" values={months} active={mFilter} setActive={setMFilter} color="#00e5a0" pretty={pMonth} t={t} />
      <Pills label="🏷 Category" values={["All", ...EXPENSE_CATS]} active={catFilter} setActive={setCatFilter} color="#ff5c5c" t={t} />
      {filtered.length > 0 && <div style={{ fontSize: 13, color: "#ff5c5c", marginBottom: 12, fontWeight: 700 }}>Showing {filtered.length} · Total: {f(filtTotal)}</div>}
      {filtered.length === 0 && <ES t={t} text="No expenses here. Great job! 🎉" />}
      {filtered.map(item => (
        <Card key={item.id} color="#ff5c5c" t={t}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{item.category}</div><div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{item.date}{item.note ? " · " + item.note : ""}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10 }}>
              <div style={{ fontWeight: 800, color: "#ff5c5c", fontSize: 15, whiteSpace: "nowrap" }}>{f(item.amount)}</div>
              <ThreeDotMenu t={t} options={[{ icon: "✏️", label: "Edit", action: () => setEditId(editId === item.id ? null : item.id) }, { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.category) }]} />
            </div>
          </div>
          {editId === item.id && <InlineEdit t={t} item={item} fields={[{ key: "category", label: "Category", type: "select", options: EXPENSE_CATS }, { key: "amount", label: "Amount (৳ BDT)", type: "number" }, { key: "date", label: "Date", type: "date" }, { key: "note", label: "Note" }]} onSave={v => { onUpdate(item.id, v); setEditId(null); }} onCancel={() => setEditId(null)} />}
        </Card>
      ))}
    </div>
  );
}

// ─── PLANS TAB ───────────────────────────────────────────────
function PlansTab({ data, onAdd, onUpdate, onDelete, onComplete, f, t }) {
  const [form, setForm]                 = useState({ title: "", budget: "", category: "Equipment", dueDate: "", note: "" });
  const [show, setShow]                 = useState(false);
  const [editId, setEditId]             = useState(null);
  const [completeId, setCompleteId]     = useState(null);
  const [completeDate, setCompleteDate] = useState(today());
  const submit = () => { if (!form.title || !form.budget) return; onAdd({ ...form, id: Date.now(), completed: false }); setForm({ title: "", budget: "", category: "Equipment", dueDate: "", note: "" }); setShow(false); };
  const active    = data.filter(p => !p.completed);
  const completed = data.filter(p => p.completed);
  const totalBudget = active.reduce((s, p) => s + Number(p.budget), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🎯 Plans</div>
        <button onClick={() => setShow(!show)} style={bSt("#9370db")}>+ Add Plan</button>
      </div>
      <div style={{ fontSize: 13, color: "#9370db", fontWeight: 700, marginBottom: 18 }}>Total Budget: {f(totalBudget)}</div>
      {show && <FormCard color="#9370db" t={t}>
        <FR label="Plan Title" t={t}><input style={iSt(t)} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="e.g. Buy new MacBook" /></FR>
        <FR label="Budget (৳ BDT)" t={t}><input style={iSt(t)} type="number" value={form.budget} onChange={e => setForm(v => ({ ...v, budget: e.target.value }))} placeholder="150000" /></FR>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>{PLAN_CATS.map(c => <option key={c}>{c}</option>)}</select></FR>
        <FR label="Target Date" t={t}><input style={iSt(t)} type="date" value={form.dueDate} onChange={e => setForm(v => ({ ...v, dueDate: e.target.value }))} /></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. For video editing work" /></FR>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}><button onClick={submit} style={bSt("#9370db")}>✅ Save</button><button onClick={() => setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {completeId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.popupBg, border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 30, maxWidth: 320, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", textAlign: "center" }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 6 }}>Mark as Completed!</div>
            <div style={{ fontSize: 13, color: t.subText, marginBottom: 20 }}>This will add the budget as an expense.</div>
            <FR label="Completion Date" t={t}><input type="date" value={completeDate} onChange={e => setCompleteDate(e.target.value)} style={{ ...iSt(t), width: "100%" }} /></FR>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setCompleteId(null)} style={{ flex: 1, padding: "11px", background: "transparent", border: `1px solid ${t.cardBorder}`, borderRadius: 12, color: t.subText, cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={() => { onComplete(completeId, completeDate); setCompleteId(null); }} style={{ flex: 1, padding: "11px", background: "rgba(0,229,160,0.15)", border: "1px solid #00e5a060", borderRadius: 12, color: "#00e5a0", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✅ Confirm</button>
            </div>
          </div>
        </div>
      )}
      {active.length === 0 && !show && <ES t={t} text="No plans yet. Add your first budget plan! 🎯" />}
      {active.map(item => (
        <div key={item.id} style={{ background: "rgba(147,112,219,0.07)", border: "1px solid rgba(147,112,219,0.28)", borderRadius: 14, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{item.title}</div>
              <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{item.category}{item.note ? " · " + item.note : ""}</div>
              {item.dueDate && <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>🗓 Target: {item.dueDate}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 6 }}>
              <div style={{ fontWeight: 800, color: "#9370db", fontSize: 15, whiteSpace: "nowrap" }}>{f(item.budget)}</div>
              <ThreeDotMenu t={t} options={[{ icon: "✅", label: "Mark Complete", action: () => { setCompleteId(item.id); setCompleteDate(today()); } }, { icon: "✏️", label: "Edit", action: () => setEditId(editId === item.id ? null : item.id) }, { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.title) }]} />
            </div>
          </div>
          {editId === item.id && <InlineEdit t={t} item={item} fields={[{ key: "title", label: "Plan Title" }, { key: "budget", label: "Budget (৳ BDT)", type: "number" }, { key: "category", label: "Category", type: "select", options: PLAN_CATS }, { key: "dueDate", label: "Target Date", type: "date" }, { key: "note", label: "Note" }]} onSave={v => { onUpdate(item.id, v); setEditId(null); }} onCancel={() => setEditId(null)} />}
        </div>
      ))}
      {completed.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12, color: t.subText, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>✅ Completed Plans</div>
          {completed.map(item => (
            <div key={item.id} style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "12px 16px", marginBottom: 8, opacity: 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontWeight: 600, fontSize: 14, color: t.text, textDecoration: "line-through" }}>{item.title}</div><div style={{ fontSize: 11, color: t.subText }}>Completed: {item.completionDate}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#00e5a0" }}>{f(item.budget)}</div>
                  <ThreeDotMenu t={t} options={[{ icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.title) }]} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SHARED ──────────────────────────────────────────────────
function Card({ children, color, t }) { return <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderLeft: `3px solid ${color}`, borderRadius: 14, padding: "13px 16px", marginBottom: 9 }}>{children}</div>; }
function FormCard({ children, color, t }) { return <div style={{ background: t.sectionBg, border: `1px solid ${color}40`, borderRadius: 16, padding: 20, marginBottom: 20 }}>{children}</div>; }
function FR({ label, children, t }) { return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, color: t.subText, marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>{children}</div>; }
function ES({ text, t }) { return <div style={{ textAlign: "center", padding: "48px 20px", color: t.subText, fontSize: 14, border: `1px dashed ${t.cardBorder}`, borderRadius: 16 }}>{text}</div>; }
function Pills({ label, values, active, setActive, color, pretty, t }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: t.subText, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {values.map(v => <button key={v} onClick={() => setActive(v)} style={{ background: active === v ? `${color}22` : "transparent", border: `1px solid ${active === v ? color + "80" : t.cardBorder}`, color: active === v ? color : t.subText, borderRadius: 99, padding: "4px 13px", fontSize: 12, cursor: "pointer" }}>{pretty ? pretty(v) : v}</button>)}
      </div>
    </div>
  );
}
const iSt = (t) => ({ width: "100%", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 9, color: t.text, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" });
function bSt(color) { return { background: `${color}18`, border: `1px solid ${color}60`, color, borderRadius: 9, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s" }; }
