import { Alert, Platform } from "react-native";

/**
 * Yes/No confirmation that works on phones and in the browser.
 * (Alert.alert with buttons does nothing on react-native-web.)
 */
export function confirmAsync(title: string, message: string, okText = "OK", destructive = false): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: okText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
