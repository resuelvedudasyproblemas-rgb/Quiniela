window.QUINIELA_CONFIG = {
  SUPABASE_URL: "https://jmgzozwtoqrchldwqkhd.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_AYrVkrHQM4eE5Hhs7DhUlQ_rlC-L4-1"
};

// Los minutos exactos de los goles se recuperan desde el navegador del usuario.
// Así SofaScore ve una conexión de navegador normal cuando bloquea IPs de servidor.
setTimeout(()=>{ import("./sofa-client.js?v=1").catch(()=>{}); },0);
