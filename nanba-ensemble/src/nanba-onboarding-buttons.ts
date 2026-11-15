import type { Row } from "./db.ts";

export const buttonKinds = ["buttons3", "list7", "list8", "list10"];
export const buttonCopy: Record<string, Row> = {
  fr: {
    menu: "Choisir",
    skip: "Passer",
    back: "Retour",
    later: "Plus tard",
    confirm: "Confirmer",
    cancel: "Annuler",
    done: "Continuer",
    other: "Autre",
    none: "Aucun thème choisi",
    selected: "Sélectionné",
    unselected: "Toucher pour choisir",
    multi:
      "Choisis jusqu’à 4 sujets, un par un, puis touche Continuer. Retouche un sujet pour le retirer.",
    free: "Écris ta réponse ou envoie un vocal.",
    hint: "Touche un choix, ou écris librement. PASSER · RETOUR · PLUS TARD",
    stale: "Ce bouton est ancien. Utilise les choix du dernier message.",
    confirmation:
      "Touche Confirmer pour enregistrer ces choix et le programme affiché. Tu peux aussi écrire CONFIRMER.",
    notices: ["Aucun envoi", "Le matin", "Le soir", "Garder mon programme"],
    france: "France",
    india: "Inde",
  },
  en: {
    menu: "Choose",
    skip: "Skip",
    back: "Back",
    later: "Later",
    confirm: "Confirm",
    cancel: "Cancel",
    done: "Continue",
    other: "Other",
    none: "No topics chosen",
    selected: "Selected",
    unselected: "Tap to choose",
    multi:
      "Choose up to 4 topics, one at a time, then tap Continue. Tap a selected topic again to remove it.",
    free: "Type your answer or send a voice message.",
    hint: "Tap a choice or type freely. SKIP · BACK · LATER",
    stale: "This button is old. Use the choices in the latest message.",
    confirmation:
      "Tap Confirm to save these choices and the schedule shown. You can also type CONFIRM.",
    notices: ["No messages", "Morning", "Evening", "Keep my schedule"],
    france: "France",
    india: "India",
  },
  ta: {
    menu: "தேர்வு செய்",
    skip: "தவிர்",
    back: "பின்செல்",
    later: "பிறகு",
    confirm: "உறுதிசெய்",
    cancel: "ரத்து செய்",
    done: "தொடர்",
    other: "மற்றவை",
    none: "தலைப்புகள் இல்லை",
    selected: "தேர்ந்தெடுத்தது",
    unselected: "தேர்வு செய்யத் தொடு",
    multi:
      "4 தலைப்புகள் வரை ஒவ்வொன்றாகத் தேர்வு செய்து தொடர் என்பதைத் தொடவும். நீக்க மீண்டும் தொடவும்.",
    free: "பதிலை எழுதவும் அல்லது குரல் செய்தி அனுப்பவும்.",
    hint: "ஒரு தேர்வைத் தொடவும் அல்லது எழுதவும். SKIP · BACK · LATER",
    stale: "இந்த பொத்தான் பழையது. கடைசி செய்தியின் தேர்வைப் பயன்படுத்தவும்.",
    confirmation:
      "தேர்வுகளையும் அட்டவணையையும் சேமிக்க உறுதிசெய் என்பதைத் தொடவும் அல்லது CONFIRM என்று எழுதவும்.",
    notices: ["செய்திகள் வேண்டாம்", "காலை", "மாலை", "பழைய அட்டவணை"],
    france: "பிரான்ஸ்",
    india: "இந்தியா",
  },
};

// Reusable in-session content: personal answers stay in encrypted drafts,
// never in globally stored Twilio template definitions.
export function buttonTemplate(locale: string, kind: string) {
  const w = buttonCopy[locale] || buttonCopy.fr;
  const list = kind.startsWith("list"),
    count = Number(kind.replace(/\D/g, ""));
  const variables: Record<string, string> = {
    "1": "Nanba — choisissez une réponse.",
  };
  const entries = Array.from({ length: count }, (_, i) => {
    const title = String(2 + i * 2),
      id = String(3 + i * 2);
    variables[title] = `Choix ${i + 1}`;
    variables[id] = `example_choice_${i + 1}`;
    return list
      ? { item: `{{${title}}}`, id: `{{${id}}}`, description: w.unselected }
      : { title: `{{${title}}}`, id: `{{${id}}}` };
  });
  return {
    friendly_name: `nanba_question_${kind}_${locale}_v1`,
    language: locale,
    variables,
    types: list
      ? {
          "twilio/list-picker": {
            body: "{{1}}",
            button: w.menu,
            items: entries,
          },
        }
      : { "twilio/quick-reply": { body: "{{1}}", actions: entries } },
  };
}
