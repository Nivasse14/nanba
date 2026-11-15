# Nanba WhatsApp — personnalisation v4.3

Version **en ligne** : `assistant-v4.3-onboarding`, vérifiée le 15 novembre 2026.

**À tester dans WhatsApp : PERSONNALISER**, ou **QUESTIONS ICI** pour le parcours en conversation. Terminer par **CONFIRMER** ; consulter ensuite **MON PROFIL**.

Le questionnaire en conversation et les accueils à boutons sont actifs. Les formulaires FR/EN/TA ont été créés et soumis ; leur statut observé est `received`, sans erreur, en attente d’approbation Meta. Ils seront proposés automatiquement une fois approuvés. [Contrôle en production](live-validation.json).

- Accueil facultatif, sans quitter WhatsApp.
- Formulaire natif en trois écrans, avec questionnaire en conversation si le formulaire attend l’approbation Meta.
- Langue, texte/audio, intérêts, ville facultative, ton et longueur.
- Brouillon par numéro et confirmation écrite avant enregistrement ou abonnement.
- PERSONNALISER · QUESTIONS ICI · PASSER · RETOUR · PLUS TARD · CONFIRMER · MON PROFIL.

[Guide et exemples](nanba-ensemble/docs/ONBOARDING.md) · [Code du questionnaire](nanba-ensemble/src/nanba-onboarding.ts) · [Serveur](nanba-ensemble/src/server.ts) · [Tests](nanba-ensemble/tests/onboarding.test.ts).

Compilation et 159 tests passent. Aucun message de test envoyé aux membres. Les validations sur téléphone et l’approbation des formulaires sont distinctes des tests locaux.

Les fonctions diaspora v4.2 restent disponibles : parcours privés, français pratique, aide aux courriers et ressources officielles. [Guide diaspora](nanba-ensemble/docs/DIASPORA.md).

La publication des annonces dans le catalogue principal reste en attente de l’activation de l’API Google Cloud et du secret partagé. [État du catalogue](nanba-ensemble/docs/CATALOGUE-PRINCIPAL.md).

[Archive déployable](nanba-ensemble-source.tar.gz) · [Manifeste](SOURCE-MANIFEST.json). Le code est aussi lisible dans `nanba-ensemble/`.

Commit source : `d649e6a33e80d2a22b04ae7c88c1ae63fe643911`.

SHA-256 archive : `009653f91f65bb461f36dcfc185c55a328cf1c1d1986ec70c6fcb2e48aa9bdf5`.
