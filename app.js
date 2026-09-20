import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const cfg = window.QUINIELA_CONFIG || {};
const configured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("TU-PROYECTO") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("TU_CLAVE");

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let sb, user, roomId, roomCode, myMember, journey, matches = [], members = [], picks = [], journeys = [], allMatches = [], allPicks = [], allElige8 = [], allJointPicks = [];
let channel = null;
let saving = false;
let elige8Saving = false;
let jointSaving = false;
let selectedJourneyId = null;
let activeMatchFilter = "all";
let notices = [];
let installPrompt = null;
let countdownTimer = null;
const requestedView = new URLSearchParams(location.search).get("view") || "play";\nconst UNIQUE_ROOM_CODE = "R4LBRU";

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
function teamInlineHtml(name,logoUrl=""){
  return `<span class="team-inline">${teamCrestHtml(name,"sm",logoUrl)}<span>${escapeHtml(name)}</span></span>`;
}
function fixtureMiniHtml(m){
  return `<span class="fixture-mini"><span class="fixture-mini-team">${teamCrestHtml(m.home,"xs",m.home_logo_url)}<span>${escapeHtml(m.home)}</span></span><span class="fixture-mini-sep">–</span><span class="fixture-mini-team">${teamCrestHtml(m.away,"xs",m.away_logo_url)}<span>${escapeHtml(m.away)}</span></span></span>`;
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
  const el=$("#syncBadge"); el.className="sync-badge "+mode; el.innerHTML=`<span></span> ${text}`;
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
function renderJourneyDashboard(){
  const el=$("#journeyDashboard");
  if(!el||!journey) return;
  const p1=memberBySlot(1),p2=memberBySlot(2);
  const s1=p1?scoreUserJourney(p1.user_id,journey):{correct:0,resolved:0};
  const s2=p2?scoreUserJourney(p2.user_id,journey):{correct:0,resolved:0};
  const c1=p1?completedCountForUser(p1.user_id):0;
  const c2=p2?completedCountForUser(p2.user_id):0;
  const resolved=journeyResolvedCount(journey);
  const next=nextUnresolvedMatch(journey);
  const playing=journeyDisplayState(journey)==="playing";
  const score1=resolved?`${s1.correct} aciertos`:`${c1}/15 hechos`;
  const score2=resolved?`${s2.correct} aciertos`:`${c2}/15 hechos`;
  const nextCopy=next
    ? `<strong>${escapeHtml(next.home)} – ${escapeHtml(next.away)}</strong><small>${escapeHtml(formatKickoff(next.kickoff))}<span class="dashboard-countdown" data-countdown="${escapeHtml(next.kickoff||"")}">${escapeHtml(countdownText(next.kickoff))}</span></small>`
    : `<strong>Jornada completa</strong><small>Todos los partidos resueltos</small>`;
  el.innerHTML=`
    <div class="dashboard-title-row">
      <div><span class="dashboard-live-dot ${playing?"live":""}"></span><strong>${playing?"Seguimiento de resultados":"Resumen de jornada"}</strong></div>
      <span class="dashboard-common">${commonCorrectCount(journey)} coincidencias acertadas</span>
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-stat"><span>Resultados</span><strong>${resolved}/15</strong><small>${15-resolved} pendientes</small></div>
      <div class="dashboard-stat"><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${score1}</strong><small>${c1}/15 pronosticados</small></div>
      <div class="dashboard-stat"><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span><strong>${score2}</strong><small>${c2}/15 pronosticados</small></div>
      <div class="dashboard-stat next-match-stat"><span>Próximo partido</span>${nextCopy}</div>
    </div>`;
  updateCountdowns();
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
}
function setMatchFilter(mode){
  activeMatchFilter=mode||"all";
  applyMatchFilter();
}
function noticeStorageKey(){return roomId?`quiniela-notices-${roomId}`:"quiniela-notices"}
function loadNotices(){
  try{notices=JSON.parse(localStorage.getItem(noticeStorageKey())||"[]")}catch{notices=[]}
  renderNotificationBadge();
}
function saveNotices(){try{localStorage.setItem(noticeStorageKey(),JSON.stringify(notices.slice(0,30)))}catch{}}
function renderNotificationBadge(){
  const badge=$("#notificationBadge");if(!badge)return;
  const unread=notices.filter(n=>!n.read).length;
  badge.textContent=String(unread);badge.classList.toggle("hidden",unread===0);
}
function recordNotice(title,body){
  notices.unshift({id:Date.now()+Math.random(),title,body,at:new Date().toISOString(),read:false});
  notices=notices.slice(0,30);saveNotices();renderNotificationBadge();renderNotifications();
}
async function notifyUser(title,body){
  recordNotice(title,body);
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  try{
    if("serviceWorker" in navigator){
      const reg=await navigator.serviceWorker.ready;
      await reg.showNotification(title,{body,icon:"icon-192.svg",badge:"icon-192.svg",tag:"quiniela-"+title});
    }else new Notification(title,{body,icon:"icon-192.svg"});
  }catch(e){console.warn("Notificación:",e)}
}
function renderNotifications(){
  const list=$("#notificationList"),btn=$("#enableNotificationsBtn");
  if(btn){
    if(!("Notification" in window)){btn.textContent="Notificaciones no disponibles";btn.disabled=true}
    else if(Notification.permission==="granted"){btn.textContent="✓ Notificaciones activadas";btn.disabled=true}
    else if(Notification.permission==="denied"){btn.textContent="Notificaciones bloqueadas en el navegador";btn.disabled=true}
    else{btn.textContent="Activar notificaciones del navegador";btn.disabled=false}
  }
  if(!list)return;
  if(!notices.length){list.innerHTML=`<div class="notification-empty">Aquí aparecerán resultados, nuevas jornadas y avisos cuando el otro jugador complete su quiniela.</div>`;return}
  const fmt=new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
  list.innerHTML=notices.map(n=>`<article class="notification-item ${n.read?"":"unread"}"><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p><small>${fmt.format(new Date(n.at))}</small></article>`).join("");
}
async function requestNotifications(){
  if(!("Notification" in window))return;
  const permission=await Notification.requestPermission();
  renderNotifications();
  if(permission==="granted")toast("Notificaciones activadas");
}
function openNotificationCenter(){
  notices=notices.map(n=>({...n,read:true}));saveNotices();renderNotificationBadge();renderNotifications();$("#notificationDialog").showModal();
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
  if(journey.status!=="open"){toast("La jornada ya está cerrada");return}
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
  if(journey.status!=="open")return;
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
  const locked=journey.status!=="open",normal=matches.filter(m=>m.number<=14);
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
  $("#matchDetailContent").innerHTML=`<div class="match-detail-fixture"><div>${teamCrestHtml(m.home,"",m.home_logo_url)}<strong>${escapeHtml(m.home)}</strong></div><div class="match-detail-score">${resolved?`<small>FINAL</small><strong>${m.home_score}–${m.away_score}</strong>`:"<strong>VS</strong>"}</div><div>${teamCrestHtml(m.away,"",m.away_logo_url)}<strong>${escapeHtml(m.away)}</strong></div></div><div class="match-detail-meta"><span>◷ ${escapeHtml(formatKickoff(m.kickoff))}</span>${resolved&&n<=14?`<span>Signo oficial: <b>${escapeHtml(actual)}</b></span>`:""}</div><div class="match-detail-picks"><div><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${a}</strong><small>${resolved&&a!=="—"?(a===actual?"✓ Acierto":"✕ Fallo"):""}${n<=14&&p1&&isElige8(p1.user_id,n,jid)?" · ★ E8":""}</small></div><div><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span><strong>${b}</strong><small>${resolved&&b!=="—"?(b===actual?"✓ Acierto":"✕ Fallo"):""}${n<=14&&p2&&isElige8(p2.user_id,n,jid)?" · ★ E8":""}</small></div></div>${resolved?"":tvBroadcastHtml(m)}`;
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

    let {data:{session}}=await sb.auth.getSession();
    if(!session){
      const {data,error}=await sb.auth.signInAnonymously();
      if(error) throw error;
      session=data.session;
    }
    user=session.user;

    const urlCode=cleanCode(new URLSearchParams(location.search).get("room")||"");
    if(urlCode) $("#roomCodeInput").value=urlCode;

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
  const code=cleanCode($("#roomCodeInput").value);
  $("#roomCodeInput").value=code;
  if(!name){ $("#onboardingError").textContent="Escribe tu nombre."; return; }
  if(code.length!==6){ $("#onboardingError").textContent="El código debe tener 6 caracteres."; return; }
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
    $("#onboardingError").textContent=e.message.replace("P0001: ","");
  }finally{$("#joinRoomBtn").disabled=false}
}

async function enterApp(){
  show("app");
  $("#myName").textContent=myMember.display_name;
  setSync("","Cargando");
  await Promise.all([loadAllJourneys(),loadMembers()]);
  await Promise.all([loadAllPicks(),loadAllElige8(),loadAllJointPicks()]);
  loadNotices();
  selectActiveJourney();
  renderAll();
  subscribeRealtime();
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

async function refreshData(){
  await Promise.all([loadAllJourneys(),loadMembers(),loadAllPicks(),loadAllElige8(),loadAllJointPicks()]);
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
  const normal=matches.filter(m=>m.number<=14),locked=journey.status!=="open",myE8Count=elige8Count(user.id),opponent=members.find(m=>m.user_id!==user.id);
  $("#matches").innerHTML=normal.map(m=>{
    const mp=myPickFor(m.number),e8=isElige8(user.id,m.number),e8Disabled=locked||elige8Saving||(myE8Count>=8&&!e8),resultHtml=resultBarHtml(m,mp),outcome=matchOutcomeForUser(m),oppPick=opponent?pickFor(opponent.user_id,m.number):null,reveal=Boolean(mp?.pick);
    const opponentHtml=reveal?`<div class="opponent-pick"><span>${escapeHtml(opponent?.display_name||"Compañero")}</span><strong>${oppPick?.pick||"pendiente"}</strong></div>`:"";
    return `<article class="match-card ${e8?"e8-active":""} ${matchResolved(m)?"has-result":"pre-match"} ${mp?.pick?"has-pick":"no-pick"}" data-resolved="${matchResolved(m)}" data-outcome="${outcome}" data-e8="${e8}">
      <div class="match-card-head"><div class="match-number-wrap"><span class="match-index">${String(m.number).padStart(2,"0")}</span><span class="match-label">PARTIDO</span></div><div class="match-head-actions"><div class="kickoff-stack"><span class="kickoff ${m.kickoff?"":"pending-time"}">◷ ${escapeHtml(formatKickoff(m.kickoff))}</span>${!matchResolved(m)&&m.kickoff?`<small class="match-countdown" data-countdown="${escapeHtml(m.kickoff)}">${escapeHtml(countdownText(m.kickoff))}</small>`:""}</div>${matchResolved(m)?`<button class="detail-btn" data-detail-match="${m.number}" type="button">Detalles</button>`:""}<button class="e8-toggle ${e8?"selected":""}" data-e8-match="${m.number}" ${e8Disabled?"disabled":""} type="button"><span>★</span> ${e8?"E8":"Elige 8"}</button></div></div>
      <div class="fixture-teams"><div class="fixture-team home-team">${teamCrestHtml(m.home,"",m.home_logo_url)}<div><small>LOCAL</small><strong>${escapeHtml(m.home)}</strong></div></div>${matchResolved(m)?`<span class="fixture-score" aria-label="Resultado final ${m.home_score} a ${m.away_score}"><small>FINAL</small><strong>${m.home_score}<b>–</b>${m.away_score}</strong></span>`:`<span class="fixture-vs" aria-hidden="true">VS</span>`}<div class="fixture-team away-team">${teamCrestHtml(m.away,"",m.away_logo_url)}<div><small>VISITANTE</small><strong>${escapeHtml(m.away)}</strong></div></div></div>
      ${matchResolved(m)?"":tvBroadcastHtml(m)}
      <div class="pick-row">${["1","X","2"].map(v=>`<button class="pick ${mp?.pick===v?"selected":""}" data-match="${m.number}" data-pick="${v}" ${locked?"disabled":""}><span>${v}</span><small>${v==="1"?"Local":v==="X"?"Empate":"Visitante"}</small></button>`).join("")}</div>
      ${opponentHtml}${resultHtml}
    </article>`;
  }).join("");
  $$(".pick").forEach(b=>b.addEventListener("click",()=>saveNormalPick(Number(b.dataset.match),b.dataset.pick)));
  $$(".e8-toggle").forEach(b=>b.addEventListener("click",()=>toggleElige8(Number(b.dataset.e8Match))));
  $$(".detail-btn").forEach(b=>b.addEventListener("click",()=>openMatchDetail(Number(b.dataset.detailMatch))));
  renderMatchFilterCounts();applyMatchFilter();updateCountdowns();
}

function renderPleno(){
  const m=matches.find(x=>x.number===15);if(!m){$("#plenoCard").classList.add("hidden");return}
  $("#plenoCard").classList.remove("hidden");$("#plenoHomeName").textContent=m.home;$("#plenoAwayName").textContent=m.away;
  $("#plenoHomeLabel").innerHTML=teamInlineHtml(m.home,m.home_logo_url);$("#plenoAwayLabel").innerHTML=teamInlineHtml(m.away,m.away_logo_url);
  $("#plenoKickoff").innerHTML=`◷ ${escapeHtml(formatKickoff(m.kickoff))}${!matchResolved(m)&&m.kickoff?` <small class="inline-countdown" data-countdown="${escapeHtml(m.kickoff)}">${escapeHtml(countdownText(m.kickoff))}</small>`:""}`;$("#plenoKickoff").classList.toggle("pending-time",!m.kickoff);
  const plenoTv=$("#plenoTv");if(plenoTv)plenoTv.innerHTML=matchResolved(m)?`<button class="pleno-final-score" data-detail-match="15" type="button"><small>RESULTADO FINAL</small><strong>${m.home_score}<b>–</b>${m.away_score}</strong><em>Ver detalles</em></button>`:tvBroadcastHtml(m);
  const mp=myPickFor(15),locked=journey.status!=="open";
  $$(".goal-options").forEach(row=>{const team=row.dataset.team,selected=team==="home"?mp?.home_goals:mp?.away_goals;row.innerHTML=["0","1","2","M"].map(v=>`<button class="goal ${selected===v?"selected":""}" data-team="${team}" data-goal="${v}" ${locked?"disabled":""}>${v}</button>`).join("")});
  const opponent=members.find(x=>x.user_id!==user.id),opp=opponent?pickFor(opponent.user_id,15):null,oppEl=$("#plenoOpponent");
  if(oppEl){const reveal=Boolean(mp?.home_goals&&mp?.away_goals);oppEl.classList.toggle("hidden",!reveal);if(reveal)oppEl.innerHTML=`<span>${escapeHtml(opponent?.display_name||"Compañero")}</span><strong>${opp?.home_goals&&opp?.away_goals?`${opp.home_goals}-${opp.away_goals}`:"pendiente"}</strong>`}
  const resultEl=$("#plenoResult"),resultHtml=resultBarHtml(m,mp);resultEl.className="match-result-bar";
  if(resultHtml){const wrapper=document.createElement("div");wrapper.innerHTML=resultHtml;resultEl.className=wrapper.firstElementChild.className;resultEl.innerHTML=wrapper.firstElementChild.innerHTML}else{resultEl.classList.add("hidden");resultEl.innerHTML=""}
  $$(".goal").forEach(b=>b.addEventListener("click",()=>savePleno(b.dataset.team,b.dataset.goal)));$$("#plenoTv [data-detail-match]").forEach(b=>b.addEventListener("click",()=>openMatchDetail(15)));updateCountdowns();
}

async function toggleElige8(n){
  if(journey?.status!=="open"){ toast("La jornada ya está cerrada"); return; }
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

async function saveNormalPick(n,val){
  if(journey?.status!=="open"){ toast("La jornada ya está cerrada"); return; }
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
  if(journey?.status!=="open"){ toast("La jornada ya está cerrada"); return; }
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

function renderElige8Progress(){
  const count=elige8Count(user.id);
  const el=$("#elige8Progress");
  if(!el) return;
  el.textContent=count===8?"✓ 8 / 8 seleccionados":`${count} / 8 seleccionados`;
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
    const e1=m.number<=14&&p1?isElige8(p1.user_id,m.number):false, e2=m.number<=14&&p2?isElige8(p2.user_id,m.number):false;
    if(e1&&e2)e8Both++;else if(e1)e8Only1++;else if(e2)e8Only2++;
    const state=!both?"is-pending":eq?"is-same":"is-different";
    const label=!both?"Pendiente":eq?"Coincidís":m.number<=14?"Doble propuesto":"Distintos";
    const joint=!both?"—":eq?a:`${a} · ${b}`;

    let resultLine="";
    let aMark="",bMark="";
    if(matchResolved(m)){
      const result=m.number===15?`${normalizedGoalScore(m.home_score)}-${normalizedGoalScore(m.away_score)}`:resultSignForMatch(m);
      resultLine=`<div class="compare-result-line">Resultado <strong>${m.home_score}-${m.away_score}</strong>${m.number<=14?` · signo <strong>${result}</strong>`:""}</div>`;
      if(a!=="—") aMark=a===result?'<em class="pick-mark ok">✓</em>':'<em class="pick-mark bad">✕</em>';
      if(b!=="—") bMark=b===result?'<em class="pick-mark ok">✓</em>':'<em class="pick-mark bad">✕</em>';
    }

    return `<article class="compare-card ${state}">
      <div class="compare-card-head"><span class="compare-number">${m.number===15?"P15":String(m.number).padStart(2,"0")}</span><div class="compare-fixture">${fixtureMiniHtml(m)}</div><span class="compare-state">${label}</span></div>
      ${matchResolved(m)?"":tvBroadcastHtml(m,true)}
      ${resultLine}
      <div class="compare-picks">
        <div class="compare-pick-box"><span>${escapeHtml(p1?.display_name||"Jugador 1")}${e1?'<b class="e8-chip">★ E8</b>':""}</span><strong>${a}${aMark}</strong></div>
        <div class="compare-pick-box"><span>${escapeHtml(p2?.display_name||"Jugador 2")}${e2?'<b class="e8-chip">★ E8</b>':""}</span><strong>${b}${bMark}</strong></div>
        <div class="compare-pick-box joint-box"><span>Conjunta${e1&&e2?'<b class="e8-chip">★ E8 ambos</b>':""}</span><strong>${joint}</strong></div>
      </div>
    </article>`;
  }).join("");
  $("#coincidences").textContent=`${same} / 15`;
  $("#jointDoubles").textContent=String(diffNormal);
  $("#jointPending").textContent=String(pending);
  $("#e8BothStat").textContent=String(e8Both);
  const e8=$("#elige8CompareSummary");
  if(!p2){
    $("#compareSubtitle").textContent="Comparte el código para añadir al segundo jugador";
    if(e8)e8.textContent=`Elige 8 · ${p1?.display_name||"Jugador 1"} ${elige8Count(p1?.user_id)}/8`;
    return;
  }
  $("#compareSubtitle").textContent=`${p1?.display_name||"Jugador 1"} ${completedCountForUser(p1?.user_id)}/15 · ${p2?.display_name||"Jugador 2"} ${completedCountForUser(p2?.user_id)}/15`;
  if(e8)e8.textContent=`Elige 8 · ambos ${e8Both} · solo ${p1?.display_name||"J1"} ${e8Only1} · solo ${p2?.display_name||"J2"} ${e8Only2}`;
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
