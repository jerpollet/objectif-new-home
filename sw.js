/* Garde une copie du site pour qu'il s'ouvre sans réseau.
   Réseau d'abord (les mises à jour arrivent tout de suite), copie en secours.
   Les appels à l'API (script.google.com) ne passent jamais par ici. */
var CACHE = "onh-v3-4";
var COQUILLE = ["./", "index.html", "styles.css", "app.js", "config.js", "manifest.webmanifest",
  "icones/icone.svg", "icones/icone-180.png", "icones/icone-192.png", "icones/icone-512.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(COQUILLE); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(cles){
    return Promise.all(cles.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin){
    /* Une navigation avec paramètres (partage reçu : ?partage_texte=…) est rangée sous l'adresse sans paramètres :
       le cache ne garde ni le texte partagé ni une copie par partage. */
    var cle = req.mode === "navigate" && url.search ? url.origin + url.pathname : req;
    e.respondWith(fetch(req).then(function(rep){
      if (rep.ok){ var copie = rep.clone(); caches.open(CACHE).then(function(c){ c.put(cle, copie); }); }
      return rep;
    }).catch(function(){
      return caches.match(req, {ignoreSearch:true}).then(function(r){
        return r || (req.mode === "navigate" ? caches.match("index.html") : Response.error());
      });
    }));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){
    e.respondWith(caches.match(req).then(function(r){
      return r || fetch(req).then(function(rep){
        var copie = rep.clone(); caches.open(CACHE).then(function(c){ c.put(req, copie); });
        return rep;
      });
    }));
  }
});
