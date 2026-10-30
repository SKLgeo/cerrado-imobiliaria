// Service worker do link da imobiliária (gerado por Web_Imobiliaria/gerar.js).
// Rede primeiro (o corretor sempre vê a versão nova); sem internet, usa a última cópia guardada.
// O nome do cache tem prefixo do cliente e a limpeza só apaga caches com esse prefixo.
const CACHE_PREFIX = "cerrado-imobiliaria-imob-";
const CACHE_NAME = CACHE_PREFIX + "0.14.8-mvucq9iq";
const CORE_ASSETS = [ "./", "./index.html", "./styles.css", "./app.js", "./marca.js", "./logo.png", "./manifest.webmanifest",
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png", "./vendor/supabase/supabase.js" ];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL("./", self.location.href).pathname)) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request.url, { cache: "no-store" }).catch(() => caches.match(request).then((r) => r || caches.match("./index.html"))));
    return;
  }
  event.respondWith(fetch(request.url, { cache: "no-store" }).then((response) => {
    if (response.ok) { const copia = response.clone(); caches.open(CACHE_NAME).then((c) => c.put(request, copia)); }
    return response;
  }).catch(() => caches.match(request)));
});

// Avisos do app (Web Push, enviados pela Edge Function notificar-push): mostra a notificação mesmo com o app fechado
// e, ao tocar, abre (ou traz para frente) o app.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { titulo: "Aviso", corpo: event.data ? event.data.text() : "" }; }
  const icone = new URL("./assets/icons/icon-192.png", self.registration.scope).href;
  event.waitUntil(self.registration.showNotification(d.titulo || "Aviso", {
    body: d.corpo || "", tag: d.id || undefined, renotify: !!d.id, icon: icone, badge: icone, data: { aviso: d }
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const aviso = (event.notification.data || {}).aviso || null;
  const alvo = new URL("./" + (aviso && aviso.id ? "?aviso=" + encodeURIComponent(aviso.id) : ""), self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
    for (const j of janelas) {
      if ("focus" in j) { j.postMessage({ tipo: "aviso-aberto", aviso }); return j.focus(); }
    }
    return self.clients.openWindow(alvo);
  }));
});
