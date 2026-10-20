import type { Database } from "@leximon/db";
import type { Auth } from "./auth";

/** Hono environment shared by all routes. Variables live for one request only. */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    db: Database;
    auth: Auth;
    userId: string;
    /** Address in the body of a sign-in request, once read (`readAuthEmail`). */
    authEmail: string | null | undefined;
  };
}
