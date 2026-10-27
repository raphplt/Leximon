/**
 * The store reviewers' account. Google and Apple sign in to examine the app but cannot read our
 * mailbox: this one address takes a fixed code instead of a random one, and gets no e-mail. The
 * code still expires and still allows only a few wrong attempts, like any other.
 *
 * Both secrets set, or no such account. A code of the wrong shape counts as unset, so a typo in
 * production never leaves an easy code open.
 */
export function reviewSignInCode(
  env: Pick<Env, "REVIEW_ACCOUNT_EMAIL" | "REVIEW_ACCOUNT_CODE">,
  email: string,
  codeLength: number,
): string | undefined {
  // An unset secret is undefined at runtime, whatever the generated type says.
  const reviewEmail = normalize(env.REVIEW_ACCOUNT_EMAIL ?? "");
  const code = (env.REVIEW_ACCOUNT_CODE ?? "").trim();
  if (reviewEmail === "" || !new RegExp(`^\\d{${codeLength}}$`).test(code)) return undefined;
  return normalize(email) === reviewEmail ? code : undefined;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}
