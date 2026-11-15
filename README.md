# Nanba WhatsApp — personnalisation v4.3

Version préparée : `assistant-v4.3-onboarding`. Consulter `/api/twilio/health` pour le statut actif.

- Accueil facultatif, sans quitter WhatsApp.
- Formulaire natif en trois écrans, avec questionnaire en conversation si le formulaire attend l’approbation Meta.
- Langue, texte/audio, intérêts, ville facultative, ton et longueur.
- Brouillon par numéro et confirmation écrite avant enregistrement ou abonnement.
- PERSONNALISER · QUESTIONS ICI · PASSER · RETOUR · PLUS TARD · CONFIRMER · MON PROFIL.

[Guide et exemples](nanba-ensemble/docs/ONBOARDING.md) · [Code du questionnaire](nanba-ensemble/src/nanba-onboarding.ts) · [Serveur](nanba-ensemble/src/server.ts) · [Tests](nanba-ensemble/tests/onboarding.test.ts).

Compilation et 158 tests passent. Aucun message de test envoyé aux membres. Les validations sur téléphone et l’approbation des formulaires sont distinctes des tests locaux.

Les fonctions diaspora v4.2 restent disponibles : parcours privés, français pratique, aide aux courriers et ressources officielles. [Guide diaspora](nanba-ensemble/docs/DIASPORA.md).

La publication des annonces dans le catalogue principal reste en attente de l’activation de l’API Google Cloud et du secret partagé. [État du catalogue](nanba-ensemble/docs/CATALOGUE-PRINCIPAL.md).

[Archive déployable](nanba-ensemble-source.tar.gz) · [Manifeste](SOURCE-MANIFEST.json). Le code est aussi lisible dans `nanba-ensemble/`.

Commit source : `7a90aa348dc92c9c32d46dc212a2120ed515f814`.

SHA-256 archive : `ad7bae6dd8bbfa2251c9ccedc60e5f0360aa43c3fec3137507a0404f707cbb13`.
