# Changelog

## V3.7.2 (Suivre)
- Vocabulaire : « Contact » devient « Suivre » / « Suivie » partout à l'écran (fiche, cartes, badge, onglet Suivi, menu, comparateur, journal). Icône : coche dans un cercle pointillé quand l'annonce n'est pas suivie, cercle plein quand elle l'est ; l'icône téléphone disparaît. Colonnes du tableau (« En contact », « En contact depuis »), clés et action API (`contact`) inchangées.
- Cartes des Prio : « Comparer » passe à gauche, un bouton « Suivre » à droite (même action que dans la fiche) ; l'adéquation et la source ne sont plus affichées sur les cartes (toujours dans la fiche et le tri Pertinence).
- Journal : la ligne automatique dit « Ajoutée au suivi » (au lieu de « Passée en contact ») ; à recopier dans Apps Script pour les écritures réelles, les anciennes lignes restent telles quelles.
- Service worker : cache `onh-v3-7-2`.

## V3.7.1
- Ajouter : un doublon ou une annonce en corbeille a un lien « Voir l'annonce n°X » qui ouvre sa fiche ; fermer la fiche ramène sur Ajouter, résultats et saisie intacts. Pas de lien pour une annonce masquée.

## V3.7 (onglet Autres, DPE en couleur, plafonds, écarts aux critères)
- Onglet « Autres » (Prio 5, nom lu dans « Prio 5 zone ») : vos ajouts hors de nos secteurs. Barre du bas en 4 colonnes égales + 60 px derrière un filet, nom + nombre seulement (plus de compteur « new » sur aucun onglet), libellé seul à 60 % quand il est vide ; en-tête desktop après un filet. En-tête d'onglet, état vide avec « Ajouter des annonces », chip « 📌 Autres » grise, jamais de Pépite (forcée à faux à l'affichage).
- Badges : statuts sur la photo New › Coup de cœur › Pépite (place réservée au Partager et au cœur) ; 1re ligne Prio › En contact › source (seule la source se tronque) ; ligne « ≈ … frais compris » + drapeau ; pastille DPE en bout de critères. Pas de badge « Ajoutée par ».
- Pastilles DPE aux couleurs officielles : carte (20 px), fiche (chip « [X] DPE » et ligne Énergie, 22 px), comparateur (24 px). La lettre sort du texte des critères.
- Drapeau de prix : frais compris EXACT (prix × 1,075) comparé au plafond indicatif de la Prio (« Prio N cible »), au budget (« Plafond ») et à la tolérance (« Plafond max ») ; arrondi seulement à l'affichage. États : Sous le plafond PN · Au-dessus du plafond PN · Au-delà du budget · Hors budget · gardée, ajoutée par vous (ajouts manuels au-delà de la tolérance seulement). Autres : aucun drapeau jusqu'au budget. Aide sous le drapeau dans la fiche ; comparateur « Prix vs plafond » en libellés courts. Plus aucun libellé « cible » ni « fourchette ».
- Ajout manuel : Source qui commence par « Ajout de » (`ajoutManuel`, calculé par l'API) ; la source affichée est le domaine du lien.
- Écarts aux critères : lignes « Écart : … » de la colonne Vigilance (posées par la veille), séparées par l'API (`vigilanceCriteres`). Fiche : bandeau « Hors de nos critères · N écarts », puis écarts en gras en tête de Vigilance, un filet, les autres points.
- Accueil : Par prio avec « plafond … k€ », Autres en ligne fine (mobile) ou 5e colonne étroite (ordinateur) ; critères lus du tableau.
- Prénoms : plus aucun prénom dans le code. L'API lit les colonnes « Favori <Prénom> » et renvoie `personnes` ([{id:"p1", nom}, …]) et `aimeePar` (["p1", …]) ; l'action `favori` prend `qui` = id. Initiales et libellés calculés à partir des prénoms du tableau.
- API : `reglages` = {budget, tolerance, prios {N: {plafond, zone}}, criteres} ; libellés de l'onglet Réglages inchangés. Fonctions d'éditeur `migrerFavoris` retirée (migration faite), `testerFavoris` générique.
- Service worker : cache `onh-v3-7`.

## V3.6 (favori à deux, onglet Favoris, accueil réordonné)
- Favori à deux : la colonne « Favori » est remplacée par « Favori <Prénom 1> » et « Favori <Prénom 2> » (migration `migrerFavoris()` : chaque Favori = Oui devient Oui dans les deux, sans ligne de journal ; l'ancienne colonne reste, ignorée). API : `lire` renvoie `favori<Prénom>` (une clé par personne) ; l'action `favori` exige `qui` (identifiant de la personne) ; journal « Ajoutée aux favoris de <Prénom> » seulement si l'état change ; la corbeille vide les deux. En-têtes comparés sans accents ni casse.
- Cœur : pastille inchangée, initiales (1re personne encre, 2e accent) dessous ; tag « Coup de cœur » avant Pépite et New quand les deux aiment. Même logique en liste, tableau, fiche, pépites et comparateur (`♥` + initiales).
- « Qui l'aime ? » : le cœur ouvre une feuille du bas (mobile : poignée, zone de prise pleine largeur × 28 px, glisser vers le bas, voile, ✕, Fermer et bouton retour ferment) ou un menu de 280 px accroché au cœur (ordinateur : Échap, clic dehors, défilement ferment ; focus piégé). Deux interrupteurs, écriture immédiate et optimiste. Bandeau « Coup de cœur commun » seulement quand les deux sont actifs.
- Onglet Favoris (`#favoris`) : menu burger après Accueil (compteur + pilule des coups de cœur), en-tête desktop avant Suivi. Filtres Tous · coups de cœur · une pastille par personne avec compteurs (mémorisés), toujours en cartes par adéquation ; « Tous » groupé (coups de cœur, puis chaque personne seule). Cartes horizontales compactes sur ordinateur ; fiche en tiroir.
- Accueil : Pépites → Dernière veille (stats + résumé repliable, fermé par défaut, état mémorisé) → Par prio → Nos critères. Ordinateur : bandes pleine largeur (fin de `.grille-accueil`), pépites en 16:9.
- En-tête desktop sur une ligne : nowrap et marges resserrées ; entre 1024 et 1279 px, le bouton devient « + Ajouter ».
- Une couche déjà ouverte ne rejoue plus son animation d'entrée à chaque rendu.
- Service worker : cache `onh-v3-6`.

## V3.5 (corbeille avec raison, note, journal de suivi)
- Corbeille : une fenêtre de confirmation remplace le double appui. Raison facultative (texte libre et raisons rapides), envoyée à l'API (`corbeille` + `raison`, colonne « Raison corbeille », 500 caractères au plus). Dans la vue Corbeille, la raison a sa propre ligne (colonne « Raison » sur ordinateur).
- Note : de retour dans la fiche (toutes les vues), mémo partagé enregistré par bouton ou à la perte du focus (`note`). « Vider » demande confirmation.
- Journal de suivi : nouvel onglet « Journal » (Date, N°, Par, Type, Texte), créé par l'API au premier événement. Chaque changement de statut fait depuis le site y ajoute une ligne (seulement s'il change vraiment) ; commentaires ajoutés depuis la fiche (`journal`). Rien ne se modifie ni ne se supprime depuis le site. Affiché uniquement dans la vue Suivi : dernière entrée sur la carte, fil complet dans la fiche (5 dernières, « Afficher les plus anciennes »).
- Auteur : les lignes automatiques ne sont pas signées. Un commentaire a un champ « Prénom (facultatif) », envoyé en `par` ; le dernier prénom saisi est proposé sur l'appareil. Aucun prénom dans le dépôt.
- Saisie protégée : pendant qu'on écrit (note, journal, raison) ou qu'on appuie sur un bouton, la relecture automatique attend, le texte et le clavier restent en place.
- API : `lire` renvoie aussi `notes` et `journal` (1 000 dernières entrées) ; `changerStatut_` renvoie `{annonce, journal}`. Compatible avec le site V3.4 (il ignore les nouveaux champs).
- Service worker : cache `onh-v3-5`.

## V3.4.1
- Fiche mobile en plein écran ; Partager et Fermer restent en haut pendant le défilement. Le geste « glisser vers le bas » (qui ne répondait que sur la petite poignée) est supprimé.
- Service worker (cache `onh-v3-4-1`) : chaque fichier du site est revalidé auprès du serveur, une mise à jour n'attend plus jusqu'à 10 min de cache navigateur.
- Listes Prio : carte de rappel en tête (zone et cible frais compris, tirées de l'onglet Réglages), au-dessus de la barre de tri.

## V3.4 (renvoi des liens analysés, liens de mail, partage)
- Ajouter : un lien « Déjà analysée » peut être renvoyé à la veille (case non cochée par défaut, détail « Déjà analysée le JJ/MM : … · cocher pour renvoyer »), sauf si son dernier résultat commence par « Ajoutée ». L'API écrit une nouvelle ligne Ajouts sans toucher à l'ancienne ; le lien ressort ensuite « En attente ». La confirmation affiche « Renvoyée ».
- Liens de redirection des mails d'alerte : nouvel état `LIEN_SUIVI` (badge « Lien de mail », jamais envoyé). Un lien qui porte l'adresse finale dans un paramètre (`url`, `u`, `q`, `target`, `redirect`, `redirect_url`, `dest`, ex. Google `/url?q=`) est analysé sur cette adresse, qui est aussi celle écrite dans Ajouts. Liste des hôtes dans `HOTES_SUIVI` (Code.gs et app.js) ; fonction de test `testerRedirections()`.
- Partage Android vers le site (Web Share Target, `share_target` du manifeste) : « Partager » → « New Home » ouvre Ajouter avec le texte reçu, adresse nettoyée, vérification lancée si la clé est connue, jamais d'envoi automatique. Sans clé : message sur la page Ajouter, texte gardé.
- Bouton « Partager » sur les cartes (vue Cartes) et dans la fiche : texte « Annonce n°… · lieu · surface · prix », lien de fiche sans la clé d'accès, lien de l'annonce. Repli presse-papier (« Copié »). Pas de bouton pour une annonce en corbeille. Contrôle en mode test : `onhTests.partage()` dans la console.
- Fiche ouverte par un lien direct : message clair (annonce introuvable ou masquée, appareil sans clé, tableau injoignable) au lieu d'une redirection silencieuse.
- Ajouter : dès qu'un texte contient au moins un lien, les lignes sans lien (titre, « J'ai trouvé une annonce… » ajoutés par les applis au partage) sont ignorées ; un partage reçu ne met que ses liens dans la zone. Un texte sans aucun lien ressort toujours « Invalide ».
- Service worker : cache `onh-v3-4` ; une navigation avec paramètres (partage reçu) est rangée sous l'adresse sans paramètres.

## V3.3
- Accueil mobile : blocs « Par prio » sur deux colonnes (quatre à partir de 1024 px).
- Énergie et taxe foncière : une cellule au format date dans le tableau ne donne plus un montant absurde. L'API reprend le nombre d'origine, le site ignore tout montant annuel hors de 0 à 100 000 €.

## V3.2 (anonymisation du dépôt public)
- Plafonds, cibles par Prio et critères retirés de `config.js` : l'API les lit dans l'onglet « Réglages » du Sheet (`lireReglages_`) et les renvoie avec la clé. Sans onglet, le site masque drapeaux, zones et critères au lieu d'afficher des valeurs par défaut.
- Prénoms, nom du tableau et noms de villes retirés du code, de la doc, du manifeste et des données fictives.

## V3.1 (ajustements après la bascule, alignés sur le skill de veille v3.3)
- Drapeau de prix : deux seuils frais compris (plafond en style alerte, plafond max). Tag « Lien non vérifié » dans la fiche quand « Lien vérifié le » est vide, source suffixée dans le comparateur. Page Ajouter : nouvel état « Déjà analysée » (Résultat de la veille, tronqué, complet au toucher) et raison du masquage pour un doublon masqué. Apps Script : dates écrites au format `dd/MM/yyyy HH:mm`, `verifierLiens` renvoie `DEJA_ANALYSEE` et `raisonMasquee` (jamais dans `lire`).

## V3 (refonte) — en ligne depuis le 6 octobre 2026

### Site
- Nouveau design d'après le handoff V3 : système Modernist (Archivo, angles droits, filets de 2 px, accent rouge réservé), mode clair, mobile d'abord, déclinaison desktop à partir de 1024 px. Icônes Lucide en SVG inline, sans dépendance ni étape de build.
- Navigation par hash : `#accueil`, `#prio/1`…`#prio/4`, `#fiche/12`, `#suivi`, `#comparer`, `#ajouter`, `#corbeille`. Le paramètre `cle` reste dans l'adresse (`#prio/1&cle=…`). Le bouton retour ferme la fiche. Les anciens liens (`#cle=…`, `#prio1`) fonctionnent toujours.
- Écrans : Accueil (pépites New ou favorites, stats de la veille, résumé, compteurs par Prio, critères), listes Prio en Cartes / Liste avec tri et filtres Favoris / New, fiche (plein écran sur mobile, panneau sur desktop), Comparer (3 annonces), Suivi, Ajouter (vérification puis envoi), Corbeille.
- Favori et En contact sont deux états indépendants. La corbeille retire les deux ; la restauration remet l'annonce dans sa Prio sans l'un ni l'autre.
- Écritures optimistes, avec retour à l'état précédent et un message discret si l'appel échoue ; une file par annonce pour garder l'ordre des appuis rapides.
- Mise à la corbeille en deux temps (« Confirmer ? ») pour éviter un appui malheureux. Cette étape n'est pas dans les maquettes.
- Chargement : cache de la dernière réponse, rechargement à l'ouverture et au retour au premier plan (au plus toutes les 30 s), squelettes, barre de 2 px, bandeau « Tableau injoignable » avec Réessayer. Plus de bouton Actualiser.
- Calculs seulement : €/m², frais compris (× 1,075), notaire, drapeau de prix (cible de la Prio, plafond, plafond max depuis la V3.1), New (< 7 jours), énergie et taxe foncière par mois arrondies à 5 €, total des charges connues hors assurance.
- Les notes ne sont plus lues ni écrites par le site. « Ajouté par » et le commentaire disparaissent de l'ajout.
- `config.js` porte désormais les cibles par Prio et les critères affichés sur l'accueil.
- Nouvelle icône, cache hors ligne renommé `onh-v3`.

### Apps Script (`apps-script/Code.gs`, nouveau dans le dépôt)
- Schéma v3.1 : colonnes repérées par leur en-tête, « Ancien statut » ignoré, nouvelles colonnes État, Énergie min/max, Taxe foncière, Photo, Favori, En contact, Corbeille.
- `lire` (GET) : annonces non masquées, sans notes ni identifiant ; rapport (`derniereVeille`, `stats`, `paragraphes`) ; horodatage.
- Actions POST : `favori`, `contact`, `corbeille`, `restaurer`, `verifierLiens`, `ajouter`. Les écritures passent par `LockService`, retrouvent la ligne par N°, relisent l'état juste avant d'écrire et renvoient l'annonce mise à jour. Le site n'écrit que les colonnes autorisées.
- Dates écrites comme vraies dates du Sheet, format `dd/MM/yyyy HH:mm` depuis la V3.1 (fuseau Europe/Paris). Les dates en texte (« 05/10/2026 20:00 ») sont lues en heure de Paris.
- Normalisation des liens : paramètres de suivi retirés ; identifiant d'annonce pour Leboncoin, SeLoger, Bien'ici, PAP, Orpi, Laforêt et Les Clefs de Chez Moi.
- La clé est désormais **obligatoire** : sans clé configurée dans les propriétés du script, tout est refusé. L'ancien code acceptait tout dans ce cas.
- Les anciennes actions `modifier` et `ajout` sont retirées.

### Reste à faire
- Tester sur la copie du Sheet avec un déploiement de test, puis sur de vrais téléphones ([BASCULE.md](BASCULE.md), § 1 et § 5).
- Bascule coordonnée ([BASCULE.md](BASCULE.md), § 3).
