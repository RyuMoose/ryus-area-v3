/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from “react”;

// ─── SOUND ENGINE ─────────────────────────────────────────────────────────────
const AudioCtx = typeof window !== “undefined” ? new (window.AudioContext || window.webkitAudioContext)() : null;
function playTone(freq, type = “sine”, dur = 0.15, vol = 0.18) {
if (!AudioCtx) return;
try {
const o = AudioCtx.createOscillator(), g = AudioCtx.createGain();
o.connect(g); g.connect(AudioCtx.destination);
o.type = type; o.frequency.setValueAtTime(freq, AudioCtx.currentTime);
g.gain.setValueAtTime(vol, AudioCtx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + dur);
o.start(); o.stop(AudioCtx.currentTime + dur);
} catch {}
}
const SFX = {
click: () => playTone(800, “sine”, 0.08, 0.12),
success: () => { [523,659,784].forEach((f,i) => setTimeout(() => playTone(f,“sine”,0.1), i*100)); },
flip: () => playTone(440, “triangle”, 0.12, 0.1),
xp: () => { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,“sine”,0.1,0.15), i*80)); },
pomoDone: () => { [784,659,523,392].forEach((f,i) => setTimeout(() => playTone(f,“triangle”,0.3,0.2), i*200)); },
badge: () => { [1047,1319,1568,2093].forEach((f,i) => setTimeout(() => playTone(f,“sine”,0.15,0.2), i*120)); },
error: () => playTone(220, “sawtooth”, 0.15, 0.1),
};

// ─── XP/LEVEL ─────────────────────────────────────────────────────────────────
const XP_PER_LEVEL = 100;
const getLevel = xp => Math.floor(xp / XP_PER_LEVEL) + 1;
const getXPProgress = xp => (xp % XP_PER_LEVEL) / XP_PER_LEVEL;

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
{ id:“first_todo”, icon:“✅”, name:“Эхний алхам”, desc:“Анхны даалгавраа дуусгасан”, xp:10 },
{ id:“todo_10”, icon:“🗂️”, name:“Ажилчин”, desc:“10 даалгавар дуусгасан”, xp:25 },
{ id:“first_card”, icon:“🃏”, name:“Судлагч”, desc:“Анхны flashcard нэмсэн”, xp:10 },
{ id:“cards_20”, icon:“📚”, name:“Карт мастер”, desc:“20 flashcard цуглуулсан”, xp:30 },
{ id:“streak_3”, icon:“🔥”, name:“Тогтмол”, desc:“3 өдөр дараалан нэвтэрсэн”, xp:20 },
{ id:“streak_7”, icon:“💫”, name:“Долоо хоног”, desc:“7 өдөр дараалан нэвтэрсэн”, xp:50 },
{ id:“pomo_1”, icon:“🍅”, name:“Pomodoro эхлэгч”, desc:“Анхны Pomodoro дуусгасан”, xp:15 },
{ id:“pomo_10”, icon:“⏰”, name:“Focus King”, desc:“10 Pomodoro дуусгасан”, xp:40 },
{ id:“note_1”, icon:“📝”, name:“Тэмдэглэгч”, desc:“Анхны конспект бичсэн”, xp:10 },
{ id:“level_5”, icon:“⚡”, name:“Тав дэвсэн”, desc:“Түвшин 5-д хүрсэн”, xp:50 },
{ id:“level_10”, icon:“🌟”, name:“Аравт”, desc:“Түвшин 10-д хүрсэн”, xp:100 },
{ id:“ai_chat”, icon:“🤖”, name:“AI найз”, desc:“AI assistant ашигласан”, xp:15 },
{ id:“study_60”, icon:“⏱️”, name:“Цагийн эзэн”, desc:“Нийт 60 минут судалсан”, xp:30 },
];

// ─── INIT STATE ───────────────────────────────────────────────────────────────
const INIT = {
todos: [], flashcards: [], notes: [], deadlines: [],
schedule: { Mon:[], Tue:[], Wed:[], Thu:[], Fri:[], Sat:[], Sun:[] },
xp: 0, streak: 0, lastVisit: null, studyMinutes: 0,
theme: { accent: “#7C3AED” },
pomodoro: { work: 25, break: 5, cycleCount: 0 },
badges: [],
sessionLog: [],
weeklyLog: {},
};

const loadState = () => {
try { const s = localStorage.getItem(“ryuarea_v1”); return s ? { …INIT, …JSON.parse(s) } : INIT; }
catch { return INIT; }
};
const saveState = s => { try { localStorage.setItem(“ryuarea_v1”, JSON.stringify(s)); } catch {} };

// ─── PARTICLES ────────────────────────────────────────────────────────────────
function ParticleCanvas() {
const ref = useRef();
useEffect(() => {
const c = ref.current; if (!c) return;
const ctx = c.getContext(“2d”);
let W = c.width = window.innerWidth, H = c.height = window.innerHeight;
const pts = Array.from({length:60},()=>({
x:Math.random()*W, y:Math.random()*H,
vx:(Math.random()-.5)*.25, vy:(Math.random()-.5)*.25,
r:Math.random()*2+.5, a:Math.random()*0.5+0.1
}));
let raf;
const draw = () => {
ctx.clearRect(0,0,W,H);
pts.forEach(p=>{
p.x+=p.vx; p.y+=p.vy;
if(p.x<0||p.x>W) p.vx*=-1;
if(p.y<0||p.y>H) p.vy*=-1;
ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
ctx.fillStyle=`rgba(167,139,250,${p.a*0.35})`; ctx.fill();
});
raf = requestAnimationFrame(draw);
};
draw();
const resize=()=>{ W=c.width=window.innerWidth; H=c.height=window.innerHeight; };
window.addEventListener(“resize”,resize);
return ()=>{ cancelAnimationFrame(raf); window.removeEventListener(“resize”,resize); };
},[]);
return <canvas ref={ref} style={{position:“fixed”,inset:0,pointerEvents:“none”,zIndex:0}}/>;
}

function CursorGlow() {
const [p,setP]=useState({x:-300,y:-300});
useEffect(()=>{ const m=e=>setP({x:e.clientX,y:e.clientY}); window.addEventListener(“mousemove”,m); return()=>window.removeEventListener(“mousemove”,m); },[]);
return <div style={{position:“fixed”,left:p.x-180,top:p.y-180,width:360,height:360,borderRadius:“50%”,pointerEvents:“none”,zIndex:1,background:“radial-gradient(circle,rgba(124,58,237,0.07) 0%,transparent 70%)”,transition:“left 0.04s,top 0.04s”}}/>;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({msg,icon=“✨”,onDone}) {
useEffect(()=>{ const t=setTimeout(onDone,2400); return()=>clearTimeout(t); },[onDone]);
return (
<div style={{background:“linear-gradient(135deg,rgba(124,58,237,0.92),rgba(167,139,250,0.92))”,backdropFilter:“blur(20px)”,border:“1px solid rgba(167,139,250,0.4)”,borderRadius:16,padding:“12px 20px”,color:”#fff”,fontWeight:700,fontSize:14,boxShadow:“0 8px 32px rgba(124,58,237,0.4)”,animation:“toastIn 0.35s cubic-bezier(.34,1.56,.64,1)”,display:“flex”,alignItems:“center”,gap:8}}>
<span style={{fontSize:18}}>{icon}</span>{msg}
</div>
);
}

// ─── GLASS + BTN ─────────────────────────────────────────────────────────────
const Glass = ({children,style={},onClick}) => (

<div onClick={onClick} style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(24px) saturate(180%)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,boxShadow:"0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.08)",...style}}>{children}</div>
);

function Btn({children,onClick,style={},variant=“primary”,small=false,disabled=false}) {
const [pr,setPr]=useState(false);
const vars={
primary:{background:“linear-gradient(135deg,#7C3AED,#A855F7)”,color:”#fff”,boxShadow:“0 4px 16px rgba(124,58,237,0.35)”},
ghost:{background:“rgba(255,255,255,0.06)”,color:“rgba(255,255,255,0.75)”,border:“1px solid rgba(255,255,255,0.1)”},
danger:{background:“rgba(239,68,68,0.18)”,color:”#F87171”,border:“1px solid rgba(239,68,68,0.3)”},
success:{background:“rgba(34,197,94,0.18)”,color:”#4ADE80”,border:“1px solid rgba(34,197,94,0.3)”},
ai:{background:“linear-gradient(135deg,#0F4C81,#1D8CF8)”,color:”#fff”,boxShadow:“0 4px 16px rgba(29,140,248,0.3)”},
};
return (
<button disabled={disabled} onMouseDown={()=>setPr(true)} onMouseUp={()=>setPr(false)} onMouseLeave={()=>setPr(false)}
onClick={()=>{ if(!disabled){SFX.click();if(onClick)onClick();} }}
style={{border:“none”,cursor:disabled?“not-allowed”:“pointer”,fontFamily:“inherit”,fontWeight:600,borderRadius:12,display:“inline-flex”,alignItems:“center”,gap:6,transition:“all 0.15s”,fontSize:small?12:14,padding:small?“6px 12px”:“10px 18px”,transform:pr?“scale(0.94)”:“scale(1)”,opacity:disabled?0.5:1,…vars[variant],…style}}>
{children}
</button>
);
}

// ─── AI CALL ──────────────────────────────────────────────────────────────────
async function callClaude(messages, system = “”) {
const res = await fetch(“https://api.anthropic.com/v1/messages”, {
method:“POST”,
headers:{“Content-Type”:“application/json”},
body: JSON.stringify({
model:“claude-sonnet-4-20250514”,
max_tokens:1000,
system: system || “Та монгол хэлээр хариулдаг ухаалаг сурагчийн туслах AI. Хариултаа товч, тодорхой, найрсаг байлга.”,
messages
})
});
const d = await res.json();
return d.content?.map(b=>b.text||””).join(””) || “Хариулт алга”;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI CHAT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AIChatTab({state, addXP, addBadge}) {
const [msgs,setMsgs]=useState([{role:“assistant”,content:“Сайн уу! Би **RYU-ийн AI туслах**. Хичээлтэй холбоотой асуулт, тайлбар, зөвлөгөө авах боломжтой. Юу тусалж өгөх вэ? 🎓”}]);
const [input,setInput]=useState(””);
const [loading,setLoading]=useState(false);
const [mode,setMode]=useState(“chat”); // chat | plan | analyze
const endRef=useRef();
const usedAI=useRef(false);

useEffect(()=>{ endRef.current?.scrollIntoView({behavior:“smooth”}); },[msgs]);

const send = async (txt) => {
const text = txt||input; if(!text.trim()||loading) return;
if(!usedAI.current){ usedAI.current=true; addBadge(“ai_chat”); }
const userMsg = {role:“user”,content:text};
setMsgs(m=>[…m,userMsg,{role:“assistant”,content:”…”}]);
setInput(””); setLoading(true);
if(AudioCtx&&AudioCtx.state===“suspended”) AudioCtx.resume();
try {
const history = […msgs.filter(m=>m.content!==”…”),userMsg].slice(-10).map(m=>({role:m.role,content:m.content}));
const system = mode===“plan”
? `Та сурагчийн хичээлийн өдрийн төлөвлөгөө гаргаж өгдөг AI. Хэрэглэгчийн flashcard (${state.flashcards.length}ш), todo (${state.todos.filter(t=>!t.done).length} идэвхтэй), deadline мэдээллийг ашиглаж практик, хуваарьтай study plan гарга. Монгол хэлээр хариул.`
: mode===“analyze”
? `Та сурагчийн суралцах хэв маягийг шинжилдэг AI. Доорх өгөгдлийг ашиглаж зөвлөмж өг: Судалсан цаг: ${state.studyMinutes}мин, Pomodoro: ${state.pomodoro.cycleCount||0}, Flashcard: ${state.flashcards.length}, Todo дуусгасан: ${state.todos.filter(t=>t.done).length}/${state.todos.length}, XP: ${state.xp}, Streak: ${state.streak}. Монгол хэлээр дэлгэрэнгүй шинжилгээ хий.`
: “Та монгол хэлээр хариулдаг ухаалаг сурагчийн туслах AI. Хичээл, шинжлэх ухаан, математик, хэл, аливаа хичээлтэй холбоотой асуулт хариулна. Товч, тодорхой, найрсаг байлга.”;
const reply = await callClaude(history, system);
setMsgs(m=>[…m.slice(0,-1),{role:“assistant”,content:reply}]);
addXP(2,“🤖 AI +2 XP”);
} catch(e) {
setMsgs(m=>[…m.slice(0,-1),{role:“assistant”,content:“⚠️ Алдаа гарлаа. Дахин оролдоно уу.”}]);
}
setLoading(false);
};

const QUICK = [“Математик томьёо тайлбарла”,“Цээжлэх арга заа”,“Шалгалтанд хэрхэн бэлдэх вэ?”,“Мотивац өгч яриа”];

return (
<div style={{display:“flex”,flexDirection:“column”,height:“calc(100vh - 180px)”,gap:12}}>
<Glass style={{padding:“12px 16px”,display:“flex”,gap:8,flexWrap:“wrap”,alignItems:“center”}}>
<span style={{color:“rgba(255,255,255,0.4)”,fontSize:11,letterSpacing:2}}>ГОРИМ:</span>
{[[“chat”,“💬”,“Ерөнхий”],[“plan”,“🎯”,“Study Plan”],[“analyze”,“📊”,“Шинжилгээ”]].map(([m,ic,lb])=>(
<Btn key={m} onClick={()=>{setMode(m);if(m===“analyze”)send(“Миний суралцах хэв маягийг шинжилж зөвлөмж өг”);if(m===“plan”)send(“Өнөөдрийн хичээлийн оновчтой төлөвлөгөө гарга”);}} variant={mode===m?“ai”:“ghost”} small>{ic} {lb}</Btn>
))}
</Glass>

```
<Glass style={{flex:1,padding:16,overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
{msgs.map((m,i)=>(
<div key={i} style={{display:"flex",gap:10,flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-start"}}>
<div style={{width:32,height:32,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,background:m.role==="user"?"linear-gradient(135deg,#7C3AED,#A855F7)":"linear-gradient(135deg,#0F4C81,#1D8CF8)"}}>
{m.role==="user"?"🧑‍💻":"🤖"}
</div>
<div style={{maxWidth:"78%",background:m.role==="user"?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${m.role==="user"?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:14,padding:"10px 14px",color:m.content==="..."?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.9)",fontSize:13,lineHeight:1.65,whiteSpace:"pre-wrap"}}>
{m.content==="..."?<span style={{animation:"pulse 1s infinite"}}>● ● ●</span>:m.content}
</div>
</div>
))}
<div ref={endRef}/>
</Glass>

{msgs.length<3&&(
<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
{QUICK.map(q=><Btn key={q} onClick={()=>send(q)} variant="ghost" small style={{fontSize:11}}>{q}</Btn>)}
</div>
)}

<Glass style={{padding:12,display:"flex",gap:10}}>
<input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
placeholder="Асуулт бичнэ үү..." disabled={loading}
style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
<Btn onClick={()=>send()} variant="ai" disabled={loading||!input.trim()}>
{loading?"⏳":"🚀"} Илгээх
</Btn>
</Glass>
</div>
```

);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BADGES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function BadgesTab({state}) {
const earned = new Set(state.badges||[]);
const earnedList = ACHIEVEMENTS.filter(a=>earned.has(a.id));
const lockedList = ACHIEVEMENTS.filter(a=>!earned.has(a.id));
return (
<div style={{display:“flex”,flexDirection:“column”,gap:16}}>
<Glass style={{padding:20}}>
<div style={{fontSize:12,color:“rgba(255,255,255,0.4)”,letterSpacing:2,marginBottom:4}}>НИЙТ BADGE</div>
<div style={{fontSize:32,fontWeight:800,color:”#A78BFA”}}>{earnedList.length}<span style={{fontSize:16,color:“rgba(255,255,255,0.3)”,fontWeight:400}}>/{ACHIEVEMENTS.length}</span></div>
<div style={{height:6,background:“rgba(255,255,255,0.06)”,borderRadius:3,marginTop:10,overflow:“hidden”}}>
<div style={{height:“100%”,width:`${(earnedList.length/ACHIEVEMENTS.length)*100}%`,background:“linear-gradient(90deg,#7C3AED,#EC4899)”,borderRadius:3,transition:“width 0.5s”}}/>
</div>
</Glass>
{earnedList.length>0&&(
<div>
<div style={{fontSize:11,color:“rgba(255,255,255,0.4)”,letterSpacing:2,marginBottom:10}}>✅ АВСАН</div>
<div style={{display:“grid”,gridTemplateColumns:“repeat(auto-fill,minmax(160px,1fr))”,gap:10}}>
{earnedList.map(a=>(
<Glass key={a.id} style={{padding:16,textAlign:“center”,border:“1px solid rgba(167,139,250,0.25)”}}>
<div style={{fontSize:32,marginBottom:8}}>{a.icon}</div>
<div style={{color:”#fff”,fontWeight:700,fontSize:13,marginBottom:4}}>{a.name}</div>
<div style={{color:“rgba(255,255,255,0.4)”,fontSize:11,marginBottom:6}}>{a.desc}</div>
<div style={{color:”#A78BFA”,fontSize:11,fontWeight:700}}>+{a.xp} XP</div>
</Glass>
))}
</div>
</div>
)}
<div>
<div style={{fontSize:11,color:“rgba(255,255,255,0.3)”,letterSpacing:2,marginBottom:10}}>🔒 ТҮГЖИГДСЭН</div>
<div style={{display:“grid”,gridTemplateColumns:“repeat(auto-fill,minmax(160px,1fr))”,gap:10}}>
{lockedList.map(a=>(
<Glass key={a.id} style={{padding:16,textAlign:“center”,opacity:0.4,filter:“grayscale(0.8)”}}>
<div style={{fontSize:32,marginBottom:8}}>{a.icon}</div>
<div style={{color:“rgba(255,255,255,0.6)”,fontWeight:600,fontSize:13,marginBottom:4}}>{a.name}</div>
<div style={{color:“rgba(255,255,255,0.3)”,fontSize:11}}>{a.desc}</div>
</Glass>
))}
</div>
</div>
</div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY REPORT
// ═══════════════════════════════════════════════════════════════════════════════
function WeeklyTab({state}) {
const getWeekKey = (offset=0) => {
const d = new Date(); d.setDate(d.getDate() - d.getDay() - offset*7);
return d.toISOString().slice(0,10);
};
const wk = state.weeklyLog || {};
const thisWeek = getWeekKey(0);
const data = wk[thisWeek] || { xp:state.xp, minutes:state.studyMinutes, todos:state.todos.filter(t=>t.done).length, cards:state.flashcards.length };
const DAY_LABELS = [“Ня”,“Дав”,“Мяг”,“Лха”,“Пүр”,“Ба”,“Бям”];
const sessionLog = (state.sessionLog||[]).slice(-14).reverse();
const maxMin = Math.max(…(state.sessionLog||[]).map(s=>s.minutes||0),1);

return (
<div style={{display:“flex”,flexDirection:“column”,gap:16}}>
<Glass style={{padding:24}}>
<div style={{fontSize:12,color:“rgba(255,255,255,0.4)”,letterSpacing:2,marginBottom:16}}>📈 ЭНЭ 7 ХОНОГ</div>
<div style={{display:“grid”,gridTemplateColumns:“repeat(2,1fr)”,gap:12}}>
{[
{icon:“⚡”,val:data.xp,label:“XP цуглуулсан”,color:”#A78BFA”},
{icon:“⏱️”,val:`${Math.floor(data.minutes/60)}ц ${data.minutes%60}м`,label:“Судалсан”,color:”#34D399”},
{icon:“✅”,val:data.todos,label:“Даалгавар”,color:”#60A5FA”},
{icon:“🃏”,val:data.cards,label:“Flashcard”,color:”#F59E0B”},
].map((s,i)=>(
<Glass key={i} style={{padding:16,textAlign:“center”}}>
<div style={{fontSize:22}}>{s.icon}</div>
<div style={{fontSize:22,fontWeight:800,color:s.color,marginTop:4}}>{s.val}</div>
<div style={{fontSize:11,color:“rgba(255,255,255,0.35)”,marginTop:2}}>{s.label}</div>
</Glass>
))}
</div>
</Glass>

```
<Glass style={{padding:24}}>
<div style={{fontSize:12,color:"rgba(255,255,255,0.4)",letterSpacing:2,marginBottom:16}}>⏱️ SESSION ТҮҮХ</div>
{sessionLog.length===0
? <div style={{color:"rgba(255,255,255,0.25)",textAlign:"center",padding:20}}>Session байхгүй. Pomodoro ажиллуул!</div>
: sessionLog.map((s,i)=>(
<div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
<div style={{fontSize:11,color:"rgba(255,255,255,0.3)",width:80,flexShrink:0}}>{s.date}</div>
<div style={{flex:1,height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}>
<div style={{height:"100%",width:`${(s.minutes/maxMin)*100}%`,background:"linear-gradient(90deg,#7C3AED,#EC4899)",borderRadius:4}}/>
</div>
<div style={{fontSize:12,color:"#A78BFA",fontWeight:600,width:50,textAlign:"right"}}>{s.minutes}м</div>
</div>
))
}
</Glass>

<Glass style={{padding:24}}>
<div style={{fontSize:12,color:"rgba(255,255,255,0.4)",letterSpacing:2,marginBottom:16}}>📅 7 ХОНОГИЙН ХЭВ МАЯГ</div>
<div style={{display:"flex",gap:8,alignItems:"flex-end",height:80}}>
{DAY_LABELS.map((d,i)=>{
const dayLog = (state.sessionLog||[]).filter(s=>new Date(s.date).getDay()===i);
const total = dayLog.reduce((a,b)=>a+(b.minutes||0),0);
const h = Math.min((total/120)*100,100);
return (
<div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
<div style={{width:"100%",height:`${Math.max(h,4)}%`,background:h>0?"linear-gradient(180deg,#7C3AED,#EC4899)":"rgba(255,255,255,0.05)",borderRadius:"4px 4px 0 0",transition:"height 0.5s",minHeight:4}}/>
<div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{d}</div>
</div>
);
})}
</div>
</Glass>
</div>
```

);
}

// ═══════════════════════════════════════════════════════════════════════════════
// POMODORO
// ═══════════════════════════════════════════════════════════════════════════════
function PomodoroTab({state,setState,addXP,addBadge}) {
const [running,setRunning]=useState(false);
const [isWork,setIsWork]=useState(true);
const [secs,setSecs]=useState(state.pomodoro.work*60);
const intRef=useRef();
const sessionStart=useRef(null);

const workSecs=state.pomodoro.work*60, breakSecs=state.pomodoro.break*60;
const total=isWork?workSecs:breakSecs, pct=secs/total;
const mm=String(Math.floor(secs/60)).padStart(2,“0”), ss=String(secs%60).padStart(2,“0”);
const r=110, circ=2*Math.PI*r;

useEffect(()=>{
if(!running) return;
intRef.current=setInterval(()=>{
setSecs(s=>{
if(s<=1){
clearInterval(intRef.current); setRunning(false); SFX.pomoDone();
if(isWork){
const mins=state.pomodoro.work;
const today=new Date().toLocaleDateString(“mn-MN”);
setState(p=>{
const newCycles=(p.pomodoro.cycleCount||0)+1;
const log=[…( p.sessionLog||[]),{date:today,minutes:mins}];
const nb=[…(p.badges||[])];
if(newCycles===1&&!nb.includes(“pomo_1”)) nb.push(“pomo_1”);
if(newCycles>=10&&!nb.includes(“pomo_10”)) nb.push(“pomo_10”);
return {…p,studyMinutes:p.studyMinutes+mins,sessionLog:log,pomodoro:{…p.pomodoro,cycleCount:newCycles},badges:nb};
});
addXP(20,“🍅 Pomodoro +20 XP!”);
if((state.pomodoro.cycleCount||0)===0) addBadge(“pomo_1”);
setIsWork(false); setSecs(breakSecs);
} else { setIsWork(true); setSecs(workSecs); }
return 0;
}
return s-1;
});
},1000);
return()=>clearInterval(intRef.current);
},[running,isWork]);

const toggle=()=>{ if(AudioCtx&&AudioCtx.state===“suspended”) AudioCtx.resume(); setRunning(r=>!r); };
const reset=()=>{ setRunning(false); clearInterval(intRef.current); setIsWork(true); setSecs(workSecs); };

return (
<div style={{display:“flex”,flexDirection:“column”,alignItems:“center”,gap:24,paddingTop:8}}>
<Glass style={{padding:“36px 48px”,textAlign:“center”}}>
<div style={{fontSize:12,color:isWork?”#A78BFA”:”#34D399”,fontWeight:700,letterSpacing:3,marginBottom:20,textTransform:“uppercase”}}>
{isWork?“🎯 Focus Time”:“☕ Break Time”}
</div>
<svg width={260} height={260} style={{display:“block”,margin:“0 auto”}}>
<defs>
<linearGradient id="pg2" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset=“0%” stopColor={isWork?”#7C3AED”:”#059669”}/>
<stop offset=“100%” stopColor={isWork?”#EC4899”:”#34D399”}/>
</linearGradient>
</defs>
<circle cx={130} cy={130} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={14}/>
<circle cx={130} cy={130} r={r} fill=“none” stroke=“url(#pg2)” strokeWidth={14} strokeLinecap=“round”
strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} transform=“rotate(-90 130 130)”
style={{transition:“stroke-dashoffset 1s linear”}}/>
<text x={130} y={120} textAnchor="middle" fill="#fff" fontSize={46} fontWeight={800} fontFamily="monospace">{mm}:{ss}</text>
<text x={130} y={150} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={13}>🍅 × {state.pomodoro.cycleCount||0}</text>
</svg>
<div style={{display:“flex”,gap:12,justifyContent:“center”,marginTop:20}}>
<Btn onClick={toggle} style={{minWidth:110}}>{running?“⏸ Pause”:“▶ Start”}</Btn>
<Btn onClick={reset} variant="ghost">↺</Btn>
</div>
</Glass>
<Glass style={{padding:20,width:“100%”,maxWidth:380}}>
<div style={{color:“rgba(255,255,255,0.4)”,fontSize:11,marginBottom:12,textTransform:“uppercase”,letterSpacing:2}}>Тохируулга</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:12}}>
{[[“work”,“🎯 Ажил (мин)”],[“break”,“☕ Завсарлага”]].map(([k,l])=>(
<div key={k}>
<div style={{color:“rgba(255,255,255,0.4)”,fontSize:11,marginBottom:6}}>{l}</div>
<input type=“number” min={1} max={60} value={state.pomodoro[k]}
onChange={e=>setState(p=>({…p,pomodoro:{…p.pomodoro,[k]:+e.target.value}}))}
style={{width:“100%”,background:“rgba(255,255,255,0.06)”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:10,padding:“8px 12px”,color:”#fff”,fontSize:16,fontFamily:“monospace”,outline:“none”}}/>
</div>
))}
</div>
</Glass>
</div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TODO
// ═══════════════════════════════════════════════════════════════════════════════
function TodoTab({state,setState,addXP,addBadge}) {
const [input,setInput]=useState(””), [filter,setFilter]=useState(“all”);
const add=()=>{
if(!input.trim()) return;
setState(p=>({…p,todos:[…p.todos,{id:Date.now(),text:input.trim(),done:false}]}));
setInput(””); SFX.click();
};
const toggle=id=>{
setState(p=>{
const todos=p.todos.map(t=>t.id===id?{…t,done:!t.done}:t);
const wasDone=p.todos.find(t=>t.id===id)?.done;
if(!wasDone){
SFX.success(); addXP(5,“✅ +5 XP!”);
const doneCount=todos.filter(t=>t.done).length;
if(doneCount===1) addBadge(“first_todo”);
if(doneCount>=10) addBadge(“todo_10”);
}
return {…p,todos};
});
};
const del=id=>setState(p=>({…p,todos:p.todos.filter(t=>t.id!==id)}));
const filtered=state.todos.filter(t=>filter===“all”?true:filter===“done”?t.done:!t.done);
const done=state.todos.filter(t=>t.done).length;
return (
<div style={{display:“flex”,flexDirection:“column”,gap:14}}>
<Glass style={{padding:18}}>
<div style={{display:“flex”,gap:10}}>
<input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key===“Enter”&&add()}
placeholder=“Шинэ даалгавар…” style={{flex:1,background:“rgba(255,255,255,0.06)”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:12,padding:“10px 14px”,color:”#fff”,fontSize:14,outline:“none”,fontFamily:“inherit”}}/>
<Btn onClick={add}>+</Btn>
</div>
<div style={{display:“flex”,gap:8,marginTop:12,alignItems:“center”}}>
{[“all”,“active”,“done”].map(f=><Btn key={f} onClick={()=>setFilter(f)} variant={filter===f?“primary”:“ghost”} small>{f===“all”?“Бүгд”:f===“active”?“Идэвхтэй”:“Дууссан”}</Btn>)}
<span style={{marginLeft:“auto”,color:“rgba(255,255,255,0.35)”,fontSize:12}}>{done}/{state.todos.length}</span>
</div>
</Glass>
<div style={{display:“flex”,flexDirection:“column”,gap:8}}>
{filtered.length===0&&<div style={{textAlign:“center”,color:“rgba(255,255,255,0.25)”,padding:32,fontSize:13}}>Даалгавар байхгүй</div>}
{filtered.map(t=>(
<Glass key={t.id} style={{padding:“13px 16px”,display:“flex”,alignItems:“center”,gap:12,opacity:t.done?0.55:1,cursor:“pointer”}} onClick={()=>toggle(t.id)}>
<div style={{width:22,height:22,borderRadius:8,border:`2px solid ${t.done?"#7C3AED":"rgba(255,255,255,0.2)"}`,background:t.done?“linear-gradient(135deg,#7C3AED,#A855F7)”:“transparent”,flexShrink:0,display:“flex”,alignItems:“center”,justifyContent:“center”,transition:“all 0.2s”}}>
{t.done&&<span style={{fontSize:11,color:”#fff”}}>✓</span>}
</div>
<span style={{flex:1,color:”#fff”,fontSize:14,textDecoration:t.done?“line-through”:“none”}}>{t.text}</span>
<button onClick={e=>{e.stopPropagation();del(t.id);}} style={{background:“none”,border:“none”,color:“rgba(255,100,100,0.4)”,cursor:“pointer”,fontSize:15}}>✕</button>
</Glass>
))}
</div>
</div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLASHCARD
// ═══════════════════════════════════════════════════════════════════════════════
function FlashTab({state,setState,addXP,addBadge}) {
const [mode,setMode]=useState(“manage”);
const [front,setFront]=useState(””), [back,setBack]=useState(””);
const [idx,setIdx]=useState(0), [flipped,setFlipped]=useState(false);
const [shuffled,setShuffled]=useState([]), [known,setKnown]=useState(new Set());
const [testQ,setTestQ]=useState(null), [testAns,setTestAns]=useState(””), [testResult,setTestResult]=useState(null);

const cards=state.flashcards;
const addCard=()=>{
if(!front.trim()||!back.trim()) return;
setState(p=>{
const nb=[…(p.badges||[])];
const nc=[…p.flashcards,{id:Date.now(),front:front.trim(),back:back.trim(),starred:false}];
if(nc.length===1&&!nb.includes(“first_card”)) nb.push(“first_card”);
if(nc.length>=20&&!nb.includes(“cards_20”)) nb.push(“cards_20”);
return {…p,flashcards:nc,badges:nb};
});
setFront(””); setBack(””); SFX.success(); addXP(2,“🃏 +2 XP!”);
if(cards.length===0) addBadge(“first_card”);
if(cards.length>=19) addBadge(“cards_20”);
};
const startStudy=(sh)=>{ const a=sh?[…cards].sort(()=>Math.random()-.5):[…cards]; setShuffled(a); setIdx(0); setFlipped(false); setKnown(new Set()); setMode(“study”); };
const flip=()=>{ SFX.flip(); setFlipped(f=>!f); };
const nav=d=>{ setIdx(i=>Math.max(0,Math.min(shuffled.length-1,i+d))); setFlipped(false); };
const markKnown=()=>{ setKnown(s=>new Set([…s,shuffled[idx]?.id])); addXP(3,“✨ +3 XP!”); nav(1); SFX.success(); };
const startTest=()=>{ const q=cards[Math.floor(Math.random()*cards.length)]; setTestQ(q); setTestAns(””); setTestResult(null); setMode(“test”); };
const checkTest=()=>{ if(!testAns.trim()) return; const ok=testAns.toLowerCase().trim()===testQ.back.toLowerCase().trim(); setTestResult(ok); if(ok){SFX.success();addXP(10,“🧠 Correct! +10 XP!”);}else SFX.error(); };
const knownPct=shuffled.length>0?Math.round(known.size/shuffled.length*100):0;

if(mode===“study”) return (
<div style={{display:“flex”,flexDirection:“column”,alignItems:“center”,gap:16}}>
<div style={{display:“flex”,gap:10,alignSelf:“stretch”,alignItems:“center”}}>
<Btn onClick={()=>setMode(“manage”)} variant=“ghost” small>← Буцах</Btn>
<span style={{color:“rgba(255,255,255,0.4)”,fontSize:12}}>{idx+1}/{shuffled.length}</span>
<div style={{flex:1,height:4,background:“rgba(255,255,255,0.08)”,borderRadius:2,overflow:“hidden”}}>
<div style={{height:“100%”,width:`${knownPct}%`,background:“linear-gradient(90deg,#7C3AED,#A855F7)”,borderRadius:2,transition:“width 0.3s”}}/>
</div>
<span style={{color:”#A78BFA”,fontSize:12,fontWeight:700}}>{knownPct}%</span>
</div>
{shuffled[idx]&&(
<div onClick={flip} style={{perspective:1000,cursor:“pointer”,width:“100%”,maxWidth:460,height:270}}>
<div style={{position:“relative”,width:“100%”,height:“100%”,transformStyle:“preserve-3d”,transform:flipped?“rotateY(180deg)”:“rotateY(0)”,transition:“transform 0.5s cubic-bezier(.4,0,.2,1)”}}>
{[false,true].map(isB=>(
<Glass key={isB} style={{position:“absolute”,inset:0,backfaceVisibility:“hidden”,transform:isB?“rotateY(180deg)”:“none”,display:“flex”,flexDirection:“column”,alignItems:“center”,justifyContent:“center”,padding:28,textAlign:“center”}}>
<div style={{fontSize:11,color:“rgba(255,255,255,0.35)”,letterSpacing:3,marginBottom:12,textTransform:“uppercase”}}>{isB?“Хариулт”:“Асуулт”}</div>
<div style={{fontSize:21,color:”#fff”,fontWeight:600,lineHeight:1.5}}>{isB?shuffled[idx].back:shuffled[idx].front}</div>
{!isB&&<div style={{fontSize:11,color:“rgba(255,255,255,0.25)”,marginTop:16}}>Эргүүлэх</div>}
</Glass>
))}
</div>
</div>
)}
<div style={{display:“flex”,gap:10}}>
<Btn onClick={()=>nav(-1)} variant=“ghost” style={{minWidth:44}}>←</Btn>
<Btn onClick={markKnown} variant="success">✓ Мэдлэм</Btn>
<Btn onClick={()=>nav(1)} variant=“ghost” style={{minWidth:44}}>→</Btn>
</div>
</div>
);

if(mode===“test”) return (
<div style={{display:“flex”,flexDirection:“column”,alignItems:“center”,gap:16}}>
<Btn onClick={()=>setMode(“manage”)} variant=“ghost” small style={{alignSelf:“flex-start”}}>← Буцах</Btn>
<Glass style={{padding:32,width:“100%”,maxWidth:440,textAlign:“center”}}>
<div style={{fontSize:11,color:”#A78BFA”,letterSpacing:3,marginBottom:12}}>🧠 ТЕСТ</div>
<div style={{fontSize:19,color:”#fff”,fontWeight:600,marginBottom:20}}>{testQ?.front}</div>
<input value={testAns} onChange={e=>setTestAns(e.target.value)} onKeyDown={e=>e.key===“Enter”&&checkTest()} placeholder=“Хариулт…” disabled={testResult!==null}
style={{width:“100%”,background:“rgba(255,255,255,0.06)”,border:`1px solid ${testResult===null?"rgba(255,255,255,0.1)":testResult?"rgba(34,197,94,0.5)":"rgba(239,68,68,0.5)"}`,borderRadius:12,padding:“11px 14px”,color:”#fff”,fontSize:14,outline:“none”,fontFamily:“inherit”,boxSizing:“border-box”}}/>
{testResult!==null&&<div style={{marginTop:12,color:testResult?”#4ADE80”:”#F87171”,fontWeight:600}}>{testResult?“✅ Зөв! 🎉”:“❌ Буруу. Хариулт: “+testQ?.back}</div>}
<div style={{display:“flex”,gap:10,marginTop:18,justifyContent:“center”}}>
{testResult===null?<Btn onClick={checkTest}>Шалгах</Btn>:<Btn onClick={startTest}>Дараагийн →</Btn>}
</div>
</Glass>
</div>
);

return (
<div style={{display:“flex”,flexDirection:“column”,gap:14}}>
<Glass style={{padding:18}}>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:10,marginBottom:10}}>
<input value={front} onChange={e=>setFront(e.target.value)} placeholder=“Урд тал (асуулт)” style={{background:“rgba(255,255,255,0.06)”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:11,padding:“9px 13px”,color:”#fff”,fontSize:13,outline:“none”,fontFamily:“inherit”}}/>
<input value={back} onChange={e=>setBack(e.target.value)} onKeyDown={e=>e.key===“Enter”&&addCard()} placeholder=“Арын тал (хариулт)” style={{background:“rgba(255,255,255,0.06)”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:11,padding:“9px 13px”,color:”#fff”,fontSize:13,outline:“none”,fontFamily:“inherit”}}/>
</div>
<div style={{display:“flex”,gap:8,flexWrap:“wrap”}}>
<Btn onClick={addCard}>+ Карт нэмэх</Btn>
{cards.length>0&&<><Btn onClick={()=>startStudy(false)} variant=“ghost”>📖 Судлах</Btn><Btn onClick={()=>startStudy(true)} variant=“ghost”>🔀 Shuffle</Btn><Btn onClick={startTest} variant="ghost">🧠 Test</Btn></>}
</div>
</Glass>
<div style={{display:“grid”,gridTemplateColumns:“repeat(auto-fill,minmax(190px,1fr))”,gap:10}}>
{cards.map(c=>(
<Glass key={c.id} style={{padding:16,position:“relative”}}>
<button onClick={()=>setState(p=>({…p,flashcards:p.flashcards.map(x=>x.id===c.id?{…x,starred:!x.starred}:x)}))} style={{position:“absolute”,top:10,right:10,background:“none”,border:“none”,cursor:“pointer”,fontSize:15}}>{c.starred?“⭐”:“☆”}</button>
<div style={{fontSize:11,color:“rgba(255,255,255,0.35)”,marginBottom:4}}>Q:</div>
<div style={{color:”#fff”,fontSize:13,fontWeight:500,marginBottom:8}}>{c.front}</div>
<div style={{fontSize:11,color:“rgba(255,255,255,0.35)”,marginBottom:4}}>A:</div>
<div style={{color:”#A78BFA”,fontSize:13}}>{c.back}</div>
<button onClick={()=>setState(p=>({…p,flashcards:p.flashcards.filter(x=>x.id!==c.id)}))} style={{marginTop:10,background:“none”,border:“none”,color:“rgba(255,100,100,0.35)”,cursor:“pointer”,fontSize:11}}>✕ Устгах</button>
</Glass>
))}
</div>
</div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════════════════════════════════════
function NotesTab({state,setState,addXP,addBadge}) {
const [active,setActive]=useState(null);
const [title,setTitle]=useState(””), [content,setContent]=useState(””), [editId,setEditId]=useState(null);
const save=()=>{
if(!title.trim()) return;
if(editId){ setState(p=>({…p,notes:p.notes.map(n=>n.id===editId?{…n,title,content,updated:Date.now()}:n)})); }
else { setState(p=>({…p,notes:[…p.notes,{id:Date.now(),title,content,created:Date.now()}]})); addXP(5,“📝 +5 XP!”); addBadge(“note_1”); }
setTitle(””); setContent(””); setEditId(null); setActive(null); SFX.success();
};
if(active) return (
<div style={{display:“flex”,flexDirection:“column”,gap:12}}>
<Btn onClick={()=>{setActive(null);setTitle(””);setContent(””);setEditId(null);}} variant=“ghost” small style={{alignSelf:“flex-start”}}>← Буцах</Btn>
<input value={title} onChange={e=>setTitle(e.target.value)} placeholder=“Гарчиг…” style={{background:“rgba(255,255,255,0.06)”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:12,padding:“11px 14px”,color:”#fff”,fontSize:16,fontWeight:600,outline:“none”,fontFamily:“inherit”}}/>
<textarea value={content} onChange={e=>setContent(e.target.value)} placeholder=“Конспектоо бичнэ үү…” rows={16} style={{background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.08)”,borderRadius:12,padding:“13px 15px”,color:”#fff”,fontSize:13,outline:“none”,fontFamily:“inherit”,resize:“vertical”,lineHeight:1.75}}/>
<Btn onClick={save} style={{alignSelf:“flex-start”}}>💾 Хадгалах</Btn>
</div>
);
return (
<div style={{display:“flex”,flexDirection:“column”,gap:14}}>
<Btn onClick={()=>setActive(“new”)} style={{alignSelf:“flex-start”}}>+ Шинэ конспект</Btn>
{state.notes.length===0&&<div style={{textAlign:“center”,color:“rgba(255,255,255,0.25)”,padding:32}}>Конспект байхгүй</div>}
{state.notes.map(n=>(
<Glass key={n.id} style={{padding:18}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“flex-start”}}>
<div style={{flex:1}}>
<div style={{color:”#fff”,fontWeight:700,fontSize:15,marginBottom:5}}>{n.title}</div>
<div style={{color:“rgba(255,255,255,0.4)”,fontSize:12,lineHeight:1.6,whiteSpace:“pre-wrap”,maxHeight:60,overflow:“hidden”}}>{n.content}</div>
<div style={{fontSize:11,color:“rgba(255,255,255,0.2)”,marginTop:8}}>{new Date(n.created).toLocaleDateString(“mn-MN”)}</div>
</div>
<div style={{display:“flex”,gap:6,marginLeft:10}}>
<Btn onClick={()=>{setTitle(n.title);setContent(n.content);setEditId(n.id);setActive(“edit”);}} variant=“ghost” small>✏️</Btn>
<Btn onClick={()=>setState(p=>({…p,notes:p.notes.filter(x=>x.id!==n.id)}))} variant=“danger” small>✕</Btn>
</div>
</div>
</Glass>
))}
</div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════
const DAYS=[“Mon”,“Tue”,“Wed”,“Thu”,“Fri”,“Sat”,“Sun”], DAY_MN=[“Дав”,“Мяг”,“Лха”,“Пүр”,“Ба”,“Бям”,“Ня”];
function ScheduleTab({state,setState,addXP}) {
const [sel,setSel]=useState(“Mon”), [input,setInput]=useState(””);
const [dlTitle,setDlTitle]=useState(””), [dlDate,setDlDate]=useState(””);
const add=()=>{ if(!input.trim()) return; setState(p=>({…p,schedule:{…p.schedule,[sel]:[…(p.schedule[sel]||[]),input.trim()]}})); setInput(””); SFX.click(); };
const addDl=()=>{ if(!dlTitle.trim()||!dlDate) return; setState(p=>({…p,deadlines:[…p.deadlines,{id:Date.now(),title:dlTitle,date:dlDate}]})); setDlTitle(””); setDlDate(””); SFX.success(); addXP(2,“📅 +2 XP”); };
const now=Date.now();
return (
<div style={{display:“flex”,flexDirection:“column”,gap:16}}>
<Glass style={{padding:20}}>
<div style={{fontSize:11,color:“rgba(255,255,255,0.4)”,letterSpacing:2,marginBottom:12}}>7 ХОНОГИЙН ХИЧЭЭЛ</div>
<div style={{display:“flex”,gap:6,marginBottom:14,flexWrap:“wrap”}}>
{DAYS.map((d,i)=><Btn key={d} onClick={()=>setSel(d)} variant={sel===d?“primary”:“ghost”} small>{DAY_MN[i]}</Btn>)}
</div>
<div style={{display:“flex”,gap:10,marginBottom:10}}>
<input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key===“Enter”&&add()} placeholder=“Хичээл нэмэх…” style={{flex:1,background:“rgba(255,255,255,0.06)”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:10,padding:“8px 13px”,color:”#fff”,fontSize:13,outline:“none”,fontFamily:“inherit”}}/>
<Btn onClick={add} small>+</Btn>
</div>
{(state.schedule[sel]||[]).map((l,i)=>(
<div key={i} style={{display:“flex”,alignItems:“center”,gap:10,padding:“7px 12px”,background:“rgba(255,255,255,0.03)”,borderRadius:9,marginBottom:5}}>
<span style={{color:”#A78BFA”,fontSize:11}}>•</span>
<span style={{flex:1,color:“rgba(255,255,255,0.8)”,fontSize:13}}>{l}</span>
<button onClick={()=>setState(p=>({…p,schedule:{…p.schedule,[sel]:p.schedule[sel].filter((_,j)=>j!==i)}}))} style={{background:“none”,border:“none”,color:“rgba(255,100,100,0.35)”,cursor:“pointer”}}>✕</button>
</div>
))}
</Glass>
<Glass style={{padding:20}}>
<div style={{fontSize:11,color:“rgba(255,255,255,0.4)”,letterSpacing:2,marginBottom:12}}>⏰ DEADLINE TRACKER</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr auto auto”,gap:8,marginBottom:12,alignItems:“center”}}>
<input value={dlTitle} onChange={e=>setDlTitle(e.target.value)} placeholder=“Шалгалт / даалгавар…” style={{background:“rgba(255,255,255,0.06)”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:10,padding:“8px 13px”,color:”#fff”,fontSize:13,outline:“none”,fontFamily:“inherit”}}/>
<input type=“date” value={dlDate} onChange={e=>setDlDate(e.target.value)} style={{background:“rgba(255,255,255,0.06)”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:10,padding:“8px 10px”,color:”#fff”,fontSize:12,outline:“none”,fontFamily:“inherit”}}/>
<Btn onClick={addDl} small>+</Btn>
</div>
{[…state.deadlines].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(d=>{
const diff=Math.ceil((new Date(d.date)-now)/(86400000));
const col=diff<3?”#F87171”:diff<7?”#FBBF24”:”#4ADE80”;
return (
<div key={d.id} style={{display:“flex”,alignItems:“center”,gap:10,padding:“9px 13px”,background:“rgba(255,255,255,0.03)”,borderRadius:9,marginBottom:5}}>
<div style={{width:7,height:7,borderRadius:“50%”,background:col,flexShrink:0}}/>
<span style={{flex:1,color:“rgba(255,255,255,0.8)”,fontSize:13}}>{d.title}</span>
<span style={{color:col,fontSize:12,fontWeight:700}}>{diff>0?diff+“х”:“Өнөөдөр!”}</span>
<span style={{color:“rgba(255,255,255,0.25)”,fontSize:11}}>{d.date}</span>
<button onClick={()=>setState(p=>({…p,deadlines:p.deadlines.filter(x=>x.id!==d.id)}))} style={{background:“none”,border:“none”,color:“rgba(255,100,100,0.35)”,cursor:“pointer”}}>✕</button>
</div>
);
})}
</Glass>
</div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════
function StatsTab({state}) {
const lv=getLevel(state.xp), prog=getXPProgress(state.xp);
return (
<div style={{display:“flex”,flexDirection:“column”,gap:14}}>
<div style={{display:“grid”,gridTemplateColumns:“repeat(2,1fr)”,gap:10}}>
{[
{icon:“⚡”,val:`Lvl ${lv}`,sub:`${state.xp} XP`,color:”#A78BFA”},
{icon:“🔥”,val:state.streak,sub:“Streak хоног”,color:”#F59E0B”},
{icon:“⏱”,val:`${Math.floor(state.studyMinutes/60)}ц ${state.studyMinutes%60}м`,sub:“Нийт судалсан”,color:”#34D399”},
{icon:“🏆”,val:(state.badges||[]).length,sub:“Badge авсан”,color:”#EC4899”},
].map((s,i)=>(
<Glass key={i} style={{padding:18,textAlign:“center”}}>
<div style={{fontSize:26}}>{s.icon}</div>
<div style={{fontSize:22,fontWeight:800,color:s.color,marginTop:4}}>{s.val}</div>
<div style={{fontSize:11,color:“rgba(255,255,255,0.35)”,marginTop:2}}>{s.sub}</div>
</Glass>
))}
</div>
<Glass style={{padding:20}}>
<div style={{fontSize:11,color:“rgba(255,255,255,0.4)”,marginBottom:10,letterSpacing:2}}>LEVEL {lv} → {lv+1}</div>
<div style={{height:10,background:“rgba(255,255,255,0.07)”,borderRadius:5,overflow:“hidden”}}>
<div style={{height:“100%”,width:`${prog*100}%`,background:“linear-gradient(90deg,#7C3AED,#EC4899)”,borderRadius:5,transition:“width 0.5s”}}/>
</div>
<div style={{fontSize:11,color:“rgba(255,255,255,0.25)”,marginTop:6}}>{Math.round(prog*XP_PER_LEVEL)}/{XP_PER_LEVEL} XP</div>
</Glass>
</div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({state,setState}) {
const ACCENTS=[”#7C3AED”,”#EC4899”,”#059669”,”#2563EB”,”#D97706”,”#0891B2”,”#DC2626”];
return (
<div style={{display:“flex”,flexDirection:“column”,gap:14}}>
<Glass style={{padding:22}}>
<div style={{fontSize:11,color:“rgba(255,255,255,0.4)”,letterSpacing:2,marginBottom:14}}>🎨 ACCENT ӨНГӨ</div>
<div style={{display:“flex”,gap:10,flexWrap:“wrap”}}>
{ACCENTS.map(c=><button key={c} onClick={()=>setState(p=>({…p,theme:{accent:c}}))} style={{width:34,height:34,borderRadius:“50%”,background:c,border:`3px solid ${state.theme.accent===c?"#fff":"transparent"}`,cursor:“pointer”,transition:“transform 0.2s”,transform:state.theme.accent===c?“scale(1.25)”:“scale(1)”}}/>)}
</div>
</Glass>
<Glass style={{padding:22}}>
<div style={{color:“rgba(255,255,255,0.55)”,fontSize:13,lineHeight:2}}>
📚 Flashcard: {state.flashcards.length}  •  ✅ Todo: {state.todos.length}<br/>
📝 Конспект: {state.notes.length}  •  🏆 Badge: {(state.badges||[]).length}/{ACHIEVEMENTS.length}<br/>
⚡ XP: {state.xp}  •  Lvl: {getLevel(state.xp)}  •  🔥 {state.streak} streak
</div>
</Glass>
<Btn onClick={()=>{ if(window.confirm(“Бүх өгөгдлийг устгах уу?”)){ localStorage.removeItem(“ryuarea_v1”); window.location.reload(); } }} variant=“danger”>🗑️ Бүх өгөгдлийг устгах</Btn>
</div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
{id:“pomodoro”,icon:“🍅”,label:“Pomodoro”},
{id:“todo”,icon:“✅”,label:“To-Do”},
{id:“flash”,icon:“🃏”,label:“Flashcard”},
{id:“notes”,icon:“📝”,label:“Конспект”},
{id:“schedule”,icon:“📅”,label:“Хуваарь”},
{id:“ai”,icon:“🤖”,label:“AI Chat”},
{id:“badges”,icon:“🏆”,label:“Badges”},
{id:“weekly”,icon:“📈”,label:“Weekly”},
{id:“stats”,icon:“📊”,label:“Статистик”},
{id:“settings”,icon:“⚙️”,label:“Тохиргоо”},
];

export default function App() {
const [state,setStateRaw]=useState(loadState);
const [tab,setTab]=useState(“pomodoro”);
const [toasts,setToasts]=useState([]);

const setState=useCallback(fn=>{
setStateRaw(prev=>{ const next=typeof fn===“function”?fn(prev):fn; saveState(next); return next; });
},[]);

// Streak + level badge check
useEffect(()=>{
const today=new Date().toDateString();
if(state.lastVisit!==today){
const yesterday=new Date(Date.now()-86400000).toDateString();
const ns=state.lastVisit===yesterday?state.streak+1:1;
setState(p=>({…p,lastVisit:today,streak:ns}));
if(ns>=3) addBadge(“streak_3”);
if(ns>=7) addBadge(“streak_7”);
if(ns>1) addXP(10,`🔥 ${ns}-р өдөр! +10 XP`);
}
},[]);

// Level badges
useEffect(()=>{
const lv=getLevel(state.xp);
if(lv>=5) addBadge(“level_5”);
if(lv>=10) addBadge(“level_10”);
if(state.studyMinutes>=60) addBadge(“study_60”);
},[state.xp,state.studyMinutes]);

const addXP=useCallback((amt,msg)=>{
setState(p=>({…p,xp:p.xp+amt}));
SFX.xp();
const id=Date.now()+Math.random();
setToasts(t=>[…t,{id,msg,icon:“⚡”}]);
},[setState]);

const addBadge=useCallback((id)=>{
setState(p=>{
if((p.badges||[]).includes(id)) return p;
SFX.badge();
const a=ACHIEVEMENTS.find(a=>a.id===id);
const newId=Date.now()+Math.random();
setTimeout(()=>setToasts(t=>[…t,{id:newId,msg:`${a?.name} badge авлаа! +${a?.xp}XP`,icon:a?.icon||“🏆”}]),300);
return {…p,badges:[…(p.badges||[]),id],xp:p.xp+(a?.xp||0)};
});
},[setState]);

const acc=state.theme.accent;

return (
<div style={{minHeight:“100vh”,background:“linear-gradient(135deg,#080812 0%,#140824 35%,#0A1828 65%,#080C14 100%)”,fontFamily:”‘SF Pro Display’,-apple-system,BlinkMacSystemFont,sans-serif”,position:“relative”}}>
<style>{`*{box-sizing:border-box;margin:0;padding:0;} ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:rgba(167,139,250,0.25);border-radius:2px;} input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.2);} input,textarea{color-scheme:dark;} @keyframes toastIn{from{opacity:0;transform:translateX(40px) scale(0.9)}to{opacity:1;transform:translateX(0) scale(1)}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}} .tabcontent{animation:fadeUp 0.3s ease}`}</style>

```
<ParticleCanvas/>
<CursorGlow/>

{/* TOASTS */}
<div style={{position:"fixed",top:72,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
{toasts.map(t=><Toast key={t.id} msg={t.msg} icon={t.icon} onDone={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}/>)}
</div>

{/* HEADER */}
<div style={{position:"sticky",top:0,zIndex:100,backdropFilter:"blur(32px)",background:"rgba(8,8,18,0.75)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"12px 20px"}}>
<div style={{maxWidth:820,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<div style={{width:36,height:36,borderRadius:12,background:`linear-gradient(135deg,${acc},${acc}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:`0 4px 16px ${acc}44`}}>龍</div>
<div>
<div style={{color:"#fff",fontWeight:800,fontSize:16,letterSpacing:0.5}}>RYU'S AREA</div>
<div style={{color:"rgba(255,255,255,0.3)",fontSize:10,letterSpacing:1}}>STUDY COMPANION</div>
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:14}}>
<div style={{textAlign:"right"}}>
<div style={{color:acc,fontSize:13,fontWeight:700}}>Lvl {getLevel(state.xp)} · {state.xp} XP</div>
<div style={{color:"rgba(255,255,255,0.35)",fontSize:10}}>🔥 {state.streak} streak · 🏆 {(state.badges||[]).length} badge</div>
</div>
<div style={{width:38,height:38,borderRadius:"50%",background:`conic-gradient(${acc} ${getXPProgress(state.xp)*360}deg,rgba(255,255,255,0.06) 0deg)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
<div style={{width:30,height:30,borderRadius:"50%",background:"#0D0820",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>{getLevel(state.xp)}</div>
</div>
</div>
</div>
</div>

{/* NAV */}
<div style={{position:"sticky",top:60,zIndex:99,backdropFilter:"blur(20px)",background:"rgba(8,8,18,0.55)",borderBottom:"1px solid rgba(255,255,255,0.04)",overflowX:"auto"}}>
<div style={{maxWidth:820,margin:"0 auto",display:"flex",padding:"6px 12px",gap:2}}>
{TABS.map(t=>(
<button key={t.id} onClick={()=>{SFX.click();setTab(t.id);}} style={{
background:tab===t.id?`linear-gradient(135deg,${acc}2a,${acc}0d)`:"transparent",
border:`1px solid ${tab===t.id?acc+"33":"transparent"}`,borderRadius:10,
padding:"6px 11px",color:tab===t.id?"#fff":"rgba(255,255,255,0.38)",
cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:tab===t.id?700:400,
whiteSpace:"nowrap",transition:"all 0.18s",display:"flex",alignItems:"center",gap:4
}}>
<span>{t.icon}</span><span>{t.label}</span>
</button>
))}
</div>
</div>

{/* CONTENT */}
<div style={{maxWidth:820,margin:"0 auto",padding:"20px 14px 80px",position:"relative",zIndex:2}}>
<div className="tabcontent" key={tab}>
{tab==="pomodoro" && <PomodoroTab state={state} setState={setState} addXP={addXP} addBadge={addBadge}/>}
{tab==="todo" && <TodoTab state={state} setState={setState} addXP={addXP} addBadge={addBadge}/>}
{tab==="flash" && <FlashTab state={state} setState={setState} addXP={addXP} addBadge={addBadge}/>}
{tab==="notes" && <NotesTab state={state} setState={setState} addXP={addXP} addBadge={addBadge}/>}
{tab==="schedule" && <ScheduleTab state={state} setState={setState} addXP={addXP}/>}
{tab==="ai" && <AIChatTab state={state} addXP={addXP} addBadge={addBadge}/>}
{tab==="badges" && <BadgesTab state={state}/>}
{tab==="weekly" && <WeeklyTab state={state}/>}
{tab==="stats" && <StatsTab state={state}/>}
{tab==="settings" && <SettingsTab state={state} setState={setState}/>}
</div>
</div>
</div>
```

);
}
