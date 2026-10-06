/**
 * Objectif New Home : API du tableau de suivi (V3).
 * Script lié au tableau (SpreadsheetApp.getActive), publié en application web.
 *
 *  GET  <url>?cle=XXX  -> annonces non masquées + rapport + réglages + horodatage (JSON)
 *  POST <url> (corps JSON, envoyé en Content-Type text/plain pour éviter la requête préalable CORS) :
 *    {"cle":"XXX","action":"favori","num":5,"valeur":true}
 *    {"cle":"XXX","action":"contact","num":5,"valeur":false}
 *    {"cle":"XXX","action":"corbeille","num":5}
 *    {"cle":"XXX","action":"restaurer","num":5}
 *    {"cle":"XXX","action":"verifierLiens","liens":["https://…","texte collé…"]}
 *    {"cle":"XXX","action":"ajouter","liens":["https://…"]}
 *
 * La clé est rangée dans les propriétés du script (definirCle()). Sans clé configurée, tout est refusé.
 * Les colonnes sont repérées par leur en-tête : on peut les déplacer dans le tableau.
 * Le site n'écrit que Favori, En contact, En contact depuis, Corbeille, Corbeille le,
 * Statut changé le et Raison corbeille (vidée à la restauration), et des lignes dans Ajouts.
 */

const ONGLET_ANNONCES = 'Annonces';
const ONGLET_RAPPORT = 'Rapport';
const ONGLET_AJOUTS = 'Ajouts';
const ONGLET_REGLAGES = 'Réglages';
const FUSEAU = 'Europe/Paris';
const FORMAT_DATE = 'dd/MM/yyyy HH:mm';
const MAX_LIENS = 50;

// [clé JSON, en-tête dans le tableau, type]. À garder identique à scripts/tableau.py du skill.
// « Ancien statut » (reste de la migration v3.1) n'y figure pas : il est ignoré.
const COLONNES = [
  ['num', 'N°', 'nombre'],
  ['notes', 'Notes', 'texte'],
  ['prio', 'Prio', 'nombre'],
  ['commune', 'Commune', 'texte'],
  ['quartier', 'Quartier', 'texte'],
  ['prix', 'Prix (€)', 'nombre'],
  ['surface', 'Surface (m²)', 'nombre'],
  ['pieces', 'Pièces', 'nombre'],
  ['chambres', 'Chambres', 'nombre'],
  ['terrain', 'Terrain (m²)', 'nombre'],
  ['dpe', 'DPE', 'texte'],
  ['garage', 'Garage', 'ouinon'],
  ['lien', 'Lien', 'texte'],
  ['lienVerifieLe', 'Lien vérifié le', 'date'],
  ['source', 'Source', 'texte'],
  ['repereeLe', 'Repérée le', 'date'],
  ['pepite', 'Pépite', 'oui'],
  ['score', 'Score', 'nombre'],
  ['atouts', 'Atouts', 'liste'],
  ['vigilance', 'Vigilance', 'liste'],
  ['resume', 'Résumé', 'texte'],
  ['masquee', 'Masquée', 'oui'],
  ['raisonMasquee', 'Raison masquée', 'texte'],
  ['titre', 'Titre', 'texte'],
  ['id', 'Identifiant', 'texte'],
  ['statutLe', 'Statut changé le', 'date'],
  ['raisonCorbeille', 'Raison corbeille', 'texte'],
  ['masqueeLe', 'Masquée le', 'date'],
  ['photo', 'Photo', 'texte'],
  ['favori', 'Favori', 'oui'],
  ['enContact', 'En contact', 'oui'],
  ['enContactDepuis', 'En contact depuis', 'date'],
  ['corbeille', 'Corbeille', 'oui'],
  ['corbeilleLe', 'Corbeille le', 'date'],
  ['etat', 'État', 'texte'],
  ['energieMin', 'Énergie min (€/an)', 'nombre'],
  ['energieMax', 'Énergie max (€/an)', 'nombre'],
  ['taxeFonciere', 'Taxe foncière (€/an)', 'nombre'],
];

// Champs renvoyés au site : ni notes, ni masquage, ni identifiant.
const CHAMPS_SITE = [
  'num', 'prio', 'commune', 'quartier', 'prix', 'surface', 'pieces', 'chambres', 'terrain', 'dpe', 'garage',
  'lien', 'lienVerifieLe', 'source', 'repereeLe', 'pepite', 'score', 'atouts', 'vigilance', 'resume', 'titre',
  'photo', 'statutLe', 'raisonCorbeille', 'favori', 'enContact', 'enContactDepuis', 'corbeille', 'corbeilleLe',
  'etat', 'energieMin', 'energieMax', 'taxeFonciere',
];

// Les seules colonnes d'Annonces que le site a le droit d'écrire.
const ECRITES_PAR_LE_SITE = ['favori', 'enContact', 'enContactDepuis', 'corbeille', 'corbeilleLe', 'statutLe', 'raisonCorbeille'];

const AJOUTS = {
  lien: "Lien de l'annonce", par: 'Ajouté par', commentaire: 'Commentaire', ajouteLe: 'Ajouté le',
  traiteLe: 'Traité le', resultat: 'Résultat', num: 'N°',
};

/* ---------------- Points d'entrée ---------------- */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    verifierCle_(p.cle);
    const annonces = lireAnnonces_().filter(x => !x.annonce.masquee).map(x => pourSite_(x.annonce));
    return json_({ ok: true, lu: new Date().toISOString(), rapport: lireRapport_(), reglages: lireReglages_(), annonces: annonces });
  } catch (err) {
    return json_({ ok: false, erreur: String(err.message || err) });
  }
}

function doPost(e) {
  const verrou = LockService.getScriptLock();
  let verrouille = false;
  try {
    let corps;
    try {
      corps = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (x) {
      throw new Error('Corps de requête illisible (JSON attendu).');
    }
    verifierCle_(corps.cle);
    const action = corps.action;
    if (action === 'verifierLiens') {
      return json_({ ok: true, resultats: verifierLiens_(corps.liens, lireAnnonces_(), lireAjouts_()) });
    }
    if (['favori', 'contact', 'corbeille', 'restaurer', 'ajouter'].indexOf(action) < 0) {
      throw new Error('Action inconnue : ' + action);
    }
    verrou.waitLock(15000);
    verrouille = true;
    if (action === 'ajouter') return json_(Object.assign({ ok: true }, ajouter_(corps.liens)));
    return json_({ ok: true, annonce: changerStatut_(action, corps) });
  } catch (err) {
    return json_({ ok: false, erreur: String(err.message || err) });
  } finally {
    if (verrouille) {
      try { verrou.releaseLock(); } catch (x) {}
    }
  }
}

/* ---------------- Lecture ---------------- */

function lireAnnonces_() {
  const f = onglet_(ONGLET_ANNONCES);
  const valeurs = f.getDataRange().getValues();
  if (valeurs.length < 2) return [];
  const idx = indexEntetes_(valeurs[0]);
  const res = [];
  for (let i = 1; i < valeurs.length; i++) {
    const ligne = valeurs[i];
    if (ligne.every(v => v === '' || v === null)) continue;
    const a = ligneVersAnnonce_(ligne, idx);
    if (typeof a.num !== 'number') continue;
    res.push({ ligne: i + 1, annonce: a });
  }
  return res;
}

function ligneVersAnnonce_(ligne, idx) {
  const a = {};
  COLONNES.forEach(([cle, , type]) => {
    if (idx[cle] === undefined) return;
    const v = convertirLecture_(type, ligne[idx[cle]]);
    if (v !== null) a[cle] = v;
  });
  return a;
}

function pourSite_(a) {
  const r = {};
  CHAMPS_SITE.forEach(k => {
    if (a[k] === undefined || a[k] === false) return;
    r[k] = a[k];
  });
  if (a.garage === false) r.garage = false;
  return r;
}

function lireRapport_() {
  const f = onglet_(ONGLET_RAPPORT);
  const haut = f.getRange(1, 1, 3, 5).getValues();
  const stats = { lues: null, retenues: null, doublons: null };
  haut.forEach(r => {
    const lib = String(r[3] || '').toLowerCase();
    const n = convertirLecture_('nombre', r[4]);
    if (/lues/.test(lib)) stats.lues = n;
    else if (/retenues/.test(lib)) stats.retenues = n;
    else if (/doublons/.test(lib)) stats.doublons = n;
  });
  const paragraphes = [];
  const n = Math.max(f.getLastRow() - 4, 0);
  if (n) {
    const col = f.getRange(5, 2, n, 1).getValues();
    for (let i = 0; i < col.length; i++) {
      const t = String(col[i][0] === null ? '' : col[i][0]).trim();
      if (!t) break;
      paragraphes.push(t);
    }
  }
  return { derniereVeille: convertirLecture_('date', haut[0][1]), stats: stats, paragraphes: paragraphes };
}

/* Onglet Réglages : colonne A le libellé, colonne B la valeur, ligne 1 d'en-tête.
 * Libellés reconnus : « Plafond », « Plafond max », « Prio N cible », « Prio N zone », « Critère » (une ligne par critère).
 * Ces réglages ne sont jamais dans le dépôt public : le site les reçoit ici, avec la clé. Sans onglet, renvoie null. */
function lireReglages_() {
  const f = SpreadsheetApp.getActive().getSheetByName(ONGLET_REGLAGES);
  if (!f || f.getLastRow() < 2) return null;
  const r = { plafond: null, plafondMax: null, prios: {}, criteres: [] };
  f.getRange(2, 1, f.getLastRow() - 1, 2).getValues().forEach(l => {
    const lib = String(l[0] || '').trim().toLowerCase();
    const v = l[1];
    if (!lib || v === '' || v === null) return;
    let m;
    if (lib === 'plafond') r.plafond = convertirLecture_('nombre', v);
    else if (lib === 'plafond max') r.plafondMax = convertirLecture_('nombre', v);
    else if ((m = lib.match(/^prio\s*([1-4])\s+(cible|zone)$/))) {
      const p = r.prios[m[1]] = r.prios[m[1]] || {};
      if (m[2] === 'cible') p.cibleMax = convertirLecture_('nombre', v);
      else p.zone = String(v).trim().slice(0, 80);
    } else if (/^crit[eè]re/.test(lib)) r.criteres.push(String(v).trim().slice(0, 60));
  });
  return r;
}

function lireAjouts_() {
  const f = onglet_(ONGLET_AJOUTS);
  const valeurs = f.getDataRange().getValues();
  if (!valeurs.length) return { idx: {}, lignes: [], largeur: 0 };
  const idx = {};
  valeurs[0].forEach((e, i) => {
    Object.keys(AJOUTS).forEach(k => { if (String(e).trim() === AJOUTS[k]) idx[k] = i; });
  });
  if (idx.lien === undefined) throw new Error("Colonne absente de l'onglet Ajouts : " + AJOUTS.lien);
  const lignes = [];
  for (let i = 1; i < valeurs.length; i++) {
    const r = valeurs[i];
    const lien = String(r[idx.lien] === null ? '' : r[idx.lien]).trim();
    if (!lien) continue;
    const traiteLe = idx.traiteLe === undefined ? null : r[idx.traiteLe];
    lignes.push({
      lien: lien,
      ajouteLe: idx.ajouteLe === undefined ? null : convertirLecture_('date', r[idx.ajouteLe]),
      traite: traiteLe !== '' && traiteLe !== null && traiteLe !== undefined,
      traiteLe: convertirLecture_('date', traiteLe),
      resultat: idx.resultat === undefined ? null : convertirLecture_('texte', r[idx.resultat]),
    });
  }
  return { idx: idx, lignes: lignes, largeur: valeurs[0].length };
}

/* ---------------- Écriture : statuts ---------------- */

function changerStatut_(action, corps) {
  const num = Number(corps.num);
  if (!(num > 0)) throw new Error("Numéro d'annonce manquant.");
  const f = onglet_(ONGLET_ANNONCES);
  // Relire l'état juste avant d'écrire, sous verrou, et retrouver la ligne par N°.
  const valeurs = f.getDataRange().getValues();
  const idx = indexEntetes_(valeurs[0]);
  ['num'].concat(ECRITES_PAR_LE_SITE).forEach(k => {
    if (idx[k] === undefined) throw new Error('Colonne absente du tableau : ' + enTete_(k));
  });
  let i = -1;
  for (let j = 1; j < valeurs.length; j++) {
    if (convertirLecture_('nombre', valeurs[j][idx.num]) === num) { i = j; break; }
  }
  if (i < 0) throw new Error('Annonce n°' + num + ' introuvable.');
  const avant = ligneVersAnnonce_(valeurs[i], idx);
  if (avant.masquee) throw new Error('Annonce n°' + num + ' introuvable.');

  const maintenant = horodatage_();
  const maj = {};
  if (action === 'favori' || action === 'contact') {
    if (avant.corbeille) throw new Error('Annonce n°' + num + ' dans la corbeille : restaurez-la d\'abord.');
  }
  if (action === 'favori') {
    maj.favori = corps.valeur ? 'Oui' : '';
  } else if (action === 'contact') {
    if (corps.valeur) {
      maj.enContact = 'Oui';
      if (!avant.enContactDepuis) maj.enContactDepuis = maintenant;
    } else {
      maj.enContact = '';
      maj.enContactDepuis = '';
    }
  } else if (action === 'corbeille') {
    maj.corbeille = 'Oui';
    if (!avant.corbeille) maj.corbeilleLe = maintenant;
    maj.favori = '';
    maj.enContact = '';
    maj.enContactDepuis = '';
  } else if (action === 'restaurer') {
    maj.corbeille = '';
    maj.corbeilleLe = '';
    maj.raisonCorbeille = '';
  }
  maj.statutLe = maintenant;

  Object.keys(maj).forEach(k => {
    if (ECRITES_PAR_LE_SITE.indexOf(k) < 0) throw new Error('Écriture interdite : ' + k);
    const r = f.getRange(i + 1, idx[k] + 1);
    r.setValue(maj[k]);
    if (maj[k] instanceof Date) r.setNumberFormat(FORMAT_DATE);
  });
  SpreadsheetApp.flush();
  const apres = f.getRange(i + 1, 1, 1, valeurs[0].length).getValues()[0];
  return pourSite_(ligneVersAnnonce_(apres, idx));
}

/* ---------------- Ajouts : vérification et envoi ---------------- */

function verifierLiens_(liens, annonces, ajouts) {
  if (!Array.isArray(liens)) throw new Error('Liste de liens attendue.');
  if (liens.length > MAX_LIENS) throw new Error('Trop de liens à la fois (' + MAX_LIENS + ' au plus).');

  // Index des annonces (masquées comprises) et des ajouts en attente, par clé de lien.
  const parCle = {};
  annonces.forEach(x => {
    const l = analyserLien_(x.annonce.lien);
    if (!l.valide) return;
    (parCle[l.cle] = parCle[l.cle] || []).push(x.annonce);
  });
  // Ajouts en attente (sans Traité le) : le premier envoi. Ajouts déjà analysés : le traitement le plus récent.
  const enAttente = {};
  const dejaAnalyses = {};
  ajouts.lignes.forEach(r => {
    const l = analyserLien_(r.lien);
    if (!l.valide) return;
    if (r.traite) {
      const t = dejaAnalyses[l.cle];
      if (!t || (r.traiteLe && (!t.traiteLe || r.traiteLe > t.traiteLe))) dejaAnalyses[l.cle] = r;
      return;
    }
    const d = enAttente[l.cle];
    if (!d || (r.ajouteLe && (!d.ajouteLe || r.ajouteLe < d.ajouteLe))) enAttente[l.cle] = r;
  });

  // Les entrées identiques d'une même saisie sont regroupées avant tout traitement.
  const groupes = [];
  const vus = {};
  liens.forEach(brut => {
    const texte = String(brut === null || brut === undefined ? '' : brut).trim();
    if (!texte) return;
    const l = analyserLien_(texte);
    const k = l.valide ? 'L:' + l.cle : 'T:' + texte;
    if (vus[k]) { vus[k].nb++; return; }
    const g = { entree: texte.slice(0, 1000), valide: l.valide, nb: 1 };
    if (l.valide) g.cle = l.cle;
    vus[k] = g;
    groupes.push(g);
  });

  return groupes.map(g => {
    const r = { entree: g.entree, nb: g.nb };
    if (!g.valide) { r.etat = 'INVALIDE'; return r; }
    const trouvees = parCle[g.cle] || [];
    const enCorbeille = trouvees.filter(a => a.corbeille)[0];
    const visible = trouvees.filter(a => !a.corbeille && !a.masquee)[0];
    const masquee = trouvees.filter(a => !a.corbeille && a.masquee)[0];
    if (enCorbeille) {
      r.etat = 'IGNOREE';
      Object.assign(r, detailAnnonce_(enCorbeille));
      r.corbeilleLe = enCorbeille.corbeilleLe || enCorbeille.statutLe || null;
    } else if (visible || masquee) {
      const a = visible || masquee;
      r.etat = 'DOUBLON';
      Object.assign(r, detailAnnonce_(a));
      if (!visible) {
        r.masquee = true;
        if (masquee.raisonMasquee) r.raisonMasquee = masquee.raisonMasquee;
      }
    } else if (enAttente[g.cle]) {
      r.etat = 'EN_ATTENTE';
      r.envoyeLe = enAttente[g.cle].ajouteLe || null;
    } else if (dejaAnalyses[g.cle]) {
      r.etat = 'DEJA_ANALYSEE';
      r.traiteLe = dejaAnalyses[g.cle].traiteLe || null;
      r.resultat = dejaAnalyses[g.cle].resultat || null;
    } else {
      r.etat = 'A_TRAITER';
    }
    return r;
  });
}

function detailAnnonce_(a) {
  const d = { num: a.num };
  if (a.prio !== undefined) d.prio = a.prio;
  if (a.quartier) d.quartier = a.quartier;
  if (a.commune) d.commune = a.commune;
  return d;
}

function ajouter_(liens) {
  // Refaire la vérification sous verrou : un autre appareil a pu envoyer le même lien entre-temps.
  const ajouts = lireAjouts_();
  const resultats = verifierLiens_(liens, lireAnnonces_(), ajouts);
  const aTraiter = resultats.filter(r => r.etat === 'A_TRAITER');
  const ecartes = resultats.filter(r => r.etat !== 'A_TRAITER');
  if (aTraiter.length) {
    const f = onglet_(ONGLET_AJOUTS);
    const idx = ajouts.idx;
    if (idx.ajouteLe === undefined) throw new Error("Colonne absente de l'onglet Ajouts : " + AJOUTS.ajouteLe);
    const largeur = Math.max(ajouts.largeur, f.getLastColumn());
    const maintenant = horodatage_();
    const lignes = aTraiter.map(r => {
      const l = new Array(largeur).fill('');
      l[idx.lien] = texteSur_(r.entree, 1000);
      l[idx.ajouteLe] = maintenant;
      return l;
    });
    const debut = f.getLastRow() + 1;
    f.getRange(debut, 1, lignes.length, largeur).setValues(lignes);
    f.getRange(debut, idx.ajouteLe + 1, lignes.length, 1).setNumberFormat(FORMAT_DATE);
    SpreadsheetApp.flush();
  }
  return { ajoutes: aTraiter.map(r => r.entree), ecartes: ecartes };
}

/* ---------------- Normalisation des liens ---------------- */

// Paramètres de suivi supprimés avant comparaison.
const PARAMS_SUIVI = /^(utm_.*|at_.*|mc_.*|mtm_.*|pk_.*|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|igshid|srsltid|xtor|ref|from|_ga|_gl|_hsenc|_hsmi|cmp|cmpid)$/i;

// Identifiant d'annonce dans le chemin, par site : [hôte, motif du chemin, préfixe].
const SITES = [
  [/(^|\.)leboncoin\.fr$/, /\/(?:vi|ad\/[^\/]+)\/(\d+)(?:\.htm)?$/i, 'leboncoin'],
  [/(^|\.)seloger\.com$/, /\/(\d{6,})\.htm$/i, 'seloger'],
  [/(^|\.)bienici\.com$/, /^\/annonce\/(?:[^\/]+\/)*([^\/]+)$/i, 'bienici'],
  [/(^|\.)pap\.fr$/, /-r(\d{6,})$/i, 'pap'],
  [/(^|\.)orpi\.com$/, /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i, 'orpi'],
  [/(^|\.)laforet\.com$/, /-(\d{6,})$/i, 'laforet'],
  [/(^|\.)lesclefsdechezmoi\.fr$/, /-(\d{5,})\.html?$/i, 'lesclefsdechezmoi'],
];

/**
 * Clé de comparaison d'un lien. Seules les URL http(s) valides sont acceptées.
 * Les liens de suivi (click.by.seloger.com…) ne sont pas résolus : ils sont comparés tels quels.
 */
function analyserLien_(brut) {
  const s = String(brut === null || brut === undefined ? '' : brut).trim();
  const m = s.match(/^https?:\/\/([^\/?#\s]+)([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i);
  if (!m) return { valide: false };
  let hote = m[1].toLowerCase();
  hote = hote.slice(hote.lastIndexOf('@') + 1).replace(/:(80|443)$/, '');
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?$/.test(hote)) return { valide: false };
  hote = hote.replace(/^www\./, '');
  const chemin = (m[2] || '').replace(/\/+$/, '');
  for (let i = 0; i < SITES.length; i++) {
    if (!SITES[i][0].test(hote)) continue;
    const id = chemin.match(SITES[i][1]);
    if (id) return { valide: true, cle: SITES[i][2] + ':' + id[1].toLowerCase() };
  }
  const params = (m[3] || '').slice(1).split('&').filter(p => {
    if (!p) return false;
    let nom = p.split('=')[0];
    try { nom = decodeURIComponent(nom); } catch (x) {}
    return !PARAMS_SUIVI.test(nom);
  }).sort();
  return { valide: true, cle: (hote + chemin + (params.length ? '?' + params.join('&') : '')).toLowerCase() };
}

/* ---------------- Outils ---------------- */

function convertirLecture_(type, v) {
  if (v === '' || v === null || v === undefined) return null;
  switch (type) {
    case 'nombre': {
      if (typeof v === 'number') return v;
      // Cellule au format date par erreur (ex. 1740 affiché 05/10/1904) : on reprend le numéro de série du tableur.
      if (v instanceof Date) return Math.round((v.getTime() - Date.UTC(1899, 11, 30)) / 864e5);
      const n = Number(String(v).replace(/[^\d,.\-]/g, '').replace(',', '.'));
      return String(v).trim() === '' || isNaN(n) ? null : n;
    }
    case 'date':
      return dateIso_(v);
    case 'oui':
      return v === true || /^(oui|true|vrai|x)$/i.test(String(v).trim());
    case 'ouinon': {
      const s = String(v).trim().toLowerCase();
      return s === 'oui' ? true : s === 'non' ? false : null;
    }
    case 'liste':
      return String(v).split('\n').map(s => s.trim()).filter(Boolean);
    default:
      return String(v);
  }
}

/** Date du tableau en ISO : vraie date, ou texte « 05/10/2026 20:00 », « 2026-10-05 20:00 ». */
function dateIso_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) return dateParis_(m[3], m[2], m[1], m[4], m[5], m[6]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) return dateParis_(m[1], m[2], m[3], m[4], m[5], m[6]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function dateParis_(a, mo, j, h, mi, se) {
  const p = n => ('0' + Number(n || 0)).slice(-2);
  const texte = a + '-' + p(mo) + '-' + p(j) + ' ' + p(h) + ':' + p(mi) + ':' + p(se);
  const d = Utilities.parseDate(texte, FUSEAU, 'yyyy-MM-dd HH:mm:ss');
  return d && !isNaN(d.getTime()) ? d.toISOString() : null;
}

function horodatage_() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

function indexEntetes_(entetes) {
  const parEntete = {};
  COLONNES.forEach(([cle, entete]) => { parEntete[entete] = cle; });
  const idx = {};
  entetes.forEach((e, i) => {
    const cle = parEntete[String(e).trim()];
    if (cle && idx[cle] === undefined) idx[cle] = i;
  });
  return idx;
}

function enTete_(cle) {
  const c = COLONNES.filter(x => x[0] === cle)[0];
  return c ? c[1] : cle;
}

// Empêche qu'un texte envoyé depuis le site soit pris pour une formule.
function texteSur_(v, max) {
  let s = String(v === undefined || v === null ? '' : v).slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function verifierCle_(cle) {
  const attendue = PropertiesService.getScriptProperties().getProperty('CLE');
  if (!attendue) throw new Error("Clé non configurée : lancer definirCle() dans l'éditeur.");
  if (cle !== attendue) throw new Error('Clé absente ou incorrecte.');
}

function onglet_(nom) {
  const f = SpreadsheetApp.getActive().getSheetByName(nom);
  if (!f) throw new Error('Onglet introuvable : ' + nom);
  return f;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Crée une nouvelle clé (et invalide l'ancienne). À relancer si la clé a fuité. */
function definirCle() {
  const cle = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
  PropertiesService.getScriptProperties().setProperty('CLE', cle);
  Logger.log('Nouvelle clé : ' + cle);
  return cle;
}

/** Affiche la clé actuelle dans le journal d'exécution. */
function afficherCle() {
  Logger.log('Clé actuelle : ' + PropertiesService.getScriptProperties().getProperty('CLE'));
}

/** Test rapide depuis l'éditeur : affiche ce que renverrait doGet, sans rien écrire. */
function testerLecture() {
  const r = JSON.parse(doGet({ parameter: { cle: PropertiesService.getScriptProperties().getProperty('CLE') } }).getContent());
  Logger.log('ok=%s, %s annonces visibles, dernière veille %s, stats %s',
    r.ok, r.annonces ? r.annonces.length : 0, r.rapport ? r.rapport.derniereVeille : '-', r.rapport ? JSON.stringify(r.rapport.stats) : '-');
  Logger.log('réglages %s', JSON.stringify(r.reglages));
  if (!r.ok) Logger.log(r.erreur);
}

/** Test de la vérification des liens depuis l'éditeur, sans rien écrire. */
function testerVerification() {
  const liens = [
    'https://www.leboncoin.fr/ad/ventes_immobilieres/1234567890?utm_source=test',
    'Maison à voir rue Jean-Jaurès',
  ];
  Logger.log(JSON.stringify(verifierLiens_(liens, lireAnnonces_(), lireAjouts_()), null, 2));
}
