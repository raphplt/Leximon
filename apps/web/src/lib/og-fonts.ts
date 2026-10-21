/**
 * TrueType file of a Google font, cut down to the glyphs of `text`, for `ImageResponse`. The
 * renderer reads neither woff2 nor variable axes, so the CSS API is asked for a static instance in
 * a format it reads.
 */
export async function googleFont(family: string, text: string): Promise<ArrayBuffer> {
  const query = new URLSearchParams({ family, text: [...new Set(text)].join("") });
  const css = await (await fetchOk(`https://fonts.googleapis.com/css2?${query}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (url === undefined) throw new Error(`No TrueType file for the font ${family}`);
  return (await fetchOk(url)).arrayBuffer();
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font download failed (${response.status}): ${url}`);
  return response;
}
