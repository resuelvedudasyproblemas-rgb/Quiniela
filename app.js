import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const cfg = window.QUINIELA_CONFIG || {};
const configured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("TU-PROYECTO") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("TU_CLAVE");

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let sb, user, identityUserId, roomId, roomCode, myMember, journey, matches = [], members = [], picks = [], journeys = [], allMatches = [], allPicks = [], allElige8 = [], allJointPicks = [], allJointElige8 = [];
let walletBalance=0, walletTransactions=[], betConfirmations=[];
let channel = null;
let saving = false;
let elige8Saving = false;
let jointSaving = false;
let jointElige8Saving = false;
let jointPlenoDraft = {journeyId:null,home:null,away:null};
let selectedJourneyId = null;
function selectedJourneyStorageKey(){
  return identityUserId&&roomId?"quiniela-selected-journey:"+roomId+":"+identityUserId:"";
}
function loadSavedJourneyId(){
  const key=selectedJourneyStorageKey();
  if(!key)return null;
  const value=Number(localStorage.getItem(key));
  return Number.isFinite(value)&&value>0?value:null;
}
function saveSelectedJourneyId(id){
  const key=selectedJourneyStorageKey();
  if(!key)return;
  if(id==null)localStorage.removeItem(key);
  else localStorage.setItem(key,String(id));
}
const MATCH_FILTER_KEY="quiniela-match-filter";
const MATCH_FILTER_MODES=new Set(["all","pending","correct","wrong","e8"]);
const savedMatchFilter=localStorage.getItem(MATCH_FILTER_KEY);
let activeMatchFilter = MATCH_FILTER_MODES.has(savedMatchFilter)?savedMatchFilter:"all";
let notices = [];
let pushSubscribed = false;
let pushStateChecked = false;
let pushRegistering = false;
let pushActivationError = "";
let pushRegistrationPromise = null;
const VAPID_PUBLIC_KEY = "BFmY1Uy8yquoZDQ57fxY2awxtrfSXYh-Nj0LtK4fuWKbrTRoSH6Z9hYtfShACqyMeeWMLo1LlLx52FwZuuE3W0o";
let installPrompt = null;
let countdownTimer = null;
const QUINIELA_VIEW_KEY="quiniela-view";
const QUINIELA_VIEWS=new Set(["play","joint","compare","stats","history"]);
function savedQuinielaView(){
  const value=localStorage.getItem(QUINIELA_VIEW_KEY);
  return QUINIELA_VIEWS.has(value)?value:"play";
}
function saveQuinielaView(view){
  if(QUINIELA_VIEWS.has(view))localStorage.setItem(QUINIELA_VIEW_KEY,view);
}
const requestedViewParam=new URLSearchParams(location.search).get("view");
const requestedView=QUINIELA_VIEWS.has(requestedViewParam)?requestedViewParam:savedQuinielaView();
const UNIQUE_ROOM_CODE = "R4LBRU";

const escapeHtml = (str="") => str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const TEAM_DOMAINS={"CEUTA":"adceutafc.com","REAL SOCIEDAD":"realsociedad.eus","REAL SOCIEDAD B":"realsociedad.eus","GRANADA":"granadacf.es","ANDORRA":"fcandorra.com","CELTA":"rccelta.es","CELTA FORTUNA":"rccelta.es","SABADELL":"cesabadellfc.com","TENERIFE":"clubdeportivotenerife.es","CADIZ":"cadizcf.com","REAL VALLADOLID":"realvalladolid.es","CORDOBA":"cordobacf.com","MALLORCA":"rcdmallorca.es","ALMERIA":"udalmeriasad.com","BURGOS":"burgoscf.es","ELDENSE":"cdeldense.es","EIBAR":"sdeibar.com","LAS PALMAS":"udlaspalmas.es","REAL OVIEDO":"realoviedo.es","SPORTING":"realsporting.com","LEGANES":"cdleganes.com","CASTELLON":"cdcastellon.com","ATHLETIC CLUB":"athletic-club.eus","AT MADRID":"atleticodemadrid.com","ATLETICO MADRID":"atleticodemadrid.com","VALENCIA":"valenciacf.com","SEVILLA":"sevillafc.es","DEPORTIVO":"rcdeportivo.es","ESPANYOL":"rcdespanyol.com","REAL MADRID":"realmadrid.com","BARCELONA":"fcbarcelona.com","VILLARREAL":"villarrealcf.es","BETIS":"realbetisbalompie.es","REAL BETIS":"realbetisbalompie.es","RAYO VALLECANO":"rayovallecano.es","GETAFE":"getafecf.com","ALAVES":"deportivoalaves.com","GIRONA":"gironafc.cat","OSASUNA":"osasuna.es","LEVANTE":"levanteud.com","ELCHE":"elchecf.es","RACING":"realracingclub.es","RACING SANTANDER":"realracingclub.es","MALAGA":"malagacf.com","HUESCA":"sdhuesca.es","ZARAGOZA":"realzaragoza.com","ALBACETE":"albacetebalompie.es","MIRANDES":"cdmirandes.com"};
const TEAM_FLAGS={"ESPANA":"🇪🇸","INGLATERRA":"🏴","FRANCIA":"🇫🇷","ITALIA":"🇮🇹","ALEMANIA":"🇩🇪","PORTUGAL":"🇵🇹"};
function normalizeTeamName(name=""){const c=String(name).replace(/\s*\([MF]\)\s*$/i,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\./g,"").replace(/\s+/g," ").trim();return ({"R VALLADOLID":"REAL VALLADOLID","R OVIEDO":"REAL OVIEDO","ATLETICO DE MADRID":"ATLETICO MADRID","RC DEPORTIVO":"DEPORTIVO","UD LAS PALMAS":"LAS PALMAS","CD LEGANES":"LEGANES"})[c]||c}
function teamInitials(name=""){const p=normalizeTeamName(name).replace(/\b(CLUB|FUTBOL|FOOTBALL|CF|FC|CD|UD|SAD)\b/g,"").trim().split(/\s+/).filter(Boolean);return p.length===1?p[0].slice(0,2):(p[0][0]+p[1][0]).slice(0,2)}
function sofaLogoInfo(url=""){
  const raw=String(url||"").trim();
  if(!raw)return null;
  let m=raw.match(/(?:api|img)\.sofascore\.app\/api\/v1\/team\/(\d+)\/image/i);
  if(m)return {kind:"team",id:m[1]};
  m=raw.match(/(?:api|img)\.sofascore\.app\/api\/v1\/unique-tournament\/(\d+)\/image/i);
  if(m)return {kind:"tournament",id:m[1]};
  return null;
}
function logoStorageUrl(url=""){
  const raw=String(url||"").trim();
  const info=sofaLogoInfo(raw);
  if(!info)return raw;
  return `${cfg.SUPABASE_URL}/storage/v1/object/public/quiniela-web/logos/${info.kind}/${info.id}.webp`;
}
function logoProxyUrl(url=""){
  const raw=String(url||"").trim();
  const info=sofaLogoInfo(raw);
  if(!info)return raw;
  return `${cfg.SUPABASE_URL}/functions/v1/logo-proxy?kind=${info.kind}&id=${info.id}&v=3`;
}
function teamCrestHtml(name,size="",logoUrl=""){
  const key=normalizeTeamName(name);
  const label=escapeHtml(String(name).replace(/\s*\([MF]\)\s*$/i,""));
  const initials=escapeHtml(teamInitials(name));
  const direct=logoStorageUrl(logoUrl);
  const fallback=logoProxyUrl(logoUrl);
  if(direct){
    return `<span class="team-crest ${size}" title="${label}"><span class="crest-fallback">${initials}</span><img class="team-crest-img high-quality" src="${escapeHtml(direct)}" data-logo-fallback="${escapeHtml(fallback)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="if(this.previousElementSibling)this.previousElementSibling.style.display='none'" onerror="const f=this.dataset.logoFallback;if(f&&this.src!==f){this.src=f}else this.remove()"></span>`;
  }
  const flag=TEAM_FLAGS[key];
  if(flag) return `<span class="team-crest ${size} flag-crest" title="${label}">${flag}</span>`;
  const domain=TEAM_DOMAINS[key];
  if(!domain) return `<span class="team-crest ${size} fallback-only" title="${label}"><span class="crest-fallback">${initials}</span></span>`;
  const src=`https://www.google.com/s2/favicons?domain_url=https://${encodeURIComponent(domain)}&sz=128`;
  return `<span class="team-crest ${size}" title="${label}"><span class="crest-fallback">${initials}</span><img class="team-crest-img" src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="if(this.previousElementSibling)this.previousElementSibling.style.display='none'" onerror="this.remove()"></span>`;
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
function compareFixtureHtml(m){
  return `<div class="compare-fixture-row">
    <span class="compare-team compare-team-home">
      ${teamCrestHtml(m.home,"xs",m.home_logo_url)}
      ${teamPositionHtml(m.home_position,true)}
      <span class="compare-team-name">${escapeHtml(m.home)}</span>
    </span>
    <span class="compare-fixture-sep">–</span>
    <span class="compare-team compare-team-away">
      <span class="compare-team-name">${escapeHtml(m.away)}</span>
      ${teamPositionHtml(m.away_position,true)}
      ${teamCrestHtml(m.away,"xs",m.away_logo_url)}
    </span>
  </div>`;
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
function formatJointKickoff(v){
  if(!v)return "Pendiente";
  const parts=new Intl.DateTimeFormat("es-ES",{
    timeZone:"Europe/Madrid",
    weekday:"short",
    day:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  }).formatToParts(new Date(v));
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  return `${get("weekday").replace(".","")} ${get("day")} · ${get("hour")}:${get("minute")}`;
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
  if(!j)return 0;
  if(!loadedJourneyIds.has(j.id))return j.status==="finished"?15:0;
  const ms=matchesForJourney(j.id);
  return ms.filter(matchResolved).length;
}
function journeyDisplayState(j){
  if(!j)return "closed";
  const deadline=journeyDeadline(j);
  if(!loadedJourneyIds.has(j.id)){
    if(j.status==="finished")return "finished";
    if(j.status==="open"&&(!deadline||Date.now()<deadline.getTime()))return "open";
    return "closed";
  }
  const resolved=journeyResolvedCount(j);
  const total=matchesForJourney(j.id).length;
  if(total===15 && resolved===15) return "finished";
  if(j.status==="open"&&(!deadline||Date.now()<deadline.getTime())) return "open";
  const firstKickoff=matchesForJourney(j.id).map(m=>m.kickoff).filter(Boolean).sort()[0];
  if(resolved>0 || (firstKickoff && Date.now()>=new Date(firstKickoff).getTime())) return "playing";
  return "closed";
}
function journeyDeadline(j){
  if(!j) return null;
  if(j.close_at){
    const official=new Date(j.close_at);
    if(Number.isFinite(official.getTime()))return official;
  }
  const kickoffs=matchesForJourney(j.id)
    .map(m=>m.kickoff)
    .filter(Boolean)
    .map(v=>new Date(v).getTime())
    .filter(Number.isFinite);
  if(kickoffs.length) return new Date(Math.min(...kickoffs));
  const draw=new Date(j.draw_date+"T00:00:00+02:00");
  return Number.isFinite(draw.getTime())?draw:null;
}
function formatJourneyDeadline(j){
  const deadline=journeyDeadline(j);
  if(!deadline) return "Horario límite pendiente";
  const parts=new Intl.DateTimeFormat("es-ES",{
    timeZone:"Europe/Madrid",
    weekday:"short",
    day:"numeric",
    month:"short",
    hour:"2-digit",
    minute:"2-digit"
  }).format(deadline);
  return parts.replace(","," ·");
}
function madridDayKey(value){
  const d=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(d.getTime()))return "";
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}
function journeyDeadlineIsToday(j){
  const deadline=journeyDeadline(j);
  return Boolean(deadline&&madridDayKey(deadline)===madridDayKey(new Date()));
}
function formatJourneyDeadlineTime(j){
  const deadline=journeyDeadline(j);
  if(!deadline)return "—";
  return new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",hour:"2-digit",minute:"2-digit"}).format(deadline);
}
function nextUpcomingJourney(){
  const now=Date.now();
  return journeys
    .map(j=>({j,start:journeyDeadline(j)}))
    .filter(x=>x.start&&x.start.getTime()>now)
    .sort((a,b)=>a.start-b.start)[0]||null;
}
function journeyStartCountdownText(value){
  const target=value instanceof Date?value:new Date(value);
  const diff=target.getTime()-Date.now();
  if(!Number.isFinite(diff)||diff<=0)return "Ya ha empezado";
  const mins=Math.max(1,Math.floor(diff/60000));
  const days=Math.floor(mins/1440);
  const hours=Math.floor((mins%1440)/60);
  const rem=mins%60;
  const parts=[];
  if(days)parts.push(days+" d");
  if(hours||days)parts.push(hours+" h");
  parts.push(rem+" min");
  return parts.join(" ");
}
function renderNextJourneyCountdown(){
  const el=$("#nextJourneyCountdown");
  if(!el)return;
  const next=nextUpcomingJourney();
  if(!next){
    el.classList.add("hidden");
    el.innerHTML="";
    return;
  }
  el.classList.remove("hidden");
  el.innerHTML=`<small>PRÓXIMO CIERRE · J${next.j.number}</small><strong>Cierra en <b>${escapeHtml(journeyStartCountdownText(next.start))}</b></strong>`;
}
function journeyBetConfirmed(j=journey){
  return Boolean(j&&walletConfirmation("quiniela",j.id));
}
function journeyCanEdit(j){
  if(!j || j.status!=="open" || journeyBetConfirmed(j)) return false;
  const deadline=journeyDeadline(j);
  return Boolean(deadline && Date.now()<deadline.getTime());
}
function journeyEditBlockedMessage(j=journey){
  return journeyBetConfirmed(j)
    ?"Apuesta confirmada: pronósticos y conjunta bloqueados"
    :"La jornada ya ha empezado o está cerrada";
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
      const outcome=!hasPick?"Sin pronóstico":ok?"Acierto":"Fallo";
      const cls=!hasPick?"neutral":ok?"correct":"wrong";
      return `<div class="match-result-bar ${cls}"><span>Pleno oficial <strong>${actualHome}-${actualAway}</strong></span><span class="result-outcome">${outcome}</span></div>`;
    }
    const actual=resultSignForMatch(m);
    const hasPick=Boolean(p?.pick);
    const ok=hasPick && p.pick===actual;
    const outcome=!hasPick?"Sin pronóstico":ok?"Acierto":"Fallo";
    const cls=!hasPick?"neutral":ok?"correct":"wrong";
    return `<div class="match-result-bar ${cls}"><span>Signo oficial <strong>${actual}</strong></span><span class="result-outcome">${outcome}</span></div>`;
  }
  if(m?.kickoff && Date.now()>=new Date(m.kickoff).getTime() && journeyDisplayState(journey)==="playing"){
    return `<div class="match-result-bar pending"><span>Partido pendiente de resultado oficial</span></div>`;
  }
  return "";
}
function finishedJourneyPrizeState(j){
  if(!j||journeyDisplayState(j)!=="finished")return "";
  if(!loadedJourneyIds.has(j.id))return journeySummaries.get(Number(j.id))?.prize_state||"miss";
  const normal=identityUserId?scoreUserJourney(identityUserId,j):{correct:0,resolved:0};
  const e8=scoreJointElige8(j);
  const normalPrize=normal.resolved===15&&normal.correct>=10;
  const e8Prize=e8.selected===8&&e8.resolved===8&&e8.correct===8;
  return normalPrize||e8Prize?"prize":"miss";
}

function renderJourneySwitcher(){
  const el=$("#journeySwitcher");
  if(!el) return;
  if(document.documentElement.dataset.game==="quinigol"){
    el.classList.add("hidden");
    return;
  }
  const available=[...journeys].sort((a,b)=>b.number-a.number);
  if(!available.length){ el.classList.add("hidden"); el.innerHTML=""; return; }
  el.classList.remove("hidden");
  const active=available.find(j=>j.id===journey.id);
  const primary=[];
  if(active)primary.push(active);
  for(const j of available){
    if(primary.length>=3)break;
    if(!primary.some(x=>x.id===j.id))primary.push(j);
  }
  primary.sort((a,b)=>b.number-a.number);
  const archived=available.filter(j=>!primary.some(x=>x.id===j.id));

  const buttonHtml=j=>{
    const state=journeyDisplayState(j);
    const resolved=journeyResolvedCount(j);
    const prizeState=state==="finished"?finishedJourneyPrizeState(j):"";
    const prizeClass=prizeState?` finished-${prizeState}`:"";
    const detail=state==="playing"?`${resolved}/15 resultados`:state==="open"?"Pronósticos abiertos":state==="finished"?`${resolved}/15 resultados · finalizada`:"Esperando partidos";
    return `<button type="button" class="journey-choice ${j.id===journey.id?"active":""} state-${state}${prizeClass}" data-journey-id="${j.id}">
      <span>J${j.number}</span><strong>${journeyStateLabel(j)}</strong><small>${detail}</small>
    </button>`;
  };

  el.innerHTML=`<div class="journey-primary-row">${primary.map(buttonHtml).join("")}</div>${
    archived.length?`<details class="journey-more"><summary>+ ${archived.length} jornada${archived.length===1?"":"s"}</summary><div class="journey-more-grid">${archived.map(buttonHtml).join("")}</div></details>`:""
  }`;
  $$("#journeySwitcher [data-journey-id]").forEach(btn=>btn.addEventListener("click",async()=>{
    const id=Number(btn.dataset.journeyId);
    try{
      await ensureJourneyLoaded(id);
      selectedJourneyId=id;
      saveSelectedJourneyId(selectedJourneyId);
      selectActiveJourney();
      renderAll();
    }catch(e){
      console.error(e);
      setSync("error","Error");
      toast("No se pudo cargar la jornada");
    }
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
function liveFreshnessMeta(value){
  const at=value?new Date(value).getTime():NaN;
  if(!Number.isFinite(at)) return {label:"Sin hora de actualización",delayed:true};
  const seconds=Math.max(0,Math.floor((Date.now()-at)/1000));
  if(seconds>180){
    const mins=Math.max(3,Math.floor(seconds/60));
    const age=mins<60?`hace ${mins} min`:`hace ${Math.floor(mins/60)} h`;
    return {label:`Datos retrasados · ${age}`,delayed:true};
  }
  if(seconds<10) return {label:"Actualizado ahora",delayed:false};
  if(seconds<60) return {label:`Actualizado hace ${seconds} s`,delayed:false};
  const mins=Math.floor(seconds/60);
  return {label:`Actualizado hace ${mins} min`,delayed:false};
}
function updateLiveFreshness(){
  $$("[data-live-updated]").forEach(el=>{
    const info=liveFreshnessMeta(el.dataset.liveUpdated);
    el.textContent=info.label;
    el.classList.toggle("delayed",info.delayed);
    el.classList.toggle("fresh",!info.delayed);
  });
}
function updateCountdowns(){
  renderNextJourneyCountdown();
  $$("[data-countdown]").forEach(el=>{
    const value=el.dataset.countdown;
    if(value) el.textContent=countdownText(value);
  });
  updateLiveFreshness();
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
  const score1=`${s1.correct} aciertos`;
  const score2=`${s2.correct} aciertos`;
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
      <div class="dashboard-stat player-one-stat ${resolved&&prize1?"prize-zone":""}"><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${score1}</strong><small>${c1}/15 pronosticados</small></div>
      <div class="dashboard-stat player-two-stat ${resolved&&prize2?"prize-zone":""}"><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span><strong>${score2}</strong><small>${c2}/15 pronosticados</small></div>
      <div class="dashboard-stat projected-score-stat"><span>Aciertos posibles</span>${projectedCopy}</div>
    </div>`;
}
function matchOutcomeForUser(m,uid=identityUserId){
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
    e8:normal.filter(m=>isElige8(identityUserId,m.number)).length
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
      .eq("user_id",identityUserId)
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
async function ensureServiceWorkerReady(){
  let reg=await navigator.serviceWorker.getRegistration();
  if(!reg)reg=await navigator.serviceWorker.register("./sw.js");
  try{await reg.update()}catch{}
  return navigator.serviceWorker.ready;
}
function pushKeyMatches(subscription,expected){
  const current=subscription?.options?.applicationServerKey;
  if(!current)return true;
  const a=new Uint8Array(current),b=expected instanceof Uint8Array?expected:new Uint8Array(expected);
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  return true;
}
async function registerPushSubscription(){
  if(pushRegistrationPromise)return pushRegistrationPromise;
  pushRegistrationPromise=(async()=>{
    if(!pushCapable()||Notification.permission!=="granted"||!sb||!user)return false;
    pushRegistering=true;
    pushActivationError="";
    renderNotifications();
    try{
      const reg=await ensureServiceWorkerReady();
      const serverKey=urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      let subscription=await reg.pushManager.getSubscription();
      if(subscription&&!pushKeyMatches(subscription,serverKey)){
        try{await subscription.unsubscribe()}catch{}
        subscription=null;
      }
      if(!subscription){
        subscription=await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:serverKey
        });
      }
      const {data,error}=await sb.functions.invoke("push-register",{body:subscription.toJSON()});
      if(error)throw error;
      if(data?.ok===false)throw new Error(data.error||"No se pudo registrar el dispositivo");
      pushSubscribed=true;
      pushStateChecked=true;
      pushActivationError="";
      return true;
    }catch(e){
      pushSubscribed=false;
      pushStateChecked=true;
      pushActivationError=String(e?.message||e||"Error de activación");
      console.warn("Push:",e);
      throw e;
    }finally{
      pushRegistering=false;
      renderNotifications();
    }
  })();
  try{return await pushRegistrationPromise}
  finally{pushRegistrationPromise=null}
}
async function refreshPushSubscription(){
  if(!pushCapable()||Notification.permission!=="granted"){
    pushStateChecked=true;
    renderNotifications();
    return false;
  }
  try{return await registerPushSubscription()}
  catch{return false}
}
function notifyUser(title,body){
  recordNotice(title,body);
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
    }else if(Notification.permission==="granted"&&pushCapable()&&pushRegistering){
      btn.textContent="Activando push…";btn.disabled=true;
      if(status)status.textContent="Registrando este dispositivo.";
    }else if(Notification.permission==="granted"&&pushCapable()&&!pushStateChecked){
      btn.textContent="Comprobando activación…";btn.disabled=true;
      if(status)status.textContent="Estamos comprobando si este dispositivo ya está registrado.";
    }else if(Notification.permission==="granted"&&pushCapable()){
      btn.textContent=pushActivationError?"Reintentar activación push":"Completar activación push";btn.disabled=false;
      if(status)status.textContent=pushActivationError?"No se pudo completar el registro. Toca para reintentarlo.":"El permiso está concedido, falta registrar este dispositivo.";
    }else if(Notification.permission==="granted"){
      btn.textContent="✓ Avisos con la app abierta";btn.disabled=true;
      if(status)status.textContent="Este navegador no admite Web Push en este modo.";
    }else{
      btn.textContent="Activar notificaciones";btn.disabled=false;
      if(status)status.textContent=pushCapable()?"Recibirás avisos incluso con la app cerrada.":"En iPhone, instala primero la app en la pantalla de inicio para usar Web Push.";
    }
  }
  if(!list)return;
  if(!notices.length){list.innerHTML=`<div class="notification-empty">Aquí aparecerán jornadas y cierres, resultados oficiales, avisos de Salva/Ferran, premios, apuestas conjuntas y movimientos del monedero.</div>`;return}
  const fmt=new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
  list.innerHTML=notices.map(n=>`<article class="notification-item ${n.read?"":"unread"}"><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p><small>${fmt.format(new Date(n.at))}</small></article>`).join("");
}
async function requestNotifications(){
  if(!("Notification" in window))return;
  try{
    let permission=Notification.permission;
    if(permission==="default")permission=await Notification.requestPermission();
    pushStateChecked=false;
    pushActivationError="";
    if(permission==="granted"){
      if(pushCapable()){
        const ok=await registerPushSubscription();
        if(ok)toast("Notificaciones push activadas");
      }else{
        pushStateChecked=true;
        toast("Notificaciones activadas mientras la app esté abierta");
      }
    }
  }catch(e){
    console.error(e);
    pushActivationError=String(e?.message||e||"Error de activación");
    toast("No se pudieron activar las notificaciones");
  }
  renderNotifications();
}
async function openNotificationCenter(){
  if(Notification.permission==="granted"&&pushCapable()&&!pushStateChecked)await refreshPushSubscription();
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
    const mine=displayPickForJourney(identityUserId,m.journey_id,m.number),actual=actualResultForMatch(m);
    const verdict=mine==="—"?"Sin pronóstico":mine===actual?"Acertaste":"Fallaste";
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
  if(!journeyCanEdit(journey)){toast(journeyEditBlockedMessage(journey));return}
  if(jointSaving)return;
  const clean=normalizeJointSelection(selection);if(!clean){toast("Debe quedar al menos un signo");return}
  jointSaving=true;setSync("","Guardando");
  try{
    const row={room_id:roomId,journey_id:journey.id,match_number:n,selection:clean,updated_by:identityUserId,updated_at:new Date().toISOString()};
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
function jointReadonlySignsHtml(selection,playerClass){
  const value=String(selection||"");
  return `<div class="joint-readonly-signs ${playerClass}">${JOINT_SIGN_ORDER.map(sign=>`<span class="${value.includes(sign)?"selected":""}">${sign}</span>`).join("")}</div>`;
}
function splitPlenoSelection(value=""){
  const m=String(value||"").match(/^(0|1|2|M)-(0|1|2|M)$/);
  return m?{home:m[1],away:m[2]}:{home:null,away:null};
}
function plenoGoalNumber(v){
  if(v==="M")return 3;
  const n=Number(v);
  return Number.isFinite(n)?Math.max(0,Math.min(3,n)):null;
}
function plenoGoalToken(v){
  const n=Math.max(0,Math.min(3,Math.round(Number(v)||0)));
  return n>=3?"M":String(n);
}
function jointPlenoRecommendation(jid=journey?.id){
  const p1=memberBySlot(1),p2=memberBySlot(2);
  const a=p1?pickForJourney(p1.user_id,jid,15):null;
  const b=p2?pickForJourney(p2.user_id,jid,15):null;
  if(!a?.home_goals||!a?.away_goals||!b?.home_goals||!b?.away_goals)return null;

  const sa=`${a.home_goals}-${a.away_goals}`;
  const sb=`${b.home_goals}-${b.away_goals}`;
  if(sa===sb)return {selection:sa,source:"agreement",positionBias:false};

  let home=(plenoGoalNumber(a.home_goals)+plenoGoalNumber(b.home_goals))/2;
  let away=(plenoGoalNumber(a.away_goals)+plenoGoalNumber(b.away_goals))/2;
  let positionBias=false;

  const m=matchesForJourney(jid).find(x=>x.number===15);
  const hp=Number(m?.home_position),ap=Number(m?.away_position);
  if(Number.isFinite(hp)&&Number.isFinite(ap)&&hp>0&&ap>0){
    const bias=Math.max(-.18,Math.min(.18,(ap-hp)/45));
    home+=bias;
    away-=bias;
    positionBias=Math.abs(bias)>.01;
  }

  return {
    selection:`${plenoGoalToken(home)}-${plenoGoalToken(away)}`,
    source:"recommended",
    positionBias
  };
}
function autoJointPlenoSelection(jid=journey?.id){
  return jointPlenoRecommendation(jid)?.selection||"";
}
function effectiveJointPlenoSelection(jid=journey?.id){
  return jointOverrideFor(15,jid)?.selection||autoJointPlenoSelection(jid);
}
function jointPlenoKind(jid=journey?.id){
  if(jointOverrideFor(15,jid))return "Manual";
  const rec=jointPlenoRecommendation(jid);
  if(!rec)return "Elegid marcador";
  return rec.source==="agreement"?"Coincidís":"Recomendado";
}
function jointPlenoReadonlyHtml(value,playerClass=""){
  const p=splitPlenoSelection(value);
  return `<div class="joint-pleno-readonly ${playerClass}"><strong>${p.home||"—"}</strong><b>–</b><strong>${p.away||"—"}</strong></div>`;
}
function jointPlenoEditorState(jid=journey?.id){
  const base=splitPlenoSelection(effectiveJointPlenoSelection(jid));
  if(jointPlenoDraft.journeyId!==jid)return base;
  return {
    home:jointPlenoDraft.home??base.home,
    away:jointPlenoDraft.away??base.away
  };
}
function jointPlenoEditorHtml(jid=journey?.id,locked=false){
  const cur=jointPlenoEditorState(jid);
  const values=["0","1","2","M"];
  const side=(team,selected)=>`<div class="joint-pleno-goals">${values.map(v=>`<button type="button" class="joint-pleno-goal ${selected===v?"selected":""}" data-joint-pleno-team="${team}" data-joint-pleno-goal="${v}" ${locked?"disabled":""}>${v}</button>`).join("")}</div>`;
  return `<div class="joint-pleno-editor"><div><small>LOCAL</small>${side("home",cur.home)}</div><span>–</span><div><small>VISIT.</small>${side("away",cur.away)}</div></div>`;
}
async function saveJointPlenoPart(team,val){
  if(!journeyCanEdit(journey)){toast(journeyEditBlockedMessage(journey));return}
  if(jointSaving)return;
  const current=jointPlenoEditorState(journey.id);
  jointPlenoDraft={
    journeyId:journey.id,
    home:team==="home"?val:current.home,
    away:team==="away"?val:current.away
  };
  if(!jointPlenoDraft.home||!jointPlenoDraft.away){renderJoint();return}

  jointSaving=true;
  setSync("","Guardando");
  const selection=`${jointPlenoDraft.home}-${jointPlenoDraft.away}`;
  try{
    const row={room_id:roomId,journey_id:journey.id,match_number:15,selection,updated_by:identityUserId,updated_at:new Date().toISOString()};
    const {data,error}=await sb.from("joint_picks").upsert(row,{onConflict:"room_id,journey_id,match_number"}).select().single();
    if(error)throw error;
    allJointPicks=allJointPicks.filter(x=>!(x.journey_id===journey.id&&x.match_number===15));
    allJointPicks.push(data);
    jointPlenoDraft={journeyId:null,home:null,away:null};
    renderJoint();
    setSync("online","Sincronizado");
  }catch(e){
    console.error(e);
    toast("No se pudo guardar el Pleno conjunto");
    setSync("error","Error");
  }finally{
    jointSaving=false;
  }
}
async function resetJointPlenoSelection(){
  jointPlenoDraft={journeyId:null,home:null,away:null};
  await resetJointSelection(15);
}
function euro(value){
  return Number(value||0).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
}

async function loadWalletData(){
  if(!roomId)return;
  const [wr,tr,cr]=await Promise.all([
    sb.from("room_wallets").select("balance,updated_at").eq("room_id",roomId).maybeSingle(),
    sb.from("wallet_transactions").select("*").eq("room_id",roomId).order("created_at",{ascending:false}).limit(12),
    sb.from("bet_confirmations").select("*").eq("room_id",roomId)
  ]);
  if(wr.error)throw wr.error;if(tr.error)throw tr.error;if(cr.error)throw cr.error;
  walletBalance=Number(wr.data?.balance||0);
  walletTransactions=tr.data||[];
  betConfirmations=cr.data||[];
}
function walletCanManage(){return Number(myMember?.slot)===1}
function walletConfirmation(game="quiniela",jid=journey?.id){
  return betConfirmations.find(x=>x.game===game&&Number(x.journey_id)===Number(jid))||null;
}
function walletMovementLabel(t){
  const labels={opening:"Saldo inicial",funds:"Fondos añadidos",prize:"Premio añadido",bet:"Apuesta confirmada",bet_adjustment:"Ajuste de apuesta",refund:"Apuesta anulada"};
  return t?.note||labels[t?.kind]||"Movimiento";
}
function walletDate(v){
  if(!v)return "";
  return new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v)).replace(","," ·");
}
function renderGlobalWallet(){
  const balance=$("#walletHeaderBalance");
  if(balance)balance.textContent=euro(walletBalance);
  const el=$("#walletDialogContent");if(!el)return;
  const manager=walletCanManage();
  const moves=walletTransactions.slice(0,12).map(t=>`<div class="wallet-move"><div><strong>${escapeHtml(walletMovementLabel(t))}</strong><small>${escapeHtml(walletDate(t.created_at))}</small></div><b class="${Number(t.amount)>=0?"plus":"minus"}">${Number(t.amount)>=0?"+":""}${escapeHtml(euro(Number(t.amount)))}</b></div>`).join("");
  const controls=manager?`
    <div class="global-wallet-add">
      <label><span>Importe</span><div><input id="globalWalletAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0,00"><b>€</b></div></label>
      <input id="globalWalletNote" class="wallet-note" type="text" maxlength="80" placeholder="Nota opcional">
      <div class="wallet-credit-actions"><button id="globalWalletAddFunds" type="button">+ Fondos</button><button id="globalWalletAddPrize" type="button">+ Premio</button></div>
    </div>`
    : `<p class="wallet-readonly global">Solo Salva puede añadir fondos, registrar premios o modificar el saldo.</p>`;
  el.innerHTML=`
    <div class="global-wallet-balance"><span>SALDO DISPONIBLE</span><strong>${escapeHtml(euro(walletBalance))}</strong><small>Compartido entre La Quiniela y Quinigol</small></div>
    ${controls}
    <div class="global-wallet-history"><div class="global-wallet-history-head"><span>ÚLTIMOS MOVIMIENTOS</span><b>${walletTransactions.length}</b></div><div class="wallet-moves">${moves||'<p class="wallet-empty">Sin movimientos todavía.</p>'}</div></div>`;
  if(manager){
    $("#globalWalletAddFunds")?.addEventListener("click",()=>addWalletCredit("funds"));
    $("#globalWalletAddPrize")?.addEventListener("click",()=>addWalletCredit("prize"));
  }
}
function openWalletDialog(){
  renderGlobalWallet();
  $("#walletDialog")?.showModal();
}
function estimatedQuinielaWalletCost(){
  const plan=jointBetRecommendation(journey);
  if(!plan?.ready)return null;
  return Number(plan.e8Ready?plan.total:plan.quinielaBets*.75);
}
function renderJointWallet(){
  const el=$("#jointWallet");if(!el||!journey)return;
  const manager=walletCanManage(),conf=walletConfirmation("quiniela",journey.id),estimated=estimatedQuinielaWalletCost();
  const costValue=conf?Number(conf.cost).toFixed(2):(estimated!=null?estimated.toFixed(2):"");
  const status=conf
    ? `<div class="wallet-bet-status confirmed"><span>✓ Apuesta confirmada</span><strong>${escapeHtml(euro(conf.cost))}</strong><small>${escapeHtml(walletDate(conf.confirmed_at))} · Pronósticos y conjunta bloqueados</small></div>`
    : `<div class="wallet-bet-status pending"><span>Pendiente de confirmar</span><small>${estimated!=null?`Coste recomendado: ${escapeHtml(euro(estimated))}`:"Introduce el coste real al confirmarla"}</small></div>`;
  const controls=manager?`
    <div class="wallet-confirm-controls">
      <label><span>Coste de esta apuesta</span><div><input id="walletBetCost" type="number" min="0.01" step="0.01" inputmode="decimal" value="${escapeHtml(costValue)}" placeholder="0,00"><b>€</b></div></label>
      <button id="walletConfirmBtn" type="button">${conf?"Actualizar":"Confirmar apuesta"}</button>
      ${conf?'<button id="walletUnconfirmBtn" class="wallet-secondary" type="button">Deshacer</button>':""}
    </div>`
    : `<p class="wallet-readonly">Confirmación gestionada por Salva.</p>`;
  el.innerHTML=`<section class="bet-confirm-card">
    <div class="bet-confirm-head"><div><span>APUESTA CONJUNTA</span><small>La Quiniela · Jornada ${journey.number}</small></div><button type="button" class="bet-wallet-link" data-open-global-wallet>Monedero · ${escapeHtml(euro(walletBalance))}</button></div>
    <div class="wallet-confirmation">${status}${controls}</div>
  </section>`;
  if(manager){
    $("#walletConfirmBtn")?.addEventListener("click",confirmQuinielaWalletBet);
    $("#walletUnconfirmBtn")?.addEventListener("click",unconfirmQuinielaWalletBet);
  }
  el.querySelector("[data-open-global-wallet]")?.addEventListener("click",openWalletDialog);
}
async function confirmQuinielaWalletBet(){
  const raw=String($("#walletBetCost")?.value||"").replace(",",".");
  const cost=Number(raw);
  if(!Number.isFinite(cost)||cost<=0){toast("Introduce un coste válido");return}
  try{
    setSync("","Guardando");
    const {error}=await sb.rpc("wallet_confirm_bet",{p_room_id:roomId,p_game:"quiniela",p_journey_id:journey.id,p_cost:cost});
    if(error)throw error;
    await loadWalletData();renderAll();setSync("online","Sincronizado");toast("✓ Apuesta confirmada · pronósticos bloqueados");
  }catch(e){console.error(e);setSync("error","Error");toast(String(e?.message||e).includes("Saldo insuficiente")?"Saldo insuficiente":"No se pudo confirmar la apuesta")}
}
async function unconfirmQuinielaWalletBet(){
  try{
    setSync("","Guardando");
    const {error}=await sb.rpc("wallet_unconfirm_bet",{p_room_id:roomId,p_game:"quiniela",p_journey_id:journey.id});
    if(error)throw error;
    await loadWalletData();renderAll();setSync("online","Sincronizado");toast("Confirmación anulada · importe devuelto · edición desbloqueada");
  }catch(e){console.error(e);setSync("error","Error");toast("No se pudo anular")}
}
async function addWalletCredit(kind){
  const raw=String($("#globalWalletAmount")?.value||"").replace(",",".");
  const amount=Number(raw),note=$("#globalWalletNote")?.value?.trim()||null;
  if(!Number.isFinite(amount)||amount<=0){toast("Introduce un importe válido");return}
  try{
    setSync("","Guardando");
    const {error}=await sb.rpc("wallet_add_credit",{p_room_id:roomId,p_kind:kind,p_amount:amount,p_note:note});
    if(error)throw error;
    await loadWalletData();renderGlobalWallet();renderJoint();setSync("online","Sincronizado");toast(kind==="prize"?"Premio añadido al monedero":"Fondos añadidos al monedero");
  }catch(e){console.error(e);setSync("error","Error");toast("No se pudo actualizar el monedero")}
}

function jointBetRecommendation(j=journey){
  const p1=memberBySlot(1),p2=memberBySlot(2);
  if(!j||!p1||!p2)return {ready:false,reason:"Faltan jugadores"};
  const rows=[];
  let missing1=0,missing2=0;
  for(let n=1;n<=14;n++){
    const a=pickForJourney(p1.user_id,j.id,n)?.pick||"";
    const b=pickForJourney(p2.user_id,j.id,n)?.pick||"";
    if(!a)missing1++;
    if(!b)missing2++;
    rows.push({n,a,b,diff:Boolean(a&&b&&a!==b)});
  }
  const p15a=displayPickForJourney(p1.user_id,j.id,15);
  const p15b=displayPickForJourney(p2.user_id,j.id,15);
  const p15InputsReady=p15a!=="—"&&p15b!=="—";
  const p15Joint=effectiveJointPlenoSelection(j.id);
  const p15Ready=Boolean(p15Joint);
  const e8Numbers=jointElige8Selections(j.id).map(e=>e.match_number);
  const e8Set=new Set(e8Numbers);
  const differences=rows.filter(r=>r.diff);
  const e8Differences=differences.filter(r=>e8Set.has(r.n));
  const ready=!missing1&&!missing2&&p15InputsReady&&p15Ready;

  if(!ready){
    const waiting=[];
    if(missing1)waiting.push(`${p1.display_name}: ${14-missing1}/14`);
    if(missing2)waiting.push(`${p2.display_name}: ${14-missing2}/14`);
    if(!p15InputsReady)waiting.push("Falta completar el Pleno al 15");
    else if(!p15Ready)waiting.push("Falta definir el Pleno al 15 conjunto");
    return {
      ready:false,
      p1,p2,rows,p15a,p15b,p15Joint,e8Numbers,
      title:"Propuesta pendiente",
      reason:waiting.join(" · ")||"Esperando pronósticos",
      badge:"Esperando"
    };
  }

  const QUINIELA_PRICE=.75;
  const E8_PRICE=.50;
  const e8Ready=e8Numbers.length===8;
  let mode="two-columns";
  if(differences.length===1 && e8Differences.length===0) mode="one-double";
  else if(differences.length===0) mode="common";

  let quinielaBets=mode==="common"?1:2;
  let e8Bets=1;
  let total=quinielaBets*QUINIELA_PRICE+(e8Ready?e8Bets*E8_PRICE:0);
  let title="",reason="",badge="";

  if(mode==="one-double"){
    const d=differences[0];
    title="1 bloque con 1 doble + Elige 8";
    badge="1 doble";
    reason=`Solo diferís en el partido ${d.n} y no está en vuestro Elige 8. Un doble cubre las dos opiniones sin encarecer el Elige 8.`;
  }else if(mode==="common"){
    title="1 columna común + Elige 8";
    badge="Coincidís";
    reason="Coincidís en los 14 partidos. El Pleno al 15 se juega una sola vez para todo el boleto.";
  }else{
    title="2 columnas + Elige 8";
    badge=`${differences.length} diferencia${differences.length===1?"":"s"}`;
    if(e8Differences.length){
      reason=`Tenéis ${differences.length} diferencia${differences.length===1?"":"s"}. Pongo a ${p2.display_name} en la primera columna para que el Elige 8 use su signo cuando discrepáis. El Pleno al 15 es único para las dos columnas.`;
    }else{
      const multiBets=Math.pow(2,differences.length);
      reason=`Tenéis ${differences.length} diferencias. Hacerlas todas dobles generaría ${multiBets} apuestas; con dos columnas mantenéis una de ${p2.display_name} y otra de ${p1.display_name} por mucho menos. El Pleno al 15 es común.`;
    }
  }

  const multipleBets=Math.pow(2,differences.length);
  const multipleCost=multipleBets*QUINIELA_PRICE+(e8Ready?E8_PRICE:0);

  return {
    ready:true,p1,p2,rows,p15a,p15b,p15Joint,e8Numbers,e8Set,differences,e8Differences,
    mode,title,reason,badge,quinielaBets,e8Bets,total,e8Ready,multipleBets,multipleCost
  };
}
function jointPlanGrid(rows,which,e8Set){
  return `<div class="joint-plan-grid">${rows.map(r=>{
    const sign=which==="double"&&r.diff?normalizeJointSelection((r.b||"")+(r.a||"")):(which==="p2"?r.b:r.a);
    return `<div class="joint-plan-cell ${e8Set?.has(r.n)?"is-e8":""}"><span>${r.n}${e8Set?.has(r.n)?'<i>★</i>':""}</span><strong>${escapeHtml(sign||"—")}</strong></div>`;
  }).join("")}</div>`;
}
function renderJointPlan(summary,j){
  const plan=jointBetRecommendation(j);
  if(!plan.ready){
    summary.innerHTML=`<section class="joint-plan-card pending"><div class="joint-plan-top"><div><span>PROPUESTA DE APUESTA</span><h3>${escapeHtml(plan.title)}</h3></div><b>${escapeHtml(plan.badge||"Pendiente")}</b></div><p>${escapeHtml(plan.reason)}</p></section>`;
    return;
  }

  const e8Text=plan.e8Ready
    ? `Elige 8: partidos ${plan.e8Numbers.join(", ")}`
    : `Elige 8 conjunto: ${plan.e8Numbers.length}/8 seleccionados`;
  const totalText=plan.e8Ready?euro(plan.total):euro(plan.quinielaBets*.75)+" + Elige 8";
  let detail="";

  if(plan.mode==="one-double"){
    detail=`
      <div class="joint-plan-block">
        <div class="joint-plan-block-head"><div><span>BLOQUE MÚLTIPLE</span><strong>Base ${escapeHtml(plan.p2.display_name)} · doble en P${plan.differences[0].n}</strong></div><b>2 apuestas</b></div>
        ${jointPlanGrid(plan.rows,"double",plan.e8Set)}
      </div>`;
  }else if(plan.mode==="common"){
    detail=`
      <div class="joint-plan-block">
        <div class="joint-plan-block-head"><div><span>COLUMNA COMÚN</span><strong>${escapeHtml(plan.p1.display_name)} = ${escapeHtml(plan.p2.display_name)}</strong></div><b>1 apuesta</b></div>
        ${jointPlanGrid(plan.rows,"p2",plan.e8Set)}
      </div>`;
  }else{
    detail=`
      <div class="joint-plan-columns">
        <div class="joint-plan-block player-two-plan">
          <div class="joint-plan-block-head"><div><span>COLUMNA 1 · BASE DEL ELIGE 8</span><strong>${escapeHtml(plan.p2.display_name)}</strong></div><b>1</b></div>
          ${jointPlanGrid(plan.rows,"p2",plan.e8Set)}
        </div>
        <div class="joint-plan-block player-one-plan">
          <div class="joint-plan-block-head"><div><span>COLUMNA 2</span><strong>${escapeHtml(plan.p1.display_name)}</strong></div><b>2</b></div>
          ${jointPlanGrid(plan.rows,"p1",plan.e8Set)}
        </div>
      </div>`;
  }

  const alt=plan.differences.length>=2
    ? `<p class="joint-plan-alt">Si convirtierais las ${plan.differences.length} diferencias en dobles: <strong>${plan.multipleBets} apuestas</strong>${plan.e8Ready?` · aprox. <strong>${euro(plan.multipleCost)}</strong> con Elige 8`:""}.</p>`
    :"";

  summary.innerHTML=`
    <section class="joint-plan-card">
      <div class="joint-plan-top">
        <div><span>PROPUESTA DE APUESTA</span><h3>${escapeHtml(plan.title)}</h3></div>
        <div class="joint-plan-price"><strong>${escapeHtml(totalText)}</strong><small>${escapeHtml(plan.badge)}</small></div>
      </div>
      <p>${escapeHtml(plan.reason)}</p>
      <div class="joint-plan-e8">${escapeHtml(e8Text)}${plan.e8Ready?'<b>0,50 €</b>':""}</div>
      <details class="joint-plan-details">
        <summary><span>Ver exactamente qué marcar</span><b>⌄</b></summary>
        <div class="joint-plan-detail-body">
          ${detail}
          <div class="joint-plan-p15 joint-plan-p15-shared"><span>Pleno al 15 · único para todo el boleto</span><strong>${escapeHtml(plan.p15Joint)}</strong></div>
          <div class="joint-plan-cost">
            <span>Quiniela</span><strong>${plan.quinielaBets} × 0,75 € = ${euro(plan.quinielaBets*.75)}</strong>
            <span>Elige 8</span><strong>${plan.e8Ready?euro(.5):"Pendiente"}</strong>
            <span>Total</span><strong>${escapeHtml(totalText)}</strong>
          </div>
          ${alt}
        </div>
      </details>
    </section>`;
}
function renderJoint(){
  const summary=$("#jointSummary"),list=$("#jointList");if(!summary||!list||!journey)return;
  const p1=memberBySlot(1),p2=memberBySlot(2);
  renderJointPlan(summary,journey);
  renderJointWallet();
  const locked=!journeyCanEdit(journey),normal=matches.filter(m=>m.number<=14);
  list.innerHTML=normal.map(m=>{
    const sel=effectiveJointSelection(m.number),override=jointOverrideFor(m.number),kind=jointSelectionKind(m.number);
    const p1pick=p1?pickForJourney(p1.user_id,journey.id,m.number)?.pick:null,p2pick=p2?pickForJourney(p2.user_id,journey.id,m.number)?.pick:null;
    return `<article class="joint-builder-card">
      <div class="joint-builder-head">
        <div class="match-index-competition"><span class="match-index">${String(m.number).padStart(2,"0")}</span>${matchCompetitionBadgeHtml(m)}</div>
        <div class="joint-builder-fixture">${fixtureMiniHtml(m)}</div>
        <span class="joint-kickoff" title="${escapeHtml(formatKickoff(m.kickoff))}">◷ ${escapeHtml(formatJointKickoff(m.kickoff))}</span>
        <div class="joint-builder-tools"><span class="joint-mode ${override?"manual":""}">${kind}</span></div>
      </div>
      <div class="joint-player-rows">
        <div class="joint-player-row player-one">
          <div class="joint-player-name"><i></i><span>${escapeHtml(p1?.display_name||"J1")}</span></div>
          ${jointReadonlySignsHtml(p1pick,"player-one-signs")}
        </div>
        <div class="joint-player-row player-two">
          <div class="joint-player-name"><i></i><span>${escapeHtml(p2?.display_name||"J2")}</span></div>
          ${jointReadonlySignsHtml(p2pick,"player-two-signs")}
        </div>
        <div class="joint-player-row joint-choice-row">
          <div class="joint-player-name"><i></i><span>Conjunta</span></div>
          <div class="joint-edit-wrap">
            <div class="joint-sign-row">${JOINT_SIGN_ORDER.map(sign=>`<button class="joint-sign ${sel.includes(sign)?"selected":""}" data-joint-match="${m.number}" data-joint-sign="${sign}" ${locked?"disabled":""}>${sign}</button>`).join("")}</div>
            ${override?`<button class="joint-reset" data-joint-reset="${m.number}" ${locked?"disabled":""}>↺ Automática</button>`:""}
          </div>
        </div>
      </div>
    </article>`;
  }).join("");
  const p15=matches.find(m=>m.number===15);
  if(p15){
    const p15a=p1?displayPickForJourney(p1.user_id,journey.id,15):"—";
    const p15b=p2?displayPickForJourney(p2.user_id,journey.id,15):"—";
    const p15override=jointOverrideFor(15,journey.id);
    const p15kind=jointPlenoKind(journey.id);
    list.insertAdjacentHTML("beforeend",`<article class="joint-builder-card p15-joint">
      <div class="joint-builder-head">
        <div class="match-index-competition"><span class="match-index">15</span>${matchCompetitionBadgeHtml(p15)}</div>
        <div class="joint-builder-fixture">${fixtureMiniHtml(p15)}</div>
        <span class="joint-kickoff" title="${escapeHtml(formatKickoff(p15.kickoff))}">◷ ${escapeHtml(formatJointKickoff(p15.kickoff))}</span>
        <div class="joint-builder-tools"><span class="joint-mode ${p15override?"manual":""}">${escapeHtml(p15kind)}</span></div>
      </div>
      <div class="joint-player-rows joint-pleno-rows">
        <div class="joint-player-row player-one">
          <div class="joint-player-name"><i></i><span>${escapeHtml(p1?.display_name||"J1")}</span></div>
          ${jointPlenoReadonlyHtml(p15a,"player-one-score")}
        </div>
        <div class="joint-player-row player-two">
          <div class="joint-player-name"><i></i><span>${escapeHtml(p2?.display_name||"J2")}</span></div>
          ${jointPlenoReadonlyHtml(p15b,"player-two-score")}
        </div>
        <div class="joint-player-row joint-choice-row joint-pleno-choice">
          <div class="joint-player-name"><i></i><span>Conjunta</span></div>
          <div class="joint-pleno-edit-wrap">
            ${jointPlenoEditorHtml(journey.id,locked)}
            <small>${jointPlenoKind(journey.id)==="Recomendado"?"Recomendado a partir de vuestros dos marcadores · ":""}M = 3 o más goles</small>
            ${p15override?`<button type="button" class="joint-reset joint-pleno-reset" ${locked?"disabled":""}>↺ Volver a recomendado</button>`:""}
          </div>
        </div>
      </div>
    </article>`);
  }
  $$(".joint-sign").forEach(btn=>btn.addEventListener("click",()=>{const n=Number(btn.dataset.jointMatch),sign=btn.dataset.jointSign,current=effectiveJointSelection(n),next=current.includes(sign)?current.replace(sign,""):current+sign;saveJointSelection(n,next)}));
  $$(".joint-reset:not(.joint-pleno-reset)").forEach(btn=>btn.addEventListener("click",()=>resetJointSelection(Number(btn.dataset.jointReset))));
  $$(".joint-pleno-goal").forEach(btn=>btn.addEventListener("click",()=>saveJointPlenoPart(btn.dataset.jointPlenoTeam,btn.dataset.jointPlenoGoal)));
  $(".joint-pleno-reset")?.addEventListener("click",resetJointPlenoSelection);
}
function jointElige8Selections(jid=journey?.id){
  if(!jid) return [];
  return allJointElige8.filter(e=>e.journey_id===jid).sort((a,b)=>a.match_number-b.match_number);
}

function isJointElige8(n,jid=journey?.id){
  return Boolean(allJointElige8.find(e=>e.journey_id===jid&&e.match_number===n));
}

function jointElige8PickForMatch(n,jid=journey?.id){
  const selection=effectiveJointSelection(n,jid);
  if(!selection)return "";
  if(selection.length===1)return selection;

  const p1=memberBySlot(1),p2=memberBySlot(2);
  const salva=p1?pickForJourney(p1.user_id,jid,n)?.pick:null;
  const ferran=p2?pickForJourney(p2.user_id,jid,n)?.pick:null;

  if(salva&&ferran&&salva!==ferran&&selection.includes(ferran))return ferran;
  if(ferran&&selection.includes(ferran))return ferran;
  return JOINT_SIGN_ORDER.find(sign=>selection.includes(sign))||"";
}

function scoreJointElige8(j=journey){
  const selected=jointElige8Selections(j?.id);
  let correct=0,resolved=0;
  for(const e of selected){
    const m=allMatches.find(x=>x.journey_id===j.id&&x.number===e.match_number);
    const actual=actualResultForMatch(m);
    const pick=jointElige8PickForMatch(e.match_number,j.id);
    if(actual==="—"||!pick) continue;
    resolved++;
    if(pick===actual)correct++;
  }
  return {selected:selected.length,correct,resolved};
}

function projectedScoreJointElige8(j=journey){
  const selected=jointElige8Selections(j?.id);
  let correct=0,wrong=0,considered=0,live=0;
  for(const e of selected){
    const m=allMatches.find(x=>x.journey_id===j.id&&x.number===e.match_number);
    const actual=projectedResultForMatch(m);
    const pick=jointElige8PickForMatch(e.match_number,j.id);
    if(actual==="—"||!pick) continue;
    considered++;
    if(m&&!matchResolved(m)) live++;
    if(pick===actual) correct++;
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
  if(!journeyCanEdit(journey)){toast(journeyEditBlockedMessage(journey));return}
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
    const a=p1?pickForJourney(p1.user_id,journey.id,m.number)?.pick:null;
    const b=p2?pickForJourney(p2.user_id,journey.id,m.number)?.pick:null;
    const same=Boolean(a&&b&&a===b);

    let tier=0;
    if(e1&&e2&&same) tier=4;
    else if(same) tier=3;
    else if(e1&&e2) tier=2;
    else if(e1||e2) tier=1;

    return {n:m.number,tier};
  }).sort((a,b)=>b.tier-a.tier||a.n-b.n);

  await saveJointElige8Set(
    ranked.slice(0,8).map(x=>x.n),
    "Elige 8 conjunto priorizado por coincidencias reales"
  );
}

function decorateJointElige8UI(){
  const summary=$("#jointSummary"),list=$("#jointList");
  if(!summary||!list||!journey)return;
  const p1=memberBySlot(1),p2=memberBySlot(2);
  const score=projectedScoreJointElige8(journey);
  const officialScore=scoreJointElige8(journey);
  const prize=officialScore.selected===8&&officialScore.resolved===8&&officialScore.correct===8;
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

  panel.classList.toggle("e8-prize-zone",prize);
  panel.innerHTML=`
    <div class="joint-e8-head">${prize?'<span class="e8-prize-badge">★ 8/8</span>':""}
      <div><span>ELIGE 8 CONJUNTO</span><h3>El Elige 8 de vuestra apuesta</h3></div>
      ${scoreHtml}
    </div>
    <p class="joint-e8-status">${statusText}</p>
    <div class="joint-e8-actions">
      <button type="button" data-joint-e8-copy="1" ${locked||jointElige8Saving?"disabled":""}>Copiar ${escapeHtml(p1?.display_name||"J1")}</button>
      <button type="button" data-joint-e8-copy="2" ${locked||jointElige8Saving?"disabled":""}>Copiar ${escapeHtml(p2?.display_name||"J2")}</button>
      <button type="button" data-joint-e8-auto ${locked||jointElige8Saving?"disabled":""}>Priorizar coincidencias reales</button>
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
      let tools=head.querySelector(".joint-builder-tools");
      if(!tools){
        tools=document.createElement("div");
        tools.className="joint-builder-tools";
        mode.replaceWith(tools);
        tools.appendChild(mode);
      }
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="joint-e8-toggle"+(selected?" selected":"");
      btn.disabled=locked||jointElige8Saving||(score.selected>=8&&!selected);
      btn.innerHTML=selected?"<span>★</span> E8 conjunto":"<span>☆</span> E8";
      btn.addEventListener("click",()=>toggleJointElige8(n));
      tools.appendChild(btn);
    }

    const p1Label=card.querySelector(".joint-player-row.player-one .joint-player-name");
    const p2Label=card.querySelector(".joint-player-row.player-two .joint-player-name");
    if(p1&&p1Label&&isElige8(p1.user_id,n))p1Label.insertAdjacentHTML("beforeend",'<b class="joint-personal-e8">★ E8</b>');
    if(p2&&p2Label&&isElige8(p2.user_id,n))p2Label.insertAdjacentHTML("beforeend",'<b class="joint-personal-e8">★ E8</b>');
  });
}

const __renderJointElige8Base=renderJoint;

renderJoint=function(){__renderJointElige8Base();decorateJointElige8UI();};

function statsForUser(uid,completed){
  const scores=completed.map(j=>({j,score:scoreUserJourney(uid,j)}));
  const total=scores.reduce((a,x)=>a+x.score.correct,0);
  const avg=completed.length?total/completed.length:0;
  const best=scores.length?Math.max(...scores.map(x=>x.score.correct)):0;
  const e8Scores=completed.map(j=>scoreElige8(uid,j));
  const e8=e8Scores.reduce((a,x)=>({correct:a.correct+x.correct,resolved:a.resolved+x.resolved}),{correct:0,resolved:0});
  const tenPlus=scores.filter(x=>x.score.resolved===15&&x.score.correct>=10).length;
  const e8Perfect=e8Scores.filter(x=>x.selected===8&&x.resolved===8&&x.correct===8).length;
  return {total,avg,best,e8,scores,tenPlus,e8Perfect};
}
function jointPrizeStats(completed){
  let e8Perfect=0,gold=0;
  const p1=memberBySlot(1),p2=memberBySlot(2);
  for(const j of completed){
    const e8=scoreJointElige8(j);
    const jointPerfect=e8.selected===8&&e8.resolved===8&&e8.correct===8;
    if(jointPerfect)e8Perfect++;
    const s1=p1?scoreUserJourney(p1.user_id,j).correct:0;
    const s2=p2?scoreUserJourney(p2.user_id,j).correct:0;
    if(s1>=10||s2>=10||jointPerfect)gold++;
  }
  return {e8Perfect,gold};
}
function renderStats(){
  const el=$("#statsContent");if(!el)return;
  const completed=journeys.filter(j=>journeyResolvedCount(j)===15).sort((a,b)=>a.number-b.number),p1=memberBySlot(1),p2=memberBySlot(2);
  if(!completed.length||!p1||!p2){el.innerHTML=`<div class="stats-empty">Las estadísticas completas aparecerán cuando haya jornadas con 15/15 resultados.</div>`;return}
  const a=statsForUser(p1.user_id,completed),b=statsForUser(p2.user_id,completed),joint=jointPrizeStats(completed);
  let wins1=0,wins2=0,ties=0;
  for(const j of completed){const s1=scoreUserJourney(p1.user_id,j).correct,s2=scoreUserJourney(p2.user_id,j).correct;if(s1>s2)wins1++;else if(s2>s1)wins2++;else ties++}
  el.innerHTML=`
    <section class="prize-stats-card">
      <div class="stats-section-head"><div><span>PREMIOS</span><h3>Historial de premios</h3></div></div>
      <div class="prize-stats-grid">
        <div class="prize-stat gold"><span>Jornadas doradas</span><strong>${joint.gold}</strong><small>10+ de alguno o E8 conjunto 8/8</small></div>
        <div class="prize-stat player-one"><span>10+ · ${escapeHtml(p1.display_name)}</span><strong>${a.tenPlus}</strong><small>Jornadas con 10 o más</small></div>
        <div class="prize-stat player-two"><span>10+ · ${escapeHtml(p2.display_name)}</span><strong>${b.tenPlus}</strong><small>Jornadas con 10 o más</small></div>
        <div class="prize-stat joint"><span>E8 conjunto 8/8</span><strong>${joint.e8Perfect}</strong><small>Premios perfectos confirmados</small></div>
      </div>
    </section>
    <section class="h2h-card"><span>CARA A CARA</span><div class="h2h-score"><div><strong>${wins1}</strong><small>${escapeHtml(p1.display_name)}</small></div><b>–</b><div><strong>${wins2}</strong><small>${escapeHtml(p2.display_name)}</small></div></div><p>${ties} empate${ties===1?"":"s"} · ${completed.length} jornadas finalizadas</p></section>
    <div class="stats-player-grid">${[[p1,a],[p2,b]].map(([p,s])=>`<article class="stats-player-card"><h3>${escapeHtml(p.display_name)}</h3><div class="stats-kpis"><div><span>Aciertos</span><strong>${s.total}</strong></div><div><span>Media</span><strong>${s.avg.toFixed(1)}</strong></div><div><span>Mejor</span><strong>${s.best}/15</strong></div><div><span>10+</span><strong>${s.tenPlus}</strong></div><div><span>E8 personal 8/8</span><strong>${s.e8Perfect}</strong></div></div></article>`).join("")}</div>
    <section class="evolution-card"><div class="stats-section-head"><div><span>EVOLUCIÓN</span><h3>Jornada a jornada</h3></div></div><div class="evolution-list">${completed.map(j=>{const s1=scoreUserJourney(p1.user_id,j).correct,s2=scoreUserJourney(p2.user_id,j).correct,e8=scoreJointElige8(j),gold=s1>=10||s2>=10||(e8.selected===8&&e8.resolved===8&&e8.correct===8);return `<div class="evolution-row ${gold?"prize-row":""}"><span class="evolution-j">J${j.number}</span><div class="evolution-bars"><div><span>${escapeHtml(p1.display_name)}</span><i style="width:${s1/15*100}%"></i><b>${s1}</b></div><div><span>${escapeHtml(p2.display_name)}</span><i style="width:${s2/15*100}%"></i><b>${s2}</b></div></div>${gold?'<span class="evolution-prize">★</span>':""}</div>`}).join("")}</div></section>`;
}
function openMatchDetail(n,jid=journey?.id){
  const j=journeys.find(x=>x.id===jid),m=allMatches.find(x=>x.journey_id===jid&&x.number===n);if(!j||!m)return;
  const p1=memberBySlot(1),p2=memberBySlot(2),a=p1?displayPickForJourney(p1.user_id,jid,n):"—",b=p2?displayPickForJourney(p2.user_id,jid,n):"—",actual=actualResultForMatch(m),resolved=matchResolved(m);
  $("#matchDetailTitle").textContent=`J${j.number} · Partido ${n}`;
  $("#matchDetailContent").innerHTML=`<div class="match-detail-fixture"><div>${teamCrestHtml(m.home,"",m.home_logo_url)}<strong>${escapeHtml(m.home)}</strong>${teamPositionHtml(m.home_position)}</div><div class="match-detail-score">${resolved?`<small>FINAL</small><strong>${m.home_score}–${m.away_score}</strong>`:"<strong>VS</strong>"}</div><div>${teamCrestHtml(m.away,"",m.away_logo_url)}<strong>${escapeHtml(m.away)}</strong>${teamPositionHtml(m.away_position)}</div></div><div class="match-detail-meta"><span>◷ ${escapeHtml(formatKickoff(m.kickoff))}</span>${resolved&&n<=14?`<span>Signo oficial: <b>${escapeHtml(actual)}</b></span>`:""}</div><div class="match-detail-picks"><div><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${a}</strong><small>${resolved&&a!=="—"?(a===actual?"Acierto":"Fallo"):""}${n<=14&&p1&&isElige8(p1.user_id,n,jid)?" · ★ E8":""}</small></div><div><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span><strong>${b}</strong><small>${resolved&&b!=="—"?(b===actual?"Acierto":"Fallo"):""}${n<=14&&p2&&isElige8(p2.user_id,n,jid)?" · ★ E8":""}</small></div></div>${resolved?"":tvBroadcastHtml(m)}`;
  $("#matchDetailDialog").showModal();
}
async function activateView(view){
  const next=QUINIELA_VIEWS.has(view)?view:"play";
  if((next==="stats"||next==="history")&&!historyFullyLoaded){
    try{await ensureAllJourneysLoaded()}catch(e){console.error(e);toast("No se pudo cargar todo el historial")}
  }
  saveQuinielaView(next);
  $$("#quinielaTabs .tab").forEach(t=>t.classList.toggle("active",t.dataset.view===next));
  $$("#quinielaMain .view").forEach(v=>v.classList.toggle("active",v.id===next+"View"));
  if(next==="joint")renderJoint();if(next==="compare")renderCompare();if(next==="stats")renderStats();if(next==="history")renderHistory();
}
window.addEventListener("quiniela:show",async()=>{
  try{
    document.documentElement.dataset.game="quiniela";
    if(selectedJourneyId==null)selectedJourneyId=loadSavedJourneyId();
    const target=journeys.find(j=>j.id===selectedJourneyId);
    if(target&&!loadedJourneyIds.has(target.id))await ensureJourneyLoaded(target.id,{quiet:true});
    selectActiveJourney();
    $("#journeySwitcher")?.classList.remove("hidden");
    renderAll();
    await activateView(savedQuinielaView());
    setSync("online","Sincronizado");
  }catch(e){
    console.error("Restaurar Quiniela:",e);
    $("#journeySwitcher")?.classList.remove("hidden");
    renderJourneySwitcher();
  }
});

window.addEventListener("wallet:refresh",async()=>{try{await loadWalletData();renderGlobalWallet();renderJoint()}catch(e){console.error("Monedero:",e)}});

function roomSummaryText(){
  const ordered=[...members].sort((a,b)=>a.slot-b.slot).map(m=>m.display_name).filter(Boolean);
  return ordered.length?ordered.join(" ↔ "):"Vosotros dos";
}
function openRoomDialog(){
  $("#roomDialogMembers").textContent=roomSummaryText();
  $("#roomCode").textContent=roomCode;
  const player=$("#deviceLinkPlayer");
  if(player)player.textContent=myMember?.display_name||"tu jugador";
  $("#roomDialog").showModal();
}

async function generateDeviceLink(){
  const btn=$("#generateDeviceLinkBtn");
  if(!btn||!roomId)return;
  btn.disabled=true;
  btn.textContent="Generando…";
  try{
    const {data,error}=await sb.rpc("create_device_link_token",{p_room_id:roomId});
    if(error)throw error;
    const token=String(data||"").trim();
    if(!token)throw new Error("No se pudo crear el enlace");
    const link=`${location.origin}${location.pathname}?device=${encodeURIComponent(token)}`;
    const input=$("#deviceLinkUrl");
    if(input)input.value=link;
    $("#deviceLinkBox")?.classList.remove("hidden");
    toast("Enlace listo · caduca en 15 minutos");
  }catch(e){
    console.error(e);
    toast("No se pudo generar el enlace");
  }finally{
    btn.disabled=false;
    btn.textContent="Vincular otro dispositivo";
  }
}

async function copyDeviceLink(){
  const link=$("#deviceLinkUrl")?.value||"";
  if(!link)return;
  try{
    await navigator.clipboard.writeText(link);
    toast("Enlace de Salva copiado".replace("Salva",myMember?.display_name||"jugador"));
  }catch{
    $("#deviceLinkUrl")?.select();
    toast("Mantén pulsado el enlace para copiarlo");
  }
}

async function shareDeviceLink(){
  const link=$("#deviceLinkUrl")?.value||"";
  if(!link)return;
  const name=myMember?.display_name||"tu jugador";
  try{
    if(navigator.share){
      await navigator.share({
        title:"Vincular Nuestra Quiniela",
        text:`Abre este enlace en el otro dispositivo para entrar como ${name}.`,
        url:link
      });
    }else{
      await navigator.clipboard.writeText(link);
      toast("Enlace copiado");
    }
  }catch(e){
    if(e?.name!=="AbortError")toast("No se pudo compartir el enlace");
  }
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
function myPickFor(n){ return picks.find(p=>p.user_id===identityUserId && p.match_number===n); }
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
    identityUserId=user.id;

    const params=new URLSearchParams(location.search);
    const deviceToken=params.get("device");
    if(deviceToken){
      const {error:deviceError}=await sb.rpc("claim_device_link",{p_token:deviceToken});
      if(deviceError) throw deviceError;
      params.delete("device");
      toast("✓ Dispositivo vinculado a tu jugador");
    }

    const claimToken=params.get("claim");
    if(claimToken){
      const {error:claimError}=await sb.rpc("claim_identity",{p_token:claimToken});
      if(claimError) throw claimError;
      params.delete("claim");
      toast("Identidad recuperada");
    }

    const qs=params.toString();
    history.replaceState({}, "", location.pathname+(qs?"?"+qs:""));

    const roomInput=$("#roomCodeInput");
    if(roomInput) roomInput.value=UNIQUE_ROOM_CODE;

    const {data:identity,error:identityError}=await sb.rpc("get_my_identity");
    if(identityError) throw identityError;
    const mine=Array.isArray(identity)?identity[0]:identity;

    if(!mine){ show("onboarding"); return; }

    identityUserId=mine.member_user_id;
    myMember={
      room_id:mine.room_id,
      user_id:mine.member_user_id,
      slot:mine.slot,
      display_name:mine.display_name
    };
    roomId=mine.room_id;
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
        const {data:m}=await sb.from("members").select("*").eq("room_id",roomId).eq("user_id",identityUserId).single();
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
    const {data:m,error:me}=await sb.from("members").select("*").eq("room_id",roomId).eq("user_id",identityUserId).single();
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
  await Promise.all([loadAllPicks(),loadAllElige8(),loadAllJointPicks(),loadAllJointElige8(),loadJourneySummaries(),loadWalletData()]);
  await loadNotices();
  selectActiveJourney();
  renderAll();
  subscribeRealtime();
  await refreshPushSubscription();
  startCountdownTimer();
  await activateView(requestedView);
  setSync("online","Sincronizado");
}

const loadedJourneyIds=new Set();
let journeySummaries=new Map();
let historyFullyLoaded=false;

function mergeJourneyRows(base,incoming,keyFn){
  const map=new Map((base||[]).map(x=>[keyFn(x),x]));
  for(const row of incoming||[])map.set(keyFn(row),row);
  return [...map.values()];
}
function initialJourneyIds(){
  const ids=journeys.slice(0,3).map(j=>j.id);
  const saved=loadSavedJourneyId();
  if(saved&&journeys.some(j=>j.id===saved)&&!ids.includes(saved))ids.push(saved);
  return ids;
}
async function loadJourneySummaries(){
  const {data,error}=await sb.rpc("get_quiniela_journey_summaries",{p_room_id:roomId});
  if(error){console.warn("Resumen de jornadas:",error);return}
  journeySummaries=new Map((data||[]).map(x=>[Number(x.journey_id),x]));
}
async function loadAllJourneys(){
  const {data:js,error}=await sb.from("journeys").select("*").order("number",{ascending:false});
  if(error) throw error;
  journeys=js||[];
  if(!journeys.length) throw new Error("No hay jornadas cargadas.");

  for(const id of initialJourneyIds())loadedJourneyIds.add(id);
  if(selectedJourneyId&&journeys.some(j=>j.id===selectedJourneyId))loadedJourneyIds.add(selectedJourneyId);
  const ids=[...loadedJourneyIds].filter(id=>journeys.some(j=>j.id===id));
  if(!ids.length){allMatches=[];return}
  const {data:ms,error:me}=await sb.from("matches").select("*").in("journey_id",ids).order("number");
  if(me) throw me;
  allMatches=mergeJourneyRows(
    allMatches.filter(m=>!ids.includes(m.journey_id)),
    ms||[],
    m=>`${m.journey_id}:${m.number}`
  );
}

function selectActiveJourney(){
  if(selectedJourneyId==null)selectedJourneyId=loadSavedJourneyId();
  const preferred=journeys.find(j=>j.id===selectedJourneyId&&loadedJourneyIds.has(j.id));
  const unfinished=journeys.filter(j=>journeyDisplayState(j)!=="finished"&&loadedJourneyIds.has(j.id));
  const playing=unfinished.find(j=>journeyDisplayState(j)==="playing");
  const open=unfinished.find(j=>journeyDisplayState(j)==="open");
  journey=preferred||playing||open||unfinished[0]||journeys.find(j=>loadedJourneyIds.has(j.id))||journeys[0];
  selectedJourneyId=journey.id;
  saveSelectedJourneyId(selectedJourneyId);
  matches=matchesForJourney(journey.id);
  picks=allPicks.filter(p=>p.journey_id===journey.id);
}

async function loadMembers(){
  const {data,error}=await sb.from("members").select("room_id,user_id,slot,display_name").eq("room_id",roomId).order("slot");
  if(error) throw error;
  members=data||[];
  myMember=members.find(m=>m.user_id===identityUserId)||myMember;
}

async function loadAllPicks(){
  const ids=[...loadedJourneyIds];
  if(!ids.length){allPicks=[];return}
  const {data,error}=await sb.from("picks").select("*").eq("room_id",roomId).in("journey_id",ids);
  if(error) throw error;
  allPicks=mergeJourneyRows(allPicks.filter(x=>!ids.includes(x.journey_id)),data||[],x=>`${x.journey_id}:${x.match_number}:${x.user_id}`);
  if(journey)picks=allPicks.filter(p=>p.journey_id===journey.id);
}
async function loadAllElige8(){
  const ids=[...loadedJourneyIds];
  if(!ids.length){allElige8=[];return}
  const {data,error}=await sb.from("elige8_selections").select("*").eq("room_id",roomId).in("journey_id",ids);
  if(error) throw error;
  allElige8=mergeJourneyRows(allElige8.filter(x=>!ids.includes(x.journey_id)),data||[],x=>`${x.journey_id}:${x.match_number}:${x.user_id}`);
}
async function loadAllJointPicks(){
  const ids=[...loadedJourneyIds];
  if(!ids.length){allJointPicks=[];return}
  const {data,error}=await sb.from("joint_picks").select("*").eq("room_id",roomId).in("journey_id",ids);
  if(error) throw error;
  allJointPicks=mergeJourneyRows(allJointPicks.filter(x=>!ids.includes(x.journey_id)),data||[],x=>`${x.journey_id}:${x.match_number}`);
}
function loadAllJointElige8(){
  return (async()=>{
    const ids=[...loadedJourneyIds];
    if(!ids.length){allJointElige8=[];return}
    const {data,error}=await sb.from("joint_elige8_selections").select("*").eq("room_id",roomId).in("journey_id",ids);
    if(error) throw error;
    allJointElige8=mergeJourneyRows(allJointElige8.filter(x=>!ids.includes(x.journey_id)),data||[],x=>`${x.journey_id}:${x.match_number}`);
  })();
}

async function ensureJourneyLoaded(jid,{quiet=false}={}){
  const id=Number(jid);
  if(loadedJourneyIds.has(id)&&matchesForJourney(id).length)return;
  if(!quiet){setSync("","Cargando jornada");toast("Cargando jornada completa…")}
  const [mr,pr,er,jr,jer]=await Promise.all([
    sb.from("matches").select("*").eq("journey_id",id).order("number"),
    sb.from("picks").select("*").eq("room_id",roomId).eq("journey_id",id),
    sb.from("elige8_selections").select("*").eq("room_id",roomId).eq("journey_id",id),
    sb.from("joint_picks").select("*").eq("room_id",roomId).eq("journey_id",id),
    sb.from("joint_elige8_selections").select("*").eq("room_id",roomId).eq("journey_id",id)
  ]);
  for(const r of [mr,pr,er,jr,jer])if(r.error)throw r.error;
  allMatches=mergeJourneyRows(allMatches,mr.data||[],m=>`${m.journey_id}:${m.number}`);
  allPicks=mergeJourneyRows(allPicks,pr.data||[],x=>`${x.journey_id}:${x.match_number}:${x.user_id}`);
  allElige8=mergeJourneyRows(allElige8,er.data||[],x=>`${x.journey_id}:${x.match_number}:${x.user_id}`);
  allJointPicks=mergeJourneyRows(allJointPicks,jr.data||[],x=>`${x.journey_id}:${x.match_number}`);
  allJointElige8=mergeJourneyRows(allJointElige8,jer.data||[],x=>`${x.journey_id}:${x.match_number}`);
  loadedJourneyIds.add(id);
  if(!quiet)setSync("online","Sincronizado");
}
async function ensureAllJourneysLoaded(){
  if(historyFullyLoaded)return;
  const missing=journeys.map(j=>j.id).filter(id=>!loadedJourneyIds.has(id));
  for(let i=0;i<missing.length;i+=12){
    const chunk=missing.slice(i,i+12);
    setSync("","Cargando historial");
    const [mr,pr,er,jr,jer]=await Promise.all([
      sb.from("matches").select("*").in("journey_id",chunk).order("number"),
      sb.from("picks").select("*").eq("room_id",roomId).in("journey_id",chunk),
      sb.from("elige8_selections").select("*").eq("room_id",roomId).in("journey_id",chunk),
      sb.from("joint_picks").select("*").eq("room_id",roomId).in("journey_id",chunk),
      sb.from("joint_elige8_selections").select("*").eq("room_id",roomId).in("journey_id",chunk)
    ]);
    for(const r of [mr,pr,er,jr,jer])if(r.error)throw r.error;
    allMatches=mergeJourneyRows(allMatches,mr.data||[],m=>`${m.journey_id}:${m.number}`);
    allPicks=mergeJourneyRows(allPicks,pr.data||[],x=>`${x.journey_id}:${x.match_number}:${x.user_id}`);
    allElige8=mergeJourneyRows(allElige8,er.data||[],x=>`${x.journey_id}:${x.match_number}:${x.user_id}`);
    allJointPicks=mergeJourneyRows(allJointPicks,jr.data||[],x=>`${x.journey_id}:${x.match_number}`);
    allJointElige8=mergeJourneyRows(allJointElige8,jer.data||[],x=>`${x.journey_id}:${x.match_number}`);
    chunk.forEach(id=>loadedJourneyIds.add(id));
  }
  historyFullyLoaded=true;
  if(journey){
    matches=matchesForJourney(journey.id);
    picks=allPicks.filter(p=>p.journey_id===journey.id);
  }
  setSync("online","Sincronizado");
}

async function refreshData(){
  await Promise.all([loadAllJourneys(),loadMembers()]);
  await Promise.all([loadAllPicks(),loadAllElige8(),loadAllJointPicks(),loadAllJointElige8(),loadJourneySummaries(),loadWalletData()]);
  selectActiveJourney();
  renderAll();
}

function matchCompetitionBadgeHtml(m){
  const name=String(m?.competition_name||"").trim();
  const logo=String(m?.competition_logo_url||"").trim();
  if(!name||!logo)return "";
  const primary=logoStorageUrl(logo);
  const fallback=logoProxyUrl(logo);
  return `<span class="match-competition-badge" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)}"><b class="match-competition-fallback">${escapeHtml(leagueShortLabel(name))}</b><img src="${escapeHtml(primary)}" data-logo-fallback="${escapeHtml(fallback)}" alt="${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer" onload="this.previousElementSibling.style.display='none'" onerror="const f=this.dataset.logoFallback;if(f&&this.src!==f){this.src=f}else this.remove()"></span>`;
}
function historyFixtureHtml(m){
  const row=(name,logo,position,side)=>`<span class="history-fixture-team ${side}">${teamCrestHtml(name,"xs",logo)}<span class="history-team-pos">${Number(position)>0?Number(position)+".º":""}</span><span class="history-team-name">${escapeHtml(name)}</span></span>`;
  return `<span class="history-fixture-grid">${row(m.home,m.home_logo_url,m.home_position,"home")}${row(m.away,m.away_logo_url,m.away_position,"away")}</span>`;
}
function journeyCompetitions(j=journey){
  if(!j) return [];
  const seen=new Map();
  matchesForJourney(j.id).forEach(m=>{
    const id=Number(m.competition_id);
    const name=String(m.competition_name||"").trim();
    const logo=String(m.competition_logo_url||"").trim();
    if(!id||!name||!logo||seen.has(id)) return;
    seen.set(id,{id,name,logo});
  });
  return [...seen.values()];
}
function leagueShortLabel(name=""){
  const n=String(name);
  if(n==="LaLiga 2") return "L2";
  if(n==="Primera Federación") return "1ª";
  if(n==="Segunda Federación") return "2ª";
  if(n==="Liga F") return "LF";
  if(n==="Segunda Federación Femenina") return "2F";
  return n.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"L";
}
function renderJourneyLeagues(){
  const el=$("#journeyLeagues");
  if(!el) return;
  const comps=journeyCompetitions();
  if(!comps.length){el.innerHTML="";el.classList.add("hidden");return}
  el.classList.remove("hidden");
  const shown=comps.slice(0,3);
  el.innerHTML=shown.map((c,i)=>`<span class="journey-league-logo" style="--league-i:${i}" title="${escapeHtml(c.name)}" aria-label="${escapeHtml(c.name)}"><b>${escapeHtml(leagueShortLabel(c.name))}</b><img src="${escapeHtml(logoStorageUrl(c.logo))}" data-logo-fallback="${escapeHtml(logoProxyUrl(c.logo))}" alt="${escapeHtml(c.name)}" loading="lazy" referrerpolicy="no-referrer" onload="this.previousElementSibling.style.display='none'" onerror="const f=this.dataset.logoFallback;if(f&&this.src!==f){this.src=f}else this.remove()"></span>`).join("")+(comps.length>3?`<span class="journey-league-more" title="${escapeHtml(comps.slice(3).map(c=>c.name).join(", "))}">+${comps.length-3}</span>`:"");
}
function renderAll(){
  const roomMembers=$("#roomMembers");if(roomMembers)roomMembers.textContent=roomSummaryText();
  const pairLabel=$("#roomPairLabel");if(pairLabel)pairLabel.textContent=[...members].sort((a,b)=>a.slot-b.slot).map(m=>m.display_name).filter(Boolean).join(" × ")||"Salva × Ferran";
  const playingAs=document.querySelector(".room-playing-as");
  if(playingAs){
    playingAs.classList.toggle("player-one",myMember?.slot===1);
    playingAs.classList.toggle("player-two",myMember?.slot===2);
  }
  if($("#roomDialogMembers"))$("#roomDialogMembers").textContent=roomSummaryText();
  if($("#roomCode"))$("#roomCode").textContent=roomCode;
  $("#myName").textContent=myMember?.display_name||"Tú";
  $("#journeyNumber").textContent=`Jornada ${journey.number}`;
  const deadline=journeyDeadline(journey);
  const deadlineEl=$("#journeyDate");
  if(deadlineEl){
    const passed=deadline&&Date.now()>=deadline.getTime();
    const today=!passed&&journeyDeadlineIsToday(journey);
    deadlineEl.className="journey-deadline"+(passed?" passed":"");
    deadlineEl.innerHTML=`<small>${passed?"PRONÓSTICOS CERRADOS":today?"HASTA":"CIERRE"}</small><b>${escapeHtml(formatJourneyDeadline(journey))}</b>`;
  }
  const state=journeyDisplayState(journey),resolved=journeyResolvedCount(journey);
  const statusLabels={open:"Abierta para pronósticos",playing:`En juego · ${resolved}/15 resultados`,closed:"Cerrada · esperando partidos",finished:"Finalizada · 15/15 resultados"};
  $(".status-text").textContent=statusLabels[state]||"Jornada";
  const kicker=$(".journey-kicker");if(kicker)kicker.textContent=state==="playing"?"SEGUIMIENTO DE RESULTADOS":state==="open"?"PRÓXIMA JORNADA":state==="finished"?"JORNADA FINALIZADA":"JORNADA CERRADA";
  const journeyCard=$("#journeyCard");
  if(journeyCard){
    journeyCard.dataset.status=state;
    const prizeState=state==="finished"?finishedJourneyPrizeState(journey):"";
    if(prizeState)journeyCard.dataset.prize=prizeState;
    else delete journeyCard.dataset.prize;
  }
  renderJourneyLeagues();
  const opponent=members.find(m=>m.user_id!==identityUserId);
  if(document.documentElement.dataset.game!=="quinigol"){
    if(opponent){const completed=completedCountForUser(opponent.user_id);$("#opponentStatus").textContent=completed===15?`✓ ${opponent.display_name} ha completado la jornada`:`${opponent.display_name}: ${completed}/15 completados`}
    else $("#opponentStatus").textContent="Esperando al segundo jugador";
  }
  renderGlobalWallet();renderJourneySwitcher();renderJourneyDashboard();renderMatches();renderPleno();renderProgress();renderElige8Progress();renderJoint();renderCompare();renderStats();renderHistory();renderNotificationBadge();maybeCelebrateBothComplete();updateCountdowns();
}

function renderMatches(){
  const normal=matches.filter(m=>m.number<=14),locked=!journeyCanEdit(journey),myE8Count=elige8Count(identityUserId),opponent=members.find(m=>m.user_id!==identityUserId);
  $("#matches").innerHTML=normal.map(m=>{
    const mp=myPickFor(m.number),e8=isElige8(identityUserId,m.number),e8Disabled=locked||elige8Saving||(myE8Count>=8&&!e8),resultHtml=resultBarHtml(m,mp),outcome=matchOutcomeForUser(m),oppPick=opponent?pickFor(opponent.user_id,m.number):null,reveal=Boolean(mp?.pick);
    const myLabel=escapeHtml(myMember?.display_name||"Tú"),opponentLabel=escapeHtml(opponent?.display_name||"Compañero"),myInitial=escapeHtml((myMember?.display_name||"T").trim().charAt(0).toUpperCase()||"T"),opponentInitial=escapeHtml((opponent?.display_name||"C").trim().charAt(0).toUpperCase()||"C");
    const myOwnerClass=myMember?.slot===2?"player-two":"player-one",opponentOwnerClass=opponent?.slot===2?"player-two":"player-one";
    return `<article class="match-card ${e8?"e8-active":""} ${matchResolved(m)?"has-result":"pre-match"} ${mp?.pick?"has-pick":"no-pick"}" data-resolved="${matchResolved(m)}" data-outcome="${outcome}" data-e8="${e8}">
      <div class="match-card-head"><div class="match-number-wrap"><span class="match-index">${String(m.number).padStart(2,"0")}</span><span class="match-label">PARTIDO</span>${matchCompetitionBadgeHtml(m)}</div><div class="match-head-actions"><div class="kickoff-stack"><span class="kickoff ${m.kickoff?"":"pending-time"}">◷ ${escapeHtml(formatKickoff(m.kickoff))}</span>${!matchResolved(m)&&m.kickoff?`<small class="match-countdown" data-countdown="${escapeHtml(m.kickoff)}">${escapeHtml(countdownText(m.kickoff))}</small>`:""}</div>${matchResolved(m)?`<button class="detail-btn" data-detail-match="${m.number}" type="button">Detalles</button>`:""}<button class="e8-toggle ${e8?"selected":""}" data-e8-match="${m.number}" ${e8Disabled?"disabled":""} type="button"><span>★</span> ${e8?"E8":"Elige 8"}</button></div></div>
      <div class="fixture-teams"><div class="fixture-team home-team">${teamCrestHtml(m.home,"",m.home_logo_url)}<div><small class="team-meta">LOCAL ${teamPositionHtml(m.home_position)}</small><strong>${escapeHtml(m.home)}</strong></div></div>${matchResolved(m)?`<span class="fixture-score" aria-label="Resultado final ${m.home_score} a ${m.away_score}"><small>FINAL</small><strong>${m.home_score}<b>–</b>${m.away_score}</strong></span>`:`<span class="fixture-vs" aria-hidden="true">VS</span>`}<div class="fixture-team away-team">${teamCrestHtml(m.away,"",m.away_logo_url)}<div><small class="team-meta">VISITANTE ${teamPositionHtml(m.away_position)}</small><strong>${escapeHtml(m.away)}</strong></div></div></div>
      ${matchResolved(m)?"":tvBroadcastHtml(m)}
      <div class="pick-row">${["1","X","2"].map(v=>`<button class="pick ${mp?.pick===v?"selected":""}" data-match="${m.number}" data-pick="${v}" ${locked?"disabled":""}><span>${v}</span><small>${v==="1"?"Local":v==="X"?"Empate":"Visitante"}</small></button>`).join("")}</div>${mp?.pick?`<div class="pick-owner-track" aria-label="Pronósticos de los jugadores">${["1","X","2"].map(v=>`<div class="pick-owner-cell">${mp?.pick===v?`<span class="pick-owner-chip ${myOwnerClass}" title="${myLabel}" aria-label="${myLabel}">${myInitial}</span>`:""}${reveal&&oppPick?.pick===v?`<span class="pick-owner-chip ${opponentOwnerClass}" title="${opponentLabel}" aria-label="${opponentLabel}">${opponentInitial}</span>`:""}</div>`).join("")}</div>`:""}
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
  $("#plenoKickoff").innerHTML=`${matchCompetitionBadgeHtml(m)}<span class="pleno-kickoff-time">◷ ${escapeHtml(formatKickoff(m.kickoff))}${!matchResolved(m)&&m.kickoff?` <small class="inline-countdown" data-countdown="${escapeHtml(m.kickoff)}">${escapeHtml(countdownText(m.kickoff))}</small>`:""}</span>`;$("#plenoKickoff").classList.toggle("pending-time",!m.kickoff);
  const plenoTv=$("#plenoTv");if(plenoTv)plenoTv.innerHTML=matchResolved(m)?`<div class="pleno-final-score"><small>RESULTADO FINAL</small><strong>${m.home_score}<b>–</b>${m.away_score}</strong></div>`:tvBroadcastHtml(m);
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
  const opponent=members.find(x=>x.user_id!==identityUserId),opp=opponent?pickFor(opponent.user_id,15):null,oppEl=$("#plenoOpponent");
  if(oppEl){const reveal=Boolean(mp?.home_goals&&mp?.away_goals);oppEl.classList.toggle("hidden",!reveal);if(reveal)oppEl.innerHTML=`<span>${escapeHtml(opponent?.display_name||"Compañero")}</span><strong>${opp?.home_goals&&opp?.away_goals?`${opp.home_goals}-${opp.away_goals}`:"pendiente"}</strong>`}
  const resultEl=$("#plenoResult"),resultHtml=resultBarHtml(m,mp);resultEl.className="match-result-bar";
  if(resultHtml){const wrapper=document.createElement("div");wrapper.innerHTML=resultHtml;resultEl.className=wrapper.firstElementChild.className;resultEl.innerHTML=wrapper.firstElementChild.innerHTML}else{resultEl.classList.add("hidden");resultEl.innerHTML=""}
  $$(".goal").forEach(b=>b.addEventListener("click",()=>savePleno(b.dataset.team,b.dataset.goal)));$$("#plenoTv [data-detail-match]").forEach(b=>b.addEventListener("click",()=>openMatchDetail(15)));updateCountdowns();
}

async function toggleElige8(n){
  if(!journeyCanEdit(journey)){ toast(journeyEditBlockedMessage(journey)); return; }
  if(elige8Saving) return;

  const selected=isElige8(identityUserId,n);
  if(!selected && elige8Count(identityUserId)>=8){
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
        .eq("user_id",identityUserId);
      if(error) throw error;
      allElige8=allElige8.filter(e=>!(e.room_id===roomId&&e.journey_id===journey.id&&e.match_number===n&&e.user_id===identityUserId));
    }else{
      const row={room_id:roomId,journey_id:journey.id,match_number:n,user_id:identityUserId};
      const {error}=await sb.from("elige8_selections").insert(row);
      if(error) throw error;
      allElige8.push(row);
    }

    renderElige8Progress();
    renderMatches();
    renderCompare();
    setSync("online","Sincronizado");
    if(elige8Count(identityUserId)===8) toast("✓ Elige 8 completo");
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
  if(!journeyCanEdit(journey)){toast(journeyEditBlockedMessage(journey));return}
  if(saving)return;
  const previous=myPickFor(n);
  if(!previous)return;
  saving=true;setSync("","Borrando");
  picks=picks.filter(p=>!(p.user_id===identityUserId&&p.match_number===n));
  allPicks=allPicks.filter(p=>!(p.user_id===identityUserId&&p.match_number===n&&p.journey_id===journey.id));
  renderAll();
  const {error}=await sb.from("picks")
    .delete()
    .eq("room_id",roomId)
    .eq("journey_id",journey.id)
    .eq("match_number",n)
    .eq("user_id",identityUserId);
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
  if(!journeyCanEdit(journey)){ toast(journeyEditBlockedMessage(journey)); return; }
  if(saving) return; saving=true; setSync("","Guardando");
  $$(".pick,.goal").forEach(b=>b.disabled=true);
  const previous=myPickFor(n);
  const row={room_id:roomId,journey_id:journey.id,match_number:n,user_id:identityUserId,pick:val,home_goals:null,away_goals:null};
  optimisticUpsert(row);
  renderAll();
  const {error}=await sb.from("picks").upsert(row,{onConflict:"room_id,journey_id,match_number,user_id"});
  saving=false; $$(".pick,.goal").forEach(b=>b.disabled=false);
  if(error){ console.error(error); if(previous) optimisticUpsert(previous); else {
    picks=picks.filter(p=>!(p.user_id===identityUserId&&p.match_number===n));
    allPicks=allPicks.filter(p=>!(p.user_id===identityUserId&&p.match_number===n&&p.journey_id===journey.id));
  } renderAll(); setSync("error","Error"); toast("No se pudo guardar");}
  else {setSync("online","Sincronizado");}
}

async function savePleno(team,val){
  if(!journeyCanEdit(journey)){ toast(journeyEditBlockedMessage(journey)); return; }
  if(saving) return; saving=true; setSync("","Guardando");
  $$(".pick,.goal").forEach(b=>b.disabled=true);
  const previous=myPickFor(15);
  const row={
    room_id:roomId,journey_id:journey.id,match_number:15,user_id:identityUserId,pick:null,
    home_goals: team==="home"?val:(previous?.home_goals||null),
    away_goals: team==="away"?val:(previous?.away_goals||null)
  };
  optimisticUpsert(row); renderAll();
  const {error}=await sb.from("picks").upsert(row,{onConflict:"room_id,journey_id,match_number,user_id"});
  saving=false; $$(".pick,.goal").forEach(b=>b.disabled=false);
  if(error){console.error(error); if(previous) optimisticUpsert(previous); else {
    picks=picks.filter(p=>!(p.user_id===identityUserId&&p.match_number===15));
    allPicks=allPicks.filter(p=>!(p.user_id===identityUserId&&p.match_number===15&&p.journey_id===journey.id));
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
  const count=elige8Count(identityUserId);
  const el=$("#elige8Progress"),status=$("#elige8Status");
  if(!el||!journey) return;
  const projected=projectedScoreElige8(identityUserId,journey);
  const official=scoreElige8(identityUserId,journey);
  const prize=official.selected===8&&official.resolved===8&&official.correct===8;
  const panel=el.closest(".elige8-panel");
  if(panel)panel.classList.toggle("e8-prize-zone",prize);
  el.classList.toggle("e8-prize-score",prize);

  if(prize){
    el.innerHTML='<span class="e8-prize-win">★ 8/8 aciertos</span>';
    if(status)status.textContent="Premio Elige 8 · 8/8 confirmados.";
    return;
  }

  el.innerHTML=`<span class="e8-score-ok">${projected.correct} aciertos</span><span class="e8-score-bad">${projected.wrong} fallos</span>`;

  if(status){
    if(projected.considered>0){
      const parts=[`${projected.considered}/${projected.selected||8} valorados`];
      if(projected.live)parts.push(`${projected.live} en directo`);
      if(projected.pending)parts.push(`${projected.pending} pendientes`);
      status.textContent=parts.join(" · ")+(projected.live?" · provisional":"");
    }else if(count===8){
      status.textContent="8/8 seleccionados · esperando resultados";
    }else{
      status.textContent=`${count}/8 seleccionados · Marca E8 en ocho partidos del 1 al 14.`;
    }
  }
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
    const official=matchResolved(m);
    const projectedResult=projectedResultForMatch(m);
    const liveResult=!official&&projectedResult!=="—";
    const resultStatus=official?"Oficial":liveResult?"En directo":"Pendiente";
    const rawScore=official
      ? `${m.home_score}-${m.away_score}`
      : liveResult&&m.live_home_score!=null&&m.live_away_score!=null
        ? `${m.live_home_score}-${m.live_away_score}`
        : "—";

    let aMark="",bMark="";
    if(official){
      const result=m.number===15?`${normalizedGoalScore(m.home_score)}-${normalizedGoalScore(m.away_score)}`:resultSignForMatch(m);
      if(a!=="—") aMark=a===result?'<em class="pick-mark ok">✓</em>':'<em class="pick-mark bad">✕</em>';
      if(b!=="—") bMark=b===result?'<em class="pick-mark ok">✓</em>':'<em class="pick-mark bad">✕</em>';
    }

    const aVisual=m.number<=14?jointReadonlySignsHtml(a,"player-one-signs compare-readonly"):`<strong>${a}</strong>`;
    const bVisual=m.number<=14?jointReadonlySignsHtml(b,"player-two-signs compare-readonly"):`<strong>${b}</strong>`;
    const resultVisual=m.number<=14
      ? jointReadonlySignsHtml(projectedResult,"result-signs compare-readonly")
      : `<strong class="compare-real-score">${rawScore}</strong>`;
    return `<article class="compare-card ${state} ${ej?"compare-joint-e8":""}">
      <div class="compare-card-head"><div class="compare-number-competition"><span class="compare-number">${m.number===15?"P15":String(m.number).padStart(2,"0")}</span>${matchCompetitionBadgeHtml(m)}</div><div class="compare-fixture">${compareFixtureHtml(m)}</div><span class="compare-state">${label}</span></div>
      ${official?"":tvBroadcastHtml(m,true)}
      <div class="compare-picks">
        <div class="compare-pick-box player-one"><span><i class="player-dot"></i>${escapeHtml(p1?.display_name||"Jugador 1")}${e1?'<b class="e8-chip">★ E8</b>':""}</span><div class="compare-pick-value">${aVisual}${aMark}</div></div>
        <div class="compare-pick-box player-two"><span><i class="player-dot"></i>${escapeHtml(p2?.display_name||"Jugador 2")}${e2?'<b class="e8-chip">★ E8</b>':""}</span><div class="compare-pick-value">${bVisual}${bMark}</div></div>
        <div class="compare-pick-box result-box ${official?"official":liveResult?"live":"pending"}"><span><i class="result-dot"></i>Resultado <b class="compare-result-status">${resultStatus}</b></span><div class="compare-pick-value">${resultVisual}<small class="compare-score-text">${rawScore}</small></div></div>
      </div>
    </article>`;
  }).join("");
  $("#coincidences").textContent=`${same} / 15`;
  const e8=$("#elige8CompareSummary");
  const p1e8=p1?elige8Count(p1.user_id):0;
  const p2e8=p2?elige8Count(p2.user_id):0;
  const jointE8=jointElige8Selections().length;
  const p1e8Score=p1?scoreElige8(p1.user_id,journey):{selected:0,correct:0,resolved:0};
  const p2e8Score=p2?scoreElige8(p2.user_id,journey):{selected:0,correct:0,resolved:0};
  const jointE8Score=scoreJointElige8(journey);
  const p1e8Prize=p1e8Score.selected===8&&p1e8Score.resolved===8&&p1e8Score.correct===8;
  const p2e8Prize=p2e8Score.selected===8&&p2e8Score.resolved===8&&p2e8Score.correct===8;
  const jointE8Prize=jointE8Score.selected===8&&jointE8Score.resolved===8&&jointE8Score.correct===8;
  if(!p2){
    $("#compareSubtitle").textContent="Comparte el código para añadir al segundo jugador";
    if(e8)e8.innerHTML=`<div class="e8-compare-head"><span>ELIGE 8</span><strong>Comparación</strong></div><div class="e8-compare-grid two"><div class="player-one ${p1e8Prize?"e8-prize-zone":""}"><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${p1e8Score.resolved?`${p1e8Score.correct}/8`:`${p1e8}/8`}</strong></div><div class="joint ${jointE8Prize?"e8-prize-zone":""}"><span>Conjunto</span><strong>${jointE8Score.resolved?`${jointE8Score.correct}/8`:`${jointE8}/8`}</strong></div></div>`;
    return;
  }
  $("#compareSubtitle").textContent=`${p1?.display_name||"Jugador 1"} ${completedCountForUser(p1?.user_id)}/15 · ${p2?.display_name||"Jugador 2"} ${completedCountForUser(p2?.user_id)}/15`;
  if(e8)e8.innerHTML=`<div class="e8-compare-head"><span>ELIGE 8</span><strong>Comparación</strong></div><div class="e8-compare-grid">
    <div class="player-one ${p1e8Prize?"e8-prize-zone":""}"><span>${escapeHtml(p1?.display_name||"J1")}</span><strong>${p1e8Score.resolved?`${p1e8Score.correct}/8`:`${p1e8}/8`}</strong></div>
    <div><span>Coincidís</span><strong>${e8Both}</strong><small>${e8Only1+e8Only2?`${e8Only1+e8Only2} distintos`:"mismos partidos"}</small></div>
    <div class="player-two ${p2e8Prize?"e8-prize-zone":""}"><span>${escapeHtml(p2?.display_name||"J2")}</span><strong>${p2e8Score.resolved?`${p2e8Score.correct}/8`:`${p2e8}/8`}</strong></div>
    <div class="joint ${jointE8Prize?"e8-prize-zone":""}"><span>Conjunto</span><strong>${jointE8Score.resolved?`${jointE8Score.correct}/8`:`${jointE8}/8`}</strong></div>
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
  $("#historyList").innerHTML=historic.map(j=>{
    const s1=p1?scoreUserJourney(p1.user_id,j):{correct:0},s2=p2?scoreUserJourney(p2.user_id,j):{correct:0};
    const e1=p1?scoreElige8(p1.user_id,j):{selected:0,correct:0,resolved:0},e2=p2?scoreElige8(p2.user_id,j):{selected:0,correct:0,resolved:0};
    const winnerSide=!p1||!p2?"tie":s1.correct>s2.correct?"one":s2.correct>s1.correct?"two":"tie";
    const winnerText=winnerSide==="one"?`Gana ${escapeHtml(p1.display_name)}`:winnerSide==="two"?`Gana ${escapeHtml(p2.display_name)}`:"Empate";
    return `<button class="history-card history-winner-${winnerSide}" data-history-id="${j.id}">
      <div class="history-card-top">
        <div><div class="history-card-title">Jornada ${j.number}</div><div class="history-card-date">${escapeHtml(formatDate(j.draw_date))}</div></div>
        <span class="history-card-badge history-winner-badge ${winnerSide}">${winnerText}</span>
      </div>
      <div class="history-versus">
        <div class="player-one ${winnerSide==="one"?"is-winner":""}"><span>${escapeHtml(p1?.display_name||"J1")}</span><strong>${s1.correct}</strong></div>
        <b>–</b>
        <div class="player-two ${winnerSide==="two"?"is-winner":""}"><strong>${s2.correct}</strong><span>${escapeHtml(p2?.display_name||"J2")}</span></div>
      </div>
      <div class="history-card-stats">
        <div class="history-stat player-one ${e1.selected===8&&e1.resolved===8&&e1.correct===8?"e8-prize-zone":""}"><span>Elige 8 · ${escapeHtml(p1?.display_name||"J1")}</span><strong>${e1.selected?`${e1.correct}/${e1.resolved}`:"—"}</strong></div>
        <div class="history-stat player-two ${e2.selected===8&&e2.resolved===8&&e2.correct===8?"e8-prize-zone":""}"><span>Elige 8 · ${escapeHtml(p2?.display_name||"J2")}</span><strong>${e2.selected?`${e2.correct}/${e2.resolved}`:"—"}</strong></div>
      </div>
    </button>`;
  }).join("");
  $$(".history-card").forEach(btn=>btn.addEventListener("click",()=>openHistory(Number(btn.dataset.historyId))));
}

function openHistory(jid){
  const j=journeys.find(x=>x.id===jid);
  if(!j) return;

  const ms=journeyMatches(j.id);
  const p1=memberBySlot(1),p2=memberBySlot(2);
  const s1=p1?scoreUserJourney(p1.user_id,j):{correct:0,resolved:0};
  const s2=p2?scoreUserJourney(p2.user_id,j):{correct:0,resolved:0};
  const historyWinnerSide=!p1||!p2?"tie":s1.correct>s2.correct?"one":s2.correct>s1.correct?"two":"tie";
  const e1=p1?scoreElige8(p1.user_id,j):{selected:0,correct:0,resolved:0};
  const e2=p2?scoreElige8(p2.user_id,j):{selected:0,correct:0,resolved:0};
  const jointE8Score=scoreJointElige8(j);
  const jointE8=jointE8Score.selected;
  const e1Prize=e1.selected===8&&e1.resolved===8&&e1.correct===8;
  const e2Prize=e2.selected===8&&e2.resolved===8&&e2.correct===8;
  const jointE8Prize=jointE8Score.selected===8&&jointE8Score.resolved===8&&jointE8Score.correct===8;

  $("#historyDialogTitle").textContent=`Jornada ${j.number} · ${formatDate(j.draw_date)}`;

  $("#historyDialogSummary").innerHTML=`
    <div class="history-summary-player player-one ${historyWinnerSide==="one"?"history-summary-winner":""}">
      <span>${escapeHtml(p1?.display_name||"Jugador 1")}</span>
      <strong>${s1.correct}/15</strong>
      <small class="${e1Prize?"e8-prize-inline":""}">★ Elige 8 · ${e1.selected?`${e1.correct}/${e1.selected}`:"—"}</small>
    </div>
    <div class="history-summary-player player-two ${historyWinnerSide==="two"?"history-summary-winner":""}">
      <span>${escapeHtml(p2?.display_name||"Jugador 2")}</span>
      <strong>${s2.correct}/15</strong>
      <small class="${e2Prize?"e8-prize-inline":""}">★ Elige 8 · ${e2.selected?`${e2.correct}/${e2.selected}`:"—"}</small>
    </div>
    <div class="history-summary-joint ${jointE8Prize?"e8-prize-zone":""}">
      <span>Elige 8 conjunto</span>
      <strong>${jointE8Score.resolved?`${jointE8Score.correct}/8`:`${jointE8}/8`}</strong>
    </div>`;

  $("#historyDialogBody").innerHTML=ms.map(m=>{
    const a=p1?displayPickForJourney(p1.user_id,j.id,m.number):"—";
    const b=p2?displayPickForJourney(p2.user_id,j.id,m.number):"—";
    const r=actualResultForMatch(m);
    const exactScore=m.home_score!=null&&m.away_score!=null?`${m.home_score}–${m.away_score}`:"—";
    const resultSign=m.number<=14?r:"";
    const e8a=Boolean(p1&&m.number<=14&&allElige8.some(e=>e.user_id===p1.user_id&&e.journey_id===j.id&&e.match_number===m.number));
    const e8b=Boolean(p2&&m.number<=14&&allElige8.some(e=>e.user_id===p2.user_id&&e.journey_id===j.id&&e.match_number===m.number));
    const e8j=Boolean(m.number<=14&&allJointElige8.some(e=>e.journey_id===j.id&&e.match_number===m.number));
    const ca=r==="—"?"":a===r?"ok":"bad";
    const cb=r==="—"?"":b===r?"ok":"bad";
    return `<article class="history-detail-match" data-history-jid="${j.id}" data-history-match="${m.number}">
      <div class="history-detail-head">
        <div class="history-match-meta"><span class="history-match-number">${m.number===15?"P15":String(m.number).padStart(2,"0")}</span>${matchCompetitionBadgeHtml(m)}</div>
        <div class="history-detail-fixture">${historyFixtureHtml(m)}</div>
        <div class="history-real-result">
          <span>Resultado</span>
          <strong>${exactScore}</strong>
          ${resultSign?`<small>Signo ${resultSign}</small>`:""}
        </div>
      </div>
      <div class="history-detail-picks">
        <div class="history-player-pick player-one ${ca}">
          <div><i></i><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span>${e8a?'<b>★ E8</b>':""}</div>
          <strong>${a}</strong>
        </div>
        <div class="history-player-pick player-two ${cb}">
          <div><i></i><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span>${e8b?'<b>★ E8</b>':""}</div>
          <strong>${b}</strong>
        </div>
      </div>
      ${e8j?'<div class="history-joint-e8">★ Elige 8 conjunto</div>':""}
    </article>`;
  }).join("");

  $$("#historyDialogBody .history-detail-match").forEach(card=>card.addEventListener("click",()=>openMatchDetail(Number(card.dataset.historyMatch),Number(card.dataset.historyJid))));
  $("#historyDialog").showModal();
}

function subscribeRealtime(){
  if(channel)sb.removeChannel(channel);
  channel=sb.channel(`room-${roomId}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"picks",filter:`room_id=eq.${roomId}`},async()=>{await Promise.all([loadAllPicks(),loadJourneySummaries()]);picks=allPicks.filter(p=>p.journey_id===journey.id);renderAll();setSync("online","Sincronizado")})
    .on("postgres_changes",{event:"*",schema:"public",table:"elige8_selections",filter:`room_id=eq.${roomId}`},async()=>{await loadAllElige8();renderAll();setSync("online","Sincronizado")})
    .on("postgres_changes",{event:"*",schema:"public",table:"joint_picks",filter:`room_id=eq.${roomId}`},async()=>{await loadAllJointPicks();renderJoint();setSync("online","Sincronizado")})
    .on("postgres_changes",{event:"*",schema:"public",table:"joint_elige8_selections",filter:`room_id=eq.${roomId}`},async()=>{await Promise.all([loadAllJointElige8(),loadJourneySummaries()]);renderJoint();setSync("online","Sincronizado")})
    .on("postgres_changes",{event:"*",schema:"public",table:"room_wallets",filter:`room_id=eq.${roomId}`},async()=>{await loadWalletData();renderGlobalWallet();renderJoint()})
    .on("postgres_changes",{event:"*",schema:"public",table:"wallet_transactions",filter:`room_id=eq.${roomId}`},async()=>{await loadWalletData();renderGlobalWallet();renderJoint()})
    .on("postgres_changes",{event:"*",schema:"public",table:"bet_confirmations",filter:`room_id=eq.${roomId}`},async()=>{await loadWalletData();renderAll()})
    .on("postgres_changes",{event:"*",schema:"public",table:"members",filter:`room_id=eq.${roomId}`},async()=>{await loadMembers();renderAll()})
    .on("postgres_changes",{event:"*",schema:"public",table:"journeys"},async()=>{const oldMax=Math.max(0,...journeys.map(j=>j.number));await loadAllJourneys();await loadAllPicks();selectActiveJourney();const newMax=Math.max(0,...journeys.map(j=>j.number));renderAll();if(newMax>oldMax)toast(`Nueva jornada: ${newMax}`)})
    .on("postgres_changes",{event:"*",schema:"public",table:"matches"},async()=>{await loadAllJourneys();await Promise.all([loadAllPicks(),loadJourneySummaries()]);selectActiveJourney();renderAll()})
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
      .eq("user_id",identityUserId)
      .select("room_id,user_id,slot,display_name")
      .single();
    if(error) throw error;
    myMember=data;
    const idx=members.findIndex(m=>m.user_id===identityUserId);
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

$$("#quinielaTabs .tab").forEach(tab=>tab.addEventListener("click",()=>activateView(tab.dataset.view)));
$$(".match-filter").forEach(btn=>btn.addEventListener("click",()=>setMatchFilter(btn.dataset.matchFilter)));
$("#createRoomBtn")?.addEventListener("click",createRoom);
$("#joinRoomBtn").addEventListener("click",joinRoom);
$("#roomCodeInput")?.addEventListener("input",e=>e.target.value=UNIQUE_ROOM_CODE);
$("#openRoomBtn").addEventListener("click",openRoomDialog);
$("#walletBtn")?.addEventListener("click",openWalletDialog);
$("#closeWalletDialog")?.addEventListener("click",()=>$("#walletDialog")?.close());
$("#walletDialog")?.addEventListener("click",e=>{if(e.target===$("#walletDialog"))$("#walletDialog").close()});
$("#closeRoomDialog").addEventListener("click",()=>$("#roomDialog").close());
$("#closeHistoryDialog")?.addEventListener("click",()=>$("#historyDialog")?.close());
$("#historyDialog")?.addEventListener("click",e=>{if(e.target===$("#historyDialog"))$("#historyDialog").close()});
$("#shareBtn").addEventListener("click",shareRoom);
$("#generateDeviceLinkBtn")?.addEventListener("click",generateDeviceLink);
$("#copyDeviceLinkBtn")?.addEventListener("click",copyDeviceLink);
$("#shareDeviceLinkBtn")?.addEventListener("click",shareDeviceLink);
$("#notificationBtn").addEventListener("click",openNotificationCenter);
$("#closeNotificationDialog").addEventListener("click",()=>$("#notificationDialog").close());
$("#enableNotificationsBtn").addEventListener("click",requestNotifications);
$("#closeMatchDetailDialog").addEventListener("click",()=>$("#matchDetailDialog").close());

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
function scorerLabel(g){
  const name=String(g?.name||"").trim();
  if(!name) return "";
  const time=Number(g?.time);
  const added=Number(g?.added_time);
  const minute=Number.isFinite(time)?`${time}${Number.isFinite(added)&&added>0?`+${added}`:""}'`:"";
  const kind=String(g?.kind||"").toLowerCase();
  const extra=kind.includes("penalty")?" (p.)":kind.includes("own")?" (p.p.)":"";
  return `${name}${extra}${minute?` ${minute}`:""}`;
}
function liveScorersForSide(m,home){
  const scorers=Array.isArray(m?.live_scorers)?m.live_scorers:[];
  return scorers.filter(g=>Boolean(g?.home)===home).map(scorerLabel).filter(Boolean);
}
function liveScorersText(m){
  return [...liveScorersForSide(m,true),...liveScorersForSide(m,false)].join(" · ");
}
function scorerTeamName(name){
  return String(name||"")
    .replace(/\s+\d+\s*-\s*\d+\s*$/,"")
    .replace(/\s*\([MF]\)\s*$/i,"")
    .trim();
}
function buildScorerGroupsNode(m){
  const home=liveScorersForSide(m,true);
  const away=liveScorersForSide(m,false);
  if(!home.length&&!away.length) return null;
  const wrap=document.createElement("div");
  wrap.className="live-scorers-groups";
  [[m.home,home,"home"],[m.away,away,"away"]].forEach(([team,goals,side])=>{
    const row=document.createElement("div");
    row.className="live-scorer-row "+side;
    const teamEl=document.createElement("strong");
    teamEl.className="live-scorer-team";
    teamEl.textContent="⚽ "+scorerTeamName(team);
    const goalsEl=document.createElement("span");
    goalsEl.className="live-scorer-goals";
    goalsEl.textContent=goals.length?goals.join(" · "):"—";
    row.appendChild(teamEl);
    row.appendChild(goalsEl);
    wrap.appendChild(row);
  });
  return wrap;
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
    var scorerGroups=buildScorerGroupsNode(m);
    if(scorerGroups) bar.appendChild(scorerGroups);
    if(m.live_status==="inprogress"){
      var freshness=document.createElement("small");
      freshness.className="live-freshness";
      freshness.dataset.liveUpdated=m.live_updated_at||"";
      bar.appendChild(freshness);
    }
  });
}
function appendScorersToMatchCards(){
  var normal=matches.filter(function(m){return m.number<=14;});
  var cards=$$(".match-card");
  normal.forEach(function(m,i){
    if(!cards[i]) return;
    var bar=cards[i].querySelector(".match-result-bar");
    if(!bar || bar.querySelector(".live-scorers-groups")) return;
    var groups=buildScorerGroupsNode(m);
    if(groups) bar.appendChild(groups);
  });
}
function appendScorersToPleno(){
  var m=matches.find(function(x){return x.number===15;});
  if(!m) return;
  var groups=buildScorerGroupsNode(m);
  if(!groups) return;
  var target=matchResolved(m)?$("#plenoResult"):$("#plenoTv .pleno-live-score");
  if(!target) target=$("#plenoTv");
  if(!target || target.querySelector(".live-scorers-groups")) return;
  groups.classList.add("pleno-scorers-groups");
  target.appendChild(groups);
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
  if(m.live_status==="inprogress"){
    var freshness=document.createElement("small");
    freshness.className="live-freshness pleno-live-freshness";
    freshness.dataset.liveUpdated=m.live_updated_at||"";
    box.appendChild(freshness);
  }
  el.appendChild(box);
}
function decorateLiveCompare(){
  var cards=$$(".compare-card");
  matches.forEach(function(m,i){
    if(!hasLiveMatch(m) || !cards[i] || m.live_status!=="inprogress") return;
    var card=cards[i];
    var box=card.querySelector(".compare-pick-box.result-box");
    if(!box || box.querySelector(".live-freshness")) return;
    var freshness=document.createElement("small");
    freshness.className="live-freshness compare-live-freshness";
    freshness.dataset.liveUpdated=m.live_updated_at||"";
    box.appendChild(freshness);
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
  appendScorersToMatchCards();
  updateLiveFreshness();
};
var __renderPlenoLiveBase=renderPleno;
renderPleno=function(){
  __renderPlenoLiveBase();
  decorateLivePleno();
  appendScorersToPleno();
  updateLiveFreshness();
};
var __renderCompareLiveBase=renderCompare;
renderCompare=function(){
  __renderCompareLiveBase();
  decorateLiveCompare();
  updateLiveFreshness();
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
  if(m.live_status==="inprogress"){
    var freshness=document.createElement("small");
    freshness.className="live-freshness detail-live-freshness";
    freshness.dataset.liveUpdated=m.live_updated_at||"";
    score.appendChild(freshness);
    updateLiveFreshness();
  }
};
