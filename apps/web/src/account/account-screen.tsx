"use client";

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
  sendErrorMessage,
} from "@leximon/view-model";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Select, type SelectOption } from "@/components/select";
import { api } from "@/lib/api";
import { usePackShape } from "@/lib/use-pack-shape";
import { forgetProgress } from "@/progress/use-progress";
import { Switch } from "@/ui/switch";
import styles from "./account-screen.module.css";
import { forgetPendingCode, keepPendingCode, readPendingCode } from "./pending-code";

type Step =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "member"; readonly email: string; readonly isAdmin: boolean }
  | { readonly kind: "email" }
  | { readonly kind: "code"; readonly email: string }
  | {
      readonly kind: "confirm";
      readonly email: string;
      readonly code: string;
      readonly preview: LinkPreviewResponse;
    };

const OFFLINE = "Pas de connexion. Réessaie.";

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
    /** Back from the mail app with a code still valid: straight to the code. */
    const resumeOrStart = (): Step => {
      const pending = readPendingCode(Date.now());
      if (pending === null) return { kind: "email" };
      setNewsOptIn(pending.newsOptIn);
      return { kind: "code", email: pending.email };
    };
    setStep({ kind: "loading" });
    try {
      const account = await api.fetchAccount();
      if (account.kind === "member") {
        forgetPendingCode();
        setStep({ kind: "member", email: account.email, isAdmin: account.isAdmin });
      } else setStep(resumeOrStart());
    } catch (error) {
      // No guest can start here without an invitation: signing in to an account still works.
      setStep(error instanceof BetaClosedError ? resumeOrStart() : { kind: "failed" });
    }
  }, []);

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
      forgetPendingCode();
      if (newsOptIn) {
        // Missing consent is the safe failure: the player can still tick it in their account.
        await api.setEmailPreferences({ newsOptIn: true, source: "signup" }).catch(() => undefined);
      }
      forgetProgress();
      // Straight back to the game, with a full load: every screen then reads the account afresh.
      window.location.assign("/jouer");
    } else showCodeError(result.code, email);
  };

  const showCodeError = (reason: CodeError, email: string) => {
    if (needsNewCode(reason)) setStep({ kind: "code", email });
    setError(codeErrorMessage(reason));
  };

  const leave = () =>
    run(async () => {
      await api.signOut();
      // A full load: the next screen starts a new guest from scratch.
      window.location.assign("/jouer");
    });

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.kicker}>Ton compte</p>
        <h1 className={styles.title}>{titleOf(step)}</h1>
      </header>

      {step.kind === "loading" && <p className={styles.hint}>Un instant…</p>}

      {step.kind === "failed" && (
        <div className={styles.panel}>
          <p className={styles.hint}>Le serveur lambine.</p>
          <button type="button" className={styles.secondary} onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      )}

      {step.kind === "member" && (
        <div className={styles.panel}>
          <p className={styles.text}>
            Connecté avec <strong className={styles.email}>{step.email}</strong>.
          </p>
          <NewsToggle />
          {step.isAdmin && (
            <Link href="/admin" className={styles.secondary}>
              Administration
            </Link>
          )}
          <button type="button" className={styles.secondary} disabled={busy} onClick={leave}>
            {busy ? "Un instant…" : "Me déconnecter"}
          </button>
        </div>
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
          onChangeEmail={() => {
            forgetPendingCode();
            go({ kind: "email" });
          }}
        />
      )}

      {step.kind === "confirm" && (
        <Confirm
          preview={step.preview}
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
  const id = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(email.trim().toLowerCase());
  };
  return (
    <form className={styles.panel} onSubmit={submit}>
      <p className={styles.text}>
        Sans compte, ta collection n'est enregistrée que dans ce navigateur.
      </p>
      <label htmlFor={id} className={styles.label}>
        Ton adresse e-mail
      </label>
      <input
        id={id}
        className={styles.input}
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={newsOptIn}
          onChange={(event) => onNewsOptIn(event.target.checked)}
        />
        <span>{NEWS_OPT_IN}</span>
      </label>
      <button type="submit" className={styles.primary} disabled={busy || email.trim() === ""}>
        {busy ? "Envoi…" : "Recevoir un code"}
      </button>
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
    <form className={styles.panel} onSubmit={submit}>
      <p className={styles.text}>
        Code envoyé à <strong className={styles.email}>{email}</strong>.
      </p>
      <label htmlFor={id} className={styles.label}>
        Ton code
      </label>
      <input
        id={id}
        className={`${styles.input} ${styles.code}`}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
      />
      <button type="submit" className={styles.primary} disabled={busy || code.length !== 6}>
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
  const { noun } = usePackShape();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageBracket, setAgeBracket] = useState<AgeBracket | null>(null);
  const step = confirmStep(preview, noun);
  const ready = !busy && (!step.needsAge || ageConfirmed);
  if (step.closed) {
    return (
      <div className={styles.panel}>
        <h2 className={styles.subtitle}>{step.title}</h2>
        <p className={styles.text}>{step.text}</p>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>
          Changer d'adresse
        </button>
      </div>
    );
  }
  return (
    <div className={styles.panel}>
      <h2 className={styles.subtitle}>{step.title}</h2>
      <p className={styles.text}>{step.text}</p>
      {step.warning !== null && <p className={styles.warning}>{step.warning}</p>}
      {step.needsAge && (
        <>
          <span className={styles.label}>Ta tranche d'âge (facultatif)</span>
          <Select
            className={styles.ageSelect ?? ""}
            ariaLabel="Ta tranche d'âge (facultatif)"
            value={ageBracket ?? ""}
            options={AGE_OPTIONS}
            onChange={(value) => setAgeBracket(value === "" ? null : value)}
          />
        </>
      )}
      {step.needsAge && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(event) => setAgeConfirmed(event.target.checked)}
          />
          <span>
            J'ai 15 ans ou plus et j'accepte les{" "}
            <Link href="/conditions" target="_blank">
              conditions d'utilisation
            </Link>
          </span>
        </label>
      )}
      {step.acceptsLoss ? (
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={busy} onClick={onCancel}>
            Garder ma partie
          </button>
          <button
            type="button"
            className={styles.secondary}
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
            className={styles.primary}
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
