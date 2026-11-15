# Personnaliser Nanba dans WhatsApp — v4.3

Parcours facultatif, directement sur WhatsApp. Aucun site, compte, âge ou date de naissance demandé. La naissance reste réservée au parcours horoscope choisi séparément.

## À essayer

- Nouveau numéro : « Bonjour » reçoit un accueil. Une première demande précise est traitée avant une invitation discrète.
- « PERSONNALISER » ouvre le formulaire WhatsApp lorsqu’il est approuvé dans la langue du profil. Sinon les questions commencent dans la conversation.
- « QUESTIONS ICI » commence/reprend le questionnaire en conversation. Réponses par numéro, mots libres ou vocal transcrit.
- « PASSER », « RETOUR », « PLUS TARD », « ANNULER » permettent de naviguer sans modifier le profil enregistré.
- « CONFIRMER » écrit applique le récapitulatif. « MON PROFIL » affiche les préférences et les sélections quotidiennes existantes.
- Anglais : PERSONALISE, QUESTIONS HERE, SKIP, BACK, LATER, CANCEL, CONFIRM, MY PROFILE. Les écrans et questions existent aussi en tamoul. Tanglish est proposé comme langue de réponse ; le questionnaire utilise alors des libellés anglais.

## Contenu

Le formulaire natif présente trois écrans : langue/format ; centres d’intérêt/ville facultative ; ton/longueur/choix des envois. En conversation, chaque question arrive séparément. Les choix de ton sont chaleureux/direct/posé ; aucune personnalité, religion ou tranche d’âge n’est inférée.

Un brouillon ne crée ni profil ni abonnement. L’envoi quotidien nécessite une sélection explicite matin ou soir, un à quatre thèmes, une heure et un fuseau, puis CONFIRMER. Le formulaire affiche Europe/Paris comme fuseau par défaut ; la conversation demande le fuseau. Les heures calmes existantes sont respectées. Une erreur d’horaire annule atomiquement l’enregistrement et demande une correction.

Pour garder le questionnaire court, la sélection quotidienne propose actualités, sorties, cinéma, cuisine et images. L’horoscope peut être choisi comme intérêt ; son abonnement se configure séparément après les données de naissance. Les alertes d’annonces demandent aussi leurs propres critères et consentement.

« Aucune sélection automatique » annule les sélections matin/soir après confirmation, en conservant les rappels personnels et les alertes distinctes. « Garder mon programme » ou PASSER conserve le programme existant. Une nouvelle sélection quotidienne remplace les deux créneaux précédents par le créneau résumé. Les limites de fréquence, heures calmes, pause après inactivité et modèles approuvés hors fenêtre WhatsApp restent applicables.

## Activation et vérifications

`NANBA_ONBOARDING_PROVISION=true` autorise le service à créer trois accueils `twilio/quick-reply` utilisables en session et trois formulaires `twilio/flows` FR/EN/TA. La création et la soumission Meta n’envoient aucun message aux membres. Les formulaires sont soumis dans la catégorie MARKETING ; seuls ceux dont le statut est `approved` sont proposés. Le statut réel est visible dans `/api/twilio/health` et l’API administrateur `/api/twilio/onboarding`.

Le traitement des formulaires utilise `InteractiveData`, protégé par la signature du webhook Twilio, le compte, le destinataire et le numéro émetteur. Seuls les champs prévus et des valeurs validées sont acceptés. Un formulaire est accepté uniquement après une demande active du même numéro, dans sa fenêtre et son epoch. Une réponse n’applique jamais directement un abonnement : elle produit un récapitulatif à confirmer dans le chat. Les doublons de MessageSid, anciens formulaires et réémissions après STOP sont neutralisés. Les réponses inconnues ne sont pas envoyées au modèle IA.

Les brouillons sont chiffrés, séparés par identité et expirent au bout de sept jours. STOP suspend le parcours et invalide le formulaire ; START ne réabonne pas. OUBLIE efface aussi brouillon et données structurées. Les messages du récapitulatif suivent la rétention conversationnelle existante et restent visibles dans WhatsApp.

Les tests simulent les fournisseurs et couvrent le parcours complet, la persistance, l’isolation, le consentement, l’atomicité, l’arrêt, les doublons, l’entrée signée et le provisionnement. La validation sur un véritable téléphone WhatsApp reste distincte.

Références vérifiées le 15 novembre 2026 : https://www.twilio.com/docs/content/flows et https://www.twilio.com/docs/content/twilio-quick-reply.

Compatibilité API : les champs multiples utilisent `MULTIPLE_SELECT`, comme l’exemple de requête Twilio. Une seule reprise des créations v1 explicitement rejetées avec le code 1005 est autorisée. Les créations au résultat incertain ne sont jamais répétées automatiquement. Les détails d’erreur fournisseur sont réservés à l’API administrateur.
