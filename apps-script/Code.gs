/**
 * Objectif New Home : API du tableau de suivi (V3.7).
 * Script lié au tableau (SpreadsheetApp.getActive), publié en application web.
 *
 *  GET  <url>?cle=XXX  -> annonces non masquées (avec leur note) + journal + rapport + réglages + personnes + horodatage (JSON)
 *  POST <url> (corps JSON, envoyé en Content-Type text/plain pour éviter la requête préalable CORS) :
 *    {"cle":"XXX","action":"favori","num":5,"qui":"p1","valeur":true}   (qui : id d'une personne, voir « personnes »)
 *    {"cle":"XXX","action":"contact","num":5,"valeur":false}
 *    {"cle":"XXX","action":"corbeille","num":5,"raison":"Trop de travaux"}
 *    {"cle":"XXX","action":"restaurer","num":5}
 *    {"cle":"XXX","action":"note","num":5,"texte":"…"}            (texte vide : note vidée)
 *    {"cle":"XXX","action":"journal","num":5,"texte":"…","par":"Prénom"}
 *  Chaque changement de statut ajoute une ligne automatique (sans prénom) à l'onglet Journal, créé au besoin.
 *  Un commentaire peut être signé : « par » (prénom) est facultatif. Le journal ne se modifie pas depuis le site.
 *    {"cle":"XXX","action":"verifierLiens","liens":["https://…","texte collé…"]}
 *    {"cle":"XXX","action":"ajouter","liens":["https://…"]}
 *  verifierLiens : état par lien (A_TRAITER, DOUBLON, IGNOREE, EN_ATTENTE, DEJA_ANALYSEE, LIEN_SUIVI, INVALIDE).
 *  ajouter : écrit A_TRAITER et les DEJA_ANALYSEE renvoyables (résultat autre que « Ajoutée… »), en nouvelles lignes.
 *
 * La clé est rangée dans les propriétés du script (definirCle()). Sans clé configurée, tout est refusé.
 * Les colonnes sont repérées par leur en-tête : on peut les déplacer dans le tableau.
 * Favoris : une colonne « Favori <Prénom> » par personne, repérée par son en-tête (aucun prénom dans ce code).
 * L'API renvoie personnes = [{id:"p1", nom:"<Prénom>"}, …] dans l'ordre des colonnes, et aimeePar = ["p1", …] par annonce.
 * Le site n'écrit que les colonnes « Favori <Prénom> », En contact, En contact depuis, Corbeille, Corbeille le,
 * Statut changé le, Raison corbeille (vidée à la restauration) et Notes, des lignes dans Ajouts et dans Journal.
 */

const ONGLET_ANNONCES = 'Annonces';
const ONGLET_RAPPORT = 'Rapport';
const ONGLET_AJOUTS = 'Ajouts';
const ONGLET_REGLAGES = 'Réglages';
const ONGLET_JOURNAL = 'Journal';
const ENTETES_JOURNAL = ['Date', 'N°', 'Par', 'Type', 'Texte'];
const MAX_NOTE = 2000;
const MAX_RAISON = 500;
const MAX_JOURNAL = 1000; // entrées renvoyées au site (les plus récentes)
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
  // Favoris : colonnes « Favori <Prénom> » repérées à part (personnes_). L'ancienne colonne « Favori » est ignorée.
  ['enContact', 'En contact', 'oui'],
  ['enContactDepuis', 'En contact depuis', 'date'],
  ['corbeille', 'Corbeille', 'oui'],
  ['corbeilleLe', 'Corbeille le', 'date'],
  ['etat', 'État', 'texte'],
  ['energieMin', 'Énergie min (€/an)', 'nombre'],
  ['energieMax', 'Énergie max (€/an)', 'nombre'],
  ['taxeFonciere', 'Taxe foncière (€/an)', 'nombre'],
];

// Champs renvoyés au site (avec la clé) : ni masquage, ni identifiant.
const CHAMPS_SITE = [
  'num', 'notes', 'prio', 'commune', 'quartier', 'prix', 'surface', 'pieces', 'chambres', 'terrain', 'dpe', 'garage',
  'lien', 'lienVerifieLe', 'source', 'repereeLe', 'pepite', 'score', 'atouts', 'vigilance', 'resume', 'titre',
  'photo', 'statutLe', 'raisonCorbeille', 'aimeePar', 'ajoutManuel', 'vigilanceCriteres', 'enContact', 'enContactDepuis', 'corbeille', 'corbeilleLe',
  'etat', 'energieMin', 'energieMax', 'taxeFonciere',
];

// Les seules colonnes d'Annonces que le site a le droit d'écrire.
const ECRITES_PAR_LE_SITE = ['enContact', 'enContactDepuis', 'corbeille', 'corbeilleLe', 'statutLe', 'raisonCorbeille', 'notes'];

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
    return json_({ ok: true, lu: new Date().toISOString(), rapport: lireRapport_(), reglages: lireReglages_(), personnes: lirePersonnes_(),
      annonces: annonces, journal: lireJournal_() });
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
    if (['favori', 'contact', 'corbeille', 'restaurer', 'ajouter', 'note', 'journal'].indexOf(action) < 0) {
      throw new Error('Action inconnue : ' + action);
    }
    verrou.waitLock(15000);
    verrouille = true;
    if (action === 'ajouter') return json_(Object.assign({ ok: true }, ajouter_(corps.liens)));
    if (action === 'note') return json_({ ok: true, annonce: ecrireNote_(corps) });
    if (action === 'journal') return json_({ ok: true, entree: ajouterAuJournal_(corps) });
    return json_(Object.assign({ ok: true }, changerStatut_(action, corps)));
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
  const aime = (idx._personnes || []).filter(p => convertirLecture_('oui', ligne[p.col]) === true).map(p => p.id);
  if (aime.length) a.aimeePar = aime;
  return a;
}

/* Colonnes « Favori <Prénom> » (pas l'ancienne « Favori » seule), dans l'ordre du tableau : p1, p2… */
function personnes_(entetes) {
  const res = [];
  entetes.forEach((e, i) => {
    const m = String(e).trim().match(/^favori\s+(.+)$/i);
    if (m) res.push({ id: 'p' + (res.length + 1), nom: m[1].trim().slice(0, 30), col: i });
  });
  return res;
}

function lirePersonnes_() {
  const f = onglet_(ONGLET_ANNONCES);
  const entetes = f.getRange(1, 1, 1, Math.max(1, f.getLastColumn())).getValues()[0];
  return personnes_(entetes).map(p => ({ id: p.id, nom: p.nom }));
}

/* Ajout manuel : la colonne Source commence par « Ajout de » (posée par la veille). */
function estAjoutManuel_(a) { return /^\s*ajout de\b/i.test(String(a.source || '')); }

/* Vigilance : les lignes « Écart : … » (posées par la veille) sont les écarts à nos critères. */
const RE_ECART = /^\s*[ée]cart\s*:\s*/i;

function pourSite_(a) {
  a = Object.assign({}, a);
  if (estAjoutManuel_(a)) a.ajoutManuel = true;
  if (Array.isArray(a.vigilance)) {
    const ecarts = a.vigilance.filter(t => RE_ECART.test(t)).map(t => t.replace(RE_ECART, '').trim()).filter(Boolean);
    const autres = a.vigilance.filter(t => !RE_ECART.test(t));
    if (ecarts.length) a.vigilanceCriteres = ecarts;
    if (autres.length) a.vigilance = autres; else delete a.vigilance;
  }
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
 * Libellés reconnus (inchangés dans le tableau, la veille les lit aussi) :
 *   « Plafond » = budget, « Plafond max » = tolérance, « Prio N cible » = plafond indicatif de la Prio (1 à 4),
 *   « Prio N zone » = nom de la Prio (1 à 5 ; la 5 est « Autres », sans plafond), « Critère » (une ligne par critère).
 * Ces réglages ne sont jamais dans le dépôt public : le site les reçoit ici, avec la clé. Sans onglet, renvoie null. */
function lireReglages_() {
  const f = SpreadsheetApp.getActive().getSheetByName(ONGLET_REGLAGES);
  if (!f || f.getLastRow() < 2) return null;
  const r = { budget: null, tolerance: null, prios: {}, criteres: [] };
  f.getRange(2, 1, f.getLastRow() - 1, 2).getValues().forEach(l => {
    const lib = String(l[0] || '').trim().toLowerCase();
    const v = l[1];
    if (!lib || v === '' || v === null) return;
    let m;
    if (lib === 'plafond') r.budget = convertirLecture_('nombre', v);
    else if (lib === 'plafond max') r.tolerance = convertirLecture_('nombre', v);
    else if ((m = lib.match(/^prio\s*([1-5])\s+(cible|zone)$/))) {
      const p = r.prios[m[1]] = r.prios[m[1]] || {};
      if (m[2] === 'cible') { if (m[1] !== '5') p.plafond = convertirLecture_('nombre', v); }
      else p.zone = String(v).trim().slice(0, 80);
    } else if (/^crit[eè]re/.test(lib)) r.criteres.push(String(v).trim().slice(0, 60));
  });
  return r;
}

/* Onglet Journal : une ligne par événement (Date, N°, Par, Type, Texte). Renvoie les plus récents, du plus ancien au plus récent. */
function lireJournal_() {
  const f = SpreadsheetApp.getActive().getSheetByName(ONGLET_JOURNAL);
  if (!f || f.getLastRow() < 2) return [];
  const res = [];
  f.getRange(2, 1, f.getLastRow() - 1, ENTETES_JOURNAL.length).getValues().forEach(l => {
    const le = convertirLecture_('date', l[0]);
    const num = convertirLecture_('nombre', l[1]);
    const texte = String(l[4] === null ? '' : l[4]).trim();
    if (!le || typeof num !== 'number' || !texte) return;
    const e = { le: le, num: num, type: String(l[3] || '').trim() || 'Commentaire', texte: texte.slice(0, MAX_NOTE) };
    const par = String(l[2] || '').trim();
    if (par) e.par = par.slice(0, 30);
    res.push(e);
  });
  res.sort((x, y) => x.le < y.le ? -1 : x.le > y.le ? 1 : 0);
  return res.slice(-MAX_JOURNAL);
}

function ongletJournal_() {
  const c = SpreadsheetApp.getActive();
  let f = c.getSheetByName(ONGLET_JOURNAL);
  if (!f) {
    f = c.insertSheet(ONGLET_JOURNAL);
    f.getRange(1, 1, 1, ENTETES_JOURNAL.length).setValues([ENTETES_JOURNAL]).setFontWeight('bold');
    f.setFrozenRows(1);
    f.setColumnWidth(5, 480);
  }
  return f;
}

/* Ajoute une ligne au journal et la renvoie au format du site. */
function journaliser_(num, type, texte, par) {
  const f = ongletJournal_();
  const maintenant = horodatage_();
  const p = texteSur_(String(par || '').trim(), 30);
  const t = texteSur_(String(texte || '').trim(), MAX_NOTE);
  const ligne = f.getLastRow() + 1;
  f.getRange(ligne, 1, 1, ENTETES_JOURNAL.length).setValues([[maintenant, num, p, type, t]]);
  f.getRange(ligne, 1).setNumberFormat(FORMAT_DATE);
  const e = { le: maintenant.toISOString(), num: num, type: type, texte: String(texte || '').trim().slice(0, MAX_NOTE) };
  if (p) e.par = String(par).trim().slice(0, 30);
  return e;
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

/* Relit l'onglet Annonces sous verrou et retrouve la ligne d'une annonce visible par son N°. */
function ligneAnnonce_(corps, colonnes) {
  const num = Number(corps.num);
  if (!(num > 0)) throw new Error("Numéro d'annonce manquant.");
  const f = onglet_(ONGLET_ANNONCES);
  const valeurs = f.getDataRange().getValues();
  const idx = indexEntetes_(valeurs[0]);
  ['num'].concat(colonnes).forEach(k => {
    if (idx[k] === undefined) throw new Error('Colonne absente du tableau : ' + enTete_(k));
  });
  let i = -1;
  for (let j = 1; j < valeurs.length; j++) {
    if (convertirLecture_('nombre', valeurs[j][idx.num]) === num) { i = j; break; }
  }
  if (i < 0) throw new Error('Annonce n°' + num + ' introuvable.');
  const avant = ligneVersAnnonce_(valeurs[i], idx);
  if (avant.masquee) throw new Error('Annonce n°' + num + ' introuvable.');
  return { f: f, idx: idx, ligne: i + 1, largeur: valeurs[0].length, num: num, avant: avant };
}

function relireAnnonce_(L) {
  SpreadsheetApp.flush();
  const apres = L.f.getRange(L.ligne, 1, 1, L.largeur).getValues()[0];
  return pourSite_(ligneVersAnnonce_(apres, L.idx));
}

/* Renvoie { annonce, journal: [entrée ajoutée] } ; journal vide si rien n'a changé. */
function changerStatut_(action, corps) {
  const L = ligneAnnonce_(corps, ECRITES_PAR_LE_SITE.filter(k => k !== 'notes'));
  const f = L.f, idx = L.idx, i = L.ligne - 1, num = L.num, avant = L.avant;

  const maintenant = horodatage_();
  const maj = {};
  if (action === 'favori' || action === 'contact') {
    if (avant.corbeille) throw new Error('Annonce n°' + num + ' dans la corbeille : restaurez-la d\'abord.');
  }
  const personne = action === 'favori' ? personne_(idx, corps.qui) : null;
  if (action === 'favori') {
    maj['fav:' + personne.id] = corps.valeur ? 'Oui' : '';
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
    idx._personnes.forEach(p => { maj['fav:' + p.id] = ''; });
    maj.enContact = '';
    maj.enContactDepuis = '';
    const raison = String(corps.raison === undefined || corps.raison === null ? '' : corps.raison).trim();
    if (raison) maj.raisonCorbeille = texteSur_(raison, MAX_RAISON);
  } else if (action === 'restaurer') {
    maj.corbeille = '';
    maj.corbeilleLe = '';
    maj.raisonCorbeille = '';
  }
  maj.statutLe = maintenant;

  Object.keys(maj).forEach(k => {
    const fav = k.indexOf('fav:') === 0 ? personne_(idx, k.slice(4)) : null;
    if (!fav && ECRITES_PAR_LE_SITE.indexOf(k) < 0) throw new Error('Écriture interdite : ' + k);
    const r = f.getRange(i + 1, (fav ? fav.col : idx[k]) + 1);
    r.setValue(maj[k]);
    if (maj[k] instanceof Date) r.setNumberFormat(FORMAT_DATE);
  });

  // Journal : seulement si le statut change vraiment (un double appui n'ajoute pas de ligne).
  const journal = [];
  let texte = null;
  if (action === 'favori' && !!corps.valeur !== (avant.aimeePar || []).indexOf(personne.id) >= 0) {
    texte = (corps.valeur ? 'Ajoutée aux favoris de ' : 'Retirée des favoris de ') + personne.nom;
  }
  else if (action === 'contact' && !!corps.valeur !== !!avant.enContact) texte = corps.valeur ? 'Ajoutée au suivi' : 'Retirée du suivi';
  else if (action === 'corbeille' && !avant.corbeille) texte = 'Mise à la corbeille' + (maj.raisonCorbeille ? ' : ' + String(corps.raison).trim().slice(0, MAX_RAISON) : '');
  else if (action === 'restaurer' && avant.corbeille) texte = 'Restaurée';
  const types = { favori: 'Favori', contact: 'Contact', corbeille: 'Corbeille', restaurer: 'Restauration' };
  if (texte) journal.push(journaliser_(num, types[action], texte, ''));

  return { annonce: relireAnnonce_(L), journal: journal };
}

/* Personne d'après son id (« qui ») : colonne « Favori <Prénom> » correspondante. */
function personne_(idx, qui) {
  const p = (idx._personnes || []).filter(x => x.id === qui)[0];
  if (!p) throw new Error('Paramètre « qui » manquant ou inconnu (colonnes « Favori <Prénom> » : ' + (idx._personnes || []).map(x => x.id).join(', ') + ').');
  return p;
}

/* Note libre d'une annonce : remplacée en entier, ou vidée si le texte est vide. Pas de ligne de journal. */
function ecrireNote_(corps) {
  const L = ligneAnnonce_(corps, ['notes']);
  const t = String(corps.texte === undefined || corps.texte === null ? '' : corps.texte).trim();
  L.f.getRange(L.ligne, L.idx.notes + 1).setValue(t ? texteSur_(t, MAX_NOTE) : '');
  return relireAnnonce_(L);
}

/* Commentaire ajouté depuis le site. Le journal ne se modifie ni ne se supprime depuis le site. */
function ajouterAuJournal_(corps) {
  const L = ligneAnnonce_(corps, []);
  const t = String(corps.texte === undefined || corps.texte === null ? '' : corps.texte).trim();
  if (!t) throw new Error('Commentaire vide.');
  return journaliser_(L.num, 'Commentaire', t, corps.par);
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
    if (l.suivi) { g.suivi = true; g.hote = l.hote; }
    if (l.direct) g.direct = l.direct;
    vus[k] = g;
    groupes.push(g);
  });

  return groupes.map(g => {
    const r = { entree: g.entree, nb: g.nb };
    if (!g.valide) { r.etat = 'INVALIDE'; return r; }
    // Lien de suivi d'un mail d'alerte : la veille ne saurait pas l'ouvrir, inutile de le comparer.
    if (g.suivi) { r.etat = 'LIEN_SUIVI'; r.hote = g.hote; return r; }
    if (g.direct) r.direct = g.direct;
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

/* Un lien déjà analysé peut être renvoyé (veille en échec, lien illisible…), sauf s'il a été ajouté au tableau :
 * normalement il ressort alors en DOUBLON ; ce test protège le cas d'une ligne Annonces supprimée à la main. */
function renvoyable_(r) {
  if (r.etat === 'A_TRAITER') return true;
  return r.etat === 'DEJA_ANALYSEE' && !/^\s*ajout[ée]e/i.test(String(r.resultat || ''));
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
  // Nouvelle ligne Ajouts pour un renvoi : l'ancienne ligne traitée reste telle quelle (historique).
  const aTraiter = resultats.filter(renvoyable_);
  const ecartes = resultats.filter(r => !renvoyable_(r));
  if (aTraiter.length) {
    const f = onglet_(ONGLET_AJOUTS);
    const idx = ajouts.idx;
    if (idx.ajouteLe === undefined) throw new Error("Colonne absente de l'onglet Ajouts : " + AJOUTS.ajouteLe);
    const largeur = Math.max(ajouts.largeur, f.getLastColumn());
    const maintenant = horodatage_();
    const lignes = aTraiter.map(r => {
      const l = new Array(largeur).fill('');
      l[idx.lien] = texteSur_(r.direct || r.entree, 1000);
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

// Hôtes de redirection (liens de suivi des mails d'alerte, raccourcisseurs) : la veille ne peut pas les ouvrir.
// À compléter au besoin. Ne jamais y mettre un portail immobilier ou une agence.
const HOTES_SUIVI = [
  /^(click|clic|clicks|track|tracking|trk|links|link)\./,
  /(^|\.)ct\.sendgrid\.net$/,
  /(^|\.)list-manage\.com$/,       // Mailchimp
  /(^|\.)mjt\.lu$/,                 // Mailjet
  /(^|\.)r\.mailjet\.com$/,
  /(^|\.)sendib[mt]\d*\.com$/,      // Brevo (ex-Sendinblue) : sendibt2, sendibt3, sendibm1…
  /(^|\.)hubspotlinks\.com$/,
  /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|lnkd\.in)$/,
];

// Paramètres qui portent parfois l'adresse finale (Google /url?q=, certains routeurs de mails).
const PARAMS_CIBLE = ['url', 'u', 'q', 'target', 'redirect', 'redirect_url', 'dest'];

/**
 * Clé de comparaison d'un lien. Seules les URL http(s) valides sont acceptées.
 * 1. Un lien qui porte l'adresse finale dans un paramètre (url, q…) est remplacé par celle-ci (une seule passe) :
 *    le résultat a alors `direct`, l'adresse à envoyer à la veille.
 * 2. Une annonce reconnue d'un portail connu est identifiée par son numéro.
 * 3. Un hôte de redirection connu donne { suivi: true } : à ouvrir dans le navigateur pour récupérer l'adresse réelle.
 */
function analyserLien_(brut, deroule) {
  const s = String(brut === null || brut === undefined ? '' : brut).trim();
  const m = s.match(/^https?:\/\/([^\/?#\s]+)([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i);
  if (!m) return { valide: false };
  let hote = m[1].toLowerCase();
  hote = hote.slice(hote.lastIndexOf('@') + 1).replace(/:(80|443)$/, '');
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?$/.test(hote)) return { valide: false };
  hote = hote.replace(/^www\./, '');
  const chemin = (m[2] || '').replace(/\/+$/, '');
  if (!deroule) {
    const cible = cibleRedirection_(m[3], hote);
    if (cible) {
      const r = analyserLien_(cible, true);
      if (r.valide) { if (!r.suivi) r.direct = cible; return r; }
    }
  }
  for (let i = 0; i < SITES.length; i++) {
    if (!SITES[i][0].test(hote)) continue;
    const id = chemin.match(SITES[i][1]);
    if (id) return { valide: true, cle: SITES[i][2] + ':' + id[1].toLowerCase() };
  }
  if (HOTES_SUIVI.some(re => re.test(hote))) return { valide: true, suivi: true, hote: hote, cle: 'suivi:' + (hote + chemin + (m[3] || '')).toLowerCase() };
  const params = (m[3] || '').slice(1).split('&').filter(p => {
    if (!p) return false;
    let nom = p.split('=')[0];
    try { nom = decodeURIComponent(nom); } catch (x) {}
    return !PARAMS_SUIVI.test(nom);
  }).sort();
  return { valide: true, cle: (hote + chemin + (params.length ? '?' + params.join('&') : '')).toLowerCase() };
}

// Adresse http(s) d'un autre hôte portée par un paramètre de PARAMS_CIBLE, ou null.
function cibleRedirection_(requete, hote) {
  const params = (requete || '').slice(1).split('&');
  for (let i = 0; i < params.length; i++) {
    const j = params[i].indexOf('=');
    if (j < 1) continue;
    let nom = params[i].slice(0, j), val = params[i].slice(j + 1);
    try { nom = decodeURIComponent(nom).toLowerCase(); val = decodeURIComponent(val.replace(/\+/g, ' ')).trim(); } catch (x) { continue; }
    if (PARAMS_CIBLE.indexOf(nom) < 0) continue;
    const m = val.match(/^https?:\/\/([^\/?#\s:@]+)/i);
    if (!m) continue;
    const h = m[1].toLowerCase().replace(/^www\./, '');
    if (h !== hote) return val;
  }
  return null;
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

function normEntete_(e) {
  return String(e).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function indexEntetes_(entetes) {
  const parEntete = {};
  COLONNES.forEach(([cle, entete]) => { parEntete[normEntete_(entete)] = cle; });
  const idx = {};
  entetes.forEach((e, i) => {
    const cle = parEntete[normEntete_(e)];
    if (cle && idx[cle] === undefined) idx[cle] = i;
  });
  idx._personnes = personnes_(entetes);
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

/** Contrôle sans rien écrire : personnes repérées (colonnes « Favori <Prénom> ») et favoris de chacune. */
function testerFavoris() {
  const pers = lirePersonnes_();
  const l = lireAnnonces_().map(x => x.annonce).filter(a => !a.masquee);
  pers.forEach(p => Logger.log('%s (%s) : %s favori(s)', p.nom, p.id, l.filter(a => (a.aimeePar || []).indexOf(p.id) >= 0).length));
  Logger.log('Coups de cœur : %s (sur %s annonces visibles).', l.filter(a => (a.aimeePar || []).length >= 2).length, l.length);
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
  Logger.log('journal : %s entrées', r.journal ? r.journal.length : 0);
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

/** Test de l'analyse des liens de redirection depuis l'éditeur, sans rien lire ni écrire. */
function testerRedirections() {
  [
    'https://www.seloger.com/annonces/achat/maison/exemple/123456789.htm',
    'https://click.by.seloger.com/ls/click?upn=exemple',
    'https://www.google.com/url?q=https%3A%2F%2Fwww.leboncoin.fr%2Fad%2Fventes_immobilieres%2F1234567890&sa=D',
    'https://bit.ly/exemple',
  ].forEach(l => Logger.log('%s\n  -> %s', l, JSON.stringify(analyserLien_(l))));
}
