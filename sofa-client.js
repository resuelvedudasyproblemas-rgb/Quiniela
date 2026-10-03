import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const cfg=window.QUINIELA_CONFIG||{};
if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){
  throw new Error("Configuración Supabase no disponible");
}

const sb=createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
});

const attempts=new Map();
let busy=false;

function missingExactMinutes(row){
  const scorers=Array.isArray(row?.live_scorers)?row.live_scorers:[];
  return Boolean(row?.sofascore_event_id) &&
    scorers.some(g=>g?.name&&(g?.time==null||!Number.isFinite(Number(g.time))));
}

async function requestedWith(){
  const slot=Math.floor(Date.now()/1000/1800);
  const bytes=new TextEncoder().encode(String(slot));
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(hash))
    .map(b=>b.toString(16).padStart(2,"0"))
    .join("")
    .slice(0,6);
}

function exactGoals(incidents){
  return (Array.isArray(incidents)?incidents:[])
    .filter(x=>
      x?.incidentType==="goal" &&
      x?.player?.name &&
      x?.incidentClass!=="missed" &&
      x?.time!=null &&
      Number.isFinite(Number(x.time))
    );
}

async function fetchIncidents(eventId){
  const id=Number(eventId);
  if(!Number.isFinite(id)||id<=0)return null;

  const token=await requestedWith();
  const urls=[
    `https://www.sofascore.com/api/v1/event/${id}/incidents?_nq=${Date.now()}`,
    `https://api.sofascore.com/api/v1/event/${id}/incidents?_nq=${Date.now()}`
  ];
  const variants=[
    {"accept":"application/json,text/plain,*/*","x-requested-with":token},
    {"accept":"application/json,text/plain,*/*","x-requested-with":"XMLHttpRequest"},
    {"accept":"application/json,text/plain,*/*"}
  ];

  for(const url of urls){
    for(const headers of variants){
      try{
        const r=await fetch(url,{
          method:"GET",
          mode:"cors",
          credentials:"omit",
          cache:"no-store",
          headers
        });
        if(!r.ok)continue;
        const data=await r.json().catch(()=>null);
        if(Array.isArray(data?.incidents))return data.incidents;
      }catch{}
    }
  }
  return null;
}

async function rowsNeedingMinutes(){
  const fields="sofascore_event_id,live_scorers,live_status,live_updated_at";
  const [qm,qg]=await Promise.all([
    sb.from("matches").select(fields).not("sofascore_event_id","is",null),
    sb.from("qg_matches").select(fields).not("sofascore_event_id","is",null)
  ]);
  if(qm.error)throw qm.error;
  if(qg.error)throw qg.error;
  return [...(qm.data||[]),...(qg.data||[])].filter(missingExactMinutes);
}

async function persist(eventId,incidents){
  const {data,error}=await sb.functions.invoke("ingest-sofa-incidents",{
    body:{event_id:Number(eventId),incidents}
  });
  if(error)throw error;
  return Boolean(data?.ok);
}

async function syncExactMinutes(){
  if(busy||document.hidden)return;
  busy=true;
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)return;

    const rows=await rowsNeedingMinutes();
    const ids=[...new Set(rows.map(r=>Number(r.sofascore_event_id)).filter(Boolean))];

    for(const eventId of ids){
      const last=attempts.get(eventId)||0;
      if(Date.now()-last<30000)continue;
      attempts.set(eventId,Date.now());

      const incidents=await fetchIncidents(eventId);
      if(!incidents||!exactGoals(incidents).length)continue;

      try{
        const ok=await persist(eventId,incidents);
        if(ok){
          window.dispatchEvent(new CustomEvent("nq:sofa-incidents-updated",{detail:{eventId}}));
        }
      }catch(e){
        console.warn("Minutos SofaScore:",e);
      }
    }
  }catch(e){
    console.warn("Sincronización exacta de goleadores:",e);
  }finally{
    busy=false;
  }
}

function scheduleSoon(){
  setTimeout(()=>void syncExactMinutes(),1200);
}

scheduleSoon();
setInterval(()=>void syncExactMinutes(),30000);
window.addEventListener("focus",scheduleSoon);
window.addEventListener("online",scheduleSoon);
window.addEventListener("pageshow",scheduleSoon);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)scheduleSoon()});
