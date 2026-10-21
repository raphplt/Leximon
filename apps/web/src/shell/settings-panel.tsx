"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { canVibrate, type FeedbackKind, readPreference, writePreference } from "@/booster/feedback";
import { signOut } from "@/lib/api";
import { account } from "@/player/player";
import { useShared } from "@/player/resource";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { Switch } from "@/ui/switch";
import ui from "@/ui/ui.module.css";
import styles from "./panels.module.css";

/** « r••••@gmail.com »: enough to recognize the address, not to read it over a shoulder. */
function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}••••@${domain}`;
}

/**
 * Settings (R-03, R-06): sound and vibration, kept on the device; the account. Notifications and
 * profile settings join with lot 3.
 */
export function SettingsPanel({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<Record<FeedbackKind, boolean> | null>(null);
  const [vibrates, setVibrates] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who = useShared(account);

  useEffect(() => {
    if (!open) return;
    setPrefs({ sound: readPreference("sound"), haptics: readPreference("haptics") });
    setVibrates(canVibrate());
    setError(null);
  }, [open]);

  const toggle = (kind: FeedbackKind, enabled: boolean) => {
    writePreference(kind, enabled);
    setPrefs((current) => (current === null ? current : { ...current, [kind]: enabled }));
  };

  const leave = async () => {
    setLeaving(true);
    try {
      await signOut();
      // A full load: the next screen starts a new guest from scratch.
      window.location.assign("/jouer");
    } catch {
      setLeaving(false);
      setError("Le serveur lambine. Réessaie.");
    }
  };

  return (
    <Dialog open={open} title="Réglages" onClose={onClose}>
      <section className={ui.group}>
        <h3 className={ui.kicker}>Jeu</h3>
        <div className={ui.groupRows}>
          {prefs !== null && (
            <>
              <Switch label="Son" checked={prefs.sound} onChange={(on) => toggle("sound", on)} />
              {vibrates && (
                <Switch
                  label="Vibration"
                  checked={prefs.haptics}
                  onChange={(on) => toggle("haptics", on)}
                />
              )}
            </>
          )}
        </div>
      </section>
      <section className={ui.group}>
        <h3 className={ui.kicker}>Compte</h3>
        <div className={ui.groupRows}>
          {who?.kind === "member" ? (
            <>
              <Link href="/compte" className={ui.switchRow} onClick={onClose}>
                <span className={ui.switchLabel}>
                  Adresse e-mail
                  <span className={ui.switchSub}>{maskEmail(who.email)}</span>
                </span>
                <Icon name="chev" size={16} />
              </Link>
              <Link href="/confidentialite" className={ui.switchRow} onClick={onClose}>
                <span className={ui.switchLabel}>Tes données</span>
                <Icon name="chev" size={16} />
              </Link>
              <button
                type="button"
                className={`${ui.switchRow} ${styles.danger}`}
                onClick={() => void leave()}
                disabled={leaving}
              >
                <span className={ui.switchLabel}>
                  {leaving ? "Déconnexion…" : "Me déconnecter"}
                </span>
                <Icon name="logout" size={18} />
              </button>
            </>
          ) : (
            <>
              <Link href="/compte" className={ui.switchRow} onClick={onClose}>
                <span className={ui.switchLabel}>
                  Créer mon compte
                  <span className={ui.switchSub}>Pour garder tes cartes</span>
                </span>
                <Icon name="chev" size={16} />
              </Link>
              <Link href="/confidentialite" className={ui.switchRow} onClick={onClose}>
                <span className={ui.switchLabel}>Tes données</span>
                <Icon name="chev" size={16} />
              </Link>
            </>
          )}
        </div>
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>
      <p className={styles.footnote}>Leximon · contact@leximon.fr</p>
    </Dialog>
  );
}
