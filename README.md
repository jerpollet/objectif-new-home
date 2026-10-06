# Objectif New Home

Site statique (GitHub Pages), en HTML/CSS/JS vanilla, qui affiche les données d'un Google Sheet privé.
Une application web Apps Script liée au Sheet sert d'API ; aucune donnée réelle n'est stockée dans ce dépôt.

- `config.js` : adresse de l'API et `MODE_TEST`. Les réglages personnels (plafonds, cibles, critères) sont dans le Sheet privé et arrivent par l'API (voir [BASCULE.md](BASCULE.md) § 6).
- `app.js` : tout l'affichage (sans étape de build).
- `apps-script/Code.gs` : code de l'API, à copier dans l'éditeur Apps Script du Sheet (voir [BASCULE.md](BASCULE.md)).
- `test/donnees-exemple.json` : données fictives pour le mode test.
- `sw.js` : garde une copie du site pour l'ouvrir sans réseau (l'API n'est jamais mise en cache par lui).

La clé d'accès n'est jamais dans ce dépôt : elle est transmise par un lien privé `#cle=…`, reste dans l'adresse et sur l'appareil.

Développement local : `python3 -m http.server 8765`, puis http://127.0.0.1:8765/?test=1 (données fictives, écritures simulées, aucun accès aux vraies données).
