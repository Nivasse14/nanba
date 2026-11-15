# Nanba WhatsApp v4.3 — en ligne

Vérification du 15 novembre 2026 : HTTP 200, ready=true, assistant-v4.3-onboarding.

- Déploiement Render : `dep-dbsv4o3bc2fs73cljtcg`, live à 17:57:42 UTC.
- Commit déployé : `0b786e61d907fa1a7ddf36db05fbfb755ef485d4`.
- Source de l’archive : `d649e6a33e80d2a22b04ae7c88c1ae63fe643911`.
- SHA-256 : `009653f91f65bb461f36dcfc185c55a328cf1c1d1986ec70c6fcb2e48aa9bdf5`.
- Compilation et 159 tests réussis ; démarrage de l’archive en production et persistance SQLite vérifiés localement.
- Accueils FR/EN/TA : in_session. Formulaires FR/EN/TA : received, sans erreur, en attente d’approbation Meta.
- Questionnaire conversationnel actif indépendamment de l’approbation. Aucun message de test envoyé aux membres ; parcours sur téléphone réel non vérifié.

Les échecs de création initiaux ont été corrigés : MULTIPLE_SELECT et limites réelles de longueur. Reprise bornée aux créations explicitement refusées ; aucun doublon créé après réponse incertaine.

Le catalogue principal reste séparément en attente d’activation de son API Google Cloud. Le déploiement automatique Render reste désactivé.

Voir [contrôle réel](live-validation.json), [validation de démarrage](boot-validation.json) et [guide](nanba-ensemble/docs/ONBOARDING.md).
