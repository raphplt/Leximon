/** Whether `version` comes before `minimum`, both `major.minor.patch`. */
export function versionBelow(version: string, minimum: string): boolean {
  const own = parts(version);
  const least = parts(minimum);
  // An unreadable version is never blocked: the API keeps the last word on what it accepts.
  if (own === null || least === null) return false;
  for (let i = 0; i < 3; i += 1) {
    const a = own[i] ?? 0;
    const b = least[i] ?? 0;
    if (a !== b) return a < b;
  }
  return false;
}

function parts(version: string): readonly number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match === null ? null : match.slice(1).map(Number);
}

export const UPDATE_COPY = {
  title: "Mise à jour nécessaire",
  body: "Cette version de l'app est trop ancienne pour continuer à jouer. Mets-la à jour pour reprendre la partie.",
  action: "Mettre à jour",
} as const;
