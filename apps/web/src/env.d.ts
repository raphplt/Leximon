declare namespace NodeJS {
  interface ProcessEnv {
    /** Base URL of the game API, inlined in the browser bundle. */
    readonly NEXT_PUBLIC_API_URL?: string;
    /** Base URL of the game API for the server's own requests (a public profile); defaults to the public one. */
    readonly API_URL?: string;
    /** Base URL of the published catalogue. Defaults to the web app's own /catalog. */
    readonly NEXT_PUBLIC_CATALOG_URL?: string;
  }
}
