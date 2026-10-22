"use client";

import type { LinkPreviewResponse } from "@leximon/contract";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { fetchAccount, previewSignIn, sendSignInCode, signInWithCode, signOut } from "@/lib/api";
import { usePackShape } from "@/lib/use-pack-shape";
import { forgetProgress } from "@/progress/use-progress";
import {
  type CodeError,
  codeErrorMessage,
  confirmStep,
  needsConfirmation,
  needsNewCode,
  sendErrorMessage,
} from "./account-flow";
import styles from "./account-screen.module.css";

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
 * Signing up or in with a code sent by e-mail (D-030). One flow for both: whether the address has
 * an account is only told once the code is checked, so that nobody learns it without the mailbox.
 */
export function AccountScreen() {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStep({ kind: "loading" });
    try {
      const account = await fetchAccount();
      setStep(
        account.kind === "member"
          ? { kind: "member", email: account.email, isAdmin: account.isAdmin }
          : { kind: "email" },
      );
    } catch {
      setStep({ kind: "failed" });
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
      const result = await sendSignInCode(email);
      if (result.kind === "sent") go({ kind: "code", email });
      else setError(sendErrorMessage(result.reason));
    });

  const checkCode = (email: string, code: string) =>
    run(async () => {
      const result = await previewSignIn(email, code);
      if (result.kind !== "ok") showCodeError(result.reason, email);
      else if (needsConfirmation(result)) go({ kind: "confirm", email, code, preview: result });
      else await signIn(email, code, result, false);
    });

  const confirm = (
    email: string,
    code: string,
    preview: LinkPreviewResponse,
    ageConfirmed: boolean,
  ) => run(() => signIn(email, code, preview, ageConfirmed));

  const signIn = async (
    email: string,
    code: string,
    preview: LinkPreviewResponse,
    ageConfirmed: boolean,
  ) => {
    const result = await signInWithCode({
      email,
      otp: code,
      ...(ageConfirmed ? { ageConfirmed: true } : {}),
      ...(preview.outcome === "abandon" ? { acceptGuestLoss: true } : {}),
    });
    if (result.kind === "signed_in") {
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
      await signOut();
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
        <EmailForm busy={busy} onSubmit={(email) => void sendCode(email)} />
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
          onConfirm={(ageConfirmed) =>
            void confirm(step.email, step.code, step.preview, ageConfirmed)
          }
          onCancel={() => go({ kind: "email" })}
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
      return "Tu es connecté";
    case "code":
      return "Vérifie tes e-mails";
    case "confirm":
      return "Presque fini";
    default:
      return "Garde ta collection";
  }
}

function EmailForm({
  busy,
  onSubmit,
}: {
  readonly busy: boolean;
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
      <p className={styles.text}>Sans compte, ta collection reste coincée dans ce navigateur.</p>
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
      <button type="submit" className={styles.primary} disabled={busy || email.trim() === ""}>
        {busy ? "Envoi…" : "Recevoir un code"}
      </button>
    </form>
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

function Confirm({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  readonly preview: LinkPreviewResponse;
  readonly busy: boolean;
  readonly onConfirm: (ageConfirmed: boolean) => void;
  readonly onCancel: () => void;
}) {
  const { noun } = usePackShape();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const step = confirmStep(preview, noun);
  const ready = !busy && (!step.needsAge || ageConfirmed);
  return (
    <div className={styles.panel}>
      <h2 className={styles.subtitle}>{step.title}</h2>
      <p className={styles.text}>{step.text}</p>
      {step.warning !== null && <p className={styles.warning}>{step.warning}</p>}
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
            Rester en invité
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => onConfirm(false)}
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
            onClick={() => onConfirm(ageConfirmed)}
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
