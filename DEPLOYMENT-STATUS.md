# Nanba WhatsApp — sources v4.1

Sources complètes de la version actuellement en ligne : [nanba-ensemble-source.tar.gz](nanba-ensemble-source.tar.gz). Le [manifeste](SOURCE-MANIFEST.json) répertorie tous les fichiers et leurs empreintes SHA-256.

Commit source local : `1bb588c70dd58c9272ade1733221976b36676903`. Archive SHA-256 : `17d405de3e6931bfc5293cf80023b5f11a48e88d4c94eb71dd6d25f6bf202b7a`.

## Fonctionnalités

- Twilio + OpenAI : dialogue, images, vocaux entrants et réponses audio au choix.
- Mémoire par numéro, PDF/courriers, relais vers les administrateurs Nanba.
- Rappels et sélections personnalisées matin/soir avec consentement, pause et limites de fréquence.
- APIs publiques Nanba : actualités, cinéma, annonces, voyages en cache, devises et autres services.
- Horoscope simplifié : date, ville/pays et heure de naissance si connue ; calcul Lahiri, sans demander le Rasi ou Nakshatra.

132 tests réussis sur les sources et sur le chargement de production. Diagnostic IA réel vérifié sans envoi à des membres. Version Render `assistant-v4.1`, déploiement `dep-dbs3jo3bc2fs73afj5t0`, confirmé actif le 14 novembre 2026.

## Utiliser le code

Extraire l’archive dans un dossier vide. Avec Node 24.22.1 ou une version corrigée ultérieure de la branche 24 : `npm ci`, `npm run check`, puis suivre le README et `.env.example`. Les sources se trouvent dans `src/`, les tests dans `tests/`, la documentation dans `docs/`.

## Déploiement

Le service Render existant continue à fonctionner. Les déploiements automatiques sont désactivés. Le chargement de compatibilité actuel est conservé ; cette publication GitHub ne change ni les secrets, ni les données, ni la configuration du service. L’archive est utilisable avec `Dockerfile.ensemble`.

L’archive ne contient ni clés API, ni base de données, ni session, ni `node_modules`. Les modèles WhatsApp restent soumis aux statuts d’approbation Meta décrits dans la documentation.
