import * as DocumentPicker from "expo-document-picker";
import { supabase } from "./supabase";
import { readLocalFile } from "./readLocalFile";

// PDF picking / validation / upload shared by tutor documents and parent valid IDs.
// Same rules as the website's RegisterPage: PDF only, max 20MB, bucket "tutor-documents".

export type PickedDoc = { uri: string; name: string; size: number; mimeType: string };

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const DOCS_BUCKET   = "tutor-documents";

export function validatePDF(file: PickedDoc | null) {
  if (!file) return "Please select a file.";
  const isPdf = file.mimeType === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return "Only PDF files are accepted.";
  if (file.size > MAX_PDF_BYTES) return "File must be under 20MB.";
  return null;
}

/** Opens the file picker for a PDF. Returns null if the user cancels. */
export async function pickPDF(): Promise<PickedDoc | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
  if (res.canceled) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, size: a.size ?? 0, mimeType: a.mimeType || "application/pdf" };
}

/** Uploads a picked PDF to tutor-documents/<path> and returns its public URL. */
export async function uploadPDF(path: string, file: PickedDoc, label: string) {
  const body = await readLocalFile(file.uri);
  const { error } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, body, { upsert: true, contentType: file.mimeType || "application/pdf" });
  if (error) throw new Error(`Failed to upload ${label}: ${error.message}`);
  const { data } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(path);
  return data?.publicUrl || path;
}

export function newTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
