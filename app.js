import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const cfg = window.QUINIELA_CONFIG || {};
const configured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("TU-PROYECTO") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("TU_CLAVE");

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let sb, user, roomId, roomCode, myMember, journey, matches = [], members = [], picks = [], journeys = [], allMatches = [], allPicks = [], allElige8 = [];
let channel = null;
let saving = false;
let elige8Saving = false;
let selectedJourneyId = null;

const escapeHtml = (str="") => str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const TEAM_DOMAINS={"CEUTA":"adceutafc.com","REAL SOCIEDAD":"realsociedad.eus","REAL SOCIEDAD B":"realsociedad.eus","GRANADA":"granadacf.es","ANDORRA":"fcandorra.com","CELTA":"rccelta.es","CELTA FORTUNA":"rccelta.es","SABADELL":"cesabadellfc.com","TENERIFE":"clubdeportivotenerife.es","CADIZ":"cadizcf.com","REAL VALLADOLID":"realvalladolid.es","CORDOBA":"cordobacf.com","MALLORCA":"rcdmallorca.es","ALMERIA":"udalmeriasad.com","BURGOS":"burgoscf.es","ELDENSE":"cdeldense.es","EIBAR":"sdeibar.com","LAS PALMAS":"udlaspalmas.es","REAL OVIEDO":"realoviedo.es","SPORTING":"realsporting.com","LEGANES":"cdleganes.com","CASTELLON":"cdcastellon.com","ATHLETIC CLUB":"athletic-club.eus","AT MADRID":"atleticodemadrid.com","ATLETICO MADRID":"atleticodemadrid.com","VALENCIA":"valenciacf.com","SEVILLA":"sevillafc.es","DEPORTIVO":"rcdeportivo.es","ESPANYOL":"rcdespanyol.com","REAL MADRID":"realmadrid.com","BARCELONA":"fcbarcelona.com","VILLARREAL":"villarrealcf.es","BETIS":"realbetisbalompie.es","REAL BETIS":"realbetisbalompie.es","RAYO VALLECANO":"rayovallecano.es","GETAFE":"getafecf.com","ALAVES":"deportivoalaves.com","GIRONA":"gironafc.cat","OSASUNA":"osasuna.es","LEVANTE":"levanteud.com","ELCHE":"elchecf.es","RACING":"realracingclub.es","RACING SANTANDER":"realracingclub.es","MALAGA":"malagacf.com","HUESCA":"sdhuesca.es","ZARAGOZA":"realzaragoza.com","ALBACETE":"albacetebalompie.es","MIRANDES":"cdmirandes.com"};
const TEAM_FLAGS={"ESPANA":"🇪🇸","INGLATERRA":"🏴","FRANCIA":"🇫🇷","ITALIA":"🇮🇹","ALEMANIA":"🇩🇪","PORTUGAL":"🇵🇹"};
function normalizeTeamName(name=""){const c=String(name).replace(/\s*\([MF]\)\s*$/i,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\./g,"").replace(/\s+/g," ").trim();return ({"R VALLADOLID":"REAL VALLADOLID","R OVIEDO":"REAL OVIEDO","ATLETICO DE MADRID":"ATLETICO MADRID","RC DEPORTIVO":"DEPORTIVO","UD LAS PALMAS":"LAS PALMAS","CD LEGANES":"LEGANES"})[c]||c}
function teamInitials(name=""){const p=normalizeTeamName(name).replace(/\b(CLUB|FUTBOL|FOOTBALL|CF|FC|CD|UD|SAD)\b/g,"").trim().split(/\s+/).filter(Boolean);return p.length===1?p[0].slice(0,2):(p[0][0]+p[1][0]).slice(0,2)}
function teamCrestHtml(name,size=""){const k=normalizeTeamName(name),flag=TEAM_FLAGS[k],label=escapeHtml(String(name).replace(/\s*\([MF]\)\s*$/i,""));if(flag)return `<span class="team-crest ${size} flag-crest" title="${label}">${flag}</span>`;const d=TEAM_DOMAINS[k],ini=escapeHtml(teamInitials(name));if(!d)return `<span class="team-crest ${size} fallback-only" title="${label}"><span class="crest-fallback">${ini}</span></span>`;const src=`https://www.google.com/s2/favicons?domain_url=https://${encodeURIComponent(d)}&sz=128`;return `<span class="team-crest ${size}" title="${label}"><span class="crest-fallback">${ini}</span><img class="team-crest-img" src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></span>`}
function teamInlineHtml(name){return `<span class="team-inline">${teamCrestHtml(name,"sm")}<span>${escapeHtml(name)}</span></span>`}
function fixtureMiniHtml(m){return `<span class="fixture-mini"><span class="fixture-mini-team">${teamCrestHtml(m.home,"xs")}<span>${escapeHtml(m.home)}</span></span><span class="fixture-mini-sep">–</span><span class="fixture-mini-team">${teamCrestHtml(m.away,"xs")}<span>${escapeHtml(m.away)}</span></span></span>`}
function tvBroadcastHtml(m,compact=false){
  const channels=Array.isArray(m?.tv_channels)?m.tv_channels.filter(Boolean):[];
  const cls=compact?"tv-broadcast compact":"tv-broadcast";
  if(!channels.length){
    return `<div class="${cls} pending-tv"><span class="tv-icon" aria-hidden="true">▣</span><span class="tv-title">TV</span><span class="tv-pending">Por confirmar</span></div>`;
  }
  return `<div class="${cls}"><span class="tv-icon" aria-hidden="true">▣</span><span class="tv-title">TV</span><div class="tv-channels">${channels.map(ch=>`<span class="tv-channel">${escapeHtml(ch)}</span>`).join("")}</div></div>`;
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
  $("#roomCode").textContent=roomCode;
  $("#myName").textContent=myMember.display_name;
  setSync("","Cargando");
  await Promise.all([loadAllJourneys(), loadMembers()]);
  await Promise.all([loadAllPicks(), loadAllElige8()]);
  selectActiveJourney();
  renderAll();
  subscribeRealtime();
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

async function refreshData(){
  await Promise.all([loadAllJourneys(), loadMembers(), loadAllPicks(), loadAllElige8()]);
  selectActiveJourney();
  renderAll();
}

function renderAll(){
  $("#roomCode").textContent=roomCode;
  const roomMembers=$("#roomMembers");
  if(roomMembers){
    const ordered=[...members].sort((a,b)=>a.slot-b.slot).map(m=>m.display_name).filter(Boolean);
    roomMembers.textContent=ordered.length?ordered.join(" · "):"Vosotros dos";
  }
  $("#myName").textContent=myMember?.display_name||"Tú";
  $("#journeyNumber").textContent=`Jornada ${journey.number}`;
  $("#journeyDate").textContent=formatDate(journey.draw_date);

  const state=journeyDisplayState(journey);
  const resolved=journeyResolvedCount(journey);
  const statusLabels={
    open:"Abierta para pronósticos",
    playing:`En juego · ${resolved}/15 resultados`,
    closed:"Cerrada · esperando partidos",
    finished:"Finalizada · 15/15 resultados"
  };
  $(".status-text").textContent=statusLabels[state]||"Jornada";
  const kicker=$(".journey-kicker");
  if(kicker) kicker.textContent=state==="playing"?"SEGUIMIENTO DE RESULTADOS":state==="open"?"PRÓXIMA JORNADA":state==="finished"?"JORNADA FINALIZADA":"JORNADA CERRADA";
  const journeyCard=$("#journeyCard");
  if(journeyCard) journeyCard.dataset.status=state;

  const opponent=members.find(m=>m.user_id!==user.id);
  if(opponent){
    const completed=completedCountForUser(opponent.user_id);
    $("#opponentStatus").textContent=completed===15
      ? `✓ ${opponent.display_name} ha completado la jornada`
      : `${opponent.display_name}: ${completed}/15 completados`;
  }else{
    $("#opponentStatus").textContent="Esperando al segundo jugador";
  }

  renderJourneySwitcher();
  renderMatches(); renderPleno(); renderProgress(); renderElige8Progress(); renderCompare(); renderHistory();
  maybeCelebrateBothComplete();
}

function renderMatches(){
  const normal=matches.filter(m=>m.number<=14);
  const locked=journey.status!=="open";
  const myE8Count=elige8Count(user.id);
  $("#matches").innerHTML=normal.map(m=>{
    const mp=myPickFor(m.number);
    const e8=isElige8(user.id,m.number);
    const e8Disabled=locked || elige8Saving || (myE8Count>=8 && !e8);
    const resultHtml=resultBarHtml(m,mp);
    return `<article class="match-card ${e8?"e8-active":""} ${matchResolved(m)?"has-result":""}">
      <div class="match-card-head">
        <div class="match-number-wrap"><span class="match-index">${String(m.number).padStart(2,"0")}</span><span class="match-label">PARTIDO</span></div>
        <div class="match-head-actions"><span class="kickoff ${m.kickoff?"":"pending-time"}">◷ ${escapeHtml(formatKickoff(m.kickoff))}</span><button class="e8-toggle ${e8?"selected":""}" data-e8-match="${m.number}" ${e8Disabled?"disabled":""} type="button"><span>★</span> ${e8?"E8":"Elige 8"}</button></div>
      </div>
      <div class="fixture-teams">
        <div class="fixture-team home-team">${teamCrestHtml(m.home)}<div><small>LOCAL</small><strong>${escapeHtml(m.home)}</strong></div></div>
        ${matchResolved(m)
          ? `<span class="fixture-score" aria-label="Resultado final ${m.home_score} a ${m.away_score}"><small>FINAL</small><strong>${m.home_score}<b>–</b>${m.away_score}</strong></span>`
          : `<span class="fixture-vs" aria-hidden="true">VS</span>`}
        <div class="fixture-team away-team">${teamCrestHtml(m.away)}<div><small>VISITANTE</small><strong>${escapeHtml(m.away)}</strong></div></div>
      </div>
      ${matchResolved(m)?"":tvBroadcastHtml(m)}
      <div class="pick-row">${["1","X","2"].map(v=>`<button class="pick ${mp?.pick===v?"selected":""}" data-match="${m.number}" data-pick="${v}" ${locked?"disabled":""}><span>${v}</span><small>${v==="1"?"Local":v==="X"?"Empate":"Visitante"}</small></button>`).join("")}</div>
      ${resultHtml}
    </article>`;
  }).join("");
  $$(".pick").forEach(b=>b.addEventListener("click",()=>saveNormalPick(Number(b.dataset.match),b.dataset.pick)));
  $$(".e8-toggle").forEach(b=>b.addEventListener("click",()=>toggleElige8(Number(b.dataset.e8Match))));
}

function renderPleno(){
  const m=matches.find(x=>x.number===15);
  if(!m){ $("#plenoCard").classList.add("hidden"); return; }
  $("#plenoCard").classList.remove("hidden");
  $("#plenoHomeName").textContent=m.home; $("#plenoAwayName").textContent=m.away;
  $("#plenoHomeLabel").innerHTML=teamInlineHtml(m.home); $("#plenoAwayLabel").innerHTML=teamInlineHtml(m.away);
  $("#plenoKickoff").textContent=`◷ ${formatKickoff(m.kickoff)}`;
  $("#plenoKickoff").classList.toggle("pending-time",!m.kickoff);
  const plenoTv=$("#plenoTv");
  if(plenoTv){
    plenoTv.innerHTML=matchResolved(m)
      ? `<div class="pleno-final-score"><small>RESULTADO FINAL</small><strong>${m.home_score}<b>–</b>${m.away_score}</strong></div>`
      : tvBroadcastHtml(m);
  }
  const mp=myPickFor(15);
  const locked=journey.status!=="open";
  $$(".goal-options").forEach(row=>{
    const team=row.dataset.team;
    const selected=team==="home"?mp?.home_goals:mp?.away_goals;
    row.innerHTML=["0","1","2","M"].map(v=>`<button class="goal ${selected===v?"selected":""}" data-team="${team}" data-goal="${v}" ${locked?"disabled":""}>${v}</button>`).join("");
  });
  const resultEl=$("#plenoResult");
  const resultHtml=resultBarHtml(m,mp);
  resultEl.className="match-result-bar";
  if(resultHtml){
    const wrapper=document.createElement("div");
    wrapper.innerHTML=resultHtml;
    resultEl.className=wrapper.firstElementChild.className;
    resultEl.innerHTML=wrapper.firstElementChild.innerHTML;
  }else{
    resultEl.classList.add("hidden");
    resultEl.innerHTML="";
  }
  $$(".goal").forEach(b=>b.addEventListener("click",()=>savePleno(b.dataset.team,b.dataset.goal)));
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
      ${tvBroadcastHtml(m,true)}
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
  const historic=journeys
    .filter(j=>journeyResolvedCount(j)===15)
    .sort((a,b)=>b.number-a.number);
  $("#historyCount").textContent=historic.length;
  if(!historic.length){
    $("#historyList").innerHTML=`<div class="history-empty">Todavía no hay jornadas con los 15 resultados oficiales. Las jornadas en juego se mantienen arriba hasta completarse.</div>`;
    return;
  }
  const p1=memberBySlot(1), p2=memberBySlot(2);
  $("#historyList").innerHTML=historic.map(j=>{
    const s1=p1?scoreUserJourney(p1.user_id,j):{correct:0,resolved:0};
    const s2=p2?scoreUserJourney(p2.user_id,j):{correct:0,resolved:0};
    const stat1=s1.resolved?`${s1.correct}/${s1.resolved}`:"Sin resultado";
    const stat2=s2.resolved?`${s2.correct}/${s2.resolved}`:"Sin resultado";
    const e1=p1?scoreElige8(p1.user_id,j):{selected:0,correct:0,resolved:0};
    const e2=p2?scoreElige8(p2.user_id,j):{selected:0,correct:0,resolved:0};
    const e8stat1=e1.selected?`E8: ${e1.correct}/${e1.resolved} aciertos`:"E8: —";
    const e8stat2=e2.selected?`E8: ${e2.correct}/${e2.resolved} aciertos`:"E8: —";
    return `<button class="history-card" data-history-id="${j.id}">
      <div class="history-card-top"><div><div class="history-card-title">Jornada ${j.number}</div><div class="history-card-date">${escapeHtml(formatDate(j.draw_date))}</div></div><span class="history-card-badge finished">Finalizada · 15/15</span></div>
      <div class="history-card-stats"><div class="history-stat"><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${stat1}</strong><small>${e8stat1}</small></div><div class="history-stat"><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span><strong>${stat2}</strong><small>${e8stat2}</small></div></div>
    </button>`;
  }).join("");
  $$(".history-card").forEach(btn=>btn.addEventListener("click",()=>openHistory(Number(btn.dataset.historyId))));
}

function openHistory(jid){
  const j=journeys.find(x=>x.id===jid);
  if(!j) return;
  const ms=journeyMatches(j.id);
  const p1=memberBySlot(1),p2=memberBySlot(2);
  $("#historyDialogTitle").textContent=`Jornada ${j.number} · ${formatDate(j.draw_date)}`;
  $("#historyP1").textContent=p1?.display_name||"Jugador 1";
  $("#historyP2").textContent=p2?.display_name||"Jugador 2";

  const s1=p1?scoreUserJourney(p1.user_id,j):{correct:0,resolved:0};
  const s2=p2?scoreUserJourney(p2.user_id,j):{correct:0,resolved:0};
  const pills=[];
  if(s1.resolved) pills.push(`<span class="summary-pill">${escapeHtml(p1?.display_name||"Jugador 1")}: ${s1.correct}/${s1.resolved}</span>`);
  if(s2.resolved) pills.push(`<span class="summary-pill">${escapeHtml(p2?.display_name||"Jugador 2")}: ${s2.correct}/${s2.resolved}</span>`);
  const he1=p1?scoreElige8(p1.user_id,j):{selected:0,correct:0,resolved:0};
  const he2=p2?scoreElige8(p2.user_id,j):{selected:0,correct:0,resolved:0};
  if(he1.selected) pills.push(`<span class="summary-pill e8-summary-pill">${escapeHtml(p1?.display_name||"Jugador 1")} E8: ${he1.correct}/${he1.resolved}</span>`);
  if(he2.selected) pills.push(`<span class="summary-pill e8-summary-pill">${escapeHtml(p2?.display_name||"Jugador 2")} E8: ${he2.correct}/${he2.resolved}</span>`);
  if(!pills.length) pills.push(`<span class="summary-pill">Resultados pendientes</span>`);
  $("#historyDialogSummary").innerHTML=pills.join("");

  $("#historyDialogBody").innerHTML=ms.map(m=>{
    const a=p1?displayPickForJourney(p1.user_id,j.id,m.number):"—";
    const b=p2?displayPickForJourney(p2.user_id,j.id,m.number):"—";
    const r=actualResultForMatch(m);
    const ca=r==="—"?"":a===r?"result-ok":"result-bad";
    const cb=r==="—"?"":b===r?"result-ok":"result-bad";
    return `<tr>
      <td><span class="history-match-number">${m.number===15?"P15":m.number}</span>${fixtureMiniHtml(m)}</td>
      <td class="${a==="—"?"missing":ca}">${a}</td>
      <td class="${b==="—"?"missing":cb}">${b}</td>
      <td class="${r==="—"?"result-pending":""}">${r}</td>
    </tr>`;
  }).join("");
  $("#historyDialog").showModal();
}

$("#closeHistoryDialog").addEventListener("click",()=>$("#historyDialog").close());

function subscribeRealtime(){
  if(channel) sb.removeChannel(channel);
  channel=sb.channel(`room-${roomId}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"picks",filter:`room_id=eq.${roomId}`},async()=>{
      await loadAllPicks();
      picks=allPicks.filter(p=>p.journey_id===journey.id);
      renderProgress(); renderCompare(); renderHistory();
      if(!saving){renderMatches();renderPleno();}
      setSync("online","Sincronizado");
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"elige8_selections",filter:`room_id=eq.${roomId}`},async()=>{
      await loadAllElige8();
      renderElige8Progress(); renderMatches(); renderCompare(); renderHistory();
      setSync("online","Sincronizado");
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"members",filter:`room_id=eq.${roomId}`},async()=>{
      await loadMembers(); renderAll();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"journeys"},async()=>{
      const oldJourneyId=journey?.id;
      await loadAllJourneys();
      await loadAllPicks();
      selectActiveJourney();
      renderAll();
      if(oldJourneyId && oldJourneyId!==journey.id) toast(`Nueva jornada: ${journey.number}`);
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"matches"},async()=>{
      await loadAllJourneys();
      await loadAllPicks();
      selectActiveJourney();
      renderAll();
    })
    .subscribe(status=>{
      if(status==="SUBSCRIBED") setSync("online","Sincronizado");
      else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT") setSync("error","Sin conexión");
    });
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

$$(".tab").forEach(tab=>tab.addEventListener("click",()=>{
  $$(".tab").forEach(t=>t.classList.toggle("active",t===tab));
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#"+tab.dataset.view+"View").classList.add("active");
  if(tab.dataset.view==="compare") renderCompare();
  if(tab.dataset.view==="history") renderHistory();
}));
$("#createRoomBtn").addEventListener("click",createRoom);
$("#joinRoomBtn").addEventListener("click",joinRoom);
$("#roomCodeInput").addEventListener("input",e=>e.target.value=cleanCode(e.target.value));
$("#shareBtn").addEventListener("click",shareRoom);
$("#renameBtn").addEventListener("click",openRenameDialog);
$("#closeRenameDialog").addEventListener("click",()=>$("#renameDialog").close());
$("#renameForm").addEventListener("submit",saveRename);

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
