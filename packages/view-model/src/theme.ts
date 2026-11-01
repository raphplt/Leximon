export type ThemeChoice = "device" | "light" | "dark";

export const THEME_LABEL = "Thème";

export const THEME_CHOICES: readonly { readonly value: ThemeChoice; readonly label: string }[] = [
  { value: "device", label: "Comme l'appareil" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Nuit" },
];

/** The phone only reads its theme as the app starts. */
export const THEME_NEXT_LAUNCH = "Le thème change au prochain lancement de l'app.";

export function parseThemeChoice(stored: string | null): ThemeChoice {
  return stored === "light" || stored === "dark" ? stored : "device";
}

export function resolveTheme(choice: ThemeChoice, deviceIsDark: boolean): "light" | "dark" {
  if (choice === "device") return deviceIsDark ? "dark" : "light";
  return choice;
}
