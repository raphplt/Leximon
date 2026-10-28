import { ApiError, createAdminClient } from "@leximon/contract/client";
import { browserTransport } from "@/lib/api";

/** Never signs in as a guest: without a session the shell asks to sign in. */
export const adminApi = createAdminClient({ transport: browserTransport });

/** French message for a refusal the admin can act on. */
export function adminErrorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.message : "";
  switch (code) {
    case "code_taken":
      return "Ce code sert déjà à une autre invitation.";
    case "invite_not_found":
      return "Invitation introuvable.";
    case "below_uses":
      return "Plus de joueurs sont déjà entrés par ce lien.";
    case "network_error":
      return "Pas de connexion à l'API.";
    case "forbidden":
      return "Ce compte n'a plus le rôle admin.";
    case "player_not_found":
      return "Joueur introuvable.";
    case "guest_archived":
      return "Cet invité a été archivé : agis sur le compte qui a repris sa partie.";
    case "cannot_ban_admin":
      return "Un admin ne peut pas être banni. Retire d'abord son rôle (pnpm admin:grant --revoke).";
    case "trade_not_pending":
      return "Cet échange n'est plus en attente.";
    case "trade_not_found":
      return "Échange introuvable.";
    case "invalid_request":
      return "Valeurs refusées par le serveur.";
    case "campaign_not_found":
      return "Campagne introuvable.";
    case "not_a_draft":
      return "Cette campagne est déjà lancée : elle ne change plus.";
    case "waitlist_closed":
      return "La liste d'attente a déjà reçu son e-mail. Une seule fois.";
    case "no_recipients":
      return "Personne à qui écrire.";
    case "invalid_state":
      return "Impossible dans l'état actuel de la campagne.";
    case "not_sent_yet":
      return "L'e-mail d'ouverture n'est pas fini d'envoyer.";
    case "email_not_configured":
      return "L'envoi d'e-mails n'est pas configuré sur ce serveur.";
    case "send_failed":
      return "Le fournisseur a refusé l'envoi.";
    case "report_not_found":
      return "Signalement introuvable.";
    case "sanction_not_found":
      return "Sanction introuvable.";
    case "duration_required":
      return "Cette sanction demande une durée.";
    case "duration_not_allowed":
      return "Cette sanction ne prend pas de durée, ou une durée trop longue (un an au plus).";
    case "target_required":
      return "Le message ou le clan visé n'existe plus.";
    case "already_resolved":
      return "Déjà traité.";
    case "admin_target":
      return "Un admin ne se sanctionne pas.";
    default:
      return "Une erreur est survenue. Réessaie.";
  }
}
