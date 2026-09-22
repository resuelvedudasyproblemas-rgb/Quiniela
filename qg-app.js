import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const cfg=window.QUINIELA_CONFIG||{};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const GOALS=["0","1","2","M"];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let sb,roomId,identityUserId,members=[],journeys=[],allMatches=[],allPicks=[],allJoint=[];
let qgWalletBalance=0,qgWalletTransactions=[],qgBetConfirmations=[],qgBetSkips=[];
let journey=null,matches=[],selectedJourneyId=null,activeView="play",activeFilter="all",activeGame="quiniela";
let saving=false,jointSaving=false,channel=null,quinielaOpponentText="";
const drafts=new Map(),jointDrafts=new Map();
const qgLoadedJourneyIds=new Set();
let qgJourneySummaries=new Map();
let qgHistoryFullyLoaded=false;

function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function toast(msg){
  const el=$("#toast");if(!el)return;
  el.textContent=msg;el.classList.add("show");
  clearTimeout(window.__qgToast);window.__qgToast=setTimeout(()=>el.classList.remove("show"),1800);
}
function key(prefix){return identityUserId&&roomId?`${prefix}:${roomId}:${identityUserId}`:""}
function readPref(prefix,fallback=""){const k=key(prefix);return k?(localStorage.getItem(k)||fallback):fallback}
function savePref(prefix,value){const k=key(prefix);if(k)localStorage.setItem(k,String(value))}
function member(slot){return members.find(m=>m.slot===slot)}
function stripTeam(name=""){return String(name).replace(/\s*\([MF]\)\s*$/i,"").trim()}
function norm(name=""){return stripTeam(name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\./g,"").replace(/\s+/g," ").trim()}
const FLAGS={
  "ESPANA":"🇪🇸","INGLATERRA":"🏴","FRANCIA":"🇫🇷","ITALIA":"🇮🇹","ALEMANIA":"🇩🇪","PORTUGAL":"🇵🇹",
  "PAISES BAJOS":"🇳🇱","NORUEGA":"🇳🇴","DINAMARCA":"🇩🇰","BELGICA":"🇧🇪","TURQUIA":"🇹🇷",
  "SUECIA":"🇸🇪","RUMANIA":"🇷🇴"
};
const FLAG_IMAGES={
  "GALES":"https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/svg/1f3f4-e0067-e0062-e0077-e006c-e0073-e007f.svg"
};
function initials(name=""){
  const p=norm(name).replace(/\b(CLUB|FUTBOL|FOOTBALL|CF|FC|CD|UD|SAD|R)\b/g,"").trim().split(/\s+/).filter(Boolean);
  return p.length===1?p[0].slice(0,2):((p[0]?.[0]||"")+(p[1]?.[0]||"")).slice(0,2);
}
function sofaTeamLogoInfo(raw=""){
  const m=String(raw||"").trim().match(/(?:api|img)\.sofascore\.app\/api\/v1\/team\/(\d+)\/image/i);
  return m?{id:m[1]}:null;
}
function logoUrl(raw=""){
  const info=sofaTeamLogoInfo(raw);
  return info?`${cfg.SUPABASE_URL}/storage/v1/object/public/quiniela-web/logos/team/${info.id}.webp`:String(raw||"").trim();
}
function logoFallbackUrl(raw=""){
  const info=sofaTeamLogoInfo(raw);
  return info?`${cfg.SUPABASE_URL}/functions/v1/logo-proxy?kind=team&id=${info.id}&v=3`:String(raw||"").trim();
}
function competitionLogoUrl(raw=""){
  const m=String(raw).match(/(?:api|img)\.sofascore\.app\/api\/v1\/unique-tournament\/(\d+)\/image/i);
  return m?`${cfg.SUPABASE_URL}/storage/v1/object/public/quiniela-web/logos/tournament/${m[1]}.webp`:raw;
}
function competitionLogoFallback(raw=""){
  const m=String(raw).match(/(?:api|img)\.sofascore\.app\/api\/v1\/unique-tournament\/(\d+)\/image/i);
  return m?`${cfg.SUPABASE_URL}/functions/v1/logo-proxy?kind=tournament&id=${m[1]}`:raw;
}
function crest(name,url=""){
  const keyName=norm(name),direct=logoUrl(url),fallback=logoFallbackUrl(url),flag=FLAGS[keyName],flagImage=FLAG_IMAGES[keyName],label=esc(stripTeam(name));
  if(direct){
    return `<span class="team-crest xs" title="${label}"><span class="crest-fallback">${esc(initials(name))}</span><img class="team-crest-img high-quality" src="${esc(direct)}" data-logo-fallback="${esc(fallback)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="if(this.previousElementSibling)this.previousElementSibling.style.display='none'" onerror="const f=this.dataset.logoFallback;if(f&&this.src!==f){this.src=f}else this.remove()"></span>`;
  }
  if(flagImage)return `<span class="team-crest xs flag-crest qg-flag-image" title="${label}"><img src="${esc(flagImage)}" alt="${label}" loading="lazy" referrerpolicy="no-referrer"></span>`;
  if(flag)return `<span class="team-crest xs flag-crest" title="${label}">${flag}</span>`;
  return `<span class="team-crest xs fallback-only" title="${label}"><span class="crest-fallback">${esc(initials(name))}</span></span>`;
}
function pos(n){return Number.isInteger(Number(n))&&Number(n)>0?`<span class="team-position compact">${Number(n)}.º</span>`:""}
function teamHtml(name,url,p){return `${crest(name,url)}${pos(p)}<span>${esc(stripTeam(name))}</span>`}
function formatKickoff(v){
  if(!v)return "Horario pendiente";
  return new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",weekday:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(v)).replace(".","");
}
function tvHtml(m){
  const channels=Array.isArray(m?.tv_channels)?m.tv_channels.filter(Boolean):[];
  if(!channels.length)return `<div class="qg-tv-inline pending" title="TV · Por confirmar"><span class="qg-tv-icon" aria-hidden="true">▣</span><span class="qg-tv-text">Por confirmar</span></div>`;
  const clean=[...new Set(channels.map(ch=>String(ch).trim()).filter(Boolean))];
  const visible=clean.slice(0,2),extra=Math.max(0,clean.length-2);
  const text=visible.join(" · ")+(extra?` · +${extra}`:"");
  return `<div class="qg-tv-inline" title="TV · ${esc(clean.join(" · "))}"><span class="qg-tv-icon" aria-hidden="true">▣</span><span class="qg-tv-text">${esc(text)}</span></div>`;
}
function fullDate(v){
  if(!v)return "Fecha pendiente";
  return new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(v)).replace(","," ·");
}
function timeLeft(v){
  const diff=new Date(v).getTime()-Date.now();
  if(!Number.isFinite(diff)||diff<=0)return "Cerrado";
  const min=Math.max(1,Math.floor(diff/60000)),d=Math.floor(min/1440),h=Math.floor((min%1440)/60),m=min%60;
  return [d?`${d} d`:"",h||d?`${h} h`:"",`${m} min`].filter(Boolean).join(" ");
}
function msFor(jid){return allMatches.filter(m=>m.journey_id===jid).sort((a,b)=>a.number-b.number)}
function resolved(m){return m?.home_score!=null&&m?.away_score!=null}
function state(j){
  if(!j)return "closed";
  if(!qgLoadedJourneyIds.has(j.id)){
    if(j.status==="finished")return "finished";
    if(j.status==="open"&&Date.now()<new Date(j.close_at).getTime())return "open";
    return "closed";
  }
  const ms=msFor(j.id);
  if(ms.length===6&&ms.every(resolved))return "finished";
  if(j.status==="open"&&Date.now()<new Date(j.close_at).getTime())return "open";
  return ms.some(m=>m.kickoff&&Date.now()>=new Date(m.kickoff).getTime())?"playing":"closed";
}
function canEdit(j=journey){return Boolean(j&&j.status==="open"&&Date.now()<new Date(j.close_at).getTime())}
function pick(uid,n,jid=journey?.id){return allPicks.find(p=>p.user_id===uid&&p.journey_id===jid&&p.match_number===n)||null}
function jointOverride(n,jid=journey?.id){return allJoint.find(p=>p.journey_id===jid&&p.match_number===n)||null}
function pickText(p){return p?.home_goals&&p?.away_goals?`${p.home_goals}-${p.away_goals}`:"—"}
function goalNum(v){return v==="M"?3:Number(v)}
function goalToken(v){const n=Math.max(0,Math.min(3,Math.round(Number(v)||0)));return n>=3?"M":String(n)}
function actual(m){return resolved(m)?`${m.home_score>=3?"M":m.home_score}-${m.away_score>=3?"M":m.away_score}`:"—"}
function qgHeaderScore(m){
  if(resolved(m))return {home:String(m.home_score),away:String(m.away_score),cls:"official",label:"FINAL"};
  if(m?.live_home_score!=null&&m?.live_away_score!=null&&(m.live_status==="inprogress"||m.live_status==="finished")){
    const label=m.live_status==="inprogress"?(m.live_minute?m.live_minute+"′":"EN DIRECTO"):"FINAL";
    return {home:String(m.live_home_score),away:String(m.live_away_score),cls:"live",label};
  }
  return {home:"–",away:"–",cls:"pending",label:""};
}
function projected(m){
  if(resolved(m))return actual(m);
  if(m?.live_home_score!=null&&m?.live_away_score!=null&&(m.live_status==="inprogress"||m.live_status==="finished")){
    return `${m.live_home_score>=3?"M":m.live_home_score}-${m.live_away_score>=3?"M":m.live_away_score}`;
  }
  return "—";
}
function completed(uid,jid=journey?.id){return allPicks.filter(p=>p.user_id===uid&&p.journey_id===jid&&p.home_goals&&p.away_goals).length}
function score(uid,j=journey){
  let correct=0,count=0;if(!j)return {correct,resolved:count};
  for(const m of msFor(j.id)){const r=actual(m);if(r==="—")continue;count++;if(pickText(pick(uid,m.number,j.id))===r)correct++}
  return {correct,resolved:count};
}
function autoJoint(n,jid=journey?.id){
  const a=member(1)?pick(member(1).user_id,n,jid):null,b=member(2)?pick(member(2).user_id,n,jid):null;
  if(!a&&!b)return null;
  if(a&&!b)return {home_goals:a.home_goals,away_goals:a.away_goals,kind:"Provisional"};
  if(!a&&b)return {home_goals:b.home_goals,away_goals:b.away_goals,kind:"Provisional"};
  if(pickText(a)===pickText(b))return {home_goals:a.home_goals,away_goals:a.away_goals,kind:"Coincidís"};
  let home=(goalNum(a.home_goals)+goalNum(b.home_goals))/2,away=(goalNum(a.away_goals)+goalNum(b.away_goals))/2;
  const m=msFor(jid).find(x=>x.number===n),hp=Number(m?.home_position),ap=Number(m?.away_position);
  if(Number.isFinite(hp)&&Number.isFinite(ap)&&hp>0&&ap>0){const bias=Math.max(-.18,Math.min(.18,(ap-hp)/45));home+=bias;away-=bias}
  return {home_goals:goalToken(home),away_goals:goalToken(away),kind:"Recomendado"};
}
function effectiveJoint(n,jid=journey?.id){
  const man=jointOverride(n,jid);
  return man?{home_goals:man.home_goals,away_goals:man.away_goals,kind:"Manual"}:autoJoint(n,jid);
}
function jointText(n,jid=journey?.id){return pickText(effectiveJoint(n,jid))}
function jointScore(j=journey){
  let correct=0,count=0;if(!j)return {correct,resolved:count};
  for(const m of msFor(j.id)){const r=actual(m);if(r==="—")continue;count++;if(jointText(m.number,j.id)===r)correct++}
  return {correct,resolved:count};
}
function prizeLabel(n,res=6){if(res!==6||n<2)return "";return ({6:"1ª categoría",5:"2ª categoría",4:"3ª categoría",3:"4ª categoría",2:"5ª categoría"})[n]||""}
function selectJourney(){
  if(!journeys.length){journey=null;matches=[];return}
  const saved=journeys.find(j=>j.id===selectedJourneyId);
  const open=[...journeys].filter(j=>state(j)==="open").sort((a,b)=>new Date(a.close_at)-new Date(b.close_at));
  const playing=[...journeys].filter(j=>state(j)==="playing").sort((a,b)=>b.number-a.number);
  journey=saved||open[0]||playing[0]||[...journeys].sort((a,b)=>b.number-a.number)[0];
  selectedJourneyId=journey.id;savePref("quinigol-journey",journey.id);matches=msFor(journey.id);
}
function qgMergeRows(base,incoming,keyFn){
  const map=new Map((base||[]).map(x=>[keyFn(x),x]));
  for(const row of incoming||[])map.set(keyFn(row),row);
  return [...map.values()];
}
function qgInitialJourneyIds(){
  const ids=journeys.slice(0,3).map(j=>j.id);
  const saved=Number(readPref("quinigol-journey",""));
  if(Number.isFinite(saved)&&saved>0&&journeys.some(j=>j.id===saved)&&!ids.includes(saved))ids.push(saved);
  return ids;
}
async function qgLoadSummaries(){
  const {data,error}=await sb.rpc("get_qg_journey_summaries",{p_room_id:roomId});
  if(error){console.warn("Resumen Quinigol:",error);return}
  qgJourneySummaries=new Map((data||[]).map(x=>[Number(x.journey_id),x]));
}
async function qgLoadBundle(ids,{replace=false}={}){
  const clean=[...new Set((ids||[]).map(Number).filter(Boolean))];
  if(!clean.length)return;
  const [mr,pr,jpr]=await Promise.all([
    sb.from("qg_matches").select("*").in("journey_id",clean).order("number"),
    sb.from("qg_picks").select("*").eq("room_id",roomId).in("journey_id",clean),
    sb.from("qg_joint_picks").select("*").eq("room_id",roomId).in("journey_id",clean)
  ]);
  for(const r of [mr,pr,jpr])if(r.error)throw r.error;
  if(replace){
    allMatches=allMatches.filter(x=>!clean.includes(x.journey_id));
    allPicks=allPicks.filter(x=>!clean.includes(x.journey_id));
    allJoint=allJoint.filter(x=>!clean.includes(x.journey_id));
  }
  allMatches=qgMergeRows(allMatches,mr.data||[],x=>`${x.journey_id}:${x.number}`);
  allPicks=qgMergeRows(allPicks,pr.data||[],x=>`${x.journey_id}:${x.match_number}:${x.user_id}`);
  allJoint=qgMergeRows(allJoint,jpr.data||[],x=>`${x.journey_id}:${x.match_number}`);
  clean.forEach(id=>qgLoadedJourneyIds.add(id));
}
async function ensureQGJourneyLoaded(jid,{quiet=false}={}){
  const id=Number(jid);
  if(qgLoadedJourneyIds.has(id)&&msFor(id).length)return;
  if(!quiet)toast("Cargando jornada completa…");
  await qgLoadBundle([id]);
}
async function ensureAllQGJourneysLoaded(){
  if(qgHistoryFullyLoaded)return;
  const missing=journeys.map(j=>j.id).filter(id=>!qgLoadedJourneyIds.has(id));
  for(let i=0;i<missing.length;i+=16)await qgLoadBundle(missing.slice(i,i+16));
  qgHistoryFullyLoaded=true;
  if(journey)matches=msFor(journey.id);
}
async function load(){
  const [jr,mem]=await Promise.all([
    sb.from("qg_journeys").select("*").order("number",{ascending:false}),
    sb.from("members").select("room_id,user_id,slot,display_name").eq("room_id",roomId).order("slot")
  ]);
  for(const r of [jr,mem])if(r.error)throw r.error;
  journeys=jr.data||[];members=mem.data||[];
  const saved=Number(readPref("quinigol-journey",""));selectedJourneyId=Number.isFinite(saved)&&saved>0?saved:null;
  const v=readPref("quinigol-view","play");activeView=["play","joint","compare","stats","history"].includes(v)?v:"play";
  const f=readPref("quinigol-filter","all");activeFilter=["all","pending","correct","wrong"].includes(f)?f:"all";
  const g=readPref("quiniela-active-game","quiniela");activeGame=g==="quinigol"?"quinigol":"quiniela";
  for(const id of qgInitialJourneyIds())qgLoadedJourneyIds.add(id);
  await Promise.all([qgLoadBundle([...qgLoadedJourneyIds],{replace:true}),qgLoadSummaries(),qgLoadWalletData()]);
  selectJourney();
}

async function qgLoadWalletData(){
  if(!roomId)return;
  const [wr,tr,cr,sr]=await Promise.all([
    sb.from("room_wallets").select("balance,updated_at").eq("room_id",roomId).maybeSingle(),
    sb.from("wallet_transactions").select("*").eq("room_id",roomId).order("created_at",{ascending:false}).limit(12),
    sb.from("bet_confirmations").select("*").eq("room_id",roomId),
    sb.from("bet_skips").select("*").eq("room_id",roomId)
  ]);
  if(wr.error)throw wr.error;if(tr.error)throw tr.error;if(cr.error)throw cr.error;if(sr.error)throw sr.error;
  qgWalletBalance=Number(wr.data?.balance||0);
  qgWalletTransactions=tr.data||[];
  qgBetConfirmations=cr.data||[];
  qgBetSkips=sr.data||[];
}
function qgWalletCanManage(){return Number(member(1)?.user_id===identityUserId?1:0)===1}
function qgWalletConfirmation(jid=journey?.id){
  return qgBetConfirmations.find(x=>x.game==="quinigol"&&Number(x.journey_id)===Number(jid))||null;
}
function qgBetIsSkipped(jid=journey?.id){
  return qgBetSkips.some(x=>x.game==="quinigol"&&Number(x.journey_id)===Number(jid));
}
async function qgSetJourneySkipped(skipped){
  if(!journey||!qgWalletCanManage()||!canEdit(journey))return;
  const question=skipped
    ? `¿Seguro que esta jornada de Quinigol no la vais a jugar? No se descontará dinero y quedará como No jugada.`
    : `¿Volver a participar en la Jornada ${journey.number}?`;
  if(!confirm(question))return;
  try{
    const {error}=await sb.rpc("set_bet_skipped",{p_room_id:roomId,p_game:"quinigol",p_journey_id:journey.id,p_skipped:skipped});
    if(error)throw error;
    await qgLoadWalletData();renderJoint();renderHistory();
    window.dispatchEvent(new CustomEvent("wallet:refresh"));
    toast(skipped?"Jornada marcada como No jugada":"Volvéis a participar en esta jornada");
  }catch(e){console.error(e);toast(e?.message||"No se pudo cambiar la participación")}
}
function qgEuro(value){return Number(value||0).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"}
function qgWalletDate(v){
  if(!v)return "";
  return new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v)).replace(","," ·");
}
function qgWalletMovementLabel(t){
  const labels={opening:"Saldo inicial",funds:"Fondos añadidos",prize:"Premio añadido",bet:"Apuesta confirmada",bet_adjustment:"Ajuste de apuesta",refund:"Apuesta anulada"};
  return t?.note||labels[t?.kind]||"Movimiento";
}
function renderQGWallet(){
  const el=$("#qgJointWallet");if(!el||!journey)return;
  const manager=qgWalletCanManage(),conf=qgWalletConfirmation(journey.id),skipped=qgBetIsSkipped(journey.id),editable=canEdit(journey),plan=planData();
  const estimated=plan?.ready?Number(plan.cost):null;
  const costValue=conf?Number(conf.cost).toFixed(2):(estimated!=null?estimated.toFixed(2):"");
  const status=skipped
    ? `<div class="wallet-bet-status skipped"><span>— No jugamos esta jornada</span><small>No se descontará dinero ni se buscarán premios de este Quinigol.</small></div>`
    : conf
      ? `<div class="wallet-bet-status confirmed"><span>✓ Apuesta confirmada</span><strong>${esc(qgEuro(conf.cost))}</strong><small>${esc(qgWalletDate(conf.confirmed_at))}</small></div>`
      : `<div class="wallet-bet-status pending"><span>Pendiente de confirmar</span><small>${estimated!=null?`Coste recomendado: ${esc(qgEuro(estimated))}`:"Introduce el coste real al confirmarla"}</small></div>`;
  let controls="";
  if(skipped){
    controls=manager&&editable
      ? '<div class="wallet-confirm-controls skip-only"><button id="qgWalletPlayAgainBtn" type="button">Volver a participar</button></div>'
      : '<p class="wallet-readonly">Esta jornada está marcada como No jugada.</p>';
  }else if(manager){
    controls=`<div class="wallet-confirm-controls">
      <label><span>Coste de este Quinigol</span><div><input id="qgWalletBetCost" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(costValue)}" placeholder="0,00"><b>€</b></div></label>
      <button id="qgWalletConfirmBtn" type="button">${conf?"Actualizar":"Confirmar apuesta"}</button>
      ${conf?'<button id="qgWalletUnconfirmBtn" class="wallet-secondary" type="button">Deshacer</button>':""}
      ${editable?'<button id="qgWalletSkipBtn" class="wallet-skip-btn" type="button">No jugar esta jornada</button>':""}
    </div>`;
  }else{
    controls='<p class="wallet-readonly">Confirmación gestionada por Salva.</p>';
  }
  el.innerHTML=`<section class="bet-confirm-card ${skipped?"is-skipped":""}">
    <div class="bet-confirm-head"><div><span>APUESTA CONJUNTA</span><small>Quinigol · Jornada ${journey.number}</small></div><button type="button" class="bet-wallet-link" data-open-global-wallet>Monedero · ${esc(qgEuro(qgWalletBalance))}</button></div>
    <div class="wallet-confirmation">${status}${controls}</div>
  </section>`;
  if(manager){
    $("#qgWalletConfirmBtn")?.addEventListener("click",qgConfirmWalletBet);
    $("#qgWalletUnconfirmBtn")?.addEventListener("click",qgUnconfirmWalletBet);
    $("#qgWalletSkipBtn")?.addEventListener("click",()=>qgSetJourneySkipped(true));
    $("#qgWalletPlayAgainBtn")?.addEventListener("click",()=>qgSetJourneySkipped(false));
  }
  el.querySelector("[data-open-global-wallet]")?.addEventListener("click",()=>$("#walletBtn")?.click());
}
async function qgConfirmWalletBet(){
  const cost=Number(String($("#qgWalletBetCost")?.value||"").replace(",","."));
  if(!Number.isFinite(cost)||cost<=0){toast("Introduce un coste válido");return}
  try{
    const {error}=await sb.rpc("wallet_confirm_bet",{p_room_id:roomId,p_game:"quinigol",p_journey_id:journey.id,p_cost:cost});
    if(error)throw error;
    await qgLoadWalletData();renderJoint();window.dispatchEvent(new CustomEvent("wallet:refresh"));toast("✓ Quinigol confirmado y descontado del monedero");
  }catch(e){console.error(e);toast(String(e?.message||e).includes("Saldo insuficiente")?"Saldo insuficiente":"No se pudo confirmar la apuesta")}
}
async function qgUnconfirmWalletBet(){
  try{
    const {error}=await sb.rpc("wallet_unconfirm_bet",{p_room_id:roomId,p_game:"quinigol",p_journey_id:journey.id});
    if(error)throw error;
    await qgLoadWalletData();renderJoint();window.dispatchEvent(new CustomEvent("wallet:refresh"));toast("Confirmación anulada · importe devuelto");
  }catch(e){console.error(e);toast("No se pudo anular")}
}
async function qgAddWalletCredit(kind){
  const amount=Number(String($("#qgWalletCreditAmount")?.value||"").replace(",","."));
  const note=$("#qgWalletCreditNote")?.value?.trim()||null;
  if(!Number.isFinite(amount)||amount<=0){toast("Introduce un importe válido");return}
  try{
    const {error}=await sb.rpc("wallet_add_credit",{p_room_id:roomId,p_kind:kind,p_amount:amount,p_note:note});
    if(error)throw error;
    await qgLoadWalletData();renderJoint();toast(kind==="prize"?"Premio añadido al monedero":"Fondos añadidos al monedero");
  }catch(e){console.error(e);toast("No se pudo actualizar el monedero")}
}
function currentDraft(n){
  const k=`${journey?.id}:${n}`,p=pick(identityUserId,n),d=drafts.get(k)||{};
  return {home_goals:d.home_goals??p?.home_goals??null,away_goals:d.away_goals??p?.away_goals??null};
}
function currentJointDraft(n){
  const k=`${journey?.id}:${n}`,e=effectiveJoint(n)||{},d=jointDrafts.get(k)||{};
  return {home_goals:d.home_goals??e.home_goals??null,away_goals:d.away_goals??e.away_goals??null};
}
async function saveGoal(n,side,val){
  if(!canEdit()){toast("Esta jornada de Quinigol ya está cerrada");return}
  if(saving)return;
  const k=`${journey.id}:${n}`,cur=currentDraft(n),next={home_goals:side==="home"?val:cur.home_goals,away_goals:side==="away"?val:cur.away_goals};
  drafts.set(k,next);renderPlay();
  if(!next.home_goals||!next.away_goals)return;
  saving=true;
  try{
    const row={room_id:roomId,journey_id:journey.id,match_number:n,user_id:identityUserId,home_goals:next.home_goals,away_goals:next.away_goals,updated_at:new Date().toISOString()};
    const {data,error}=await sb.from("qg_picks").upsert(row,{onConflict:"room_id,journey_id,match_number,user_id"}).select().single();
    if(error)throw error;
    allPicks=allPicks.filter(p=>!(p.journey_id===journey.id&&p.match_number===n&&p.user_id===identityUserId));allPicks.push(data);drafts.delete(k);renderAll();
    if(completed(identityUserId)===6)toast("✓ Quinigol completo");
  }catch(e){console.error(e);toast("No se pudo guardar")}finally{saving=false}
}
async function deletePick(n){
  if(!canEdit())return;
  const {error}=await sb.from("qg_picks").delete().eq("room_id",roomId).eq("journey_id",journey.id).eq("match_number",n).eq("user_id",identityUserId);
  if(error){toast("No se pudo borrar");return}
  allPicks=allPicks.filter(p=>!(p.journey_id===journey.id&&p.match_number===n&&p.user_id===identityUserId));drafts.delete(`${journey.id}:${n}`);renderAll();
}
async function saveJointGoal(n,side,val){
  if(!canEdit()){toast("Esta jornada de Quinigol ya está cerrada");return}
  if(jointSaving)return;
  const k=`${journey.id}:${n}`,cur=currentJointDraft(n),next={home_goals:side==="home"?val:cur.home_goals,away_goals:side==="away"?val:cur.away_goals};
  jointDrafts.set(k,next);renderJoint();
  if(!next.home_goals||!next.away_goals)return;
  jointSaving=true;
  try{
    const row={room_id:roomId,journey_id:journey.id,match_number:n,home_goals:next.home_goals,away_goals:next.away_goals,updated_by:identityUserId,updated_at:new Date().toISOString()};
    const {data,error}=await sb.from("qg_joint_picks").upsert(row,{onConflict:"room_id,journey_id,match_number"}).select().single();
    if(error)throw error;
    allJoint=allJoint.filter(p=>!(p.journey_id===journey.id&&p.match_number===n));allJoint.push(data);jointDrafts.delete(k);renderAll();
  }catch(e){console.error(e);toast("No se pudo guardar la conjunta")}finally{jointSaving=false}
}
async function resetJoint(n){
  if(!canEdit())return;
  const {error}=await sb.from("qg_joint_picks").delete().eq("room_id",roomId).eq("journey_id",journey.id).eq("match_number",n);
  if(error){toast("No se pudo volver a automática");return}
  allJoint=allJoint.filter(p=>!(p.journey_id===journey.id&&p.match_number===n));jointDrafts.delete(`${journey.id}:${n}`);renderAll();toast("Modo automático restaurado");
}
function goalButtons(n,side,selected,locked,attrs=""){
  return GOALS.map(v=>`<button type="button" class="qg-goal ${selected===v?"selected":""}" data-qg-match="${n}" data-qg-side="${side}" data-qg-goal="${v}" ${attrs} ${locked?"disabled":""}>${v}</button>`).join("");
}
function qgPrizeState(j){
  if(!j||state(j)!=="finished")return "";
  if(!qgLoadedJourneyIds.has(j.id))return qgJourneySummaries.get(Number(j.id))?.prize_state||"miss";
  const personal=score(identityUserId,j);
  const joint=jointScore(j);
  return personal.correct>=2||joint.correct>=2?"prize":"miss";
}
function competitionShort(name=""){
  const n=String(name||"");
  if(n==="LaLiga 2")return "L2";
  if(n==="UEFA Nations League")return "NL";
  return n.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"L";
}
function renderJourneyCompetitions(){
  const el=$("#qgJourneyLeagues");
  if(!el||!journey)return;
  const seen=new Map();
  msFor(journey.id).forEach(m=>{
    const id=Number(m.competition_id),name=String(m.competition_name||"").trim(),logo=String(m.competition_logo_url||"").trim();
    if(!id||!name||!logo||seen.has(id))return;
    seen.set(id,{id,name,logo});
  });
  const comps=[...seen.values()];
  if(!comps.length){el.innerHTML="";el.classList.add("hidden");return}
  el.classList.remove("hidden");
  const shown=comps.slice(0,3);
  el.innerHTML=shown.map((c,i)=>`<span class="journey-league-logo" style="--league-i:${i}" title="${esc(c.name)}" aria-label="${esc(c.name)}"><b>${esc(competitionShort(c.name))}</b><img src="${esc(competitionLogoUrl(c.logo))}" data-logo-fallback="${esc(competitionLogoFallback(c.logo))}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer" onload="this.previousElementSibling.style.display='none'" onerror="const f=this.dataset.logoFallback;if(f&&this.src!==f){this.src=f}else this.remove()"></span>`).join("")+(comps.length>3?`<span class="journey-league-more" title="${esc(comps.slice(3).map(c=>c.name).join(", "))}">+${comps.length-3}</span>`:"");
}
function renderHero(){
  if(!journey)return;
  const st=state(journey),res=msFor(journey.id).filter(resolved).length;
  $("#qgJourneyNumber").textContent=`Jornada ${journey.number}`;
  $("#qgJourneyKicker").textContent=st==="open"?"PRÓXIMO QUINIGOL":st==="playing"?"SEGUIMIENTO DE RESULTADOS":st==="finished"?"JORNADA FINALIZADA":"JORNADA CERRADA";
  $("#qgStatusText").textContent=st==="open"?"Abierta para pronósticos":st==="playing"?`En juego · ${res}/6 resultados`:st==="finished"?"Finalizada · 6/6 resultados":"Cerrada";
  $("#qgJourneyDate").textContent=`Cierre · ${fullDate(journey.close_at)}`;
  $("#qgJourneyCountdown").textContent=st==="open"?`Empieza en ${timeLeft(journey.close_at)}`:st==="finished"?"Resultados oficiales completos":"Pronósticos cerrados";
  renderJourneyCompetitions();
  const card=$("#qgJourneyCard");
  card.dataset.status=st;
  const prizeState=qgPrizeState(journey);
  if(prizeState)card.dataset.prize=prizeState;
  else delete card.dataset.prize;
}
function renderSwitcher(){
  const el=$("#qgJourneySwitcher");if(!el)return;
  const available=[...journeys].sort((a,b)=>b.number-a.number);
  const active=available.find(j=>j.id===journey?.id);
  const primary=[];
  if(active)primary.push(active);
  for(const j of available){
    if(primary.length>=3)break;
    if(!primary.some(x=>x.id===j.id))primary.push(j);
  }
  primary.sort((a,b)=>b.number-a.number);
  const archived=available.filter(j=>!primary.some(x=>x.id===j.id));
  const buttonHtml=j=>{
    const st=state(j);
    const prizeState=st==="finished"?qgPrizeState(j):"";
    const prizeClass=prizeState?` finished-${prizeState}`:"";
    return `<button type="button" class="journey-choice ${j.id===journey?.id?"active":""} state-${st}${prizeClass}" data-qg-journey="${j.id}"><span>J${j.number}</span><strong>${st==="open"?"Abierta":st==="playing"?"En juego":st==="finished"?"Finalizada":"Cerrada"}</strong><small>${st==="finished"?"6/6 resultados · finalizada":fullDate(j.close_at)}</small></button>`;
  };
  el.innerHTML=`<div class="journey-primary-row">${primary.map(buttonHtml).join("")}</div>${
    archived.length?`<details class="journey-more"><summary>+ ${archived.length} jornada${archived.length===1?"":"s"}</summary><div class="journey-more-grid">${archived.map(buttonHtml).join("")}</div></details>`:""
  }`;
  $$("#qgJourneySwitcher [data-qg-journey]").forEach(b=>b.addEventListener("click",async()=>{
    const id=Number(b.dataset.qgJourney);
    try{
      await ensureQGJourneyLoaded(id);
      selectedJourneyId=id;
      savePref("quinigol-journey",selectedJourneyId);
      selectJourney();
      renderAll();
    }catch(e){
      console.error(e);
      toast("No se pudo cargar la jornada");
    }
  }));
}
function dashCard(name,done,s,cls){
  const finished=state(journey)==="finished",prize=prizeLabel(s.correct,s.resolved),gold=finished&&s.correct>=2;
  return `<div class="qg-dashboard-card ${cls} ${gold?"prize":""}"><span>${esc(name)}</span><strong>${finished?`${s.correct}/6`:`${done}/6`}</strong><small>${finished?(prize||"Sin premio"):"completados"}</small></div>`;
}
function renderDashboard(){
  const el=$("#qgDashboard");if(!el)return;
  const p1=member(1),p2=member(2),s1=p1?score(p1.user_id):{correct:0,resolved:0},s2=p2?score(p2.user_id):{correct:0,resolved:0},js=jointScore(),finished=state(journey)==="finished",jp=prizeLabel(js.correct,js.resolved),jointGold=finished&&js.correct>=2;
  el.innerHTML=dashCard(p1?.display_name||"Salva",p1?completed(p1.user_id):0,s1,"player-one")+dashCard(p2?.display_name||"Ferran",p2?completed(p2.user_id):0,s2,"player-two")+`<div class="qg-dashboard-card joint ${jointGold?"prize":""}"><span>Conjunta</span><strong>${finished?`${js.correct}/6`:`${matches.filter(m=>effectiveJoint(m.number)).length}/6`}</strong><small>${finished?(jp||"Sin premio"):"marcadores"}</small></div>`;
}
function renderFilters(){
  const c={all:matches.length,pending:0,correct:0,wrong:0};
  matches.forEach(m=>{const r=actual(m),p=pick(identityUserId,m.number);if(r==="—")c.pending++;else if(p&&pickText(p)===r)c.correct++;else c.wrong++});
  $("#qgFilterAll").textContent=c.all;$("#qgFilterPending").textContent=c.pending;$("#qgFilterCorrect").textContent=c.correct;$("#qgFilterWrong").textContent=c.wrong;
  $$(".qg-filter").forEach(b=>b.classList.toggle("active",b.dataset.qgFilter===activeFilter));
}
function renderPlay(){
  const el=$("#qgMatches");if(!el||!journey)return;
  const locked=!canEdit(),opp=members.find(m=>m.user_id!==identityUserId);
  el.innerHTML=matches.map(m=>{
    const cur=currentDraft(m.number),saved=pick(identityUserId,m.number),r=actual(m),proj=projected(m),ok=saved&&r!=="—"&&pickText(saved)===r;
    const show=activeFilter==="all"||(activeFilter==="pending"&&r==="—")||(activeFilter==="correct"&&ok)||(activeFilter==="wrong"&&r!=="—"&&!ok);
    let result="";
    if(r!=="—")result=`<div class="qg-result ${ok?"correct":"wrong"}"><span>Resultado oficial</span><strong>${esc(r)} · ${ok?"✓ Acierto":saved?"✕ Fallo":"Sin pronóstico"}</strong></div>`;
    else if(proj!=="—")result=`<div class="qg-result live"><span>En directo · provisional</span><strong>${esc(proj)}</strong></div>`;
    const hs=qgHeaderScore(m);
    return `<article class="qg-match-card ${show?"":"hidden"}"><div class="qg-card-head"><span class="match-index">${String(m.number).padStart(2,"0")}</span><div class="qg-card-fixture"><div class="qg-card-team">${teamHtml(m.home,m.home_logo_url,m.home_position)}<strong class="qg-head-score ${hs.cls}">${esc(hs.home)}</strong></div><div class="qg-card-team">${teamHtml(m.away,m.away_logo_url,m.away_position)}<strong class="qg-head-score ${hs.cls}">${esc(hs.away)}</strong></div>${hs.label?`<span class="qg-head-score-label ${hs.cls}">${esc(hs.label)}</span>`:""}</div>${tvHtml(m)}<span class="qg-card-kickoff">◷ ${esc(formatKickoff(m.kickoff))}</span></div><div class="qg-goal-rows"><div class="qg-goal-row"><div class="qg-goal-team">${teamHtml(m.home,m.home_logo_url,m.home_position)}</div><div class="qg-goals">${goalButtons(m.number,"home",cur.home_goals,locked)}</div></div><div class="qg-goal-row"><div class="qg-goal-team">${teamHtml(m.away,m.away_logo_url,m.away_position)}</div><div class="qg-goals">${goalButtons(m.number,"away",cur.away_goals,locked)}</div></div></div><div class="qg-card-foot"><span class="qg-card-hint">M = 3 o más goles</span>${saved&&canEdit()?`<button type="button" class="qg-clear" data-qg-clear="${m.number}">Borrar</button>`:""}</div>${saved&&opp?`<div class="qg-opponent-pick"><span>${esc(opp.display_name)}</span><strong>${esc(pickText(pick(opp.user_id,m.number)))}</strong></div>`:""}${result}</article>`;
  }).join("");
  $$(".qg-goal").forEach(b=>b.addEventListener("click",()=>saveGoal(Number(b.dataset.qgMatch),b.dataset.qgSide,b.dataset.qgGoal)));
  $$("[data-qg-clear]").forEach(b=>b.addEventListener("click",()=>deletePick(Number(b.dataset.qgClear))));
  renderFilters();
  const n=completed(identityUserId);$("#qgProgressText").textContent=`${n} de 6 completados`;$("#qgProgressBar").style.width=`${n/6*100}%`;
}
function jointEditor(n,sel,locked){
  const side=(s,v)=>`<div class="qg-joint-side">${GOALS.map(x=>`<button type="button" class="${v===x?"selected":""}" data-qg-joint-match="${n}" data-qg-joint-side="${s}" data-qg-joint-goal="${x}" ${locked?"disabled":""}>${x}</button>`).join("")}</div>`;
  return `<div class="qg-joint-goal-pair">${side("home",sel.home_goals)}<span class="qg-joint-dash">–</span>${side("away",sel.away_goals)}</div>`;
}
function resultOutcome(value){
  const p=String(value||"").match(/^(0|1|2|M)-(0|1|2|M)$/);
  if(!p)return null;
  const h=goalNum(p[1]),a=goalNum(p[2]);
  return h>a?"H":h<a?"A":"D";
}
function closeResults(a,b){
  const pa=String(a||"").match(/^(0|1|2|M)-(0|1|2|M)$/);
  const pb=String(b||"").match(/^(0|1|2|M)-(0|1|2|M)$/);
  if(!pa||!pb)return false;
  const dh=Math.abs(goalNum(pa[1])-goalNum(pb[1]));
  const da=Math.abs(goalNum(pa[2])-goalNum(pb[2]));
  return (dh+da<=1)||(resultOutcome(a)===resultOutcome(b)&&dh<=1&&da<=1);
}
function planData(){
  const p1=member(1),p2=member(2);
  const c1=p1?completed(p1.user_id):0,c2=p2?completed(p2.user_id):0;
  const rows=matches.map(m=>{
    const a=p1?pickText(pick(p1.user_id,m.number)):"—";
    const b=p2?pickText(pick(p2.user_id,m.number)):"—";
    const manual=Boolean(jointOverride(m.number));
    const base=jointText(m.number);
    return {n:m.number,a,b,base,manual,diff:a!=="—"&&b!=="—"&&a!==b,close:closeResults(a,b)};
  });
  if(c1<6||c2<6)return {ready:false,p1,p2,c1,c2,rows};

  const diffs=rows.filter(r=>r.diff);
  const major=diffs.filter(r=>!r.close&&!r.manual);
  let mode="one",bets=1,title="1 columna conjunta";
  if(major.length===1){mode="multiple";bets=2;title="1 múltiple · doble resultado"}
  else if(major.length>=2){mode="two";bets=2;title="2 columnas optimizadas"}
  else if(diffs.length===0){title="1 columna común"}
  else title="1 columna optimizada";

  const column1=rows.map(r=>({n:r.n,value:r.manual||r.close?r.base:(mode==="two"&&r.diff?r.a:r.base)}));
  const column2=mode==="two"?rows.map(r=>({n:r.n,value:r.manual||r.close?r.base:(r.diff?r.b:r.base)})):null;
  const multipleMatch=mode==="multiple"?major[0]:null;
  const fullCoverBets=Math.max(1,Math.pow(2,major.length));
  return {ready:true,p1,p2,c1,c2,rows,diffs,major,mode,bets,cost:bets,fullCoverBets,title,column1,column2,multipleMatch};
}
function planGrid(items,multipleMatch=null){
  return `<div class="qg-plan-grid">${items.map(x=>{
    if(multipleMatch&&x.n===multipleMatch.n){
      return `<div class="qg-plan-cell multiple"><span>P${x.n} · 2 resultados</span><strong>${esc(multipleMatch.a)} <b>/</b> ${esc(multipleMatch.b)}</strong></div>`;
    }
    return `<div class="qg-plan-cell"><span>P${x.n}</span><strong>${esc(x.value)}</strong></div>`;
  }).join("")}</div>`;
}
function renderPlan(){
  const el=$("#qgJointPlan");if(!el)return;
  const plan=planData();
  if(!plan.ready){
    el.innerHTML=`<section class="qg-plan-card"><div class="qg-plan-top"><div><span>PROPUESTA DE APUESTA</span><h3>Propuesta pendiente</h3></div><div class="qg-plan-price"><strong>—</strong><small>Esperando</small></div></div><p>Faltan pronósticos · ${esc(plan.p1?.display_name||"Salva")} ${plan.c1}/6 · ${esc(plan.p2?.display_name||"Ferran")} ${plan.c2}/6.</p></section>`;
    return;
  }

  let reason="",detail="";
  if(plan.mode==="one"){
    if(plan.diffs.length===0)reason="Coincidís en los seis marcadores: no merece la pena pagar una segunda apuesta.";
    else reason=`Tenéis ${plan.diffs.length} diferencia${plan.diffs.length===1?"":"s"}, pero son marcadores cercanos o ya los habéis resuelto manualmente. La app concentra la apuesta en una sola columna de 1 €.`;
    detail=`<div class="qg-plan-block"><div class="qg-plan-block-head"><span>COLUMNA ÚNICA</span><strong>Conjunta</strong></div>${planGrid(plan.column1)}</div>`;
  }else if(plan.mode==="multiple"){
    const mm=plan.multipleMatch;
    reason=`Solo hay una discrepancia importante. En vez de dos columnas completas, se cubren los dos resultados del partido ${mm.n}: genera 2 apuestas y cuesta 2 €.`;
    detail=`<div class="qg-plan-block"><div class="qg-plan-block-head"><span>APUESTA MÚLTIPLE</span><strong>Doble resultado en P${mm.n}</strong></div>${planGrid(plan.column1,mm)}</div>`;
  }else{
    reason=`Hay ${plan.major.length} discrepancias importantes. Dos columnas cuestan 2 € y conservan las dos líneas de pronóstico sin disparar el coste.`;
    detail=`<div class="qg-plan-columns"><div class="qg-plan-block player-one"><div class="qg-plan-block-head"><span>COLUMNA 1</span><strong>${esc(plan.p1?.display_name||"Salva")}</strong></div>${planGrid(plan.column1)}</div><div class="qg-plan-block player-two"><div class="qg-plan-block-head"><span>COLUMNA 2</span><strong>${esc(plan.p2?.display_name||"Ferran")}</strong></div>${planGrid(plan.column2)}</div></div>`;
  }

  const alternative=plan.major.length>=2?`<div class="qg-plan-alternative">Cubrir todas las discrepancias como múltiple generaría <strong>${plan.fullCoverBets} apuestas · ${plan.fullCoverBets.toFixed(2).replace(".",",")} €</strong>. Por coste, la app prefiere las 2 columnas.</div>`:"";
  el.innerHTML=`<section class="qg-plan-card"><div class="qg-plan-top"><div><span>PROPUESTA DE APUESTA</span><h3>${esc(plan.title)}</h3></div><div class="qg-plan-price"><strong>${plan.cost.toFixed(2).replace(".",",")} €</strong><small>${plan.bets} apuesta${plan.bets===1?"":"s"} · 1 € cada una</small></div></div><p>${reason}</p>${detail}${alternative}</section>`;
}
function renderJoint(){
  const el=$("#qgJointList");if(!el||!journey)return;renderQGWallet();renderPlan();
  const p1=member(1),p2=member(2),locked=!canEdit();
  el.innerHTML=matches.map(m=>{
    const a=p1?pick(p1.user_id,m.number):null,b=p2?pick(p2.user_id,m.number):null,man=jointOverride(m.number),auto=autoJoint(m.number),autoKind=auto?.kind||"Pendiente",sel=currentJointDraft(m.number);
    return `<article class="qg-joint-card"><div class="qg-card-head"><span class="match-index">${String(m.number).padStart(2,"0")}</span><div class="qg-card-fixture"><div class="qg-card-team">${teamHtml(m.home,m.home_logo_url,m.home_position)}</div><div class="qg-card-team">${teamHtml(m.away,m.away_logo_url,m.away_position)}</div></div><span class="qg-mode ${man?"manual":""}">${man?"Manual":"Automática"}</span></div><div class="qg-joint-rows"><div class="qg-joint-row player-one"><div class="qg-joint-name"><i></i><span>${esc(p1?.display_name||"Salva")}</span></div><strong class="qg-score-pill">${esc(pickText(a))}</strong></div><div class="qg-joint-row player-two"><div class="qg-joint-name"><i></i><span>${esc(p2?.display_name||"Ferran")}</span></div><strong class="qg-score-pill">${esc(pickText(b))}</strong></div><div class="qg-joint-row joint"><div class="qg-joint-name"><i></i><span>Conjunta</span></div><div class="qg-joint-edit">${jointEditor(m.number,sel,locked)}<small>${man?"Marcador conjunto fijado manualmente":autoKind==="Recomendado"?"Recomendado a partir de vuestros dos marcadores":autoKind==="Provisional"?"Falta el pronóstico del otro":autoKind}</small>${man&&canEdit()?`<button type="button" class="qg-joint-reset" data-qg-reset="${m.number}">↺ Automática</button>`:""}</div></div></div></article>`;
  }).join("");
  $$("[data-qg-joint-goal]").forEach(b=>b.addEventListener("click",()=>saveJointGoal(Number(b.dataset.qgJointMatch),b.dataset.qgJointSide,b.dataset.qgJointGoal)));
  $$("[data-qg-reset]").forEach(b=>b.addEventListener("click",()=>resetJoint(Number(b.dataset.qgReset))));
}
function renderCompare(){
  const el=$("#qgCompareList");if(!el||!journey)return;
  const p1=member(1),p2=member(2);
  el.innerHTML=matches.map(m=>{
    const r=projected(m);
    return `<article class="qg-compare-card"><div class="qg-card-head"><span class="match-index">${String(m.number).padStart(2,"0")}</span><div class="qg-card-fixture"><div class="qg-card-team">${teamHtml(m.home,m.home_logo_url,m.home_position)}</div><div class="qg-card-team">${teamHtml(m.away,m.away_logo_url,m.away_position)}</div></div><span class="qg-card-kickoff">◷ ${esc(formatKickoff(m.kickoff))}</span></div><div class="qg-compare-grid"><div class="qg-compare-box player-one"><span>${esc(p1?.display_name||"Salva")}</span><strong>${esc(p1?pickText(pick(p1.user_id,m.number)):"—")}</strong></div><div class="qg-compare-box player-two"><span>${esc(p2?.display_name||"Ferran")}</span><strong>${esc(p2?pickText(pick(p2.user_id,m.number)):"—")}</strong></div><div class="qg-compare-box joint"><span>Conjunta</span><strong>${esc(jointText(m.number))}</strong></div></div><div class="qg-compare-result"><span>${resolved(m)?"Resultado oficial":r!=="—"?"Resultado provisional":"Resultado pendiente"}</span><strong>${esc(r)}</strong></div></article>`;
  }).join("");
}
function stat(uid){
  const done=journeys.filter(j=>state(j)==="finished"),scores=done.map(j=>score(uid,j));
  return {best:scores.length?Math.max(...scores.map(s=>s.correct)):0,prizes:scores.filter(s=>s.correct>=2).length,total:scores.reduce((a,s)=>a+s.correct,0),journeys:done.length};
}
function jstat(){
  const done=journeys.filter(j=>state(j)==="finished"),scores=done.map(j=>jointScore(j));
  return {best:scores.length?Math.max(...scores.map(s=>s.correct)):0,prizes:scores.filter(s=>s.correct>=2).length,total:scores.reduce((a,s)=>a+s.correct,0),journeys:done.length};
}
function renderStats(){
  const el=$("#qgStats");if(!el)return;
  const p1=member(1),p2=member(2),s1=p1?stat(p1.user_id):{best:0,prizes:0},s2=p2?stat(p2.user_id):{best:0,prizes:0},sj=jstat();
  const card=(name,s,cls)=>`<div class="qg-stat-card ${cls}"><span>${esc(name)}</span><strong>${s.best}/6</strong><small>Mejor · ${s.prizes} con premio</small></div>`;
  el.innerHTML=`<div class="qg-stats-grid">${card(p1?.display_name||"Salva",s1,"player-one")}${card(p2?.display_name||"Ferran",s2,"player-two")}${card("Conjunta",sj,"joint")}</div><div class="qg-stats-note">Categorías: <strong>6 aciertos = 1ª</strong>, 5 = 2ª, 4 = 3ª, 3 = 4ª y 2 = 5ª. En la app se considera jornada con premio visual cuando hay 2 o más aciertos.</div>`;
}
function renderHistory(){
  const el=$("#qgHistory");if(!el)return;
  const p1=member(1),p2=member(2),done=[...journeys].filter(j=>state(j)==="finished").sort((a,b)=>b.number-a.number);
  if(!done.length){el.innerHTML='<div class="empty-card"><div class="empty-icon">⚽</div><h2>Aún no hay historial</h2><p>La primera jornada finalizada aparecerá aquí con los seis marcadores.</p></div>';return}
  el.innerHTML=done.map(j=>{
    const s1=p1?score(p1.user_id,j):{correct:0},s2=p2?score(p2.user_id,j):{correct:0},sj=jointScore(j);
    const rows=msFor(j.id).map(m=>`<div class="qg-history-match"><span>P${m.number}</span><div class="qg-history-fixture">${esc(stripTeam(m.home))} · ${esc(stripTeam(m.away))}</div><div class="qg-history-picks"><span class="p1">${esc(p1?pickText(pick(p1.user_id,m.number,j.id)):"—")}</span><span class="p2">${esc(p2?pickText(pick(p2.user_id,m.number,j.id)):"—")}</span><span class="pj">${esc(jointText(m.number,j.id))}</span><span class="real">${esc(actual(m))}</span></div></div>`).join("");
    const skipped=qgBetIsSkipped(j.id);
    return `<details class="qg-history-item ${skipped?"is-skipped":""}"><summary><span class="qg-history-num">J${j.number}</span><div class="qg-history-title"><strong>${esc(new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",year:"numeric"}).format(new Date(j.draw_date+"T12:00:00")))}</strong><small>${skipped?"No jugada":prizeLabel(sj.correct,6)||"Resultados oficiales"}</small></div><div class="qg-history-score">${skipped?'<span class="qg-history-no-play">No jugada</span>':`<span>${s1.correct}/6</span><span>${s2.correct}/6</span><span>${sj.correct}/6</span>`}</div></summary><div class="qg-history-body">${rows}</div></details>`;
  }).join("");
}
function setView(v,persist=true){
  activeView=["play","joint","compare","stats","history"].includes(v)?v:"play";
  if(persist)savePref("quinigol-view",activeView);
  $$(".qg-tab").forEach(b=>b.classList.toggle("active",b.dataset.qgView===activeView));
  $$(".qg-view").forEach(x=>x.classList.toggle("active",x.id===`qg${activeView.charAt(0).toUpperCase()+activeView.slice(1)}View`));
  if(activeView==="joint")renderJoint();if(activeView==="compare")renderCompare();if(activeView==="stats")renderStats();if(activeView==="history")renderHistory();
}
function setFilter(f){activeFilter=["all","pending","correct","wrong"].includes(f)?f:"all";savePref("quinigol-filter",activeFilter);renderPlay()}
function setGame(g,persist=true){
  activeGame=g==="quinigol"?"quinigol":"quiniela";if(persist)savePref("quiniela-active-game",activeGame);
  $$(".game-choice").forEach(b=>b.classList.toggle("active",b.dataset.game===activeGame));
  const q=activeGame==="quinigol";
  const opponentEl=$("#opponentStatus");
  if(q){
    if(opponentEl&&document.documentElement.dataset.game!=="quinigol")quinielaOpponentText=opponentEl.textContent||"";
    document.documentElement.dataset.game="quinigol";
  }else{
    document.documentElement.dataset.game="quiniela";
    if(opponentEl&&quinielaOpponentText)opponentEl.textContent=quinielaOpponentText;
    window.dispatchEvent(new CustomEvent("quiniela:show"));
  }
  $("#qgRoot")?.classList.toggle("hidden",!q);$("#journeyCard")?.classList.toggle("hidden",q);$("#journeySwitcher")?.classList.toggle("hidden",q);$("#quinielaTabs")?.classList.toggle("hidden",q);$("#quinielaMain")?.classList.toggle("hidden",q);
  if(q)renderAll();
}
function renderAll(){
  if(!journey)return;
  renderHero();renderSwitcher();renderDashboard();renderPlay();renderJoint();renderCompare();renderStats();renderHistory();setView(activeView,false);
}
async function openQGView(v){
  if((v==="stats"||v==="history")&&!qgHistoryFullyLoaded){
    try{await ensureAllQGJourneysLoaded()}catch(e){console.error(e);toast("No se pudo cargar todo el historial")}
  }
  setView(v);
}
function bind(){
  $$(".game-choice").forEach(b=>b.addEventListener("click",()=>setGame(b.dataset.game)));
  $$(".qg-tab").forEach(b=>b.addEventListener("click",()=>openQGView(b.dataset.qgView)));
  $$(".qg-filter").forEach(b=>b.addEventListener("click",()=>setFilter(b.dataset.qgFilter)));
}
function subscribe(){
  if(channel)sb.removeChannel(channel);
  const refreshLoaded=async()=>{
    await Promise.all([qgLoadBundle([...qgLoadedJourneyIds],{replace:true}),qgLoadSummaries()]);
    if(journey)matches=msFor(journey.id);
    renderAll();
  };
  channel=sb.channel(`quinigol-${roomId}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"qg_picks",filter:`room_id=eq.${roomId}`},refreshLoaded)
    .on("postgres_changes",{event:"*",schema:"public",table:"qg_joint_picks",filter:`room_id=eq.${roomId}`},refreshLoaded)
    .on("postgres_changes",{event:"*",schema:"public",table:"room_wallets",filter:`room_id=eq.${roomId}`},async()=>{await qgLoadWalletData();renderJoint()})
    .on("postgres_changes",{event:"*",schema:"public",table:"wallet_transactions",filter:`room_id=eq.${roomId}`},async()=>{await qgLoadWalletData();renderJoint()})
    .on("postgres_changes",{event:"*",schema:"public",table:"bet_confirmations",filter:`room_id=eq.${roomId}`},async()=>{await qgLoadWalletData();renderJoint()})
    .on("postgres_changes",{event:"*",schema:"public",table:"bet_skips",filter:`room_id=eq.${roomId}`},async()=>{await qgLoadWalletData();renderJoint();renderHistory()})
    .on("postgres_changes",{event:"*",schema:"public",table:"qg_matches"},refreshLoaded)
    .on("postgres_changes",{event:"*",schema:"public",table:"qg_journeys"},async()=>{await load();renderAll()})
    .subscribe();
}
async function init(){
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return;
  sb=createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let mine=null;
  for(let i=0;i<40&&!mine;i++){
    const {data:{session}}=await sb.auth.getSession();
    if(session){
      const r=await sb.rpc("get_my_identity");
      if(!r.error){const x=Array.isArray(r.data)?r.data[0]:r.data;if(x){mine=x;break}}
    }
    await wait(250);
  }
  if(!mine)return;
  roomId=mine.room_id;identityUserId=mine.member_user_id;
  try{
    await load();
    if(activeView==="stats"||activeView==="history")await ensureAllQGJourneysLoaded();
    bind();renderAll();setGame(activeGame,false);subscribe();
    setInterval(()=>{if(journey&&state(journey)==="open"){const e=$("#qgJourneyCountdown");if(e)e.textContent=`Empieza en ${timeLeft(journey.close_at)}`}},30000);
  }catch(e){console.error("Quinigol:",e)}
}
init();
  