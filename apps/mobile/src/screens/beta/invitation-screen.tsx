import type { InviteStatus } from "@leximon/contract";
import {
  CLOSED_TITLE,
  DOOR_FIELD,
  DOOR_INVALID,
  doorFrom,
  INVITATION_REQUIRED_TEXT,
  INVITATION_REQUIRED_TITLE,
  INVITE_CLOSED_TEXT,
  INVITED_ACTION,
  INVITED_PITCH,
  INVITED_TITLE,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { rememberInvite } from "@/api/arrival";
import { api } from "@/api/client";
import { playFromScratch } from "@/player/session";
import { Button } from "@/ui/button";
import { FormError, Page, Paragraph } from "@/ui/page";
import { OnPaper } from "@/ui/panel";
import { TextField } from "@/ui/text-field";
import { SignInLink } from "./sign-in-link";
import { WaitlistForm } from "./waitlist-form";

type State = { readonly kind: "loading" } | { readonly kind: "failed" } | InviteStatus;

/** Where an invitation link leads: it opens the closed beta to whoever holds it. */
export function InvitationScreen({ code }: { readonly code: string | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    // A code the server could never know reads as an unknown link, without a request.
    if (code === null) {
      setState({ status: "unknown" });
      return;
    }
    setState({ kind: "loading" });
    try {
      setState({ status: await api.fetchInviteStatus(code) });
    } catch {
      setState({ kind: "failed" });
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const enter = () => {
    if (code === null) return;
    rememberInvite(code);
    playFromScratch();
  };

  const closed = "status" in state && state.status !== "open";
  return (
    <Page title={closed ? CLOSED_TITLE : INVITED_TITLE}>
      <OnPaper>
        {"kind" in state && state.kind === "loading" && <Paragraph muted>Un instant…</Paragraph>}
        {"kind" in state && state.kind === "failed" && (
          <>
            <Paragraph muted>Le serveur ne répond pas.</Paragraph>
            <Button label="Réessayer" secondary onPress={() => void load()} />
          </>
        )}
        {"status" in state && state.status === "open" && (
          <>
            <Paragraph>{INVITED_PITCH}</Paragraph>
            <Button label={INVITED_ACTION} onPress={enter} />
          </>
        )}
        {"status" in state && state.status !== "open" && (
          <>
            <Paragraph>{INVITE_CLOSED_TEXT[state.status]}</Paragraph>
            <WaitlistForm />
          </>
        )}
        <SignInLink />
      </OnPaper>
    </Page>
  );
}

/** Where a player without an invitation lands when they try to play. */
export function InvitationRequiredScreen() {
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  // A link opened in a mail or a message lands here as text: pasting it opens the right door.
  const open = () => {
    const door = doorFrom(link);
    if (door === null) {
      setError(DOOR_INVALID);
      return;
    }
    setError(null);
    router.push(
      door.kind === "invite"
        ? { pathname: "/invitation/[code]", params: { code: door.code } }
        : { pathname: "/ami/[code]", params: { code: door.code } },
    );
  };

  return (
    <Page title={INVITATION_REQUIRED_TITLE} closable={false}>
      <OnPaper>
        <Paragraph>{INVITATION_REQUIRED_TEXT}</Paragraph>
        <TextField
          label={DOOR_FIELD}
          placeholder="https://leximon.fr/invitation/…"
          value={link}
          onChangeText={(text) => {
            setLink(text);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={open}
        />
        <Button label="Entrer" disabled={link.trim() === ""} onPress={open} />
        <FormError message={error} />
        <Paragraph muted>Pas de lien ? Laisse ton adresse.</Paragraph>
        <WaitlistForm />
        <SignInLink />
      </OnPaper>
    </Page>
  );
}
