# Nanba Ensemble — utilisation intégrale des huit modules dans WhatsApp

Version déployable : `whatsapp-complete-v2`. Transport WAHA WEBJS existant, pas de migration Twilio ni de fournisseur IA ajouté.

## Démarrer

Après association du compte WhatsApp et activation du test personnel, écrire **Nanba aide** dans la discussion « Vous ». Choisir un module avec **Nanba 1** à **Nanba 8**, ou son nom. Répondre à chaque étape avec le préfixe **Nanba**. Les actions engageantes présentent un récapitulatif : **Nanba confirmer**, **Nanba retour**, **Nanba annuler**. Une confirmation rejouée ne crée pas de doublon. Une modification des conditions impose de recommencer la confirmation.

Le propriétaire peut autoriser un groupe depuis son propre téléphone en envoyant **Nanba activer groupe NOM** dans ce groupe. Cette commande n'accepte aucun identifiant de destination libre : seul le groupe de l'événement WhatsApp authentifié peut être autorisé. Il doit déjà avoir activé le test personnel sur le même compte.

Les autres membres écrivent **Nanba rejoindre** dans un groupe autorisé, puis **Nanba aide** en message privé au compte du bot. **Nanba groupes**, puis **Nanba groupe 1** sélectionnent leur communauté. Le nom de la communauté est affiché à la sélection. Un membre ne peut sélectionner que ses communautés autorisées ; aucun rôle n'est accordé par le passage en privé. En cas d'identifiants WhatsApp différents entre groupe et privé (LID/numéro), le système ne les fusionne pas arbitrairement : la liaison fournisseur doit être vérifiée.

Pour les essais multi-personnes, utiliser un compte WhatsApp dédié au bot. Le test personnel seul ne reproduit pas l'échange entre un demandeur et un professionnel/bénévole distinct.

## Parcours disponibles

| Module | Créer et consulter | Agir depuis WhatsApp |
|---|---|---|
| Collectif | `Nanba proposer MON IDÉE`, `demandes`, `offres`, `voir CODE` | `intérêt CODE`, `désintérêt CODE`, `sondage CODE` (admin), `résultats CODE`, `offre créer CODE_DEMANDE` (professionnel), `offre confirmer CODE`, `offre modifier CODE`, `inscrire CODE`, `quitter CODE` |
| Rencontres | `Nanba rencontre créer` (organisateur), `rencontres liste`, `chercher rencontre` | `voir CODE`, `inscrire CODE`, `quitter CODE`, `terminer CODE`, `supprimer CODE`, `avis CODE` |
| Logement | `Nanba logement créer`, `logements`, `propositions logement`, `professionnels` | `logement partager CODE`, `logement suspendre CODE`, `logement reprendre CODE`, `logement trouvé CODE`, `logement proposer CODE_DEMANDE` (pro autorisé), `logement intérêt CODE_OFFRE`, `logement contact CODE_OFFRE`, `logement reconfirmer CODE_OFFRE` |
| Entraide | `Nanba entraide créer`, `entraide liste`, `bénévole créer`, `bénévoles` | `bénévole disponibilités CODE`, `bénévole pause CODE`, `bénévole reprendre CODE`, `aider CODE`, `accepter CODE`, `refuser CODE`, `supprimer CODE`, `terminer CODE`, `avis CODE` |
| Radar | `Nanba radar signaler`, `radar liste`, `voir CODE` | `contester CODE` ; modérateur : `radar publier CODE`, `radar confirmer CODE`, `radar corriger CODE`, `radar retirer CODE` |
| Nouveaux arrivants | `Nanba parcours créer` (organisateur), `parcours`, `voir CODE` | `inscrire CODE`, `quitter CODE`, `progression CODE`, `étape CODE`, `ressource CODE`, `activité CODE`, `mentor CODE` |
| Défis | `Nanba défi créer` (admin), `défi question CODE`, `défis liste`, `voir CODE` | `défi valider CODE`, `défi rejoindre CODE`, `défi ouvrir CODE`, `défi répondre CODE`, `défi clôturer CODE`, `résultats CODE`, `contester CODE`, `défi corriger CODE` |
| Histoires | `Nanba histoire créer`, `mes histoires`, `histoires liste`, `voir CODE`, `histoire modifier CODE` | Auteur : `histoire approuver CODE`, `histoire retirer CODE`. Admin : `histoire publier CODE`, `histoire partager CODE` |

Toutes les commandes du tableau commencent par **Nanba**. Les menus rappellent les actions ; aucun JSON à saisir. Les listes paginent par six éléments : par exemple **Nanba demandes 2**. Les codes de fiches ont huit caractères.

**Nanba mes dossiers** retrouve les dossiers créés et les propositions personnelles. **Nanba inscriptions** affiche les confirmations, attentes et places proposées. **Nanba inscrire CODE** accepte une place proposée avant expiration, ou de nouvelles conditions. **Nanba profil** change le pseudonyme ; **Nanba préférences** règle la langue et les consentements.

Les dates des activités utilisent **JJ/MM/AAAA HH:mm, heure de Paris**. Les heures ambiguës ou impossibles lors d'un changement d'heure sont refusées. Les prix se saisissent en euros, puis sont convertis en centimes côté serveur. Les sélections multiples se séparent par `;`. Les ressources et créneaux utilisent les exemples donnés dans le dialogue.

## Administration

**Nanba admin** affiche les commandes selon les droits de la communauté sélectionnée.

- `admin membres`, `admin rôle`, `admin partenaire`, `admin retirer membre` : membres, organisateurs et professionnels vérifiés. Un administrateur ne change pas son propre rôle ; un administrateur de groupe ne peut pas modifier un autre administrateur.
- `admin modération`, `admin signalements`, `admin résoudre` : validation et signalements.
- `partager CODE` : publication d'une rencontre, offre, parcours, information radar ou défi, avec commandes WhatsApp. Aucune coordination privée, progression, réponse individuelle ou recherche de logement n'est incluse.
- `admin envois`, `admin annuler envoi`, `admin réconcilier` : suivi de la boîte d'envoi. Un timeout est incertain, jamais automatiquement renvoyé. La réconciliation exige l'identifiant fournisseur et une preuve.
- `sources`, `source créer`, `source pause CODE`, `source reprendre CODE` : collecte de flux JSON/RSS.
- `documents`, `document créer`, `document vérifier CODE`, `document retirer CODE` : connaissances sourcées, à vérifier avant recherche. Les informations administratives exigent une source officielle autorisée.
- `digests`, `digest créer`, `digest publier CODE` : publication programmée de documents vérifiés.
- `admin pause` / `admin reprendre` : pause du groupe sélectionné. `Nanba stop` / `Nanba reprendre` : pause/reprise de la discussion courante. La reprise ne republie pas les envois annulés.

## Confidentialité et état réel

Logement, inscriptions, coordination, progression, réponses aux quiz, brouillons familiaux et administration passent en message privé. Les réponses privées sont liées à leur destinataire et à la communauté choisie. Les permissions, consentements, version et projection des données sont revérifiés avant l'envoi : un retrait de partage logement, un désistement ou un changement de communauté annule une réponse devenue inadéquate.

Le partage logement remplace la liste des organisations autorisées ; « passer » révoque tout. Le professionnel consulte les demandes de contact dans ses dossiers ; aucune disponibilité n'est inventée. Un récit diffusé via WhatsApp exige l'accord auteur sur ce canal. Le retrait ne peut effacer les copies déjà reçues par des tiers.

Les huit parcours métier sont accessibles dans WhatsApp, avec validations guidées. Les paiements/billets de prestataires, le catalogue Nanba réel, une IA conversationnelle libre, les traductions/transcriptions automatiques et le traitement des médias restent des connexions externes non activées. Les textes bilingues sont saisis et relus manuellement. Les ressources, partenaires et mentors doivent être réels et renseignés ; une liste vide n'est pas un résultat inventé.

L'association initiale WAHA utilise toujours un QR privé. La recette sur des téléphones réels (notamment alias LID, envoi de sondage et votes) reste à réaliser avec le propriétaire après connexion. Aucun message à des tiers n'est envoyé pendant les validations automatisées.

## Validation

65 tests automatisés : huit parcours via événements WhatsApp normalisés, webhook HTTP signé (WAHA simulé au niveau réseau), droits et rôles, consentements, retour/confirmation, persistance, déduplication, conditions modifiées, files d'attente, confidentialité des réponses différées et séparation des communautés. Les tests existants de concurrence SQLite restent valides. Détails : `whatsapp-complete-validation.txt` et `tests/whatsapp-full.test.ts`.
