# Nanba WhatsApp — services diaspora v4.2

**Développé, testé et publié. Pas encore activé en production.** Le service WhatsApp reste sur `assistant-v4.1` ; le déploiement de la version `assistant-v4.2-diaspora` attend l’autorisation de modifier son chargement de démarrage.

## Nouveautés prêtes

- **Mon parcours en France** : installation, logement, emploi ou famille ; suivi privé par numéro et reprise de la prochaine étape.
- **Mon français au quotidien** : six simulations — propriétaire, entretien, école, rendez-vous, courses et voisins — avec explications dans la langue choisie et audio à la demande via la voix IA existante.
- **Je comprends mon courrier** : sens, demande, date lisible ou incertitude, prochaine action ; préparation d’une réponse, traduction ou rappel si demandé.
- **Le bon interlocuteur** : orientation vers des ressources officielles et les administrateurs Nanba sur demande.

[Exemples de messages WhatsApp et guide complet](nanba-ensemble/docs/DIASPORA.md).

Le suivi n’active aucune notification. Progression chiffrée, isolée entre numéros, effaçable avec OUBLIE. Aucun diplôme, droit administratif ou rendez-vous réel n’est déduit d’un exercice.

## Sources et vérifications

Code directement consultable dans [nanba-ensemble/](nanba-ensemble/) : [nouveau module diaspora](nanba-ensemble/src/nanba-diaspora.ts), [assistant](nanba-ensemble/src/twilio-assistant.ts), [serveur](nanba-ensemble/src/server.ts), [tests](nanba-ensemble/tests/diaspora.test.ts).

**146 tests passent.** L’archive a également été démarrée en mode production local sans l’ancien chargeur : HTTP 200, capacités diaspora présentes, base conservée après redémarrage et intégrité SQLite vérifiée. Aucun message envoyé aux membres. Voir [la vérification de démarrage](boot-validation.json).

Archive complète : [nanba-ensemble-source.tar.gz](nanba-ensemble-source.tar.gz), **133 fichiers**, [manifeste SHA-256](SOURCE-MANIFEST.json).

- Commit source : `e396ed6f444c2db54ead6dd6da915f5fe0cac38d`.
- SHA-256 archive : `bd93c0b44e447f46a7acdc1a5f45d9106c2f5c4875fadd2b3057cf6269864474`.
- L’archive ne contient ni secrets, ni données de membres, ni sessions, ni node_modules.

## État du déploiement

Le contrôle automatique a refusé le changement de la variable `NODE_OPTIONS` sur Render, en raison du risque de panne pendant le passage de l’ancien chargeur à l’archive complète. Les tests locaux sont réussis, mais la modification et le déploiement restent en attente. **Aucun changement de configuration de production ni déclenchement de déploiement n’a été effectué.** [Détails](DEPLOYMENT-STATUS.md).

Le raccordement des publications WhatsApp au catalogue principal reste séparément en attente du déploiement de l’API Google Cloud et du secret partagé. [État du catalogue](nanba-ensemble/docs/CATALOGUE-PRINCIPAL.md). Les nouvelles fonctions diaspora n’ont pas besoin de ce raccordement pour fonctionner.

Pour travailler localement : Node 24.22.1, `npm ci`, `npm run check`. Pour reconstruire une archive depuis les sources committées : `node scripts/package-source.mjs`.
