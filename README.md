# Nanba WhatsApp — personnalisation v4.3

Version préparée : `assistant-v4.3-onboarding`. Consulter `/api/twilio/health` pour le statut actif.

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

Commit source : `184a781569b2864daca5251aea6d39009a73c034`.

SHA-256 archive : `b12534e69bf1810bf5cf40afe917f0e004e27d1be8b8dfabf4549e10c1f7cb3a`.
