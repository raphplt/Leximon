"use client";

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
  GOOGLE_OR,
  GOOGLE_QUERY,
  googleReturn,
  NEWS_OPT_IN,
  needsConfirmation,
  needsNewCode,
  SIGN_IN_QUERY,
  sendErrorMessage,
} from "@leximon/view-model";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { forgetArrival } from "@/beta/arrival";
import { packOf } from "@/booster/pack-looks";
import { useCatalog } from "@/cards/use-catalog";
import { CollectionSeal } from "@/components/collection-seal";
import { Select, type SelectOption } from "@/components/select";
import { api } from "@/lib/api";
import { usePackShape } from "@/lib/use-pack-shape";
import { forgetProgress } from "@/progress/use-progress";
import { Icon } from "@/ui/icon";
import { Switch } from "@/ui/switch";
import { Segmented } from "@/ui/tabs";
import ui from "@/ui/ui.module.css";
import styles from "./account-screen.module.css";
import { GoogleButton } from "./google-button";
import { forgetPendingCode, keepPendingCode, readPendingCode } from "./pending-code";
import { keepLastEmail, noteSignedIn, readLastEmail } from "./sign-in-memory";

type Step =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | {
      readonly kind: "member";
      readonly email: string;
      readonly isAdmin: boolean;
      readonly withGoogle: boolean;
    }
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

/** The account screen on either tab: the intent lives in the address. */
function accountPath(intent: AccountIntent): string {
  return intent === "signin" ? `/compte?${SIGN_IN_QUERY}` : "/compte";
}

/** Signed in, by code or Google: what the browser keeps is reset, then back to the game. */
async function finishSignIn(
  { email, justJoined }: { readonly email: string; readonly justJoined: boolean },
  newsOptIn: boolean,
): Promise<void> {
  forgetPendingCode();
  forgetArrival();
  if (newsOptIn) {
    // Missing consent is the safe failure: the player can still tick it in their account.
    await api.setEmailPreferences({ newsOptIn: true, source: "signup" }).catch(() => undefined);
  }
  forgetProgress();
  keepLastEmail(email);
  noteSignedIn(justJoined ? "joined" : "back");
  // Straight back to the game, with a full load: every screen then reads the account afresh.
  window.location.assign("/jouer");
}

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
  // Kept in the address, so that the menu's « Se connecter » works from this screen too.
  const router = useRouter();
  const intent: AccountIntent = useSearchParams().has(SIGN_IN_QUERY) ? "signin" : "signup";
  // Ticked on the address form: given once the session exists, never assumed.
  const [newsOptIn, setNewsOptIn] = useState(false);

  const load = useCallback(async () => {
    /** Back from the mail app with a code still valid: straight to the code. */
    const resumeOrStart = (): Step => {
      const pending = readPendingCode(Date.now());
      if (pending === null) return { kind: "email" };
      setNewsOptIn(pending.newsOptIn);
      return { kind: "code", email: pending.email };
    };
    /** Back from Google without signing in: says why, and drops the reason from the address. */
    const afterGoogle = (error: string, cards: string | null, intent: AccountIntent): Step => {
      const back = googleReturn(error, cards);
      router.replace(accountPath(back.kind === "no_account" ? "signup" : intent), {
        scroll: false,
      });
      switch (back.kind) {
        case "cancelled":
          return { kind: "email" };
        case "no_account":
          setNotice(back.notice);
          return { kind: "email" };
        case "guest_loss":
          return { kind: "googleLoss", step: back.step };
        case "error":
          setError(back.message);
          return { kind: "email" };
      }
    };
    const query = new URLSearchParams(window.location.search);
    const googleError = query.get(GOOGLE_QUERY.error);
    const guestStep = (): Step =>
      googleError === null
        ? resumeOrStart()
        : afterGoogle(
            googleError,
            query.get(GOOGLE_QUERY.cards),
            query.has(SIGN_IN_QUERY) ? "signin" : "signup",
          );
    setStep({ kind: "loading" });
    try {
      const account = await api.fetchAccount();
      if (account.kind === "member" && query.has(GOOGLE_QUERY.done)) {
        await finishSignIn(account, query.has(GOOGLE_QUERY.news));
      } else if (account.kind === "member") {
        forgetPendingCode();
        setStep({
          kind: "member",
          email: account.email,
          isAdmin: account.isAdmin,
          withGoogle: account.withGoogle,
        });
      } else setStep(guestStep());
    } catch (error) {
      // No guest can start here without an invitation: signing in to an account still works.
      setStep(error instanceof BetaClosedError ? guestStep() : { kind: "failed" });
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one request at a time, showing its error (or the network's) below the form. */
  const run = async (action: () => Promise<void>) => {
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
      if (result.kind === "sent") {
        keepPendingCode({ email, newsOptIn }, Date.now());
        go({ kind: "code", email });
      } else setError(sendErrorMessage(result.reason));
    });

  const checkCode = (email: string, code: string) =>
    run(async () => {
      const result = await api.previewSignIn(email, code);
      if (result.kind !== "ok") showCodeError(result.reason, email);
      else if (needsConfirmation(result)) go({ kind: "confirm", email, code, preview: result });
      else await signIn(email, code, result, false);
    });

  const confirm = (
    email: string,
    code: string,
    preview: LinkPreviewResponse,
    ageConfirmed: boolean,
    ageBracket: AgeBracket | null,
  ) => run(() => signIn(email, code, preview, ageConfirmed, ageBracket));

  const signIn = async (
    email: string,
    code: string,
    preview: LinkPreviewResponse,
    ageConfirmed: boolean,
    ageBracket: AgeBracket | null = null,
  ) => {
    const result = await api.signInWithCode({
      email,
      otp: code,
      ...(ageConfirmed ? { ageConfirmed: true } : {}),
      ...(ageBracket === null ? {} : { ageBracket }),
      ...(preview.outcome === "abandon" ? { acceptGuestLoss: true } : {}),
    });
    if (result.kind === "signed_in") {
      // Whether the account is new is the server's to say; a failed read only loses the welcome.
      const account = await api.fetchAccount().catch(() => null);
      const justJoined = account?.kind === "member" && account.justJoined;
      await finishSignIn({ email, justJoined }, newsOptIn);
    } else showCodeError(result.code, email);
  };

  /** Off to Google; its redirect comes back to this screen, signed in or with the reason. */
  const leaveForGoogle = (signUp: boolean, declared: GoogleDeclarations, news = false) =>
    run(async () => {
      const origin = window.location.origin;
      const done = new URLSearchParams({ [GOOGLE_QUERY.done]: "1" });
      if (news) done.set(GOOGLE_QUERY.news, "1");
      const url = await api.startGoogleSignIn({
        signUp,
        callbackURL: `${origin}/compte?${done}`,
        errorCallbackURL: `${origin}${accountPath(signUp ? "signup" : "signin")}`,
        declared,
      });
      window.location.assign(url);
    });

  const showCodeError = (reason: CodeError, email: string) => {
    if (needsNewCode(reason)) setStep({ kind: "code", email });
    setError(codeErrorMessage(reason));
  };

  const leave = () =>
    run(async () => {
      await api.signOut();
      // A full load on the home page: the game, if played again, starts a new guest from scratch.
      window.location.assign("/");
    });

  return (
    <main className={styles.screen}>
      <BackButton />
      <header className={styles.header}>
        <Crest />
        <p className={styles.kicker}>Ton compte</p>
        <h1 className={`${styles.title} ${ui.lettered}`}>{titleOf(step, intent)}</h1>
      </header>

      {step.kind === "loading" && <p className={styles.hint}>Un instant…</p>}

      {step.kind === "failed" && (
        <div className={`${styles.panel} ${ui.leaf}`}>
          <p className={styles.hint}>Le serveur ne répond pas.</p>
          <button
            type="button"
            className={`${styles.secondary} ${ui.paperToy}`}
            onClick={() => void load()}
          >
            Réessayer
          </button>
        </div>
      )}

      {step.kind === "member" && (
        <>
          <div className={`${styles.panel} ${ui.leaf}`}>
            <p className={styles.text}>
              Connecté avec <strong className={styles.email}>{step.email}</strong>
              {step.withGoogle ? ` ${BY_GOOGLE}` : ""}.
            </p>
            <NewsToggle />
            <Link href="/jouer" className={`${styles.primary} ${ui.goldToy}`}>
              Retour au jeu
            </Link>
            {step.isAdmin && (
              <Link href="/admin" className={`${styles.secondary} ${ui.paperToy}`}>
                Administration
              </Link>
            )}
          </div>
          <button
            type="button"
            className={`${styles.link} ${styles.leave}`}
            disabled={busy}
            onClick={leave}
          >
            {busy ? "Un instant…" : "Me déconnecter"}
          </button>
        </>
      )}

      {step.kind === "email" && (
        <EmailForm
          intent={intent}
          onIntent={(next) => {
            router.replace(accountPath(next), { scroll: false });
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
      )}

      {step.kind === "googleAge" && (
        <GoogleAge
          busy={busy}
          newsOptIn={newsOptIn}
          onNewsOptIn={setNewsOptIn}
          onLeave={(ageBracket) =>
            void leaveForGoogle(
              true,
              { ageConfirmed: true, ...(ageBracket === null ? {} : { ageBracket }) },
              newsOptIn,
            )
          }
          onCancel={() => go({ kind: "email" })}
        />
      )}

      {step.kind === "googleLoss" && (
        <GoogleLoss
          step={step.step}
          busy={busy}
          onConfirm={() => void leaveForGoogle(false, { acceptGuestLoss: true })}
          onCancel={() => go({ kind: "email" })}
        />
      )}

      {step.kind === "code" && (
        <CodeForm
          email={step.email}
          busy={busy}
          onSubmit={(code) => void checkCode(step.email, code)}
          onResend={() => void sendCode(step.email)}
          onChangeEmail={() => {
            forgetPendingCode();
            go({ kind: "email" });
          }}
        />
      )}

      {step.kind === "confirm" && (
        <Confirm
          preview={step.preview}
          intent={intent}
          busy={busy}
          onConfirm={(ageConfirmed, ageBracket) =>
            void confirm(step.email, step.code, step.preview, ageConfirmed, ageBracket)
          }
          onCancel={() => {
            forgetPendingCode();
            go({ kind: "email" });
          }}
        />
      )}

      <p className={styles.error} role="alert">
        {error}
      </p>
    </main>
  );
}

/**
 * The collections' gold seals fanned over the page, the first in front: what an account keeps.
 * Its room is held while the catalogue loads, so the form does not move when they come.
 */
function Crest() {
  const collections = useCatalog()?.collections ?? [];
  const [front, ...others] = collections;
  const sides = others.slice(0, 2);
  return (
    <div className={styles.crest} aria-hidden="true">
      {sides.map((collection, index) => (
        <span
          key={collection.id}
          className={styles.sideSeal}
          data-side={index === 0 ? "left" : "right"}
        >
          <CollectionSeal collection={packOf(collection)} size={84} />
        </span>
      ))}
      {front !== undefined && (
        <span className={styles.frontSeal}>
          <CollectionSeal collection={packOf(front)} size={118} />
        </span>
      )}
    </div>
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

/** Whether this API offers Google: hidden until it says so. */
function useGoogleSignIn(): boolean {
  const [offered, setOffered] = useState(false);
  useEffect(() => {
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
  const id = useId();
  const words = emailStep(intent);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(email.trim().toLowerCase());
  };
  return (
    <form className={`${styles.panel} ${ui.leaf}`} onSubmit={submit}>
      <Segmented
        label="Ce que tu veux faire"
        options={ACCOUNT_INTENTS}
        value={intent}
        onChange={onIntent}
      />
      {notice !== null && <p className={styles.notice}>{notice}</p>}
      <p className={styles.text}>{words.text}</p>
      {google && (
        <>
          <GoogleButton busy={busy} onClick={onGoogle} />
          <p className={styles.or}>{GOOGLE_OR}</p>
        </>
      )}
      <label htmlFor={id} className={styles.label}>
        Ton adresse e-mail
      </label>
      <input
        id={id}
        className={`${styles.input} ${ui.paperField}`}
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      {words.asksNews && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={newsOptIn}
            onChange={(event) => onNewsOptIn(event.target.checked)}
          />
          <span>{NEWS_OPT_IN}</span>
        </label>
      )}
      <button
        type="submit"
        className={`${styles.primary} ${ui.goldToy}`}
        disabled={busy || email.trim() === ""}
      >
        {busy ? "Envoi…" : "Recevoir un code"}
      </button>
      <p className={styles.how}>{words.how}</p>
    </form>
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

  if (value === null && !failed) return null;
  return (
    <>
      {value !== null && (
        <Switch label={NEWS_OPT_IN} checked={value} onChange={(next) => void change(next)} />
      )}
      {failed && <p className={styles.hint}>Le réglage n'a pas été enregistré. Réessaie.</p>}
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
  const id = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(code);
  };
  return (
    <form className={`${styles.panel} ${ui.leaf}`} onSubmit={submit}>
      <p className={styles.text}>
        Code envoyé à <strong className={styles.email}>{email}</strong>.
      </p>
      <label htmlFor={id} className={styles.label}>
        Ton code
      </label>
      <input
        id={id}
        className={`${styles.input} ${ui.paperField} ${styles.code}`}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
      />
      <button
        type="submit"
        className={`${styles.primary} ${ui.goldToy}`}
        disabled={busy || code.length !== 6}
      >
        {busy ? "Vérification…" : "Valider le code"}
      </button>
      <div className={styles.links}>
        <button type="button" className={styles.link} disabled={busy} onClick={onResend}>
          Renvoyer un code
        </button>
        <button type="button" className={styles.link} disabled={busy} onClick={onChangeEmail}>
          Changer d'adresse
        </button>
      </div>
    </form>
  );
}

const AGE_OPTIONS: readonly SelectOption<AgeBracket | "">[] = [
  { value: "", label: AGE_UNSAID },
  ...AGE_BRACKETS.map((bracket) => ({ value: bracket, label: ageBracketLabel(bracket) })),
];

/** The optional age bracket, as on the code's last step. */
/** Back to the game screen the player came from; a page opened from a link has none, so Jouer. */
function BackButton() {
  const router = useRouter();
  const back = () => {
    const [arrival] = performance.getEntriesByType("navigation");
    const openedHere = arrival !== undefined && new URL(arrival.name).pathname === "/compte";
    if (openedHere) router.push("/jouer");
    else router.back();
  };
  return (
    <button
      type="button"
      className={`${styles.back} ${ui.round}`}
      aria-label="Retour"
      onClick={back}
    >
      <Icon name="back" size={20} />
    </button>
  );
}

function AgeBracketField({
  value,
  onChange,
}: {
  readonly value: AgeBracket | null;
  readonly onChange: (value: AgeBracket | null) => void;
}) {
  return (
    <>
      <span className={styles.label}>Ta tranche d'âge (facultatif)</span>
      <Select
        className={styles.ageSelect ?? ""}
        ariaLabel="Ta tranche d'âge (facultatif)"
        value={value ?? ""}
        options={AGE_OPTIONS}
        onChange={(next) => onChange(next === "" ? null : next)}
      />
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
    <label className={styles.check}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        J'ai 15 ans ou plus et j'accepte les{" "}
        <Link href="/conditions" target="_blank">
          conditions d'utilisation
        </Link>
      </span>
    </label>
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
    <div className={`${styles.panel} ${ui.leaf}`}>
      <p className={styles.text}>{GOOGLE_AGE_TEXT}</p>
      <AgeBracketField value={ageBracket} onChange={setAgeBracket} />
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={newsOptIn}
          onChange={(event) => onNewsOptIn(event.target.checked)}
        />
        <span>{NEWS_OPT_IN}</span>
      </label>
      <AgeCheck checked={ageConfirmed} onChange={setAgeConfirmed} />
      <GoogleButton busy={busy} disabled={!ageConfirmed} onClick={() => onLeave(ageBracket)} />
      <button type="button" className={styles.link} disabled={busy} onClick={onCancel}>
        Retour
      </button>
    </div>
  );
}

/** Back from Google to an account that plays: the guest's game is lost only if the player says so. */
function GoogleLoss({
  step,
  busy,
  onConfirm,
  onCancel,
}: {
  readonly step: GoogleLossStep;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className={`${styles.panel} ${ui.leaf}`}>
      <p className={styles.text}>{step.text}</p>
      {step.warning !== null && <p className={styles.warning}>{step.warning}</p>}
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.primary} ${ui.goldToy}`}
          disabled={busy}
          onClick={onCancel}
        >
          Garder ma partie
        </button>
        <button
          type="button"
          className={`${styles.secondary} ${ui.paperToy}`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Un instant…" : step.confirmLabel}
        </button>
      </div>
    </div>
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
  const { noun } = usePackShape();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageBracket, setAgeBracket] = useState<AgeBracket | null>(null);
  const step = confirmStep(preview, noun, intent);
  const ready = !busy && (!step.needsAge || ageConfirmed);
  if (step.closed) {
    return (
      <div className={`${styles.panel} ${ui.leaf}`}>
        <h2 className={styles.subtitle}>{step.title}</h2>
        <p className={styles.text}>{step.text}</p>
        <button
          type="button"
          className={`${styles.secondary} ${ui.paperToy}`}
          disabled={busy}
          onClick={onCancel}
        >
          Changer d'adresse
        </button>
      </div>
    );
  }
  return (
    <div className={`${styles.panel} ${ui.leaf}`}>
      <h2 className={styles.subtitle}>{step.title}</h2>
      <p className={styles.text}>{step.text}</p>
      {step.warning !== null && <p className={styles.warning}>{step.warning}</p>}
      {step.needsAge && <AgeBracketField value={ageBracket} onChange={setAgeBracket} />}
      {step.needsAge && <AgeCheck checked={ageConfirmed} onChange={setAgeConfirmed} />}
      {step.acceptsLoss ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.primary} ${ui.goldToy}`}
            disabled={busy}
            onClick={onCancel}
          >
            Garder ma partie
          </button>
          <button
            type="button"
            className={`${styles.secondary} ${ui.paperToy}`}
            disabled={busy}
            onClick={() => onConfirm(false, null)}
          >
            {busy ? "Connexion…" : step.confirmLabel}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={`${styles.primary} ${ui.goldToy}`}
            disabled={!ready}
            onClick={() => onConfirm(ageConfirmed, ageBracket)}
          >
            {busy ? "Un instant…" : step.confirmLabel}
          </button>
          <button type="button" className={styles.link} disabled={busy} onClick={onCancel}>
            Changer d'adresse
          </button>
        </>
      )}
    </div>
  );
}
