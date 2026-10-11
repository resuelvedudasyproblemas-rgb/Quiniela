// Historial compacto compartido entre La Quiniela y El Quinigol.
function safeText(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

function archiveDate(j){
 const raw=String(j?.draw_date||"").slice(0,10),m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!m)return {season:"Temporada",month:"Sin fecha",text:""};
 const yy=Number(m[1]),mm=Number(m[2]),start=mm>=7?yy:yy-1;
 const dt=new Date(raw+"T12:00:00Z");
 const month=new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric",timeZone:"UTC"}).format(dt);
 return {season:`Temporada ${start}/${String(start+1).slice(-2)}`,month:month.charAt(0).toUpperCase()+month.slice(1),text:`${month} ${raw} ${start}/${String(start+1).slice(-2)}`};
}

function archiveMatches(j,term){
 const q=String(term||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(!q)return true;
 const hay=`j${j.number} j ${j.number} jornada ${j.number} ${j.number} ${archiveDate(j).text}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return hay.includes(q);
}

function archiveGroups(items,render,kind){
 let lastSeason="",lastMonth="",html="",group="";
 const flush=()=>{if(group){html+=`<div class="archive-month-items archive-${kind}-items">${group}</div>`;group="";}};
 for(const j of items){
  const d=archiveDate(j);
  if(d.season!==lastSeason){flush();html+=`<div class="archive-season-label">${safeText(d.season)}</div>`;lastSeason=d.season;lastMonth="";}
  if(d.month!==lastMonth){flush();html+=`<div class="archive-month-label">${safeText(d.month)}</div>`;lastMonth=d.month;}
  group+=render(j);
 }
 flush();return html;
}

function renderJourneyArchive(el,allJ,selectedId,displayState,renderButton,onSelect){
 if(!el)return;
 const st=el.__archiveState||(el.__archiveState={open:false,query:"",all:false});
 const ordered=[...allJ].sort((a,b)=>Number(a.number)-Number(b.number));
 const pending=ordered.filter(j=>displayState(j)!=="finished");
 const finished=ordered.filter(j=>displayState(j)==="finished").reverse();
 const primary=[...pending.slice(0,2)];
 if(finished[0])primary.push(finished[0]);else if(pending[2])primary.push(pending[2]);
 const chosen=ordered.find(j=>Number(j.id)===Number(selectedId));
 if(chosen&&!primary.some(j=>j.id===chosen.id)){
  if(primary.length<3)primary.push(chosen);else primary[primary.length-1]=chosen;
 }
 if(!primary.length&&finished.length)primary.push(finished[0]);
 primary.sort((a,b)=>a.number-b.number);
 const mainIDs=new Set(primary.map(j=>j.id));
 const morePending=pending.filter(j=>!mainIDs.has(j.id));
 const morePast=finished.filter(j=>!mainIDs.has(j.id));
 const total=morePending.length+morePast.length;
 el.innerHTML=`<div class="journey-primary-row">${primary.map(renderButton).join("")}</div>${total?`<details class="journey-more journey-archive" ${st.open?"open":""}>
  <summary>▦ &nbsp; Otras jornadas <span class="archive-total">${total}</span><span class="archive-chevron">⌄</span></summary>
  <div class="journey-archive-panel"><label class="archive-search-wrap"><span>⌕</span><input type="search" class="archive-search" aria-label="Buscar jornadas" placeholder="Buscar jornada, mes o temporada…" value="${safeText(st.query)}" autocomplete="off"/></label><div class="journey-archive-results"></div></div>
  </details>`:""}`;
 const content=el.querySelector(".journey-archive-results");
 const draw=()=>{
  if(!content)return;
  const future=morePending.filter(j=>archiveMatches(j,st.query));
  const past=morePast.filter(j=>archiveMatches(j,st.query));
  const found=[...future.map(j=>({j,future:true})),...past.map(j=>({j,future:false}))];
  const limit=st.all||st.query.trim()?found.length:Math.min(8,found.length);
  const shown=found.slice(0,limit);
  const futureRows=shown.filter(x=>x.future).map(x=>x.j);
  const pastRows=shown.filter(x=>!x.future).map(x=>x.j);
  content.innerHTML=shown.length
  ?`${futureRows.length?'<div class="archive-section-label">Otras jornadas</div>'+archiveGroups(futureRows,renderButton,"selector"):""}${pastRows.length?'<div class="archive-section-label">Finalizadas</div>'+archiveGroups(pastRows,renderButton,"selector"):""}${found.length>shown.length?`<button type="button" class="archive-load-more" data-archive-all>Ver todas las jornadas (${found.length}) ↓</button>`:""}`
  :'<div class="archive-empty">No hay jornadas que coincidan.</div>';
 };
 draw();
 const details=el.querySelector(".journey-archive");
 details?.addEventListener("toggle",()=>{st.open=details.open;});
 el.oninput=e=>{if(e.target.matches(".archive-search")){st.query=e.target.value;st.all=false;draw();}};
 el.onclick=e=>{
  if(e.target.closest("[data-archive-all]")){st.all=true;draw();return;}
  const button=e.target.closest("[data-journey-open]");
  if(button&&el.contains(button))void Promise.resolve(onSelect(Number(button.dataset.journeyOpen))).catch(console.error);
 };
}

function renderHistoryBrowser(el,journeys,renderItem,onSelect){
 if(!el)return;
 const st=el.__historyState||(el.__historyState={query:"",visible:8,expanded:new Set()});
 const all=[...journeys].sort((a,b)=>b.number-a.number);
 el.innerHTML=`<div class="history-browser-toolbar"><label class="archive-search-wrap"><span>⌕</span><input type="search" class="archive-search" placeholder="Buscar jornada o mes…" aria-label="Buscar en historial" value="${safeText(st.query)}" autocomplete="off"/></label><span class="history-browser-count" aria-live="polite"></span></div><div class="history-browser-results"></div>`;
 const results=el.querySelector(".history-browser-results"),counter=el.querySelector(".history-browser-count");
 function draw(){
  results.querySelectorAll("details[data-history-expand]").forEach(d=>{if(d.open)st.expanded.add(d.dataset.historyExpand);else st.expanded.delete(d.dataset.historyExpand);});
  const matched=all.filter(j=>archiveMatches(j,st.query));
  const shown=st.query.trim()?matched:matched.slice(0,st.visible);
  counter.textContent=`${matched.length} jornada${matched.length===1?"":"s"}`;
  results.innerHTML=shown.length?archiveGroups(shown,renderItem,"history")+(shown.length<matched.length?`<button type="button" class="archive-load-more" data-history-more>Ver más jornadas (${matched.length-shown.length} restantes) ↓</button>`:""):'<div class="archive-empty">No hay jornadas que coincidan.</div>';
  results.querySelectorAll("details[data-history-expand]").forEach(d=>{if(st.expanded.has(d.dataset.historyExpand))d.open=true;});
 }
 draw();
 results.addEventListener("toggle",e=>{
  const d=e.target;if(!d.matches?.("details[data-history-expand]"))return;
  if(d.open)st.expanded.add(d.dataset.historyExpand);else st.expanded.delete(d.dataset.historyExpand);
 },true);
 el.oninput=e=>{if(e.target.matches(".archive-search")){st.query=e.target.value;st.visible=8;draw();}};
 el.onclick=e=>{
  if(e.target.closest("[data-history-more]")){st.visible+=8;draw();return;}
  const btn=e.target.closest("[data-history-id]");if(btn&&onSelect)onSelect(Number(btn.dataset.historyId));
 };
}
export {renderJourneyArchive,renderHistoryBrowser};
