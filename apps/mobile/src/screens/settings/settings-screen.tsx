import type { PlayerBadge, Preferences } from "@leximon/contract";
import { ApiError } from "@leximon/contract/client";
import {
  blockedCountLabel,
  blockRefusalMessage,
  DELETE_ACCOUNT_ADMIN,
  DELETE_ACCOUNT_CANCEL,
  DELETE_ACCOUNT_CONFIRM,
  DELETE_ACCOUNT_WARNING,
  deleteAccountLabel,
  playerName,
  pseudoSettingLabel,
  publicProfileDetail,
  SIGN_IN_QUERY,
  UNBLOCKED_TOAST,
} from "@leximon/view-model";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api } from "@/api/client";
import { WEB_URL } from "@/config";
import { type FeedbackKind, readPreference, writePreference } from "@/feedback/feedback";
import { playFromScratch } from "@/player/session";
import { useShared } from "@/player/shared";
import { account, profile } from "@/player/state";
import { useProfileActions } from "@/profile/profile-actions";
import { forgetLastEmail } from "@/screens/account/last-email";
import { PseudoSheet } from "@/screens/profile/pseudo-sheet";
import { colors, fontSizes, fonts, paperColors, space, switchColors } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { BindingRule, ORNAMENT_PADDING } from "@/ui/ornaments";
import { FormError, Page, Paragraph } from "@/ui/page";
import { Sheet } from "@/ui/sheet";
import { toast } from "@/ui/toast";
import { Leaf } from "@/ui/toy";

function failureMessage(error: unknown): string {
  return error instanceof ApiError && error.status === null
    ? "Pas de connexion. Réessaie."
    : "Ça n'a pas marché. Réessaie.";
}

/** « r••••@gmail.com »: enough to recognize the address, not to read it over a shoulder. */
function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}••••@${domain}`;
}

function openWebPage(path: string): void {
  void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);
}

type SheetName = "pseudo" | "blocks" | "delete" | null;

/**
 * Settings: sound and vibration, kept on the phone; notifications, e-mails and the profile's
 * openness, kept on the server; the account.
 */
export function SettingsScreen() {
  const who = useShared(account);
  const me = useShared(profile);
  const profileActions = useProfileActions();
  const [notify, setNotify] = useState<Preferences | null>(null);
  const [blocked, setBlocked] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<FeedbackKind, boolean>>(() => ({
    sound: readPreference("sound"),
    speech: readPreference("speech"),
    haptics: readPreference("haptics"),
  }));
  const member = who?.kind === "member";

  const toggleFeedback = (kind: FeedbackKind, enabled: boolean) => {
    writePreference(kind, enabled);
    setFeedback((current) => ({ ...current, [kind]: enabled }));
  };

  useEffect(() => {
    api
      .fetchPreferences()
      .then(setNotify)
      .catch(() => setNotify(null));
  }, []);

  useEffect(() => {
    if (!member) return;
    api
      .fetchBlocks()
      .then((players) => setBlocked(players.length))
      .catch(() => setBlocked(null));
  }, [member]);

  const toggleNotify = async (key: keyof Preferences, enabled: boolean) => {
    if (notify === null) return;
    const before = notify;
    setNotify({ ...notify, [key]: enabled });
    setError(null);
    try {
      setNotify(await api.updatePreferences({ [key]: enabled }));
    } catch (caught) {
      setNotify(before);
      setError(failureMessage(caught));
    }
  };

  return (
    <Page title="Réglages">
      <Group title="JEU">
        <Toggle label="Son" value={feedback.sound} onChange={(on) => toggleFeedback("sound", on)} />
        {feedback.sound && (
          <Toggle
            label="Prononciation des mots"
            detail="Le mot est lu quand sa carte apparaît"
            value={feedback.speech}
            onChange={(on) => toggleFeedback("speech", on)}
          />
        )}
        <Toggle
          label="Vibration"
          value={feedback.haptics}
          onChange={(on) => toggleFeedback("haptics", on)}
        />
      </Group>

      {notify !== null && (
        <Group title="NOTIFICATIONS">
          <Toggle
            label="Mots à réviser"
            detail="Quand un mot attend sa révision"
            value={notify.notifyReviews}
            onChange={(on) => void toggleNotify("notifyReviews", on)}
          />
          <Toggle
            label="Offres d'échange"
            value={notify.notifyTrades}
            onChange={(on) => void toggleNotify("notifyTrades", on)}
          />
          <Toggle
            label="Discussion du clan"
            detail="Seulement quand on te cite"
            value={notify.notifyClanMentions}
            onChange={(on) => void toggleNotify("notifyClanMentions", on)}
          />
          <Toggle
            label="Joutes"
            detail="Quand un joueur te lance une joute"
            value={notify.notifyJousts}
            onChange={(on) => void toggleNotify("notifyJousts", on)}
          />
        </Group>
      )}

      {member && notify !== null && (
        <Group title="E-MAILS">
          <Toggle
            label="Courrier non lu"
            detail="Un e-mail si tu ne viens pas le lire"
            value={notify.emailNews}
            onChange={(on) => void toggleNotify("emailNews", on)}
          />
          <Toggle
            label="Stock de sachets plein"
            detail="Un rappel quand tu t'absentes"
            value={notify.emailReminders}
            onChange={(on) => void toggleNotify("emailReminders", on)}
          />
        </Group>
      )}

      {member && me !== null && (
        <Group title="PROFIL">
          <Toggle
            label="Profil public"
            detail={publicProfileDetail(me)}
            value={me.profilePublic}
            onChange={(on) =>
              void profileActions.update(
                { profilePublic: on },
                { success: on ? "Profil visible." : "Profil caché." },
              )
            }
          />
          <Row
            label="Pseudo"
            detail={pseudoSettingLabel(me.pseudo)}
            onPress={() => setSheet("pseudo")}
          />
          {notify !== null && (
            <>
              <Toggle
                label="Demandes d'ami"
                detail={
                  notify.friendRequestsOpen ? "Tout le monde" : "Seulement par ton lien d'ami"
                }
                value={notify.friendRequestsOpen}
                onChange={(on) => void toggleNotify("friendRequestsOpen", on)}
              />
              <Toggle
                label="Montrer mes trouvailles à mes amis"
                detail="Tes Épiques et Légendaires, tes mots à la Dorure, tes niveaux"
                value={notify.shareFinds}
                onChange={(on) => void toggleNotify("shareFinds", on)}
              />
            </>
          )}
          <Row
            label="Joueurs bloqués"
            detail={blocked === null ? null : blockedCountLabel(blocked)}
            onPress={() => setSheet("blocks")}
          />
        </Group>
      )}

      {/* The showcase of the pieces, for whoever builds the game. */}
      {__DEV__ && (
        <Group title="LA BIBLIOTHÈQUE">
          <Row label="Planches de la Bibliothèque" onPress={() => router.push("/planches")} />
        </Group>
      )}

      <Group title="COMPTE">
        {who?.kind === "member" ? (
          <>
            <Row
              label="Adresse e-mail"
              detail={maskEmail(who.email)}
              onPress={() => router.push("/compte")}
            />
            <Row label="Tes données" onPress={() => openWebPage("/confidentialite")} />
            <Row label="Supprimer mon compte" danger onPress={() => setSheet("delete")} />
          </>
        ) : (
          <>
            <Row
              label="Créer mon compte"
              detail="Pour garder tes cartes"
              onPress={() => router.push("/compte")}
            />
            <Row
              label="Me connecter"
              detail="Pour retrouver ta collection"
              onPress={() => router.push({ pathname: "/compte", params: { [SIGN_IN_QUERY]: "1" } })}
            />
            <Row label="Tes données" onPress={() => openWebPage("/confidentialite")} />
          </>
        )}
      </Group>
      <FormError message={error} />

      <Text style={styles.footnote}>
        <Text style={styles.link} onPress={() => openWebPage("/mentions")}>
          Contact et mentions
        </Text>
        {" · "}
        <Text style={styles.link} onPress={() => openWebPage("/conditions")}>
          Conditions
        </Text>
        {" · "}
        <Text style={styles.link} onPress={() => router.push("/nouveautes")}>
          Nouveautés
        </Text>
        {" · contact@leximon.fr"}
      </Text>

      <PseudoSheet open={sheet === "pseudo"} onClose={() => setSheet(null)} />
      <BlocksSheet open={sheet === "blocks"} onClose={() => setSheet(null)} onCount={setBlocked} />
      <DeleteAccountSheet open={sheet === "delete"} onClose={() => setSheet(null)} />
    </Page>
  );
}

function Group({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.kicker}>{title}</Text>
      <Leaf style={styles.leafRows}>
        <BindingRule />
        {children}
      </Leaf>
    </View>
  );
}

function Toggle({
  label,
  detail,
  value,
  onChange,
}: {
  readonly label: string;
  readonly detail?: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        {detail !== undefined && <Text style={styles.detail}>{detail}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: switchColors.off, true: switchColors.on }}
        thumbColor={switchColors.knob}
      />
    </View>
  );
}

function Row({
  label,
  detail = null,
  danger = false,
  onPress,
}: {
  readonly label: string;
  readonly detail?: string | null;
  readonly danger?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, danger && styles.danger]}>{label}</Text>
        {detail !== null && <Text style={styles.detail}>{detail}</Text>}
      </View>
      <Icon name="chev" size={16} color={danger ? ink.danger : ink.pageInkMuted} />
    </Pressable>
  );
}

/** The players the player blocked, each one unblocked with a tap. */
function BlocksSheet({
  open,
  onClose,
  onCount,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCount: (count: number) => void;
}) {
  const [players, setPlayers] = useState<readonly PlayerBadge[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlayers(null);
    api
      .fetchBlocks()
      .then((list) => {
        setPlayers(list);
        onCount(list.length);
      })
      .catch((error: unknown) => toast(failureMessage(error)));
  }, [open, onCount]);

  const unblock = async (player: PlayerBadge) => {
    setBusy(true);
    try {
      const result = await api.setBlocked(player.code, false);
      if (result.kind === "refused") {
        toast(blockRefusalMessage(result.reason));
        return;
      }
      const rest = (players ?? []).filter((p) => p.code !== player.code);
      setPlayers(rest);
      onCount(rest.length);
      toast(UNBLOCKED_TOAST);
    } catch (error) {
      toast(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Joueurs bloqués" onClose={onClose}>
      {players === null ? (
        <Paragraph muted>Un instant…</Paragraph>
      ) : players.length === 0 ? (
        <Paragraph muted>Aucun joueur bloqué.</Paragraph>
      ) : (
        players.map((player) => (
          <View key={player.code} style={styles.blocked}>
            <Avatar avatar={player.avatar} frame={player.frame} size={40} />
            <Text style={[styles.label, styles.rowText]}>{playerName(player)}</Text>
            <Button
              label="Débloquer"
              secondary
              disabled={busy}
              onPress={() => void unblock(player)}
            />
          </View>
        ))
      )}
    </Sheet>
  );
}

/**
 * Deleting the account: erased at once, for good. Two steps: the button that names what goes,
 * then the confirmation.
 */
function DeleteAccountSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const me = useShared(profile);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirming(false);
    setError(null);
  }, [open]);

  const erase = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.deleteAccount();
      if (result.kind === "refused") {
        setError(DELETE_ACCOUNT_ADMIN);
        setBusy(false);
        return;
      }
      // The session died with the account: drop the cookie the phone still keeps.
      await api.signOut().catch(() => undefined);
      forgetLastEmail();
      onClose();
      playFromScratch();
    } catch (caught) {
      setError(failureMessage(caught));
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Supprimer mon compte" onClose={onClose}>
      <Text style={styles.warning}>{DELETE_ACCOUNT_WARNING}</Text>
      {confirming ? (
        <>
          <Button
            danger
            label={busy ? "Effacement…" : DELETE_ACCOUNT_CONFIRM}
            disabled={busy}
            onPress={() => void erase()}
          />
          <Button label={DELETE_ACCOUNT_CANCEL} secondary disabled={busy} onPress={onClose} />
        </>
      ) : (
        <Button
          danger
          label={deleteAccountLabel(me?.stats.words ?? 0)}
          onPress={() => setConfirming(true)}
        />
      )}
      <FormError message={error} />
    </Sheet>
  );
}

/** The rows are read on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  group: { gap: space.s4 },
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: colors.pageInkMuted,
  },
  // The rows keep their own height: the leaf adds only what the binding rule needs.
  leafRows: {
    paddingHorizontal: ORNAMENT_PADDING.binding,
    paddingVertical: ORNAMENT_PADDING.binding - space.s5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    minHeight: 58,
    paddingVertical: space.s5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ink.rule,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: space.s1 },
  label: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  detail: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  danger: { color: ink.danger },
  blocked: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  warning: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.subtitle,
    lineHeight: 25,
    color: ink.pageInk,
  },
  footnote: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 20,
    color: colors.pageInkMuted,
    textAlign: "center",
  },
  link: { textDecorationLine: "underline" },
});
