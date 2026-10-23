import { describe, expect, it } from "vitest";
import { renderInvitationOnlyEmail } from "./invitation-only";
import { DISCORD_URL, SITE_URL } from "./layout";

describe("renderInvitationOnlyEmail", () => {
  const email = renderInvitationOnlyEmail();

  it("keeps the subject to five words at most", () => {
    expect(email.subject.split(/\s+/).length).toBeLessThanOrEqual(5);
  });

  it("says there is no account, and where invitations are given", () => {
    expect(email.text).toContain("on n'a aucun compte à cette adresse");
    expect(email.text).toContain(DISCORD_URL);
    expect(email.html).toContain("on n&#39;a aucun compte à cette adresse");
  });

  it("carries no code", () => {
    expect(email.subject).not.toMatch(/\d/);
    expect(email.html).not.toMatch(/>\d{6}</);
  });

  it("links to the Discord and the site only, without image", () => {
    expect(email.html).not.toMatch(/<img/i);
    const links = [...email.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(links).toEqual([DISCORD_URL, SITE_URL]);
  });
});
