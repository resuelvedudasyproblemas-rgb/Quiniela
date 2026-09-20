import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.QUINIELA_CONFIG || {};
const configured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("TU-PROYECTO") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("TU_CLAVE");

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let sb, user, roomId, roomCode, myMember, journey, matches = [], members = [], picks = [], journeys = [], allMatches = [], allPicks = [];
let channel = null;
let saving = false;

const escapeHtml = (str="") => str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function show(id) {
  ["boot","setupMissing","onboarding","app"].forEach(x => $("#"+x).classList.toggle("hidden", x !== id));
}

function toast(msg) {
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove("show"),1800);
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
  if(!v) return "";
  return new Intl.DateTimeFormat("es-ES",{weekday:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
}
function nameFor(uid, fallback){
  return members.find(m=>m.user_id===uid)?.display_name || fallback;
}
function memberBySlot(slot){ return members.find(m=>m.slot===slot); }
function myPickFor(n){ return picks.find(p=>p.user_id===user.id && p.match_number===n); }
function pickFor(uid,n){ return picks.find(p=>p.user_id===uid && p.match_number===n); }

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
    $(".setup-card p").innerHTML=`No se pudo conectar. Revisa <strong>SETUP.md</strong> y la configuración de Supabase.<br><br><small>${escapeHtml(err.message||String(err))}</small>`;
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
  await loadAllPicks();
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
  const open=journeys.find(j=>j.status==="open");
  journey=open||journeys[0];
  matches=allMatches.filter(m=>m.journey_id===journey.id).sort((a,b)=>a.number-b.number);
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

async function refreshData(){
  await Promise.all([loadAllJourneys(), loadMembers(), loadAllPicks()]);
  selectActiveJourney();
  renderAll();
}

function renderAll(){
  $("#roomCode").textContent=roomCode;
  $("#myName").textContent=myMember?.display_name||"Tú";
  $("#journeyNumber").textContent=`Jornada ${journey.number}`;
  $("#journeyDate").textContent=formatDate(journey.draw_date);
  const opponent=members.find(m=>m.user_id!==user.id);
  $("#opponentStatus").textContent=opponent?`${opponent.display_name} ya está en la sala`:"Esperando al segundo jugador";
  renderMatches(); renderPleno(); renderProgress(); renderCompare(); renderHistory();
}

function renderMatches(){
  const normal=matches.filter(m=>m.number<=14);
  $("#matches").innerHTML=normal.map(m=>{
    const mp=myPickFor(m.number);
    return `<article class="match-card">
      <div class="match-index">${m.number}</div>
      <div class="match-main">
        <div class="match-top">
          <div class="teams">${escapeHtml(m.home)} <span style="color:#93a099;font-weight:500">—</span> ${escapeHtml(m.away)}</div>
          <div class="kickoff">${escapeHtml(formatKickoff(m.kickoff))}</div>
        </div>
        <div class="pick-row">
          ${["1","X","2"].map(v=>`<button class="pick ${mp?.pick===v?"selected":""}" data-match="${m.number}" data-pick="${v}">${v}</button>`).join("")}
        </div>
      </div>
    </article>`;
  }).join("");
  $$(".pick").forEach(b=>b.addEventListener("click",()=>saveNormalPick(Number(b.dataset.match),b.dataset.pick)));
}

function renderPleno(){
  const m=matches.find(x=>x.number===15);
  if(!m){ $("#plenoCard").classList.add("hidden"); return; }
  $("#plenoCard").classList.remove("hidden");
  $("#plenoHomeName").textContent=m.home; $("#plenoHomeLabel").textContent=m.home;
  $("#plenoAwayName").textContent=m.away; $("#plenoAwayLabel").textContent=m.away;
  const mp=myPickFor(15);
  $$(".goal-options").forEach(row=>{
    const team=row.dataset.team;
    const selected=team==="home"?mp?.home_goals:mp?.away_goals;
    row.innerHTML=["0","1","2","M"].map(v=>`<button class="goal ${selected===v?"selected":""}" data-team="${team}" data-goal="${v}">${v}</button>`).join("");
  });
  $$(".goal").forEach(b=>b.addEventListener("click",()=>savePleno(b.dataset.team,b.dataset.goal)));
}

async function saveNormalPick(n,val){
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
  $("#saveState").textContent=total===15?"✓ Completa":"En la nube";
}

function displayPick(p,n){
  if(!p) return "—";
  if(n===15) return p.home_goals&&p.away_goals?`${p.home_goals}-${p.away_goals}`:"—";
  return p.pick||"—";
}

function renderCompare(){
  const p1=memberBySlot(1),p2=memberBySlot(2);
  $("#compareP1").textContent=p1?.display_name||"Jugador 1";
  $("#compareP2").textContent=p2?.display_name||"Jugador 2";
  let same=0;
  $("#compareBody").innerHTML=matches.map(m=>{
    const a=displayPick(p1&&pickFor(p1.user_id,m.number),m.number);
    const b=displayPick(p2&&pickFor(p2.user_id,m.number),m.number);
    const eq=a!=="—"&&b!=="—"&&a===b; if(eq) same++;
    return `<tr>
      <td>${m.number===15?"P-15":m.number}. ${escapeHtml(m.home)} - ${escapeHtml(m.away)}</td>
      <td class="${a==="—"?"missing":eq?"same":""}">${a}</td>
      <td class="${b==="—"?"missing":eq?"same":""}">${b}</td>
    </tr>`;
  }).join("");
  $("#coincidences").textContent=`${same} / 15`;
  $("#compareSubtitle").textContent=p2?"se actualiza automáticamente":"Comparte el código para añadir al segundo jugador";
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

function renderHistory(){
  const historic=journeys.filter(j=>j.id!==journey.id).sort((a,b)=>b.number-a.number);
  $("#historyCount").textContent=historic.length;
  if(!historic.length){
    $("#historyList").innerHTML=`<div class="history-empty">Todavía no hay jornadas anteriores. En cuanto se cargue una nueva, la actual aparecerá aquí automáticamente.</div>`;
    return;
  }

  const p1=memberBySlot(1), p2=memberBySlot(2);
  $("#historyList").innerHTML=historic.map(j=>{
    const s1=p1?scoreUserJourney(p1.user_id,j):{correct:0,resolved:0};
    const s2=p2?scoreUserJourney(p2.user_id,j):{correct:0,resolved:0};
    const resolved=Math.max(s1.resolved,s2.resolved);
    const statusText=j.status==="finished"?"Finalizada":j.status==="closed"?"Cerrada":"Anterior";
    const stat1=s1.resolved?`${s1.correct}/${s1.resolved}`:"Sin resultado";
    const stat2=s2.resolved?`${s2.correct}/${s2.resolved}`:"Sin resultado";
    return `<button class="history-card" data-history-id="${j.id}">
      <div class="history-card-top">
        <div>
          <div class="history-card-title">Jornada ${j.number}</div>
          <div class="history-card-date">${escapeHtml(formatDate(j.draw_date))}</div>
        </div>
        <span class="history-card-badge ${j.status==="finished"?"finished":""}">${statusText}</span>
      </div>
      <div class="history-card-stats">
        <div class="history-stat"><span>${escapeHtml(p1?.display_name||"Jugador 1")}</span><strong>${stat1}</strong></div>
        <div class="history-stat"><span>${escapeHtml(p2?.display_name||"Jugador 2")}</span><strong>${stat2}</strong></div>
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
  $("#historyDialogTitle").textContent=`Jornada ${j.number} · ${formatDate(j.draw_date)}`;
  $("#historyP1").textContent=p1?.display_name||"Jugador 1";
  $("#historyP2").textContent=p2?.display_name||"Jugador 2";

  const s1=p1?scoreUserJourney(p1.user_id,j):{correct:0,resolved:0};
  const s2=p2?scoreUserJourney(p2.user_id,j):{correct:0,resolved:0};
  const pills=[];
  if(s1.resolved) pills.push(`<span class="summary-pill">${escapeHtml(p1?.display_name||"Jugador 1")}: ${s1.correct}/${s1.resolved}</span>`);
  if(s2.resolved) pills.push(`<span class="summary-pill">${escapeHtml(p2?.display_name||"Jugador 2")}: ${s2.correct}/${s2.resolved}</span>`);
  if(!pills.length) pills.push(`<span class="summary-pill">Resultados pendientes</span>`);
  $("#historyDialogSummary").innerHTML=pills.join("");

  $("#historyDialogBody").innerHTML=ms.map(m=>{
    const a=p1?displayPickForJourney(p1.user_id,j.id,m.number):"—";
    const b=p2?displayPickForJourney(p2.user_id,j.id,m.number):"—";
    const r=actualResultForMatch(m);
    const ca=r==="—"?"":a===r?"result-ok":"result-bad";
    const cb=r==="—"?"":b===r?"result-ok":"result-bad";
    return `<tr>
      <td>${m.number===15?"P-15":m.number}. ${escapeHtml(m.home)} - ${escapeHtml(m.away)}</td>
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
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(err => console.warn("Service Worker:", err));
  });
}
