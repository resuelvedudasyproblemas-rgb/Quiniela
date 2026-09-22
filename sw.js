const CACHE="quiniela-v94";
const CORE=["./","index.html","styles.css","app.js","config.js","manifest.webmanifest","icon-192.svg","icon-512.svg"];

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


self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?event.data.text():""}}
  const title=data.title||"Nuestra Quiniela";
  event.waitUntil(self.registration.showNotification(title,{
    body:data.body||"",
    icon:"icon-192.svg",
    badge:"icon-192.svg",
    tag:data.tag||"quiniela-push",
    data:{url:data.url||"./"},
    renotify:true
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
