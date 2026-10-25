"use client";

import {
  type AdminCampaign,
  type AdminCampaignContent,
  type AdminCampaignPreview,
  CAMPAIGN_RATE,
  type CampaignAudience,
} from "@leximon/contract";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/admin/admin-api";
import { Select } from "@/components/select";
import styles from "./admin.module.css";
import { AUDIENCE_LABELS, STATUS_LABELS } from "./campaigns-screen";
import { formatDateTime, formatNumber } from "./format";
import { useLoad } from "./use-load";

/** The campaign of the address `/admin/campagnes/[id]`. */
export function CampaignFromAddress() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const fetcher = useCallback(() => adminApi.fetchCampaign(id), [id]);
  const { state, reload } = useLoad(fetcher);
  const live = state.kind === "ready" && ["scheduled", "sending"].includes(state.data.status);

  // While it is sending, the counters move: read again every few seconds.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [live, reload]);

  return (
    <>
      <BackLink />
      {state.kind === "loading" && <p className={styles.muted}>Chargement…</p>}
      {state.kind === "failed" && <p className={styles.error}>{state.message}</p>}
      {state.kind === "ready" &&
        (state.data.status === "draft" ? (
          <>
            <CampaignEditor campaign={state.data} onSaved={reload} />
            <LaunchPanel campaign={state.data} onLaunched={reload} />
          </>
        ) : (
          <CampaignTracking campaign={state.data} onChange={reload} />
        ))}
    </>
  );
}

/** `/admin/campagnes/nouvelle`. */
export function NewCampaignScreen() {
  return (
    <>
      <BackLink />
      <CampaignEditor campaign={null} onSaved={() => {}} />
    </>
  );
}

function BackLink() {
  return (
    <p>
      <Link href="/admin/campagnes">← Campagnes</Link>
    </p>
  );
}

type Status =
  | { readonly kind: "idle" }
  | { readonly kind: "busy" }
  | { readonly kind: "done"; readonly message: string }
  | { readonly kind: "failed"; readonly message: string };

function StatusLine({ status }: { readonly status: Status }) {
  if (status.kind === "done") return <p className={styles.success}>{status.message}</p>;
  if (status.kind === "failed") return <p className={styles.error}>{status.message}</p>;
  return null;
}

interface Draft {
  name: string;
  subject: string;
  bodyMarkdown: string;
  buttonLabel: string;
  buttonUrl: string;
  audience: CampaignAudience;
  testRecipients: string;
  ratePerMinute: number;
}

function draftOf(campaign: AdminCampaign | null): Draft {
  return {
    name: campaign?.name ?? "",
    subject: campaign?.subject ?? "",
    bodyMarkdown: campaign?.bodyMarkdown ?? "",
    buttonLabel: campaign?.buttonLabel ?? "",
    buttonUrl: campaign?.buttonUrl ?? "",
    audience: campaign?.audience ?? "test",
    testRecipients: campaign?.testRecipients.join("\n") ?? "",
    ratePerMinute: campaign?.ratePerMinute ?? CAMPAIGN_RATE.default,
  };
}

function contentOf(draft: Draft): AdminCampaignContent {
  const label = draft.buttonLabel.trim();
  const url = draft.buttonUrl.trim();
  return {
    subject: draft.subject,
    bodyMarkdown: draft.bodyMarkdown,
    buttonLabel: label === "" ? null : label,
    buttonUrl: url === "" ? null : url,
  };
}

const AUDIENCE_OPTIONS = (["test", "players", "waitlist"] as const).map((value) => ({
  value,
  label: AUDIENCE_LABELS[value],
}));

function CampaignEditor({
  campaign,
  onSaved,
}: {
  readonly campaign: AdminCampaign | null;
  readonly onSaved: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftOf(campaign));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [testStatus, setTestStatus] = useState<Status>({ kind: "idle" });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: "busy" });
    try {
      const saved = await adminApi.saveCampaign(campaign?.id ?? null, {
        name: draft.name,
        ...contentOf(draft),
        audience: draft.audience,
        testRecipients:
          draft.audience === "test"
            ? draft.testRecipients
                .split(/[\s,;]+/)
                .map((address) => address.trim())
                .filter((address) => address !== "")
            : [],
        ratePerMinute: draft.ratePerMinute,
      });
      if (campaign === null) {
        router.push(`/admin/campagnes/${saved.id}`);
        return;
      }
      setStatus({ kind: "done", message: "Brouillon enregistré." });
      onSaved();
    } catch (error) {
      setStatus({ kind: "failed", message: adminErrorMessage(error) });
    }
  };

  const sendTest = async () => {
    setTestStatus({ kind: "busy" });
    try {
      await adminApi.sendCampaignTest(contentOf(draft));
      setTestStatus({ kind: "done", message: "Test envoyé à ton adresse." });
    } catch (error) {
      setTestStatus({ kind: "failed", message: adminErrorMessage(error) });
    }
  };

  return (
    <>
      <h1 className={styles.title}>{campaign === null ? "Nouvelle campagne" : campaign.name}</h1>
      <div className={styles.grid2}>
        <form className={`${styles.panel} ${styles.form}`} onSubmit={(event) => void save(event)}>
          <label className={styles.field}>
            Nom (interne)
            <input
              className={styles.input}
              value={draft.name}
              maxLength={120}
              required
              onChange={(event) => set("name", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Objet
            <input
              className={styles.input}
              value={draft.subject}
              maxLength={120}
              required
              onChange={(event) => set("subject", event.target.value)}
            />
          </label>
          <label className={styles.field}>
            Texte (Markdown : **gras**, *italique*, [lien](https://…), ## titre, - liste)
            <textarea
              className={styles.input}
              style={{ minHeight: 220, padding: 12, fontFamily: "ui-monospace, monospace" }}
              value={draft.bodyMarkdown}
              maxLength={10_000}
              required
              onChange={(event) => set("bodyMarkdown", event.target.value)}
            />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              Bouton (facultatif)
              <input
                className={styles.input}
                value={draft.buttonLabel}
                maxLength={40}
                onChange={(event) => set("buttonLabel", event.target.value)}
              />
            </label>
            <label className={`${styles.field} ${styles.grow}`}>
              Lien du bouton (https)
              <input
                className={styles.input}
                type="url"
                value={draft.buttonUrl}
                placeholder="https://leximon.fr/jouer"
                onChange={(event) => set("buttonUrl", event.target.value)}
              />
            </label>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              Public
              <Select
                value={draft.audience}
                options={AUDIENCE_OPTIONS}
                onChange={(value) => set("audience", value)}
                ariaLabel="Public"
              />
            </div>
            <label className={styles.field}>
              Envois par minute
              <input
                className={styles.input}
                type="number"
                min={CAMPAIGN_RATE.min}
                max={CAMPAIGN_RATE.max}
                value={draft.ratePerMinute}
                onChange={(event) =>
                  set(
                    "ratePerMinute",
                    Math.min(
                      CAMPAIGN_RATE.max,
                      Math.max(CAMPAIGN_RATE.min, Number(event.target.value) || 0),
                    ),
                  )
                }
              />
            </label>
          </div>
          {draft.audience === "test" && (
            <label className={styles.field}>
              Adresses de test (une par ligne, 20 au plus)
              <textarea
                className={styles.input}
                style={{ minHeight: 90, padding: 12 }}
                value={draft.testRecipients}
                onChange={(event) => set("testRecipients", event.target.value)}
              />
            </label>
          )}
          {draft.audience === "waitlist" && (
            <p className={styles.muted}>
              Une seule fois : le lancement ferme la liste d'attente pour de bon.
            </p>
          )}
          <div className={styles.toolbar}>
            <button type="submit" className={styles.primary} disabled={status.kind === "busy"}>
              {campaign === null ? "Créer le brouillon" : "Enregistrer"}
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={testStatus.kind === "busy"}
              onClick={() => void sendTest()}
            >
              M'envoyer un test
            </button>
          </div>
          <StatusLine status={status} />
          <StatusLine status={testStatus} />
        </form>
        <PreviewPanel content={contentOf(draft)} />
      </div>
    </>
  );
}

/** The e-mail as a recipient gets it, rendered by the server, refreshed as the admin types. */
function PreviewPanel({ content }: { readonly content: AdminCampaignContent }) {
  const [preview, setPreview] = useState<AdminCampaignPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asText, setAsText] = useState(false);
  const key = JSON.stringify(content);

  useEffect(() => {
    const parsed = JSON.parse(key) as AdminCampaignContent;
    if (parsed.subject.trim() === "" || parsed.bodyMarkdown.trim() === "") return;
    let live = true;
    const timer = setTimeout(() => {
      adminApi
        .previewCampaign(parsed)
        .then((result) => {
          if (!live) return;
          setPreview(result);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (live) setError(adminErrorMessage(caught));
        });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.subtitle}>Aperçu</h2>
        <button type="button" className={styles.button} onClick={() => setAsText((v) => !v)}>
          {asText ? "Voir le HTML" : "Voir le texte"}
        </button>
      </div>
      {error !== null && <p className={styles.error}>{error}</p>}
      {preview === null ? (
        <p className={styles.muted}>Un objet et un texte, et l'aperçu s'affiche.</p>
      ) : (
        <>
          <p>
            <strong>Objet :</strong> {preview.subject}
          </p>
          {asText ? (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 14 }}>{preview.text}</pre>
          ) : (
            // No script, no form, no navigation: the frame only shows the e-mail.
            <iframe
              title="Aperçu de l'e-mail"
              sandbox=""
              srcDoc={preview.html}
              style={{
                width: "100%",
                height: 560,
                border: 0,
                borderRadius: 10,
                background: "#fff",
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function LaunchPanel({
  campaign,
  onLaunched,
}: {
  readonly campaign: AdminCampaign;
  readonly onLaunched: () => void;
}) {
  const [recipients, setRecipients] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Kept until the server answers: a retry after a lost answer never launches twice.
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const count = useCallback(async () => {
    setStatus({ kind: "idle" });
    try {
      setRecipients(await adminApi.fetchCampaignAudience(campaign.id));
      setTyped("");
    } catch (error) {
      setStatus({ kind: "failed", message: adminErrorMessage(error) });
    }
  }, [campaign.id]);

  const launch = async (event: FormEvent) => {
    event.preventDefault();
    if (recipients === null) return;
    const key = pendingKey ?? crypto.randomUUID();
    setPendingKey(key);
    setStatus({ kind: "busy" });
    try {
      const result = await adminApi.launchCampaign(
        campaign.id,
        {
          expectedRecipients: recipients,
          scheduledAt: when === "later" && at !== "" ? new Date(at).toISOString() : null,
        },
        key,
      );
      setPendingKey(null);
      if (result.kind === "count_changed") {
        setRecipients(result.recipients);
        setTyped("");
        setStatus({
          kind: "failed",
          message: `Le public a bougé : ${formatNumber(result.recipients)} destinataire(s) maintenant. Confirme ce nombre.`,
        });
        return;
      }
      onLaunched();
    } catch (error) {
      setPendingKey(null);
      setStatus({ kind: "failed", message: adminErrorMessage(error) });
    }
  };

  const ready =
    recipients !== null &&
    recipients > 0 &&
    typed.trim() === String(recipients) &&
    (when === "now" || at !== "");

  return (
    <form className={`${styles.panel} ${styles.form}`} onSubmit={(event) => void launch(event)}>
      <h2 className={styles.subtitle}>Lancer</h2>
      <p className={styles.muted}>
        Enregistre d'abord. Au lancement, la liste des destinataires est figée et le texte ne change
        plus.
      </p>
      {recipients === null ? (
        <div className={styles.toolbar}>
          <button type="button" className={styles.button} onClick={() => void count()}>
            Compter les destinataires
          </button>
        </div>
      ) : (
        <>
          <p>
            <strong>{formatNumber(recipients)}</strong> destinataire(s) (
            {AUDIENCE_LABELS[campaign.audience]}
            ), désinscrits et adresses en échec déjà retirés.
          </p>
          <div className={styles.row}>
            <div className={styles.field}>
              Quand
              <Select
                value={when}
                options={[
                  { value: "now", label: "Maintenant" },
                  { value: "later", label: "Programmer" },
                ]}
                onChange={setWhen}
                ariaLabel="Quand"
              />
            </div>
            {when === "later" && (
              <label className={styles.field}>
                Date et heure
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={at}
                  onChange={(event) => setAt(event.target.value)}
                />
              </label>
            )}
            <label className={styles.field}>
              Tape {formatNumber(recipients)} pour confirmer
              <input
                className={styles.input}
                inputMode="numeric"
                value={typed}
                onChange={(event) => setTyped(event.target.value.replace(/\s/g, ""))}
              />
            </label>
          </div>
          <div className={styles.toolbar}>
            <button
              type="submit"
              className={styles.primary}
              disabled={!ready || status.kind === "busy"}
            >
              {when === "now"
                ? `Envoyer à ${formatNumber(recipients)} personne(s)`
                : "Programmer l'envoi"}
            </button>
            <button type="button" className={styles.button} onClick={() => void count()}>
              Recompter
            </button>
          </div>
        </>
      )}
      <StatusLine status={status} />
    </form>
  );
}

function CampaignTracking({
  campaign,
  onChange,
}: {
  readonly campaign: AdminCampaign;
  readonly onChange: () => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { counts } = campaign;

  const act = async (control: "pause" | "resume" | "cancel") => {
    setStatus({ kind: "busy" });
    try {
      await adminApi.controlCampaign(campaign.id, control);
      setStatus({ kind: "idle" });
      setConfirmCancel(false);
      onChange();
    } catch (error) {
      setStatus({ kind: "failed", message: adminErrorMessage(error) });
    }
  };

  const busy = status.kind === "busy";
  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>{campaign.name}</h1>
        <span className={styles.badge}>{STATUS_LABELS[campaign.status]}</span>
      </div>
      <dl className={styles.facts}>
        <dt>Objet</dt>
        <dd>{campaign.subject}</dd>
        <dt>Public</dt>
        <dd>{AUDIENCE_LABELS[campaign.audience]}</dd>
        <dt>Lancée le</dt>
        <dd>{campaign.launchedAt === null ? "–" : formatDateTime(campaign.launchedAt)}</dd>
        {campaign.scheduledAt !== null && (
          <>
            <dt>Programmée pour</dt>
            <dd>{formatDateTime(campaign.scheduledAt)}</dd>
          </>
        )}
        {campaign.completedAt !== null && (
          <>
            <dt>Finie le</dt>
            <dd>{formatDateTime(campaign.completedAt)}</dd>
          </>
        )}
        <dt>Débit</dt>
        <dd>{formatNumber(campaign.ratePerMinute)} par minute</dd>
      </dl>
      <div className={styles.stats}>
        <Figure label="Destinataires" value={campaign.recipientCount ?? 0} />
        <Figure label="En file" value={counts.waiting} />
        <Figure label="Envoyés" value={counts.sent} />
        <Figure label="Échoués" value={counts.failed} />
        <Figure
          label="Rebonds"
          value={counts.bounced}
          note={`${formatNumber(counts.complained)} plainte(s)`}
        />
        <Figure label="Désinscriptions" value={counts.unsubscribed} />
        <Figure
          label="Écartés"
          value={counts.suppressed}
          note={`${formatNumber(counts.cancelled)} annulé(s)`}
        />
      </div>
      <div className={styles.toolbar}>
        {(campaign.status === "sending" || campaign.status === "scheduled") && (
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => void act("pause")}
          >
            Mettre en pause
          </button>
        )}
        {campaign.status === "paused" && (
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void act("resume")}
          >
            Reprendre
          </button>
        )}
        {["scheduled", "sending", "paused"].includes(campaign.status) &&
          (confirmCancel ? (
            <>
              <button
                type="button"
                className={styles.danger}
                disabled={busy}
                onClick={() => void act("cancel")}
              >
                Oui, annuler pour de bon
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => setConfirmCancel(false)}
              >
                Non
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.danger}
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              Annuler la campagne
            </button>
          ))}
      </div>
      {confirmCancel && (
        <p className={styles.muted}>
          Les {formatNumber(counts.waiting)} e-mail(s) en file ne partiront jamais. Ceux déjà partis
          restent partis.
        </p>
      )}
      <StatusLine status={status} />
      <PreviewPanel
        content={{
          subject: campaign.subject,
          bodyMarkdown: campaign.bodyMarkdown,
          buttonLabel: campaign.buttonLabel,
          buttonUrl: campaign.buttonUrl,
        }}
      />
    </>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: number;
  readonly note?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{formatNumber(value)}</span>
      {note !== undefined && <span className={styles.statNote}>{note}</span>}
    </div>
  );
}
