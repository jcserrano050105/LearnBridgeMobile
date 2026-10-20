import { Platform } from "react-native";
import { File } from "expo-file-system";

/**
 * Reads a file picked on the device (image picker / document picker URI) into an ArrayBuffer
 * for uploading to Supabase Storage.
 *
 * Since Expo SDK 56 the global fetch is expo/fetch, which isn't guaranteed to read local file:// URIs,
 * so on iOS/Android we read through expo-file-system instead. On web the picker returns a blob: URL,
 * which fetch handles fine.
 */
export async function readLocalFile(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    return (await fetch(uri)).arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}
