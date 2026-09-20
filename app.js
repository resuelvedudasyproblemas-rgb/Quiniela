import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const cfg = window.QUINIELA_CONFIG || {};
const configured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("TU-PROYECTO") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("TU_CLAVE");

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let sb, user, roomId, roomCode, myMember, journey, matches = [], members = [], picks = [], journeys = [], allMatches = [], allPicks = [], allElige8 = [], allJointPicks = [], allJointElige8 = [];
let channel = null;
let saving = false;
let elige8Saving = false;
let jointSaving = false;
let jointElige8Saving = false;
let selectedJourneyId = null;
const MATCH_FILTER_KEY="quiniela-match-filter";
const MATCH_FILTER_MODES=new Set(["all","pending","correct","wrong","e8"]);
const savedMatchFilter=localStorage.getItem(MATCH_FILTER_KEY);
let activeMatchFilter = MATCH_FILTER_MODES.has(savedMatchFilter)?savedMatchFilter:"all";
let notices = [];
let pushSubscribed = false;
const VAPID_PUBLIC_KEY = "BFmY1Uy8yquoZDQ57fxY2awxtrfSXYh-Nj0LtK4fuWKbrTRoSH6Z9hYtfShACqyMeeWMLo1LlLx52FwZuuE3W0o";
let installPrompt = null;
let countdownTimer = null;
const requestedView = new URLSearchParams(location.search).get("view") || "play";
const UNIQUE_ROOM_CODE = "R4LBRU";

const escapeHtml = (str="") => str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const TEAM_DOMAINS={"CEUTA":"adceutafc.com","REAL SOCIEDAD":"realsociedad.eus","REAL SOCIEDAD B":"realsociedad.eus","GRANADA":"granadacf.es","ANDORRA":"fcandorra.com","CELTA":"rccelta.es","CELTA FORTUNA":"rccelta.es","SABADELL":"cesabadellfc.com","TENERIFE":"clubdeportivotenerife.es","CADIZ":"cadizcf.com","REAL VALLADOLID":"realvalladolid.es","CORDOBA":"cordobacf.com","MALLORCA":"rcdmallorca.es","ALMERIA":"udalmeriasad.com","BURGOS":"burgoscf.es","ELDENSE":"cdeldense.es","EIBAR":"sdeibar.com","LAS PALMAS":"udlaspalmas.es","REAL OVIEDO":"realoviedo.es","SPORTING":"realsporting.com","LEGANES":"cdleganes.com","CASTELLON":"cdcastellon.com","ATHLETIC CLUB":"athletic-club.eus","AT MADRID":"atleticodemadrid.com","ATLETICO MADRID":"atleticodemadrid.com","VALENCIA":"valenciacf.com","SEVILLA":"sevillafc.es","DEPORTIVO":"rcdeportivo.es","ESPANYOL":"rcdespanyol.com","REAL MADRID":"realmadrid.com","BARCELONA":"fcbarcelona.com","VILLARREAL":"villarrealcf.es","BETIS":"realbetisbalompie.es","REAL BETIS":"realbetisbalompie.es","RAYO VALLECANO":"rayovallecano.es","GETAFE":"getafecf.com","ALAVES":"deportivoalaves.com","GIRONA":"gironafc.cat","OSASUNA":"osasuna.es","LEVANTE":"levanteud.com","ELCHE":"elchecf.es","RACING":"realracingclub.es","RACING SANTANDER":"realracingclub.es","MALAGA":"malagacf.com","HUESCA":"sdhuesca.es","ZARAGOZA":"realzaragoza.com","ALBACETE":"albacetebalompie.es","MIRANDES":"cdmirandes.com"};
const TEAM_FLAGS={"ESPANA":"🇪🇸","INGLATERRA":"🏴","FRANCIA":"🇫🇷","ITALIA":"🇮🇹","ALEMANIA":"🇩🇪","PORTUGAL":"🇵🇹"};
function normalizeTeamName(name=""){const c=String(name).replace(/\s*\([MF]\)\s*$/i,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\./g,"").replace(/\s+/g," ").trim();return ({"R VALLADOLID":"REAL VALLADOLID","R OVIEDO":"REAL OVIEDO","ATLETICO DE MADRID":"ATLETICO MADRID","RC DEPORTIVO":"DEPORTIVO","UD LAS PALMAS":"LAS PALMAS","CD LEGANES":"LEGANES"})[c]||c}
function teamInitials(name=""){const p=normalizeTeamName(name).replace(/\b(CLUB|FUTBOL|FOOTBALL|CF|FC|CD|UD|SAD)\b/g,"").trim().split(/\s+/).filter(Boolean);return p.length===1?p[0].slice(0,2):(p[0][0]+p[1][0]).slice(0,2)}
function teamCrestHtml(name,size="",logoUrl=""){
  const key=normalizeTeamName(name);
  const label=escapeHtml(String(name).replace(/\s*\([MF]\)\s*$/i,""));
  const initials=escapeHtml(teamInitials(name));
  const direct=logoUrl?String(logoUrl):"";
  if(direct){
    return `<span class="team-crest ${size}" title="${label}"><span class="crest-fallback">${initials}</span><img class="team-crest-img high-quality" src="${escapeHtml(direct)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></span>`;
  }
  const flag=TEAM_FLAGS[key];
  if(flag) return `<span class="team-crest ${size} flag-crest" title="${label}">${flag}</span>`;
  const domain=TEAM_DOMAINS[key];
  if(!domain) return `<span class="team-crest ${size} fallback-only" title="${label}"><span class="crest-fallback">${initials}</span></span>`;
  const src=`https://www.google.com/s2/favicons?domain_url=https://${encodeURIComponent(domain)}&sz=128`;
  return `<span class="team-crest ${size}" title="${label}"><span class="crest-fallback">${initials}</span><img class="team-crest-img" src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></span>`;
}
function teamPositionHtml(position,compact=false){
  const n=Number(position);
  if(!Number.isInteger(n)||n<1)return "";
  return `<span class="team-position${compact?" compact":""}" title="Posición en Liga antes de esta jornada">${n}.º</span>`;
}
function teamInlineHtml(name,logoUrl="",position=null){
  return `<span class="team-inline">${teamCrestHtml(name,"sm",logoUrl)}${teamPositionHtml(position,true)}<span>${escapeHtml(name)}</span></span>`;
}
function fixtureMiniHtml(m){
  return `<span class="fixture-mini"><span class="fixture-mini-team">${teamCrestHtml(m.home,"xs",m.home_logo_url)}${teamPositionHtml(m.home_position,true)}<span>${escapeHtml(m.home)}</span></span><span class="fixture-mini-sep">–</span><span class="fixture-mini-team">${teamCrestHtml(m.away,"xs",m.away_logo_url)}${teamPositionHtml(m.away_position,true)}<span>${escapeHtml(m.away)}</span></span></span>`;
}
function simplifyTvChannels(channels){
  const clean=(channels||[]).map(ch=>String(ch).replace(/\s*\([^)]*\)\s*$/,"").trim()).filter(Boolean);
  const unique=[...new Set(clean)];
  return {visible:unique.slice(0,2),extra:Math.max(0,unique.length-2)};
}
function tvBroadcastHtml(m,compact=false){
  const channels=Array.isArray(m?.tv_channels)?m.tv_channels.filter(Boolean):[];
  const cls=compact?"tv-broadcast compact":"tv-broadcast";
  if(!channels.length){
    return `<div class="${cls} pending-tv"><span class="tv-icon" aria-hidden="true">▣</span><span class="tv-title">TV</span><span class="tv-pending">Por confirmar</span></div>`;
  }
  const simple=simplifyTvChannels(channels);
  return `<div class="${cls}"><span class="tv-icon" aria-hidden="true">▣</span><span class="tv-title">TV</span><div class="tv-channels">${simple.visible.map(ch=>`<span class="tv-channel">${escapeHtml(ch)}</span>`).join("")}${simple.extra?`<span class="tv-channel tv-more">+${simple.extra}</span>`:""}</div></div>`;
}

function show(id) {
  ["boot","setupMissing","onboarding","app"].forEach(x => $("#"+x).classList.toggle("hidden", x !== id));
}

function toast(msg) {
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove("show"),1800);
}
function currentTheme(){
  return document.documentElement.dataset.theme==="dark"?"dark":"light";
}
function applyTheme(theme,persist=true){
  const next=theme==="dark"?"dark":"light";
  document.documentElement.dataset.theme=next;
  if(persist) localStorage.setItem("quiniela-theme",next);
  const btn=$("#themeToggle");
  if(btn){
    const dark=next==="dark";
    const icon=btn.querySelector(".theme-icon");
    const label=btn.querySelector(".theme-label");
    if(icon) icon.textContent=dark?"☀":"☾";
    if(label) label.textContent=dark?"Claro":"Oscuro";
    btn.setAttribute("aria-label",dark?"Activar modo claro":"Activar modo oscuro");
    btn.setAttribute("aria-pressed",dark?"true":"false");
  }
  const meta=$("#themeColor");
  if(meta) meta.setAttribute("content",next==="dark"?"#07150f":"#0b5d3b");
}
function toggleTheme(){
  applyTheme(currentTheme()==="dark"?"light":"dark");
}

function setSync(mode,text) {
  const el=$("#syncBadge"); el.className="sync-badge "+mode; el.innerHTML=`<span></span><b class="sync-label">${escapeHtml(text)}</b>`;
}

function cleanCode(v){ return v.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6); }
function randomCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}
function formatDate(d){
  return new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"long",year:"numeric"}).format(new Date(d+"T12:00:00"));
}
function formatKickoff(v){
  if(!v) return "Horario pendiente";
  const formatted=new Intl.DateTimeFormat("es-ES",{
    timeZone:"Europe/Madrid",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"
  }).format(new Date(v));
  return formatted.replace(",", " ·");
}
function matchesForJourney(journeyId){
  return allMatches.filter(m=>m.journey_id===journeyId).sort((a,b)=>a.number-b.number);
}
function matchResolved(m){
  return m?.home_score!=null && m?.away_score!=null;
}
function resultSignForMatch(m){
  if(!m || m.number===15 || !matchResolved(m)) return null;
  return m.result_sign || (m.home_score>m.away_score?"1":m.home_score<m.away_score?"2":"X");
}
function normalizedGoalScore(score){
  if(score==null) return null;
  return score>=3?"M":String(score);
}
function journeyResolvedCount(j){
  const ms=matchesForJourney(j.id);
  return ms.filter(matchResolved).length;
}
function journeyDisplayState(j){
  const resolved=journeyResolvedCount(j);
  const total=matchesForJourney(j.id).length;
  if(total===15 && resolved===15) return "finished";
  if(j.status==="open") return "open";
  const firstKickoff=matchesForJourney(j.id).map(m=>m.kickoff).filter(Boolean).sort()[0];
  if(resolved>0 || (firstKickoff && Date.now()>=new Date(firstKickoff).getTime())) return "playing";
  return "closed";
}
function journeyCanEdit(j){
  if(!j || j.status!=="open") return false;
  const kickoffs=matchesForJourney(j.id)
    .map(m=>m.kickoff)
    .filter(Boolean)
    .map(v=>new Date(v).getTime())
    .filter(Number.isFinite);
  if(kickoffs.length) return Date.now()<Math.min(...kickoffs);
  const draw=new Date(j.draw_date+"T00:00:00+02:00").getTime();
  return Date.now()<draw;
}
function journeyStateLabel(j){
  const state=journeyDisplayState(j);
  return state==="open"?"Abierta":state==="playing"?"En juego":state==="finished"?"Finalizada":"Cerrada";
}
function resultBarHtml(m,p){
  if(matchResolved(m)){
    if(m.number===15){
      const actualHome=normalizedGoalScore(m.home_score), actualAway=normalizedGoalScore(m.away_score);
      const hasPick=Boolean(p?.home_goals&&p?.away_goals);
      const ok=hasPick && p.home_goals===actualHome && p.away_goals===actualAway;
      const outcome=!hasPick?"Sin pronóstico":ok?"✓ Acierto":"✕ Fallo";
      const cls=!hasPick?"neutral":ok?"correct":"wrong";
      return `<div class="match-result-bar ${cls}"><span>Pleno oficial <strong>${actualHome}-${actualAway}</strong></span><span class="result-outcome">${outcome}</span></div>`;
    }
    const actual=resultSignForMatch(m);
    const hasPick=Boolean(p?.pick);
    const ok=hasPick && p.pick===actual;
    const outcome=!hasPick?"Sin pronóstico":ok?"✓ Acierto":"✕ Fallo";
    const cls=!hasPick?"neutral":ok?"correct":"wrong";
    return `<div class="match-result-bar ${cls}"><span>Signo oficial <strong>${actual}</strong></span><span class="result-outcome">${outcome}</span></div>`;
  }
  if(m?.kickoff && Date.now()>=new Date(m.kickoff).getTime() && journeyDisplayState(journey)==="playing"){
    return `<div class="match-result-bar pending"><span>Partido pendiente de resultado oficial</span></div>`;
  }
  return "";
}
function renderJourneySwitcher(){
  const el=$("#journeySwitcher");
  if(!el) return;
  const available=journeys
    .filter(j=>journeyDisplayState(j)!=="finished")
    .sort((a,b)=>b.number-a.number);
  if(!available.length){ el.classList.add("hidden"); el.innerHTML=""; return; }
  el.classList.remove("hidden");
  el.innerHTML=available.map(j=>{
    const state=journeyDisplayState(j);
    const resolved=journeyResolvedCount(j);
    const detail=state==="playing"?`${resolved}/15 resultados`:state==="open"?"Pronósticos abiertos":"Esperando partidos";
    return `<button type="button" class="journey-choice ${j.id===journey.id?"active":""} state-${state}" data-journey-id="${j.id}">
      <span>J${j.number}</span><strong>${journeyStateLabel(j)}</strong><small>${detail}</small>
    </button>`;
  }).join("");
  $$(".journey-choice").forEach(btn=>btn.addEventListener("click",()=>{
    selectedJourneyId=Number(btn.dataset.journeyId);
    selectActiveJourney();
    renderAll();
  }));
}

function countdownText(v){
  if(!v) return "Horario pendiente";
  const diff=new Date(v).getTime()-Date.now();
  if(diff<=0) return "Ya iniciado";
  const mins=Math.floor(diff/60000);
  if(mins<60) return `Empieza en ${Math.max(1,mins)} min`;
  const hours=Math.floor(mins/60);
  if(hours<24) return `Empieza en ${hours} h ${mins%60} min`;
  const days=Math.floor(hours/24);
  return `Empieza en ${days} d ${hours%24} h`;
}
function updateCountdowns(){
  $$("[data-countdown]").forEach(el=>{
    const value=el.dataset.countdown;
    if(value) el.textContent=countdownText(value);
  });
}
function startCountdownTimer(){
  if(countdownTimer) clearInterval(countdownTimer);
  updateCountdowns();
  countdownTimer=setInterval(updateCountdowns,30000);
}
function nextUnresolvedMatch(j=journey){
  return matchesForJourney(j.id).filter(m=>!matchResolved(m)).sort((a,b)=>{
    const at=a.kickoff?new Date(a.kickoff).getTime():Number.MAX_SAFE_INTEGER;
    const bt=b.kickoff?new Date(b.kickoff).getTime():Number.MAX_SAFE_INTEGER;
    return at-bt || a.number-b.number;
  })[0]||null;
}
function commonCorrectCount(j=journey){
  const p1=memberBySlot(1),p2=memberBySlot(2);
  if(!p1||!p2) return 0;
  let n=0;
  for(const m of matchesForJourney(j.id)){
    const actual=actualResultForMatch(m);
    if(actual==="—") continue;
    const a=displayPickForJourney(p1.user_id,j.id,m.number);
    const b=displayPickForJourney(p2.user_id,j.id,m.number);
    if(a===b && a===actual) n++;
  }
  return n;
}
function projectedResultForMatch(m){
  if(!m) return "—";
  if(matchResolved(m)) return actualResultForMatch(m);
  const hasLive=m.live_home_score!=null && m.live_away_score!=null
    && (m.live_status==="inprogress" || m.live_status==="finished");
  if(!hasLive) return "—";
  if(m.number===15) return `${normalizedGoalScore(m.live_home_score)}-${normalizedGoalScore(m.live_away_score)}`;
  return m.live_home_score>m.live_away_score?"1":m.live_home_score<m.live_away_score?"2":"X";
}
function projectedScoreUserJourney(uid,j){
  let correct=0,considered=0,live=0;
  for(const m of journeyMatches(j.id)){
    const actual=projectedResultForMatch(m);
    if(actual==="—") continue;
    considered++;
    if(!matchResolved(m)) live++;
    if(displayPickForJourney(uid,j.id,m.number)===actual) correct++;
  }
  return {correct,considered,live};
}
function renderJourneyDashboard(){
  const el=$("#journeyDashboard");
  if(!el||!journey) return;
  const p1=memberBySlot(1),p2=memberBySlot(2);
  const s1=p1?scoreUserJourney(p1.user_id,journey):{correct:0,resolved:0};
  const s2=p2?scoreUserJourney(p2.user_id,journey):{correct:0,resolved:0};
  const projected1=p1?projectedScoreUserJourney(p1.user_id,journey):{correct:0,considered:0,live:0};
  const projected2=p2?projectedScoreUserJourney(p2.user_id,journey):{correct:0,considered:0,live:0};
  const c1=p1?completedCountForUser(p1.user_id):0;
  const c2=p2?completedCountForUser(p2.user_id):0;
  const resolved=journeyResolvedCount(journey);
  const playing=journeyDisplayState(journey)==="playing";
  const prize1=s1.correct>=10&&s1.correct<=15;
  const prize2=s2.correct>=10&&s2.correct<=15;
  const commonCorrect=commonCorrectCount(journey);
  const commonPrize=commonCorrect>=10&&commonCorrect<=15;
  const projectedPrize1=projected1.correct>=10&&projected1.correct<=15;
  const projectedPrize2=projected2.correct>=10&&projected2.correct<=15;
  const score1=resolved?`${s1.correct} aciertos`:`${c1}/15 hechos`;
  const score2=resolved?`${s2.correct} aciertos`:`${c2}/15 hechos`;
  const considered=Math.max(projected1.considered,projected2.considered);
  const liveCount=Math.max(projected1.live,projected2.live);
  const projectedCopy=considered
    ? `<strong class="projected-pair"><b class="${projectedPrize1?"prize-score":""}">${projected1.correct}</b><i>·</i><b class="${projectedPrize2?"prize-score":""}">${projected2.correct}</b></strong><small>${escapeHtml(p1?.display_name||"J1")} · ${escapeHtml(p2?.display_name||"J2")}<br>${considered} valorados${liveCount?` · ${liveCount} en directo`:""}</small>`
    : `<strong class="projected-pair"><b>0</b><i>·</i><b>0</b></strong><small>Aún sin resultados</small>`;
  el.innerHTML=`
    <div class="dashboard-title-row">
      <div><span class="dashboard-live-dot ${playing?"live":""}"></span><strong>${playing?"Seguimiento de resultados":"Resumen de jornada"}</strong></div>
      <span class="dashboard-common ${commonPrize?"prize-zone":""}">${commonCorrect} coincidencias acertadas</span>
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-stat"><span>Resultados</span><strong>${resolved}/15</strong><small>${15-resolved} pendientes</small></div>
      <div class="dashboard-stat ${resolved&&prize1?"prize-zone":""}"><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${score1}</strong><small>${c1}/15 pronosticados</small></div>
      <div class="dashboard-stat ${resolved&&prize2?"prize-zone":""}"><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span><strong>${score2}</strong><small>${c2}/15 pronosticados</small></div>
      <div class="dashboard-stat projected-score-stat"><span>Aciertos posibles</span>${projectedCopy}</div>
    </div>`;
}
function matchOutcomeForUser(m,uid=user?.id){
  if(!matchResolved(m)) return "pending";
  const mine=displayPickForJourney(uid,m.journey_id,m.number);
  if(mine==="—") return "none";
  return mine===actualResultForMatch(m)?"correct":"wrong";
}
function renderMatchFilterCounts(){
  const normal=matches.filter(m=>m.number<=14);
  const counts={
    all:normal.length,
    pending:normal.filter(m=>!matchResolved(m)).length,
    correct:normal.filter(m=>matchOutcomeForUser(m)==="correct").length,
    wrong:normal.filter(m=>matchOutcomeForUser(m)==="wrong").length,
    e8:normal.filter(m=>isElige8(user.id,m.number)).length
  };
  const map={filterAll:"all",filterPending:"pending",filterCorrect:"correct",filterWrong:"wrong",filterE8:"e8"};
  Object.entries(map).forEach(([id,key])=>{const el=$("#"+id);if(el)el.textContent=counts[key]});
}
function applyMatchFilter(){
  $$(".match-filter").forEach(b=>b.classList.toggle("active",b.dataset.matchFilter===activeMatchFilter));
  $$(".match-card").forEach(card=>{
    let visible=true;
    if(activeMatchFilter==="pending") visible=card.dataset.resolved!=="true";
    if(activeMatchFilter==="correct") visible=card.dataset.outcome==="correct";
    if(activeMatchFilter==="wrong") visible=card.dataset.outcome==="wrong";
    if(activeMatchFilter==="e8") visible=card.dataset.e8==="true";
    card.classList.toggle("filter-hidden",!visible);
  });

  const pleno=$("#plenoCard"),m15=matches.find(m=>m.number===15);
  if(pleno&&m15){
    let visible=activeMatchFilter==="all";
    if(activeMatchFilter==="pending") visible=!matchResolved(m15);
    if(activeMatchFilter==="correct") visible=matchOutcomeForUser(m15)==="correct";
    if(activeMatchFilter==="wrong") visible=matchOutcomeForUser(m15)==="wrong";
    if(activeMatchFilter==="e8") visible=false;
    pleno.classList.toggle("filter-hidden",!visible);
  }
}
function setMatchFilter(mode){
  activeMatchFilter=MATCH_FILTER_MODES.has(mode)?mode:"all";
  localStorage.setItem(MATCH_FILTER_KEY,activeMatchFilter);
  applyMatchFilter();
}
function noticeStorageKey(){return roomId?`quiniela-notices-${roomId}`:"quiniela-notices"}
function pushCapable(){
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}
function urlBase64ToUint8Array(value){
  const padding="=".repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
}
async function loadNotices(){
  let local=[];
  try{local=JSON.parse(localStorage.getItem(noticeStorageKey())||"[]")}catch{local=[]}
  notices=Array.isArray(local)?local:[];
  if(sb&&user){
    const {data,error}=await sb.from("push_notifications")
      .select("id,title,body,created_at,read_at")
      .eq("user_id",user.id)
      .order("created_at",{ascending:false})
      .limit(30);
    if(!error&&data){
      const server=data.map(n=>({
        id:"server-"+n.id,
        serverId:n.id,
        title:n.title,
        body:n.body,
        at:n.created_at,
        read:Boolean(n.read_at)
      }));
      const serverKeys=new Set(server.map(n=>n.title+"\n"+n.body));
      const localOnly=notices.filter(n=>!serverKeys.has(n.title+"\n"+n.body));
      notices=[...server,...localOnly].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,30);
    }
  }
  renderNotificationBadge();
  renderNotifications();
}
function saveNotices(){
  try{
    localStorage.setItem(noticeStorageKey(),JSON.stringify(notices.filter(n=>!n.serverId).slice(0,30)));
  }catch{}
}
function renderNotificationBadge(){
  const badge=$("#notificationBadge");if(!badge)return;
  const unread=notices.filter(n=>!n.read).length;
  badge.textContent=String(unread);badge.classList.toggle("hidden",unread===0);
}
function recordNotice(title,body){
  const duplicate=notices.some(n=>n.title===title&&n.body===body&&Date.now()-new Date(n.at).getTime()<120000);
  if(duplicate)return;
  notices.unshift({id:Date.now()+Math.random(),title,body,at:new Date().toISOString(),read:false});
  notices=notices.slice(0,30);saveNotices();renderNotificationBadge();renderNotifications();
}
async function registerPushSubscription(){
  if(!pushCapable()||Notification.permission!=="granted"||!sb||!user)return false;
  const reg=await navigator.serviceWorker.ready;
  let subscription=await reg.pushManager.getSubscription();
  if(!subscription){
    subscription=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }
  const {error}=await sb.functions.invoke("push-register",{body:subscription.toJSON()});
  if(error)throw error;
  pushSubscribed=true;
  renderNotifications();
  return true;
}
async function refreshPushSubscription(){
  if(!pushCapable()||Notification.permission!=="granted")return;
  try{await registerPushSubscription()}catch(e){
    pushSubscribed=false;
    console.warn("Push:",e);
    renderNotifications();
  }
}
async function notifyUser(title,body){
  recordNotice(title,body);
  if(pushSubscribed)return;
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  try{
    if("serviceWorker" in navigator){
      const reg=await navigator.serviceWorker.ready;
      await reg.showNotification(title,{body,icon:"icon-192.svg",badge:"icon-192.svg",tag:"quiniela-"+title});
    }else new Notification(title,{body,icon:"icon-192.svg"});
  }catch(e){console.warn("Notificación:",e)}
}
function renderNotifications(){
  const list=$("#notificationList"),btn=$("#enableNotificationsBtn"),status=$("#pushStatusText");
  if(btn){
    if(!("Notification" in window)){
      btn.textContent="Notificaciones no disponibles";btn.disabled=true;
      if(status)status.textContent="Este navegador no admite notificaciones.";
    }else if(Notification.permission==="denied"){
      btn.textContent="Notificaciones bloqueadas";btn.disabled=true;
      if(status)status.textContent="Actívalas desde los permisos del navegador o del sistema.";
    }else if(Notification.permission==="granted"&&pushSubscribed){
      btn.textContent="✓ Notificaciones push activadas";btn.disabled=true;
      if(status)status.textContent="Te llegarán aunque Nuestra Quiniela esté cerrada.";
    }else if(Notification.permission==="granted"&&pushCapable()){
      btn.textContent="Completar activación push";btn.disabled=false;
      if(status)status.textContent="El permiso está concedido, falta registrar este dispositivo.";
    }else if(Notification.permission==="granted"){
      btn.textContent="✓ Avisos con la app abierta";btn.disabled=true;
      if(status)status.textContent="Este navegador no admite Web Push en este modo.";
    }else{
      btn.textContent="Activar notificaciones";btn.disabled=false;
      if(status)status.textContent=pushCapable()?"Recibirás avisos incluso con la app cerrada.":"En iPhone, instala primero la app en la pantalla de inicio para usar Web Push.";
    }
  }
  if(!list)return;
  if(!notices.length){list.innerHTML=`<div class="notification-empty">Aquí aparecerán resultados oficiales, nuevas jornadas y avisos cuando el otro jugador complete su quiniela.</div>`;return}
  const fmt=new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
  list.innerHTML=notices.map(n=>`<article class="notification-item ${n.read?"":"unread"}"><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p><small>${fmt.format(new Date(n.at))}</small></article>`).join("");
}
async function requestNotifications(){
  if(!("Notification" in window))return;
  try{
    let permission=Notification.permission;
    if(permission==="default")permission=await Notification.requestPermission();
    if(permission==="granted"){
      if(pushCapable()){
        const ok=await registerPushSubscription();
        if(ok)toast("Notificaciones push activadas");
      }else{
        toast("Notificaciones activadas mientras la app esté abierta");
      }
    }
  }catch(e){
    console.error(e);
    toast("No se pudieron activar las notificaciones");
  }
  renderNotifications();
}
async function openNotificationCenter(){
  await loadNotices();
  const serverIds=notices.filter(n=>n.serverId&&!n.read).map(n=>n.serverId);
  if(serverIds.length&&sb){
    await sb.from("push_notifications").update({read_at:new Date().toISOString()}).in("id",serverIds);
  }
  notices=notices.map(n=>({...n,read:true}));
  saveNotices();renderNotificationBadge();renderNotifications();$("#notificationDialog").showModal();
}
function detectNewResults(oldMatches){
  const oldMap=new Map((oldMatches||[]).map(m=>[`${m.journey_id}-${m.number}`,m]));
  for(const m of allMatches){
    const old=oldMap.get(`${m.journey_id}-${m.number}`);
    if(!old||matchResolved(old)||!matchResolved(m))continue;
    const j=journeys.find(x=>x.id===m.journey_id);
    const mine=displayPickForJourney(user.id,m.journey_id,m.number),actual=actualResultForMatch(m);
    const verdict=mine==="—"?"Sin pronóstico":mine===actual?"✓ Acertaste":"✕ Fallaste";
    notifyUser(`J${j?.number||""} · ${m.home} ${m.home_score}-${m.away_score} ${m.away}`,`${verdict}${m.number<=14?` · signo ${actual}`:""}`);
  }
}
const JOINT_SIGN_ORDER=["1","X","2"];
function normalizeJointSelection(value){return JOINT_SIGN_ORDER.filter(s=>String(value||"").includes(s)).join("")}
function jointOverrideFor(n,jid=journey?.id){return allJointPicks.find(x=>x.journey_id===jid&&x.match_number===n)}
function autoJointSelection(n,jid=journey?.id){
  const p1=memberBySlot(1),p2=memberBySlot(2);
  const a=p1?pickForJourney(p1.user_id,jid,n)?.pick:null,b=p2?pickForJourney(p2.user_id,jid,n)?.pick:null;
  if(!a&&!b)return "";if(a&&!b)return a;if(!a&&b)return b;return normalizeJointSelection(a===b?a:a+b);
}
function effectiveJointSelection(n,jid=journey?.id){return jointOverrideFor(n,jid)?.selection||autoJointSelection(n,jid)}
function jointSelectionKind(n,jid=journey?.id){
  if(jointOverrideFor(n,jid))return "Manual";
  const p1=memberBySlot(1),p2=memberBySlot(2),a=p1?pickForJourney(p1.user_id,jid,n)?.pick:null,b=p2?pickForJourney(p2.user_id,jid,n)?.pick:null;
  return a&&b?"Automática":"Provisional";
}
async function saveJointSelection(n,selection){
  if(!journeyCanEdit(journey)){toast("La jornada ya ha empezado o está cerrada");return}
  if(jointSaving)return;
  const clean=normalizeJointSelection(selection);if(!clean){toast("Debe quedar al menos un signo");return}
  jointSaving=true;setSync("","Guardando");
  try{
    const row={room_id:roomId,journey_id:journey.id,match_number:n,selection:clean,updated_by:user.id,updated_at:new Date().toISOString()};
    const {data,error}=await sb.from("joint_picks").upsert(row,{onConflict:"room_id,journey_id,match_number"}).select().single();
    if(error)throw error;
    allJointPicks=allJointPicks.filter(x=>!(x.journey_id===journey.id&&x.match_number===n));allJointPicks.push(data);
    renderJoint();setSync("online","Sincronizado");
  }catch(e){console.error(e);toast("No se pudo guardar la conjunta");setSync("error","Error")}
  finally{jointSaving=false}
}
async function resetJointSelection(n){
  if(!journeyCanEdit(journey))return;
  const {error}=await sb.from("joint_picks").delete().eq("room_id",roomId).eq("journey_id",journey.id).eq("match_number",n);
  if(error){console.error(error);toast("No se pudo volver a automático");return}
  allJointPicks=allJointPicks.filter(x=>!(x.journey_id===journey.id&&x.match_number===n));renderJoint();toast("Vuelve al cálculo automático");
}
function renderJoint(){
  const summary=$("#jointSummary"),list=$("#jointList");if(!summary||!list||!journey)return;
  const p1=memberBySlot(1),p2=memberBySlot(2);let singles=0,doubles=0,triples=0,pending=0;
  for(let n=1;n<=14;n++){const len=effectiveJointSelection(n).length;if(!len)pending++;else if(len===1)singles++;else if(len===2)doubles++;else triples++}
  const combinations=Math.pow(2,doubles)*Math.pow(3,triples);
  summary.innerHTML=`<div class="joint-summary-grid"><div><span>Simples</span><strong>${singles}</strong></div><div><span>Dobles</span><strong>${doubles}</strong></div><div><span>Triples</span><strong>${triples}</strong></div><div><span>Pendientes</span><strong>${pending}</strong></div></div><p>${pending?"Aún faltan pronósticos para cerrar la conjunta.":`${combinations.toLocaleString("es-ES")} combinación${combinations===1?"":"es"} resultante${combinations===1?"":"s"}.`}</p>`;
  const locked=!journeyCanEdit(journey),normal=matches.filter(m=>m.number<=14);
  list.innerHTML=normal.map(m=>{
    const sel=effectiveJointSelection(m.number),override=jointOverrideFor(m.number),kind=jointSelectionKind(m.number);
    const p1pick=p1?pickForJourney(p1.user_id,journey.id,m.number)?.pick:null,p2pick=p2?pickForJourney(p2.user_id,journey.id,m.number)?.pick:null;
    return `<article class="joint-builder-card"><div class="joint-builder-head"><span class="match-index">${String(m.number).padStart(2,"0")}</span><div class="joint-builder-fixture">${fixtureMiniHtml(m)}</div><span class="joint-mode ${override?"manual":""}">${kind}</span></div><div class="joint-source"><span>${escapeHtml(p1?.display_name||"J1")}: <b>${p1pick||"—"}</b></span><span>${escapeHtml(p2?.display_name||"J2")}: <b>${p2pick||"—"}</b></span></div><div class="joint-sign-row">${JOINT_SIGN_ORDER.map(sign=>`<button class="joint-sign ${sel.includes(sign)?"selected":""}" data-joint-match="${m.number}" data-joint-sign="${sign}" ${locked?"disabled":""}>${sign}</button>`).join("")}${override?`<button class="joint-reset" data-joint-reset="${m.number}" ${locked?"disabled":""}>Automática</button>`:""}</div></article>`;
  }).join("");
  const p15a=p1?displayPickForJourney(p1.user_id,journey.id,15):"—",p15b=p2?displayPickForJourney(p2.user_id,journey.id,15):"—";
  list.insertAdjacentHTML("beforeend",`<article class="joint-builder-card p15-joint"><div class="joint-builder-head"><span class="match-index">15</span><div><strong>Pleno al 15</strong><small>${escapeHtml(p1?.display_name||"J1")} ${p15a} · ${escapeHtml(p2?.display_name||"J2")} ${p15b}</small></div><span class="joint-mode">${p15a!=="—"&&p15a===p15b?"Coincidís":"Comparar"}</span></div></article>`);
  $$(".joint-sign").forEach(btn=>btn.addEventListener("click",()=>{const n=Number(btn.dataset.jointMatch),sign=btn.dataset.jointSign,current=effectiveJointSelection(n),next=current.includes(sign)?current.replace(sign,""):current+sign;saveJointSelection(n,next)}));
  $$(".joint-reset").forEach(btn=>btn.addEventListener("click",()=>resetJointSelection(Number(btn.dataset.jointReset))));
}
function jointElige8Selections(jid=journey?.id){
  if(!jid) return [];
  return allJointElige8.filter(e=>e.journey_id===jid).sort((a,b)=>a.match_number-b.match_number);
}

function isJointElige8(n,jid=journey?.id){
  return Boolean(allJointElige8.find(e=>e.journey_id===jid&&e.match_number===n));
}

function projectedScoreJointElige8(j=journey){
  const selected=jointElige8Selections(j?.id);
  let correct=0,wrong=0,considered=0,live=0;
  for(const e of selected){
    const m=allMatches.find(x=>x.journey_id===j.id&&x.number===e.match_number);
    const actual=projectedResultForMatch(m);
    const selection=effectiveJointSelection(e.match_number,j.id);
    if(actual==="—"||!selection) continue;
    considered++;
    if(m&&!matchResolved(m)) live++;
    if(selection.includes(actual)) correct++;
    else wrong++;
  }
  return {
    selected:selected.length,
    correct,
    wrong,
    considered,
    live,
    pending:Math.max(0,selected.length-considered)
  };
}

async function saveJointElige8Set(numbers,successText="Elige 8 conjunto actualizado"){
  if(!journeyCanEdit(journey)){toast("La jornada ya ha empezado o está cerrada");return}
  if(jointElige8Saving)return;
  const clean=[...new Set((numbers||[]).map(Number).filter(n=>n>=1&&n<=14))].slice(0,8).sort((a,b)=>a-b);
  jointElige8Saving=true;
  setSync("","Guardando");
  renderJoint();
  try{
    const {error}=await sb.rpc("set_joint_elige8",{
      p_room_id:roomId,
      p_journey_id:journey.id,
      p_match_numbers:clean
    });
    if(error)throw error;
    await loadAllJointElige8();
    renderJoint();
    setSync("online","Sincronizado");
    toast(successText);
  }catch(e){
    console.error(e);
    await loadAllJointElige8();
    renderJoint();
    setSync("error","Error");
    toast("No se pudo guardar el Elige 8 conjunto");
  }finally{
    jointElige8Saving=false;
    renderJoint();
  }
}

async function toggleJointElige8(n){
  const current=jointElige8Selections().map(e=>e.match_number);
  const selected=current.includes(n);
  if(!selected&&current.length>=8){toast("El Elige 8 conjunto ya tiene 8 partidos");return}
  const next=selected?current.filter(x=>x!==n):[...current,n];
  await saveJointElige8Set(next,selected?"Partido quitado del E8 conjunto":"Partido añadido al E8 conjunto");
}

async function copyJointElige8From(uid,label){
  if(!uid)return;
  const numbers=allElige8
    .filter(e=>e.user_id===uid&&e.journey_id===journey.id)
    .map(e=>e.match_number)
    .sort((a,b)=>a-b)
    .slice(0,8);
  if(!numbers.length){toast(`${label} todavía no tiene Elige 8`);return}
  await saveJointElige8Set(numbers,`Copiado el Elige 8 de ${label}`);
}

async function autoJointElige8(){
  const p1=memberBySlot(1),p2=memberBySlot(2);
  const ranked=matches.filter(m=>m.number<=14).map(m=>{
    const e1=p1?isElige8(p1.user_id,m.number):false;
    const e2=p2?isElige8(p2.user_id,m.number):false;
    const simple=effectiveJointSelection(m.number).length===1;
    return {n:m.number,score:(e1&&e2?100:(e1||e2?50:0))+(simple?10:0)};
  }).sort((a,b)=>b.score-a.score||a.n-b.n);
  await saveJointElige8Set(ranked.slice(0,8).map(x=>x.n),"Elige 8 conjunto generado por coincidencias");
}

function decorateJointElige8UI(){
  const summary=$("#jointSummary"),list=$("#jointList");
  if(!summary||!list||!journey)return;
  const p1=memberBySlot(1),p2=memberBySlot(2);
  const score=projectedScoreJointElige8(journey);
  const locked=!journeyCanEdit(journey);

  let panel=$("#jointElige8Panel");
  if(!panel){
    panel=document.createElement("section");
    panel.id="jointElige8Panel";
    panel.className="joint-e8-panel";
    summary.insertAdjacentElement("afterend",panel);
  }

  const scoreHtml=score.considered
    ? `<div class="joint-e8-live-score"><span class="ok">✓ ${score.correct}</span><span class="bad">✕ ${score.wrong}</span></div>`
    : `<strong class="joint-e8-count">${score.selected}/8</strong>`;
  const statusParts=[];
  if(score.considered)statusParts.push(`${score.considered}/${score.selected||8} valorados`);
  if(score.live)statusParts.push(`${score.live} en directo`);
  if(score.pending)statusParts.push(`${score.pending} pendientes`);
  const statusText=statusParts.length?statusParts.join(" · ")+(score.live?" · provisional":""):(score.selected===8?"Listo para la conjunta":"Selecciona 8 partidos del 1 al 14");

  panel.innerHTML=`
    <div class="joint-e8-head">
      <div><span>ELIGE 8 CONJUNTO</span><h3>El Elige 8 de vuestra apuesta</h3></div>
      ${scoreHtml}
    </div>
    <p class="joint-e8-status">${statusText}</p>
    <div class="joint-e8-actions">
      <button type="button" data-joint-e8-copy="1" ${locked||jointElige8Saving?"disabled":""}>Copiar ${escapeHtml(p1?.display_name||"J1")}</button>
      <button type="button" data-joint-e8-copy="2" ${locked||jointElige8Saving?"disabled":""}>Copiar ${escapeHtml(p2?.display_name||"J2")}</button>
      <button type="button" data-joint-e8-auto ${locked||jointElige8Saving?"disabled":""}>Priorizar coincidencias</button>
      <button type="button" class="subtle" data-joint-e8-clear ${locked||jointElige8Saving||!score.selected?"disabled":""}>Vaciar</button>
    </div>
    <small>Compartido por los dos. Puedes retocarlo partido a partido con la estrella ★.</small>`;

  panel.querySelector('[data-joint-e8-copy="1"]')?.addEventListener("click",()=>copyJointElige8From(p1?.user_id,p1?.display_name||"J1"));
  panel.querySelector('[data-joint-e8-copy="2"]')?.addEventListener("click",()=>copyJointElige8From(p2?.user_id,p2?.display_name||"J2"));
  panel.querySelector("[data-joint-e8-auto]")?.addEventListener("click",autoJointElige8);
  panel.querySelector("[data-joint-e8-clear]")?.addEventListener("click",()=>saveJointElige8Set([],"Elige 8 conjunto vaciado"));

  const cards=[...list.querySelectorAll(".joint-builder-card:not(.p15-joint)")];
  cards.forEach(card=>{
    const n=Number(card.querySelector(".match-index")?.textContent);
    if(!Number.isInteger(n)||n<1||n>14)return;
    const selected=isJointElige8(n);
    const projected=matches.find(m=>m.number===n);
    const actual=projectedResultForMatch(projected);
    const jointSel=effectiveJointSelection(n);

    card.classList.toggle("joint-e8-active",selected);
    card.classList.remove("joint-e8-correct","joint-e8-wrong");
    if(selected&&actual!=="—"&&jointSel){
      card.classList.add(jointSel.includes(actual)?"joint-e8-correct":"joint-e8-wrong");
    }

    const head=card.querySelector(".joint-builder-head");
    const mode=head?.querySelector(".joint-mode");
    if(head&&mode){
      const tools=document.createElement("div");
      tools.className="joint-builder-tools";
      mode.replaceWith(tools);
      tools.appendChild(mode);
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="joint-e8-toggle"+(selected?" selected":"");
      btn.disabled=locked||jointElige8Saving||(score.selected>=8&&!selected);
      btn.innerHTML=selected?"<span>★</span> E8 conjunto":"<span>☆</span> E8";
      btn.addEventListener("click",()=>toggleJointElige8(n));
      tools.appendChild(btn);
    }

    const source=card.querySelectorAll(".joint-source > span");
    if(p1&&source[0]&&isElige8(p1.user_id,n))source[0].insertAdjacentHTML("beforeend",'<i class="joint-personal-e8">★ E8</i>');
    if(p2&&source[1]&&isElige8(p2.user_id,n))source[1].insertAdjacentHTML("beforeend",'<i class="joint-personal-e8">★ E8</i>');
  });
}

const __renderJointElige8Base=renderJoint;

renderJoint=function(){__renderJointElige8Base();decorateJointElige8UI();};

function statsForUser(uid,completed){
  const scores=completed.map(j=>({j,score:scoreUserJourney(uid,j)})),total=scores.reduce((a,x)=>a+x.score.correct,0),avg=completed.length?total/completed.length:0,best=scores.length?Math.max(...scores.map(x=>x.score.correct)):0;
  const e8=completed.map(j=>scoreElige8(uid,j)).reduce((a,x)=>({correct:a.correct+x.correct,resolved:a.resolved+x.resolved}),{correct:0,resolved:0});
  return {total,avg,best,e8,scores};
}
function renderStats(){
  const el=$("#statsContent");if(!el)return;
  const completed=journeys.filter(j=>journeyResolvedCount(j)===15).sort((a,b)=>a.number-b.number),p1=memberBySlot(1),p2=memberBySlot(2);
  if(!completed.length||!p1||!p2){el.innerHTML=`<div class="stats-empty">Las estadísticas completas aparecerán cuando haya jornadas con 15/15 resultados.</div>`;return}
  const a=statsForUser(p1.user_id,completed),b=statsForUser(p2.user_id,completed);let wins1=0,wins2=0,ties=0;
  for(const j of completed){const s1=scoreUserJourney(p1.user_id,j).correct,s2=scoreUserJourney(p2.user_id,j).correct;if(s1>s2)wins1++;else if(s2>s1)wins2++;else ties++}
  el.innerHTML=`<section class="h2h-card"><span>CARA A CARA</span><div class="h2h-score"><div><strong>${wins1}</strong><small>${escapeHtml(p1.display_name)}</small></div><b>–</b><div><strong>${wins2}</strong><small>${escapeHtml(p2.display_name)}</small></div></div><p>${ties} empate${ties===1?"":"s"} · ${completed.length} jornadas finalizadas</p></section>
    <div class="stats-player-grid">${[[p1,a],[p2,b]].map(([p,s])=>`<article class="stats-player-card"><h3>${escapeHtml(p.display_name)}</h3><div class="stats-kpis"><div><span>Aciertos</span><strong>${s.total}</strong></div><div><span>Media</span><strong>${s.avg.toFixed(1)}</strong></div><div><span>Mejor</span><strong>${s.best}/15</strong></div><div><span>Elige 8</span><strong>${s.e8.correct}/${s.e8.resolved}</strong></div></div></article>`).join("")}</div>
    <section class="evolution-card"><div class="stats-section-head"><div><span>EVOLUCIÓN</span><h3>Jornada a jornada</h3></div></div><div class="evolution-list">${completed.map(j=>{const s1=scoreUserJourney(p1.user_id,j).correct,s2=scoreUserJourney(p2.user_id,j).correct;return `<div class="evolution-row"><span class="evolution-j">J${j.number}</span><div class="evolution-bars"><div><span>${escapeHtml(p1.display_name)}</span><i style="width:${s1/15*100}%"></i><b>${s1}</b></div><div><span>${escapeHtml(p2.display_name)}</span><i style="width:${s2/15*100}%"></i><b>${s2}</b></div></div></div>`}).join("")}</div></section>`;
}
function openMatchDetail(n,jid=journey?.id){
  const j=journeys.find(x=>x.id===jid),m=allMatches.find(x=>x.journey_id===jid&&x.number===n);if(!j||!m)return;
  const p1=memberBySlot(1),p2=memberBySlot(2),a=p1?displayPickForJourney(p1.user_id,jid,n):"—",b=p2?displayPickForJourney(p2.user_id,jid,n):"—",actual=actualResultForMatch(m),resolved=matchResolved(m);
  $("#matchDetailTitle").textContent=`J${j.number} · Partido ${n}`;
  $("#matchDetailContent").innerHTML=`<div class="match-detail-fixture"><div>${teamCrestHtml(m.home,"",m.home_logo_url)}<strong>${escapeHtml(m.home)}</strong>${teamPositionHtml(m.home_position)}</div><div class="match-detail-score">${resolved?`<small>FINAL</small><strong>${m.home_score}–${m.away_score}</strong>`:"<strong>VS</strong>"}</div><div>${teamCrestHtml(m.away,"",m.away_logo_url)}<strong>${escapeHtml(m.away)}</strong>${teamPositionHtml(m.away_position)}</div></div><div class="match-detail-meta"><span>◷ ${escapeHtml(formatKickoff(m.kickoff))}</span>${resolved&&n<=14?`<span>Signo oficial: <b>${escapeHtml(actual)}</b></span>`:""}</div><div class="match-detail-picks"><div><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${a}</strong><small>${resolved&&a!=="—"?(a===actual?"✓ Acierto":"✕ Fallo"):""}${n<=14&&p1&&isElige8(p1.user_id,n,jid)?" · ★ E8":""}</small></div><div><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span><strong>${b}</strong><small>${resolved&&b!=="—"?(b===actual?"✓ Acierto":"✕ Fallo"):""}${n<=14&&p2&&isElige8(p2.user_id,n,jid)?" · ★ E8":""}</small></div></div>${resolved?"":tvBroadcastHtml(m)}`;
  $("#matchDetailDialog").showModal();
}
function activateView(view){
  const allowed=["play","joint","compare","stats","history"],next=allowed.includes(view)?view:"play";
  $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===next));$$(".view").forEach(v=>v.classList.toggle("active",v.id===next+"View"));
  if(next==="joint")renderJoint();if(next==="compare")renderCompare();if(next==="stats")renderStats();if(next==="history")renderHistory();
}
function roomSummaryText(){
  const ordered=[...members].sort((a,b)=>a.slot-b.slot).map(m=>m.display_name).filter(Boolean);
  return ordered.length?ordered.join(" ↔ "):"Vosotros dos";
}
function openRoomDialog(){
  $("#roomDialogMembers").textContent=roomSummaryText();$("#roomCode").textContent=roomCode;$("#roomDialog").showModal();
}
function setupInstallPrompt(){
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn")?.classList.remove("hidden")});
  window.addEventListener("appinstalled",()=>{installPrompt=null;$("#installBtn")?.classList.add("hidden");toast("Nuestra Quiniela instalada")});
}
async function installApp(){
  if(!installPrompt){toast("Puedes añadirla a la pantalla de inicio desde el menú del navegador");return}
  installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn")?.classList.add("hidden");
}

function nameFor(uid, fallback){
  return members.find(m=>m.user_id===uid)?.display_name || fallback;
}
function memberBySlot(slot){ return members.find(m=>m.slot===slot); }
function myPickFor(n){ return picks.find(p=>p.user_id===user.id && p.match_number===n); }
function pickFor(uid,n){ return picks.find(p=>p.user_id===uid && p.match_number===n); }

function isElige8(uid,n,journeyId=journey?.id){
  return Boolean(allElige8.find(e=>e.user_id===uid&&e.journey_id===journeyId&&e.match_number===n));
}
function elige8Count(uid,journeyId=journey?.id){
  if(!uid || !journeyId) return 0;
  return allElige8.filter(e=>e.user_id===uid&&e.journey_id===journeyId).length;
}

function completedCountForUser(uid,journeyId=journey?.id){
  if(!uid || !journeyId) return 0;
  let total=0;
  for(let n=1;n<=14;n++){
    const p=allPicks.find(x=>x.user_id===uid&&x.journey_id===journeyId&&x.match_number===n);
    if(p?.pick) total++;
  }
  const p15=allPicks.find(x=>x.user_id===uid&&x.journey_id===journeyId&&x.match_number===15);
  if(p15?.home_goals && p15?.away_goals) total++;
  return total;
}

function maybeCelebrateBothComplete(){
  const p1=memberBySlot(1), p2=memberBySlot(2);
  if(!p1 || !p2 || !journey) return;
  const c1=completedCountForUser(p1.user_id);
  const c2=completedCountForUser(p2.user_id);
  if(c1!==15 || c2!==15) return;

  const key=`quiniela-both-complete-${roomId}-${journey.id}`;
  if(localStorage.getItem(key)) return;
  localStorage.setItem(key,"1");
  toast("✓ Los dos habéis completado la jornada");
  notifyUser("Quinielas completas",`Los dos habéis terminado la Jornada ${journey.number}.`);
}

async function init(){
  if(!configured){ show("setupMissing"); return; }
  try{
    sb=createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });

    let {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError) throw sessionError;

    if(session){
      const expiresAt=Number(session.expires_at||0)*1000;
      if(!expiresAt || expiresAt<=Date.now()+60000){
        const {data:refreshed,error:refreshError}=await sb.auth.refreshSession();
        if(refreshError) throw refreshError;
        session=refreshed.session;
      }
    }else{
      const {data,error}=await sb.auth.signInAnonymously();
      if(error) throw error;
      session=data.session;
    }

    if(!session?.user) throw new Error("No se pudo recuperar la sesión.");
    user=session.user;

    const params=new URLSearchParams(location.search);
    const claimToken=params.get("claim");
    if(claimToken){
      const {error:claimError}=await sb.rpc("claim_identity",{p_token:claimToken});
      if(claimError) throw claimError;
      params.delete("claim");
      const qs=params.toString();
      history.replaceState({}, "", location.pathname+(qs?"?"+qs:""));
      toast("Identidad recuperada");
    }

    const roomInput=$("#roomCodeInput");
    if(roomInput) roomInput.value=UNIQUE_ROOM_CODE;

    const {data:mine,error}=await sb.from("members")
      .select("room_id,user_id,slot,display_name")
      .eq("user_id",user.id).limit(1).maybeSingle();
    if(error) throw error;

    if(!mine){ show("onboarding"); return; }

    myMember=mine; roomId=mine.room_id;
    const {data:r,error:re}=await sb.from("rooms").select("code").eq("id",roomId).single();
    if(re) throw re;
    roomCode=r.code;
    await enterApp();
  }catch(err){
    console.error(err);
    show("setupMissing");
    $(".setup-card p").innerHTML=`No se pudo iniciar la aplicación.<br><br><small>${escapeHtml(err.message||String(err))}</small>`;
  }
}

async function createRoom(){
  const name=$("#displayName").value.trim();
  if(!name){ $("#onboardingError").textContent="Escribe tu nombre."; return; }
  $("#onboardingError").textContent="";
  $("#createRoomBtn").disabled=true;
  try{
    for(let i=0;i<4;i++){
      const code=randomCode();
      const {data,error}=await sb.rpc("create_room",{p_code:code,p_display_name:name});
      if(!error){
        roomId=data; roomCode=code;
        const {data:m}=await sb.from("members").select("*").eq("room_id",roomId).eq("user_id",user.id).single();
        myMember=m;
        await enterApp();
        return;
      }
      if(!String(error.message).toLowerCase().includes("duplicate")) throw error;
    }
    throw new Error("No se pudo generar un código libre.");
  }catch(e){
    $("#onboardingError").textContent=e.message;
  }finally{$("#createRoomBtn").disabled=false}
}

async function joinRoom(){
  const name=$("#displayName").value.trim();
  const code=UNIQUE_ROOM_CODE;
  if(!name){ $("#onboardingError").textContent="Escribe tu nombre."; return; }
  $("#onboardingError").textContent="";
  $("#joinRoomBtn").disabled=true;
  try{
    const {data,error}=await sb.rpc("join_room",{p_code:code,p_display_name:name});
    if(error) throw error;
    roomId=data; roomCode=code;
    const {data:m,error:me}=await sb.from("members").select("*").eq("room_id",roomId).eq("user_id",user.id).single();
    if(me) throw me;
    myMember=m;
    await enterApp();
  }catch(e){
    $("#onboardingError").textContent=String(e.message||e).includes("dos jugadores") ? "Este dispositivo no está vinculado a Salva o Ferran. Usa tu enlace de recuperación." : String(e.message||e).replace("P0001: ","");
  }finally{$("#joinRoomBtn").disabled=false}
}

async function enterApp(){
  show("app");
  $("#myName").textContent=myMember.display_name;
  setSync("","Cargando");
  await Promise.all([loadAllJourneys(),loadMembers()]);
  await Promise.all([loadAllPicks(),loadAllElige8(),loadAllJointPicks(),loadAllJointElige8()]);
  await loadNotices();
  selectActiveJourney();
  renderAll();
  subscribeRealtime();
  refreshPushSubscription();
  startCountdownTimer();
  activateView(requestedView);
  setSync("online","Sincronizado");
}

async function loadAllJourneys(){
  const {data:js,error}=await sb.from("journeys").select("*").order("number",{ascending:false});
  if(error) throw error;
  journeys=js||[];
  if(!journeys.length) throw new Error("No hay jornadas cargadas.");

  const ids=journeys.map(j=>j.id);
  const {data:ms,error:me}=await sb.from("matches").select("*").in("journey_id",ids).order("number");
  if(me) throw me;
  allMatches=ms||[];
}

function selectActiveJourney(){
  const unfinished=journeys.filter(j=>journeyDisplayState(j)!=="finished");
  const preferred=unfinished.find(j=>j.id===selectedJourneyId);
  const playing=unfinished.find(j=>journeyDisplayState(j)==="playing");
  const open=unfinished.find(j=>journeyDisplayState(j)==="open");
  journey=preferred||playing||open||unfinished[0]||journeys[0];
  selectedJourneyId=journey.id;
  matches=matchesForJourney(journey.id);
  picks=allPicks.filter(p=>p.journey_id===journey.id);
}

async function loadMembers(){
  const {data,error}=await sb.from("members").select("room_id,user_id,slot,display_name").eq("room_id",roomId).order("slot");
  if(error) throw error;
  members=data||[];
  myMember=members.find(m=>m.user_id===user.id)||myMember;
}

async function loadAllPicks(){
  const {data,error}=await sb.from("picks").select("*").eq("room_id",roomId);
  if(error) throw error;
  allPicks=data||[];
  if(journey) picks=allPicks.filter(p=>p.journey_id===journey.id);
}

async function loadAllElige8(){
  const {data,error}=await sb.from("elige8_selections").select("*").eq("room_id",roomId);
  if(error) throw error;
  allElige8=data||[];
}
async function loadAllJointPicks(){
  const {data,error}=await sb.from("joint_picks").select("*").eq("room_id",roomId);
  if(error) throw error;
  allJointPicks=data||[];
}
function loadAllJointElige8(){
  return (async()=>{
    const {data,error}=await sb.from("joint_elige8_selections").select("*").eq("room_id",roomId);
    if(error) throw error;
    allJointElige8=data||[];
  })();
}

async function refreshData(){
  await Promise.all([loadAllJourneys(),loadMembers(),loadAllPicks(),loadAllElige8(),loadAllJointPicks(),loadAllJointElige8()]);
  selectActiveJourney();
  renderAll();
}

function renderAll(){
  const roomMembers=$("#roomMembers");if(roomMembers)roomMembers.textContent=roomSummaryText();
  if($("#roomDialogMembers"))$("#roomDialogMembers").textContent=roomSummaryText();
  if($("#roomCode"))$("#roomCode").textContent=roomCode;
  $("#myName").textContent=myMember?.display_name||"Tú";
  $("#journeyNumber").textContent=`Jornada ${journey.number}`;$("#journeyDate").textContent=formatDate(journey.draw_date);
  const state=journeyDisplayState(journey),resolved=journeyResolvedCount(journey);
  const statusLabels={open:"Abierta para pronósticos",playing:`En juego · ${resolved}/15 resultados`,closed:"Cerrada · esperando partidos",finished:"Finalizada · 15/15 resultados"};
  $(".status-text").textContent=statusLabels[state]||"Jornada";
  const kicker=$(".journey-kicker");if(kicker)kicker.textContent=state==="playing"?"SEGUIMIENTO DE RESULTADOS":state==="open"?"PRÓXIMA JORNADA":state==="finished"?"JORNADA FINALIZADA":"JORNADA CERRADA";
  const journeyCard=$("#journeyCard");if(journeyCard)journeyCard.dataset.status=state;
  const opponent=members.find(m=>m.user_id!==user.id);
  if(opponent){const completed=completedCountForUser(opponent.user_id);$("#opponentStatus").textContent=completed===15?`✓ ${opponent.display_name} ha completado la jornada`:`${opponent.display_name}: ${completed}/15 completados`}
  else $("#opponentStatus").textContent="Esperando al segundo jugador";
  renderJourneySwitcher();renderJourneyDashboard();renderMatches();renderPleno();renderProgress();renderElige8Progress();renderJoint();renderCompare();renderStats();renderHistory();renderNotificationBadge();maybeCelebrateBothComplete();updateCountdowns();
}

function renderMatches(){
  const normal=matches.filter(m=>m.number<=14),locked=!journeyCanEdit(journey),myE8Count=elige8Count(user.id),opponent=members.find(m=>m.user_id!==user.id);
  $("#matches").innerHTML=normal.map(m=>{
    const mp=myPickFor(m.number),e8=isElige8(user.id,m.number),e8Disabled=locked||elige8Saving||(myE8Count>=8&&!e8),resultHtml=resultBarHtml(m,mp),outcome=matchOutcomeForUser(m),oppPick=opponent?pickFor(opponent.user_id,m.number):null,reveal=Boolean(mp?.pick);
    const myLabel=escapeHtml(myMember?.display_name||"Tú"),opponentLabel=escapeHtml(opponent?.display_name||"Compañero"),myInitial=escapeHtml((myMember?.display_name||"T").trim().charAt(0).toUpperCase()||"T"),opponentInitial=escapeHtml((opponent?.display_name||"C").trim().charAt(0).toUpperCase()||"C");
    return `<article class="match-card ${e8?"e8-active":""} ${matchResolved(m)?"has-result":"pre-match"} ${mp?.pick?"has-pick":"no-pick"}" data-resolved="${matchResolved(m)}" data-outcome="${outcome}" data-e8="${e8}">
      <div class="match-card-head"><div class="match-number-wrap"><span class="match-index">${String(m.number).padStart(2,"0")}</span><span class="match-label">PARTIDO</span></div><div class="match-head-actions"><div class="kickoff-stack"><span class="kickoff ${m.kickoff?"":"pending-time"}">◷ ${escapeHtml(formatKickoff(m.kickoff))}</span>${!matchResolved(m)&&m.kickoff?`<small class="match-countdown" data-countdown="${escapeHtml(m.kickoff)}">${escapeHtml(countdownText(m.kickoff))}</small>`:""}</div>${matchResolved(m)?`<button class="detail-btn" data-detail-match="${m.number}" type="button">Detalles</button>`:""}<button class="e8-toggle ${e8?"selected":""}" data-e8-match="${m.number}" ${e8Disabled?"disabled":""} type="button"><span>★</span> ${e8?"E8":"Elige 8"}</button></div></div>
      <div class="fixture-teams"><div class="fixture-team home-team">${teamCrestHtml(m.home,"",m.home_logo_url)}<div><small class="team-meta">LOCAL ${teamPositionHtml(m.home_position)}</small><strong>${escapeHtml(m.home)}</strong></div></div>${matchResolved(m)?`<span class="fixture-score" aria-label="Resultado final ${m.home_score} a ${m.away_score}"><small>FINAL</small><strong>${m.home_score}<b>–</b>${m.away_score}</strong></span>`:`<span class="fixture-vs" aria-hidden="true">VS</span>`}<div class="fixture-team away-team">${teamCrestHtml(m.away,"",m.away_logo_url)}<div><small class="team-meta">VISITANTE ${teamPositionHtml(m.away_position)}</small><strong>${escapeHtml(m.away)}</strong></div></div></div>
      ${matchResolved(m)?"":tvBroadcastHtml(m)}
      <div class="pick-row">${["1","X","2"].map(v=>`<button class="pick ${mp?.pick===v?"selected":""}" data-match="${m.number}" data-pick="${v}" ${locked?"disabled":""}><span>${v}</span><small>${v==="1"?"Local":v==="X"?"Empate":"Visitante"}</small></button>`).join("")}</div>${mp?.pick?`<div class="pick-owner-track" aria-label="Pronósticos de los jugadores">${["1","X","2"].map(v=>`<div class="pick-owner-cell">${mp?.pick===v?`<span class="pick-owner-chip self" title="${myLabel}" aria-label="${myLabel}">${myInitial}</span>`:""}${reveal&&oppPick?.pick===v?`<span class="pick-owner-chip opponent" title="${opponentLabel}" aria-label="${opponentLabel}">${opponentInitial}</span>`:""}</div>`).join("")}</div>`:""}
      ${mp?.pick&&journeyCanEdit(journey)?`<div class="clear-pick-row"><button class="clear-pick-btn" data-clear-match="${m.number}" type="button">Borrar selección</button></div>`:""}
      ${resultHtml}
    </article>`;
  }).join("");
  $$(".pick").forEach(b=>b.addEventListener("click",()=>saveNormalPick(Number(b.dataset.match),b.dataset.pick)));
  $$(".clear-pick-btn").forEach(b=>b.addEventListener("click",()=>deletePick(Number(b.dataset.clearMatch))));
  $$(".e8-toggle").forEach(b=>b.addEventListener("click",()=>toggleElige8(Number(b.dataset.e8Match))));
  $$(".detail-btn").forEach(b=>b.addEventListener("click",()=>openMatchDetail(Number(b.dataset.detailMatch))));
  renderMatchFilterCounts();applyMatchFilter();updateCountdowns();
}

function renderPleno(){
  const m=matches.find(x=>x.number===15);if(!m){$("#plenoCard").classList.add("hidden");return}
  $("#plenoCard").classList.remove("hidden");$("#plenoHomeName").textContent=m.home;$("#plenoAwayName").textContent=m.away;
  $("#plenoHomeLabel").innerHTML=teamInlineHtml(m.home,m.home_logo_url,m.home_position);$("#plenoAwayLabel").innerHTML=teamInlineHtml(m.away,m.away_logo_url,m.away_position);
  $("#plenoKickoff").innerHTML=`◷ ${escapeHtml(formatKickoff(m.kickoff))}${!matchResolved(m)&&m.kickoff?` <small class="inline-countdown" data-countdown="${escapeHtml(m.kickoff)}">${escapeHtml(countdownText(m.kickoff))}</small>`:""}`;$("#plenoKickoff").classList.toggle("pending-time",!m.kickoff);
  const plenoTv=$("#plenoTv");if(plenoTv)plenoTv.innerHTML=matchResolved(m)?`<button class="pleno-final-score" data-detail-match="15" type="button"><small>RESULTADO FINAL</small><strong>${m.home_score}<b>–</b>${m.away_score}</strong><em>Ver detalles</em></button>`:tvBroadcastHtml(m);
  const mp=myPickFor(15),locked=!journeyCanEdit(journey);
  $$(".goal-options").forEach(row=>{const team=row.dataset.team,selected=team==="home"?mp?.home_goals:mp?.away_goals;row.innerHTML=["0","1","2","M"].map(v=>`<button class="goal ${selected===v?"selected":""}" data-team="${team}" data-goal="${v}" ${locked?"disabled":""}>${v}</button>`).join("")});
  let plenoClear=$("#plenoClearAction");
  if(!plenoClear){
    plenoClear=document.createElement("div");
    plenoClear.id="plenoClearAction";
    $(".hint")?.after(plenoClear);
  }
  plenoClear.innerHTML=mp&&journeyCanEdit(journey)?`<div class="clear-pick-row"><button class="clear-pick-btn clear-pleno-btn" type="button">Borrar Pleno al 15</button></div>`:"";
  plenoClear.querySelector(".clear-pleno-btn")?.addEventListener("click",()=>deletePick(15));
  const opponent=members.find(x=>x.user_id!==user.id),opp=opponent?pickFor(opponent.user_id,15):null,oppEl=$("#plenoOpponent");
  if(oppEl){const reveal=Boolean(mp?.home_goals&&mp?.away_goals);oppEl.classList.toggle("hidden",!reveal);if(reveal)oppEl.innerHTML=`<span>${escapeHtml(opponent?.display_name||"Compañero")}</span><strong>${opp?.home_goals&&opp?.away_goals?`${opp.home_goals}-${opp.away_goals}`:"pendiente"}</strong>`}
  const resultEl=$("#plenoResult"),resultHtml=resultBarHtml(m,mp);resultEl.className="match-result-bar";
  if(resultHtml){const wrapper=document.createElement("div");wrapper.innerHTML=resultHtml;resultEl.className=wrapper.firstElementChild.className;resultEl.innerHTML=wrapper.firstElementChild.innerHTML}else{resultEl.classList.add("hidden");resultEl.innerHTML=""}
  $$(".goal").forEach(b=>b.addEventListener("click",()=>savePleno(b.dataset.team,b.dataset.goal)));$$("#plenoTv [data-detail-match]").forEach(b=>b.addEventListener("click",()=>openMatchDetail(15)));updateCountdowns();
}

async function toggleElige8(n){
  if(!journeyCanEdit(journey)){ toast("La jornada ya ha empezado o está cerrada"); return; }
  if(elige8Saving) return;

  const selected=isElige8(user.id,n);
  if(!selected && elige8Count(user.id)>=8){
    toast("Ya has seleccionado tus 8 partidos");
    return;
  }

  elige8Saving=true;
  setSync("","Guardando");
  renderMatches();

  try{
    if(selected){
      const {error}=await sb.from("elige8_selections")
        .delete()
        .eq("room_id",roomId)
        .eq("journey_id",journey.id)
        .eq("match_number",n)
        .eq("user_id",user.id);
      if(error) throw error;
      allElige8=allElige8.filter(e=>!(e.room_id===roomId&&e.journey_id===journey.id&&e.match_number===n&&e.user_id===user.id));
    }else{
      const row={room_id:roomId,journey_id:journey.id,match_number:n,user_id:user.id};
      const {error}=await sb.from("elige8_selections").insert(row);
      if(error) throw error;
      allElige8.push(row);
    }

    renderElige8Progress();
    renderMatches();
    renderCompare();
    setSync("online","Sincronizado");
    if(elige8Count(user.id)===8) toast("✓ Elige 8 completo");
  }catch(err){
    console.error(err);
    await loadAllElige8();
    renderElige8Progress();
    renderMatches();
    renderCompare();
    setSync("error","Error");
    toast(err?.message?.includes("8 partidos")?"Solo puedes seleccionar 8 partidos":"No se pudo guardar Elige 8");
  }finally{
    elige8Saving=false;
    renderMatches();
  }
}

async function deletePick(n){
  if(!journeyCanEdit(journey)){toast("Solo puedes borrar antes de que empiece la jornada");return}
  if(saving)return;
  const previous=myPickFor(n);
  if(!previous)return;
  saving=true;setSync("","Borrando");
  picks=picks.filter(p=>!(p.user_id===user.id&&p.match_number===n));
  allPicks=allPicks.filter(p=>!(p.user_id===user.id&&p.match_number===n&&p.journey_id===journey.id));
  renderAll();
  const {error}=await sb.from("picks")
    .delete()
    .eq("room_id",roomId)
    .eq("journey_id",journey.id)
    .eq("match_number",n)
    .eq("user_id",user.id);
  saving=false;
  if(error){
    console.error(error);
    optimisticUpsert(previous);
    renderAll();
    setSync("error","Error");
    toast("No se pudo borrar");
  }else{
    setSync("online","Sincronizado");
    toast(n===15?"Pleno al 15 borrado":"Selección borrada");
  }
}

async function saveNormalPick(n,val){
  if(!journeyCanEdit(journey)){ toast("La jornada ya ha empezado o está cerrada"); return; }
  if(saving) return; saving=true; setSync("","Guardando");
  $$(".pick,.goal").forEach(b=>b.disabled=true);
  const previous=myPickFor(n);
  const row={room_id:roomId,journey_id:journey.id,match_number:n,user_id:user.id,pick:val,home_goals:null,away_goals:null};
  optimisticUpsert(row);
  renderAll();
  const {error}=await sb.from("picks").upsert(row,{onConflict:"room_id,journey_id,match_number,user_id"});
  saving=false; $$(".pick,.goal").forEach(b=>b.disabled=false);
  if(error){ console.error(error); if(previous) optimisticUpsert(previous); else {
    picks=picks.filter(p=>!(p.user_id===user.id&&p.match_number===n));
    allPicks=allPicks.filter(p=>!(p.user_id===user.id&&p.match_number===n&&p.journey_id===journey.id));
  } renderAll(); setSync("error","Error"); toast("No se pudo guardar");}
  else {setSync("online","Sincronizado");}
}

async function savePleno(team,val){
  if(!journeyCanEdit(journey)){ toast("La jornada ya ha empezado o está cerrada"); return; }
  if(saving) return; saving=true; setSync("","Guardando");
  $$(".pick,.goal").forEach(b=>b.disabled=true);
  const previous=myPickFor(15);
  const row={
    room_id:roomId,journey_id:journey.id,match_number:15,user_id:user.id,pick:null,
    home_goals: team==="home"?val:(previous?.home_goals||null),
    away_goals: team==="away"?val:(previous?.away_goals||null)
  };
  optimisticUpsert(row); renderAll();
  const {error}=await sb.from("picks").upsert(row,{onConflict:"room_id,journey_id,match_number,user_id"});
  saving=false; $$(".pick,.goal").forEach(b=>b.disabled=false);
  if(error){console.error(error); if(previous) optimisticUpsert(previous); else {
    picks=picks.filter(p=>!(p.user_id===user.id&&p.match_number===15));
    allPicks=allPicks.filter(p=>!(p.user_id===user.id&&p.match_number===15&&p.journey_id===journey.id));
  } renderAll(); setSync("error","Error"); toast("No se pudo guardar");}
  else setSync("online","Sincronizado");
}

function optimisticUpsert(row){
  const i=picks.findIndex(p=>p.user_id===row.user_id&&p.match_number===row.match_number);
  if(i>=0) picks[i]={...picks[i],...row}; else picks.push(row);

  const ai=allPicks.findIndex(p=>p.user_id===row.user_id&&p.match_number===row.match_number&&p.journey_id===row.journey_id);
  if(ai>=0) allPicks[ai]={...allPicks[ai],...row}; else allPicks.push(row);
}

function renderProgress(){
  let total=0;
  for(let n=1;n<=14;n++) if(myPickFor(n)?.pick) total++;
  const p15=myPickFor(15); if(p15?.home_goals && p15?.away_goals) total++;
  $("#progressText").textContent=`${total} de 15 completados`;
  $("#progressBar").style.width=`${total/15*100}%`;
  const state=journeyDisplayState(journey);
  const resolved=journeyResolvedCount(journey);
  $("#saveState").textContent=state==="open"
    ? (total===15?"✓ Completa":"En la nube")
    : state==="playing"
      ? `${resolved}/15 resultados`
      : state==="finished"
        ? "✓ Finalizada"
        : "Jornada cerrada";
}

function projectedScoreElige8(uid,j){
  const selected=allElige8.filter(e=>e.user_id===uid&&e.journey_id===j.id);
  let correct=0,wrong=0,considered=0,live=0;
  for(const e of selected){
    const m=allMatches.find(x=>x.journey_id===j.id&&x.number===e.match_number);
    const actual=projectedResultForMatch(m);
    if(actual==="—") continue;
    considered++;
    if(m&&!matchResolved(m)) live++;
    const mine=pickForJourney(uid,j.id,e.match_number)?.pick;
    if(mine===actual) correct++;
    else if(mine) wrong++;
  }
  return {
    selected:selected.length,
    correct,
    wrong,
    considered,
    live,
    pending:Math.max(0,selected.length-considered)
  };
}
function renderElige8Progress(){
  const count=elige8Count(user.id);
  const el=$("#elige8Progress"),status=$("#elige8Status");
  if(!el||!journey) return;
  const projected=projectedScoreElige8(user.id,journey);

  if(projected.considered>0){
    el.innerHTML=`<span class="e8-score-ok">✓ ${projected.correct} aciertos</span><span class="e8-score-bad">✕ ${projected.wrong} fallos</span>`;
    if(status){
      const parts=[`${projected.considered}/${projected.selected||8} valorados`];
      if(projected.live)parts.push(`${projected.live} en directo`);
      if(projected.pending)parts.push(`${projected.pending} pendientes`);
      status.textContent=parts.join(" · ")+(projected.live?" · provisional":"");
    }
    return;
  }

  el.textContent=count===8?"✓ 8 / 8 seleccionados":`${count} / 8 seleccionados`;
  if(status)status.textContent=count===8?"Elige 8 completo · esperando resultados.":"Marca E8 en ocho partidos del 1 al 14.";
}

function displayPick(p,n){
  if(!p) return "—";
  if(n===15) return p.home_goals&&p.away_goals?`${p.home_goals}-${p.away_goals}`:"—";
  return p.pick||"—";
}

function renderCompare(){
  const p1=memberBySlot(1),p2=memberBySlot(2);
  let same=0,pending=0,diffNormal=0,e8Both=0,e8Only1=0,e8Only2=0;
  $("#compareBody").innerHTML=matches.map(m=>{
    const a=displayPick(p1&&pickFor(p1.user_id,m.number),m.number), b=displayPick(p2&&pickFor(p2.user_id,m.number),m.number);
    const both=a!=="—"&&b!=="—", eq=both&&a===b;
    if(eq) same++; else if(both&&m.number<=14) diffNormal++; else if(!both) pending++;
    const e1=m.number<=14&&p1?isElige8(p1.user_id,m.number):false;
    const e2=m.number<=14&&p2?isElige8(p2.user_id,m.number):false;
    const ej=m.number<=14?isJointElige8(m.number):false;
    if(e1&&e2)e8Both++;else if(e1)e8Only1++;else if(e2)e8Only2++;
    const state=!both?"is-pending":eq?"is-same":"is-different";
    const label=!both?"Pendiente":eq?"Coincidís":m.number<=14?"Diferentes":"Distintos";
    const joint=m.number<=14?(effectiveJointSelection(m.number)||"—"):(!both?"—":eq?a:`${a} · ${b}`);

    let resultLine="";
    let aMark="",bMark="",jointMark="";
    if(matchResolved(m)){
      const result=m.number===15?`${normalizedGoalScore(m.home_score)}-${normalizedGoalScore(m.away_score)}`:resultSignForMatch(m);
      resultLine=`<div class="compare-result-line">Resultado <strong>${m.home_score}-${m.away_score}</strong>${m.number<=14?` · signo <strong>${result}</strong>`:""}</div>`;
      if(a!=="—") aMark=a===result?'<em class="pick-mark ok">✓</em>':'<em class="pick-mark bad">✕</em>';
      if(b!=="—") bMark=b===result?'<em class="pick-mark ok">✓</em>':'<em class="pick-mark bad">✕</em>';
      if(m.number<=14&&joint!=="—") jointMark=joint.includes(result)?'<em class="pick-mark ok">✓</em>':'<em class="pick-mark bad">✕</em>';
    }

    return `<article class="compare-card ${state} ${ej?"compare-joint-e8":""}">
      <div class="compare-card-head"><span class="compare-number">${m.number===15?"P15":String(m.number).padStart(2,"0")}</span><div class="compare-fixture">${fixtureMiniHtml(m)}</div><span class="compare-state">${label}</span></div>
      ${matchResolved(m)?"":tvBroadcastHtml(m,true)}
      ${resultLine}
      <div class="compare-picks">
        <div class="compare-pick-box"><span>${escapeHtml(p1?.display_name||"Jugador 1")}${e1?'<b class="e8-chip">★ E8</b>':""}</span><strong>${a}${aMark}</strong></div>
        <div class="compare-pick-box"><span>${escapeHtml(p2?.display_name||"Jugador 2")}${e2?'<b class="e8-chip">★ E8</b>':""}</span><strong>${b}${bMark}</strong></div>
        <div class="compare-pick-box joint-box"><span>Conjunta${ej?'<b class="e8-chip joint-e8-chip">★ E8 conjunto</b>':""}</span><strong>${joint}${jointMark}</strong></div>
      </div>
    </article>`;
  }).join("");
  $("#coincidences").textContent=`${same} / 15`;
  $("#jointDoubles").textContent=String(diffNormal);
  $("#jointPending").textContent=String(pending);
  $("#e8BothStat").textContent=String(e8Both);
  const e8=$("#elige8CompareSummary");
  const p1e8=p1?elige8Count(p1.user_id):0;
  const p2e8=p2?elige8Count(p2.user_id):0;
  const jointE8=jointElige8Selections().length;
  if(!p2){
    $("#compareSubtitle").textContent="Comparte el código para añadir al segundo jugador";
    if(e8)e8.innerHTML=`<div class="e8-compare-head"><span>ELIGE 8</span><strong>Comparación</strong></div><div class="e8-compare-grid two"><div><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${p1e8}/8</strong></div><div class="joint"><span>Conjunto</span><strong>${jointE8}/8</strong></div></div>`;
    return;
  }
  $("#compareSubtitle").textContent=`${p1?.display_name||"Jugador 1"} ${completedCountForUser(p1?.user_id)}/15 · ${p2?.display_name||"Jugador 2"} ${completedCountForUser(p2?.user_id)}/15`;
  if(e8)e8.innerHTML=`<div class="e8-compare-head"><span>ELIGE 8</span><strong>Comparación</strong></div><div class="e8-compare-grid">
    <div><span>${escapeHtml(p1?.display_name||"J1")}</span><strong>${p1e8}/8</strong></div>
    <div><span>Coincidís</span><strong>${e8Both}</strong><small>${e8Only1+e8Only2?`${e8Only1+e8Only2} distintos`:"mismos partidos"}</small></div>
    <div><span>${escapeHtml(p2?.display_name||"J2")}</span><strong>${p2e8}/8</strong></div>
    <div class="joint"><span>Conjunto</span><strong>${jointE8}/8</strong></div>
  </div>`;
}

function pickForJourney(uid,journeyId,n){
  return allPicks.find(p=>p.user_id===uid&&p.journey_id===journeyId&&p.match_number===n);
}

function displayPickForJourney(uid,journeyId,n){
  const p=pickForJourney(uid,journeyId,n);
  if(!p) return "—";
  if(n===15) return p.home_goals&&p.away_goals?`${p.home_goals}-${p.away_goals}`:"—";
  return p.pick||"—";
}

function actualResultForMatch(m){
  if(m.number===15){
    if(m.home_score==null || m.away_score==null) return "—";
    const norm=x=>x>=3?"M":String(x);
    return `${norm(m.home_score)}-${norm(m.away_score)}`;
  }
  return m.result_sign||"—";
}

function journeyMatches(jid){
  return allMatches.filter(m=>m.journey_id===jid).sort((a,b)=>a.number-b.number);
}

function scoreUserJourney(uid,j){
  const ms=journeyMatches(j.id);
  let correct=0, resolved=0;
  for(const m of ms){
    const actual=actualResultForMatch(m);
    if(actual==="—") continue;
    resolved++;
    const mine=displayPickForJourney(uid,j.id,m.number);
    if(mine===actual) correct++;
  }
  return {correct,resolved};
}

function scoreElige8(uid,j){
  const selected=allElige8.filter(e=>e.user_id===uid&&e.journey_id===j.id);
  let correct=0, resolved=0;
  for(const e of selected){
    const m=allMatches.find(x=>x.journey_id===j.id&&x.number===e.match_number);
    if(!m?.result_sign) continue;
    resolved++;
    const mine=pickForJourney(uid,j.id,e.match_number)?.pick;
    if(mine===m.result_sign) correct++;
  }
  return {selected:selected.length,correct,resolved};
}

function renderHistory(){
  const historic=journeys.filter(j=>journeyResolvedCount(j)===15).sort((a,b)=>b.number-a.number);$("#historyCount").textContent=historic.length;
  if(!historic.length){$("#historyList").innerHTML=`<div class="history-empty">Todavía no hay jornadas con los 15 resultados oficiales. Las jornadas en juego se mantienen arriba hasta completarse.</div>`;return}
  const p1=memberBySlot(1),p2=memberBySlot(2);
  $("#historyList").innerHTML=historic.map(j=>{const s1=p1?scoreUserJourney(p1.user_id,j):{correct:0},s2=p2?scoreUserJourney(p2.user_id,j):{correct:0},e1=p1?scoreElige8(p1.user_id,j):{selected:0,correct:0,resolved:0},e2=p2?scoreElige8(p2.user_id,j):{selected:0,correct:0,resolved:0},winner=!p1||!p2?"":s1.correct>s2.correct?p1.display_name:s2.correct>s1.correct?p2.display_name:"Empate";
    return `<button class="history-card" data-history-id="${j.id}"><div class="history-card-top"><div><div class="history-card-title">Jornada ${j.number}</div><div class="history-card-date">${escapeHtml(formatDate(j.draw_date))}</div></div><span class="history-card-badge finished">${winner==="Empate"?"Empate":winner?`Gana ${escapeHtml(winner)}`:"Finalizada"}</span></div><div class="history-versus"><div><span>${escapeHtml(p1?.display_name||"J1")}</span><strong>${s1.correct}</strong></div><b>–</b><div><strong>${s2.correct}</strong><span>${escapeHtml(p2?.display_name||"J2")}</span></div></div><div class="history-card-stats"><div class="history-stat"><span>Elige 8 · ${escapeHtml(p1?.display_name||"J1")}</span><strong>${e1.selected?`${e1.correct}/${e1.resolved}`:"—"}</strong></div><div class="history-stat"><span>Elige 8 · ${escapeHtml(p2?.display_name||"J2")}</span><strong>${e2.selected?`${e2.correct}/${e2.resolved}`:"—"}</strong></div></div></button>`}).join("");
  $$(".history-card").forEach(btn=>btn.addEventListener("click",()=>openHistory(Number(btn.dataset.historyId))));
}

function openHistory(jid){
  const j=journeys.find(x=>x.id===jid);if(!j)return;const ms=journeyMatches(j.id),p1=memberBySlot(1),p2=memberBySlot(2);
  $("#historyDialogTitle").textContent=`Jornada ${j.number} · ${formatDate(j.draw_date)}`;$("#historyP1").textContent=p1?.display_name||"Jugador 1";$("#historyP2").textContent=p2?.display_name||"Jugador 2";
  const s1=p1?scoreUserJourney(p1.user_id,j):{correct:0},s2=p2?scoreUserJourney(p2.user_id,j):{correct:0};$("#historyDialogSummary").innerHTML=`<span class="summary-pill">${escapeHtml(p1?.display_name||"J1")}: ${s1.correct}/15</span><span class="summary-pill">${escapeHtml(p2?.display_name||"J2")}: ${s2.correct}/15</span>`;
  $("#historyDialogBody").innerHTML=ms.map(m=>{const a=p1?displayPickForJourney(p1.user_id,j.id,m.number):"—",b=p2?displayPickForJourney(p2.user_id,j.id,m.number):"—",r=actualResultForMatch(m),ca=r==="—"?"":a===r?"result-ok":"result-bad",cb=r==="—"?"":b===r?"result-ok":"result-bad";return `<tr class="history-match-row" data-history-jid="${j.id}" data-history-match="${m.number}"><td><span class="history-match-number">${m.number===15?"P15":m.number}</span>${fixtureMiniHtml(m)}</td><td class="${a==="—"?"missing":ca}">${a}</td><td class="${b==="—"?"missing":cb}">${b}</td><td class="${r==="—"?"result-pending":""}">${r}</td></tr>`}).join("");
  $$("#historyDialogBody .history-match-row").forEach(row=>row.addEventListener("click",()=>openMatchDetail(Number(row.dataset.historyMatch),Number(row.dataset.historyJid))));$("#historyDialog").showModal();
}

function subscribeRealtime(){
  if(channel)sb.removeChannel(channel);
  channel=sb.channel(`room-${roomId}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"picks",filter:`room_id=eq.${roomId}`},async()=>{const opponent=members.find(m=>m.user_id!==user.id),before=opponent?completedCountForUser(opponent.user_id):0;await loadAllPicks();picks=allPicks.filter(p=>p.journey_id===journey.id);const after=opponent?completedCountForUser(opponent.user_id):0;if(opponent&&before<15&&after===15)notifyUser(`${opponent.display_name} ha completado la jornada`,`Jornada ${journey.number}: ya tiene sus 15 pronósticos.`);renderAll();setSync("online","Sincronizado")})
    .on("postgres_changes",{event:"*",schema:"public",table:"elige8_selections",filter:`room_id=eq.${roomId}`},async()=>{await loadAllElige8();renderAll();setSync("online","Sincronizado")})
    .on("postgres_changes",{event:"*",schema:"public",table:"joint_picks",filter:`room_id=eq.${roomId}`},async()=>{await loadAllJointPicks();renderJoint();setSync("online","Sincronizado")})
    .on("postgres_changes",{event:"*",schema:"public",table:"joint_elige8_selections",filter:`room_id=eq.${roomId}`},async()=>{await loadAllJointElige8();renderJoint();setSync("online","Sincronizado")})
    .on("postgres_changes",{event:"*",schema:"public",table:"members",filter:`room_id=eq.${roomId}`},async()=>{const before=members.length;await loadMembers();if(before<2&&members.length===2){const other=members.find(m=>m.user_id!==user.id);if(other)notifyUser("Sala completa",`${other.display_name} ya está dentro de vuestra sala.`)}renderAll()})
    .on("postgres_changes",{event:"*",schema:"public",table:"journeys"},async()=>{const oldMax=Math.max(0,...journeys.map(j=>j.number));await loadAllJourneys();await loadAllPicks();selectActiveJourney();const newMax=Math.max(0,...journeys.map(j=>j.number));renderAll();if(newMax>oldMax){notifyUser(`Jornada ${newMax} disponible`,"Ya podéis empezar a rellenar la nueva Quiniela.");toast(`Nueva jornada: ${newMax}`)}})
    .on("postgres_changes",{event:"*",schema:"public",table:"matches"},async()=>{const before=allMatches.map(m=>({...m}));await loadAllJourneys();await loadAllPicks();selectActiveJourney();detectNewResults(before);renderAll()})
    .subscribe(status=>{if(status==="SUBSCRIBED")setSync("online","Sincronizado");else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setSync("error","Sin conexión")});
}

function openRenameDialog(){
  const input=$("#renameInput");
  input.value=myMember?.display_name||"";
  $("#renameError").textContent="";
  $("#renameDialog").showModal();
  setTimeout(()=>{ input.focus(); input.select(); },50);
}

async function saveRename(e){
  e?.preventDefault();
  const name=$("#renameInput").value.trim();
  const errorEl=$("#renameError");
  if(!name){ errorEl.textContent="Escribe un nombre."; return; }
  if(name.length>20){ errorEl.textContent="El nombre puede tener como máximo 20 caracteres."; return; }
  if(name===myMember?.display_name){ $("#renameDialog").close(); return; }

  errorEl.textContent="";
  $("#saveRenameBtn").disabled=true;
  setSync("","Guardando");
  try{
    const {data,error}=await sb.from("members")
      .update({display_name:name})
      .eq("room_id",roomId)
      .eq("user_id",user.id)
      .select("room_id,user_id,slot,display_name")
      .single();
    if(error) throw error;
    myMember=data;
    const idx=members.findIndex(m=>m.user_id===user.id);
    if(idx>=0) members[idx]={...members[idx],...data};
    else members.push(data);
    renderAll();
    $("#renameDialog").close();
    setSync("online","Sincronizado");
    toast("Nombre actualizado");
  }catch(err){
    console.error(err);
    errorEl.textContent="No se pudo cambiar el nombre.";
    setSync("error","Error");
  }finally{
    $("#saveRenameBtn").disabled=false;
  }
}

async function shareRoom(){
  const base=`${location.origin}${location.pathname}`;
  const link=`${base}?room=${encodeURIComponent(roomCode)}`;
  const text=`Únete a nuestra Quiniela. Código: ${roomCode}`;
  try{
    if(navigator.share){ await navigator.share({title:"Nuestra Quiniela",text,url:link}); }
    else { await navigator.clipboard.writeText(`${text}\n${link}`); toast("Enlace copiado"); }
  }catch(e){ if(e.name!=="AbortError") toast(`Código: ${roomCode}`); }
}

applyTheme(currentTheme(),false);
$("#themeToggle")?.addEventListener("click",toggleTheme);

$$(".tab").forEach(tab=>tab.addEventListener("click",()=>activateView(tab.dataset.view)));
$$(".match-filter").forEach(btn=>btn.addEventListener("click",()=>setMatchFilter(btn.dataset.matchFilter)));
$("#createRoomBtn")?.addEventListener("click",createRoom);
$("#joinRoomBtn").addEventListener("click",joinRoom);
$("#roomCodeInput")?.addEventListener("input",e=>e.target.value=UNIQUE_ROOM_CODE);
$("#openRoomBtn").addEventListener("click",openRoomDialog);
$("#closeRoomDialog").addEventListener("click",()=>$("#roomDialog").close());
$("#shareBtn").addEventListener("click",shareRoom);
$("#notificationBtn").addEventListener("click",openNotificationCenter);
$("#closeNotificationDialog").addEventListener("click",()=>$("#notificationDialog").close());
$("#enableNotificationsBtn").addEventListener("click",requestNotifications);
$("#closeMatchDetailDialog").addEventListener("click",()=>$("#matchDetailDialog").close());
$("#installBtn").addEventListener("click",installApp);
$("#renameBtn").addEventListener("click",openRenameDialog);
$("#closeRenameDialog").addEventListener("click",()=>$("#renameDialog").close());
$("#renameForm").addEventListener("submit",saveRename);

setupInstallPrompt();
renderNotifications();
init();


if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const hadController=Boolean(navigator.serviceWorker.controller);
    try{
      const reg=await navigator.serviceWorker.register("./sw.js");
      await reg.update();
      if(hadController){
        let reloading=false;
        navigator.serviceWorker.addEventListener("controllerchange",()=>{
          if(reloading) return;
          reloading=true;
          location.reload();
        });
      }
    }catch(err){
      console.warn("Service Worker:",err);
    }
  });
}


/* Live scores from SofaScore. Official scoring remains SELAE. */
function hasLiveMatch(m){
  return !matchResolved(m)
    && m && m.live_home_score!=null
    && m.live_away_score!=null
    && (m.live_status==="inprogress" || m.live_status==="finished");
}
function liveMatchLabel(m){
  if(!m) return "";
  if(m.live_status==="inprogress") return m.live_status_text || "En directo";
  if(m.live_status==="finished") return "Final · pendiente SELAE";
  return m.live_status_text || "";
}
function livePickVerdict(m,uid){
  if(!hasLiveMatch(m) || !uid) return "missing";
  var p=pickFor(uid,m.number);
  if(m.number<=14){
    if(!p || !p.pick) return "missing";
    var sign=m.live_home_score>m.live_away_score?"1":m.live_home_score<m.live_away_score?"2":"X";
    return p.pick===sign?"correct":"wrong";
  }
  if(!p || !p.home_goals || !p.away_goals) return "missing";
  var home=normalizedGoalScore(m.live_home_score);
  var away=normalizedGoalScore(m.live_away_score);
  return p.home_goals===home && p.away_goals===away?"correct":"wrong";
}
function livePickSummary(m){
  if(!hasLiveMatch(m)) return {state:"neutral",label:"Sin pronóstico"};
  var players=[memberBySlot(1),memberBySlot(2)].filter(Boolean);
  if(!players.length) return {state:"neutral",label:"Sin pronóstico"};
  var rows=players.map(function(member){return {member:member,verdict:livePickVerdict(m,member.user_id)};});
  var correct=rows.filter(function(x){return x.verdict==="correct";});
  var wrong=rows.filter(function(x){return x.verdict==="wrong";});
  var missing=rows.filter(function(x){return x.verdict==="missing";});
  if(correct.length===players.length){
    return {state:"both",label:players.length>1?"✓ Los dos vais acertando":"✓ "+correct[0].member.display_name+" va acertando"};
  }
  if(correct.length){
    var names=correct.map(function(x){return x.member.display_name;}).join(" y ");
    var suffix=missing.length?" · falta pronóstico del otro":"";
    return {state:"one",label:"✓ "+names+" va acertando"+suffix};
  }
  if(wrong.length){
    return {state:"none",label:missing.length?"Ahora mismo ninguno de los pronósticos hechos acierta":"Ahora mismo ninguno acierta"};
  }
  return {state:"neutral",label:"Sin pronóstico"};
}
function livePickState(m){return livePickSummary(m).state;}
function livePickLabel(m){return livePickSummary(m).label;}
function buildLiveScoreNode(m){
  var score=document.createElement("span");
  var pickState=livePickState(m);
  score.className="fixture-score live-fixture-score "+(m.live_status==="inprogress"?"is-live":"is-provisional")+" live-pick-"+pickState;
  var small=document.createElement("small");
  if(m.live_status==="inprogress"){
    var dot=document.createElement("i");
    dot.className="live-dot";
    small.appendChild(dot);
  }
  small.appendChild(document.createTextNode(liveMatchLabel(m)));
  var strong=document.createElement("strong");
  strong.appendChild(document.createTextNode(String(m.live_home_score)));
  var sep=document.createElement("b");
  sep.textContent="–";
  strong.appendChild(sep);
  strong.appendChild(document.createTextNode(String(m.live_away_score)));
  score.appendChild(small);
  score.appendChild(strong);
  return score;
}
function decorateLiveMatchCards(){
  var normal=matches.filter(function(m){return m.number<=14;});
  var cards=$$(".match-card");
  normal.forEach(function(m,i){
    if(!hasLiveMatch(m) || !cards[i]) return;
    var card=cards[i];
    var pickState=livePickState(m);
    card.classList.add("has-live-result");
    card.classList.remove("live-pick-correct","live-pick-wrong","live-pick-both","live-pick-one","live-pick-none","live-pick-neutral");
    card.classList.add("live-pick-"+pickState);
    var vs=card.querySelector(".fixture-vs");
    if(vs) vs.replaceWith(buildLiveScoreNode(m));
    var bar=card.querySelector(".match-result-bar");
    if(!bar){
      bar=document.createElement("div");
      card.appendChild(bar);
    }
    bar.className="match-result-bar live-result "+(m.live_status==="inprogress"?"is-live":"is-provisional");
    bar.innerHTML="";
    var left=document.createElement("span");
    if(m.live_status==="inprogress"){
      var dot=document.createElement("i");
      dot.className="live-dot";
      left.appendChild(dot);
    }
    left.appendChild(document.createTextNode(liveMatchLabel(m)));
    var right=document.createElement("span");
    right.className="result-outcome";
    var strong=document.createElement("strong");
    strong.textContent=String(m.live_home_score)+"–"+String(m.live_away_score);
    right.appendChild(strong);
    right.appendChild(document.createTextNode(" · SofaScore"));
    var pickBadge=document.createElement("span");
    pickBadge.className="live-pick-badge "+pickState;
    pickBadge.textContent=livePickLabel(m);
    bar.appendChild(left);
    bar.appendChild(right);
    bar.appendChild(pickBadge);
  });
}
function decorateLivePleno(){
  var m=matches.find(function(x){return x.number===15;});
  if(!hasLiveMatch(m)) return;
  var el=$("#plenoTv");
  if(!el) return;
  el.innerHTML="";
  var box=document.createElement("div");
  var pickState=livePickState(m);
  box.className="pleno-live-score "+(m.live_status==="inprogress"?"is-live":"is-provisional")+" live-pick-"+pickState;
  var small=document.createElement("small");
  if(m.live_status==="inprogress"){
    var dot=document.createElement("i");
    dot.className="live-dot";
    small.appendChild(dot);
  }
  small.appendChild(document.createTextNode(liveMatchLabel(m)));
  var score=document.createElement("strong");
  score.textContent=String(m.live_home_score)+" – "+String(m.live_away_score);
  var note=document.createElement("em");
  note.textContent=livePickState(m)==="neutral"?"Resultado provisional · SofaScore":livePickLabel(m)+" · SofaScore";
  box.appendChild(small);
  box.appendChild(score);
  box.appendChild(note);
  el.appendChild(box);
}
function decorateLiveCompare(){
  var cards=$$(".compare-card");
  matches.forEach(function(m,i){
    if(!hasLiveMatch(m) || !cards[i]) return;
    var card=cards[i];
    if(card.querySelector(".live-compare")) return;
    var line=document.createElement("div");
    line.className="compare-result-line live-compare";
    var label=document.createElement("span");
    if(m.live_status==="inprogress"){
      var dot=document.createElement("i");
      dot.className="live-dot";
      label.appendChild(dot);
    }
    label.appendChild(document.createTextNode(liveMatchLabel(m)));
    var score=document.createElement("strong");
    score.textContent=String(m.live_home_score)+"-"+String(m.live_away_score);
    var note=document.createElement("small");
    note.textContent="SofaScore · provisional";
    line.appendChild(label);
    line.appendChild(score);
    line.appendChild(note);
    var picks=card.querySelector(".compare-picks");
    if(picks) card.insertBefore(line,picks);
  });
}
function decorateLiveUI(){
  decorateLiveMatchCards();
  decorateLivePleno();
  decorateLiveCompare();
}
var __renderMatchesLiveBase=renderMatches;
renderMatches=function(){
  __renderMatchesLiveBase();
  decorateLiveMatchCards();
};
var __renderPlenoLiveBase=renderPleno;
renderPleno=function(){
  __renderPlenoLiveBase();
  decorateLivePleno();
};
var __renderCompareLiveBase=renderCompare;
renderCompare=function(){
  __renderCompareLiveBase();
  decorateLiveCompare();
};
var __openMatchDetailLiveBase=openMatchDetail;
openMatchDetail=function(n,jid){
  __openMatchDetailLiveBase(n,jid);
  var targetJourney=jid==null?(journey&&journey.id):jid;
  var m=allMatches.find(function(x){return x.journey_id===targetJourney && x.number===n;});
  if(!hasLiveMatch(m)) return;
  var score=$("#matchDetailContent .match-detail-score");
  if(!score) return;
  score.innerHTML="";
  var small=document.createElement("small");
  small.className=m.live_status==="inprogress"?"detail-live":"detail-provisional";
  small.textContent=(m.live_status==="inprogress"?"● ":"")+liveMatchLabel(m);
  var strong=document.createElement("strong");
  strong.textContent=String(m.live_home_score)+"–"+String(m.live_away_score);
  var note=document.createElement("em");
  note.textContent="SOFASCORE · PROVISIONAL";
  score.appendChild(small);
  score.appendChild(strong);
  score.appendChild(note);
};
