const CACHE="quiniela-v190";
const CORE=["./","index.html","styles.css?v=176","app.js?v=189","config.js","manifest.webmanifest","icon-192.svg","icon-512.svg"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request,{cache:"no-store"});
      if(response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(event.request,response.clone());
      }
      return response;
    }catch{
      return (await caches.match(event.request)) || (await caches.match("./"));
    }
  })());
});


function pushVisual(tag=""){
  const t=String(tag||"").toLowerCase();
  if(t.startsWith("reminder-"))return {emoji:"⏰",vibrate:[180,80,180]};
  if(t.includes("prize")||t.startsWith("elige8-"))return {emoji:"🏆",vibrate:[220,90,220]};
  if(t.startsWith("wallet-"))return {emoji:"💰",vibrate:[160,70,160]};
  if(t.startsWith("bet-confirm-"))return {emoji:"🎟️",vibrate:[160,70,160]};
  if(t.includes("final-"))return {emoji:"📊",vibrate:[180,70,180]};
  if(t.startsWith("result-")||t.startsWith("qg-result-"))return {emoji:"⚽",vibrate:[140,60,140]};
  if(t.includes("both-complete")||t.includes("complete-"))return {emoji:"✅",vibrate:[140,60,140]};
  if(t.startsWith("journey-")||t.startsWith("qg-journey-"))return {emoji:"📅",vibrate:[120,60,120]};
  if(t.startsWith("room-complete-"))return {emoji:"👥",vibrate:[120,60,120]};
  return {emoji:"🔔",vibrate:[120]};
}
self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?event.data.text():""}}
  const tag=data.tag||"quiniela-push";
  const visual=pushVisual(tag);
  const rawTitle=data.title||"Nuestra Quiniela";
  const title=/^[\p{Extended_Pictographic}]/u.test(rawTitle)?rawTitle:`${visual.emoji} ${rawTitle}`;
  event.waitUntil(self.registration.showNotification(title,{
    body:data.body||"",
    icon:"icon-192.svg",
    badge:"icon-192.svg",
    tag,
    data:{url:data.url||"./"},
    renotify:true,
    timestamp:Date.now(),
    vibrate:visual.vibrate
  }));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"./",self.location.origin).href;
  event.waitUntil((async()=>{
    const clientsList=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of clientsList){
      if("navigate" in client) try{await client.navigate(target)}catch{}
      if("focus" in client) return client.focus();
    }
    if(self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
