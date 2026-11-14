# WhatsApp : version et contrat retenus

Vérification documentaire effectuée le **12 novembre 2026**. Candidat initial : **WAHA 2026.10.1, moteur WEBJS**, tag image `devlikeapro/waha:latest-2026.10.1`. Adaptateur isolé dans `src/whatsapp.ts`. WAHA est déployé sur Render avec stockage persistant ; le compte WhatsApp attend l’association du propriétaire.

WAHA utilise un transport non officiel. Il n’est pas présenté comme une API Meta approuvée. Les restrictions de la plateforme et les refus sont respectés. Aucun mécanisme de rotation de comptes ou de contournement n’est implémenté.

## Matrice

| Capacité | Documentation WEBJS consultée | Adaptateur Nanba | Vérification réelle |
|---|---|---|---|
| Texte | Disponible | `POST /api/sendText` | À faire sur le pilote |
| Mentions/réponse | Disponible | `mentions`, `reply_to` | À faire |
| Médias | Disponible | Non exposé sans stockage privé et contrôle de fichier | Non réalisé |
| Sondages | Disponible | `POST /api/sendPoll` | Contrat HTTP synthétique testé |
| Votes/changements/retraits | Disponible | `poll.vote`, état complet des choix | Normalisation et métier testés |
| Échec de déchiffrement | Disponible | `poll.vote.failed`, incident distinct du retrait | Testé synthétiquement |
| Participants et rôles accessibles | Endpoint participants documenté | `GET /api/{session}/groups/{chatId}/participants` | À confronter au compte pilote ; aucun droit Nanba importé automatiquement |
| Événements/RSVP natifs | GOWS dans la matrice, pas WEBJS | Liens Nanba et export ICS | Pas de prétention de support natif |
| Clôture/édition natives du sondage | Non prouvées pour ce contrat | Non proposées | Non validées |
| Masquage des votants | Non prouvé | Non proposé ; votes non anonymes pour Nanba | Non validé |

Les pages de documentation sont évolutives. La version est épinglée, mais les capacités doivent être revérifiées sur l’image effectivement utilisée avant tout envoi réel. Le tag a été trouvé dans le registre officiel ; l’image n’a pas été tirée ici et son digest exact doit être enregistré à l’activation.

## Envoi et réception

Envoi d’un sondage : session + chat de groupe autorisé + question + libellés d’options + `multipleAnswers`. La réponse doit fournir un identifiant non vide. Cet identifiant est persisté dans `polls.message_id`, avec le fournisseur et la session. Sans identifiant ou après une erreur réseau ambiguë, l’état est **uncertain**, jamais « publié ».

Pour le webhook, configurer sur la session WAHA :

```json
{
  "name": "nanba-pilot",
  "config": {
    "webhooks": [{
      "url": "https://VOTRE-HOTE/api/webhooks/waha",
      "events": ["poll.vote", "poll.vote.failed", "message.any", "session.status"],
      "hmac": {"key": "SECRET_A_FOURNIR_HORS_DEPOT"},
      "retries": {"policy": "exponential", "delaySeconds": 2, "attempts": 10}
    }]
  }
}
```

Le serveur vérifie **`X-Webhook-Hmac-Algorithm: sha512`** et **`X-Webhook-Hmac`** en hexadécimal sur les octets bruts. Ces noms proviennent de la documentation WAHA ; aucun en-tête de signature imaginaire n’est utilisé. Le timestamp d’envoi webhook n’est pas pris comme preuve signée d’ordre métier : la clé stable et le timestamp du vote servent à la déduplication/chronologie.

Exemple de vote synthétique correspondant à la structure documentée :

```json
{
  "session": "nanba-pilot",
  "event": "poll.vote",
  "payload": {
    "poll": {"id": "IDENTIFIANT_RETOURNE_PAR_WAHA", "to": "120363000001@g.us", "fromMe": true},
    "vote": {
      "id": "IDENTIFIANT_DU_VOTE",
      "to": "120363000001@g.us",
      "from": "IDENTITE_FOURNISSEUR@lid",
      "fromMe": false,
      "selectedOptions": ["Je participe / Interested"],
      "timestamp": 1794484800
    }
  }
}
```

Ce fichier d’exemple ne prouve pas qu’un vote réel a été transmis. `from` doit être l’identité réellement fournie. Aucun LID n’est converti en téléphone. Les groupes doivent exister dans la liste autorisée. Les votes d’un sondage inconnu sont ignorés. Un événement est enregistré dans l’inbox avant l’accusé 202, puis normalisé et traité de façon rejouable.

## Fiabilité

États outbox : `prepared`, `pending`, `sending`, `confirmed`, `simulated`, `failed`, `uncertain`, `cancelled`. L’interface ne confond pas confirmé fournisseur et simulé. Pas de promesse « exactement une fois » : un crash après réception fournisseur mais avant commit local produit une incertitude à réconcilier.

Le worker utilise une exclusion locale et un bail en base. Il revalide groupe, adhésion, rôle, pause, état du contenu, échéance et consentement juste avant l’envoi. Une révocation annule les publications encore en attente. Un message déjà en cours d’envoi ne peut pas être rappelé par une transaction locale ; cette limite est explicite.

Les clés et données de session WAHA doivent rester sur un volume persistant. Une sauvegarde de la base Nanba seule ne préserve pas les clés de chiffrement des sondages du moteur WhatsApp. Un redémarrage réel de WAHA et le vote sur un ancien sondage font partie des tests pilotes obligatoires.

## Versions, licences et avis consultés

- Node.js utilisé : 24.22.1. TypeScript 5.9.3, `@types/node` 24.10.1, Prettier 3.6.2 : versions exactes dans `package-lock.json`.
- WAHA Core au tag 2026.10.1 : licence **Apache-2.0**, fichier officiel `LICENSE` consulté. Les composants/moteurs empaquetés conservent leurs propres licences ; la licence Core ne remplace pas leurs conditions. Aucun code de WAHA n’est copié dans ce dépôt.
- Les notes officielles 2026.10.1 annoncent notamment des correctifs de dépendances et une mise à jour Node. L’index d’avis de sécurité du dépôt renvoyait une liste vide au moment du contrôle : cela n’est pas une garantie d’absence de vulnérabilité.
- L’avis public CVE-2026-6979 décrit une SSRF des conversions média sur des versions antérieures ; son correctif n’a pas été établi ici. L’adaptateur n’expose pas ces endpoints, WAHA reste privé et doit être restreint en sortie. Avant activation, scanner l’image exacte et confirmer le statut de cet avis. Aucune affirmation « image sans vulnérabilité ».

## Sources officielles consultées

- https://github.com/devlikeapro/waha/releases/tag/2026.10.1
- https://hub.docker.com/r/devlikeapro/waha/tags
- https://raw.githubusercontent.com/devlikeapro/waha/2026.10.1/LICENSE
- https://api.github.com/repos/devlikeapro/waha/security-advisories
- https://waha.devlike.pro/docs/how-to/polls/
- https://waha.devlike.pro/docs/how-to/events/
- https://waha.devlike.pro/docs/how-to/groups/
- https://waha.devlike.pro/docs/how-to/security/
- https://waha.devlike.pro/docs/how-to/event-message/
- https://waha.devlike.pro/docs/how-to/send-messages/
- https://github.com/devlikeapro/waha/issues/2324
- https://github.com/advisories/GHSA-4fv2-mmc2-3p6x

## Pilote personnel

Le démarrage privé permet de scanner le QR sans créer un compte web. Après scan, une action explicite autorise uniquement le propre identifiant de session confirmé par WAHA. Les messages « Nanba ... » dans la discussion avec soi-même déclenchent des réponses guidées. Aucun autre chat privé n’est autorisé. Les réponses du bot commencent par un marqueur distinct et les messages de source API sont ignorés pour éviter les boucles. Les sondages natifs acceptent également ce chat privé autorisé ; leur livraison et le retour des votes restent à recetter sur le téléphone. Les groupes restent soumis à autorisation dédiée.
