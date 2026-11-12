export const dynamic = "force-dynamic";

/** Android App Links verification (`ANDROID_APP_SHA256`, comma-separated if several). */
export function GET(): Response {
  const raw = process.env.ANDROID_APP_SHA256?.trim();
  if (!raw) return new Response(null, { status: 404 });
  const fingerprints = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (fingerprints.length === 0) return new Response(null, { status: 404 });

  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "fr.leximon.app",
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
