// Économat Pro — Service Worker
// Cache l'app pour un fonctionnement hors connexion et un démarrage instantané.
// N'intercepte jamais les données : localStorage reste géré par la page elle-même.

const CACHE_NAME = 'economat-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Stratégie : réseau d'abord pour l'HTML (récupère les mises à jour),
// cache d'abord pour le reste (icônes, manifest) — et repli sur le cache
// si le réseau est indisponible, pour que l'app s'ouvre même hors connexion.
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;

  var url = new URL(e.request.url);
  if(url.origin !== location.origin) return; // ne touche pas aux CDN externes (jsPDF, XLSX, etc.)

  var isHTML = e.request.mode === 'navigate' || e.request.headers.get('accept').indexOf('text/html') !== -1;

  if(isHTML){
    e.respondWith(
      fetch(e.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ c.put(e.request, copy); });
        return res;
      }).catch(function(){
        return caches.match(e.request).then(function(r){ return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function(cached){
      return cached || fetch(e.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ c.put(e.request, copy); });
        return res;
      });
    })
  );
});
