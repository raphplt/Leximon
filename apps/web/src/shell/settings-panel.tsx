"use client";

import type { Preferences } from "@leximon/contract";
import { blockedCountLabel, pseudoSettingLabel } from "@leximon/view-model";
import Link from "next/link";
import { useEffect, useState } from "react";
import { canVibrate, type FeedbackKind, readPreference, writePreference } from "@/booster/feedback";
import { api } from "@/lib/api";
import { account, profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { BlocksDialog } from "@/profile/blocks-dialog";
import { DeleteAccountDialog } from "@/profile/delete-account-dialog";
import { PseudoDialog } from "@/profile/pseudo-dialog";
import { failureMessage, useProfileActions } from "@/profile/use-profile-actions";
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
 * Settings: sound, spoken words and vibration, kept on the device; notifications and e-mails,
 * kept on the server; the profile; the account.
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
  const me = useShared(profile);
  const profileActions = useProfileActions();
  const [notify, setNotify] = useState<Preferences | null>(null);
  const [blocked, setBlockedCount] = useState<number | null>(null);
  const [dialog, setDialog] = useState<"pseudo" | "blocks" | "delete" | null>(null);
  const member = who?.kind === "member";

  useEffect(() => {
    if (!open) return;
    setPrefs({
      sound: readPreference("sound"),
      speech: readPreference("speech"),
      haptics: readPreference("haptics"),
    });
    setVibrates(canVibrate());
    setError(null);
    api
      .fetchPreferences()
      .then(setNotify)
      .catch(() => setNotify(null));
  }, [open]);

  useEffect(() => {
    if (!open || !member) return;
    api
      .fetchBlocks()
      .then((players) => setBlockedCount(players.length))
      .catch(() => setBlockedCount(null));
  }, [open, member]);

  const toggleNotify = async (key: keyof Preferences, enabled: boolean) => {
    if (notify === null) return;
    const before = notify;
    setNotify({ ...notify, [key]: enabled });
    try {
      setNotify(await api.updatePreferences({ [key]: enabled }));
    } catch (caught) {
      setNotify(before);
      setError(failureMessage(caught));
    }
  };

  const toggle = (kind: FeedbackKind, enabled: boolean) => {
    writePreference(kind, enabled);
    setPrefs((current) => (current === null ? current : { ...current, [kind]: enabled }));
  };

  const leave = async () => {
    setLeaving(true);
    try {
      await api.signOut();
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
              {prefs.sound && (
                <Switch
                  label="Mots dits à voix haute"
                  detail="Quand la carte se pose"
                  checked={prefs.speech}
                  onChange={(on) => toggle("speech", on)}
                />
              )}
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
      {notify !== null && (
        <section className={ui.group}>
          <h3 className={ui.kicker}>Notifications</h3>
          <div className={ui.groupRows}>
            <Switch
              label="Mots à réviser"
              detail="Quand un mot attend sa révision"
              checked={notify.notifyReviews}
              onChange={(on) => void toggleNotify("notifyReviews", on)}
            />
            <Switch
              label="Offres d'échange"
              checked={notify.notifyTrades}
              onChange={(on) => void toggleNotify("notifyTrades", on)}
            />
            <Switch
              label="Discussion du clan"
              detail="Seulement quand on te cite"
              checked={notify.notifyClanMentions}
              onChange={(on) => void toggleNotify("notifyClanMentions", on)}
            />
          </div>
        </section>
      )}
      {member && notify !== null && (
        <section className={ui.group}>
          <h3 className={ui.kicker}>E-mails</h3>
          <div className={ui.groupRows}>
            <Switch
              label="Lettres en attente"
              detail="Si tu ne viens pas les lire"
              checked={notify.emailNews}
              onChange={(on) => void toggleNotify("emailNews", on)}
            />
            <Switch
              label="Sachets pleins"
              detail="Si tu t'absentes"
              checked={notify.emailReminders}
              onChange={(on) => void toggleNotify("emailReminders", on)}
            />
          </div>
        </section>
      )}
      {member && me !== null && (
        <section className={ui.group}>
          <h3 className={ui.kicker}>Profil</h3>
          <div className={ui.groupRows}>
            <Switch
              label="Profil public"
              detail={
                me.level < me.publicFromLevel
                  ? `Visible par un lien dès le niveau ${me.publicFromLevel}`
                  : "Visible par un lien"
              }
              checked={me.profilePublic}
              onChange={(on) =>
                void profileActions.update(
                  { profilePublic: on },
                  { success: on ? "Profil visible." : "Profil caché." },
                )
              }
            />
            <button type="button" className={ui.switchRow} onClick={() => setDialog("pseudo")}>
              <span className={ui.switchLabel}>
                Pseudo
                <span className={ui.switchSub}>{pseudoSettingLabel(me.pseudo)}</span>
              </span>
              <Icon name="chev" size={16} />
            </button>
            {notify !== null && (
              <>
                <Switch
                  label="Demandes d'ami"
                  detail={
                    notify.friendRequestsOpen ? "Tout le monde" : "Personne, sauf ton lien d'ami"
                  }
                  checked={notify.friendRequestsOpen}
                  onChange={(on) => void toggleNotify("friendRequestsOpen", on)}
                />
                <Switch
                  label="Montrer mes trouvailles à mes amis"
                  detail="Épiques, Légendaires, Dorures, niveaux"
                  checked={notify.shareFinds}
                  onChange={(on) => void toggleNotify("shareFinds", on)}
                />
              </>
            )}
            <button type="button" className={ui.switchRow} onClick={() => setDialog("blocks")}>
              <span className={ui.switchLabel}>
                Joueurs bloqués
                {blocked !== null && (
                  <span className={ui.switchSub}>{blockedCountLabel(blocked)}</span>
                )}
              </span>
              <Icon name="chev" size={16} />
            </button>
          </div>
        </section>
      )}
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
              <button
                type="button"
                className={`${ui.switchRow} ${styles.danger}`}
                onClick={() => setDialog("delete")}
              >
                <span className={ui.switchLabel}>Supprimer mon compte</span>
                <Icon name="chev" size={16} />
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
      <p className={styles.footnote}>
        <Link href="/mentions" onClick={onClose}>
          Contact et mentions
        </Link>{" "}
        ·{" "}
        <Link href="/conditions" onClick={onClose}>
          Conditions
        </Link>{" "}
        · contact@leximon.fr
      </p>
      <PseudoDialog open={dialog === "pseudo"} onClose={() => setDialog(null)} />
      <BlocksDialog
        open={dialog === "blocks"}
        onClose={() => setDialog(null)}
        onCount={setBlockedCount}
      />
      <DeleteAccountDialog open={dialog === "delete"} onClose={() => setDialog(null)} />
    </Dialog>
  );
}
