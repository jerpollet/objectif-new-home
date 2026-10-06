/* Réglages du site « Objectif New Home ».
   API_URL : adresse de l'application web Apps Script (pas secrète).
   La clé d'accès n'est JAMAIS ici : elle arrive par le lien #cle=… et reste dans le téléphone.
   MODE_TEST : true pour développer avec test/donnees-exemple.json, sans toucher au vrai tableau
   (en local, ?test=1 dans l'adresse fait la même chose sans modifier ce fichier).
   Plafonds, cibles par Prio et critères ne sont pas ici : ils vivent dans l'onglet « Réglages » du tableau
   et arrivent par l'API avec la clé (voir apps-script/Code.gs, lireReglages_). */
window.CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzxr1YpvPl8voWti2X2jsQmIcd11_aPMUevif35OcqoOXpy-gxKXRbn-WUND18aA5OF/exec",
  MODE_TEST: false,

  /* Adresse du site en production : un lien #api=… (déploiement de test) y est ignoré. */
  ORIGINE_PROD: "https://jerpollet.github.io"
};
