import type { ReferrerResponse } from "@leximon/contract";
import {
  REFERRER_ACTION,
  REFERRER_FULL,
  REFERRER_PITCH,
  REFERRER_UNKNOWN,
  referrerTitle,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { rememberReferrer } from "@/api/arrival";
import { api } from "@/api/client";
import { playFromScratch } from "@/player/session";
import { Button } from "@/ui/button";
import { Page, Paragraph } from "@/ui/page";
import { TextButton } from "@/ui/text-button";
import { SignInLink } from "./sign-in-link";
import { WaitlistForm } from "./waitlist-form";

type State =
  | { readonly kind: "loading" | "failed" | "unknown" }
  | { readonly kind: "found"; readonly referrer: ReferrerResponse };

/** Where a friend link leads: who invites, and the door of the closed beta while it has room. */
export function ReferrerScreen({ code }: { readonly code: string | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    // A code no player could have reads as a link to nobody, without a request.
    if (code === null) {
      setState({ kind: "unknown" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const referrer = await api.fetchReferrer(code);
      setState(referrer === null ? { kind: "unknown" } : { kind: "found", referrer });
    } catch {
      setState({ kind: "failed" });
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const enter = () => {
    if (code === null) return;
    rememberReferrer(code);
    playFromScratch();
  };

  const referrer = state.kind === "found" ? state.referrer : null;
  return (
    <Page title={referrer === null ? "Lien d'ami" : referrerTitle(referrer.player.pseudo)}>
      {state.kind === "loading" && <Paragraph muted>Un instant…</Paragraph>}
      {state.kind === "failed" && (
        <>
          <Paragraph muted>Le serveur ne répond pas.</Paragraph>
          <Button label="Réessayer" secondary onPress={() => void load()} />
        </>
      )}
      {state.kind === "unknown" && <Paragraph>{REFERRER_UNKNOWN}</Paragraph>}
      {referrer !== null && referrer.status === "open" && (
        <>
          <Paragraph>{REFERRER_PITCH}</Paragraph>
          <Button label={REFERRER_ACTION} onPress={enter} />
          <TextButton
            label={`Déjà joueur ? Ajouter ${referrer.player.pseudo} en ami`}
            onPress={() => router.replace({ pathname: "/amis", params: { ajouter: code ?? "" } })}
          />
        </>
      )}
      {referrer !== null && referrer.status === "full" && (
        <>
          <Paragraph>{REFERRER_FULL}</Paragraph>
          <WaitlistForm />
        </>
      )}
      <SignInLink />
    </Page>
  );
}
