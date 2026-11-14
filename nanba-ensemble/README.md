# Nanba Ensemble

Assistant WhatsApp Nanba pour la diaspora indienne en France, et application communautaire avec huit parcours métier. Backend TypeScript, base SQLite persistante et tests automatisés.

**Version en production : assistant-v4.1, vérifiée le 14 novembre 2026.** Twilio reçoit les messages WhatsApp ; OpenAI assure le dialogue, l’analyse d’images, la transcription et les réponses vocales à la demande. L’assistant propose aussi des PDF et courriers, une mémoire par numéro, des rappels, des sélections personnalisées matin/soir et un relais vers les administrateurs. Les services publics déjà développés dans Nanba sont raccordés. L’horoscope demande la date, le lieu et l’heure de naissance si connue ; le calcul Lahiri respecte les incertitudes.
**Évolution catalogue principal préparée (non déployée)** : publication WhatsApp dans le catalogue applicatif, recherche naturelle et alertes de correspondance consenties. Compilation et 138 tests réussis. Voir [état et recette](docs/CATALOGUE-PRINCIPAL.md). Le déploiement Google Cloud reste bloqué par l’accès à la console.


- [Guide des fonctionnalités et limites](docs/WHATSAPP-COMPANION.md).
- [Validation de la version 4](docs/assistant-v4-live-validation.json) et [du parcours horoscope](docs/horoscope-v4.1-live-validation.json).
- **132 tests** réussis sur les sources et sur le chargement utilisé en production.
- Dépôt de publication : `Nivasse14/nanba`, branche `nanba-ensemble-pilot`. Le pilote utilise une archive source à la racine du dépôt ; le code de l’application mobile est séparé.
- Les clés API, données des membres, sessions et bases de production ne font pas partie des sources.

Les sections ci-dessous décrivent aussi les parcours communautaires historiques et le démarrage local de démonstration. Elles ne signifient pas que Twilio ou l’IA sont simulés sur le service de production. Le déploiement automatique est désactivé ; le chargement de compatibilité Render reste actif tant qu’une migration de déploiement explicite n’est pas effectuée.

## Lancer localement

Prérequis : Node.js **24.22.1** ou une version corrigée ultérieure de la branche 24, npm.

```bash
npm ci
cp .env.example .env
npm run check
npm run dev
```

Ouvrir `http://localhost:3000`. Le premier démarrage de développement crée une base synthétique dans `data/development.db`. Elle est conservée après redémarrage. Les migrations s’appliquent automatiquement, une seule fois. Aucun reset automatique.

Le mode initial est **simulé**. Les votes de développement et les envois `simulated` sont distingués des confirmations de fournisseur. Aucune réservation auprès d’un prestataire extérieur, aucun paiement, aucun envoi WhatsApp réel n’a été effectué pendant la construction.

Les boutons de démonstration ouvrent de vraies sessions locales, avec des utilisateurs synthétiques :

| Profil | E-mail local | Usage |
|---|---|---|
| Membre | `member@demo.nanba` | Anjali, demandes et consentements |
| Organisateur | `organizer@demo.nanba` | Arun, rencontres et bénévolat |
| Professionnel | `pro@demo.nanba` | Maya, organisation Atelier & Habitat |
| Administrateur | `admin@demo.nanba` | Leïla, validation et exploitation |
| Autre professionnel | `otherpro@demo.nanba` | Vérifier l’isolation des organisations |
| Autres membres | `member2@demo.nanba`, `member3@demo.nanba` | Attente et défis |
| Autre groupe | `lyon@demo.nanba` | Vérifier l’isolation des groupes |

Mot de passe **des comptes synthétiques uniquement** : `Nanba-demo-2026!`. Le seed et le mode simulé sont refusés en production. N’utilisez jamais cette base pour un pilote réel.

Alternative Docker de développement : `docker compose up --build`. Le service et la base restent locaux ; le port est lié à `127.0.0.1`. La recette Docker est fournie mais n’a pas été exécutée dans cet environnement.

## Parcours disponibles

1. **Demandes collectives** : besoin, intérêt app, validation du sondage, réception durable des votes, seuil, offre professionnelle confirmée, acceptation versionnée, inscriptions atomiques, attente et désistement.
2. **Rencontres** : organisateur, lieu, langue, format, rapprochement explicable, capacité, coordination protégée, acceptation d’une place proposée et export ICS.
3. **Logement** : recherche privée, professionnels choisis, proposition avec référence de catalogue/source, disponibilité datée, intérêt, contact, révocation, suspension et satisfaction.
4. **Entraide** : profil volontaire, compétences/langues, plages de disponibilité, limites hebdomadaires, pause, proposition, double accord, annulation et retour.
5. **Radar** : observation, provenance, justification, modération, dédoublonnage, contestation, correction, expiration et reconfirmation versionnée.
6. **Nouveaux arrivants** : cohortes, étapes, thèmes, ressources, inscriptions, activités, progression privée et proposition de mentorat.
7. **Défis** : contenu et réponse vérifiés, équipes, inscription avant ouverture, dénominateur figé, réponse unique, calcul reproductible, contestation/correction et carte SVG des résultats.
8. **Récits** : original et traduction, brouillon privé, relecture de l’auteur, consentements par canal, validation éditoriale, carte bilingue SVG et retrait.

La collecte JSON Feed/RSS, la recherche textuelle filtrée, les sources officielles, les digests prévisualisés/planifiés, les exports de données et l’effacement complètent les huit parcours. L’IA est optionnelle : elle prépare des brouillons, jamais les droits, places, votes ou paiements.

## Documents de reprise

- [État et résultats des validations](docs/PROGRESS.md)
- [Scénario de démonstration des huit modules](docs/DEMO.md)
- [Architecture, API, intégration Nanba et règles métier](docs/ARCHITECTURE.md)
- [Contrats WAHA, versions, sécurité et licences](docs/WHATSAPP.md)
- [Activation du pilote, pause, sauvegarde et récupération](docs/OPERATIONS.md)
- [Spécification intégrale fournie](docs/SPECIFICATION.txt)

## Commandes

```bash
npm run typecheck
npm run build
npm test
npm run format:check
npm run backup
```

`npm test` utilise des bases jetables séparées, des horloges contrôlées, des clients HTTP et six connexions concurrentes. Aucun accès à un compte tiers n’est nécessaire. Les contrats WAHA sont testés avec des réponses HTTP synthétiques : ce n’est pas une certification du protocole réel.

## Limites explicites

- Authentification locale par invitation/provisionnement ; SSO et comptes Nanba à raccorder. Pas de récupération de mot de passe par e-mail sans fournisseur connecté.
- Pas de catalogue immobilier Nanba disponible : les propositions pointent vers une référence/source ; aucun catalogue de biens indépendant n’est dupliqué. L’adaptateur `NanbaCatalog` est le point de raccordement.
- WAHA est un transport **non officiel**, pas une API Meta approuvée. Son image et son compte pilote n’ont pas été lancés ici. Les capacités réelles et la reprise des clés de sondage doivent être validées sur le compte dédié.
- WEBJS n’expose pas ici d’événement WhatsApp natif, de clôture native de sondage, de masquage des votants ni d’édition native. Nanba applique sa propre échéance et propose liens/ICS.
- Paiement : contrat vérifiable et contrôles d’événements implémentés ; aucun fournisseur branché, aucun bouton ne peut déclarer « payé » depuis le navigateur. Les remboursements sont des événements distincts ; pas de déclenchement bancaire autonome.
- Traduction/transcription : contrats préparés. Texte bilingue saisissable et validable sans IA ; audio/photo non activés faute de fournisseur et de stockage média. Tamoul et Tanglish non évalués.
- Interface responsive fournie ; inspection visuelle ordinateur réalisée. L’outil de navigateur disponible n’a pas permis de changer réellement la largeur du viewport pour une recette mobile.
- Déploiement public, montée en charge multi-hôtes, SSO et protocoles externes ne sont pas validés par ces tests locaux.

## Huit modules dans WhatsApp

Le pilote `whatsapp-complete-v2` permet les créations, inscriptions, validations et suivis directement dans les conversations WhatsApp, ainsi que la gestion des membres, partenaires, publications et contenus. Les démarches personnelles passent dans une discussion privée liée à une communauté autorisée. Commencer avec **Nanba aide** ; voir [toutes les commandes](docs/WHATSAPP-COMMANDS.md). Les intégrations IA/paiement/catalogue externes demeurent non connectées. La dernière validation locale compte 65 tests réussis ; les échanges sur téléphones réels restent à recetter après association du compte.
