import { useState, useEffect, useRef } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, provider, db } from "./firebase";

const defaultData = { income: [], pending: [], expenses: [], plans: [] };
const EXPENSE_CATS = ["Food", "Transport", "Software", "Office", "Utilities", "Entertainment", "Other"];
const INCOME_CATS  = ["Project", "Salary", "Bonus", "Retainer", "Other"];
const PLAN_CATS    = ["Equipment", "Software", "Travel", "Education", "Marketing", "Office", "Other"];

function today() { return new Date().toISOString().split("T")[0]; }

function fmtAmt(n, currency, rate) {
  const num = Number(n) || 0;
  if (currency === "USD")
    return "$ " + (num / rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "৳ " + num.toLocaleString("en-BD");
}

async function loadFromCloud(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data().finance : defaultData;
  } catch { return defaultData; }
}
async function saveToCloud(uid, data) {
  try { await setDoc(doc(db, "users", uid), { finance: data }, { merge: true }); }
  catch (e) { console.error("Save error:", e); }
}

// ─── Theme ───────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "linear-gradient(135deg,#0d1117 0%,#0f1923 100%)",
    headerBg: "linear-gradient(90deg,#0d2137,#0a1628)",
    headerBorder: "#1e3a5f",
    tabBg: "#0a1628",
    cardBg: "rgba(255,255,255,0.02)",
    cardBorder: "#1e3a5f",
    inputBg: "#0a1628",
    inputBorder: "#1e3a5f",
    text: "#e6edf3",
    subText: "#4a7fa5",
    dimText: "#6b8fa8",
    popupBg: "#0d2137",
    sectionBg: "rgba(255,255,255,0.03)",
  },
  light: {
    bg: "linear-gradient(135deg,#f0f4f8 0%,#e8eef5 100%)",
    headerBg: "linear-gradient(90deg,#1a3a5c,#1e4a7a)",
    headerBorder: "#2a5a8f",
    tabBg: "#1e4a7a",
    cardBg: "rgba(255,255,255,0.9)",
    cardBorder: "#c5d8ee",
    inputBg: "#ffffff",
    inputBorder: "#b0c8e0",
    text: "#1a2f45",
    subText: "#4a7fa5",
    dimText: "#5a8fba",
    popupBg: "#ffffff",
    sectionBg: "rgba(255,255,255,0.8)",
  }
};

// ─── Confirm Popup ───────────────────────────────────────────
function ConfirmPopup({ message, onConfirm, onCancel, theme }) {
  const t = THEMES[theme];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: t.popupBg, border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: 28, maxWidth: 320, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 8 }}>Are you sure?</div>
        <div style={{ fontSize: 13, color: t.subText, marginBottom: 24, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${t.cardBorder}`, borderRadius: 10, color: t.subText, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px", background: "rgba(255,92,92,0.15)", border: "1px solid #ff5c5c60", borderRadius: 10, color: "#ff5c5c", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── 3-Dot Menu ──────────────────────────────────────────────
function ThreeDotMenu({ options, theme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const t = THEMES[theme];

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        background: "transparent", border: `1px solid ${t.cardBorder}`,
        borderRadius: 8, width: 32, height: 32, cursor: "pointer",
        color: t.subText, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s"
      }}>⋯</button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)",
          background: t.popupBg, border: `1px solid ${t.cardBorder}`,
          borderRadius: 12, zIndex: 500, minWidth: 160,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)", overflow: "hidden"
        }}>
          {options.map((opt, i) => (
            <button key={i} onClick={() => { opt.action(); setOpen(false); }} style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "11px 14px",
              background: "transparent", border: "none",
              color: opt.danger ? "#ff5c5c" : t.text,
              cursor: "pointer", fontSize: 13, fontWeight: opt.danger ? 700 : 500,
              borderBottom: i < options.length - 1 ? `1px solid ${t.cardBorder}` : "none",
              textAlign: "left"
            }}>
              <span>{opt.icon}</span> {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inline Edit Field ────────────────────────────────────────
function InlineEdit({ item, fields, onSave, onCancel, theme }) {
  const t = THEMES[theme];
  const [vals, setVals] = useState(() => {
    const obj = {};
    fields.forEach(f => { obj[f.key] = item[f.key] || ""; });
    return obj;
  });
  return (
    <div style={{ background: `${t.inputBg}`, border: `1px solid #00e5a040`, borderRadius: 10, padding: 14, marginTop: 10 }}>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: t.subText, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{f.label}</div>
          {f.type === "select" ? (
            <select style={{ ...iStyle(t), width: "100%" }} value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}>
              {f.options.map(o => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input style={{ ...iStyle(t), width: "100%" }} type={f.type || "text"} value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} />
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave(vals)} style={{ ...bStyle("#00e5a0"), padding: "6px 14px", fontSize: 12 }}>✅ Save</button>
        <button onClick={onCancel} style={{ ...bStyle("#4a7fa5"), padding: "6px 14px", fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Currency Dropdown ────────────────────────────────────────
function CurrencyDropdown({ currency, setCurrency, rate, rateLoading, theme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.3)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: "#00e5a0", fontSize: 12, fontWeight: 700 }}>
        <span style={{ fontSize: 15 }}>{currency === "BDT" ? "🇧🇩" : "🇺🇸"}</span>
        <span>{currency}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 12, zIndex: 999, minWidth: 190, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", borderBottom: "1px solid #1e3a5f", fontSize: 10, color: "#4a7fa5" }}>
            {rateLoading ? "⏳ Fetching live rate..." : `🔴 Live  ·  1 USD = ৳ ${rate.toFixed(2)}`}
          </div>
          {[{ code: "BDT", flag: "🇧🇩", label: "Bangladeshi Taka" }, { code: "USD", flag: "🇺🇸", label: "US Dollar" }].map(c => (
            <button key={c.code} onClick={() => { setCurrency(c.code); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: currency === c.code ? "rgba(0,229,160,0.1)" : "transparent", border: "none", cursor: "pointer", color: currency === c.code ? "#00e5a0" : "#e6edf3", fontSize: 13, fontWeight: currency === c.code ? 700 : 400 }}>
              <span style={{ fontSize: 20 }}>{c.flag}</span>
              <div style={{ textAlign: "left" }}><div>{c.code}</div><div style={{ fontSize: 10, color: "#4a7fa5" }}>{c.label}</div></div>
              {currency === c.code && <span style={{ marginLeft: "auto", color: "#00e5a0" }}>✓</span>}
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
  const [confirm,     setConfirm]     = useState(null); // { message, onConfirm }

  const t = THEMES[theme];

  useEffect(() => {
    async function fetchRate() {
      try {
        setRateLoading(true);
        const res  = await fetch("https://open.er-api.com/v6/latest/USD");
        const json = await res.json();
        if (json?.rates?.BDT) setUsdRate(json.rates.BDT);
      } catch {}
      finally { setRateLoading(false); }
    }
    fetchRate();
    const iv = setInterval(fetchRate, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setSyncing(true);
        const cloud = await loadFromCloud(u.uid);
        setData({ ...defaultData, ...cloud });
        setSyncing(false);
      }
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

  const addItem    = (type, item) => setData(d => ({ ...d, [type]: [item, ...d[type]] }));
  const updateItem = (type, id, fields) => setData(d => ({ ...d, [type]: d[type].map(i => i.id === id ? { ...i, ...fields } : i) }));
  const deleteItem = (type, id) => setData(d => ({ ...d, [type]: d[type].filter(i => i.id !== id) }));

  const confirmDelete = (type, id, name) => {
    setConfirm({
      message: `This will permanently delete "${name}". This cannot be undone.`,
      onConfirm: () => { deleteItem(type, id); setConfirm(null); }
    });
  };

  const markPaid = (id) => {
    const it = data.pending.find(p => p.id === id);
    if (!it) return;
    setData(d => ({
      ...d,
      pending: d.pending.filter(p => p.id !== id),
      income:  [{ ...it, id: Date.now(), date: today(), category: "Project", note: "From pending: " + it.client }, ...d.income],
    }));
  };

  const completePlan = (id, completionDate) => {
    const plan = data.plans.find(p => p.id === id);
    if (!plan) return;
    setData(d => ({
      ...d,
      plans:    d.plans.map(p => p.id === id ? { ...p, completed: true, completionDate } : p),
      expenses: [{ id: Date.now(), category: plan.category || "Other", amount: plan.budget, date: completionDate, note: "From plan: " + plan.title }, ...d.expenses],
    }));
  };

  const totalIncome   = data.income.reduce((s, i)   => s + Number(i.amount), 0);
  const totalPending  = data.pending.reduce((s, i)  => s + Number(i.amount), 0);
  const totalExpenses = data.expenses.reduce((s, i) => s + Number(i.amount), 0);
  const netBalance    = totalIncome - totalExpenses;
  const thisMonth     = new Date().toISOString().slice(0, 7);
  const monthIncome   = data.income.filter(i => i.date?.startsWith(thisMonth)).reduce((s, i) => s + Number(i.amount), 0);
  const monthExpenses = data.expenses.filter(i => i.date?.startsWith(thisMonth)).reduce((s, i) => s + Number(i.amount), 0);

  if (authLoading) return <Splash text="Starting Finance Flow..." theme={theme} />;
  if (!user)       return <LoginScreen onLogin={login} />;

  const tabs = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "income",    label: "💚 Income" },
    { id: "pending",   label: "⏳ Pending" },
    { id: "expenses",  label: "🔴 Expenses" },
    { id: "plans",     label: "🎯 Plans" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", color: t.text, transition: "all 0.3s" }}>
      {confirm && <ConfirmPopup message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} theme={theme} />}

      {/* Header */}
      <div style={{ background: t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 24px rgba(0,229,160,0.08)", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#00e5a0", letterSpacing: "-0.5px" }}>💰 Finance Flow</div>
            <div style={{ fontSize: 10, color: "#4a7fa5" }}>Personal finance manager</div>
          </div>
          <CurrencyDropdown currency={currency} setCurrency={setCurrency} rate={usdRate} rateLoading={rateLoading} theme={theme} />
          {syncing && <div style={{ fontSize: 11, color: "#4a7fa5", background: "rgba(74,127,165,0.1)", border: "1px solid #1e3a5f", borderRadius: 99, padding: "3px 10px" }}>☁️ Syncing…</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", borderRadius: 8, padding: "5px 12px", fontSize: 13, color: "#00e5a0" }}>
            Net: {f(netBalance)}
          </div>
          {/* Theme Toggle */}
          <button onClick={() => setTheme(th => th === "dark" ? "light" : "dark")} title="Toggle theme" style={{ background: theme === "dark" ? "rgba(255,200,0,0.1)" : "rgba(100,150,255,0.15)", border: `1px solid ${theme === "dark" ? "#f0a50050" : "#6496ff50"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 16, color: theme === "dark" ? "#f0a500" : "#6496ff" }}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <img src={user.photoURL} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid #00e5a040" }} />
          <span style={{ fontSize: 12, color: "#6b8fa8", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName?.split(" ")[0]}</span>
          <button onClick={logout} style={{ background: "rgba(255,92,92,0.1)", border: "1px solid #ff5c5c40", color: "#ff5c5c", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>Sign out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px", background: t.tabBg, borderBottom: `1px solid ${t.headerBorder}`, overflowX: "auto", scrollbarWidth: "none" }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ background: tab === tb.id ? "rgba(0,229,160,0.15)" : "transparent", border: tab === tb.id ? "1px solid rgba(0,229,160,0.5)" : "1px solid transparent", color: tab === tb.id ? "#00e5a0" : "#6b8fa8", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: tab === tb.id ? 700 : 400, whiteSpace: "nowrap", transition: "all 0.2s" }}>{tb.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>
        {tab === "dashboard" && <Dashboard totalIncome={totalIncome} totalPending={totalPending} totalExpenses={totalExpenses} netBalance={netBalance} monthIncome={monthIncome} monthExpenses={monthExpenses} data={data} userName={user.displayName?.split(" ")[0]} f={f} t={t} />}
        {tab === "income"    && <IncomeTab   data={data.income}   onAdd={i => addItem("income", i)}   onUpdate={(id, fields) => updateItem("income", id, fields)}   onDelete={(id, name) => confirmDelete("income", id, name)}   f={f} t={t} theme={theme} />}
        {tab === "pending"   && <PendingTab  data={data.pending}  onAdd={i => addItem("pending", i)}  onMarkPaid={markPaid} onUpdate={(id, fields) => updateItem("pending", id, fields)} onDelete={(id, name) => confirmDelete("pending", id, name)}  f={f} t={t} theme={theme} />}
        {tab === "expenses"  && <ExpensesTab data={data.expenses} onAdd={i => addItem("expenses", i)} onUpdate={(id, fields) => updateItem("expenses", id, fields)} onDelete={(id, name) => confirmDelete("expenses", id, name)} f={f} t={t} theme={theme} />}
        {tab === "plans"     && <PlansTab    data={data.plans}    onAdd={i => addItem("plans", i)}    onUpdate={(id, fields) => updateItem("plans", id, fields)}    onDelete={(id, name) => confirmDelete("plans", id, name)}    onComplete={completePlan} f={f} t={t} theme={theme} />}
      </div>
    </div>
  );
}

// ─── SPLASH ──────────────────────────────────────────────────
function Splash({ text, theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0d1117", gap: 16 }}>
      <div style={{ fontSize: 40 }}>💰</div>
      <div style={{ color: "#00e5a0", fontWeight: 800, fontSize: 20 }}>Finance Flow</div>
      <div style={{ color: "#4a7fa5", fontSize: 13 }}>{text}</div>
    </div>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#0f1923 100%)", fontFamily: "'Segoe UI',system-ui,sans-serif", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>💰</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#00e5a0", letterSpacing: "-1px", marginBottom: 8 }}>Finance Flow</div>
        <div style={{ fontSize: 15, color: "#4a7fa5", marginBottom: 40, lineHeight: 1.6 }}>Your personal finance manager.<br />Track income, pending payments & expenses.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {["💚 Track Income", "⏳ Pending Payments", "🔴 Daily Expenses", "🎯 Budget Plans", "☁️ Cloud Sync", "🔒 Private & Secure"].map(f => (
            <div key={f} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a5f", borderRadius: 99, padding: "5px 14px", fontSize: 12, color: "#6b8fa8" }}>{f}</div>
          ))}
        </div>
        <button onClick={onLogin} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "14px 24px", background: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#1a1a1a", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
        <div style={{ fontSize: 11, color: "#2a4a65", marginTop: 16 }}>Free forever · Your data stays private · No credit card needed</div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────
function Dashboard({ totalIncome, totalPending, totalExpenses, netBalance, monthIncome, monthExpenses, data, userName, f, t }) {
  const activePlans = (data.plans || []).filter(p => !p.completed).length;
  const cards = [
    { label: "Total Income",    value: totalIncome,   color: "#00e5a0", bg: "rgba(0,229,160,0.08)",   icon: "💚" },
    { label: "Pending Payment", value: totalPending,  color: "#f0a500", bg: "rgba(240,165,0,0.08)",   icon: "⏳" },
    { label: "Total Expenses",  value: totalExpenses, color: "#ff5c5c", bg: "rgba(255,92,92,0.08)",   icon: "🔴" },
    { label: "Net Balance",     value: netBalance,    color: netBalance >= 0 ? "#00e5a0" : "#ff5c5c", bg: netBalance >= 0 ? "rgba(0,229,160,0.08)" : "rgba(255,92,92,0.08)", icon: "💰" },
  ];
  const recentTx = [...(data.income||[]).map(i => ({ ...i, type: "income" })), ...(data.expenses||[]).map(i => ({ ...i, type: "expense" })), ...(data.pending||[]).map(i => ({ ...i, type: "pending" }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>👋 Hey, {userName}! <span style={{ fontSize: 13, color: t.subText, fontWeight: 400, marginLeft: 12 }}>{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12, marginBottom: 28 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}30`, borderRadius: 14, padding: "18px 16px" }}>
            <div style={{ fontSize: 22 }}>{c.icon}</div>
            <div style={{ fontSize: 10, color: t.subText, marginTop: 8, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: c.color, marginTop: 4 }}>{f(c.value)}</div>
          </div>
        ))}
      </div>
      {activePlans > 0 && (
        <div style={{ background: "rgba(147,112,219,0.08)", border: "1px solid rgba(147,112,219,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🎯</span>
          <div><div style={{ fontSize: 14, fontWeight: 700, color: "#9370db" }}>{activePlans} Active Plan{activePlans > 1 ? "s" : ""}</div><div style={{ fontSize: 12, color: t.subText }}>Budget plans awaiting completion</div></div>
        </div>
      )}
      <div style={{ background: t.sectionBg, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📅 This Month</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[["EARNED", monthIncome, "#00e5a0"], ["SPENT", monthExpenses, "#ff5c5c"], ["SAVED", monthIncome - monthExpenses, monthIncome - monthExpenses >= 0 ? "#00e5a0" : "#ff5c5c"]].map(([l, v, c]) => (
            <div key={l}><div style={{ fontSize: 11, color: t.subText }}>{l}</div><div style={{ fontSize: 20, fontWeight: 800, color: c }}>{f(v)}</div></div>
          ))}
        </div>
        {monthIncome > 0 && (<div style={{ marginTop: 16 }}><div style={{ background: t.cardBorder, borderRadius: 99, height: 8, overflow: "hidden" }}><div style={{ width: Math.min(100, (monthExpenses / monthIncome) * 100) + "%", background: monthExpenses / monthIncome > 0.8 ? "#ff5c5c" : "#00e5a0", height: "100%", borderRadius: 99, transition: "width 0.5s" }} /></div><div style={{ fontSize: 11, color: t.subText, marginTop: 4 }}>{Math.round((monthExpenses / monthIncome) * 100)}% of income spent</div></div>)}
      </div>
      <div style={{ background: t.sectionBg, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🕐 Recent Transactions</div>
        {recentTx.length === 0 && <div style={{ color: t.subText, fontSize: 13 }}>No transactions yet. Add some!</div>}
        {recentTx.map(tx => (
          <div key={tx.id + tx.type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{tx.type === "income" ? "💚" : tx.type === "pending" ? "⏳" : "🔴"} {tx.client || tx.category || "—"}</div><div style={{ fontSize: 11, color: t.subText }}>{tx.date}</div></div>
            <div style={{ fontWeight: 800, fontSize: 14, color: tx.type === "income" ? "#00e5a0" : tx.type === "pending" ? "#f0a500" : "#ff5c5c" }}>{tx.type === "expense" ? "−" : "+"}{f(tx.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── INCOME TAB ───────────────────────────────────────────────
function IncomeTab({ data, onAdd, onUpdate, onDelete, f, t, theme }) {
  const [form, setForm] = useState({ client: "", amount: "", date: today(), category: "Project", note: "" });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const submit = () => { if (!form.client || !form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ client: "", amount: "", date: today(), category: "Project", note: "" }); setShow(false); };
  const total = data.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>💚 Income</div>
        <button onClick={() => setShow(!show)} style={bStyle("#00e5a0")}>+ Add Income</button>
      </div>
      <div style={{ fontSize: 13, color: "#00e5a0", marginBottom: 20, fontWeight: 600 }}>Total Income: {f(total)}</div>
      {show && (<FormCard color="#00e5a0" t={t}>
        <FormRow label="Client / Source" t={t}><input style={iStyle(t)} value={form.client} onChange={e => setForm(v => ({ ...v, client: e.target.value }))} placeholder="e.g. Fiverr Client" /></FormRow>
        <FormRow label="Amount (৳ BDT)" t={t}><input style={iStyle(t)} type="number" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} placeholder="5000" /></FormRow>
        <FormRow label="Date" t={t}><input style={iStyle(t)} type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></FormRow>
        <FormRow label="Category" t={t}><select style={iStyle(t)} value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>{INCOME_CATS.map(c => <option key={c}>{c}</option>)}</select></FormRow>
        <FormRow label="Note (optional)" t={t}><input style={iStyle(t)} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. Logo design project" /></FormRow>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button onClick={submit} style={bStyle("#00e5a0")}>✅ Save</button><button onClick={() => setShow(false)} style={bStyle("#4a7fa5")}>Cancel</button></div>
      </FormCard>)}
      {data.length === 0 && !show && <EmptyState text="No income yet. Add your first!" t={t} />}
      {data.map(item => (
        <div key={item.id} style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderLeft: "3px solid #00e5a0", borderRadius: 10, padding: "12px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{item.client}</div>
              <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{item.date} · {item.category}{item.note ? " · " + item.note : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 800, color: "#00e5a0", fontSize: 15 }}>{f(item.amount)}</div>
              <ThreeDotMenu theme={theme} options={[
                { icon: "✏️", label: "Edit", action: () => setEditId(editId === item.id ? null : item.id) },
                { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.client) },
              ]} />
            </div>
          </div>
          {editId === item.id && (
            <InlineEdit theme={theme} item={item} fields={[
              { key: "client", label: "Client / Source" },
              { key: "amount", label: "Amount (৳ BDT)", type: "number" },
              { key: "date", label: "Date", type: "date" },
              { key: "category", label: "Category", type: "select", options: INCOME_CATS },
              { key: "note", label: "Note" },
            ]} onSave={(vals) => { onUpdate(item.id, vals); setEditId(null); }} onCancel={() => setEditId(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── PENDING TAB ─────────────────────────────────────────────
function PendingTab({ data, onAdd, onMarkPaid, onUpdate, onDelete, f, t, theme }) {
  const [form, setForm]       = useState({ client: "", amount: "", date: today(), dueDate: "", note: "" });
  const [show, setShow]       = useState(false);
  const [editId, setEditId]   = useState(null);
  const [markId, setMarkId]   = useState(null);
  const [markDate, setMarkDate] = useState(today());
  const submit = () => { if (!form.client || !form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ client: "", amount: "", date: today(), dueDate: "", note: "" }); setShow(false); };
  const total  = data.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>⏳ Pending</div>
        <button onClick={() => setShow(!show)} style={bStyle("#f0a500")}>+ Add Pending</button>
      </div>
      <div style={{ fontSize: 13, color: "#f0a500", marginBottom: 20, fontWeight: 600 }}>Total Awaiting: {f(total)}</div>
      {show && (<FormCard color="#f0a500" t={t}>
        <FormRow label="Client Name" t={t}><input style={iStyle(t)} value={form.client} onChange={e => setForm(v => ({ ...v, client: e.target.value }))} placeholder="e.g. XYZ Company" /></FormRow>
        <FormRow label="Amount (৳ BDT)" t={t}><input style={iStyle(t)} type="number" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} placeholder="10000" /></FormRow>
        <FormRow label="Invoice Date" t={t}><input style={iStyle(t)} type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></FormRow>
        <FormRow label="Due Date" t={t}><input style={iStyle(t)} type="date" value={form.dueDate} onChange={e => setForm(v => ({ ...v, dueDate: e.target.value }))} /></FormRow>
        <FormRow label="Note" t={t}><input style={iStyle(t)} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. Website project final payment" /></FormRow>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button onClick={submit} style={bStyle("#f0a500")}>✅ Save</button><button onClick={() => setShow(false)} style={bStyle("#4a7fa5")}>Cancel</button></div>
      </FormCard>)}
      {data.length === 0 && !show && <EmptyState text="No pending payments 🎉 You're all clear!" t={t} />}
      {data.map(item => {
        const overdue = item.dueDate && new Date(item.dueDate) < new Date();
        return (
          <div key={item.id} style={{ background: "rgba(240,165,0,0.06)", border: `1px solid ${overdue ? "#ff5c5c50" : "#f0a50030"}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{item.client}</div>
                {item.note && <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>{item.note}</div>}
                <div style={{ fontSize: 12, color: t.subText, marginTop: 4 }}>Invoice: {item.date}{item.dueDate && <span style={{ color: overdue ? "#ff5c5c" : t.subText, marginLeft: 8 }}>{overdue ? "⚠️ Overdue: " : "Due: "}{item.dueDate}</span>}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f0a500" }}>{f(item.amount)}</div>
                <ThreeDotMenu theme={theme} options={[
                  { icon: "✅", label: "Mark as Paid", action: () => onMarkPaid(item.id) },
                  { icon: "✏️", label: "Edit", action: () => setEditId(editId === item.id ? null : item.id) },
                  { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.client) },
                ]} />
              </div>
            </div>
            {editId === item.id && (
              <InlineEdit theme={theme} item={item} fields={[
                { key: "client", label: "Client Name" },
                { key: "amount", label: "Amount (৳ BDT)", type: "number" },
                { key: "date", label: "Invoice Date", type: "date" },
                { key: "dueDate", label: "Due Date", type: "date" },
                { key: "note", label: "Note" },
              ]} onSave={(vals) => { onUpdate(item.id, vals); setEditId(null); }} onCancel={() => setEditId(null)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── EXPENSES TAB ─────────────────────────────────────────────
function ExpensesTab({ data, onAdd, onUpdate, onDelete, f, t, theme }) {
  const [form, setForm]               = useState({ category: "Food", amount: "", date: today(), note: "" });
  const [show, setShow]               = useState(false);
  const [catFilter, setCatFilter]     = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [editId, setEditId]           = useState(null);
  const submit = () => { if (!form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ category: "Food", amount: "", date: today(), note: "" }); setShow(false); };
  const months  = ["All", ...Array.from(new Set(data.map(i => i.date?.slice(0, 7)).filter(Boolean))).sort().reverse()];
  const filtered = data.filter(i => (catFilter === "All" || i.category === catFilter) && (monthFilter === "All" || i.date?.startsWith(monthFilter)));
  const filteredTotal = filtered.reduce((s, i) => s + Number(i.amount), 0);
  const prettyMonth = m => m === "All" ? "All Months" : new Date(m + "-01").toLocaleString("default", { month: "short", year: "numeric" });
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🔴 Expenses</div>
        <button onClick={() => setShow(!show)} style={bStyle("#ff5c5c")}>+ Add Expense</button>
      </div>
      {show && (<FormCard color="#ff5c5c" t={t}>
        <FormRow label="Category" t={t}><select style={iStyle(t)} value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>{EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></FormRow>
        <FormRow label="Amount (৳ BDT)" t={t}><input style={iStyle(t)} type="number" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} placeholder="500" /></FormRow>
        <FormRow label="Date" t={t}><input style={iStyle(t)} type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></FormRow>
        <FormRow label="Note" t={t}><input style={iStyle(t)} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. Lunch with client" /></FormRow>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button onClick={submit} style={bStyle("#ff5c5c")}>✅ Save</button><button onClick={() => setShow(false)} style={bStyle("#4a7fa5")}>Cancel</button></div>
      </FormCard>)}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: t.subText, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>📅 Filter by Month</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{months.map(m => <button key={m} onClick={() => setMonthFilter(m)} style={{ background: monthFilter === m ? "rgba(0,229,160,0.15)" : "transparent", border: `1px solid ${monthFilter === m ? "#00e5a060" : t.cardBorder}`, color: monthFilter === m ? "#00e5a0" : t.subText, borderRadius: 99, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>{prettyMonth(m)}</button>)}</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: t.subText, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>🏷 Filter by Category</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["All", ...EXPENSE_CATS].map(c => <button key={c} onClick={() => setCatFilter(c)} style={{ background: catFilter === c ? "rgba(255,92,92,0.15)" : "transparent", border: `1px solid ${catFilter === c ? "#ff5c5c80" : t.cardBorder}`, color: catFilter === c ? "#ff5c5c" : t.subText, borderRadius: 99, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>{c}</button>)}</div>
      </div>
      {filtered.length > 0 && <div style={{ fontSize: 13, color: "#ff5c5c", marginBottom: 12, fontWeight: 700 }}>Showing {filtered.length} · Total: {f(filteredTotal)}</div>}
      {filtered.length === 0 && <EmptyState text="Nothing here yet. Add your first expense!" t={t} />}
      {filtered.map(item => (
        <div key={item.id} style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderLeft: "3px solid #ff5c5c", borderRadius: 10, padding: "12px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{item.category}</div>
              <div style={{ fontSize: 11, color: t.subText, marginTop: 2 }}>{item.date}{item.note ? " · " + item.note : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 800, color: "#ff5c5c", fontSize: 15 }}>{f(item.amount)}</div>
              <ThreeDotMenu theme={theme} options={[
                { icon: "✏️", label: "Edit", action: () => setEditId(editId === item.id ? null : item.id) },
                { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.category) },
              ]} />
            </div>
          </div>
          {editId === item.id && (
            <InlineEdit theme={theme} item={item} fields={[
              { key: "category", label: "Category", type: "select", options: EXPENSE_CATS },
              { key: "amount", label: "Amount (৳ BDT)", type: "number" },
              { key: "date", label: "Date", type: "date" },
              { key: "note", label: "Note" },
            ]} onSave={(vals) => { onUpdate(item.id, vals); setEditId(null); }} onCancel={() => setEditId(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── PLANS TAB ───────────────────────────────────────────────
function PlansTab({ data, onAdd, onUpdate, onDelete, onComplete, f, t, theme }) {
  const [form, setForm]           = useState({ title: "", budget: "", category: "Equipment", dueDate: "", note: "" });
  const [show, setShow]           = useState(false);
  const [editId, setEditId]       = useState(null);
  const [completeId, setCompleteId] = useState(null);
  const [completeDate, setCompleteDate] = useState(today());
  const submit = () => { if (!form.title || !form.budget) return; onAdd({ ...form, id: Date.now(), completed: false }); setForm({ title: "", budget: "", category: "Equipment", dueDate: "", note: "" }); setShow(false); };
  const active    = data.filter(p => !p.completed);
  const completed = data.filter(p => p.completed);
  const totalBudget = active.reduce((s, p) => s + Number(p.budget), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🎯 Plans</div>
        <button onClick={() => setShow(!show)} style={bStyle("#9370db")}>+ Add Plan</button>
      </div>
      <div style={{ fontSize: 13, color: "#9370db", marginBottom: 20, fontWeight: 600 }}>Total Budget: {f(totalBudget)}</div>

      {show && (<FormCard color="#9370db" t={t}>
        <FormRow label="Plan Title" t={t}><input style={iStyle(t)} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="e.g. Buy new MacBook" /></FormRow>
        <FormRow label="Budget (৳ BDT)" t={t}><input style={iStyle(t)} type="number" value={form.budget} onChange={e => setForm(v => ({ ...v, budget: e.target.value }))} placeholder="150000" /></FormRow>
        <FormRow label="Category" t={t}><select style={iStyle(t)} value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>{PLAN_CATS.map(c => <option key={c}>{c}</option>)}</select></FormRow>
        <FormRow label="Target Date" t={t}><input style={iStyle(t)} type="date" value={form.dueDate} onChange={e => setForm(v => ({ ...v, dueDate: e.target.value }))} /></FormRow>
        <FormRow label="Note" t={t}><input style={iStyle(t)} value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. For video editing work" /></FormRow>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button onClick={submit} style={bStyle("#9370db")}>✅ Save</button><button onClick={() => setShow(false)} style={bStyle("#4a7fa5")}>Cancel</button></div>
      </FormCard>)}

      {/* Complete popup */}
      {completeId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.popupBg, border: `1px solid ${t.cardBorder}`, borderRadius: 16, padding: 28, maxWidth: 320, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6, textAlign: "center" }}>Mark as Completed!</div>
            <div style={{ fontSize: 13, color: t.subText, marginBottom: 20, textAlign: "center" }}>This will add the budget as an expense.</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: t.subText, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Completion Date</div>
              <input type="date" value={completeDate} onChange={e => setCompleteDate(e.target.value)} style={{ ...iStyle(t), width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCompleteId(null)} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${t.cardBorder}`, borderRadius: 10, color: t.subText, cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={() => { onComplete(completeId, completeDate); setCompleteId(null); }} style={{ flex: 1, padding: "10px", background: "rgba(0,229,160,0.15)", border: "1px solid #00e5a060", borderRadius: 10, color: "#00e5a0", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✅ Confirm</button>
            </div>
          </div>
        </div>
      )}

      {active.length === 0 && !show && <EmptyState text="No plans yet. Add your first budget plan!" t={t} />}
      {active.map(item => (
        <div key={item.id} style={{ background: "rgba(147,112,219,0.06)", border: "1px solid rgba(147,112,219,0.25)", borderRadius: 12, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{item.title}</div>
              <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>{item.category}{item.note ? " · " + item.note : ""}</div>
              {item.dueDate && <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>🗓 Target: {item.dueDate}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#9370db" }}>{f(item.budget)}</div>
              <ThreeDotMenu theme={theme} options={[
                { icon: "✅", label: "Mark Complete", action: () => { setCompleteId(item.id); setCompleteDate(today()); } },
                { icon: "✏️", label: "Edit", action: () => setEditId(editId === item.id ? null : item.id) },
                { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.title) },
              ]} />
            </div>
          </div>
          {editId === item.id && (
            <InlineEdit theme={theme} item={item} fields={[
              { key: "title", label: "Plan Title" },
              { key: "budget", label: "Budget (৳ BDT)", type: "number" },
              { key: "category", label: "Category", type: "select", options: PLAN_CATS },
              { key: "dueDate", label: "Target Date", type: "date" },
              { key: "note", label: "Note" },
            ]} onSave={(vals) => { onUpdate(item.id, vals); setEditId(null); }} onCancel={() => setEditId(null)} />
          )}
        </div>
      ))}

      {completed.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: t.subText, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>✅ Completed Plans</div>
          {completed.map(item => (
            <div key={item.id} style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, opacity: 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: t.text, textDecoration: "line-through" }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: t.subText }}>Completed: {item.completionDate}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#00e5a0" }}>{f(item.budget)}</div>
                  <ThreeDotMenu theme={theme} options={[
                    { icon: "🗑️", label: "Delete", danger: true, action: () => onDelete(item.id, item.title) },
                  ]} />
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
function FormCard({ children, color, t })  { return <div style={{ background: t.sectionBg, border: `1px solid ${color}40`, borderRadius: 14, padding: 20, marginBottom: 20 }}>{children}</div>; }
function FormRow({ label, children, t })   { return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: t.subText, marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>{children}</div>; }
function EmptyState({ text, t })           { return <div style={{ textAlign: "center", padding: "48px 20px", color: t.subText, fontSize: 14, border: `1px dashed ${t.cardBorder}`, borderRadius: 14 }}>{text}</div>; }
const iStyle = (t) => ({ width: "100%", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 8, color: t.text, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" });
function bStyle(color) { return { background: `${color}18`, border: `1px solid ${color}60`, color, borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s" }; }
