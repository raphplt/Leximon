import { AGE_BRACKETS, type AgeBracket, type LinkPreviewResponse } from "@leximon/contract";
import { BetaClosedError } from "@leximon/contract/client";
import {
  ACCOUNT_TITLES,
  AGE_UNSAID,
  ageBracketLabel,
  type CodeError,
  codeErrorMessage,
  confirmStep,
  NEWS_OPT_IN,
  needsConfirmation,
  needsNewCode,
  PACK_NOUNS,
  sendErrorMessage,
} from "@leximon/view-model";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api } from "@/api/client";
import { WEB_URL } from "@/config";
import { playFromScratch } from "@/player/session";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Check } from "@/ui/check";
import { FormError, Page, Paragraph } from "@/ui/page";
import { TextButton } from "@/ui/text-button";
import { TextField } from "@/ui/text-field";

type Step =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "member"; readonly email: string }
  | { readonly kind: "email" }
  | { readonly kind: "code"; readonly email: string }
  | {
      readonly kind: "confirm";
      readonly email: string;
      readonly code: string;
      readonly preview: LinkPreviewResponse;
    };

const OFFLINE = "Pas de connexion. Réessaie.";

/** The game shows sachets on the phone. */
const NOUN = PACK_NOUNS.sachet;

/**
 * Signing up or in with a code sent by e-mail. One flow for both: whether the address has
 * an account is only told once the code is checked, so that nobody learns it without the mailbox.
 */
export function AccountScreen() {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Ticked on the address form: given once the session exists, never assumed.
  const [newsOptIn, setNewsOptIn] = useState(false);

  const load = useCallback(async () => {
    setStep({ kind: "loading" });
    try {
      const account = await api.fetchAccount();
      setStep(
        account.kind === "member" ? { kind: "member", email: account.email } : { kind: "email" },
      );
    } catch (error) {
      // No guest can start here without an invitation: signing in to an account still works.
      setStep(error instanceof BetaClosedError ? { kind: "email" } : { kind: "failed" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one request at a time, showing its error (or the network's) below the form. */
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(OFFLINE);
    } finally {
      setBusy(false);
    }
  };

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const sendCode = (email: string) =>
    run(async () => {
      const result = await api.sendSignInCode(email);
      if (result.kind === "sent") go({ kind: "code", email });
      else setError(sendErrorMessage(result.reason));
    });

  const checkCode = (email: string, code: string) =>
    run(async () => {
      const result = await api.previewSignIn(email, code);
      if (result.kind !== "ok") showCodeError(result.reason, email);
      else if (needsConfirmation(result)) go({ kind: "confirm", email, code, preview: result });
      else await signIn(email, code, result, false, null);
    });

  const signIn = async (
    email: string,
    code: string,
    preview: LinkPreviewResponse,
    ageConfirmed: boolean,
    ageBracket: AgeBracket | null,
  ) => {
    const result = await api.signInWithCode({
      email,
      otp: code,
      ...(ageConfirmed ? { ageConfirmed: true } : {}),
      ...(ageBracket === null ? {} : { ageBracket }),
      ...(preview.outcome === "abandon" ? { acceptGuestLoss: true } : {}),
    });
    if (result.kind === "signed_in") {
      if (newsOptIn) {
        // Missing consent is the safe failure: the player can still tick it in their account.
        await api.setEmailPreferences({ newsOptIn: true, source: "signup" }).catch(() => undefined);
      }
      playFromScratch();
    } else showCodeError(result.code, email);
  };

  const showCodeError = (reason: CodeError, email: string) => {
    if (needsNewCode(reason)) setStep({ kind: "code", email });
    setError(codeErrorMessage(reason));
  };

  const leave = () =>
    run(async () => {
      await api.signOut();
      playFromScratch();
    });

  return (
    <Page kicker="Ton compte" title={titleOf(step)}>
      {step.kind === "loading" && <Paragraph muted>Un instant…</Paragraph>}

      {step.kind === "failed" && (
        <>
          <Paragraph muted>Le serveur lambine.</Paragraph>
          <Button label="Réessayer" secondary onPress={() => void load()} />
        </>
      )}

      {step.kind === "member" && (
        <>
          <Paragraph>
            Connecté avec <Text style={styles.email}>{step.email}</Text>.
          </Paragraph>
          <NewsToggle />
          <Button
            label={busy ? "Un instant…" : "Me déconnecter"}
            secondary
            disabled={busy}
            onPress={() => void leave()}
          />
        </>
      )}

      {step.kind === "email" && (
        <EmailForm
          busy={busy}
          newsOptIn={newsOptIn}
          onNewsOptIn={setNewsOptIn}
          onSubmit={(email) => void sendCode(email)}
        />
      )}

      {step.kind === "code" && (
        <CodeForm
          email={step.email}
          busy={busy}
          onSubmit={(code) => void checkCode(step.email, code)}
          onResend={() => void sendCode(step.email)}
          onChangeEmail={() => go({ kind: "email" })}
        />
      )}

      {step.kind === "confirm" && (
        <Confirm
          preview={step.preview}
          busy={busy}
          onConfirm={(ageConfirmed, ageBracket) =>
            void run(() => signIn(step.email, step.code, step.preview, ageConfirmed, ageBracket))
          }
          onCancel={() => go({ kind: "email" })}
        />
      )}

      <FormError message={error} />
    </Page>
  );
}

function titleOf(step: Step): string {
  switch (step.kind) {
    case "member":
    case "code":
    case "confirm":
      return ACCOUNT_TITLES[step.kind];
    default:
      return ACCOUNT_TITLES.email;
  }
}

function EmailForm({
  busy,
  newsOptIn,
  onNewsOptIn,
  onSubmit,
}: {
  readonly busy: boolean;
  readonly newsOptIn: boolean;
  readonly onNewsOptIn: (value: boolean) => void;
  readonly onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const ready = !busy && email.trim() !== "";
  const submit = () => {
    if (ready) onSubmit(email.trim().toLowerCase());
  };
  return (
    <>
      <Paragraph>Sans compte, ta collection reste coincée sur ce téléphone.</Paragraph>
      <TextField
        label="Ton adresse e-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Check checked={newsOptIn} onChange={onNewsOptIn}>
        {NEWS_OPT_IN}
      </Check>
      <Button label={busy ? "Envoi…" : "Recevoir un code"} disabled={!ready} onPress={submit} />
    </>
  );
}

/** The member's consent to news by e-mail, changed at any time. */
function NewsToggle() {
  const [value, setValue] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .fetchEmailPreferences()
      .then((preferences) => {
        if (live) setValue(preferences.newsOptIn);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const change = async (next: boolean) => {
    const previous = value;
    setValue(next);
    setFailed(false);
    try {
      setValue((await api.setEmailPreferences({ newsOptIn: next, source: "settings" })).newsOptIn);
    } catch {
      setValue(previous);
      setFailed(true);
    }
  };

  return (
    <>
      {value !== null && (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{NEWS_OPT_IN}</Text>
          <Switch
            value={value}
            onValueChange={(next) => void change(next)}
            accessibilityLabel={NEWS_OPT_IN}
            trackColor={{ false: colors.track, true: colors.success }}
            thumbColor={colors.text}
          />
        </View>
      )}
      {failed && <Paragraph muted>Pas enregistré. Réessaie.</Paragraph>}
    </>
  );
}

function CodeForm({
  email,
  busy,
  onSubmit,
  onResend,
  onChangeEmail,
}: {
  readonly email: string;
  readonly busy: boolean;
  readonly onSubmit: (code: string) => void;
  readonly onResend: () => void;
  readonly onChangeEmail: () => void;
}) {
  const [code, setCode] = useState("");
  const ready = !busy && code.length === 6;
  const submit = () => {
    if (ready) onSubmit(code);
  };
  return (
    <>
      <Paragraph>
        Code envoyé à <Text style={styles.email}>{email}</Text>.
      </Paragraph>
      <TextField
        label="Ton code"
        large
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Button
        label={busy ? "Vérification…" : "Valider le code"}
        disabled={!ready}
        onPress={submit}
      />
      <View style={styles.links}>
        <TextButton label="Renvoyer un code" disabled={busy} onPress={onResend} />
        <TextButton label="Changer d'adresse" disabled={busy} onPress={onChangeEmail} />
      </View>
    </>
  );
}

function Confirm({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  readonly preview: LinkPreviewResponse;
  readonly busy: boolean;
  readonly onConfirm: (ageConfirmed: boolean, ageBracket: AgeBracket | null) => void;
  readonly onCancel: () => void;
}) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageBracket, setAgeBracket] = useState<AgeBracket | null>(null);
  const step = confirmStep(preview, NOUN);
  const ready = !busy && (!step.needsAge || ageConfirmed);
  if (step.closed) {
    return (
      <>
        <Text style={styles.subtitle}>{step.title}</Text>
        <Paragraph>{step.text}</Paragraph>
        <Button label="Changer d'adresse" secondary disabled={busy} onPress={onCancel} />
      </>
    );
  }
  return (
    <>
      <Text style={styles.subtitle}>{step.title}</Text>
      <Paragraph>{step.text}</Paragraph>
      {step.warning !== null && <Text style={styles.warning}>{step.warning}</Text>}
      {step.needsAge && <AgeChoice value={ageBracket} onChange={setAgeBracket} />}
      {step.needsAge && (
        <Check
          checked={ageConfirmed}
          onChange={setAgeConfirmed}
          label="J'ai 15 ans ou plus et j'accepte les conditions d'utilisation"
        >
          J'ai 15 ans ou plus et j'accepte les{" "}
          <Text
            style={styles.inlineLink}
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/conditions`)}
            accessibilityRole="link"
          >
            conditions d'utilisation
          </Text>
        </Check>
      )}
      {step.acceptsLoss ? (
        <>
          <Button label="Rester en invité" disabled={busy} onPress={onCancel} />
          <Button
            label={busy ? "Connexion…" : step.confirmLabel}
            secondary
            disabled={busy}
            onPress={() => onConfirm(false, null)}
          />
        </>
      ) : (
        <>
          <Button
            label={busy ? "Un instant…" : step.confirmLabel}
            disabled={!ready}
            onPress={() => onConfirm(ageConfirmed, ageBracket)}
          />
          <TextButton label="Changer d'adresse" disabled={busy} onPress={onCancel} />
        </>
      )}
    </>
  );
}

/** The age bracket, optional: one choice among a few, "rather not say" first. */
function AgeChoice({
  value,
  onChange,
}: {
  readonly value: AgeBracket | null;
  readonly onChange: (value: AgeBracket | null) => void;
}) {
  const options: readonly { readonly value: AgeBracket | null; readonly label: string }[] = [
    { value: null, label: AGE_UNSAID },
    ...AGE_BRACKETS.map((bracket) => ({ value: bracket, label: ageBracketLabel(bracket) })),
  ];
  return (
    <View style={styles.age} accessibilityRole="radiogroup">
      <Text style={styles.ageLabel}>Ton âge, si tu veux bien</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.label}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  email: { fontFamily: fonts.text.medium, color: colors.accent },
  subtitle: { fontFamily: fonts.ui.extrabold, fontSize: 20, color: colors.text },
  warning: { fontFamily: fonts.ui.bold, fontSize: 15, lineHeight: 21, color: colors.danger },
  links: { flexDirection: "row", justifyContent: "space-around", flexWrap: "wrap" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchLabel: { flex: 1, fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.text },
  inlineLink: { color: colors.accent, textDecorationLine: "underline" },
  age: { gap: 10 },
  ageLabel: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.track,
    justifyContent: "center",
  },
  chipOn: { borderColor: colors.accent, backgroundColor: "rgba(255, 210, 77, 0.14)" },
  chipText: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.textMuted },
  chipTextOn: { color: colors.accent },
});
