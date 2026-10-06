(function () {
  "use strict";
  var CONFIG = window.CONFIG || {};
  var PROD = location.origin === CONFIG.ORIGINE_PROD;
  var MODE_TEST = CONFIG.MODE_TEST === true || (!PROD && /[?&]test=1(&|$)/.test(location.search));
  var LS_CLE = "onh-cle", LS_CACHE = MODE_TEST ? "onh-cache-test" : "onh-cache-v3", LS_UI = "onh-ui", LS_API = "onh-api-test";
  var DELAI_MAX = 25000, DELAI_RELECTURE = 30000, JOUR = 864e5;
  var NOTAIRE = 0.075, MAX_COMPARER = 3;
  /* Plafonds, cibles par Prio et critères : servis par l'API avec la clé (onglet Réglages), jamais dans le dépôt. */
  var PRIOS = {}, PLAFOND = null, PLAFOND_MAX = null, CRITERES = [];
  var TRIS = [
    {id:"pertinence", nom:"Pertinence", court:"Pertinence", sous:"Adéquation IA"},
    {id:"prixAsc", nom:"Prix croissant", court:"Prix ↑"},
    {id:"prixDesc", nom:"Prix décroissant", court:"Prix ↓"},
    {id:"recent", nom:"Plus récentes", court:"Récentes"}
  ];
  var CHAMPS_STATUT = ["favori", "enContact", "enContactDepuis", "corbeille", "corbeilleLe", "statutLe", "raisonCorbeille"];
  var API_TEST = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

  /* ---------- Outils ---------- */
  function el(tag, attrs, enfants){
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs){
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === "texte") n.textContent = v;
      else if (k === "classe") n.className = v;
      else if (k.slice(0,2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    (enfants || []).forEach(function(c){ if (c !== null && c !== undefined && c !== false) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  /* Icônes Lucide (trait de 2 px), en SVG inline. Chaînes constantes : aucune donnée du tableau. */
  var ICONES = {
    heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    externe:'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    colonnes:'<rect width="18" height="18" x="3" y="3"/><path d="M12 3v18"/>',
    lignes:'<rect width="18" height="18" x="3" y="3"/><path d="M3 12h18"/>',
    menu:'<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    maison:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    check:'<path d="M20 6 9 17l-5-5"/>',
    alerte:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    cible:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    tri:'<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
    retour:'<path d="m15 18-6-6 6-6"/>',
    fleche:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    gauche:'<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    partager:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>'
  };
  function ico(nom, plein){
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", plein ? "currentColor" : "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("class", "ico ico-" + nom);
    s.innerHTML = ICONES[nom];
    return s;
  }
  var $ = function(id){ return document.getElementById(id); };
  function txt(v){ return typeof v === "string" ? v.trim() : (v == null ? "" : String(v)); }
  function estNb(n){ return typeof n === "number" && isFinite(n); }
  var NF = new Intl.NumberFormat("fr-FR");
  function nb(n){ return NF.format(n); }
  function euros(n){ return NF.format(Math.round(n)) + " €"; }
  function kEuros(n){ return NF.format(Math.round(n / 1000)) + " k€"; }
  function lienSur(u){ return (typeof u === "string" && /^https?:\/\/[^\s"<>]+$/i.test(u.trim())) ? u.trim() : null; }
  function tronquer(s, n){ return s.length > n ? s.slice(0, n) + "…" : s; }
  function pluriel(n, mot, motPluriel){ return n + " " + (n > 1 ? (motPluriel || mot + "s") : mot); }
  function date(iso){ var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d : null; }
  function fmtDate(iso, o){ var d = date(iso); if (!d) return ""; o.timeZone = "Europe/Paris"; return d.toLocaleDateString("fr-FR", o); }
  function dateCourte(iso){ return fmtDate(iso, {day:"numeric", month:"short"}); }
  function jourCourt(iso){ return fmtDate(iso, {weekday:"short", day:"numeric", month:"short"}); }
  function heure(iso){ var d = date(iso); return d ? d.toLocaleTimeString("fr-FR", {timeZone:"Europe/Paris", hour:"2-digit", minute:"2-digit"}) : ""; }
  function majuscule(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }
  function arrondi5(x){ return Math.round(x / 5) * 5; }

  /* ---------- Calculs (rien d'autre n'est estimé) ---------- */
  function lieu(a){ return txt(a.quartier) || txt(a.commune) || "Quartier inconnu"; }
  function lieuComplet(a){
    var q = txt(a.quartier), c = txt(a.commune);
    if (q && c && q.toLowerCase() !== c.toLowerCase()) return q + " · " + c;
    return lieu(a);
  }
  function prixM2(a){ return estNb(a.prix) && estNb(a.surface) && a.surface > 0 ? Math.round(a.prix / a.surface / 10) * 10 : null; }
  function fraisCompris(a){ return estNb(a.prix) ? a.prix * (1 + NOTAIRE) : null; }
  function dpe(a){ var d = txt(a.dpe).toUpperCase(); return /^[A-G]$/.test(d) ? d : null; }
  function estNew(a){ var d = date(a.repereeLe); return !!d && Date.now() - d.getTime() < 7 * JOUR; }
  function drapeau(a){
    if (!estNb(a.prix) || !estNb(PLAFOND) || !estNb(PLAFOND_MAX)) return null;
    var tc = Math.round(a.prix * (1 + NOTAIRE) / 1000) * 1000, P = PRIOS[a.prio];
    if (tc > PLAFOND_MAX) return "Au-delà de " + kEuros(PLAFOND_MAX) + " frais compris";
    if (tc > PLAFOND) return "Au-delà de " + kEuros(PLAFOND) + " frais compris";
    if (P && tc > P.cibleMax) return "Au-dessus de la cible";
    return "Prix dans la cible";
  }
  function etatNorm(a){
    var e = txt(a.etat).toLowerCase();
    if (/rafra/.test(e)) return "À rafraîchir";
    if (/r[ée]nov/.test(e)) return "À rénover";
    if (/habitable/.test(e)) return "Habitable en l'état";
    return null;
  }
  /* Montant annuel plausible : écarte une cellule mal formatée dans le tableau plutôt que d'afficher un nombre absurde. */
  function annuel(v){ return estNb(v) && v > 0 && v < 1e5 ? v : null; }
  function energieMois(a){
    var mi = annuel(a.energieMin), ma = annuel(a.energieMax);
    if (mi === null && ma === null) return null;
    var lo = arrondi5((mi !== null ? mi : ma) / 12), hi = arrondi5((ma !== null ? ma : mi) / 12);
    return {lo:Math.min(lo, hi), hi:Math.max(lo, hi)};
  }
  function taxeMois(a){ var t = annuel(a.taxeFonciere); return t !== null ? arrondi5(t / 12) : null; }
  function fourchette(f){ return f.lo === f.hi ? nb(f.lo) + " €" : nb(f.lo) + " à " + nb(f.hi) + " €"; }
  function adequation(a){ return estNb(a.score) ? Math.round(a.score) : null; }

  /* Ligne de critères des cartes. L'état n'y figure que s'il appelle une vigilance. */
  function criteres(a, court){
    var p = [];
    p.push(estNb(a.surface) ? nb(a.surface) + " m²" : "surface ?");
    if (estNb(a.pieces)) p.push(a.pieces + " p.");
    p.push(estNb(a.chambres) ? a.chambres + " ch." : "ch. non précisé");
    p.push(estNb(a.terrain) ? "Jardin " + nb(a.terrain) + " m²" : "jardin ?");
    if (court) return p.join(" · ");
    p.push(dpe(a) ? "DPE " + dpe(a) : "DPE ?");
    if (a.garage === true) p.push("Garage"); else if (a.garage === false) p.push("Sans garage");
    var e = etatNorm(a);
    if (e === "À rafraîchir" || e === "À rénover") p.push(e.toLowerCase());
    return p.join(" · ");
  }

  /* ---------- État ---------- */
  var S = {
    cle:null, api:CONFIG.API_URL, route:{nom:"accueil"}, fond:{nom:"accueil"}, fichePush:false,
    bureau:false, menu:false, tri:null, triBrouillon:null, choix:false,
    chargement:false, echec:false, dernierEssai:0, erreurTexte:"",
    ops:{}, files:{}, confirmer:null,
    ajout:{texte:"", resultats:null, coches:{}, verif:false, envoi:false, fait:null}
  };
  var D = null;
  var UI = {viewMode:"cards", sort:"pertinence", favoris:false, nouveau:false, compareIds:[], prio:1};
  (function(){
    try {
      var u = JSON.parse(lsGet(LS_UI) || "{}");
      if (u.viewMode === "list" || u.viewMode === "cards") UI.viewMode = u.viewMode;
      if (TRIS.some(function(t){ return t.id === u.sort; })) UI.sort = u.sort;
      UI.favoris = u.favoris === true; UI.nouveau = u["new"] === true;
      if (Array.isArray(u.compareIds)) UI.compareIds = u.compareIds.filter(estNb).slice(0, MAX_COMPARER);
      if ([1,2,3,4].indexOf(u.prio) >= 0) UI.prio = u.prio;
    } catch(e){}
  })();
  function sauverUI(){
    lsSet(LS_UI, JSON.stringify({viewMode:UI.viewMode, sort:UI.sort, favoris:UI.favoris, "new":UI.nouveau, compareIds:UI.compareIds, prio:UI.prio}));
  }

  function annonces(){ return D ? D.annonces.filter(function(a){ return !a.masquee; }) : []; }
  function enLice(){ return annonces().filter(function(a){ return !a.corbeille; }); }
  function parPrio(n){ return enLice().filter(function(a){ return a.prio === n; }); }
  function suivis(){ return enLice().filter(function(a){ return a.enContact; }); }
  function dansCorbeille(){
    return annonces().filter(function(a){ return a.corbeille; }).sort(function(x, y){
      return txt(y.corbeilleLe || y.statutLe).localeCompare(txt(x.corbeilleLe || x.statutLe));
    });
  }
  function trouver(num){
    if (!D) return null;
    for (var i = 0; i < D.annonces.length; i++) if (D.annonces[i].num === num && !D.annonces[i].masquee) return D.annonces[i];
    return null;
  }
  function filtrer(l, avecNew){
    if (UI.favoris) l = l.filter(function(a){ return a.favori; });
    if (avecNew && UI.nouveau) l = l.filter(estNew);
    return l;
  }
  function comparerNb(x, y, desc){
    var vx = estNb(x), vy = estNb(y);
    if (!vx && !vy) return 0; if (!vx) return 1; if (!vy) return -1;
    return desc ? y - x : x - y;
  }
  function trier(l, suivi){
    var c = l.slice();
    c.sort(function(x, y){
      var r = 0;
      if (UI.sort === "prixAsc") r = comparerNb(x.prix, y.prix);
      else if (UI.sort === "prixDesc") r = comparerNb(x.prix, y.prix, true);
      else if (UI.sort === "recent"){
        var k = suivi ? "enContactDepuis" : "repereeLe";
        var dx = date(x[k]), dy = date(y[k]);
        r = comparerNb(dx && dx.getTime(), dy && dy.getTime(), true);
      }
      else r = comparerNb(x.score, y.score, true) || ((y.pepite ? 1 : 0) - (x.pepite ? 1 : 0));
      return r || (x.num - y.num);
    });
    return c;
  }
  function nettoyerComparer(){
    if (!D) return;
    var avant = UI.compareIds.length;
    UI.compareIds = UI.compareIds.filter(function(n){ var a = trouver(n); return a && !a.corbeille; });
    if (UI.compareIds.length !== avant) sauverUI();
  }

  /* ---------- Messages en bas d'écran ---------- */
  var minuteur = null;
  function message(t, genre){
    var z = $("message");
    z.textContent = t || ""; z.hidden = !t;
    z.className = "message" + (genre === "erreur" ? " erreur" : "");
    clearTimeout(minuteur);
    if (t) minuteur = setTimeout(function(){ z.hidden = true; }, genre === "erreur" ? 6000 : 2600);
  }
  $("message").addEventListener("click", function(){ this.hidden = true; });

  /* ---------- API ---------- */
  function erreur(texte, cle){ var e = new Error(texte); e.cle = !!cle; e.api = true; return e; }
  function erreurApi(r){
    var t = r && typeof r.erreur === "string" ? r.erreur : "Réponse inattendue du serveur.";
    return erreur(t, /cl[ée] absente ou incorrecte/i.test(t));
  }
  function appel(url, opts){
    opts = opts || {};
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    if (ctrl) opts.signal = ctrl.signal;
    var t = setTimeout(function(){ if (ctrl) ctrl.abort(); }, DELAI_MAX);
    return fetch(url, opts).then(function(rep){
      if (!rep.ok) throw erreur("Le serveur a répondu " + rep.status + ".");
      return rep.json().catch(function(){ throw erreur("Réponse illisible du serveur."); });
    }).then(function(r){
      clearTimeout(t);
      if (!r || r.ok !== true) throw erreurApi(r);
      return r;
    }, function(e){
      clearTimeout(t);
      if (e && e.api) throw e;
      if (navigator.onLine === false) throw erreur("Pas de connexion internet.");
      throw erreur(e && e.name === "AbortError" ? "Le serveur met trop de temps à répondre." : "Le serveur ne répond pas.");
    });
  }
  function lire(){
    if (MODE_TEST) return test.lire();
    if (!S.api) return Promise.reject(erreur("Adresse de l'API manquante dans config.js."));
    return appel(S.api + "?cle=" + encodeURIComponent(S.cle), {cache:"no-store"});
  }
  function ecrire(corps){
    if (MODE_TEST) return test.ecrire(corps);
    var envoi = {cle:S.cle};
    for (var k in corps) envoi[k] = corps[k];
    /* text/plain : pas de requête préalable CORS, qu'Apps Script ne sait pas traiter. */
    return appel(S.api, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify(envoi)});
  }

  /* Mode test : lit test/donnees-exemple.json et simule les écritures en mémoire. */
  var test = {
    base:null,
    copie:function(o){ return JSON.parse(JSON.stringify(o)); },
    charger:function(){
      if (test.base) return Promise.resolve(test.base);
      return fetch("test/donnees-exemple.json", {cache:"no-store"}).then(function(r){ return r.json(); }).then(function(d){
        /* Les dates fictives sont recalées pour que la plus récente date d'hier. */
        var max = 0;
        d.annonces.forEach(function(a){ var x = date(a.repereeLe); if (x && x.getTime() > max) max = x.getTime(); });
        var decal = max ? Date.now() - JOUR - max : 0;
        function recaler(o, k){ var x = date(o[k]); if (x) o[k] = new Date(x.getTime() + decal).toISOString(); }
        d.annonces.forEach(function(a){ ["repereeLe","statutLe","enContactDepuis","corbeilleLe"].forEach(function(k){ recaler(a, k); }); });
        (d.ajouts || []).forEach(function(x){ recaler(x, "ajouteLe"); });
        recaler(d.rapport, "derniereVeille");
        test.base = d; return d;
      });
    },
    attendre:function(v){ return new Promise(function(ok){ setTimeout(function(){ ok(v); }, 600); }); },
    /* ?echec=1 : le tableau est injoignable ; ?echec=ecriture : seules les écritures échouent. */
    echouer:function(ecriture){
      var m = location.search.match(/[?&]echec=(1|ecriture)(&|$)/);
      return !!CONFIG.TEST_ECHEC || (!!m && (m[1] === "1" || !!ecriture));
    },
    lire:function(){
      return test.charger().then(function(d){
        if (test.echouer()) return test.attendre().then(function(){ throw erreur("Le serveur ne répond pas (échec simulé)."); });
        var r = test.copie({rapport:d.rapport, reglages:d.reglages, annonces:d.annonces.filter(function(a){ return !a.masquee; })});
        r.ok = true; r.lu = new Date().toISOString();
        return test.attendre(r);
      });
    },
    /* Version simplifiée de analyserLien_ (Code.gs) : même désenveloppement, mêmes hôtes de suivi. */
    analyser:function(u, deroule){
      var m = String(u || "").trim().match(/^https?:\/\/(?:www\.)?([^\/?#\s]+)([^?#\s]*)(\?[^#\s]*)?/i);
      if (!m) return null;
      var hote = m[1].toLowerCase(), chemin = m[2].replace(/\/+$/, "");
      if (!deroule){
        var cible = cibleRedirection(m[3], hote);
        if (cible){ var r = test.analyser(cible, true); if (r){ if (!r.suivi) r.direct = cible; return r; } }
      }
      if (!/\d{6,}/.test(chemin) && estHoteSuivi(hote)) return {suivi:true, hote:hote, cle:"suivi:" + (hote + chemin + (m[3] || "")).toLowerCase()};
      var q = (m[3] || "").slice(1).split("&").filter(function(p){ return p && !/^(utm_|xtor|gclid|fbclid)/i.test(p); }).sort().join("&");
      return {cle:(hote + chemin + (q ? "?" + q : "")).toLowerCase()};
    },
    cle:function(u){ var r = test.analyser(u); return r ? r.cle : null; },
    verifier:function(d, liens){
      var vus = {}, res = [];
      liens.forEach(function(l){
        var t = String(l).trim(); if (!t) return;
        var an = test.analyser(t), k = an ? an.cle : null, id = k ? "L" + k : "T" + t;
        if (vus[id]){ vus[id].nb++; return; }
        var r = {entree:t, nb:1}; vus[id] = r; res.push(r);
        if (!k){ r.etat = "INVALIDE"; return; }
        if (an.suivi){ r.etat = "LIEN_SUIVI"; r.hote = an.hote; return; }
        if (an.direct) r.direct = an.direct;
        var a = d.annonces.filter(function(x){ return test.cle(x.lien) === k; });
        var corb = a.filter(function(x){ return x.corbeille; })[0], autre = a.filter(function(x){ return !x.corbeille; })[0];
        var att = (d.ajouts || []).filter(function(x){ return !x.traite && test.cle(x.lien) === k; })[0];
        var vu = (d.ajouts || []).filter(function(x){ return x.traite && test.cle(x.lien) === k; }).sort(function(x, y){ return txt(y.traiteLe).localeCompare(txt(x.traiteLe)); })[0];
        if (corb){ r.etat = "IGNOREE"; r.num = corb.num; r.prio = corb.prio; r.quartier = corb.quartier; r.commune = corb.commune; r.corbeilleLe = corb.corbeilleLe; }
        else if (autre){ r.etat = "DOUBLON"; r.num = autre.num; r.prio = autre.prio; r.quartier = autre.quartier; r.commune = autre.commune; if (autre.masquee){ r.masquee = true; r.raisonMasquee = autre.raisonMasquee; } }
        else if (att){ r.etat = "EN_ATTENTE"; r.envoyeLe = att.ajouteLe; }
        else if (vu){ r.etat = "DEJA_ANALYSEE"; r.traiteLe = vu.traiteLe; r.resultat = vu.resultat; }
        else r.etat = "A_TRAITER";
      });
      return res;
    },
    ecrire:function(c){
      return test.charger().then(function(d){
        if (test.echouer(true)) return test.attendre().then(function(){ throw erreur("Échec simulé."); });
        if (c.action === "verifierLiens") return test.attendre({ok:true, resultats:test.verifier(d, c.liens)});
        if (c.action === "ajouter"){
          var res = test.verifier(d, c.liens), ok = res.filter(renvoyable);
          d.ajouts = d.ajouts || [];
          ok.forEach(function(r){ d.ajouts.push({lien:r.direct || r.entree, ajouteLe:new Date().toISOString()}); });
          return test.attendre({ok:true, ajoutes:ok.map(function(r){ return r.entree; }), ecartes:res.filter(function(r){ return !renvoyable(r); })});
        }
        var a = null;
        d.annonces.forEach(function(x){ if (x.num === c.num && !x.masquee) a = x; });
        if (!a) return test.attendre().then(function(){ throw erreur("Annonce n°" + c.num + " introuvable."); });
        appliquerStatut(a, c.action, c.valeur, new Date().toISOString());
        return test.attendre({ok:true, annonce:test.copie(a)});
      });
    }
  };

  /* ---------- Clé d'accès et adresse ---------- */
  function lireAdresse(){
    var h = (location.hash || "").replace(/^#/, ""), r = {route:"", cle:null, api:null};
    h.split("&").forEach(function(p){
      if (!p) return;
      var i = p.indexOf("="), k = i < 0 ? p : p.slice(0, i), v = i < 0 ? "" : p.slice(i + 1);
      try { v = decodeURIComponent(v); } catch(e){ v = ""; }
      if (k === "cle") r.cle = v.trim();
      else if (k === "api") r.api = v.trim();
      else if (!r.route) r.route = p;
    });
    return r;
  }
  function analyserRoute(t){
    var m;
    if ((m = t.match(/^prio\/?([1-4])$/))) return {nom:"prio", n:Number(m[1])};
    if ((m = t.match(/^fiche\/(\d+)$/))) return {nom:"fiche", num:Number(m[1])};
    if (/^(suivi|comparer|ajouter|corbeille)$/.test(t)) return {nom:t};
    return {nom:"accueil"};
  }
  function texteRoute(r){
    if (r.nom === "prio") return "prio/" + r.n;
    if (r.nom === "fiche") return "fiche/" + r.num;
    return r.nom;
  }
  /* Le paramètre cle reste dans l'adresse : un lien copié ou ajouté à l'écran d'accueil garde l'accès. */
  function hashPour(r){ return "#" + texteRoute(r) + (S.cle ? "&cle=" + encodeURIComponent(S.cle) : ""); }
  function aller(r, remplacer){
    var h = hashPour(r);
    if (remplacer){ try { history.replaceState(null, "", h); } catch(e){} surRoute(); }
    else if (location.hash === h) surRoute();
    else location.hash = h;
  }
  function surRoute(){
    var adr = lireAdresse();
    if (adr.cle && adr.cle !== S.cle){
      S.cle = adr.cle; lsSet(LS_CLE, adr.cle);
      if (D && !MODE_TEST) charger(true);
    }
    var r = analyserRoute(adr.route);
    var avant = S.route;
    S.menu = false; S.tri = null; S.choix = false;
    if (r.nom === "fiche"){
      if (!S.demarre) S.fondAuto = true;
      else if (avant.nom !== "fiche") S.fond = avant;
      if (S.fond.nom === "fiche" || S.fond.nom === "ajouter") S.fond = {nom:"accueil"};
    } else {
      S.fichePush = false;
      S.fond = r;
    }
    if (r.nom === "prio"){ UI.prio = r.n; sauverUI(); }
    S.route = r;
    var changePage = texteRoute(r.nom === "fiche" ? S.fond : r) !== texteRoute(avant.nom === "fiche" ? S.fond : avant);
    S.demarre = true;
    rendre();
    if (changePage && r.nom !== "fiche") window.scrollTo(0, 0);
    /* L'adresse sans route (#cle=…) devient #accueil&cle=… */
    if (location.hash !== hashPour(r)){ try { history.replaceState(null, "", hashPour(r)); } catch(e){} }
  }
  function ouvrirFiche(num){ S.fichePush = true; aller({nom:"fiche", num:num}); }
  function fermerFiche(){
    if (S.route.nom !== "fiche") return;
    if (S.fichePush){ S.fichePush = false; history.back(); }
    else aller(S.fond, true);
  }
  function cleInvalide(){
    lsDel(LS_CLE); lsDel(LS_CACHE);
    S.cle = null; D = null; S.cleRefusee = true; appliquerReglages(null);
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    rendre();
  }

  /* ---------- Cache et chargement ---------- */
  function lireCache(){
    try {
      var c = JSON.parse(lsGet(LS_CACHE) || "null");
      return c && Array.isArray(c.annonces) ? c : null;
    } catch(e){ return null; }
  }
  function ecrireCache(){ if (D) lsSet(LS_CACHE, JSON.stringify({lu:D.lu, rapport:D.rapport, reglages:D.reglages, annonces:D.annonces})); }
  function appliquerReglages(g){
    g = g || {};
    PLAFOND = estNb(g.plafond) ? g.plafond : null;
    PLAFOND_MAX = estNb(g.plafondMax) ? g.plafondMax : PLAFOND;
    PRIOS = g.prios && typeof g.prios === "object" ? g.prios : {};
    CRITERES = Array.isArray(g.criteres) ? g.criteres.map(txt).filter(Boolean) : [];
  }
  function charger(force){
    if (S.chargement || (!MODE_TEST && !S.cle)) return;
    if (!force && Date.now() - S.dernierEssai < DELAI_RELECTURE) return;
    S.dernierEssai = Date.now();
    S.chargement = true;
    rendreEtatChargement();
    /* Toute erreur (réseau, réponse, traitement) termine le chargement avec un message : jamais d'attente sans fin. */
    lire().then(function(r){
      appliquer(r);
      S.echec = false;
      ecrireCache();
    }).catch(function(e){
      if (e && e.cle){ cleInvalide(); return; }
      if (!(e && e.api) && window.console) console.error(e);
      S.echec = true; S.erreurTexte = (e && e.message) || "Erreur inconnue.";
    }).then(function(){
      S.chargement = false;
      rendre();
    });
  }
  function appliquer(r){
    var liste = Array.isArray(r.annonces) ? r.annonces : [];
    /* Une écriture en cours garde sa version locale (mise à jour optimiste). */
    liste = liste.map(function(a){
      if (!S.ops[a.num]) return a;
      var local = trouver(a.num);
      if (local) CHAMPS_STATUT.forEach(function(k){ if (k in local) a[k] = local[k]; else delete a[k]; });
      return a;
    });
    D = {annonces:liste, rapport:r.rapport || {}, reglages:r.reglages || null, lu:r.lu || new Date().toISOString()};
    appliquerReglages(D.reglages);
    nettoyerComparer();
  }

  /* ---------- Écritures (optimistes) ---------- */
  function appliquerStatut(a, action, valeur, maintenant){
    if (action === "favori") a.favori = !!valeur;
    else if (action === "contact"){
      a.enContact = !!valeur;
      if (valeur){ if (!a.enContactDepuis) a.enContactDepuis = maintenant; }
      else delete a.enContactDepuis;
    } else if (action === "corbeille"){
      if (!a.corbeille) a.corbeilleLe = maintenant;
      a.corbeille = true; a.favori = false; a.enContact = false; delete a.enContactDepuis;
    } else if (action === "restaurer"){
      a.corbeille = false; delete a.corbeilleLe; delete a.raisonCorbeille;
    }
    a.statutLe = maintenant;
  }
  function changerStatut(a, action, valeur, apres){
    var num = a.num, avant = {};
    CHAMPS_STATUT.forEach(function(k){ if (k in a) avant[k] = a[k]; });
    appliquerStatut(a, action, valeur, new Date().toISOString());
    if (action === "corbeille") nettoyerComparer();
    S.ops[num] = (S.ops[num] || 0) + 1;
    rendre();
    if (apres) apres();
    /* Une file par annonce : deux appuis rapides partent dans l'ordre. */
    var corps = {action:action, num:num};
    if (action === "favori" || action === "contact") corps.valeur = !!valeur;
    S.files[num] = (S.files[num] || Promise.resolve()).then(function(){
      return ecrire(corps).then(function(r){
        S.ops[num]--;
        if (!S.ops[num]){
          delete S.ops[num];
          if (r.annonce && r.annonce.num === num){
            var b = trouver(num) || a;
            CHAMPS_STATUT.forEach(function(k){ if (k in r.annonce) b[k] = r.annonce[k]; else delete b[k]; });
          }
        }
        ecrireCache(); rendre();
      }, function(e){
        S.ops[num]--; if (!S.ops[num]) delete S.ops[num];
        if (e.cle){ cleInvalide(); return; }
        var b = trouver(num) || a;
        CHAMPS_STATUT.forEach(function(k){ if (k in avant) b[k] = avant[k]; else delete b[k]; });
        rendre();
        message("Pas enregistré : " + e.message, "erreur");
      });
    });
  }
  function basculerFavori(a){ if (!a.corbeille) changerStatut(a, "favori", !a.favori); }
  function basculerContact(a){ if (!a.corbeille) changerStatut(a, "contact", !a.enContact); }
  function mettreCorbeille(a){
    changerStatut(a, "corbeille", true, function(){
      if (S.route.nom === "fiche" && S.route.num === a.num) fermerFiche();
      message("Mise à la corbeille");
    });
  }
  function restaurer(a){ changerStatut(a, "restaurer", true, function(){ message("Restaurée dans la Prio " + a.prio); }); }
  /* Corbeille en deux temps, pour éviter un appui malheureux. */
  function boutonCorbeille(a, classe, contenu){
    var arme = S.confirmer === a.num;
    return el("button", {type:"button", classe:classe + (arme ? " a-confirmer" : ""), "aria-label":arme ? "Confirmer la mise à la corbeille" : "Mettre à la corbeille",
      onclick:function(e){
        e.stopPropagation();
        if (S.confirmer === a.num){ S.confirmer = null; mettreCorbeille(a); return; }
        S.confirmer = a.num; rendre();
        setTimeout(function(){ if (S.confirmer === a.num){ S.confirmer = null; rendre(); } }, 3500);
      }}, arme ? [ico("trash"), el("span", {texte:"Confirmer ?"})] : contenu);
  }
  function basculerComparer(num){
    var i = UI.compareIds.indexOf(num);
    if (i >= 0) UI.compareIds.splice(i, 1);
    else if (UI.compareIds.length < MAX_COMPARER) UI.compareIds.push(num);
    sauverUI(); rendre();
  }

  /* ---------- Briques d'affichage ---------- */
  function tags(a){
    var t = [];
    if (a.pepite) t.push(el("span", {classe:"tag tag-pepite", texte:"Pépite"}));
    if (estNew(a)) t.push(el("span", {classe:"tag tag-new", texte:"New"}));
    return t.length ? el("div", {classe:"tags"}, t) : null;
  }
  function repli(){ return el("div", {classe:"repli"}, [ico("maison"), el("span", {texte:"Sans photo"})]); }
  function image(a, o){
    o = o || {};
    var box = el("div", {classe:"img" + (o.classe ? " " + o.classe : "")});
    var url = lienSur(a.photo);
    if (url){
      var im = el("img", {src:url, alt:"", loading:o.direct ? null : "lazy", decoding:"async", referrerpolicy:"no-referrer"});
      im.addEventListener("error", function(){ im.remove(); box.classList.add("sans-photo"); box.insertBefore(repli(), box.firstChild); });
      box.appendChild(im);
    } else {
      box.classList.add("sans-photo");
      box.appendChild(repli());
    }
    if (o.tags !== false){ var t = tags(a); if (t) box.appendChild(t); }
    if (o.coeur) box.appendChild(coeur(a, "coeur-boite"));
    if (o.partage){ var bp = boutonPartager(a, "coeur partage-boite"); if (bp) box.appendChild(bp); }
    if (o.coeurIndic && a.favori) box.appendChild(el("span", {classe:"coeur-boite indic", "aria-label":"Favori"}, [ico("heart", true)]));
    return box;
  }
  function coeur(a, classe){
    return el("button", {type:"button", classe:"coeur" + (classe ? " " + classe : "") + (a.favori ? " actif" : ""), "aria-pressed":a.favori ? "true" : "false",
      "aria-label":(a.favori ? "Retirer des favoris" : "Ajouter aux favoris") + ", annonce n°" + a.num, disabled:a.corbeille,
      onclick:function(e){ e.stopPropagation(); basculerFavori(a); }}, [ico("heart", a.favori)]);
  }
  /* ---------- Partager une annonce ---------- */
  /* Lien de fiche SANS la clé d'accès : le message part dans WhatsApp ou un SMS. Ne pas utiliser hashPour(). */
  function lienFiche(num){ return location.origin + location.pathname + "#fiche/" + num; }
  function textePartage(a){
    var l1 = ["Annonce n°" + a.num];
    var lieuP = txt(a.quartier) || txt(a.commune);
    if (lieuP) l1.push(lieuP);
    if (estNb(a.surface)) l1.push(nb(a.surface) + " m²");
    if (estNb(a.prix)) l1.push(euros(a.prix));
    var lignes = [l1.join(" · "), "Fiche : " + lienFiche(a.num)];
    var url = lienSur(a.lien);
    if (url) lignes.push("Annonce : " + url);
    return lignes.join("\n");
  }
  /* Garde-fou : un texte qui contiendrait le paramètre de clé (#cle=, &cle=, ?cle=) n'est jamais partagé.
     Le préfixe évite de bloquer une annonce dont l'adresse contient « article= » ou « vehicle= ». */
  function partageSur(t){ return !/[#&?]cle=/i.test(t); }
  function copierTexte(t){
    if (!navigator.clipboard || !navigator.clipboard.writeText) return Promise.reject(new Error("presse-papier indisponible"));
    return navigator.clipboard.writeText(t);
  }
  function partager(a){
    var t = textePartage(a);
    if (!partageSur(t)){ message("Partage annulé : le lien contiendrait la clé d'accès.", "erreur"); return; }
    function repli(){
      copierTexte(t).then(function(){ message("Copié"); }, function(){ message("Copie impossible : partagez le lien de l'annonce à la main.", "erreur"); });
    }
    if (navigator.share){
      navigator.share({title:"Annonce n°" + a.num, text:t}).catch(function(e){ if (!(e && e.name === "AbortError")) repli(); });
    } else repli();
  }
  function boutonPartager(a, classe){
    if (a.corbeille) return null;
    return el("button", {type:"button", classe:classe, "aria-label":"Partager l'annonce n°" + a.num,
      onclick:function(e){ e.stopPropagation(); partager(a); }}, [ico("partager")]);
  }
  function badgePrio(a){ return el("span", {classe:"badge-prio", texte:a.prio ? "P" + a.prio : "P?"}); }
  function caseComparer(a){
    var coche = UI.compareIds.indexOf(a.num) >= 0, plein = !coche && UI.compareIds.length >= MAX_COMPARER;
    return el("label", {classe:"case-comparer" + (plein ? " desactive" : ""), onclick:function(e){ e.stopPropagation(); }}, [
      el("input", {type:"checkbox", checked:coche, disabled:plein, onchange:function(){ basculerComparer(a.num); }}),
      el("span", {classe:"case", "aria-hidden":"true"}),
      el("span", {texte:"Comparer"})
    ]);
  }
  function lienAnnonce(a, classe, contenu){
    var url = lienSur(a.lien);
    if (!url) return el("span", {classe:classe + " sans-lien", "aria-disabled":"true"}, ["Pas de lien"]);
    return el("a", {classe:classe, href:url, target:"_blank", rel:"noopener noreferrer", onclick:function(e){ e.stopPropagation(); }}, contenu);
  }
  function cliquable(noeud, num){
    noeud.setAttribute("tabindex", "0");
    noeud.setAttribute("role", "link");
    noeud.addEventListener("click", function(e){ if (e.target.closest("button, a, label, input")) return; ouvrirFiche(num); });
    noeud.addEventListener("keydown", function(e){ if ((e.key === "Enter" || e.key === " ") && e.target === noeud){ e.preventDefault(); ouvrirFiche(num); } });
    return noeud;
  }
  /* Niveau du drapeau, pour sa couleur : ok, cible, plafond, max. */
  function niveauDrapeau(a){
    if (!estNb(a.prix) || !estNb(PLAFOND) || !estNb(PLAFOND_MAX)) return null;
    var tc = Math.round(a.prix * (1 + NOTAIRE) / 1000) * 1000, P = PRIOS[a.prio];
    return tc > PLAFOND_MAX ? "max" : tc > PLAFOND ? "plafond" : (P && tc > P.cibleMax) ? "cible" : "ok";
  }
  function pastilleDrapeau(a){
    var d = drapeau(a);
    return d ? el("span", {classe:"drapeau dr-" + niveauDrapeau(a), texte:d}) : null;
  }
  function evaluation(a){
    var s = adequation(a);
    return el("div", {classe:"carte-eval"}, [pastilleDrapeau(a), s !== null ? el("span", {classe:"score", texte:"Adéquation " + s}) : null]);
  }

  /* ---------- Cartes et lignes ---------- */
  function carte(a, suivi){
    var choisie = S.route.nom === "fiche" && S.route.num === a.num && S.bureau;
    var m2 = prixM2(a);
    var corps = el("div", {classe:"carte-corps"}, [
      el("div", {classe:"carte-meta"}, [badgePrio(a), el("span", {classe:"source", texte:txt(a.source) || "Source inconnue"})]),
      el("div", {classe:"carte-prix"}, [el("span", {texte:estNb(a.prix) ? euros(a.prix) : "Prix non précisé"}), S.bureau && m2 ? el("span", {classe:"m2", texte:nb(m2) + " €/m²"}) : null]),
      el("div", {classe:"carte-lieu"}, [el("b", {texte:lieu(a)}), !S.bureau && m2 ? el("span", {classe:"m2", texte:" · " + nb(m2) + " €/m²"}) : null]),
      el("div", {classe:"carte-crit", texte:criteres(a)}),
      suivi
        ? el("div", {classe:"carte-contact"}, [ico("phone"), el("span", {texte:"En contact depuis le " + (dateCourte(a.enContactDepuis) || "?")})])
        : el("div", {classe:"carte-bas"}, [evaluation(a), caseComparer(a)])
    ]);
    var art = el("article", {classe:"carte" + (choisie ? " choisie" : "") + (suivi ? " carte-suivi" : ""), "aria-label":lieu(a) + ", " + (estNb(a.prix) ? euros(a.prix) : "prix non précisé")}, [
      el("div", {classe:"carte-haut"}, [image(a, {coeur:true, partage:true}), corps])
    ]);
    if (suivi){
      art.appendChild(el("div", {classe:"carte-actions"}, [
        el("button", {type:"button", classe:"act-retirer", onclick:function(e){ e.stopPropagation(); changerStatut(a, "contact", false, function(){ message("Retirée du suivi : elle reste dans sa Prio"); }); }}, ["Retirer du suivi"]),
        boutonCorbeille(a, "act-corbeille", [ico("trash")]),
        lienAnnonce(a, "act-annonce", [S.bureau ? "Voir l'annonce ↗" : "Annonce ↗"])
      ]));
    }
    return cliquable(art, a.num);
  }
  function ligneMobile(a){
    var m2 = estNb(a.surface) ? " · " + nb(a.surface) + " m²" : "";
    return cliquable(el("div", {classe:"ligne-annonce"}, [
      el("div", {classe:"la-txt"}, [
        el("div", {classe:"la-haut"}, [el("span", {classe:"la-prix", texte:estNb(a.prix) ? euros(a.prix) : "Prix ?"}), tags(a)]),
        el("div", {classe:"la-lieu"}, [el("b", {texte:lieu(a)}), m2])
      ]),
      coeur(a)
    ]), a.num);
  }
  function tableauBureau(liste){
    var corps = el("tbody");
    liste.forEach(function(a){
      var m2 = prixM2(a), choisie = S.route.nom === "fiche" && S.route.num === a.num;
      corps.appendChild(cliquable(el("tr", {classe:choisie ? "choisie" : null}, [
        el("td", {classe:"t-prix", texte:estNb(a.prix) ? euros(a.prix) : "—"}),
        el("td", {classe:"t-gris", texte:m2 ? nb(m2) + " €/m²" : "—"}),
        el("td", {classe:"t-lieu", texte:lieu(a)}),
        el("td", {texte:estNb(a.surface) ? nb(a.surface) + " m²" : "—"}),
        el("td", {texte:estNb(a.chambres) ? String(a.chambres) : "—"}),
        el("td", null, [tags(a)]),
        el("td", {classe:"t-gris", texte:"P" + a.prio + " · " + (txt(a.source) || "—")}),
        el("td", {classe:"t-coeur"}, [coeur(a)])
      ]), a.num));
    });
    return el("div", {classe:"tableau-defil"}, [el("table", {classe:"tableau"}, [
      el("thead", null, [el("tr", null, ["Prix","€/m²","Quartier","Surface","Ch.","Tags","Prio · source","Favori"].map(function(t){ return el("th", {scope:"col", texte:t}); }))]),
      corps
    ])]);
  }
  function squelettes(mode){
    var l = [];
    for (var i = 0; i < (mode === "list" ? 6 : 3); i++){
      l.push(mode === "list"
        ? el("div", {classe:"sq-ligne"}, [el("i"), el("i"), el("i")])
        : el("div", {classe:"sq-carte"}, [el("div", {classe:"sq-img"}), el("div", {classe:"sq-corps"}, [el("i"), el("i"), el("i"), el("i")])]));
    }
    return el("div", {classe:"squelettes " + (mode === "list" ? "sq-liste" : "sq-cartes"), "aria-hidden":"true"}, l);
  }

  /* ---------- Barre d'outils, tri ---------- */
  function libelleTri(){ return TRIS.filter(function(t){ return t.id === UI.sort; })[0]; }
  function barreOutils(type, n){
    var t = libelleTri();
    var boutonTri = el("button", {type:"button", classe:"puce puce-tri" + (S.tri ? " ouverte" : ""), "aria-haspopup":"true", "aria-expanded":S.tri ? "true" : "false",
      onclick:function(e){ e.stopPropagation(); S.tri = S.tri ? null : (S.bureau ? "menu" : "feuille"); S.triBrouillon = UI.sort; rendre(); }},
      S.bureau ? [ico("tri"), el("span", {texte:"Tri : " + t.nom}), el("span", {classe:"caret", "aria-hidden":"true", texte:S.tri ? "▴" : "▾"})] : [ico("tri"), el("span", {texte:t.court})]);
    var zoneTri = el("div", {classe:"zone-tri"}, [boutonTri, S.tri === "menu" ? menuTri() : null]);
    var outils = el("div", {classe:"outils"}, [
      S.bureau ? el("span", {classe:"outils-nb", texte:D ? (type === "suivi" ? n + " en contact" : pluriel(n, "annonce")) : "Chargement…"}) : null,
      zoneTri,
      el("button", {type:"button", classe:"puce", "aria-pressed":UI.favoris ? "true" : "false", onclick:function(){ UI.favoris = !UI.favoris; sauverUI(); rendre(); }}, [ico("heart", true), el("span", {texte:"Favoris"})]),
      type === "prio" ? el("button", {type:"button", classe:"puce", "aria-pressed":UI.nouveau ? "true" : "false", onclick:function(){ UI.nouveau = !UI.nouveau; sauverUI(); rendre(); }}, ["New"]) : null,
      el("span", {classe:"espace"}),
      el("div", {classe:"segmente", role:"group", "aria-label":"Affichage"}, [["cards","Cartes","lignes"],["list","Liste","menu"]].map(function(m){
        return el("button", {type:"button", "aria-pressed":UI.viewMode === m[0] ? "true" : "false", "aria-label":m[1],
          onclick:function(){ UI.viewMode = m[0]; sauverUI(); rendre(); }}, S.bureau ? [m[1]] : [ico(m[2])]);
      }))
    ]);
    return outils;
  }
  function optionsTri(choix, surChoix){
    return TRIS.map(function(t){
      return el("button", {type:"button", classe:"opt-tri", role:"menuitemradio", "aria-checked":choix === t.id ? "true" : "false", onclick:function(e){ e.stopPropagation(); surChoix(t.id); }}, [
        el("span", {classe:"radio", "aria-hidden":"true"}),
        el("span", {classe:"opt-txt"}, [el("b", {texte:t.nom}), t.sous ? el("small", {texte:t.sous}) : null])
      ]);
    });
  }
  function menuTri(){
    return el("div", {classe:"menu-tri", role:"menu"}, optionsTri(UI.sort, function(id){ UI.sort = id; S.tri = null; sauverUI(); rendre(); }));
  }
  function feuilleTri(){
    return couche("Trier", [
      el("p", {classe:"surtitre-sec", texte:"Trier par"}),
      el("div", {classe:"liste-tri", role:"menu"}, optionsTri(S.triBrouillon, function(id){ S.triBrouillon = id; rendre(); }))
    ], el("button", {type:"button", classe:"btn btn-accent btn-large", onclick:function(){ UI.sort = S.triBrouillon; S.tri = null; sauverUI(); rendre(); }}, [el("span", {texte:"Appliquer"}), ico("fleche")]),
    function(){ S.tri = null; rendre(); });
  }
  /* Feuille du bas générique (tri, choix pour comparer). */
  function couche(titre, contenu, pied, fermer){
    return el("div", {classe:"couche"}, [
      el("div", {classe:"voile", onclick:fermer}),
      el("div", {classe:"feuille", role:"dialog", "aria-modal":"true", "aria-label":titre}, [
        el("div", {classe:"feuille-tete"}, [el("h2", {texte:titre}), el("button", {type:"button", classe:"btn-ico", "aria-label":"Fermer", onclick:fermer}, [ico("x")])]),
        el("div", {classe:"feuille-corps"}, contenu),
        pied ? el("div", {classe:"feuille-pied"}, [pied]) : null
      ])
    ]);
  }

  /* ---------- Vue liste (Prio, Suivi) ---------- */
  function vueListe(type, n){
    var base = type === "prio" ? parPrio(n) : suivis();
    var liste = trier(filtrer(base, type === "prio"), type === "suivi");
    var panneau = S.bureau && S.route.nom === "fiche" ? panneauFiche() : null;
    var col = el("div", {classe:"col-liste"}, [barreOutils(type, liste.length)]);
    if (!D) col.appendChild(squelettes(UI.viewMode));
    else if (!liste.length){
      var filtre = UI.favoris || (type === "prio" && UI.nouveau);
      col.appendChild(el("p", {classe:"vide", texte:filtre ? "Aucune annonce ne correspond aux filtres." :
        type === "suivi" ? "Aucune annonce en contact. Utilisez « Contact » dans une fiche pour la suivre ici." : "Aucune annonce en Prio " + n + " pour l'instant."}));
    }
    else if (UI.viewMode === "list") col.appendChild(S.bureau ? tableauBureau(liste) : el("div", {classe:"lignes"}, liste.map(ligneMobile)));
    else col.appendChild(el("div", {classe:"cartes" + (type === "suivi" ? " cartes-suivi" : "")}, liste.map(function(a){ return carte(a, type === "suivi"); })));
    if (S.bureau && type === "prio" && UI.compareIds.length) col.appendChild(bandeauComparer());
    return el("div", {classe:"vue-liste" + (panneau ? " avec-panneau" : "")}, [col, panneau]);
  }
  function bandeauComparer(){
    var n = UI.compareIds.length;
    return el("div", {classe:"bandeau-comparer-in"}, [
      el("span", {texte:pluriel(n, "annonce sélectionnée", "annonces sélectionnées")}),
      el("button", {type:"button", onclick:function(){ aller({nom:"comparer"}); }}, ["Comparer →"])
    ]);
  }

  /* ---------- Fiche ---------- */
  function listeDuFond(){
    var f = S.fond;
    if (f.nom === "prio") return trier(filtrer(parPrio(f.n), true), false);
    if (f.nom === "suivi") return trier(filtrer(suivis(), false), true);
    return null;
  }
  function ligneCout(lib, val, o){
    o = o || {};
    return el("div", {classe:"cout-ligne" + (o.total ? " total" : "")}, [
      el("div", null, [el("span", {texte:lib}), o.sous ? el("small", {texte:o.sous}) : null]),
      val === null ? el("span", {classe:"inconnu", texte:o.inconnu || "non précisée"}) : el("b", {texte:val})
    ]);
  }
  function blocCout(a){
    var sec = el("section", {classe:"fiche-sec cout"}, [el("h3", {classe:"surtitre-sec", texte:"Coût"})]);
    if (estNb(a.prix)){
      var notaire = Math.round(a.prix * NOTAIRE / 100) * 100;
      sec.appendChild(ligneCout("Prix affiché", euros(a.prix)));
      sec.appendChild(ligneCout("Frais de notaire estimés", "≈ " + euros(notaire), {sous:"7,5 % · ancien"}));
      sec.appendChild(ligneCout("Prix frais compris", "≈ " + euros(a.prix + notaire), {total:true}));
    } else sec.appendChild(el("p", {classe:"inconnu", texte:"Prix non précisé dans l'annonce."}));
    var en = energieMois(a), tx = taxeMois(a);
    var ch = el("div", {classe:"charges"}, [el("h4", {classe:"surtitre-sec", texte:"Charges selon l'annonce"})]);
    if (!en && tx === null) ch.appendChild(el("p", {classe:"inconnu", texte:"Charges non précisées dans l'annonce."}));
    else {
      ch.appendChild(ligneCout("Énergie (estimation DPE)", en ? "≈ " + fourchette(en) + " / mois" : null));
      ch.appendChild(ligneCout("Taxe foncière", tx !== null ? "≈ " + nb(tx) + " € / mois" : null));
      if (en && tx !== null) ch.appendChild(ligneCout("Charges connues", "≈ " + fourchette({lo:en.lo + tx, hi:en.hi + tx}) + " / mois", {total:true, sous:"hors assurance"}));
    }
    sec.appendChild(ch);
    return sec;
  }
  function puces(a){
    var p = [];
    function puce(val, inconnu){ p.push(el("span", {classe:"chip" + (val ? "" : " inconnu"), texte:val || inconnu})); }
    puce(estNb(a.surface) ? nb(a.surface) + " m²" : null, "Surface non précisée");
    puce(estNb(a.pieces) ? pluriel(a.pieces, "pièce") : null, "Pièces non précisées");
    puce(estNb(a.chambres) ? pluriel(a.chambres, "chambre") : null, "Chambres non précisées");
    puce(estNb(a.terrain) ? "Jardin " + nb(a.terrain) + " m²" : null, "Jardin non précisé");
    puce(dpe(a) ? "DPE " + dpe(a) : null, "DPE ?");
    if (a.garage === true) puce("Garage"); else if (a.garage === false) puce("Sans garage");
    puce(etatNorm(a), "État non précisé");
    return el("div", {classe:"chips"}, p);
  }
  /* Fiche que la veille n'a pas pu ouvrir (Leboncoin, Bien'ici…) : lien présent, « Lien vérifié le » vide. */
  function lienNonVerifie(a){ return !!lienSur(a.lien) && !a.lienVerifieLe; }
  function anciennete(a){
    var d = date(a.repereeLe); if (!d) return null;
    var j = Math.floor((Date.now() - d.getTime()) / JOUR);
    return j <= 0 ? "repérée aujourd'hui" : j === 1 ? "repérée hier" : "repérée il y a " + j + " j";
  }
  function contenuFiche(a){
    var m2 = prixM2(a), s = adequation(a), fc = fraisCompris(a);
    var plus = Array.isArray(a.atouts) ? a.atouts : [], moins = Array.isArray(a.vigilance) ? a.vigilance : [];
    var meta = ["n°" + a.num, txt(a.source), anciennete(a)].filter(Boolean).join(" · ");
    return el("div", {classe:"fiche"}, [
      image(a, {classe:"fiche-img", direct:true}),
      el("div", {classe:"fiche-in"}, [
        el("div", {classe:"fiche-meta"}, [badgePrio(a), el("span", {texte:meta}), lienNonVerifie(a) ? el("span", {classe:"tag tag-nonverif", texte:"Lien non vérifié"}) : null]),
        a.corbeille ? el("p", {classe:"fiche-etat-suivi", texte:"Dans la corbeille depuis le " + (dateCourte(a.corbeilleLe || a.statutLe) || "?") + (txt(a.raisonCorbeille) ? " : " + txt(a.raisonCorbeille) : "")}) : null,
        a.enContact ? el("p", {classe:"fiche-etat-suivi"}, [ico("phone"), " En contact depuis le " + (dateCourte(a.enContactDepuis) || "?")]) : null,
        el("div", {classe:"fiche-prix"}, [el("span", {classe:"prix", texte:estNb(a.prix) ? euros(a.prix) : "Prix non précisé"}), m2 ? el("span", {classe:"m2", texte:nb(m2) + " €/m²"}) : null]),
        fc ? el("div", {classe:"fiche-fc"}, [el("b", {texte:"≈ " + kEuros(fc) + " frais compris"}), pastilleDrapeau(a)]) : null,
        el("div", {classe:"fiche-lieu"}, [el("h2", {texte:lieuComplet(a)}), txt(a.titre) ? el("p", {texte:txt(a.titre)}) : null]),
        el("div", {classe:"encart-adequation"}, [ico("cible"), el("div", null, [
          el("b", {texte:s !== null ? "Adéquation " + s + " / 100" : "Adéquation non notée"}),
          a.pepite ? el("small", {texte:"Pépite"}) : null
        ])]),
        txt(a.resume) ? el("p", {classe:"fiche-resume", texte:txt(a.resume)}) : null,
        puces(a)
      ]),
      blocCout(a),
      (plus.length || moins.length) ? el("div", {classe:"fiche-points"}, [
        plus.length ? el("section", {classe:"fiche-sec atouts"}, [el("h3", {classe:"surtitre-sec", texte:"Atouts"}), el("ul", null, plus.map(function(p){ return el("li", null, [ico("check"), el("span", {texte:txt(p)})]); }))]) : null,
        moins.length ? el("section", {classe:"fiche-sec vigilance"}, [el("h3", {classe:"surtitre-sec"}, [ico("alerte"), " Points de vigilance"]), el("ul", null, moins.map(function(p){ return el("li", null, [ico("alerte"), el("span", {texte:txt(p)})]); }))]) : null
      ]) : null
    ]);
  }
  function actionsFiche(a){
    var dansComp = UI.compareIds.indexOf(a.num) >= 0, plein = !dansComp && UI.compareIds.length >= MAX_COMPARER;
    if (a.corbeille){
      return el("div", {classe:"fiche-actions"}, [
        el("button", {type:"button", classe:"act act-large", onclick:function(){ restaurer(a); }}, [el("span", {texte:"Restaurer"})]),
        lienAnnonce(a, "act-cta", [el("span", {texte:S.bureau ? "Voir l'annonce" : "Annonce"}), ico("externe")])
      ]);
    }
    return el("div", {classe:"fiche-actions"}, [
      el("button", {type:"button", classe:"act" + (a.favori ? " favori-actif" : ""), "aria-pressed":a.favori ? "true" : "false", onclick:function(){ basculerFavori(a); }}, [ico("heart", a.favori), el("span", {texte:"Favori"})]),
      el("button", {type:"button", classe:"act" + (a.enContact ? " actif" : ""), "aria-pressed":a.enContact ? "true" : "false", onclick:function(){ basculerContact(a); }}, [ico(a.enContact ? "check" : "phone"), el("span", {texte:a.enContact ? "En contact" : "Contact"})]),
      el("button", {type:"button", classe:"act" + (dansComp ? " actif" : ""), "aria-pressed":dansComp ? "true" : "false", disabled:plein, title:plein ? "3 annonces au plus" : null, onclick:function(){ basculerComparer(a.num); }}, [ico("colonnes"), el("span", {texte:"Comparer"})]),
      boutonCorbeille(a, "act", [ico("trash"), el("span", {texte:"Corbeille"})]),
      lienAnnonce(a, "act-cta", [el("span", {texte:S.bureau ? "Voir l'annonce" : "Annonce"}), ico("externe")])
    ]);
  }
  /* Fiche sans annonce : lien partagé vers une annonce supprimée ou masquée, appareil sans clé, ou chargement. */
  function ficheAbsente(){
    if (!MODE_TEST && !S.cle) return el("div", {classe:"fiche-absente"}, [
      el("h2", {texte:"Lien privé nécessaire"}),
      el("p", {texte:"Ouvrez une première fois le site avec votre lien privé reçu par mail, puis rouvrez cette fiche."})]);
    if (!D && S.echec) return el("div", {classe:"fiche-absente"}, [
      el("h2", {texte:"Tableau injoignable"}),
      el("p", {classe:"gris", texte:"Raison : " + (S.erreurTexte || "inconnue")}),
      el("button", {type:"button", classe:"btn btn-accent", onclick:function(){ charger(true); }}, ["Réessayer"])
    ]);
    if (!D || (S.chargement && !trouver(S.route.num))) return el("p", {classe:"vide", texte:"Chargement…"});
    return el("div", {classe:"fiche-absente"}, [
      el("h2", {texte:"Annonce introuvable"}),
      el("p", {texte:"L'annonce n°" + S.route.num + " n'est plus dans le tableau ou a été masquée par la veille."}),
      el("button", {type:"button", classe:"btn btn-accent", onclick:function(){ S.fond = {nom:"accueil"}; aller({nom:"accueil"}, true); }}, ["Retour à l'accueil"])
    ]);
  }
  function panneauFiche(){
    var a = trouver(S.route.num);
    var liste = listeDuFond(), i = a && liste ? liste.indexOf(a) : -1;
    return el("aside", {classe:"panneau-fiche", "aria-label":"Fiche de l'annonce"}, [
      el("div", {classe:"panneau-tete"}, [
        el("span", {texte:"Fiche" + (i >= 0 ? " · " + (i + 1) + " / " + liste.length : a ? " · n°" + a.num : "")}),
        el("div", {classe:"panneau-btns"}, [
          a ? boutonPartager(a, "btn-ico") : null,
          el("button", {type:"button", classe:"btn-ico", "aria-label":"Fermer la fiche", onclick:fermerFiche}, [ico("x")])
        ])
      ]),
      el("div", {classe:"panneau-defil", "data-garde":"fiche-" + S.route.num}, [a ? contenuFiche(a) : ficheAbsente()]),
      a ? actionsFiche(a) : null
    ]);
  }
  function feuilleFiche(){
    var a = trouver(S.route.num);
    var tete = el("div", {classe:"feuille-fiche-tete"}, [
      el("span", {classe:"poignee", "aria-hidden":"true"}),
      a ? boutonPartager(a, "btn-ico btn-partage") : null,
      el("button", {type:"button", classe:"btn-ico", "aria-label":"Fermer la fiche", onclick:fermerFiche}, [ico("x")])
    ]);
    var feuille = el("div", {classe:"feuille-fiche", role:"dialog", "aria-modal":"true", "aria-label":a ? "Annonce n°" + a.num : "Annonce"}, [
      tete,
      el("div", {classe:"feuille-fiche-defil", "data-garde":"fiche-" + S.route.num}, [a ? contenuFiche(a) : ficheAbsente()]),
      a ? actionsFiche(a) : null
    ]);
    glisserPourFermer(tete, feuille);
    return el("div", {classe:"couche couche-fiche"}, [el("div", {classe:"voile", onclick:fermerFiche}), feuille]);
  }
  function glisserPourFermer(poignee, feuille){
    var y0 = null, dy = 0;
    poignee.addEventListener("touchstart", function(e){ y0 = e.touches[0].clientY; dy = 0; feuille.style.transition = "none"; }, {passive:true});
    poignee.addEventListener("touchmove", function(e){
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      feuille.style.transform = "translateY(" + dy + "px)";
    }, {passive:true});
    poignee.addEventListener("touchend", function(){
      feuille.style.transition = "";
      if (dy > 90) fermerFiche(); else feuille.style.transform = "";
      y0 = null;
    });
  }

  /* ---------- Accueil ---------- */
  function surtitreVeille(){
    var d = D && D.rapport ? D.rapport.derniereVeille : null;
    return d ? jourCourt(d) + " · dernière veille " + heure(d) : "Veille immobilière";
  }
  function cartePepite(a){
    return cliquable(el("article", {classe:"carte-pepite", "aria-label":lieu(a)}, [
      image(a, {coeurIndic:true}),
      el("div", {classe:"cp-corps"}, [
        el("div", {classe:"cp-prix"}, [el("span", {texte:estNb(a.prix) ? euros(a.prix) : "Prix ?"}), el("b", {texte:"P" + a.prio})]),
        el("div", {classe:"cp-lieu", texte:lieu(a)}),
        el("div", {classe:"cp-crit", texte:criteres(a, true)})
      ])
    ]), a.num);
  }
  function vueAccueil(){
    var p = el("div", {classe:"accueil"});
    var pep = enLice().filter(function(a){ return a.pepite && (estNew(a) || a.favori); }).sort(function(x, y){ return comparerNb(x.score, y.score, true) || x.num - y.num; });
    var indic = el("span", {classe:"indic-carrousel", "aria-hidden":"true", texte:pep.length > 1 && !S.bureau ? "1 / " + pep.length : ""});
    var tete = el("div", {classe:"sec-tete"}, [el("h2", {classe:"surtitre-sec", texte:"Pépites du moment"}), S.bureau ? el("span", {classe:"gris", texte:majuscule(surtitreVeille())}) : indic]);
    var sec = el("section", {classe:"sec-pepites"}, [tete]);
    if (!D) sec.appendChild(squelettes("cards"));
    else if (!pep.length) sec.appendChild(el("p", {classe:"vide", texte:"Pas de pépite en ce moment."}));
    else {
      var piste = el("div", {classe:"carrousel", "data-garde":"carrousel"}, pep.map(cartePepite));
      piste.addEventListener("scroll", function(){
        var c = piste.firstChild; if (!c) return;
        var i = Math.round(piste.scrollLeft / (c.getBoundingClientRect().width + 12));
        indic.textContent = Math.min(pep.length, i + 1) + " / " + pep.length;
      }, {passive:true});
      sec.appendChild(piste);
      if (S.bureau && pep.length > 3){
        sec.appendChild(el("div", {classe:"fleches"}, [
          el("button", {type:"button", classe:"btn-ico", "aria-label":"Pépites précédentes", onclick:function(){ piste.scrollBy({left:-piste.clientWidth, behavior:"smooth"}); }}, [ico("gauche")]),
          el("button", {type:"button", classe:"btn-ico", "aria-label":"Pépites suivantes", onclick:function(){ piste.scrollBy({left:piste.clientWidth, behavior:"smooth"}); }}, [ico("fleche")])
        ]));
      }
    }
    p.appendChild(sec);

    var R = (D && D.rapport) || {}, st = R.stats || {};
    var stats = el("div", {classe:"stats"}, [["lues","annonces lues"],["retenues","retenues"],["doublons","doublons écartés"]].map(function(s){
      return el("div", {classe:"stat"}, [el("b", {texte:estNb(st[s[0]]) ? nb(st[s[0]]) : "—"}), el("span", {texte:s[1]})]);
    }));
    var paras = Array.isArray(R.paragraphes) ? R.paragraphes : [];
    var resume = el("section", {classe:"bloc-resume"}, [el("h2", {classe:"surtitre-sec", texte:"Résumé de la veille"})].concat(
      paras.length ? paras.map(function(t){ return el("p", {texte:txt(t)}); }) : [el("p", {classe:"inconnu", texte:D ? "Pas de résumé pour cette veille." : "…"})]));
    var prios = el("section", {classe:"bloc-prios"}, [
      el("h2", {classe:"surtitre-sec", texte:"Par prio"}),
      el("div", {classe:"grille-prios"}, [1,2,3,4].map(function(n){
        var P = PRIOS[n] || {};
        return el("button", {type:"button", classe:"cellule-prio", onclick:function(){ aller({nom:"prio", n:n}); }}, [
          el("span", {classe:"cp-n", texte:"P" + n}),
          el("b", {texte:D ? String(parPrio(n).length) : "—"}),
          P.zone ? el("small", {texte:P.zone}) : null,
          P.cibleMax ? el("small", {texte:"cible ≤ " + kEuros(P.cibleMax)}) : null
        ]);
      }))
    ]);
    var crit = el("section", {classe:"bloc-criteres"}, [
      el("h2", {classe:"surtitre-sec", texte:"Nos critères"}),
      el("div", {classe:"chips"}, CRITERES.map(function(c){ return el("span", {classe:"chip", texte:c}); }))
    ]);
    if (S.bureau){
      p.appendChild(el("div", {classe:"grille-accueil"}, [resume, stats, prios, crit]));
    } else {
      p.appendChild(stats); p.appendChild(resume); p.appendChild(prios); p.appendChild(crit);
    }
    return p;
  }

  /* ---------- Comparer ---------- */
  var LIGNES_COMPARER = [
    {lib:"Prix", v:function(a){ return estNb(a.prix) ? a.prix : null; }, f:euros, best:"min"},
    {lib:"Frais compris", v:fraisCompris, f:function(v){ return "≈ " + kEuros(v); }, best:"min"},
    {lib:"€/m²", v:prixM2, f:nb, best:"min"},
    {lib:"Surface", v:function(a){ return estNb(a.surface) ? a.surface : null; }, f:function(v){ return nb(v) + " m²"; }, best:"max"},
    {lib:"Chambres", v:function(a){ return estNb(a.chambres) ? a.chambres : null; }, f:String, best:"max"},
    {lib:"Pièces", v:function(a){ return estNb(a.pieces) ? a.pieces : null; }, f:String},
    {lib:"Jardin", v:function(a){ return estNb(a.terrain) ? a.terrain : null; }, f:function(v){ return nb(v) + " m²"; }},
    {lib:"DPE", v:dpe, f:String, best:"dpe"},
    {lib:"Énergie / mois", v:energieMois, f:function(v){ return "≈ " + fourchette(v); }, best:"energie"},
    {lib:"Taxe fonc. / mois", v:taxeMois, f:function(v){ return "≈ " + nb(v) + " €"; }, best:"min"},
    {lib:"Garage", v:function(a){ return a.garage === true ? "Oui" : a.garage === false ? "Non" : null; }, f:String, best:"oui"},
    {lib:"État", v:etatNorm, f:String},
    {lib:"Adéquation", v:adequation, f:function(v){ return v + " / 100"; }, best:"max"},
    {lib:"Prix vs cible", v:drapeau, f:String},
    {lib:"Prio", v:function(a){ return a.prio ? "P" + a.prio : null; }, f:String},
    {lib:"Source", v:function(a){ var s = txt(a.source); return s ? s + (lienNonVerifie(a) ? " · lien non vérifié" : "") : null; }, f:String}
  ];
  /* Gras = meilleure valeur. Une valeur absente n'est jamais la meilleure ; rien en gras si toutes se valent. */
  function meilleurs(ligne, valeurs){
    if (!ligne.best) return [];
    var cles = valeurs.map(function(v){
      if (v === null || v === undefined) return null;
      if (ligne.best === "min" || ligne.best === "max") return v;
      if (ligne.best === "dpe") return v.charCodeAt(0);
      if (ligne.best === "energie") return v.hi;
      if (ligne.best === "oui") return v === "Oui" ? 1 : 0;
      return null;
    });
    var connues = cles.filter(function(k){ return k !== null; });
    if (connues.length < 2) return [];
    var cible = (ligne.best === "max" || ligne.best === "oui") ? Math.max.apply(null, connues) : Math.min.apply(null, connues);
    if (ligne.best === "oui" && cible === 0) return [];
    if (connues.every(function(k){ return k === cible; })) return [];
    return cles.map(function(k){ return k === cible; });
  }
  function candidatsComparer(){
    return enLice().filter(function(a){ return (a.favori || a.enContact) && UI.compareIds.indexOf(a.num) < 0; }).sort(function(x, y){ return comparerNb(x.score, y.score, true); });
  }
  function listeCandidats(){
    var l = candidatsComparer();
    if (!l.length) return [el("p", {classe:"inconnu", texte:"Aucun favori ni annonce en contact à proposer. Cochez « Comparer » sur une carte d'une Prio."})];
    return l.map(function(a){
      return el("button", {type:"button", classe:"candidat", onclick:function(){ basculerComparer(a.num); S.choix = false; rendre(); }}, [
        el("span", {texte:(estNb(a.prix) ? euros(a.prix) : "Prix ?") + " · " + lieu(a)}), ico("plus")
      ]);
    });
  }
  function vueComparer(){
    var sel = UI.compareIds.map(trouver).filter(Boolean);
    var box = el("div", {classe:"comparer"});
    if (!D){ box.appendChild(squelettes("list")); return box; }
    if (!sel.length && !S.bureau){
      box.appendChild(el("div", {classe:"vide-comparer"}, [
        el("p", {texte:"Aucune annonce sélectionnée. Cochez « Comparer » sur une carte, ou ajoutez un favori ici (3 au plus)."}),
        el("button", {type:"button", classe:"btn btn-encre", onclick:function(){ S.choix = true; rendre(); }}, [ico("plus"), el("span", {texte:"Ajouter"})])
      ]));
      return box;
    }
    var vide = sel.length < MAX_COMPARER;
    var tete = el("tr", null, [
      el("th", {classe:"c-lib c-coin", scope:"col"}, S.bureau ? [el("h1", {texte:"Comparer"}), el("p", null, [sel.length + " / " + MAX_COMPARER + " · ", el("button", {type:"button", classe:"lien-txt", onclick:viderComparer}, ["Vider"])])] : [])
    ].concat(sel.map(function(a){
      return el("th", {classe:"c-col", scope:"col"}, [
        el("div", {classe:"c-vignette"}, [
          image(a, {classe:"c-img", tags:S.bureau}),
          el("button", {type:"button", classe:"c-retirer", "aria-label":"Retirer n°" + a.num + " de la comparaison", onclick:function(){ basculerComparer(a.num); }}, [ico("x")])
        ]),
        el("button", {type:"button", classe:"c-lieu", onclick:function(){ ouvrirFiche(a.num); }}, [lieu(a)]),
        el("p", {classe:"c-meta"}, ["P" + a.prio + " · n°" + a.num + " · " + (txt(a.source) || "—"), a.favori ? el("span", {classe:"c-coeur"}, [" · ", ico("heart", true)]) : null])
      ]);
    })).concat(vide ? [S.bureau
      ? el("th", {classe:"c-col c-libre", scope:"col"}, [el("b", {texte:"+ Ajouter une annonce"}), el("small", {texte:"Depuis vos favoris et le suivi"}), el("div", {classe:"candidats"}, listeCandidats())])
      : el("th", {classe:"c-plus", scope:"col"}, [el("button", {type:"button", "aria-label":"Ajouter une annonce à comparer", onclick:function(){ S.choix = true; rendre(); }}, [ico("plus")])])] : []));
    var corps = el("tbody");
    LIGNES_COMPARER.forEach(function(L){
      var vals = sel.map(function(a){ var v = L.v(a); return v === undefined ? null : v; });
      var gras = meilleurs(L, vals);
      corps.appendChild(el("tr", null, [el("th", {classe:"c-lib", scope:"row", texte:L.lib})].concat(vals.map(function(v, i){
        return el("td", {classe:gras[i] ? "meilleur" : null, texte:v === null ? "—" : L.f(v)});
      })).concat(vide ? [el("td", {classe:"c-vide"})] : [])));
    });
    if (S.bureau){
      corps.appendChild(el("tr", {classe:"c-liens"}, [el("th", {classe:"c-lib"})].concat(sel.map(function(a){
        return el("td", null, [lienAnnonce(a, "lien-annonce", ["Voir l'annonce ↗"])]);
      })).concat(vide ? [el("td", {classe:"c-vide"})] : [])));
    }
    box.appendChild(el("div", {classe:"comparer-defil"}, [el("table", {classe:"table-comparer cols-" + sel.length}, [el("thead", null, [tete]), corps])]));
    if (!S.bureau){
      box.appendChild(el("div", {classe:"pied-comparer"}, [
        el("button", {type:"button", classe:"pc-vider", onclick:viderComparer}, ["Vider la sélection"]),
        el("button", {type:"button", classe:"pc-ajouter", disabled:!vide, onclick:function(){ S.choix = true; rendre(); }}, [el("span", {texte:"+ Ajouter"}), ico("fleche")])
      ]));
    }
    return box;
  }
  function viderComparer(){ UI.compareIds = []; sauverUI(); rendre(); }
  function feuilleChoix(){
    return couche("Ajouter à la comparaison", [el("p", {classe:"surtitre-sec", texte:"Favoris et suivi"}), el("div", {classe:"candidats"}, listeCandidats())], null, function(){ S.choix = false; rendre(); });
  }

  /* ---------- Ajouter des annonces ---------- */
  var RE_LIEN = /(?:https?:\/\/|www\.)[^\s<>"«»]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<>"«»]*/gi;
  /* Un lien par ligne ou en vrac. Dès qu'il y a au moins un lien, les lignes sans lien (titre, « J'ai trouvé une annonce… »
     ajoutés par les applis au partage) sont ignorées ; sans aucun lien, le texte est gardé et ressort INVALIDE. */
  function extraireEntrees(texte){
    var liens = [], autres = [], vus = {};
    function ajouter(l, e){ if (e && !vus[e]){ vus[e] = true; l.push(e); } }
    String(texte || "").split(/\r?\n/).forEach(function(l){
      l = l.trim(); if (!l) return;
      var m = l.match(RE_LIEN);
      if (!m) { ajouter(autres, l.slice(0, 300)); return; }
      m.forEach(function(u){
        u = u.replace(/[)\].,;:!?'»"]+$/, "");
        if (!/^https?:\/\//i.test(u)) u = "https://" + u;
        ajouter(liens, u);
      });
    });
    return liens.length ? liens : autres;
  }
  /* Libellé tiré uniquement de l'adresse : le navigateur ne peut pas lire la page de l'annonce. */
  function libelleAdresse(u){
    try {
      var x = new URL(u), hote = x.hostname.replace(/^www\./, "");
      var id = (x.pathname.match(/(\d{5,})(?!.*\d{5,})/) || [])[1];
      if (id) return hote + " · " + (/seloger\.com$/.test(hote) ? "annonce " : "") + tronquer(id, 10);
      var seg = x.pathname.split("/").filter(Boolean).pop() || "";
      try { seg = decodeURIComponent(seg); } catch(e){}
      seg = seg.replace(/\.(html?|php|aspx?)$/i, "");
      return seg ? hote + " · " + tronquer(seg, 26) : hote;
    } catch(e){ return tronquer(u, 40); }
  }
  /* Hôtes de redirection des mails d'alerte et raccourcisseurs : même liste que HOTES_SUIVI (Code.gs). */
  var HOTES_SUIVI = [
    /^(click|clic|clicks|track|tracking|trk|links|link)\./, /(^|\.)ct\.sendgrid\.net$/, /(^|\.)list-manage\.com$/, /(^|\.)mjt\.lu$/,
    /(^|\.)r\.mailjet\.com$/, /(^|\.)sendib[mt]\d*\.com$/, /(^|\.)hubspotlinks\.com$/, /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|lnkd\.in)$/
  ];
  function estHoteSuivi(h){ return HOTES_SUIVI.some(function(re){ return re.test(h); }); }
  var PARAMS_CIBLE = ["url", "u", "q", "target", "redirect", "redirect_url", "dest"];
  function cibleRedirection(requete, hote){
    var p = (requete || "").slice(1).split("&");
    for (var i = 0; i < p.length; i++){
      var j = p[i].indexOf("="); if (j < 1) continue;
      var nom, val;
      try { nom = decodeURIComponent(p[i].slice(0, j)).toLowerCase(); val = decodeURIComponent(p[i].slice(j + 1).replace(/\+/g, " ")).trim(); } catch(e){ continue; }
      if (PARAMS_CIBLE.indexOf(nom) < 0) continue;
      var m = val.match(/^https?:\/\/([^\/?#\s:@]+)/i);
      if (m && m[1].toLowerCase().replace(/^www\./, "") !== hote.replace(/^www\./, "")) return val;
    }
    return null;
  }
  function hoteDe(u){ try { return new URL(u).hostname.replace(/^www\./, ""); } catch(e){ return ""; } }
  var ETATS = {
    A_TRAITER:{badge:"À traiter"}, DOUBLON:{badge:"Doublon"}, IGNOREE:{badge:"Ignorée"}, EN_ATTENTE:{badge:"En attente"}, DEJA_ANALYSEE:{badge:"Déjà analysée"},
    LIEN_SUIVI:{badge:"Lien de mail"}, INVALIDE:{badge:"Invalide"}
  };
  /* Envoyable à la veille : nouveau lien, ou lien déjà analysé à renvoyer (sauf s'il a été ajouté au tableau). Même règle que renvoyable_ (Code.gs). */
  function renvoyable(r){
    if (r.etat === "A_TRAITER") return true;
    return r.etat === "DEJA_ANALYSEE" && !/^\s*ajout[ée]e/i.test(txt(r.resultat));
  }
  /* complet : texte entier du Résultat (affiché au survol ou au toucher). */
  function detailVerif(r, complet){
    var lieuR = txt(r.quartier) || txt(r.commune) || "quartier inconnu";
    var d;
    if (r.etat === "A_TRAITER") d = "Nouvelle annonce";
    else if (r.etat === "DOUBLON" && r.masquee) d = "Déjà en base · n°" + r.num + ", masquée" + (txt(r.raisonMasquee) ? " : " + txt(r.raisonMasquee) : "");
    else if (r.etat === "DOUBLON") d = "Déjà en base · n°" + r.num + " · P" + (r.prio || "?") + ", " + lieuR;
    else if (r.etat === "DEJA_ANALYSEE"){
      var res = txt(r.resultat);
      d = "Déjà analysée" + (r.traiteLe ? " le " + fmtDate(r.traiteLe, {day:"2-digit", month:"2-digit"}) : "") + (res ? " : " + (complet ? res : tronquer(res, 80)) : "");
      if (renvoyable(r)) d += " · cocher pour renvoyer";
    }
    else if (r.etat === "LIEN_SUIVI") d = "Lien de suivi d'un mail : ouvrez l'annonce et copiez l'adresse de sa page";
    else if (r.etat === "IGNOREE") d = "Dans la corbeille depuis le " + (dateCourte(r.corbeilleLe) || "?");
    else if (r.etat === "EN_ATTENTE") d = "Déjà envoyée" + (r.envoyeLe ? " le " + dateCourte(r.envoyeLe) : "") + ", pas encore analysée";
    else d = "Ce n'est pas un lien d'annonce";
    return d + (r.nb > 1 ? " · collé " + r.nb + " fois" : "");
  }
  function titreVerif(r){
    if (r.etat === "INVALIDE") return "« " + tronquer(r.entree, 40) + " »";
    if (r.etat === "LIEN_SUIVI") return txt(r.hote) || hoteDe(r.entree);
    if (r.etat === "A_TRAITER" || r.etat === "EN_ATTENTE" || r.etat === "DEJA_ANALYSEE") return libelleAdresse(r.direct || r.entree);
    return hoteDe(r.entree) + " · " + (txt(r.quartier) || txt(r.commune) || "n°" + r.num || "");
  }
  function verifier(){
    var A = S.ajout, entrees = extraireEntrees(A.texte);
    if (!entrees.length || A.verif || (!MODE_TEST && !S.cle)) return;
    A.verif = true; rendre();
    ecrire({action:"verifierLiens", liens:entrees}).then(function(r){
      A.resultats = r.resultats || []; A.coches = {};
      /* Seuls les nouveaux liens sont pré-cochés ; un renvoi se coche à la main. */
      A.resultats.forEach(function(x, i){ if (x.etat === "A_TRAITER") A.coches[i] = true; });
    }, function(e){
      if (e.cle){ cleInvalide(); return; }
      message("Vérification impossible : " + e.message, "erreur");
    }).then(function(){ A.verif = false; rendre(); });
  }
  function envoyerAjouts(){
    var A = S.ajout;
    var choisis = (A.resultats || []).filter(function(r, i){ return renvoyable(r) && A.coches[i]; });
    var liens = choisis.map(function(r){ return r.entree; });
    if (!liens.length || A.envoi) return;
    var renvois = {}, directs = {};
    choisis.forEach(function(r){ if (r.etat === "DEJA_ANALYSEE") renvois[r.entree] = true; if (r.direct) directs[r.entree] = r.direct; });
    A.envoi = true; rendre();
    ecrire({action:"ajouter", liens:liens}).then(function(r){
      A.fait = {ajoutes:r.ajoutes || [], ecartes:r.ecartes || [], renvois:renvois, directs:directs};
      A.texte = ""; A.resultats = null; A.coches = {};
    }, function(e){
      if (e.cle){ cleInvalide(); return; }
      message("Pas envoyé : " + e.message, "erreur");
    }).then(function(){ A.envoi = false; rendre(); });
  }
  function nbCoches(){
    var A = S.ajout;
    return (A.resultats || []).filter(function(r, i){ return renvoyable(r) && A.coches[i]; }).length;
  }
  function blocSaisie(){
    var A = S.ajout;
    var zone = el("textarea", {id:"saisie-liens", rows:S.bureau ? "14" : "6", placeholder:"https://www.leboncoin.fr/ad/ventes_immobilieres/…\nhttps://www.seloger.com/annonces/…",
      autocapitalize:"off", autocomplete:"off", spellcheck:"false", "aria-label":"Liens d'annonces"});
    zone.value = A.texte;
    var btnVerif = el("button", {type:"button", classe:"btn btn-encre btn-large", onclick:verifier}, []);
    var sansCle = !MODE_TEST && !S.cle;
    function majBouton(){
      var n = extraireEntrees(zone.value).length;
      btnVerif.disabled = !n || A.verif || sansCle;
      btnVerif.textContent = "";
      btnVerif.appendChild(el("span", {texte:A.verif ? "Vérification…" : "Vérifier " + pluriel(n, "lien")}));
      btnVerif.appendChild(ico("fleche"));
    }
    zone.addEventListener("input", function(){
      A.texte = zone.value;
      if (A.resultats){ A.resultats = null; A.coches = {}; rendreVerification(); }
      majBouton();
    });
    majBouton();
    var coller = (navigator.clipboard && navigator.clipboard.readText) ? el("button", {type:"button", classe:"btn btn-contour btn-large", onclick:function(){
      navigator.clipboard.readText().then(function(t){
        if (!t) return;
        zone.value = (zone.value.trim() ? zone.value.replace(/\s+$/, "") + "\n" : "") + t.trim();
        zone.dispatchEvent(new Event("input"));
      }, function(){ message("Collage refusé par le navigateur : faites un appui long dans la zone.", "erreur"); });
    }}, ["Coller"]) : null;
    return el("div", {classe:"saisie"}, [
      S.bureau ? el("h1", {texte:"Ajouter des annonces"}) : null,
      sansCle ? el("p", {classe:"avis-cle", role:"alert", texte:"Ouvrez une première fois le site avec votre lien privé, puis partagez à nouveau."}) : null,
      S.bureau ? el("p", {classe:"gris", texte:"Collez un ou plusieurs liens, un par ligne ou en vrac."}) : el("label", {classe:"lib-champ", "for":"saisie-liens", texte:"Liens d'annonces"}),
      zone,
      el("div", {classe:"saisie-btns" + (coller ? "" : " seul")}, [coller, btnVerif])
    ]);
  }
  function blocVerification(){
    var A = S.ajout, box = el("div", {classe:"verification", id:"verification"});
    if (S.bureau) box.appendChild(el("h2", {classe:"surtitre-sec", texte:"Vérification"}));
    if (!A.resultats){
      if (S.bureau) box.appendChild(el("p", {classe:"inconnu", texte:A.verif ? "Vérification en cours…" : "Les liens collés seront vérifiés ici avant l'envoi à la veille."}));
      return box;
    }
    box.appendChild(el("ul", {classe:"resultats"}, A.resultats.map(function(r, i){
      var actif = renvoyable(r);
      var coche = actif && !!A.coches[i];
      return el("li", {classe:"resultat" + (actif ? "" : " estompe") + (r.etat === "INVALIDE" ? " invalide" : "")}, [
        el("label", {classe:"res-case"}, [
          el("input", {type:"checkbox", checked:coche, disabled:!actif, "aria-label":titreVerif(r), onchange:function(e){ A.coches[i] = e.target.checked; rendre(); }}),
          el("span", {classe:"case", "aria-hidden":"true"}, [ico("check")])
        ]),
        el("div", {classe:"res-txt", title:detailVerif(r, true) !== detailVerif(r) ? detailVerif(r, true) : null,
          onclick:function(e){ var sp = e.currentTarget.lastChild; sp.textContent = sp.textContent === detailVerif(r) ? detailVerif(r, true) : detailVerif(r); }}, [el("b", {texte:titreVerif(r)}), el("span", {texte:detailVerif(r)})]),
        el("span", {classe:"badge-etat e-" + r.etat.toLowerCase(), texte:ETATS[r.etat] ? ETATS[r.etat].badge : r.etat})
      ]);
    })));
    box.appendChild(el("p", {classe:"note", texte:"Vérification sur le lien exact : une même maison publiée par une autre agence sera repérée par la veille."}));
    var n = nbCoches();
    box.appendChild(el("div", {classe:"envoi"}, [el("button", {type:"button", classe:"btn btn-accent btn-large", disabled:!n || A.envoi, onclick:envoyerAjouts}, [
      el("span", {texte:A.envoi ? "Envoi…" : n ? "Envoyer " + pluriel(n, "annonce") + " à la veille" : "Aucune annonce à envoyer"}), ico("fleche")
    ])]));
    return box;
  }
  function rendreVerification(){
    var v = $("verification");
    if (v) v.replaceWith(blocVerification());
  }
  function blocConfirmation(){
    var A = S.ajout, f = A.fait, n = f.ajoutes.length;
    var etats = {DOUBLON:"Déjà en base", IGNOREE:"Dans la corbeille", EN_ATTENTE:"Déjà en attente", DEJA_ANALYSEE:"Déjà analysée", LIEN_SUIVI:"Lien de mail", INVALIDE:"Invalide"};
    return el("div", {classe:"confirmation"}, [
      el("span", {classe:"grand-check", "aria-hidden":"true"}, [ico("check")]),
      el("h2", {texte:n ? pluriel(n, "annonce envoyée", "annonces envoyées") + " à la veille." : "Aucune annonce envoyée."}),
      el("ul", {classe:"envoyes"}, f.ajoutes.map(function(u){ return el("li", null, [el("b", {texte:libelleAdresse(f.directs[u] || u)}), el("span", {texte:f.renvois[u] ? "Renvoyée" : "Envoyée"})]); })
        .concat(f.ecartes.map(function(r){ return el("li", {classe:"estompe"}, [el("b", {texte:titreVerif(r)}), el("span", {texte:"Écartée : " + (etats[r.etat] || r.etat).toLowerCase()})]); }))),
      el("button", {type:"button", classe:"btn btn-contour btn-large", onclick:function(){ A.fait = null; rendre(); var z = $("saisie-liens"); if (z) z.focus(); }}, [el("span", {texte:"Ajouter d'autres liens"}), ico("plus")])
    ]);
  }
  function vueAjouter(){
    var A = S.ajout;
    if (S.bureau) return el("div", {classe:"ajouter"}, [blocSaisie(), el("div", {classe:"ajouter-droite"}, [A.fait ? blocConfirmation() : blocVerification()])]);
    return el("div", {classe:"ajouter"}, A.fait ? [blocConfirmation()] : [blocSaisie(), blocVerification()]);
  }

  /* ---------- Corbeille ---------- */
  function vueCorbeille(){
    var l = dansCorbeille();
    var intro = "Gardées pour que la veille ne les repropose jamais.";
    var box = el("div", {classe:"corbeille"}, [S.bureau
      ? el("div", {classe:"corbeille-tete"}, [el("h1", {texte:"Corbeille"}), el("span", {classe:"gris", texte:pluriel(l.length, "annonce") + " · " + intro.charAt(0).toLowerCase() + intro.slice(1, -1)})])
      : el("p", {classe:"corbeille-intro", texte:intro})]);
    if (!D){ box.appendChild(squelettes("list")); return box; }
    if (!l.length){ box.appendChild(el("p", {classe:"vide", texte:"La corbeille est vide."})); return box; }
    function bouton(a){ return el("button", {type:"button", classe:"btn btn-contour", disabled:!!S.ops[a.num], onclick:function(){ restaurer(a); }}, ["Restaurer"]); }
    function retiree(a){ return "Retirée le " + (dateCourte(a.corbeilleLe || a.statutLe) || "?") + " · P" + a.prio; }
    if (S.bureau){
      box.appendChild(el("table", {classe:"tableau tableau-corbeille"}, [
        el("thead", null, [el("tr", null, ["Prix","Quartier","Bien","Retirée",""].map(function(t){ return el("th", {scope:"col", texte:t}); }))]),
        el("tbody", null, l.map(function(a){
          return el("tr", null, [
            el("td", {classe:"t-prix", texte:estNb(a.prix) ? euros(a.prix) : "—"}),
            el("td", {classe:"t-lieu", texte:lieu(a)}),
            el("td", {classe:"t-gris", texte:criteres(a).replace(/ · (à rafraîchir|à rénover)$/, "")}),
            el("td", {classe:"t-gris", texte:retiree(a) + (txt(a.raisonCorbeille) ? " · " + txt(a.raisonCorbeille) : "")}),
            el("td", null, [bouton(a)])
          ]);
        }))
      ]));
    } else {
      box.appendChild(el("div", {classe:"lignes-corbeille"}, l.map(function(a){
        return el("div", {classe:"ligne-corbeille"}, [
          el("div", null, [
            el("b", {texte:(estNb(a.prix) ? euros(a.prix) : "Prix ?") + " · " + lieu(a)}),
            el("p", {texte:criteres(a).replace(/ · (à rafraîchir|à rénover)$/, "")}),
            el("small", {texte:retiree(a) + (txt(a.raisonCorbeille) ? " · " + txt(a.raisonCorbeille) : "")})
          ]),
          bouton(a)
        ]);
      })));
    }
    return box;
  }

  /* ---------- En-tête, menu, onglets ---------- */
  function surtitre(){
    if (!D && !S.echec) return "Chargement…";
    var r = S.route.nom === "fiche" ? S.fond : S.route;
    if (r.nom === "prio") return "Prio " + r.n + " · " + pluriel(trier(filtrer(parPrio(r.n), true)).length, "annonce");
    if (r.nom === "suivi") return "Suivi · " + suivis().length + " en contact";
    if (r.nom === "comparer") return "Comparer · " + UI.compareIds.length + " / " + MAX_COMPARER;
    if (r.nom === "corbeille") return "Corbeille · " + dansCorbeille().length;
    return surtitreVeille();
  }
  function pageActive(){ return S.route.nom === "fiche" ? S.fond : S.route; }
  function enteteMobile(h){
    if (S.route.nom === "ajouter"){
      h.className = "entete entete-retour";
      h.appendChild(el("button", {type:"button", classe:"btn-ico", "aria-label":"Retour", onclick:function(){ if (history.length > 1) history.back(); else aller({nom:"accueil"}); }}, [ico("retour")]));
      h.appendChild(el("h1", {texte:"Ajouter des annonces"}));
      return;
    }
    h.className = "entete" + (S.menu ? " menu-ouvert" : "");
    h.appendChild(el("div", {classe:"entete-txt"}, [
      el("p", {classe:"surtitre", texte:surtitre()}),
      el("button", {type:"button", classe:"titre-app", onclick:function(){ aller({nom:"accueil"}); }}, ["Objectif New Home"])
    ]));
    h.appendChild(el("button", {type:"button", classe:"burger" + (S.menu ? " ouvert" : ""), "aria-expanded":S.menu ? "true" : "false", "aria-label":S.menu ? "Fermer le menu" : "Ouvrir le menu",
      onclick:function(){ S.menu = !S.menu; rendre(); }}, [ico(S.menu ? "x" : "menu")]));
  }
  function enteteBureau(h){
    var p = pageActive();
    h.className = "entete entete-bureau";
    h.appendChild(el("button", {type:"button", classe:"titre-app" + (p.nom === "accueil" ? " actif" : ""), onclick:function(){ aller({nom:"accueil"}); }}, ["Objectif New Home"]));
    h.appendChild(el("nav", {classe:"eb-prios", "aria-label":"Priorités"}, [1,2,3,4].map(function(n){
      var actif = p.nom === "prio" && p.n === n;
      return el("button", {type:"button", classe:"eb-prio" + (actif ? " actif" : ""), "aria-current":actif ? "page" : null, onclick:function(){ aller({nom:"prio", n:n}); }}, [
        "Prio " + n, el("small", {texte:D ? String(parPrio(n).length) : ""})
      ]);
    })));
    function lien(nom, lib, compte, classe){
      return el("button", {type:"button", classe:"eb-lien" + (classe ? " " + classe : "") + (p.nom === nom ? " actif" : ""), "aria-current":p.nom === nom ? "page" : null, onclick:function(){ aller({nom:nom}); }}, [lib, compte !== null ? el("small", {texte:compte}) : null]);
    }
    h.appendChild(el("div", {classe:"eb-droite"}, [
      lien("suivi", "Suivi", D ? String(suivis().length) : ""),
      lien("comparer", "Comparer", UI.compareIds.length + "/" + MAX_COMPARER),
      lien("corbeille", "Corbeille", null, "gris"),
      el("button", {type:"button", classe:"btn eb-ajouter" + (p.nom === "ajouter" ? " actif" : ""), onclick:function(){ aller({nom:"ajouter"}); }}, ["+ Ajouter des annonces"])
    ]));
  }
  function menuMobile(){
    function entree(nom, icone, lib, compte, classe){
      return el("button", {type:"button", classe:"menu-entree" + (classe ? " " + classe : ""), onclick:function(){ S.menu = false; aller({nom:nom}); }}, [
        ico(icone), el("span", {texte:lib}), compte !== null ? el("small", {texte:compte}) : null
      ]);
    }
    return el("div", {classe:"couche couche-menu"}, [
      el("div", {classe:"voile", onclick:function(){ S.menu = false; rendre(); }}),
      el("nav", {classe:"menu", "aria-label":"Menu"}, [
        entree("accueil", "maison", "Accueil", null),
        entree("suivi", "phone", "Suivi", D ? String(suivis().length) : null),
        entree("comparer", "colonnes", "Comparer", UI.compareIds.length + " / " + MAX_COMPARER),
        entree("ajouter", "plus", "Ajouter des annonces", null),
        entree("corbeille", "trash", "Corbeille", D ? String(dansCorbeille().length) : null, "menu-corbeille")
      ])
    ]);
  }
  function rendreOnglets(){
    var nav = $("onglets-prio");
    nav.textContent = "";
    var cache = S.bureau || !S.cle && !MODE_TEST || S.route.nom === "ajouter" || (S.route.nom === "comparer");
    nav.hidden = cache;
    document.body.classList.toggle("sans-onglets", cache);
    if (cache) return;
    var p = pageActive();
    [1,2,3,4].forEach(function(n){
      var actif = p.nom === "prio" && p.n === n;
      var l = D ? parPrio(n) : [], nn = l.filter(estNew).length;
      nav.appendChild(el("button", {type:"button", classe:"onglet" + (actif ? " actif" : ""), "aria-current":actif ? "page" : null, onclick:function(){ aller({nom:"prio", n:n}); }}, [
        el("b", {texte:"Prio " + n}),
        el("small", {texte:D ? l.length + (nn ? " · " + nn + " new" : "") : "…"})
      ]));
    });
  }
  function rendreBandeaux(){
    var b = $("bandeau-comparer"), p = pageActive();
    var voir = !S.bureau && UI.compareIds.length > 0 && (p.nom === "prio" || p.nom === "suivi") && S.route.nom !== "fiche";
    b.hidden = !voir; b.textContent = "";
    if (voir) b.appendChild(bandeauComparer());
    document.body.classList.toggle("avec-bandeau", voir);
    var e = $("bandeau-echec");
    e.hidden = !S.echec; e.textContent = "";
    if (S.echec){
      e.appendChild(el("span", {texte:"Tableau injoignable" + (D && D.lu ? " · données du " + jourCourt(D.lu) + " " + heure(D.lu) : ""), title:S.erreurTexte || null}));
      e.appendChild(el("button", {type:"button", classe:"lien-txt", onclick:function(){ charger(true); }}, ["Réessayer"]));
    }
    rendreEtatChargement();
  }
  function rendreEtatChargement(){
    $("barre-charge").hidden = !(S.chargement && D);
  }
  function rendreCouches(){
    var c = $("couches");
    c.textContent = "";
    var bloque = false;
    if (!S.bureau && S.menu){ c.appendChild(menuMobile()); bloque = true; }
    if (S.route.nom === "fiche" && !S.bureau){ c.appendChild(feuilleFiche()); bloque = true; }
    if (S.route.nom === "fiche" && S.bureau){
      var f = S.fond.nom;
      if (f !== "prio" && f !== "suivi") c.appendChild(el("div", {classe:"tiroir-fiche"}, [panneauFiche()]));
    }
    if (S.tri === "feuille"){ c.appendChild(feuilleTri()); bloque = true; }
    if (S.choix && !S.bureau){ c.appendChild(feuilleChoix()); bloque = true; }
    document.documentElement.classList.toggle("bloque", bloque);
  }
  function ecranCle(){
    if (S.cleRefusee) return el("div", {classe:"ecran"}, [el("h2", {texte:"Clé refusée"}), el("p", {texte:"Le tableau a refusé la clé de ce lien. Ouvrez le dernier lien reçu par mail : la clé a peut-être changé."})]);
    return el("div", {classe:"ecran"}, [el("h2", {texte:"Lien incomplet"}), el("p", {texte:"Ouvrez le lien complet reçu par mail : il contient la clé d'accès au tableau."})]);
  }
  function ecranEchec(){
    return el("div", {classe:"ecran"}, [
      el("h2", {texte:"Tableau injoignable"}),
      el("p", {texte:"Les annonces n'ont pas pu être chargées."}),
      el("p", {classe:"gris", texte:"Raison : " + (S.erreurTexte || "inconnue")}),
      el("button", {type:"button", classe:"btn btn-accent", onclick:function(){ charger(true); }}, ["Réessayer"])
    ]);
  }
  function contenuPage(){
    /* Partage reçu sur un appareil sans clé : la page Ajouter garde le texte et explique quoi faire. */
    if (!MODE_TEST && !S.cle && S.route.nom === "ajouter" && S.ajout.texte) return vueAjouter();
    if (!MODE_TEST && !S.cle) return ecranCle();
    if (!D && S.echec) return ecranEchec();
    var r = pageActive();
    if (r.nom === "prio") return vueListe("prio", r.n);
    if (r.nom === "suivi") return vueListe("suivi");
    if (r.nom === "comparer") return vueComparer();
    if (r.nom === "ajouter") return vueAjouter();
    if (r.nom === "corbeille") return vueCorbeille();
    return vueAccueil();
  }

  /* ---------- Rendu ---------- */
  function garderDefilements(){
    var g = {};
    document.querySelectorAll("[data-garde]").forEach(function(n){ g[n.getAttribute("data-garde")] = [n.scrollTop, n.scrollLeft]; });
    return g;
  }
  function rendreDefilements(g){
    document.querySelectorAll("[data-garde]").forEach(function(n){
      var v = g[n.getAttribute("data-garde")];
      if (v){ n.scrollTop = v[0]; n.scrollLeft = v[1]; }
    });
  }
  function rendre(){
    var y = window.scrollY, g = garderDefilements();
    /* Fiche ouverte par un lien direct : la liste derrière est celle de sa Prio. */
    if (S.fondAuto && D){
      var af = trouver(S.route.num);
      if (af && af.prio) S.fond = {nom:"prio", n:af.prio};
      S.fondAuto = false;
    }
    var h = $("entete");
    h.textContent = "";
    if (S.bureau) enteteBureau(h); else enteteMobile(h);
    var b = document.body;
    b.className = b.className.replace(/\bpage-\w+/g, "").trim();
    b.classList.add("page-" + pageActive().nom);
    b.classList.toggle("bureau", S.bureau);
    /* Pas de re-rendu de la page pendant la saisie des liens : le texte et le curseur restent en place. */
    var saisie = document.activeElement && document.activeElement.id === "saisie-liens" && pageActive().nom === "ajouter";
    if (!saisie){
      var c = $("contenu");
      c.textContent = "";
      try { c.appendChild(contenuPage()); }
      catch(e){
        if (window.console) console.error(e);
        c.appendChild(el("div", {classe:"ecran"}, [el("h2", {texte:"Affichage impossible"}), el("p", {classe:"gris", texte:String(e && e.message || e)})]));
      }
    }
    rendreOnglets();
    rendreBandeaux();
    rendreCouches();
    rendreDefilements(g);
    window.scrollTo(0, y);
  }

  /* ---------- Partage reçu d'une autre appli (Web Share Target, voir manifest.webmanifest) ---------- */
  var PARAMS_PARTAGE = ["partage_titre", "partage_texte", "partage_lien"];
  /* Lit ?partage_titre=…&partage_texte=…&partage_lien=…, nettoie l'adresse et prépare la page Ajouter.
     Les applis mettent souvent le lien dans le texte, parfois aussi dans url : extraireEntrees dédoublonne. */
  function lirePartage(){
    var q = (location.search || "").replace(/^\?/, ""), morceaux = [], reste = [], vu = false;
    q.split("&").forEach(function(p){
      if (!p) return;
      var i = p.indexOf("="), k = i < 0 ? p : p.slice(0, i), v = i < 0 ? "" : p.slice(i + 1);
      try { k = decodeURIComponent(k); } catch(e){}
      if (PARAMS_PARTAGE.indexOf(k) < 0){ reste.push(p); return; }
      vu = true;
      try { v = decodeURIComponent(v.replace(/\+/g, " ")); } catch(e){ v = ""; }
      v = v.trim();
      if (v) morceaux.push(v);
    });
    if (!vu) return null;
    /* 1. Adresse nettoyée tout de suite : un rechargement ne rejoue pas le partage.
          Les autres paramètres (test=1 en mode test) sont gardés. */
    var adr = lireAdresse();
    try { history.replaceState(null, "", location.pathname + (reste.length ? "?" + reste.join("&") : "") + "#ajouter" + (adr.cle ? "&cle=" + encodeURIComponent(adr.cle) : "")); } catch(e){}
    /* 2. Texte ajouté à la suite d'une saisie éventuelle. */
    /* Seuls les liens vont dans la zone ; un partage sans lien garde son texte (il ressortira INVALIDE). */
    var t = morceaux.join("\n"), liens = extraireEntrees(t);
    if (!t) return null;
    if (new RegExp(RE_LIEN.source, "i").test(t)) t = liens.join("\n");
    S.ajout.texte = (S.ajout.texte.trim() ? S.ajout.texte.replace(/\s+$/, "") + "\n" : "") + t;
    S.ajout.resultats = null; S.ajout.coches = {}; S.ajout.fait = null;
    return t;
  }

  /* ---------- Démarrage ---------- */
  var mq = window.matchMedia("(min-width: 1024px)");
  S.bureau = mq.matches;
  function surChangementLargeur(){ S.bureau = mq.matches; S.tri = null; S.menu = false; rendre(); }
  if (mq.addEventListener) mq.addEventListener("change", surChangementLargeur); else mq.addListener(surChangementLargeur);

  var adr = lireAdresse();
  S.cle = adr.cle || lsGet(LS_CLE);
  if (adr.cle) lsSet(LS_CLE, adr.cle);
  /* Déploiement de test : #api=… n'est accepté qu'en dehors du site de production. */
  if (!PROD){
    if (adr.api && API_TEST.test(adr.api)) lsSet(LS_API, adr.api);
    var apiTest = lsGet(LS_API);
    if (apiTest && API_TEST.test(apiTest)){
      S.api = apiTest;
      document.body.appendChild(el("div", {classe:"badge-test", texte:"API de test"}));
    }
  }
  if (MODE_TEST) document.body.appendChild(el("div", {classe:"badge-test", texte:"Données de test"}));
  var partage = lirePartage();
  var cache = (MODE_TEST || S.cle) ? lireCache() : null;
  if (cache) appliquer(cache);
  window.addEventListener("hashchange", surRoute);
  surRoute();
  charger(true);
  /* Jamais d'envoi automatique : la vérification seulement, l'envoi reste un appui sur le bouton. */
  if (partage && (MODE_TEST || S.cle)) verifier();
  /* Mode test : contrôles lançables depuis la console. onhTests.partage() vérifie qu'aucun texte partagé ne contient la clé. */
  if (MODE_TEST) window.onhTests = {
    partage:function(){
      var fautifs = annonces().filter(function(a){ return !partageSur(textePartage(a)); }).map(function(a){ return a.num; });
      var r = {ok:!fautifs.length && !!annonces().length, annonces:annonces().length, fautifs:fautifs, exemple:annonces()[0] ? textePartage(annonces()[0]) : null};
      if (window.console) console.log("onhTests.partage", r.ok ? "OK" : "ÉCHEC", r);
      return r;
    },
    texte:function(num){ var a = trouver(num); return a ? textePartage(a) : null; }
  };

  /* Plusieurs personnes modifient le même tableau : relire au retour au premier plan, au plus toutes les 30 s. */
  document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "visible") charger(false); });
  window.addEventListener("focus", function(){ charger(false); });
  window.addEventListener("online", function(){ if (S.echec) charger(true); });
  document.addEventListener("keydown", function(e){
    if (e.key !== "Escape") return;
    if (S.tri || S.menu || S.choix){ S.tri = null; S.menu = false; S.choix = false; rendre(); }
    else if (S.route.nom === "fiche") fermerFiche();
  });
  document.addEventListener("click", function(e){
    if (S.tri === "menu" && !e.target.closest(".zone-tri")){ S.tri = null; rendre(); }
  });

  if ("serviceWorker" in navigator && location.protocol === "https:"){
    window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
  }
})();
