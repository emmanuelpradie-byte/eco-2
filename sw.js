// Économat Pro — Service Worker
// Met l'appli en cache pour l'ouvrir hors connexion et instantanément.
// Les données restent dans le navigateur (IndexedDB) : le service worker n'y touche pas.

const CACHE_NAME = 'economat-d05c390810';
const LIB_CACHE = 'economat-libs-v1';
const CORE_ASSETS = ["./", "./index.html", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(CORE_ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME && k !== LIB_CACHE; }).map(function(k){ return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  // Bibliothèques (PDF, lecture de PDF, OCR) : gardées en cache après la
  // première utilisation, pour fonctionner ensuite sans connexion.
  if(url.hostname === 'cdnjs.cloudflare.com'){
    e.respondWith(caches.open(LIB_CACHE).then(function(c){
      return c.match(e.request).then(function(hit){
        return hit || fetch(e.request).then(function(res){ if(res.ok||res.type==='opaque') c.put(e.request, res.clone()); return res; });
      });
    }));
    return;
  }
  if(url.origin !== location.origin) return;

  var accept = e.request.headers.get('accept') || '';
  var isHTML = e.request.mode === 'navigate' || accept.indexOf('text/html') !== -1;
  if(isHTML){
    // Réseau d'abord : récupère les mises à jour, cache si hors connexion
    e.respondWith(fetch(e.request).then(function(res){
      var copy = res.clone(); caches.open(CACHE_NAME).then(function(c){ c.put(e.request, copy); }); return res;
    }).catch(function(){
      return caches.match(e.request).then(function(r){ return r || caches.match('./index.html'); });
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(cached){
    return cached || fetch(e.request).then(function(res){
      var copy = res.clone(); caches.open(CACHE_NAME).then(function(c){ c.put(e.request, copy); }); return res;
    });
  }));
});
