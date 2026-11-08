import {
  AGE_BRACKETS,
  type AgeBracket,
  type GoogleDeclarations,
  type LinkPreviewResponse,
} from "@leximon/contract";
import { BetaClosedError } from "@leximon/contract/client";
import {
  ACCOUNT_INTENTS,
  ACCOUNT_TITLES,
  type AccountIntent,
  AGE_UNSAID,
  ageBracketLabel,
  BY_GOOGLE,
  type CodeError,
  type ConfirmStep,
  codeErrorMessage,
  confirmStep,
  emailStep,
  GOOGLE_AGE_TEXT,
  GOOGLE_LINK_BUTTON,
  GOOGLE_LINKED_NOTICE,
  GOOGLE_OR,
  googleLinkError,
  googleReturn,
  NEWS_OPT_IN,
  needsConfirmation,
  needsNewCode,
  PACK_NOUNS,
  SIGN_IN_QUERY,
  sendErrorMessage,
  signedInToast,
  signedInWay,
} from "@leximon/view-model";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Svg from "react-native-svg";
import { api } from "@/api/client";
import { linkGoogle, signInWithGoogle } from "@/api/google-sign-in";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { WEB_URL } from "@/config";
import { playFromScratch } from "@/player/session";
import { Seal } from "@/screens/play/sachet-face";
import { asIs, dimmed } from "@/screens/play/sachet-paint";
import { alpha, fontSizes, fonts, paperColors, space, switchColors } from "@/theme";
import { Button } from "@/ui/button";
import { Check } from "@/ui/check";
import { FormError, Page, Paragraph } from "@/ui/page";
import { OnPaper } from "@/ui/panel";
import { Segmented } from "@/ui/segmented";
import { TextButton } from "@/ui/text-button";
import { TextField } from "@/ui/text-field";
import { toast } from "@/ui/toast";
import { GoogleButton } from "./google-button";
import { keepLastEmail, readLastEmail } from "./last-email";

type Step =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "member"; readonly email: string; readonly withGoogle: boolean }
  | { readonly kind: "email" }
  /** « J'ai 15 ans ou plus », asked before leaving for Google to create an account. */
  | { readonly kind: "googleAge" }
  /** Back from Google: the account plays already, the guest's game would be lost. */
  | { readonly kind: "googleLoss"; readonly step: GoogleLossStep }
  | { readonly kind: "code"; readonly email: string }
  | {
      readonly kind: "confirm";
      readonly email: string;
      readonly code: string;
      readonly preview: LinkPreviewResponse;
    };

type GoogleLossStep = Omit<ConfirmStep, "closed" | "needsAge">;

const OFFLINE = "Pas de connexion. Réessaie.";

/** The game shows sachets on the phone. */
const NOUN = PACK_NOUNS.sachet;

/**
 * Signing up or in with a code sent by e-mail, or with Google. One flow for both with a code:
 * whether the address has an account is only told once the code is checked, so that nobody learns
 * it without the mailbox.
 */
export function AccountScreen() {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  // Said above the form, not as an error: where Google's return left the player.
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const google = useGoogleSignIn();
  // Kept in the route's params, so that a « Me connecter » works from this screen too.
  const intent: AccountIntent =
    useLocalSearchParams()[SIGN_IN_QUERY] !== undefined ? "signin" : "signup";
  // Ticked on the address form: given once the session exists, never assumed.
  const [newsOptIn, setNewsOptIn] = useState(false);

  const load = useCallback(async () => {
    setStep({ kind: "loading" });
    try {
      const account = await api.fetchAccount();
      setStep(
        account.kind === "member"
          ? { kind: "member", email: account.email, withGoogle: account.withGoogle }
          : { kind: "email" },
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
      keepLastEmail(email);
      await finishSignIn(false);
    } else showCodeError(result.code, email);
  };

  const finishSignIn = async (byGoogle: boolean) => {
    if (newsOptIn) {
      // Missing consent is the safe failure: the player can still tick it in their account.
      await api.setEmailPreferences({ newsOptIn: true, source: "signup" }).catch(() => undefined);
    }
    // Whether the account is new is the server's to say; a failed read only loses the welcome.
    const account = await api.fetchAccount().catch(() => null);
    playFromScratch();
    toast(signedInToast(account?.kind === "member" ? signedInWay(account, byGoogle) : "back"));
  };

  /** Off to Google in the browser; back here signed in, or with the reason it failed. */
  const leaveForGoogle = (signUp: boolean, declared: GoogleDeclarations) =>
    run(async () => {
      const trip = await signInWithGoogle(signUp, declared);
      if (trip.kind === "signed_in") {
        await finishSignIn(true);
        return;
      }
      if (trip.kind === "closed") return;
      const back = googleReturn(trip.error, trip.cards);
      switch (back.kind) {
        case "cancelled":
          go({ kind: "email" });
          return;
        case "no_account":
          router.setParams({ [SIGN_IN_QUERY]: undefined });
          go({ kind: "email" });
          setNotice(back.notice);
          return;
        case "guest_loss":
          go({ kind: "googleLoss", step: back.step });
          return;
        case "error":
          go({ kind: "email" });
          setError(back.message);
      }
    });

  /** Off to Google in the browser to add it to the account; back here linked or not. */
  const addGoogle = (email: string) =>
    run(async () => {
      setNotice(null);
      const trip = await linkGoogle();
      if (trip.kind === "linked") {
        setNotice(GOOGLE_LINKED_NOTICE);
        setStep({ kind: "member", email, withGoogle: true });
      } else if (trip.kind === "refused") setError(googleLinkError(trip.error, email));
    });

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
    <Page kicker="Ton compte" title={titleOf(step, intent)}>
      <Crest />
      {step.kind === "loading" && <Paragraph muted>Un instant…</Paragraph>}

      {step.kind === "failed" && (
        <>
          <Paragraph muted>Le serveur ne répond pas.</Paragraph>
          <Button label="Réessayer" secondary onPress={() => void load()} />
        </>
      )}

      {step.kind === "member" && (
        <OnPaper>
          {notice !== null && <Text style={styles.notice}>{notice}</Text>}
          <Paragraph>
            Connecté avec <Text style={styles.email}>{step.email}</Text>
            {step.withGoogle ? ` ${BY_GOOGLE}` : ""}.
          </Paragraph>
          {google && !step.withGoogle && (
            <GoogleButton
              busy={busy}
              label={GOOGLE_LINK_BUTTON}
              onPress={() => void addGoogle(step.email)}
            />
          )}
          <NewsToggle />
          <Button label="Retour au jeu" onPress={() => router.navigate("/")} />
          <View style={styles.leave}>
            <TextButton
              label={busy ? "Un instant…" : "Me déconnecter"}
              disabled={busy}
              onPress={() => void leave()}
            />
          </View>
        </OnPaper>
      )}

      {step.kind === "email" && (
        <OnPaper>
          <EmailForm
            intent={intent}
            onIntent={(next) => {
              router.setParams({ [SIGN_IN_QUERY]: next === "signin" ? "1" : undefined });
              // The box is only shown to a new account: switching away unticks it.
              if (next === "signin") setNewsOptIn(false);
              setError(null);
              setNotice(null);
            }}
            notice={notice}
            google={google}
            onGoogle={() => {
              setNotice(null);
              if (intent === "signup") go({ kind: "googleAge" });
              else void leaveForGoogle(false, {});
            }}
            busy={busy}
            newsOptIn={newsOptIn}
            onNewsOptIn={setNewsOptIn}
            onSubmit={(email) => void sendCode(email)}
          />
        </OnPaper>
      )}

      {step.kind === "googleAge" && (
        <OnPaper>
          <GoogleAge
            busy={busy}
            newsOptIn={newsOptIn}
            onNewsOptIn={setNewsOptIn}
            onLeave={(ageBracket) =>
              void leaveForGoogle(true, {
                ageConfirmed: true,
                ...(ageBracket === null ? {} : { ageBracket }),
              })
            }
            onCancel={() => go({ kind: "email" })}
          />
        </OnPaper>
      )}

      {step.kind === "googleLoss" && (
        <OnPaper>
          <Paragraph>{step.step.text}</Paragraph>
          {step.step.warning !== null && <Text style={styles.warning}>{step.step.warning}</Text>}
          <Button label="Garder ma partie" disabled={busy} onPress={() => go({ kind: "email" })} />
          <Button
            label={busy ? "Un instant…" : step.step.confirmLabel}
            secondary
            disabled={busy}
            onPress={() => void leaveForGoogle(false, { acceptGuestLoss: true })}
          />
        </OnPaper>
      )}

      {step.kind === "code" && (
        <OnPaper>
          <CodeForm
            email={step.email}
            busy={busy}
            onSubmit={(code) => void checkCode(step.email, code)}
            onResend={() => void sendCode(step.email)}
            onChangeEmail={() => go({ kind: "email" })}
          />
        </OnPaper>
      )}

      {step.kind === "confirm" && (
        <OnPaper>
          <Confirm
            preview={step.preview}
            intent={intent}
            busy={busy}
            onConfirm={(ageConfirmed, ageBracket) =>
              void run(() => signIn(step.email, step.code, step.preview, ageConfirmed, ageBracket))
            }
            onCancel={() => go({ kind: "email" })}
          />
        </OnPaper>
      )}

      <FormError message={error} />
    </Page>
  );
}

/**
 * The collections' gold seals fanned over the page, the first in front: what an account keeps.
 * Its room is held while the catalogue loads, so the form does not move when they come.
 */
function Crest() {
  const [catalog, setCatalog] = useState(catalogInHand);
  useEffect(() => {
    if (catalog !== null) return;
    let live = true;
    loadCatalog()
      .then((loaded) => {
        if (live) setCatalog(loaded);
      })
      // Only a decoration: without the catalogue, the page goes without it.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [catalog]);
  const [front, ...others] = catalog?.collections ?? [];
  return (
    <View
      style={styles.crest}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {others.slice(0, 2).map((collection, index) => (
        <View
          key={collection.id}
          style={[
            styles.sideSeal,
            {
              transform: [
                { translateX: index === 0 ? -72 : 72 },
                { rotate: index === 0 ? "-14deg" : "14deg" },
              ],
            },
          ]}
        >
          <Svg width={78} height={78} viewBox="0 0 120 120">
            <Seal collection={collection} paint={dimmed} />
          </Svg>
        </View>
      ))}
      {front !== undefined && (
        <View style={styles.frontSeal}>
          <Svg width={108} height={108} viewBox="0 0 120 120">
            <Seal collection={front} paint={asIs} />
          </Svg>
        </View>
      )}
    </View>
  );
}

function titleOf(step: Step, intent: AccountIntent): string {
  switch (step.kind) {
    case "member":
    case "code":
    case "confirm":
      return ACCOUNT_TITLES[step.kind];
    case "googleLoss":
      return step.step.title;
    default:
      return emailStep(intent).title;
  }
}

/**
 * Whether Google is offered here: by the API, and on Android only, since the App Store asks for
 * « Se connecter avec Apple » beside it.
 */
function useGoogleSignIn(): boolean {
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let live = true;
    api
      .fetchAppStatus()
      .then((status) => {
        if (live) setOffered(status.googleSignIn);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return offered;
}

function EmailForm({
  intent,
  onIntent,
  notice,
  google,
  onGoogle,
  busy,
  newsOptIn,
  onNewsOptIn,
  onSubmit,
}: {
  readonly intent: AccountIntent;
  readonly onIntent: (intent: AccountIntent) => void;
  readonly notice: string | null;
  readonly google: boolean;
  readonly onGoogle: () => void;
  readonly busy: boolean;
  readonly newsOptIn: boolean;
  readonly onNewsOptIn: (value: boolean) => void;
  readonly onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState(readLastEmail);
  const ready = !busy && email.trim() !== "";
  const words = emailStep(intent);
  const submit = () => {
    if (ready) onSubmit(email.trim().toLowerCase());
  };
  return (
    <>
      <Segmented options={ACCOUNT_INTENTS} value={intent} onChange={onIntent} />
      {notice !== null && <Text style={styles.notice}>{notice}</Text>}
      <Paragraph>{words.text}</Paragraph>
      {google && (
        <>
          <GoogleButton busy={busy} onPress={onGoogle} />
          <View style={styles.or}>
            <View style={styles.orRule} />
            <Text style={styles.orWord}>{GOOGLE_OR}</Text>
            <View style={styles.orRule} />
          </View>
        </>
      )}
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
      {words.asksNews && (
        <Check checked={newsOptIn} onChange={onNewsOptIn}>
          {NEWS_OPT_IN}
        </Check>
      )}
      <Button label={busy ? "Envoi…" : "Recevoir un code"} disabled={!ready} onPress={submit} />
      <Text style={styles.how}>{words.how}</Text>
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
            trackColor={{ false: switchColors.off, true: switchColors.on }}
            thumbColor={switchColors.knob}
          />
        </View>
      )}
      {failed && <Paragraph muted>Le réglage n'a pas été enregistré. Réessaie.</Paragraph>}
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
  intent,
  busy,
  onConfirm,
  onCancel,
}: {
  readonly preview: LinkPreviewResponse;
  readonly intent: AccountIntent;
  readonly busy: boolean;
  readonly onConfirm: (ageConfirmed: boolean, ageBracket: AgeBracket | null) => void;
  readonly onCancel: () => void;
}) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageBracket, setAgeBracket] = useState<AgeBracket | null>(null);
  const step = confirmStep(preview, NOUN, intent);
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
      {step.needsAge && <AgeCheck checked={ageConfirmed} onChange={setAgeConfirmed} />}
      {step.acceptsLoss ? (
        <>
          <Button label="Garder ma partie" disabled={busy} onPress={onCancel} />
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

/** « J'ai 15 ans ou plus », required to create an account. */
function AgeCheck({
  checked,
  onChange,
}: {
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <Check
      checked={checked}
      onChange={onChange}
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
  );
}

/** Before leaving for Google to create an account: what the code asks on its last step. */
function GoogleAge({
  busy,
  newsOptIn,
  onNewsOptIn,
  onLeave,
  onCancel,
}: {
  readonly busy: boolean;
  readonly newsOptIn: boolean;
  readonly onNewsOptIn: (value: boolean) => void;
  readonly onLeave: (ageBracket: AgeBracket | null) => void;
  readonly onCancel: () => void;
}) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageBracket, setAgeBracket] = useState<AgeBracket | null>(null);
  return (
    <>
      <Paragraph>{GOOGLE_AGE_TEXT}</Paragraph>
      <AgeChoice value={ageBracket} onChange={setAgeBracket} />
      <Check checked={newsOptIn} onChange={onNewsOptIn}>
        {NEWS_OPT_IN}
      </Check>
      <AgeCheck checked={ageConfirmed} onChange={setAgeConfirmed} />
      <GoogleButton busy={busy} disabled={!ageConfirmed} onPress={() => onLeave(ageBracket)} />
      <TextButton label="Retour" disabled={busy} onPress={onCancel} />
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
      <Text style={styles.ageLabel}>Ta tranche d'âge (facultatif)</Text>
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

/** The forms and the member's page are read on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  crest: {
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.s4,
  },
  sideSeal: { position: "absolute", top: 22 },
  frontSeal: { position: "absolute", top: 0 },
  how: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.micro,
    textAlign: "center",
    color: ink.pageInkMuted,
  },
  leave: { marginTop: space.s10 },
  email: { fontFamily: fonts.text.medium, color: ink.rubric },
  subtitle: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.titleSmall,
    color: ink.pageInk,
  },
  notice: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInk,
  },
  or: { flexDirection: "row", alignItems: "center", gap: space.s5 },
  orRule: { flex: 1, height: 1, backgroundColor: alpha(ink.pageInkMuted, 0.4) },
  orWord: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  warning: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.danger,
  },
  links: { flexDirection: "row", justifyContent: "space-around", flexWrap: "wrap" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  switchLabel: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    color: ink.pageInk,
  },
  inlineLink: { color: ink.rubric, textDecorationLine: "underline" },
  age: { gap: space.s5 },
  ageLabel: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s4 },
  chip: {
    minHeight: 38,
    paddingHorizontal: space.s7,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: ink.track,
    justifyContent: "center",
  },
  chipOn: { borderColor: ink.gilt, backgroundColor: alpha(ink.gilt, 0.14) },
  chipText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  chipTextOn: { color: ink.rubric },
});
