"use client";

import { useState, useEffect, useReducer, useRef, useCallback, useMemo } from "react";
import { BookOpen, Brain, Clock, BarChart3, Plus, Trash2, Edit3, Check, Play, Square, RotateCcw, Sparkles, ChevronRight, Calendar, Target, Zap, X, Loader2, GraduationCap, Timer, TrendingUp, LayoutDashboard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

// ─── Reducer ───
const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2, 12);
const daysUntil = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));
const fmtDate = (d: string) => new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
const fmtDay = (d: Date) => d.toLocaleDateString("nl-NL", { weekday: "short" });

interface Exam {
  id: string;
  name: string;
  date: string;
  chapters: string[];
}

interface FocusSession {
  id: string;
  mins: number;
  ts: number;
}

interface AppState {
  exams: Exam[];
  completed: Record<string, number>;
  focusSessions: FocusSession[];
  aiPlan: string | null;
}

type Action =
  | { type: "LOAD"; payload: AppState }
  | { type: "ADD_EXAM"; payload: Omit<Exam, "id"> }
  | { type: "UPDATE_EXAM"; id: string; payload: Partial<Exam> }
  | { type: "DELETE_EXAM"; id: string }
  | { type: "TOGGLE_CHAPTER"; examId: string; chapter: string }
  | { type: "ADD_FOCUS"; mins: number }
  | { type: "SET_PLAN"; plan: string };

const initialState: AppState = { exams: [], completed: {}, focusSessions: [], aiPlan: null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD": return action.payload || initialState;
    case "ADD_EXAM": return { ...state, exams: [...state.exams, { id: uid(), ...action.payload }] };
    case "UPDATE_EXAM": return { ...state, exams: state.exams.map(e => e.id === action.id ? { ...e, ...action.payload } : e) };
    case "DELETE_EXAM": {
      const next = { ...state, exams: state.exams.filter(e => e.id !== action.id) };
      const completed = { ...next.completed };
      Object.keys(completed).forEach(k => { if (k.startsWith(action.id)) delete completed[k]; });
      return { ...next, completed };
    }
    case "TOGGLE_CHAPTER": {
      const key = `${action.examId}::${action.chapter}`;
      const completed = { ...state.completed };
      completed[key] ? delete completed[key] : (completed[key] = Date.now());
      return { ...state, completed };
    }
    case "ADD_FOCUS": return { ...state, focusSessions: [...state.focusSessions, { id: uid(), mins: action.mins, ts: Date.now() }] };
    case "SET_PLAN": return { ...state, aiPlan: action.plan };
    default: return state;
  }
}

// ─── Design Tokens ───
const T = {
  bg: "#09090b",
  surface: "#111113",
  surfaceRaised: "#18181b",
  border: "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.1)",
  accent: "#818cf8",
  accentMuted: "rgba(129,140,248,0.12)",
  green: "#34d399",
  greenMuted: "rgba(52,211,153,0.12)",
  amber: "#fbbf24",
  amberMuted: "rgba(251,191,36,0.12)",
  red: "#f87171",
  redMuted: "rgba(248,113,113,0.12)",
  text: "#fafafa",
  textSub: "#a1a1aa",
  textMuted: "#52525b",
  radius: "12px",
  radiusSm: "8px",
  font: "-apple-system, system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', monospace",
};

// ─── Persistence ───
const STORAGE_KEY = "studyai-state";
const loadState = (): AppState | null => {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const saveState = (s: AppState) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
};

// ─── Small Components ───
function IconBtn({ icon: Icon, onClick, danger = false, label }: { icon: any; onClick: () => void; danger?: boolean; label?: string }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} title={label}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: T.radiusSm, border: "none", background: h ? (danger ? T.redMuted : "rgba(255,255,255,0.06)") : "transparent", cursor: "pointer", transition: "all 0.15s ease" }}>
      <Icon size={16} color={h ? (danger ? T.red : T.text) : T.textMuted} />
    </button>
  );
}

function Badge({ children, color = T.accent, bg }: { children: React.ReactNode; color?: string; bg?: string }) {
  return <span style={{ padding: "3px 8px", borderRadius: "6px", background: bg || `${color}18`, color, fontSize: "11px", fontWeight: 600 }}>{children}</span>;
}

function EmptyState({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ width: 48, height: 48, borderRadius: T.radius, background: T.accentMuted, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Icon size={22} color={T.accent} />
      </div>
      <div style={{ fontSize: "15px", fontWeight: 600, color: T.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: "13px", color: T.textMuted }}>{sub}</div>
    </div>
  );
}

// ─── Dashboard ───
function Dashboard({ state }: { state: AppState }) {
  const totalChapters = state.exams.reduce((a, e) => a + e.chapters.length, 0);
  const completedCount = Object.keys(state.completed).length;
  const focusToday = state.focusSessions.filter(s => new Date(s.ts).toDateString() === new Date().toDateString()).reduce((a, s) => a + s.mins, 0);
  const nextExam = state.exams.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const pct = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {[
          { label: "Examens", value: state.exams.length, icon: BookOpen, color: T.accent, bg: T.accentMuted },
          { label: "Voortgang", value: `${pct}%`, icon: Target, color: T.green, bg: T.greenMuted },
          { label: "Focus vandaag", value: `${focusToday}m`, icon: Zap, color: T.amber, bg: T.amberMuted },
        ].map((s, i) => (
          <div key={i} style={{ padding: 16, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: T.radiusSm, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={14} color={s.color} />
              </div>
              <span style={{ fontSize: "12px", color: T.textMuted, fontWeight: 500 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: T.text, fontFamily: T.mono, letterSpacing: "-0.5px" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {nextExam && (
        <div style={{ padding: 16, borderRadius: T.radius, background: `linear-gradient(135deg, ${T.accentMuted}, transparent)`, border: `1px solid rgba(129,140,248,0.12)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Calendar size={12} color={T.accent} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: T.accent, letterSpacing: "0.5px", textTransform: "uppercase" }}>Volgend examen</span>
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, color: T.text }}>{nextExam.name}</div>
          <div style={{ fontSize: "13px", color: T.textSub, marginTop: 2 }}>
            {fmtDate(nextExam.date)} — <span style={{ color: daysUntil(nextExam.date) <= 3 ? T.red : T.accent, fontWeight: 600 }}>nog {daysUntil(nextExam.date)} dagen</span>
          </div>
        </div>
      )}

      {state.aiPlan && (
        <div style={{ padding: 16, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Sparkles size={12} color={T.accent} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, letterSpacing: "0.5px", textTransform: "uppercase" }}>AI Studieplan</span>
          </div>
          <div style={{ fontSize: "13px", color: T.textSub, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 160, overflow: "hidden", maskImage: "linear-gradient(to bottom, black 60%, transparent)" }}>
            {state.aiPlan}
          </div>
        </div>
      )}

      {state.exams.length === 0 && <EmptyState icon={BookOpen} title="Geen examens" sub="Voeg je eerste examen toe in het Examens tab" />}
    </div>
  );
}

// ─── Exams ───
function ExamsView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const [form, setForm] = useState({ name: "", date: "", chapters: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const submit = () => {
    if (!form.name || !form.date) return;
    const chapters = form.chapters.split(",").map(c => c.trim()).filter(Boolean);
    if (editId) {
      dispatch({ type: "UPDATE_EXAM", id: editId, payload: { name: form.name, date: form.date, chapters } });
      setEditId(null);
    } else {
      dispatch({ type: "ADD_EXAM", payload: { name: form.name, date: form.date, chapters } });
    }
    setForm({ name: "", date: "", chapters: "" });
    setShowForm(false);
  };

  const startEdit = (e: Exam) => {
    setEditId(e.id); setForm({ name: e.name, date: e.date, chapters: e.chapters.join(", ") }); setShowForm(true);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bg, color: T.text, fontSize: "13px", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Examens</h2>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: "", date: "", chapters: "" }); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: T.radiusSm, border: "none", background: T.accent, color: "#000", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
          <Plus size={14} /> Nieuw
        </button>
      </div>

      {showForm && (
        <div style={{ padding: 16, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.borderHover}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vak naam" />
            <input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <input style={inputStyle} value={form.chapters} onChange={e => setForm(f => ({ ...f, chapters: e.target.value }))} placeholder="Hoofdstukken, gescheiden door komma's" />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submit} disabled={!form.name || !form.date}
                style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: !form.name || !form.date ? T.textMuted : T.accent, color: "#000", fontSize: "12px", fontWeight: 600, cursor: !form.name || !form.date ? "not-allowed" : "pointer", opacity: !form.name || !form.date ? 0.4 : 1 }}>
                {editId ? "Opslaan" : "Toevoegen"}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }}
                style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: "transparent", color: T.textSub, fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}

      {state.exams.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(exam => {
        const done = exam.chapters.filter(c => state.completed[`${exam.id}::${c}`]).length;
        const total = exam.chapters.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const days = daysUntil(exam.date);
        const urgent = days <= 3;

        return (
          <div key={exam.id} style={{ padding: 16, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>{exam.name}</span>
                  {pct === 100 && <Badge color={T.green}>Klaar</Badge>}
                  {urgent && pct < 100 && <Badge color={T.red}>Urgent</Badge>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: "12px", color: T.textMuted }}>
                  <span>{fmtDate(exam.date)}</span><span>·</span>
                  <span style={{ color: urgent ? T.red : T.textSub, fontWeight: urgent ? 600 : 400 }}>{days}d</span>
                  {total > 0 && <><span>·</span><span>{done}/{total}</span></>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                <IconBtn icon={Edit3} onClick={() => startEdit(exam)} label="Bewerk" />
                <IconBtn icon={Trash2} onClick={() => dispatch({ type: "DELETE_EXAM", id: exam.id })} danger label="Verwijder" />
              </div>
            </div>

            {total > 0 && (
              <>
                <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.04)", marginBottom: 12, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: pct === 100 ? T.green : T.accent, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {exam.chapters.map((ch, i) => {
                    const isDone = !!state.completed[`${exam.id}::${ch}`];
                    return (
                      <button key={i} onClick={() => dispatch({ type: "TOGGLE_CHAPTER", examId: exam.id, chapter: ch })}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: "6px",
                          border: `1px solid ${isDone ? "rgba(52,211,153,0.2)" : T.border}`,
                          background: isDone ? T.greenMuted : "transparent",
                          color: isDone ? T.green : T.textSub,
                          fontSize: "12px", fontWeight: 500, cursor: "pointer",
                          textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.75 : 1,
                          transition: "all 0.15s ease",
                        }}>
                        {isDone && <Check size={11} />}{ch}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}

      {state.exams.length === 0 && !showForm && <EmptyState icon={GraduationCap} title="Nog geen examens" sub="Klik op Nieuw om je eerste examen toe te voegen" />}
    </div>
  );
}

// ─── AI Planner ───
function AIPlannerView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const [loading, setLoading] = useState(false);
  const [extra, setExtra] = useState("");
  const [plan, setPlan] = useState(state.aiPlan || "");

  const generate = async () => {
    if (!state.exams.length) return;
    setLoading(true);

    const info = state.exams.map(e => {
      const rem = e.chapters.filter(c => !state.completed[`${e.id}::${c}`]);
      const done = e.chapters.filter(c => state.completed[`${e.id}::${c}`]);
      return `${e.name} — examen ${e.date} (${daysUntil(e.date)}d) — klaar: [${done.join(", ") || "geen"}] — nog: [${rem.join(", ") || "geen"}]`;
    }).join("\n");

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ info, extra }),
      });
      const data = await res.json();
      setPlan(data.plan);
      dispatch({ type: "SET_PLAN", plan: data.plan });
    } catch {
      setPlan("❌ Verbinding mislukt. Probeer opnieuw.");
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>AI Planner</h2>

      {state.exams.length === 0 ? (
        <EmptyState icon={Brain} title="Voeg eerst examens toe" sub="De AI heeft je examens nodig om een plan te maken" />
      ) : (
        <>
          <div style={{ padding: 14, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Input</div>
            {state.exams.map(e => {
              const rem = e.chapters.filter(c => !state.completed[`${e.id}::${c}`]).length;
              return (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}`, fontSize: "13px" }}>
                  <span style={{ color: T.text, fontWeight: 500 }}>{e.name}</span>
                  <span style={{ color: T.textMuted, fontFamily: T.mono, fontSize: "12px" }}>{rem} over · {daysUntil(e.date)}d</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="Extra context (optioneel)..."
              style={{ flex: 1, padding: "9px 12px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
            <button onClick={generate} disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: T.radiusSm, border: "none", background: loading ? T.surfaceRaised : T.accent, color: loading ? T.textSub : "#000", fontSize: "12px", fontWeight: 600, cursor: loading ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              {loading ? <><Loader2 size={13} className="animate-spin" /> Laden...</> : <><Sparkles size={13} /> Genereer</>}
            </button>
          </div>

          {plan && (
            <div style={{ padding: 16, borderRadius: T.radius, background: T.surface, border: `1px solid rgba(129,140,248,0.1)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Sparkles size={13} color={T.accent} />
                <span style={{ fontSize: "11px", fontWeight: 600, color: T.accent, letterSpacing: "0.5px", textTransform: "uppercase" }}>Studieplan</span>
              </div>
              <div style={{ fontSize: "13px", color: T.textSub, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{plan}</div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } .animate-spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

// ─── Focus Timer ───
function FocusView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const [dur, setDur] = useState(25);
  const [left, setLeft] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => { setLeft(dur * 60); setActive(true); setDone(false); };
  const stop = () => {
    setActive(false);
    if (ref.current) clearInterval(ref.current);
    const elapsed = dur * 60 - (left || 0);
    if (elapsed >= 30) dispatch({ type: "ADD_FOCUS", mins: Math.round(elapsed / 60) });
    setLeft(null);
  };
  const reset = () => { setLeft(null); setDone(false); };

  useEffect(() => {
    if (!active || left === null) return;
    ref.current = setInterval(() => {
      setLeft(t => {
        if (t === null || t <= 1) {
          if (ref.current) clearInterval(ref.current);
          setActive(false); setDone(true);
          dispatch({ type: "ADD_FOCUS", mins: dur });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active]);

  const m = left !== null ? Math.floor(left / 60) : dur;
  const s = left !== null ? left % 60 : 0;
  const progress = left !== null ? (dur * 60 - left) / (dur * 60) : 0;
  const circumference = 2 * Math.PI * 80;

  const todayMins = state.focusSessions.filter(f => new Date(f.ts).toDateString() === new Date().toDateString()).reduce((a, f) => a + f.mins, 0);
  const todayCount = state.focusSessions.filter(f => new Date(f.ts).toDateString() === new Date().toDateString()).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Focus Timer</h2>

      <div style={{ padding: "32px 20px", borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}`, textAlign: "center" }}>
        <div style={{ position: "relative", width: 184, height: 184, margin: "0 auto 24px" }}>
          <svg width="184" height="184" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="92" cy="92" r="80" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
            <circle cx="92" cy="92" r="80" fill="none" stroke={done ? T.green : T.accent} strokeWidth="4"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: T.mono, fontSize: "36px", fontWeight: 700, color: T.text, letterSpacing: "-1px" }}>
              {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
            </div>
            {done && <div style={{ fontSize: "12px", color: T.green, fontWeight: 600, marginTop: 4 }}>Klaar!</div>}
          </div>
        </div>

        {!active && left === null && !done && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
            {[15, 25, 45, 60].map(v => (
              <button key={v} onClick={() => setDur(v)}
                style={{ padding: "6px 14px", borderRadius: T.radiusSm, border: `1px solid ${dur === v ? "rgba(129,140,248,0.25)" : T.border}`, background: dur === v ? T.accentMuted : "transparent", color: dur === v ? T.accent : T.textMuted, fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: T.mono }}>
                {v}m
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {!active && left === null && !done && (
            <button onClick={start} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 24px", borderRadius: T.radiusSm, border: "none", background: T.accent, color: "#000", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              <Play size={14} /> Start
            </button>
          )}
          {active && (
            <button onClick={stop} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 24px", borderRadius: T.radiusSm, border: `1px solid rgba(248,113,113,0.25)`, background: T.redMuted, color: T.red, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              <Square size={14} /> Stop
            </button>
          )}
          {(done || (!active && left !== null)) && (
            <button onClick={reset} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 24px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: "transparent", color: T.textSub, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: 14, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: 4 }}>Vandaag</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: T.green, fontFamily: T.mono }}>{todayMins}<span style={{ fontSize: "13px", color: T.textMuted }}>m</span></div>
        </div>
        <div style={{ padding: 14, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: 4 }}>Sessies</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: T.accent, fontFamily: T.mono }}>{todayCount}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Progress ───
function ProgressView({ state }: { state: AppState }) {
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const mins = state.focusSessions.filter(s => new Date(s.ts).toDateString() === d.toDateString()).reduce((a, s) => a + s.mins, 0);
      return { day: fmtDay(d), mins, isToday: i === 6 };
    });
  }, [state.focusSessions]);

  const totalMins = state.focusSessions.reduce((a, s) => a + s.mins, 0);
  const totalChapters = state.exams.reduce((a, e) => a + e.chapters.length, 0);
  const completedCount = Object.keys(state.completed).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Voortgang</h2>

      <div style={{ padding: 16, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Focus deze week</div>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="28%">
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 11 }} />
              <YAxis hide />
              <Tooltip
  contentStyle={{
    background: T.surfaceRaised,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    fontSize: 12,
    color: T.text
  }}
  formatter={(value: any) => [`${value ?? 0} min`, "Focus"]}
/>
              <Bar dataKey="mins" radius={[4, 4, 0, 0] as any} maxBarSize={32}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.isToday ? T.accent : d.mins > 0 ? "rgba(129,140,248,0.35)" : "rgba(255,255,255,0.04)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, fontSize: "12px", color: T.textMuted }}>
          <span>Totaal: <span style={{ color: T.accent, fontWeight: 600, fontFamily: T.mono }}>{totalMins}m</span></span>
          <span>Sessies: <span style={{ color: T.accent, fontWeight: 600, fontFamily: T.mono }}>{state.focusSessions.length}</span></span>
        </div>
      </div>

      {state.exams.length > 0 && (
        <div style={{ padding: 16, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: T.textMuted, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 14 }}>Per examen</div>
          {state.exams.map(exam => {
            const done = exam.chapters.filter(c => state.completed[`${exam.id}::${c}`]).length;
            const total = exam.chapters.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div key={exam.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "13px" }}>
                  <span style={{ color: T.text, fontWeight: 500 }}>{exam.name}</span>
                  <span style={{ color: pct === 100 ? T.green : T.textMuted, fontFamily: T.mono, fontSize: "12px", fontWeight: 600 }}>{pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: pct === 100 ? T.green : pct >= 50 ? T.accent : T.amber, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
          {totalChapters > 0 && (
            <div style={{ textAlign: "center", padding: 10, borderRadius: T.radiusSm, background: "rgba(255,255,255,0.02)" }}>
              <span style={{ fontFamily: T.mono, fontSize: "20px", fontWeight: 700, color: T.accent }}>{Math.round((completedCount / totalChapters) * 100)}%</span>
              <span style={{ fontSize: "12px", color: T.textMuted, marginLeft: 6 }}>totaal</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── App Shell ───
const NAV = [
  { id: "dash", label: "Home", icon: LayoutDashboard },
  { id: "exams", label: "Examens", icon: BookOpen },
  { id: "ai", label: "AI Plan", icon: Brain },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "progress", label: "Stats", icon: TrendingUp },
];

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tab, setTab] = useState("dash");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = loadState();
    if (saved) dispatch({ type: "LOAD", payload: saved });
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) saveState(state);
  }, [state, mounted]);

  if (!mounted) return null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(9,9,11,0.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: T.accentMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={14} color={T.accent} />
            </div>
            <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.3px" }}>study<span style={{ color: T.accent }}>ai</span></span>
          </div>
          <Badge color={T.textMuted} bg="rgba(255,255,255,0.04)">v0.1</Badge>
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 20px 100px" }}>
        {tab === "dash" && <Dashboard state={state} />}
        {tab === "exams" && <ExamsView state={state} dispatch={dispatch} />}
        {tab === "ai" && <AIPlannerView state={state} dispatch={dispatch} />}
        {tab === "focus" && <FocusView state={state} dispatch={dispatch} />}
        {tab === "progress" && <ProgressView state={state} />}
      </main>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(9,9,11,0.92)", backdropFilter: "blur(16px)", borderTop: `1px solid ${T.border}`, zIndex: 50 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", justifyContent: "space-around", padding: "6px 0 10px" }}>
          {NAV.map(n => {
            const isActive = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 14px", borderRadius: T.radiusSm, border: "none", background: isActive ? T.accentMuted : "transparent", cursor: "pointer" }}>
                <n.icon size={18} color={isActive ? T.accent : T.textMuted} strokeWidth={isActive ? 2.2 : 1.8} />
                <span style={{ fontSize: "10px", fontWeight: 600, color: isActive ? T.accent : T.textMuted }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}