# État au 15 novembre 2026

- Service Render : `nanba-ensemble-pilot-ufgg` (`srv-dbr36g0n74is73d71k8g`).
- Production inchangée : version `assistant-v4.1`, dernier déploiement actif vérifié `dep-dbs3jo3bc2fs73afj5t0`.
- Version prête : `assistant-v4.2-diaspora`, source `e396ed6f444c2db54ead6dd6da915f5fe0cac38d`.
- Déploiement automatique : désactivé.
- Base SQLite : disque persistant conservé ; deux tables additives pour les parcours et exercices.

## Validation

146 tests passent. L’archive exacte publiée a démarré localement avec `NODE_OPTIONS=''`, en mode production et avec configuration synthétique : `/health` et `/api/twilio/health` répondent, les nouvelles capacités sont présentes, la base est conservée après redémarrage et `PRAGMA integrity_check` retourne `ok`. Aucun appel externe ni message aux membres. Les dépendances vérifiées du workspace ont été utilisées ; Docker n’est pas disponible dans cet environnement.

## Blocage actuel

L’activation exige de remplacer l’ancien chargement de code via `NODE_OPTIONS` par le démarrage direct de l’archive complète. Deux demandes de modification de cette seule variable ont été rejetées par le contrôle automatique. Le second refus indique que les tests locaux ne prouvent pas que le service Render actuel utilise déjà la nouvelle archive et que la transition peut interrompre la production.

Les refus n’ont appliqué aucune modification. Aucun déploiement n’a été déclenché. L’autorisation explicite de cette transition de production est demandée avant une nouvelle tentative. Ne pas contourner le refus via le Dockerfile, un script de démarrage ou un autre canal.

Après autorisation : modifier uniquement `NODE_OPTIONS` en préservant toutes les autres variables, déclencher le déploiement manuel de l’archive vérifiée, attendre son statut `live`, contrôler la nouvelle version, les capacités et les logs. Une courte interruption est possible car ce service utilise un disque persistant.

La publication dans le catalogue principal nécessite encore le déploiement de l’API Nanba sur Google Cloud et la configuration du secret partagé. Elle ne doit pas être annoncée comme active.
