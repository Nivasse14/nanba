# Nanba WhatsApp — questionnaire avec boutons v4.4

Version **en ligne** : `assistant-v4.4-buttons`, vérifiée le 15 novembre 2026.

**À tester dans WhatsApp : envoie PERSONNALISER**, puis touche les choix proposés. Les nouveaux numéros reçoivent aussi un accueil avec boutons.

- Boutons : texte / audio / comme mes messages ; ton ; longueur.
- Menus : langue, centres d’intérêt et préférences d’envoi.
- Plusieurs intérêts : toucher pour ajouter ou retirer, puis Continuer.
- Ville : texte ou vocal, ou Passer. Horaires proposés, avec Autre pour saisir une heure libre.
- Récapitulatif avec **Confirmer / Retour / Annuler**. Rien n’est enregistré ni souscrit avant confirmation.
- Préférences privées par numéro ; anciens boutons et boutons d’un autre numéro refusés.

Les douze modèles interactifs et les trois nouveaux accueils FR/EN/TA sont actifs (`in_session`, `buttonsReady=true`). Ils fonctionnent pendant la conversation active sans approbation de formulaire Meta.

Les formulaires séparés v4.3 ont été refusés par Meta. Ils ne bloquent pas le parcours par boutons ; FORMULAIRE revient aux questions dans la conversation tant qu’aucun formulaire n’est approuvé.

[Guide et exemples](nanba-ensemble/docs/ONBOARDING.md) · [Code du questionnaire](nanba-ensemble/src/nanba-onboarding.ts) · [Modèles de boutons](nanba-ensemble/src/nanba-onboarding-buttons.ts) · [Tests](nanba-ensemble/tests/onboarding.test.ts).

Compilation et **163 tests** passent. Démarrage de l’archive en production et persistance SQLite vérifiés. Aucun message de test envoyé aux membres ; le rendu sur un téléphone WhatsApp réel reste à vérifier.

[Contrôle en production](live-validation.json) · [État du déploiement](DEPLOYMENT-STATUS.md) · [Archive](nanba-ensemble-source.tar.gz) · [Manifeste](SOURCE-MANIFEST.json).

Les services diaspora précédents restent disponibles. La publication des annonces dans le catalogue principal reste en attente de l’activation de son API Google Cloud et du secret partagé. [État du catalogue](nanba-ensemble/docs/CATALOGUE-PRINCIPAL.md).
