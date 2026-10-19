declare namespace NodeJS {
  interface ProcessEnv {
    /** Base URL of the game API, inlined in the browser bundle. */
    readonly NEXT_PUBLIC_API_URL?: string;
  }
}
