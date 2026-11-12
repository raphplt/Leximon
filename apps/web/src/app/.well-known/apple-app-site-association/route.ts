export const dynamic = "force-dynamic";

const UNIVERSAL_PATHS = [
  "/ami/*",
  "/invitation/*",
  "/invitation",
  "/carte/*",
  "/joueur/*",
  "/enigme",
  "/enigme/*",
];

/** Universal Links association for iOS (`APPLE_TEAM_ID` required). */
export function GET(): Response {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  if (!teamId) return new Response(null, { status: 404 });

  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.fr.leximon.app`],
          components: UNIVERSAL_PATHS.map((path) => ({ "/": path })),
        },
      ],
    },
  });
}
