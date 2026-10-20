import { z } from "zod";
import { emailSchema } from "./account";

/**
 * Waiting list before the public beta: an address to warn when the game opens, and nothing else.
 */

/**
 * `POST /waitlist` body. Answered 204 whether the address was already on the list or not, so that
 * nobody can learn who signed up.
 */
export const joinWaitlistRequestSchema = z.object({ email: emailSchema });
export type JoinWaitlistRequest = z.input<typeof joinWaitlistRequestSchema>;
