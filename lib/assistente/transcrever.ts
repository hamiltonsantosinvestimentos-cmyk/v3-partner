// MY ASSISTANT IA: transcrição de áudio pela OpenAI. O áudio não é guardado no banco V3 nem no Storage.
const MODELO_TRANSCRICAO = "gpt-transcribe";

export async function transcreverAudio(base64: string, mimetype: string, timeoutMs: number): Promise<string> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("OPENAI_API_KEY ausente");

  const tipo = mimetype.split(";")[0].trim() || "audio/ogg";
  const extensao = tipo.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "ogg";
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(base64, "base64")], { type: tipo }), `audio.${extensao}`);
  form.append("model", MODELO_TRANSCRICAO);
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Transcrição falhou (${res.status})`);
  const data = await res.json() as { text?: string };
  const texto = data.text?.trim();
  if (!texto) throw new Error("Transcrição vazia");
  return texto;
}
