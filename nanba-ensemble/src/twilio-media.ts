import { check, Problem } from "./validation.ts";

export const TRANSCRIPTION_MODEL = "gpt-transcribe";
export const MEDIA_LIMITS = {
  count: 4,
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  total: 20 * 1024 * 1024,
};
export type Attachment = { url: string; mime: string; kind: "image" | "audio" };
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
};
export const mediaErrors: Record<string, string> = {
  media_unsupported:
    "Je peux lire les photos JPEG, PNG ou WebP et les messages vocaux WhatsApp. Pour ce fichier, envoie une photo ou un vocal directement dans la conversation.",
  media_too_many: "Envoie au maximum 4 images ou audios dans un même message.",
  media_invalid:
    "Je n’ai pas pu récupérer cette pièce jointe. Peux-tu la renvoyer directement dans WhatsApp ?",
  media_unavailable:
    "La pièce jointe n’est pas accessible pour le moment. Peux-tu la renvoyer ?",
  media_too_large:
    "Cette pièce jointe est trop volumineuse : maximum 5 Mo par image, 16 Mo par audio et 20 Mo par message. Envoie une version plus légère ou un vocal plus court.",
  audio_unavailable:
    "Je n’ai pas pu transcrire cet audio. Peux-tu réessayer avec un vocal plus court ou écrire ta question ?",
  audio_empty:
    "Je n’ai pas réussi à comprendre la parole dans cet audio. Peux-tu refaire le vocal ou écrire ta question ?",
  audio_too_long:
    "Cet audio contient trop de texte pour un seul échange. Peux-tu le découper en vocaux plus courts ?",
};
export function mediaErrorCode(error: unknown): string | null {
  return error instanceof Problem && Object.hasOwn(mediaErrors, error.code)
    ? error.code
    : null;
}
function mimeType(value: string) {
  const mime = value.split(";")[0].trim().toLowerCase();
  return (
    (
      {
        "audio/opus": "audio/ogg",
        "application/ogg": "audio/ogg",
        "audio/mp3": "audio/mpeg",
        "audio/x-wav": "audio/wav",
        "audio/wave": "audio/wav",
        "audio/x-m4a": "audio/mp4",
        "audio/x-flac": "audio/flac",
      } as Record<string, string>
    )[mime] ?? mime
  );
}
function mediaUrl(value: string, account: string, message: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Problem(400, "media_invalid");
  }
  const prefix = `/2010-04-01/Accounts/${account}/Messages/${message}/Media/`;
  check(
    url.origin === "https://api.twilio.com" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.startsWith(prefix) &&
      /^ME[0-9a-f]{32}$/i.test(url.pathname.slice(prefix.length)),
    "media_invalid",
  );
  return url.href;
}
export function attachmentsFromForm(
  params: Record<string, string>,
  account: string,
): Attachment[] {
  const count = Number(params.NumMedia ?? 0);
  check(Number.isInteger(count) && count >= 0, "media_invalid");
  check(count <= MEDIA_LIMITS.count, "media_too_many");
  return Array.from({ length: count }, (_, i) => {
    const mime = mimeType(params[`MediaContentType${i}`] ?? "");
    check(Object.hasOwn(extensions, mime), "media_unsupported");
    return {
      url: mediaUrl(params[`MediaUrl${i}`] ?? "", account, params.MessageSid),
      mime,
      kind: mime.startsWith("image/") ? "image" : "audio",
    };
  });
}
function validBytes(bytes: Buffer, mime: string) {
  const starts = (hex: string) =>
    bytes.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  switch (mime) {
    case "image/jpeg":
      return starts("ffd8ff");
    case "image/png":
      return starts("89504e470d0a1a0a");
    case "image/webp":
      return (
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP"
      );
    case "audio/wav":
      return (
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WAVE"
      );
    case "audio/ogg":
      return bytes.toString("ascii", 0, 4) === "OggS";
    case "audio/flac":
      return bytes.toString("ascii", 0, 4) === "fLaC";
    case "audio/webm":
      return starts("1a45dfa3");
    case "audio/mp4":
      return bytes.toString("ascii", 4, 8) === "ftyp";
    case "audio/mpeg":
      return (
        bytes.toString("ascii", 0, 3) === "ID3" ||
        (bytes[0] === 255 && (bytes[1] & 224) === 224)
      );
    default:
      return false;
  }
}
export async function downloadAttachment(
  attachment: Attachment,
  account: string,
  message: string,
  authorization: string,
  fetcher: typeof fetch,
): Promise<Buffer> {
  const original = mediaUrl(attachment.url, account, message);
  let url = new URL(original);
  const signal = AbortSignal.timeout(25000);
  const limit = MEDIA_LIMITS[attachment.kind];
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      // Never forward Twilio credentials to a CDN, or accept a caller-supplied CDN URL.
      const headers =
        url.href === original ? { Authorization: authorization } : undefined;
      const response = await fetcher(url.href, {
        headers,
        redirect: "manual",
        signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        check(location && redirects < 3, "media_unavailable");
        const next = new URL(location, url);
        check(
          next.protocol === "https:" &&
            !next.username &&
            !next.password &&
            !next.port &&
            !next.hash &&
            (next.href === original ||
              /^[a-z0-9.-]+\.twiliocdn\.com$/i.test(next.hostname)),
          "media_invalid",
        );
        url = next;
        continue;
      }
      check(response.ok && response.body, "media_unavailable");
      const mime = mimeType(response.headers.get("content-type") ?? "");
      if (!(mime === attachment.mime || mime === "application/octet-stream")) {
        await response.body.cancel();
        throw new Problem(400, "media_invalid");
      }
      if (Number(response.headers.get("content-length") ?? 0) > limit) {
        await response.body.cancel();
        throw new Problem(413, "media_too_large");
      }
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          check(size <= limit, "media_too_large", 413);
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      const bytes = Buffer.concat(chunks, size);
      check(size > 0 && validBytes(bytes, attachment.mime), "media_invalid");
      return bytes;
    }
    throw new Problem(502, "media_unavailable");
  } catch (error) {
    if (mediaErrorCode(error)) throw error;
    throw new Problem(502, "media_unavailable");
  }
}
export async function transcribeAudio(
  bytes: Buffer,
  mime: string,
  apiKey: string,
  model: string,
  fetcher: typeof fetch,
): Promise<string> {
  const form = new FormData();
  form.set("model", model);
  form.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: mime }),
    "vocal." + extensions[mime],
  );
  try {
    const response = await fetcher(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey },
        body: form,
        signal: AbortSignal.timeout(60000),
        redirect: "error",
      },
    );
    check(response.ok, "audio_unavailable", 503);
    const data = await response.json();
    check(typeof data.text === "string" && data.text.trim(), "audio_empty");
    check(data.text.length <= 12000, "audio_too_long");
    return data.text.trim();
  } catch (error) {
    if (mediaErrorCode(error)) throw error;
    throw new Problem(502, "audio_unavailable");
  }
}
