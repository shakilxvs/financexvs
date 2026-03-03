import { useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, provider, db } from "./firebase";

// ─── Constants ───────────────────────────────────────────────
const defaultData = { income: [], pending: [], expenses: [] };
const EXPENSE_CATS = ["Food", "Transport", "Software", "Office", "Utilities", "Entertainment", "Other"];
const INCOME_CATS  = ["Project", "Salary", "Bonus", "Retainer", "Other"];

function formatBDT(n)  { return "৳ " + Number(n).toLocaleString("en-BD"); }
function today()       { return new Date().toISOString().split("T")[0]; }

// ─── Firestore helpers ────────────────────────────────────────
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

// ─── ROOT APP ────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(null);
  const [data,        setData]        = useState(defaultData);
  const [tab,         setTab]         = useState("dashboard");
  const [syncing,     setSyncing]     = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setSyncing(true);
        const cloud = await loadFromCloud(u.uid);
        setData(cloud);
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

  const addIncome     = (item) => setData(d => ({ ...d, income:   [item, ...d.income] }));
  const addPending    = (item) => setData(d => ({ ...d, pending:  [item, ...d.pending] }));
  const addExpense    = (item) => setData(d => ({ ...d, expenses: [item, ...d.expenses] }));
  const updatePending = (id, fields) =>
    setData(d => ({ ...d, pending: d.pending.map(p => p.id === id ? { ...p, ...fields } : p) }));
  const markPaid = (id) => {
    const it = data.pending.find(p => p.id === id);
    if (!it) return;
    setData(d => ({
      ...d,
      pending: d.pending.filter(p => p.id !== id),
      income:  [{ ...it, id: Date.now(), date: today(), category: "Project", note: "From pending: " + it.client }, ...d.income],
    }));
  };
  const deleteItem = (type, id) => setData(d => ({ ...d, [type]: d[type].filter(i => i.id !== id) }));

  const totalIncome   = data.income.reduce((s, i)   => s + Number(i.amount), 0);
  const totalPending  = data.pending.reduce((s, i)  => s + Number(i.amount), 0);
  const totalExpenses = data.expenses.reduce((s, i) => s + Number(i.amount), 0);
  const netBalance    = totalIncome - totalExpenses;
  const thisMonth     = new Date().toISOString().slice(0, 7);
  const monthIncome   = data.income.filter(i => i.date?.startsWith(thisMonth)).reduce((s, i) => s + Number(i.amount), 0);
  const monthExpenses = data.expenses.filter(i => i.date?.startsWith(thisMonth)).reduce((s, i) => s + Number(i.amount), 0);

  if (authLoading) return <Splash text="Starting FreelanceFlow..." />;
  if (!user)       return <LoginScreen onLogin={login} />;

  const tabs = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "income",    label: "💚 Income" },
    { id: "pending",   label: "⏳ Pending" },
    { id: "expenses",  label: "🔴 Expenses" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#0f1923 100%)", fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#e6edf3" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(90deg,#0d2137,#0a1628)", borderBottom: "1px solid #1e3a5f", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 24px rgba(0,229,160,0.08)", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#00e5a0", letterSpacing: "-0.5px" }}>💼 FreelanceFlow</div>
            <div style={{ fontSize: 10, color: "#4a7fa5" }}>Personal finance manager</div>
          </div>
          {syncing && <div style={{ fontSize: 11, color: "#4a7fa5", background: "rgba(74,127,165,0.1)", border: "1px solid #1e3a5f", borderRadius: 99, padding: "3px 10px" }}>☁️ Syncing…</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", borderRadius: 8, padding: "5px 12px", fontSize: 13, color: "#00e5a0" }}>
            Net: {formatBDT(netBalance)}
          </div>
          <img src={user.photoURL} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid #00e5a040" }} />
          <span style={{ fontSize: 12, color: "#6b8fa8", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName?.split(" ")[0]}</span>
          <button onClick={logout} style={{ background: "rgba(255,92,92,0.1)", border: "1px solid #ff5c5c40", color: "#ff5c5c", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>Sign out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px", background: "#0a1628", borderBottom: "1px solid #1e3a5f", overflowX: "auto", scrollbarWidth: "none" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "rgba(0,229,160,0.15)" : "transparent", border: tab === t.id ? "1px solid rgba(0,229,160,0.5)" : "1px solid transparent", color: tab === t.id ? "#00e5a0" : "#6b8fa8", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 700 : 400, whiteSpace: "nowrap", transition: "all 0.2s" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>
        {tab === "dashboard" && <Dashboard totalIncome={totalIncome} totalPending={totalPending} totalExpenses={totalExpenses} netBalance={netBalance} monthIncome={monthIncome} monthExpenses={monthExpenses} data={data} userName={user.displayName?.split(" ")[0]} />}
        {tab === "income"    && <IncomeTab   data={data.income}   onAdd={addIncome}   onDelete={id => deleteItem("income", id)} />}
        {tab === "pending"   && <PendingTab  data={data.pending}  onAdd={addPending}  onMarkPaid={markPaid} onDelete={id => deleteItem("pending", id)} onUpdate={updatePending} />}
        {tab === "expenses"  && <ExpensesTab data={data.expenses} onAdd={addExpense}  onDelete={id => deleteItem("expenses", id)} />}
      </div>
    </div>
  );
}

// ─── SPLASH ──────────────────────────────────────────────────
function Splash({ text }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0d1117", gap: 16 }}>
      <div style={{ fontSize: 40 }}>💼</div>
      <div style={{ color: "#00e5a0", fontWeight: 800, fontSize: 20 }}>FreelanceFlow</div>
      <div style={{ color: "#4a7fa5", fontSize: 13 }}>{text}</div>
    </div>
  );
}

// ─── LOGIN SCREEN ────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#0f1923 100%)", fontFamily: "'Segoe UI',system-ui,sans-serif", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>💼</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#00e5a0", letterSpacing: "-1px", marginBottom: 8 }}>FreelanceFlow</div>
        <div style={{ fontSize: 15, color: "#4a7fa5", marginBottom: 40, lineHeight: 1.6 }}>Your personal finance manager.<br />Track income, pending payments & expenses.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {["💚 Track Income", "⏳ Pending Payments", "🔴 Daily Expenses", "☁️ Cloud Sync", "📊 Monthly Reports", "🔒 Private & Secure"].map(f => (
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
function Dashboard({ totalIncome, totalPending, totalExpenses, netBalance, monthIncome, monthExpenses, data, userName }) {
  const cards = [
    { label: "Total Income",    value: totalIncome,   color: "#00e5a0", bg: "rgba(0,229,160,0.08)",   icon: "💚" },
    { label: "Pending Payment", value: totalPending,  color: "#f0a500", bg: "rgba(240,165,0,0.08)",   icon: "⏳" },
    { label: "Total Expenses",  value: totalExpenses, color: "#ff5c5c", bg: "rgba(255,92,92,0.08)",   icon: "🔴" },
    { label: "Net Balance",     value: netBalance,    color: netBalance >= 0 ? "#00e5a0" : "#ff5c5c", bg: netBalance >= 0 ? "rgba(0,229,160,0.08)" : "rgba(255,92,92,0.08)", icon: "💰" },
  ];
  const recentTx = [...data.income.map(i => ({ ...i, type: "income" })), ...data.expenses.map(i => ({ ...i, type: "expense" })), ...data.pending.map(i => ({ ...i, type: "pending" }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>👋 Hey, {userName}! <span style={{ fontSize: 13, color: "#4a7fa5", fontWeight: 400, marginLeft: 12 }}>{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12, marginBottom: 28 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}30`, borderRadius: 14, padding: "18px 16px" }}>
            <div style={{ fontSize: 22 }}>{c.icon}</div>
            <div style={{ fontSize: 10, color: "#4a7fa5", marginTop: 8, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: c.color, marginTop: 4 }}>{formatBDT(c.value)}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a5f", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📅 This Month</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[["EARNED", monthIncome, "#00e5a0"], ["SPENT", monthExpenses, "#ff5c5c"], ["SAVED", monthIncome - monthExpenses, monthIncome - monthExpenses >= 0 ? "#00e5a0" : "#ff5c5c"]].map(([l, v, c]) => (
            <div key={l}><div style={{ fontSize: 11, color: "#4a7fa5" }}>{l}</div><div style={{ fontSize: 20, fontWeight: 800, color: c }}>{formatBDT(v)}</div></div>
          ))}
        </div>
        {monthIncome > 0 && (<div style={{ marginTop: 16 }}><div style={{ background: "#1e3a5f", borderRadius: 99, height: 8, overflow: "hidden" }}><div style={{ width: Math.min(100, (monthExpenses / monthIncome) * 100) + "%", background: monthExpenses / monthIncome > 0.8 ? "#ff5c5c" : "#00e5a0", height: "100%", borderRadius: 99, transition: "width 0.5s" }} /></div><div style={{ fontSize: 11, color: "#4a7fa5", marginTop: 4 }}>{Math.round((monthExpenses / monthIncome) * 100)}% of income spent</div></div>)}
      </div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a5f", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🕐 Recent Transactions</div>
        {recentTx.length === 0 && <div style={{ color: "#4a7fa5", fontSize: 13 }}>No transactions yet. Add some!</div>}
        {recentTx.map(tx => (
          <div key={tx.id + tx.type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a2f47" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{tx.type === "income" ? "💚" : tx.type === "pending" ? "⏳" : "🔴"} {tx.client || tx.category || "—"}</div><div style={{ fontSize: 11, color: "#4a7fa5" }}>{tx.date}</div></div>
            <div style={{ fontWeight: 800, fontSize: 14, color: tx.type === "income" ? "#00e5a0" : tx.type === "pending" ? "#f0a500" : "#ff5c5c" }}>{tx.type === "expense" ? "−" : "+"}{formatBDT(tx.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── INCOME TAB ───────────────────────────────────────────────
function IncomeTab({ data, onAdd, onDelete }) {
  const [form, setForm] = useState({ client: "", amount: "", date: today(), category: "Project", note: "" });
  const [show, setShow] = useState(false);
  const submit = () => { if (!form.client || !form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ client: "", amount: "", date: today(), category: "Project", note: "" }); setShow(false); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>💚 Income</div>
        <button onClick={() => setShow(!show)} style={btnStyle("#00e5a0")}>+ Add Income</button>
      </div>
      {show && (<FormCard color="#00e5a0">
        <FormRow label="Client / Source"><input style={inputStyle} value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. Fiverr Client" /></FormRow>
        <FormRow label="Amount (৳)"><input style={inputStyle} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="5000" /></FormRow>
        <FormRow label="Date"><input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></FormRow>
        <FormRow label="Category"><select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{INCOME_CATS.map(c => <option key={c}>{c}</option>)}</select></FormRow>
        <FormRow label="Note (optional)"><input style={inputStyle} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Logo design project" /></FormRow>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button onClick={submit} style={btnStyle("#00e5a0")}>✅ Save</button><button onClick={() => setShow(false)} style={btnStyle("#4a7fa5")}>Cancel</button></div>
      </FormCard>)}
      <TxList items={data} onDelete={onDelete} color="#00e5a0" labelKey="client" />
    </div>
  );
}

// ─── PENDING TAB ─────────────────────────────────────────────
function PendingTab({ data, onAdd, onMarkPaid, onDelete, onUpdate }) {
  const [form, setForm]           = useState({ client: "", amount: "", date: today(), dueDate: "", note: "" });
  const [show, setShow]           = useState(false);
  const [editId, setEditId]       = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const submit   = () => { if (!form.client || !form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ client: "", amount: "", date: today(), dueDate: "", note: "" }); setShow(false); };
  const saveEdit = (id) => { if (!editAmount) return; onUpdate(id, { amount: editAmount }); setEditId(null); setEditAmount(""); };
  const total    = data.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>⏳ Pending</div>
        <button onClick={() => setShow(!show)} style={btnStyle("#f0a500")}>+ Add Pending</button>
      </div>
      <div style={{ fontSize: 13, color: "#f0a500", marginBottom: 20 }}>Total Awaiting: {formatBDT(total)}</div>
      {show && (<FormCard color="#f0a500">
        <FormRow label="Client Name"><input style={inputStyle} value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. XYZ Company" /></FormRow>
        <FormRow label="Amount (৳)"><input style={inputStyle} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="10000" /></FormRow>
        <FormRow label="Invoice Date"><input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></FormRow>
        <FormRow label="Due Date"><input style={inputStyle} type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></FormRow>
        <FormRow label="Note"><input style={inputStyle} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Website project final payment" /></FormRow>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button onClick={submit} style={btnStyle("#f0a500")}>✅ Save</button><button onClick={() => setShow(false)} style={btnStyle("#4a7fa5")}>Cancel</button></div>
      </FormCard>)}
      {data.length === 0 && !show && <EmptyState text="No pending payments 🎉 You're all clear!" />}
      {data.map(item => {
        const overdue   = item.dueDate && new Date(item.dueDate) < new Date();
        const isEditing = editId === item.id;
        return (
          <div key={item.id} style={{ background: "rgba(240,165,0,0.06)", border: `1px solid ${overdue ? "#ff5c5c50" : "#f0a50030"}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.client}</div>
                {item.note && <div style={{ fontSize: 12, color: "#4a7fa5", marginTop: 2 }}>{item.note}</div>}
                <div style={{ fontSize: 12, color: "#4a7fa5", marginTop: 4 }}>Invoice: {item.date}{item.dueDate && <span style={{ color: overdue ? "#ff5c5c" : "#4a7fa5", marginLeft: 8 }}>{overdue ? "⚠️ Overdue: " : "Due: "}{item.dueDate}</span>}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={{ ...inputStyle, width: 110, padding: "6px 10px", fontSize: 14 }} autoFocus />
                    <button onClick={() => saveEdit(item.id)} style={{ ...btnStyle("#00e5a0"), padding: "5px 10px", fontSize: 12 }}>✅</button>
                    <button onClick={() => setEditId(null)} style={{ ...btnStyle("#4a7fa5"), padding: "5px 10px", fontSize: 12 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#f0a500" }}>{formatBDT(item.amount)}</div>
                    <button onClick={() => { setEditId(item.id); setEditAmount(item.amount); }} style={{ background: "rgba(240,165,0,0.12)", border: "1px solid #f0a50050", color: "#f0a500", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 13 }}>✏️</button>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onMarkPaid(item.id)} style={{ ...btnStyle("#00e5a0"), padding: "5px 12px", fontSize: 12 }}>✅ Mark Paid</button>
                  <button onClick={() => onDelete(item.id)} style={{ ...btnStyle("#ff5c5c"), padding: "5px 10px", fontSize: 12 }}>🗑</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── EXPENSES TAB ─────────────────────────────────────────────
function ExpensesTab({ data, onAdd, onDelete }) {
  const [form, setForm]               = useState({ category: "Food", amount: "", date: today(), note: "" });
  const [show, setShow]               = useState(false);
  const [catFilter, setCatFilter]     = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const submit = () => { if (!form.amount) return; onAdd({ ...form, id: Date.now() }); setForm({ category: "Food", amount: "", date: today(), note: "" }); setShow(false); };
  const months  = ["All", ...Array.from(new Set(data.map(i => i.date?.slice(0, 7)).filter(Boolean))).sort().reverse()];
  const filtered = data.filter(i => (catFilter === "All" || i.category === catFilter) && (monthFilter === "All" || i.date?.startsWith(monthFilter)));
  const filteredTotal = filtered.reduce((s, i) => s + Number(i.amount), 0);
  const prettyMonth = m => m === "All" ? "All Months" : new Date(m + "-01").toLocaleString("default", { month: "short", year: "numeric" });
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>🔴 Expenses</div>
        <button onClick={() => setShow(!show)} style={btnStyle("#ff5c5c")}>+ Add Expense</button>
      </div>
      {show && (<FormCard color="#ff5c5c">
        <FormRow label="Category"><select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></FormRow>
        <FormRow label="Amount (৳)"><input style={inputStyle} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500" /></FormRow>
        <FormRow label="Date"><input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></FormRow>
        <FormRow label="Note"><input style={inputStyle} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Lunch with client" /></FormRow>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button onClick={submit} style={btnStyle("#ff5c5c")}>✅ Save</button><button onClick={() => setShow(false)} style={btnStyle("#4a7fa5")}>Cancel</button></div>
      </FormCard>)}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#4a7fa5", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>📅 Filter by Month</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{months.map(m => <button key={m} onClick={() => setMonthFilter(m)} style={{ background: monthFilter === m ? "rgba(0,229,160,0.15)" : "transparent", border: `1px solid ${monthFilter === m ? "#00e5a060" : "#1e3a5f"}`, color: monthFilter === m ? "#00e5a0" : "#4a7fa5", borderRadius: 99, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>{prettyMonth(m)}</button>)}</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#4a7fa5", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>🏷 Filter by Category</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["All", ...EXPENSE_CATS].map(c => <button key={c} onClick={() => setCatFilter(c)} style={{ background: catFilter === c ? "rgba(255,92,92,0.15)" : "transparent", border: `1px solid ${catFilter === c ? "#ff5c5c80" : "#1e3a5f"}`, color: catFilter === c ? "#ff5c5c" : "#4a7fa5", borderRadius: 99, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>{c}</button>)}</div>
      </div>
      {filtered.length > 0 && <div style={{ fontSize: 13, color: "#ff5c5c", marginBottom: 12, fontWeight: 700 }}>Showing {filtered.length} transaction{filtered.length !== 1 ? "s" : ""} · Total: {formatBDT(filteredTotal)}</div>}
      <TxList items={filtered} onDelete={onDelete} color="#ff5c5c" labelKey="category" />
    </div>
  );
}

// ─── SHARED ──────────────────────────────────────────────────
function TxList({ items, onDelete, color, labelKey }) {
  if (items.length === 0) return <EmptyState text="Nothing here yet. Add your first entry!" />;
  return <div>{items.map(item => (
    <div key={item.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1e3a5f", borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{item[labelKey]}</div>
        <div style={{ fontSize: 11, color: "#4a7fa5", marginTop: 2 }}>{item.date}{item.note ? " · " + item.note : ""}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 800, color, fontSize: 15 }}>{formatBDT(item.amount)}</div>
        <button onClick={() => onDelete(item.id)} style={{ background: "transparent", border: "none", color: "#ff5c5c50", cursor: "pointer", fontSize: 16, padding: "2px 6px", borderRadius: 6 }} onMouseEnter={e => e.target.style.color = "#ff5c5c"} onMouseLeave={e => e.target.style.color = "#ff5c5c50"}>🗑</button>
      </div>
    </div>
  ))}</div>;
}
function FormCard({ children, color })  { return <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}40`, borderRadius: 14, padding: 20, marginBottom: 20 }}>{children}</div>; }
function FormRow({ label, children })   { return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#4a7fa5", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>{children}</div>; }
function EmptyState({ text })           { return <div style={{ textAlign: "center", padding: "48px 20px", color: "#4a7fa5", fontSize: 14, border: "1px dashed #1e3a5f", borderRadius: 14 }}>{text}</div>; }
const inputStyle = { width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e6edf3", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" };
function btnStyle(color) { return { background: `${color}18`, border: `1px solid ${color}60`, color, borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s" }; }
