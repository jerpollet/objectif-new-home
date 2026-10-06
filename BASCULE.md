# Bascule V3 : tests, redéploiement, retour arrière

Ce document accompagne la refonte V3 (branche de travail, mergée dans `main` seulement à l'étape 4 de la bascule).
Il ne contient aucun secret : la clé d'accès reste dans les propriétés du script et dans les liens envoyés par mail.

## 1. Tester sur la copie du Sheet (avant la bascule)

La copie du Sheet est déjà migrée (en-tête « Ancien statut », colonnes Favori / En contact / Corbeille).
Le script est **lié au Sheet** (`SpreadsheetApp.getActive()`) : la copie a donc sa propre copie du script.

1. Ouvrir la **copie** du Sheet › Extensions › Apps Script.
2. Remplacer tout le contenu de `Code.gs` par celui de [`apps-script/Code.gs`](apps-script/Code.gs). Enregistrer (💾).
   - `Installation.gs` peut rester : `installer()` refuse de s'exécuter sur un onglet Annonces déjà rempli. Il peut aussi être supprimé, il ne sert plus.
3. Choisir la fonction `definirCle` dans la liste en haut, puis ▶ Exécuter. Accepter les autorisations.
   La clé s'affiche dans le journal d'exécution : c'est la **clé de test**, différente de la vraie.
4. Choisir `testerLecture`, ▶ Exécuter : le journal doit afficher `ok=true` et le nombre d'annonces visibles.
5. Déployer › **Nouveau déploiement** › type « Application web » :
   - Exécuter en tant que : **Moi** ;
   - Qui a accès : **Tout le monde** ;
   - Déployer, puis copier l'URL qui finit par `/exec` (c'est l'**URL de test**).
6. Ouvrir sur le téléphone le lien de test (une seule ligne, sans espace) :

   ```
   https://raw.githack.com/jerpollet/objectif-new-home/<COMMIT>/index.html#cle=<CLE_TEST>&api=<URL_TEST>
   ```

   - `<COMMIT>` : l'identifiant du dernier commit de la branche (donné par Claude).
   - `api=` n'est accepté qu'en dehors du site de production : sur `jerpollet.github.io`, il est ignoré.
   - Un badge rouge « API de test » s'affiche en bas à gauche.
7. Dérouler la checklist du § 4.

Pour développer sans aucun Sheet : `python3 -m http.server 8765`, puis `http://127.0.0.1:8765/?test=1`
(données fictives de `test/donnees-exemple.json`, écritures simulées). `?test=1&echec=1` simule un tableau injoignable,
`?test=1&echec=ecriture` un échec d'écriture.

## 2. Redéployer l'Apps Script de production (étape 3 de la bascule)

À faire **juste après** la migration du vrai Sheet (étape 2), et **avant** le merge (étape 4).
L'URL `/exec` ne doit pas changer : on **modifie le déploiement existant**, on n'en crée pas un nouveau.

1. Ouvrir le **vrai** Sheet › Extensions › Apps Script.
2. Avant de toucher au code, **noter le numéro de la version actuellement déployée** :
   Déployer › Gérer les déploiements › le déploiement « Application web » › la version affichée (ex. « Version 3 »).
   C'est la version de retour arrière.
3. Remplacer tout le contenu de `Code.gs` par celui de [`apps-script/Code.gs`](apps-script/Code.gs). Enregistrer.
4. Ne **pas** lancer `definirCle` : la vraie clé est déjà dans les propriétés du script et reste la même.
5. ▶ Exécuter `testerLecture` : le journal doit afficher `ok=true`, le nombre d'annonces visibles, la date de la dernière veille.
6. Déployer › **Gérer les déploiements** › cliquer sur le **crayon** du déploiement existant ›
   Version : **Nouvelle version** › Déployer.
7. Vérifier que l'URL affichée est **identique** à celle de `config.js` (`…/AKfycbzxr1Yp…/exec`).

`clasp` (outil en ligne de commande de Google) permettrait de pousser `apps-script/Code.gs` sans copier-coller.
Il est facultatif ; le copier-coller ci-dessus suffit.

## 3. Séquence de bascule

À faire d'une traite : entre les étapes 2 et 4, l'ancien site ne fonctionne plus (il attend la colonne Statut).

| # | Qui | Action |
|---|---|---|
| 1 | Jérémy | Vérifier que les deux tâches de veille sont en pause. |
| 2 | Claude (chat) | Migration du vrai Sheet (`tableau.py migrer`), en-tête « Statut » renommé « Ancien statut », vérification. |
| 3 | Jérémy | Redéployer l'Apps Script (§ 2). |
| 4 | Claude Code | Merger la branche dans `main`, vérifier que GitHub Pages a publié (1 à 2 min). |
| 5 | Utilisateurs | Recette rapide sur le vrai site, sur leurs téléphones (lignes clés du § 4). |
| 6 | Jérémy | Vérifier que le skill v3.2 est installé. |
| 7 | Claude (chat) | Veille complète lancée à la main. |
| 8 | Jérémy | Réactiver les deux tâches planifiées. |

Le site garde une copie hors ligne (service worker) : si un téléphone affiche encore l'ancien site après le merge,
le fermer complètement et le rouvrir (la nouvelle version arrive au premier chargement réseau).

## 4. Retour arrière (si l'étape 5 échoue gravement)

Dans cet ordre :

1. **Site** : revert du merge sur `main` (Claude Code le fait : `git revert -m 1 <commit de merge>` puis push).
   GitHub Pages republie l'ancien site en 1 à 2 minutes.
2. **Apps Script** : Déployer › Gérer les déploiements › crayon du déploiement existant ›
   Version : choisir **l'ancienne version notée au § 2, étape 2** › Déployer. L'URL `/exec` ne change pas.
3. **Sheet** : renommer l'en-tête « Ancien statut » en « **Statut** ».
   Les colonnes ajoutées (Favori, En contact, Corbeille, État, Énergie, Taxe foncière, Photo…) peuvent rester : l'ancien code les ignore.
   Attention : les favoris, contacts et corbeilles posés depuis le nouveau site ne sont **pas** recopiés dans « Statut ».
4. Remettre le skill de veille en v3.0 si la v3.2 a déjà été installée.

## 5. Checklist de recette

Légende : ✅ vérifié automatiquement, ⬜ à faire par les utilisateurs.

« Auto (front) » : test Playwright du site en mode test (Chromium, iPhone 13 et 1280 × 800).
« Auto (Apps Script) » : `apps-script/Code.gs` exécuté dans Node contre un Sheet simulé.
Ni l'un ni l'autre ne remplace un essai sur le vrai Google Sheet et sur de vrais téléphones.

| Point | Auto (front) | Auto (Apps Script) | Copie du Sheet | Vrais téléphones |
|---|---|---|---|---|
| Favori puis En contact : les deux restent, l'annonce est dans Suivi avec son cœur | ✅ | ✅ | ⬜ | ⬜ |
| Corbeille depuis la fiche et depuis Suivi : sort des listes, Favori/Contact vidés, Corbeille le rempli | ✅ | ✅ | ⬜ | ⬜ |
| Restaurer : revient dans sa Prio sans favori ni contact, Raison corbeille vidée | ✅ | ✅ | ⬜ | ⬜ |
| Une annonce masquée n'apparaît nulle part | ✅ | ✅ | ⬜ | ⬜ |
| Ajouter : nouveau, déjà en base, en corbeille, en attente, texte non-lien, même lien deux fois ; bon nombre de lignes dans Ajouts | ✅ | ✅ | ⬜ | ⬜ |
| Deux appareils : un favori posé sur l'un apparaît sur l'autre au retour au premier plan | — | — | ⬜ | ⬜ |
| Mode avion : bandeau « Tableau injoignable » avec le cache, puis Réessayer | ✅ (simulé) | — | ⬜ | ⬜ |
| Fiche sans énergie ni taxe, avec énergie seule, avec les deux (2b, 2b′) | ✅ | — | ⬜ | ⬜ |
| Comparateur à 3 annonces dont une avec des « — » : aucun « — » en gras | ✅ | — | ⬜ | ⬜ |
| Lien partagé (`#cle=`) qui s'ouvre sans compte, sur iPhone et Android | — | — | ⬜ | ⬜ |
| Écriture refusée sans clé valide | — | ✅ | ⬜ | ⬜ |
| Bouton retour du téléphone : ferme la fiche et revient à la liste | ✅ | — | ⬜ | ⬜ |
| Colonnes de la veille jamais modifiées par le site | — | ✅ | ⬜ | — |

## 6. Onglet « Réglages » (plafonds, cibles, critères)

Depuis V3.2, ces réglages ne sont plus dans `config.js` (dépôt public) : l'API les lit dans l'onglet **Réglages**
du Sheet et les renvoie avec la clé. Sans cet onglet, le site fonctionne mais n'affiche ni drapeau de prix,
ni zones et cibles par Prio, ni critères.

Colonne A le libellé, colonne B la valeur, ligne 1 d'en-tête (`Clé` | `Valeur`). Libellés reconnus :

| Libellé | Valeur |
|---|---|
| `Plafond` | montant frais compris, en euros |
| `Plafond max` | montant frais compris, en euros |
| `Prio 1 cible` … `Prio 4 cible` | montant maximum visé, en euros |
| `Prio 1 zone` … `Prio 4 zone` | texte court |
| `Critère` | un critère par ligne, autant de lignes que voulu |

Ordre de mise en place : créer l'onglet, recopier `Code.gs`, ▶ `testerLecture` (le journal affiche les réglages lus),
puis redéployer comme au § 2 (même URL). Le skill de veille met désormais ces valeurs à jour dans l'onglet,
plus dans `config.js`.
