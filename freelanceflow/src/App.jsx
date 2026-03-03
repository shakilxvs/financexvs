import { useState, useEffect, useRef } from "react";
import {
  signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, provider, db } from "./firebase";

// ── Constants ─────────────────────────────────────────────────
const defaultFinance = { income:[], pending:[], expenses:[], plans:[] };
const EXPENSE_CATS = ["Food","Transport","Software","Office","Utilities","Entertainment","Other"];
const INCOME_CATS  = ["Project","Salary","Bonus","Retainer","Other"];
const PLAN_CATS    = ["Equipment","Software","Travel","Education","Marketing","Office","Other"];

const CURRENCIES = [
  { code:"BDT", symbol:"৳",   name:"Bangladeshi Taka"  },
  { code:"USD", symbol:"$",   name:"US Dollar"          },
  { code:"EUR", symbol:"€",   name:"Euro"               },
  { code:"GBP", symbol:"£",   name:"British Pound"      },
  { code:"AUD", symbol:"A$",  name:"Australian Dollar"  },
  { code:"CAD", symbol:"C$",  name:"Canadian Dollar"    },
  { code:"AED", symbol:"د.إ", name:"UAE Dirham"         },
  { code:"JPY", symbol:"¥",   name:"Japanese Yen"       },
  { code:"INR", symbol:"₹",   name:"Indian Rupee"       },
  { code:"SGD", symbol:"S$",  name:"Singapore Dollar"   },
];
const DEFAULT_RATES = { USD:1, BDT:110, EUR:0.92, GBP:0.79, AUD:1.55, CAD:1.36, AED:3.67, JPY:149, INR:83, SGD:1.34 };

const LEVELS = [
  { name:"Seedling",       emoji:"🌱", color:"#6bcb77", minUSD:0,      desc:"Just getting started!" },
  { name:"Side Hustler",   emoji:"⚡", color:"#4d96ff", minUSD:100,    desc:"Momentum is building!" },
  { name:"Pro Earner",     emoji:"🔥", color:"#f0a500", minUSD:1000,   desc:"You're on fire!"       },
  { name:"Top Achiever",   emoji:"💎", color:"#00e5a0", minUSD:10000,  desc:"Elite territory!"      },
  { name:"Empire Builder", emoji:"👑", color:"#9370db", minUSD:100000, desc:"Absolute legend!"      },
];

// ── Icons (Font Awesome SVG paths) ───────────────────────────
const ICONS = {
  wallet:     { d:"M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192H48c-8.8 0-16-7.2-16-16s7.2-16 16-16H448V96c0-35.3-28.7-64-64-64H64zM448 256v96H400c-26.5 0-48-21.5-48-48s21.5-48 48-48H448z", vb:"0 0 512 512" },
  bars:       { d:"M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM64 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z", vb:"0 0 448 512" },
  at:         { d:"M256 64C150 64 64 150 64 256s86 192 192 192c17.7 0 32 14.3 32 32s-14.3 32-32 32C114.6 512 0 397.4 0 256S114.6 0 256 0S512 114.6 512 256v32c0 53-43 96-96 96c-29.3 0-55.6-13.2-73.2-33.9C320 371.1 289.5 384 256 384c-70.7 0-128-57.3-128-128s57.3-128 128-128c27.9 0 53.7 8.9 74.7 24.1c5.7-5 13.1-8.1 21.3-8.1c17.7 0 32 14.3 32 32v80 32c0 17.7 14.3 32 32 32s32-14.3 32-32V256c0-106-86-192-192-192zm64 192a64 64 0 1 0 -128 0 64 64 0 1 0 128 0z", vb:"0 0 512 512" },
  signout:    { d:"M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z", vb:"0 0 512 512" },
  circleUser: { d:"M399 384.2C376.9 345.8 335.4 320 288 320l-64 0c-47.4 0-88.9 25.8-111 64.2c35.2 39.2 86.2 63.8 143 63.8s107.8-24.7 143-63.8zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm256 16a72 72 0 1 0 0-144 72 72 0 1 0 0 144z", vb:"0 0 512 512" },
  gear:       { d:"M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z", vb:"0 0 512 512" },
  user:       { d:"M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z", vb:"0 0 448 512" },
};

function Ico({ name, size=18, color="currentColor", style:s={} }) {
  const ic = ICONS[name];
  if (!ic) return null;
  return <svg width={size} height={size} viewBox={ic.vb} fill={color} style={{flexShrink:0,...s}}><path d={ic.d}/></svg>;
}

// ── Themes ────────────────────────────────────────────────────
const THEMES = {
  dark: {
    id:"dark", pageBg:"#0d1117", headerBg:"rgba(13,33,55,0.9)", headerBorder:"rgba(30,58,95,0.8)",
    sectionBg:"rgba(255,255,255,0.03)", sectionBorder:"#1e3a5f",
    cardBg:"rgba(255,255,255,0.02)", cardBorder:"#1e3a5f",
    inputBg:"#0a1628", inputBorder:"#1e3a5f",
    text:"#e6edf3", subText:"#4a7fa5", dimText:"#6b8fa8",
    popupBg:"#0d2137", menuBg:"#0d2137",
    tabBg:"rgba(255,255,255,0.05)", tabInactive:"#5a8fa8",
    tabActive:"rgba(0,229,160,0.18)", tabActiveBorder:"rgba(0,229,160,0.5)", tabActiveText:"#00e5a0",
  },
  light: {
    id:"light", pageBg:"#eef2f7", headerBg:"rgba(255,255,255,0.92)", headerBorder:"rgba(180,210,240,0.9)",
    sectionBg:"rgba(255,255,255,0.9)", sectionBorder:"#c5d8ee",
    cardBg:"rgba(255,255,255,0.95)", cardBorder:"#c5d8ee",
    inputBg:"#ffffff", inputBorder:"#b0c8e0",
    text:"#1a2f45", subText:"#4a7fa5", dimText:"#5a8fba",
    popupBg:"#ffffff", menuBg:"#ffffff",
    tabBg:"rgba(0,0,0,0.06)", tabInactive:"#3a6080",
    tabActive:"#1a5276", tabActiveBorder:"#1a5276", tabActiveText:"#ffffff",
  }
};

// ── Helpers ───────────────────────────────────────────────────
function today() { return new Date().toISOString().split("T")[0]; }
function currSym(code) { return CURRENCIES.find(c=>c.code===code)?.symbol || code; }
function firstName(name) { if (!name) return "User"; return name.trim().split(/\s+/)[0]; }

function fmtAmt(bdtAmt, currency, rates) {
  const r = rates || DEFAULT_RATES;
  const n = Number(bdtAmt) || 0;
  const d = currency === "BDT" ? n : (n / (r.BDT||110)) * (r[currency]||1);
  const sym = currSym(currency);
  if (currency === "JPY") return sym + Math.round(d).toLocaleString("en-US");
  return sym + d.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function toBase(displayAmt, currency, rates) {
  const r = rates || DEFAULT_RATES;
  const n = Number(displayAmt) || 0;
  if (currency === "BDT") return n;
  return (n / (r[currency]||1)) * (r.BDT||110);
}

function fromBase(bdtAmt, currency, rates) {
  const r = rates || DEFAULT_RATES;
  const n = Number(bdtAmt) || 0;
  if (currency === "BDT") return n;
  return (n / (r.BDT||110)) * (r[currency]||1);
}

function getLevel(totalIncomeUSD) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) { if (totalIncomeUSD >= l.minUSD) lvl = l; }
  return lvl;
}

function useIsMobile(bp=640) {
  const [mob, setMob] = useState(typeof window!=="undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setMob(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return mob;
}

// ── Firebase ──────────────────────────────────────────────────
async function loadFromCloud(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      return {
        finance:  { ...defaultFinance, ...(d.finance||{}) },
        settings: { currency:"BDT", theme:"dark", ...(d.settings||{}) },
        profile:  { customName:"", ...(d.profile||{}) },
      };
    }
  } catch {}
  return { finance:defaultFinance, settings:{ currency:"BDT", theme:"dark" }, profile:{ customName:"" } };
}
async function saveToCloud(uid, finance, settings, profile) {
  try { await setDoc(doc(db,"users",uid), { finance, settings, profile }, { merge:true }); }
  catch(e) { console.error("Save error:", e); }
}

// ── Sync Toast ────────────────────────────────────────────────
const SPIN_STYLE = `@keyframes ffSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;
function SyncToast({ show }) {
  return (
    <>
      <style>{SPIN_STYLE}</style>
      <div style={{
        position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
        background:"rgba(0,229,160,0.12)", border:"1px solid rgba(0,229,160,0.3)",
        backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
        borderRadius:99, padding:"8px 18px", fontSize:12, color:"#00e5a0",
        fontWeight:700, zIndex:99999, display:"flex", alignItems:"center", gap:7,
        opacity:show?1:0, transition:"opacity 0.3s", pointerEvents:"none",
        boxShadow:"0 4px 20px rgba(0,229,160,0.15)", whiteSpace:"nowrap",
      }}>
        <span style={{ display:"inline-block", animation:"ffSpin 1s linear infinite", fontSize:14 }}>⟳</span>
        Syncing to cloud…
      </div>
    </>
  );
}

// ── User Avatar ───────────────────────────────────────────────
function UserAvatar({ photoURL, size=30, t }) {
  if (photoURL) return <img src={photoURL} alt="" style={{ width:size, height:size, borderRadius:"50%", border:`2px solid rgba(0,229,160,0.3)`, flexShrink:0, objectFit:"cover" }} />;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:`2px solid rgba(0,229,160,0.3)` }}>
      <Ico name="user" size={size*0.52} color="#888" />
    </div>
  );
}

// ── Confirm Popup ─────────────────────────────────────────────
function ConfirmPopup({ message, onConfirm, onCancel, t }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:9998, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:t.popupBg, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:32, maxWidth:320, width:"100%", textAlign:"center", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ fontSize:40, marginBottom:14 }}>⚠️</div>
        <div style={{ fontSize:17, fontWeight:800, color:t.text, marginBottom:8 }}>Are you sure?</div>
        <div style={{ fontSize:13, color:t.subText, marginBottom:28, lineHeight:1.6 }}>{message}</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:"11px", background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:12, color:t.subText, cursor:"pointer", fontSize:13, fontWeight:600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1, padding:"11px", background:"rgba(255,92,92,0.15)", border:"1px solid #ff5c5c60", borderRadius:12, color:"#ff5c5c", cursor:"pointer", fontSize:13, fontWeight:700 }}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── 3-Dot Menu ────────────────────────────────────────────────
function ThreeDotMenu({ options, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:8, width:32, height:32, cursor:"pointer", color:t.subText, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>⋯</button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", background:t.menuBg, border:`1px solid ${t.cardBorder}`, borderRadius:14, zIndex:500, minWidth:170, boxShadow:"0 8px 32px rgba(0,0,0,0.3)", overflow:"hidden" }}>
          {options.map((opt,i) => (
            <button key={i} onClick={() => { opt.action(); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"11px 16px", background:"transparent", border:"none", color:opt.danger?"#ff5c5c":t.text, cursor:"pointer", fontSize:13, fontWeight:opt.danger?700:500, borderBottom:i<options.length-1?`1px solid ${t.cardBorder}`:"none", textAlign:"left" }}>
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hamburger Menu ────────────────────────────────────────────
function HamburgerMenu({ onLogout, onProfile, onSettings, theme, setTheme, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const item = (icon, label, action, color) => (
    <button onClick={() => { action(); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 18px", background:"transparent", border:"none", color:color||t.text, cursor:"pointer", fontSize:14, fontWeight:500, borderBottom:`1px solid ${t.cardBorder}`, textAlign:"left" }}>
      {icon}{label}
    </button>
  );
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background:"rgba(255,255,255,0.08)", border:`1px solid ${t.headerBorder}`, borderRadius:9, width:36, height:36, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Ico name="bars" size={16} color={t.text} />
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 8px)", background:t.menuBg, border:`1px solid ${t.cardBorder}`, borderRadius:18, zIndex:9999, minWidth:200, boxShadow:"0 12px 40px rgba(0,0,0,0.3)", overflow:"hidden" }}>
          {item(<Ico name="circleUser" size={15} color={t.subText}/>, "Profile", onProfile)}
          {item(<Ico name="gear" size={15} color={t.subText}/>, "Settings", onSettings)}
          <button onClick={() => { setTheme(th => th==="dark"?"light":"dark"); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 18px", background:"transparent", border:"none", color:t.text, cursor:"pointer", fontSize:14, fontWeight:500, borderBottom:`1px solid ${t.cardBorder}`, textAlign:"left" }}>
            <span style={{ fontSize:16 }}>{theme==="dark"?"☀️":"🌙"}</span>
            {theme==="dark"?"Light Mode":"Dark Mode"}
          </button>
          <a href="https://shakilxvs.wordpress.com/" target="_blank" rel="noreferrer" onClick={() => setOpen(false)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 18px", color:t.text, textDecoration:"none", fontSize:14, fontWeight:500, borderBottom:`1px solid ${t.cardBorder}` }}>
            <Ico name="at" size={15} color={t.subText}/> Support
          </a>
          <button onClick={() => { onLogout(); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 18px", background:"transparent", border:"none", color:"#ff5c5c", cursor:"pointer", fontSize:14, fontWeight:700, textAlign:"left" }}>
            <Ico name="signout" size={15} color="#ff5c5c"/> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Currency Dropdown ─────────────────────────────────────────
function CurrencyDropdown({ currency, setCurrency, rates, ratesLoading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sym = currSym(currency);
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(0,229,160,0.1)", border:"1px solid rgba(0,229,160,0.35)", borderRadius:8, padding:"5px 10px", cursor:"pointer", color:"#00e5a0", fontSize:12, fontWeight:800 }}>
        <span style={{ fontSize:14 }}>{sym}</span>
        <span>{currency}</span>
        <span style={{ fontSize:9, opacity:0.6 }}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 8px)", left:0, background:"#0d2137", border:"1px solid #1e3a5f", borderRadius:16, zIndex:9999, minWidth:220, boxShadow:"0 12px 40px rgba(0,0,0,0.5)", overflow:"hidden" }}>
          <div style={{ padding:"8px 14px", borderBottom:"1px solid #1e3a5f", fontSize:10, color:"#4a7fa5", letterSpacing:0.5 }}>
            {ratesLoading ? "⏳ Fetching live rates…" : "🔴 Live rates"}
          </div>
          <div style={{ maxHeight:320, overflowY:"auto", scrollbarWidth:"none" }}>
            {CURRENCIES.map(c => {
              const bdtPer = rates && rates.BDT && rates[c.code] ? (rates.BDT / rates[c.code]) : null;
              return (
                <button key={c.code} onClick={() => { setCurrency(c.code); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 14px", background:currency===c.code?"rgba(0,229,160,0.1)":"transparent", border:"none", cursor:"pointer", color:currency===c.code?"#00e5a0":"#e6edf3", fontSize:13, fontWeight:currency===c.code?700:400 }}>
                  <span style={{ fontSize:17, minWidth:24, textAlign:"center", fontWeight:800 }}>{c.symbol}</span>
                  <div style={{ flex:1, textAlign:"left" }}>
                    <div style={{ fontWeight:600 }}>{c.code}</div>
                    <div style={{ fontSize:10, color:"#4a7fa5" }}>{c.name}</div>
                  </div>
                  <div style={{ fontSize:10, color:"#4a7fa5", textAlign:"right" }}>
                    {c.code==="BDT" ? "Base" : bdtPer ? `৳ ${bdtPer.toFixed(2)}` : "—"}
                  </div>
                  {currency===c.code && <span style={{ color:"#00e5a0", fontSize:13, marginLeft:4 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline Edit ───────────────────────────────────────────────
function InlineEdit({ item, fields, onSave, onCancel, t, currency, rates }) {
  const [vals, setVals] = useState(() => {
    const o = {};
    fields.forEach(f => {
      if (f.isAmount) {
        const d = fromBase(item[f.key], currency, rates);
        o[f.key] = d === 0 ? "" : parseFloat(d.toFixed(currency==="JPY"?0:2)).toString();
      } else {
        o[f.key] = item[f.key] ?? "";
      }
    });
    return o;
  });
  const handleSave = () => {
    const out = {};
    fields.forEach(f => { out[f.key] = f.isAmount ? toBase(vals[f.key], currency, rates) : vals[f.key]; });
    onSave(out);
  };
  return (
    <div style={{ background:t.inputBg, border:`1px solid #00e5a040`, borderRadius:12, padding:16, marginTop:12 }}>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, color:t.subText, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>
            {f.label}{f.isAmount ? ` (${currSym(currency)})` : ""}
          </div>
          {f.type==="select"
            ? <select style={iSt(t)} value={vals[f.key]} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))}>{f.options.map(o=><option key={o}>{o}</option>)}</select>
            : <input style={iSt(t)} type={f.type||"text"} value={vals[f.key]} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))} />}
        </div>
      ))}
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <button onClick={handleSave} style={{...bSt("#00e5a0"),padding:"7px 16px",fontSize:12}}>✅ Save</button>
        <button onClick={onCancel} style={{...bSt("#4a7fa5"),padding:"7px 16px",fontSize:12}}>Cancel</button>
      </div>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(null);
  const [finance,     setFinance]     = useState(defaultFinance);
  const [settings,    setSettings]    = useState({ currency:"BDT", theme:"dark" });
  const [profile,     setProfile]     = useState({ customName:"" });
  const [rates,       setRates]       = useState(DEFAULT_RATES);
  const [ratesLoading,setRatesLoading]= useState(true);
  const [syncing,     setSyncing]     = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab,         setTab]         = useState("dashboard");
  const [page,        setPage]        = useState("main");
  const [confirm,     setConfirm]     = useState(null);

  const isMobile = useIsMobile();
  const t        = THEMES[settings.theme] || THEMES.dark;
  const currency = settings.currency || "BDT";
  const theme    = settings.theme    || "dark";
  const dispName = profile.customName || user?.displayName || user?.email?.split("@")[0] || "User";
  const fname    = firstName(dispName);
  const f        = n => fmtAmt(n, currency, rates);

  // Fetch live exchange rates
  useEffect(() => {
    const fetchRates = async () => {
      try {
        setRatesLoading(true);
        const res  = await fetch("https://open.er-api.com/v6/latest/USD");
        const json = await res.json();
        if (json?.rates) setRates(json.rates);
      } catch {}
      finally { setRatesLoading(false); }
    };
    fetchRates();
    const iv = setInterval(fetchRates, 30*60*1000);
    return () => clearInterval(iv);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        setSyncing(true);
        const cloud = await loadFromCloud(u.uid);
        setFinance(cloud.finance);
        setSettings(cloud.settings);
        setProfile(cloud.profile);
        setSyncing(false);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Auto-save
  useEffect(() => {
    if (!user) return;
    setSyncing(true);
    const timer = setTimeout(async () => {
      await saveToCloud(user.uid, finance, settings, profile);
      setSyncing(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [finance, settings, profile, user]);

  const login  = () => signInWithPopup(auth, provider);
  const logout = () => { signOut(auth); setFinance(defaultFinance); setProfile({ customName:"" }); setSettings({ currency:"BDT", theme:"dark" }); setTab("dashboard"); setPage("main"); };
  const setSetting = (key, val) => setSettings(s => ({...s, [key]:val}));

  // Data ops
  const addItem         = (type, item)        => setFinance(d => ({...d, [type]:[item,...d[type]]}));
  const updateItem      = (type, id, fields)  => setFinance(d => ({...d, [type]:d[type].map(i=>i.id===id?{...i,...fields}:i)}));
  const deleteItem      = (type, id)          => setFinance(d => ({...d, [type]:d[type].filter(i=>i.id!==id)}));
  const confirmDelete   = (type, id, name)    => setConfirm({ message:`"${name}" will be permanently deleted.`, onConfirm:()=>{ deleteItem(type,id); setConfirm(null); } });

  const markPaid = id => {
    const it = finance.pending.find(p=>p.id===id);
    if (!it) return;
    setFinance(d => ({ ...d, pending:d.pending.filter(p=>p.id!==id), income:[{ ...it, id:Date.now(), date:today(), category:"Project", note:"From pending: "+it.client }, ...d.income] }));
  };
  const completePlan = (id, completionDate) => {
    const plan = finance.plans.find(p=>p.id===id);
    if (!plan) return;
    setFinance(d => ({ ...d, plans:d.plans.map(p=>p.id===id?{...p,completed:true,completionDate}:p), expenses:[{ id:Date.now(), category:plan.category||"Other", amount:plan.budget, date:completionDate, note:"From plan: "+plan.title }, ...d.expenses] }));
  };

  const totalIncome   = finance.income.reduce((s,i)=>s+Number(i.amount),0);
  const totalExpenses = finance.expenses.reduce((s,i)=>s+Number(i.amount),0);
  const totalPending  = finance.pending.reduce((s,i)=>s+Number(i.amount),0);
  const netBalance    = totalIncome - totalExpenses;
  const thisMonth     = new Date().toISOString().slice(0,7);
  const monthIncome   = finance.income.filter(i=>i.date?.startsWith(thisMonth)).reduce((s,i)=>s+Number(i.amount),0);
  const monthExpenses = finance.expenses.filter(i=>i.date?.startsWith(thisMonth)).reduce((s,i)=>s+Number(i.amount),0);

  if (authLoading) return <Splash t={t} />;
  if (!user)       return <LoginScreen onGoogleLogin={login} />;

  const tabs = [
    { id:"dashboard", label:"📊 Dashboard" },
    { id:"income",    label:"💚 Income"    },
    { id:"pending",   label:"⏳ Pending"   },
    { id:"expenses",  label:"🔴 Expenses"  },
    { id:"plans",     label:"🎯 Plans"     },
  ];

  const commonProps = { f, t, currency, rates };

  return (
    <div style={{ minHeight:"100vh", background:t.pageBg, fontFamily:"'Segoe UI',system-ui,sans-serif", color:t.text, transition:"background 0.3s" }}>
      <SyncToast show={syncing} />
      {confirm && <ConfirmPopup message={confirm.message} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)} t={t} />}

      {/* Profile / Settings overlays */}
      {page==="profile"  && <ProfilePage  user={user} profile={profile} setProfile={setProfile} finance={finance} f={f} t={t} currency={currency} rates={rates} onClose={()=>setPage("main")} />}
      {page==="settings" && <SettingsPage settings={settings} setSetting={setSetting} t={t} onClose={()=>setPage("main")} />}

      {/* ── Floating Header ── */}
      <div style={{ padding:"14px 14px 0", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ background:t.headerBg, border:`1px solid ${t.headerBorder}`, borderRadius:18, padding:isMobile?"10px 14px":"11px 18px", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", boxShadow:"0 8px 32px rgba(0,0,0,0.15)" }}>
          {isMobile ? (
            // ── Mobile: 2-row layout ──
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Ico name="wallet" size={18} color="#00e5a0" />
                  <span style={{ fontSize:16, fontWeight:800, color:"#00e5a0", letterSpacing:"-0.5px" }}>Finance Flow</span>
                  <CurrencyDropdown currency={currency} setCurrency={c=>setSetting("currency",c)} rates={rates} ratesLoading={ratesLoading} />
                </div>
                <HamburgerMenu onLogout={logout} onProfile={()=>setPage("profile")} onSettings={()=>setPage("settings")} theme={theme} setTheme={v=>setSetting("theme",v)} t={t} />
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ background:"rgba(0,229,160,0.1)", border:"1px solid rgba(0,229,160,0.3)", borderRadius:10, padding:"5px 11px", fontSize:12, fontWeight:700, color:"#00e5a0" }}>
                  Net: {f(netBalance)}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <span style={{ fontSize:12, color:t.dimText }}>{fname}</span>
                  <UserAvatar photoURL={user.photoURL} size={28} t={t} />
                </div>
              </div>
            </div>
          ) : (
            // ── Desktop: 1-row layout ──
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Ico name="wallet" size={20} color="#00e5a0" />
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#00e5a0", letterSpacing:"-0.5px", lineHeight:1.2 }}>Finance Flow</div>
                  <div style={{ fontSize:10, color:t.subText }}>Personal finance manager</div>
                </div>
                <CurrencyDropdown currency={currency} setCurrency={c=>setSetting("currency",c)} rates={rates} ratesLoading={ratesLoading} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ background:"rgba(0,229,160,0.1)", border:"1px solid rgba(0,229,160,0.3)", borderRadius:10, padding:"6px 12px", fontSize:13, fontWeight:700, color:"#00e5a0", whiteSpace:"nowrap" }}>
                  Net: {f(netBalance)}
                </div>
                <UserAvatar photoURL={user.photoURL} size={30} t={t} />
                <span style={{ fontSize:12, color:t.dimText, maxWidth:72, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fname}</span>
                <HamburgerMenu onLogout={logout} onProfile={()=>setPage("profile")} onSettings={()=>setPage("settings")} theme={theme} setTheme={v=>setSetting("theme",v)} t={t} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:"flex", justifyContent:"center", padding:"12px 14px 0" }}>
        <div style={{ display:"flex", gap:4, overflowX:"auto", scrollbarWidth:"none", WebkitOverflowScrolling:"touch", background:t.tabBg, borderRadius:14, padding:"5px 6px", backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)" }}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={()=>setTab(tb.id)} style={{ background:tab===tb.id?t.tabActive:"transparent", border:`1px solid ${tab===tb.id?t.tabActiveBorder:"transparent"}`, color:tab===tb.id?t.tabActiveText:t.tabInactive, borderRadius:10, padding:"8px 16px", cursor:"pointer", fontSize:13, fontWeight:tab===tb.id?700:400, whiteSpace:"nowrap", transition:"all 0.2s", flexShrink:0 }}>{tb.label}</button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:820, margin:"0 auto", padding:"14px 14px 48px" }}>
        {tab==="dashboard" && <Dashboard totalIncome={totalIncome} totalPending={totalPending} totalExpenses={totalExpenses} netBalance={netBalance} monthIncome={monthIncome} monthExpenses={monthExpenses} finance={finance} fname={fname} {...commonProps} />}
        {tab==="income"    && <IncomeTab   data={finance.income}   onAdd={i=>addItem("income",i)}   onUpdate={(id,v)=>updateItem("income",id,v)}   onDelete={(id,n)=>confirmDelete("income",id,n)}   {...commonProps} />}
        {tab==="pending"   && <PendingTab  data={finance.pending}  onAdd={i=>addItem("pending",i)}  onMarkPaid={markPaid} onUpdate={(id,v)=>updateItem("pending",id,v)} onDelete={(id,n)=>confirmDelete("pending",id,n)}  {...commonProps} />}
        {tab==="expenses"  && <ExpensesTab data={finance.expenses} onAdd={i=>addItem("expenses",i)} onUpdate={(id,v)=>updateItem("expenses",id,v)} onDelete={(id,n)=>confirmDelete("expenses",id,n)} {...commonProps} />}
        {tab==="plans"     && <PlansTab    data={finance.plans}    onAdd={i=>addItem("plans",i)}    onUpdate={(id,v)=>updateItem("plans",id,v)}    onDelete={(id,n)=>confirmDelete("plans",id,n)}    onComplete={completePlan} {...commonProps} />}
      </div>
    </div>
  );
}

// ── SPLASH ────────────────────────────────────────────────────
function Splash({ t }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0d1117", gap:16 }}>
      <Ico name="wallet" size={52} color="#00e5a0" />
      <div style={{ color:"#00e5a0", fontWeight:800, fontSize:22 }}>Finance Flow</div>
      <div style={{ color:"#4a7fa5", fontSize:13 }}>Loading your data…</div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
function LoginScreen({ onGoogleLogin }) {
  const [mode,     setMode]     = useState("signin");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const errMap = { "auth/user-not-found":"No account found with this email.", "auth/wrong-password":"Incorrect password.", "auth/email-already-in-use":"Email already registered. Sign in instead.", "auth/weak-password":"Password must be at least 6 characters.", "auth/invalid-email":"Please enter a valid email.", "auth/too-many-requests":"Too many attempts. Please try again later.", "auth/invalid-credential":"Incorrect email or password." };

  const handleEmail = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (mode==="signup" && !name.trim()) { setError("Please enter your full name."); return; }
    setLoading(true); setError("");
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch(e) { setError(errMap[e.code] || "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const inp = { width:"100%", background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:10, color:"#e6edf3", padding:"11px 14px", fontSize:14, boxSizing:"border-box", outline:"none", marginBottom:0 };

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"linear-gradient(135deg,#0d1117 0%,#0f1923 100%)", fontFamily:"'Segoe UI',system-ui,sans-serif", padding:20 }}>
      <div style={{ textAlign:"center", maxWidth:400, width:"100%" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}><Ico name="wallet" size={54} color="#00e5a0" /></div>
        <div style={{ fontSize:32, fontWeight:900, color:"#00e5a0", letterSpacing:"-1px", marginBottom:8 }}>Finance Flow</div>
        <div style={{ fontSize:14, color:"#4a7fa5", marginBottom:28, lineHeight:1.6 }}>Your personal finance manager.<br/>Track income, pending & expenses.</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, justifyContent:"center", marginBottom:28 }}>
          {["💚 Income","⏳ Pending","🔴 Expenses","🎯 Plans","☁️ Cloud Sync","🔒 Private"].map(lbl=>(
            <div key={lbl} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid #1e3a5f", borderRadius:99, padding:"4px 12px", fontSize:11, color:"#6b8fa8" }}>{lbl}</div>
          ))}
        </div>
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid #1e3a5f", borderRadius:20, padding:"26px 22px" }}>
          {/* Mode toggle */}
          <div style={{ display:"flex", background:"rgba(255,255,255,0.05)", borderRadius:12, padding:4, marginBottom:20 }}>
            {["signin","signup"].map(m=>(
              <button key={m} onClick={()=>{ setMode(m); setError(""); }} style={{ flex:1, padding:"9px", background:mode===m?"rgba(0,229,160,0.18)":"transparent", border:mode===m?"1px solid rgba(0,229,160,0.4)":"1px solid transparent", borderRadius:10, color:mode===m?"#00e5a0":"#4a7fa5", cursor:"pointer", fontSize:13, fontWeight:mode===m?700:400, transition:"all 0.2s" }}>
                {m==="signin"?"Sign In":"Create Account"}
              </button>
            ))}
          </div>
          {/* Fields */}
          {mode==="signup" && (
            <div style={{ marginBottom:12, textAlign:"left" }}>
              <div style={{ fontSize:10, color:"#4a7fa5", marginBottom:5, textTransform:"uppercase", letterSpacing:1 }}>Full Name</div>
              <input value={name} onChange={e=>{setName(e.target.value);setError("");}} placeholder="e.g. Shakil Ahmed" style={inp} />
            </div>
          )}
          <div style={{ marginBottom:12, textAlign:"left" }}>
            <div style={{ fontSize:10, color:"#4a7fa5", marginBottom:5, textTransform:"uppercase", letterSpacing:1 }}>Email</div>
            <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} placeholder="you@example.com" style={inp} />
          </div>
          <div style={{ marginBottom:error?10:18, textAlign:"left" }}>
            <div style={{ fontSize:10, color:"#4a7fa5", marginBottom:5, textTransform:"uppercase", letterSpacing:1 }}>Password</div>
            <input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}} placeholder={mode==="signup"?"Min. 6 characters":"Enter your password"} onKeyDown={e=>e.key==="Enter"&&handleEmail()} style={inp} />
          </div>
          {error && <div style={{ fontSize:12, color:"#ff5c5c", background:"rgba(255,92,92,0.1)", border:"1px solid #ff5c5c30", borderRadius:8, padding:"8px 12px", marginBottom:14, textAlign:"left" }}>⚠️ {error}</div>}
          <button onClick={handleEmail} disabled={loading} style={{ width:"100%", padding:"13px", background:loading?"rgba(0,229,160,0.07)":"rgba(0,229,160,0.18)", border:"1px solid rgba(0,229,160,0.5)", borderRadius:12, color:"#00e5a0", cursor:loading?"not-allowed":"pointer", fontSize:14, fontWeight:700, marginBottom:14 }}>
            {loading ? "Please wait…" : mode==="signup"?"Create Account":"Sign In"}
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ flex:1, height:1, background:"#1e3a5f" }}/><div style={{ fontSize:11, color:"#4a7fa5" }}>or</div><div style={{ flex:1, height:1, background:"#1e3a5f" }}/>
          </div>
          <button onClick={onGoogleLogin} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, width:"100%", padding:"13px 20px", background:"white", border:"none", borderRadius:12, cursor:"pointer", fontSize:14, fontWeight:700, color:"#1a1a1a", boxShadow:"0 4px 20px rgba(0,0,0,0.25)", transition:"transform 0.2s" }}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";}}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>
        </div>
        <div style={{ fontSize:11, color:"#2a4a65", marginTop:16 }}>Join free today · Your data stays private · No credit card needed</div>
      </div>
    </div>
  );
}

// ── PROFILE PAGE ──────────────────────────────────────────────
function ProfilePage({ user, profile, setProfile, finance, f, t, currency, rates, onClose }) {
  const dispName  = profile.customName || user?.displayName || user?.email?.split("@")[0] || "User";
  const [editing, setEditing]   = useState(false);
  const [nameVal, setNameVal]   = useState(dispName);
  const [saving,  setSaving]    = useState(false);

  const totalIncome   = finance.income.reduce((s,i)=>s+Number(i.amount),0);
  const totalExpenses = finance.expenses.reduce((s,i)=>s+Number(i.amount),0);
  const totalSavings  = totalIncome - totalExpenses;

  const totalIncomeUSD = totalIncome / (rates?.BDT || 110);
  const curLvl  = getLevel(totalIncomeUSD);
  const nextLvl = LEVELS[LEVELS.indexOf(curLvl)+1];
  const progress= nextLvl ? Math.min(100, ((totalIncomeUSD - curLvl.minUSD)/(nextLvl.minUSD - curLvl.minUSD))*100) : 100;

  const allDates = [...finance.income,...finance.expenses].map(i=>i.date).filter(Boolean).sort();
  const firstDate = allDates.length ? new Date(allDates[0]) : new Date();
  const monthsCount = Math.max(1, (new Date()-firstDate)/(1000*60*60*24*30.44));
  const avgIncome   = totalIncome / monthsCount;
  const avgExpenses = totalExpenses / monthsCount;
  const avgSavings  = avgIncome - avgExpenses;

  const saveName = async () => {
    setSaving(true);
    try { if (user) await updateProfile(user, { displayName: nameVal.trim() }); } catch {}
    setProfile(p=>({...p, customName: nameVal.trim()}));
    setSaving(false); setEditing(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:t.pageBg, zIndex:9000, overflowY:"auto", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ padding:"14px 14px 0" }}>
        <div style={{ background:t.headerBg, border:`1px solid ${t.headerBorder}`, borderRadius:16, padding:"12px 18px", display:"flex", alignItems:"center", gap:12, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)" }}>
          <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:9, width:36, height:36, cursor:"pointer", color:t.text, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
          <div style={{ fontSize:17, fontWeight:800, color:t.text }}>Profile</div>
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"20px auto", padding:"0 14px 48px" }}>
        {/* Avatar + Name */}
        <div style={{ background:t.sectionBg, border:`1px solid ${t.sectionBorder}`, borderRadius:20, padding:28, textAlign:"center", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
            {user?.photoURL
              ? <img src={user.photoURL} style={{ width:80, height:80, borderRadius:"50%", border:"3px solid rgba(0,229,160,0.5)", objectFit:"cover" }} alt="" />
              : <div style={{ width:80, height:80, borderRadius:"50%", background:"white", display:"flex", alignItems:"center", justifyContent:"center", border:"3px solid rgba(0,229,160,0.4)" }}><Ico name="user" size={44} color="#888"/></div>
            }
          </div>
          {editing ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              <input value={nameVal} onChange={e=>setNameVal(e.target.value)} style={{ ...iSt(t), maxWidth:260, textAlign:"center", fontSize:16 }} placeholder="Your full name" />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={saveName} disabled={saving} style={{...bSt("#00e5a0"),padding:"7px 18px"}}>{saving?"Saving…":"✅ Save"}</button>
                <button onClick={()=>{setEditing(false);setNameVal(dispName);}} style={{...bSt("#4a7fa5"),padding:"7px 14px"}}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:22, fontWeight:800, color:t.text, marginBottom:4 }}>{dispName}</div>
              <div style={{ fontSize:13, color:t.subText, marginBottom:12 }}>{user?.email}</div>
              <button onClick={()=>setEditing(true)} style={{...bSt("#4a7fa5"),fontSize:12,padding:"6px 14px"}}>✏️ Edit Name</button>
            </div>
          )}
        </div>

        {/* Level */}
        <div style={{ background:`${curLvl.color}12`, border:`1px solid ${curLvl.color}40`, borderRadius:20, padding:24, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            <span style={{ fontSize:36 }}>{curLvl.emoji}</span>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:curLvl.color }}>{curLvl.name}</div>
              <div style={{ fontSize:12, color:t.subText }}>{curLvl.desc}</div>
            </div>
          </div>
          {nextLvl ? (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:t.subText, marginBottom:6 }}>
                <span>${curLvl.minUSD.toLocaleString()} earned</span>
                <span>Next: {nextLvl.emoji} {nextLvl.name} at ${nextLvl.minUSD.toLocaleString()}</span>
              </div>
              <div style={{ background:t.sectionBorder, borderRadius:99, height:10, overflow:"hidden" }}>
                <div style={{ width:progress+"%", background:curLvl.color, height:"100%", borderRadius:99, transition:"width 0.8s" }}/>
              </div>
              <div style={{ fontSize:11, color:t.subText, marginTop:5 }}>{progress.toFixed(1)}% to {nextLvl.name}</div>
            </>
          ) : (
            <div style={{ fontSize:13, color:curLvl.color, fontWeight:700 }}>🏆 Maximum level reached!</div>
          )}
          <div style={{ marginTop:12, fontSize:12, color:t.subText }}>
            Total earned (USD equiv.): <span style={{ color:curLvl.color, fontWeight:700 }}>${totalIncomeUSD.toLocaleString("en-US",{maximumFractionDigits:2})}</span>
          </div>
        </div>

        {/* All-time summary */}
        <div style={{ background:t.sectionBg, border:`1px solid ${t.sectionBorder}`, borderRadius:20, padding:24, marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>📊 All-Time Summary</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:12 }}>
            {[["💚 Total Earned", totalIncome, "#00e5a0"], ["🔴 Total Spent", totalExpenses, "#ff5c5c"], ["💰 Total Saved", totalSavings, totalSavings>=0?"#00e5a0":"#ff5c5c"]].map(([l,v,c])=>(
              <div key={l} style={{ background:`${c}10`, border:`1px solid ${c}30`, borderRadius:14, padding:"16px 14px" }}>
                <div style={{ fontSize:11, color:t.subText }}>{l}</div>
                <div style={{ fontSize:17, fontWeight:800, color:c, marginTop:4 }}>{f(v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly averages */}
        {monthsCount > 0.5 && (
          <div style={{ background:t.sectionBg, border:`1px solid ${t.sectionBorder}`, borderRadius:20, padding:24 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>📅 Monthly Averages</div>
            <div style={{ fontSize:11, color:t.subText, marginBottom:14 }}>Based on {Math.round(monthsCount)} month{Math.round(monthsCount)!==1?"s":""} of data</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:12 }}>
              {[["Avg. Earnings", avgIncome, "#00e5a0"], ["Avg. Costs", avgExpenses, "#ff5c5c"], ["Avg. Savings", avgSavings, avgSavings>=0?"#00e5a0":"#ff5c5c"]].map(([l,v,c])=>(
                <div key={l} style={{ background:`${c}10`, border:`1px solid ${c}30`, borderRadius:14, padding:"16px 14px" }}>
                  <div style={{ fontSize:11, color:t.subText }}>{l}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:c, marginTop:4 }}>{f(v)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SETTINGS PAGE ─────────────────────────────────────────────
function SettingsPage({ settings, setSetting, t, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:t.pageBg, zIndex:9000, overflowY:"auto", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ padding:"14px 14px 0" }}>
        <div style={{ background:t.headerBg, border:`1px solid ${t.headerBorder}`, borderRadius:16, padding:"12px 18px", display:"flex", alignItems:"center", gap:12, backdropFilter:"blur(16px)" }}>
          <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:9, width:36, height:36, cursor:"pointer", color:t.text, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
          <div style={{ fontSize:17, fontWeight:800, color:t.text }}>Settings</div>
        </div>
      </div>
      <div style={{ maxWidth:600, margin:"20px auto", padding:"0 14px 48px" }}>
        {/* Theme */}
        <div style={{ background:t.sectionBg, border:`1px solid ${t.sectionBorder}`, borderRadius:20, padding:24, marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>🎨 Appearance</div>
          <div style={{ fontSize:11, color:t.subText, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Theme</div>
          <div style={{ display:"flex", gap:10 }}>
            {[["dark","🌙 Dark","Space dark theme"],["light","☀️ Light","Clean light theme"]].map(([id,label,desc])=>(
              <button key={id} onClick={()=>setSetting("theme",id)} style={{ flex:1, padding:"14px 12px", background:settings.theme===id?"rgba(0,229,160,0.15)":"transparent", border:`1px solid ${settings.theme===id?"rgba(0,229,160,0.5)":t.cardBorder}`, borderRadius:14, cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{label.split(" ")[0]}</div>
                <div style={{ fontSize:13, fontWeight:700, color:settings.theme===id?"#00e5a0":t.text }}>{label.split(" ").slice(1).join(" ")}</div>
                <div style={{ fontSize:11, color:t.subText, marginTop:2 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
        {/* Default currency */}
        <div style={{ background:t.sectionBg, border:`1px solid ${t.sectionBorder}`, borderRadius:20, padding:24, marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>💱 Default Currency</div>
          <div style={{ fontSize:12, color:t.subText, marginBottom:14, lineHeight:1.5 }}>All amounts are entered and displayed in your selected currency. Data is stored in BDT and converted automatically.</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:8 }}>
            {CURRENCIES.map(c => (
              <button key={c.code} onClick={()=>setSetting("currency",c.code)} style={{ padding:"12px 8px", background:settings.currency===c.code?"rgba(0,229,160,0.15)":"transparent", border:`1px solid ${settings.currency===c.code?"rgba(0,229,160,0.5)":t.cardBorder}`, borderRadius:12, cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:settings.currency===c.code?"#00e5a0":t.text }}>{c.symbol}</div>
                <div style={{ fontSize:11, color:settings.currency===c.code?"#00e5a0":t.subText, marginTop:2 }}>{c.code}</div>
              </button>
            ))}
          </div>
        </div>
        {/* About */}
        <div style={{ background:t.sectionBg, border:`1px solid ${t.sectionBorder}`, borderRadius:20, padding:24 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>ℹ️ About</div>
          {[["App","Finance Flow"],["Version","2.0"],["Support","shakilxvs.wordpress.com"],["Data Storage","Firebase Cloud"]].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${t.cardBorder}`, fontSize:13 }}>
              <span style={{ color:t.subText }}>{k}</span>
              <span style={{ color:t.text, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({ totalIncome, totalPending, totalExpenses, netBalance, monthIncome, monthExpenses, finance, fname, f, t }) {
  const activePlans = (finance.plans||[]).filter(p=>!p.completed).length;
  const cards = [
    { label:"Total Income",    value:totalIncome,   color:"#00e5a0", icon:"💚" },
    { label:"Pending Payment", value:totalPending,  color:"#f0a500", icon:"⏳" },
    { label:"Total Expenses",  value:totalExpenses, color:"#ff5c5c", icon:"🔴" },
    { label:"Net Balance",     value:netBalance,    color:netBalance>=0?"#00e5a0":"#ff5c5c", icon:"💰" },
  ];
  const recentTx = [...(finance.income||[]).map(i=>({...i,type:"income"})), ...(finance.expenses||[]).map(i=>({...i,type:"expense"})), ...(finance.pending||[]).map(i=>({...i,type:"pending"}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  return (
    <div>
      <div style={{ fontSize:24, fontWeight:800, marginBottom:18, marginTop:6 }}>
        👋 Hey, {fname}!
        <span style={{ fontSize:13, color:t.subText, fontWeight:400, marginLeft:10 }}>{new Date().toLocaleString("default",{month:"long",year:"numeric"})}</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
        {cards.map(c=>(
          <div key={c.label} style={{ background:`${c.color}12`, border:`1px solid ${c.color}30`, borderRadius:18, padding:"20px 18px" }}>
            <div style={{ fontSize:24 }}>{c.icon}</div>
            <div style={{ fontSize:10, color:t.subText, marginTop:10, textTransform:"uppercase", letterSpacing:1 }}>{c.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:c.color, marginTop:4 }}>{f(c.value)}</div>
          </div>
        ))}
      </div>
      {activePlans > 0 && <div style={{ background:"rgba(147,112,219,0.08)", border:"1px solid rgba(147,112,219,0.3)", borderRadius:16, padding:"13px 18px", marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:24 }}>🎯</span>
        <div><div style={{ fontSize:14, fontWeight:700, color:"#9370db" }}>{activePlans} Active Plan{activePlans>1?"s":""}</div><div style={{ fontSize:12, color:t.subText }}>Budget plans in progress</div></div>
      </div>}
      <div style={{ background:t.sectionBg, border:`1px solid ${t.sectionBorder}`, borderRadius:18, padding:20, marginBottom:12 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>📅 This Month</div>
        <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
          {[["EARNED",monthIncome,"#00e5a0"],["SPENT",monthExpenses,"#ff5c5c"],["SAVED",monthIncome-monthExpenses,monthIncome-monthExpenses>=0?"#00e5a0":"#ff5c5c"]].map(([l,v,c])=>(
            <div key={l}><div style={{ fontSize:11, color:t.subText }}>{l}</div><div style={{ fontSize:22, fontWeight:800, color:c }}>{f(v)}</div></div>
          ))}
        </div>
        {monthIncome > 0 && <div style={{ marginTop:14 }}>
          <div style={{ background:t.sectionBorder, borderRadius:99, height:8, overflow:"hidden" }}>
            <div style={{ width:Math.min(100,(monthExpenses/monthIncome)*100)+"%", background:monthExpenses/monthIncome>0.8?"#ff5c5c":"#00e5a0", height:"100%", borderRadius:99, transition:"width 0.6s" }}/>
          </div>
          <div style={{ fontSize:11, color:t.subText, marginTop:5 }}>{Math.round((monthExpenses/monthIncome)*100)}% of income spent</div>
        </div>}
      </div>
      <div style={{ background:t.sectionBg, border:`1px solid ${t.sectionBorder}`, borderRadius:18, padding:20 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>🕐 Recent Transactions</div>
        {recentTx.length===0 && <div style={{ color:t.subText, fontSize:13 }}>No transactions yet. Add some!</div>}
        {recentTx.map(tx=>(
          <div key={tx.id+tx.type} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom:`1px solid ${t.sectionBorder}` }}>
            <div><div style={{ fontSize:13, fontWeight:600 }}>{tx.type==="income"?"💚":tx.type==="pending"?"⏳":"🔴"} {tx.client||tx.category||"—"}</div><div style={{ fontSize:11, color:t.subText }}>{tx.date}</div></div>
            <div style={{ fontWeight:800, fontSize:14, color:tx.type==="income"?"#00e5a0":tx.type==="pending"?"#f0a500":"#ff5c5c" }}>{tx.type==="expense"?"−":"+"}{f(tx.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── INCOME TAB ────────────────────────────────────────────────
function IncomeTab({ data, onAdd, onUpdate, onDelete, f, t, currency, rates }) {
  const [form, setForm]     = useState({ client:"", amount:"", date:today(), category:"Project", note:"" });
  const [show, setShow]     = useState(false);
  const [editId, setEditId] = useState(null);
  const sym   = currSym(currency);
  const total = data.reduce((s,i)=>s+Number(i.amount),0);
  const submit = () => {
    if (!form.client || !form.amount) return;
    onAdd({ ...form, amount:toBase(form.amount,currency,rates), id:Date.now() });
    setForm({ client:"", amount:"", date:today(), category:"Project", note:"" }); setShow(false);
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <div style={{ fontSize:22, fontWeight:800 }}>💚 Income</div>
        <button onClick={()=>setShow(!show)} style={bSt("#00e5a0")}>+ Add Income</button>
      </div>
      <div style={{ fontSize:13, color:"#00e5a0", fontWeight:700, marginBottom:18 }}>Total Income: {f(total)}</div>
      {show && <FormCard color="#00e5a0" t={t}>
        <FR label="Client / Source" t={t}><input style={iSt(t)} value={form.client} onChange={e=>setForm(v=>({...v,client:e.target.value}))} placeholder="e.g. Fiverr Client" /></FR>
        <FR label={`Amount (${sym})`} t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))} placeholder="5000" /></FR>
        <FR label="Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))} /></FR>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{INCOME_CATS.map(c=><option key={c}>{c}</option>)}</select></FR>
        <FR label="Note (optional)" t={t}><input style={iSt(t)} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="e.g. Logo design project" /></FR>
        <div style={{ display:"flex", gap:10, marginTop:14 }}><button onClick={submit} style={bSt("#00e5a0")}>✅ Save</button><button onClick={()=>setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {data.length===0 && !show && <ES t={t} text="No income yet. Add your first!" />}
      {data.map(item=>(
        <Card key={item.id} color="#00e5a0" t={t}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:700, fontSize:14, color:t.text }}>{item.client}</div><div style={{ fontSize:11, color:t.subText, marginTop:2 }}>{item.date} · {item.category}{item.note?" · "+item.note:""}</div></div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:10 }}>
              <div style={{ fontWeight:800, color:"#00e5a0", fontSize:15, whiteSpace:"nowrap" }}>{f(item.amount)}</div>
              <ThreeDotMenu t={t} options={[{ icon:"✏️ ", label:"Edit", action:()=>setEditId(editId===item.id?null:item.id) }, { icon:"🗑️ ", label:"Delete", danger:true, action:()=>onDelete(item.id,item.client) }]} />
            </div>
          </div>
          {editId===item.id && <InlineEdit t={t} currency={currency} rates={rates} item={item} fields={[{ key:"client", label:"Client / Source" },{ key:"amount", label:"Amount", isAmount:true },{ key:"date", label:"Date", type:"date" },{ key:"category", label:"Category", type:"select", options:INCOME_CATS },{ key:"note", label:"Note" }]} onSave={v=>{onUpdate(item.id,v);setEditId(null);}} onCancel={()=>setEditId(null)} />}
        </Card>
      ))}
    </div>
  );
}

// ── PENDING TAB ───────────────────────────────────────────────
function PendingTab({ data, onAdd, onMarkPaid, onUpdate, onDelete, f, t, currency, rates }) {
  const [form, setForm]     = useState({ client:"", amount:"", date:today(), dueDate:"", note:"" });
  const [show, setShow]     = useState(false);
  const [editId, setEditId] = useState(null);
  const sym   = currSym(currency);
  const total = data.reduce((s,i)=>s+Number(i.amount),0);
  const submit = () => {
    if (!form.client || !form.amount) return;
    onAdd({ ...form, amount:toBase(form.amount,currency,rates), id:Date.now() });
    setForm({ client:"", amount:"", date:today(), dueDate:"", note:"" }); setShow(false);
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <div style={{ fontSize:22, fontWeight:800 }}>⏳ Pending</div>
        <button onClick={()=>setShow(!show)} style={bSt("#f0a500")}>+ Add Pending</button>
      </div>
      <div style={{ fontSize:13, color:"#f0a500", fontWeight:700, marginBottom:18 }}>Total Awaiting: {f(total)}</div>
      {show && <FormCard color="#f0a500" t={t}>
        <FR label="Client Name" t={t}><input style={iSt(t)} value={form.client} onChange={e=>setForm(v=>({...v,client:e.target.value}))} placeholder="e.g. XYZ Company" /></FR>
        <FR label={`Amount (${sym})`} t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))} placeholder="10000" /></FR>
        <FR label="Invoice Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))} /></FR>
        <FR label="Due Date" t={t}><input style={iSt(t)} type="date" value={form.dueDate} onChange={e=>setForm(v=>({...v,dueDate:e.target.value}))} /></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="e.g. Website project final payment" /></FR>
        <div style={{ display:"flex", gap:10, marginTop:14 }}><button onClick={submit} style={bSt("#f0a500")}>✅ Save</button><button onClick={()=>setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {data.length===0 && !show && <ES t={t} text="No pending payments 🎉 All clear!" />}
      {data.map(item=>{
        const overdue = item.dueDate && new Date(item.dueDate) < new Date();
        return (
          <div key={item.id} style={{ background:"rgba(240,165,0,0.07)", border:`1px solid ${overdue?"#ff5c5c50":"#f0a50035"}`, borderRadius:14, padding:16, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:15, color:t.text }}>{item.client}</div>
                {item.note && <div style={{ fontSize:12, color:t.subText, marginTop:2 }}>{item.note}</div>}
                <div style={{ fontSize:11, color:t.subText, marginTop:3 }}>Invoice: {item.date}{item.dueDate && <span style={{ color:overdue?"#ff5c5c":t.subText, marginLeft:8 }}>{overdue?"⚠️ Overdue: ":"Due: "}{item.dueDate}</span>}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:6 }}>
                <div style={{ fontWeight:800, color:"#f0a500", fontSize:15, whiteSpace:"nowrap" }}>{f(item.amount)}</div>
                <ThreeDotMenu t={t} options={[{ icon:"✅ ", label:"Mark as Paid", action:()=>onMarkPaid(item.id) }, { icon:"✏️ ", label:"Edit", action:()=>setEditId(editId===item.id?null:item.id) }, { icon:"🗑️ ", label:"Delete", danger:true, action:()=>onDelete(item.id,item.client) }]} />
              </div>
            </div>
            {editId===item.id && <InlineEdit t={t} currency={currency} rates={rates} item={item} fields={[{ key:"client", label:"Client Name" },{ key:"amount", label:"Amount", isAmount:true },{ key:"date", label:"Invoice Date", type:"date" },{ key:"dueDate", label:"Due Date", type:"date" },{ key:"note", label:"Note" }]} onSave={v=>{onUpdate(item.id,v);setEditId(null);}} onCancel={()=>setEditId(null)} />}
          </div>
        );
      })}
    </div>
  );
}

// ── EXPENSES TAB ──────────────────────────────────────────────
function ExpensesTab({ data, onAdd, onUpdate, onDelete, f, t, currency, rates }) {
  const [form, setForm]           = useState({ category:"Food", amount:"", date:today(), note:"" });
  const [show, setShow]           = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [mFilter, setMFilter]     = useState("All");
  const [editId, setEditId]       = useState(null);
  const sym      = currSym(currency);
  const months   = ["All", ...Array.from(new Set(data.map(i=>i.date?.slice(0,7)).filter(Boolean))).sort().reverse()];
  const filtered = data.filter(i=>(catFilter==="All"||i.category===catFilter)&&(mFilter==="All"||i.date?.startsWith(mFilter)));
  const filtTotal = filtered.reduce((s,i)=>s+Number(i.amount),0);
  const pMonth = m => m==="All" ? "All Months" : new Date(m+"-01").toLocaleString("default",{month:"short",year:"numeric"});
  const submit = () => {
    if (!form.amount) return;
    onAdd({ ...form, amount:toBase(form.amount,currency,rates), id:Date.now() });
    setForm({ category:"Food", amount:"", date:today(), note:"" }); setShow(false);
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div style={{ fontSize:22, fontWeight:800 }}>🔴 Expenses</div>
        <button onClick={()=>setShow(!show)} style={bSt("#ff5c5c")}>+ Add Expense</button>
      </div>
      {show && <FormCard color="#ff5c5c" t={t}>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}</select></FR>
        <FR label={`Amount (${sym})`} t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))} placeholder="500" /></FR>
        <FR label="Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))} /></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="e.g. Lunch with client" /></FR>
        <div style={{ display:"flex", gap:10, marginTop:14 }}><button onClick={submit} style={bSt("#ff5c5c")}>✅ Save</button><button onClick={()=>setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      <Pills label="📅 Month" values={months} active={mFilter} setActive={setMFilter} color="#00e5a0" pretty={pMonth} t={t} />
      <Pills label="🏷 Category" values={["All",...EXPENSE_CATS]} active={catFilter} setActive={setCatFilter} color="#ff5c5c" t={t} />
      {filtered.length>0 && <div style={{ fontSize:13, color:"#ff5c5c", marginBottom:12, fontWeight:700 }}>Showing {filtered.length} · Total: {f(filtTotal)}</div>}
      {filtered.length===0 && <ES t={t} text="No expenses here. Great job! 🎉" />}
      {filtered.map(item=>(
        <Card key={item.id} color="#ff5c5c" t={t}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:700, fontSize:14, color:t.text }}>{item.category}</div><div style={{ fontSize:11, color:t.subText, marginTop:2 }}>{item.date}{item.note?" · "+item.note:""}</div></div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:10 }}>
              <div style={{ fontWeight:800, color:"#ff5c5c", fontSize:15, whiteSpace:"nowrap" }}>{f(item.amount)}</div>
              <ThreeDotMenu t={t} options={[{ icon:"✏️ ", label:"Edit", action:()=>setEditId(editId===item.id?null:item.id) }, { icon:"🗑️ ", label:"Delete", danger:true, action:()=>onDelete(item.id,item.category) }]} />
            </div>
          </div>
          {editId===item.id && <InlineEdit t={t} currency={currency} rates={rates} item={item} fields={[{ key:"category", label:"Category", type:"select", options:EXPENSE_CATS },{ key:"amount", label:"Amount", isAmount:true },{ key:"date", label:"Date", type:"date" },{ key:"note", label:"Note" }]} onSave={v=>{onUpdate(item.id,v);setEditId(null);}} onCancel={()=>setEditId(null)} />}
        </Card>
      ))}
    </div>
  );
}

// ── PLANS TAB ─────────────────────────────────────────────────
function PlansTab({ data, onAdd, onUpdate, onDelete, onComplete, f, t, currency, rates }) {
  const [form, setForm]                 = useState({ title:"", budget:"", category:"Equipment", dueDate:"", note:"" });
  const [show, setShow]                 = useState(false);
  const [editId, setEditId]             = useState(null);
  const [completeId, setCompleteId]     = useState(null);
  const [completeDate, setCompleteDate] = useState(today());
  const sym         = currSym(currency);
  const active      = data.filter(p=>!p.completed);
  const completed   = data.filter(p=>p.completed);
  const totalBudget = active.reduce((s,p)=>s+Number(p.budget),0);
  const submit = () => {
    if (!form.title || !form.budget) return;
    onAdd({ ...form, budget:toBase(form.budget,currency,rates), id:Date.now(), completed:false });
    setForm({ title:"", budget:"", category:"Equipment", dueDate:"", note:"" }); setShow(false);
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <div style={{ fontSize:22, fontWeight:800 }}>🎯 Plans</div>
        <button onClick={()=>setShow(!show)} style={bSt("#9370db")}>+ Add Plan</button>
      </div>
      <div style={{ fontSize:13, color:"#9370db", fontWeight:700, marginBottom:18 }}>Total Budget: {f(totalBudget)}</div>
      {show && <FormCard color="#9370db" t={t}>
        <FR label="Plan Title" t={t}><input style={iSt(t)} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="e.g. Buy new MacBook" /></FR>
        <FR label={`Budget (${sym})`} t={t}><input style={iSt(t)} type="number" value={form.budget} onChange={e=>setForm(v=>({...v,budget:e.target.value}))} placeholder="1500" /></FR>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{PLAN_CATS.map(c=><option key={c}>{c}</option>)}</select></FR>
        <FR label="Target Date" t={t}><input style={iSt(t)} type="date" value={form.dueDate} onChange={e=>setForm(v=>({...v,dueDate:e.target.value}))} /></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="e.g. For video editing work" /></FR>
        <div style={{ display:"flex", gap:10, marginTop:14 }}><button onClick={submit} style={bSt("#9370db")}>✅ Save</button><button onClick={()=>setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {/* Complete date popup */}
      {completeId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:t.popupBg, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:30, maxWidth:320, width:"100%", textAlign:"center", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize:38, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:17, fontWeight:800, color:t.text, marginBottom:6 }}>Mark as Completed!</div>
            <div style={{ fontSize:13, color:t.subText, marginBottom:20 }}>This will add the budget as an expense.</div>
            <FR label="Completion Date" t={t}><input type="date" value={completeDate} onChange={e=>setCompleteDate(e.target.value)} style={{ ...iSt(t), width:"100%" }} /></FR>
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={()=>setCompleteId(null)} style={{ flex:1, padding:"11px", background:"transparent", border:`1px solid ${t.cardBorder}`, borderRadius:12, color:t.subText, cursor:"pointer", fontSize:13 }}>Cancel</button>
              <button onClick={()=>{ onComplete(completeId,completeDate); setCompleteId(null); }} style={{ flex:1, padding:"11px", background:"rgba(0,229,160,0.15)", border:"1px solid #00e5a060", borderRadius:12, color:"#00e5a0", cursor:"pointer", fontSize:13, fontWeight:700 }}>✅ Confirm</button>
            </div>
          </div>
        </div>
      )}
      {active.length===0 && !show && <ES t={t} text="No plans yet. Add your first budget plan! 🎯" />}
      {active.map(item=>(
        <div key={item.id} style={{ background:"rgba(147,112,219,0.07)", border:"1px solid rgba(147,112,219,0.28)", borderRadius:14, padding:16, marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:15, color:t.text }}>{item.title}</div>
              <div style={{ fontSize:11, color:t.subText, marginTop:2 }}>{item.category}{item.note?" · "+item.note:""}</div>
              {item.dueDate && <div style={{ fontSize:11, color:t.subText, marginTop:2 }}>🗓 Target: {item.dueDate}</div>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:6 }}>
              <div style={{ fontWeight:800, color:"#9370db", fontSize:15, whiteSpace:"nowrap" }}>{f(item.budget)}</div>
              <ThreeDotMenu t={t} options={[{ icon:"✅ ", label:"Mark Complete", action:()=>{ setCompleteId(item.id); setCompleteDate(today()); } }, { icon:"✏️ ", label:"Edit", action:()=>setEditId(editId===item.id?null:item.id) }, { icon:"🗑️ ", label:"Delete", danger:true, action:()=>onDelete(item.id,item.title) }]} />
            </div>
          </div>
          {editId===item.id && <InlineEdit t={t} currency={currency} rates={rates} item={item} fields={[{ key:"title", label:"Plan Title" },{ key:"budget", label:"Budget", isAmount:true },{ key:"category", label:"Category", type:"select", options:PLAN_CATS },{ key:"dueDate", label:"Target Date", type:"date" },{ key:"note", label:"Note" }]} onSave={v=>{onUpdate(item.id,v);setEditId(null);}} onCancel={()=>setEditId(null)} />}
        </div>
      ))}
      {completed.length > 0 && (
        <div style={{ marginTop:28 }}>
          <div style={{ fontSize:12, color:t.subText, fontWeight:700, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>✅ Completed Plans</div>
          {completed.map(item=>(
            <div key={item.id} style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderRadius:12, padding:"12px 16px", marginBottom:8, opacity:0.55 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><div style={{ fontWeight:600, fontSize:14, color:t.text, textDecoration:"line-through" }}>{item.title}</div><div style={{ fontSize:11, color:t.subText }}>Completed: {item.completionDate}</div></div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#00e5a0" }}>{f(item.budget)}</div>
                  <ThreeDotMenu t={t} options={[{ icon:"🗑️ ", label:"Delete", danger:true, action:()=>onDelete(item.id,item.title) }]} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SHARED ────────────────────────────────────────────────────
function Card({ children, color, t }) { return <div style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`, borderLeft:`3px solid ${color}`, borderRadius:14, padding:"13px 16px", marginBottom:9 }}>{children}</div>; }
function FormCard({ children, color, t }) { return <div style={{ background:t.sectionBg, border:`1px solid ${color}40`, borderRadius:16, padding:20, marginBottom:20 }}>{children}</div>; }
function FR({ label, children, t }) { return <div style={{ marginBottom:12 }}><div style={{ fontSize:10, color:t.subText, marginBottom:5, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>{children}</div>; }
function ES({ text, t }) { return <div style={{ textAlign:"center", padding:"48px 20px", color:t.subText, fontSize:14, border:`1px dashed ${t.cardBorder}`, borderRadius:16 }}>{text}</div>; }
function Pills({ label, values, active, setActive, color, pretty, t }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10, color:t.subText, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {values.map(v=><button key={v} onClick={()=>setActive(v)} style={{ background:active===v?`${color}22`:"transparent", border:`1px solid ${active===v?color+"80":t.cardBorder}`, color:active===v?color:t.subText, borderRadius:99, padding:"4px 13px", fontSize:12, cursor:"pointer" }}>{pretty?pretty(v):v}</button>)}
      </div>
    </div>
  );
}
const iSt = t => ({ width:"100%", background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:9, color:t.text, padding:"10px 12px", fontSize:14, boxSizing:"border-box", outline:"none" });
function bSt(color) { return { background:`${color}18`, border:`1px solid ${color}60`, color, borderRadius:9, padding:"8px 18px", cursor:"pointer", fontSize:13, fontWeight:700, transition:"all 0.2s" }; }
