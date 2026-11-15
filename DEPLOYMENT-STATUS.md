# Déploiement vérifié le 15 novembre 2026

**Version active : `assistant-v4.2-diaspora`, depuis 18 h 15 (Paris).**

- Service Render : `nanba-ensemble-pilot-ufgg` (`srv-dbr36g0n74is73d71k8g`).
- Déploiement : `dep-dbsugo8ae00c7394og7g`, confirmé `live` à `2026-11-15T17:15:01.825895Z`.
- Commit GitHub déployé : `5a82317b1a6459657d8cf074417dead1dc91f4fa`.
- Source de l’archive : `e396ed6f444c2db54ead6dd6da915f5fe0cac38d`.
- SHA-256 de l’archive : `bd93c0b44e447f46a7acdc1a5f45d9106c2f5c4875fadd2b3057cf6269864474`.

Après l’accord explicite de l’utilisateur, seule la variable `NODE_OPTIONS` a été vidée pour retirer le chargeur de compatibilité. Les autres variables ont été préservées par une mise à jour partielle. Cette mise à jour a déclenché le déploiement Render ; aucun second déploiement n’a été lancé. Le disque persistant existant est conservé. Le service utilise désormais directement l’archive source complète.

## Résultat des contrôles

- `/api/twilio/health` répond HTTP 200 avec `ready: true` et la version v4.2.
- Capacités présentes : `privateJourneys`, `frenchPractice`, `guidedLetters`, `officialResources`.
- Les capacités existantes restent présentes : voix, images, PDF, mémoire, rappels, sélections, horoscope et relais humain.
- Logs de démarrage : serveur prêt sur le port 3000, statut Render `live`, aucun échec de démarrage observé.
- 146 tests locaux avaient réussi ; l’archive avait aussi passé un démarrage en mode production local et un contrôle de conservation de base après redémarrage.
- Aucun message WhatsApp de test n’a été envoyé aux membres pendant cette activation.

[Résultat détaillé de la vérification](diaspora-live-validation.json).

## Limite restante

La publication WhatsApp dans le catalogue principal n’est pas encore activée : `mainCataloguePublishingConfigured: false`. Elle nécessite le déploiement de l’API Nanba sur Google Cloud et le secret partagé. Les services diaspora ci-dessus sont indépendants de cette activation.

Les mises à jour de documentation après ce déploiement ne déclenchent pas de redéploiement : le déploiement automatique du service reste désactivé.
