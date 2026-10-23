import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { errorSummary } from "./error-summary";

function postgresError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe("errorSummary", () => {
  it("keeps a failed query's SQL but never its parameters", () => {
    const error = new DrizzleQueryError(
      "select * from users where email = $1",
      ["ada@example.org"],
      postgresError("57P01", "terminating connection"),
    );

    const summary = errorSummary(error);

    expect(summary.message).toBe("Failed query: select * from users where email = $1");
    expect(summary.code).toBe("57P01");
    expect(JSON.stringify(summary)).not.toContain("ada@example.org");
  });

  it("finds a failed query wrapped in another error", () => {
    const query = new DrizzleQueryError("insert into clan_messages values ($1)", ["salut"]);
    const summary = errorSummary(new Error("Transaction failed", { cause: query }));

    expect(summary.name).toBe("DrizzleQueryError");
    expect(JSON.stringify(summary)).not.toContain("salut");
  });

  it("drops the message of a Postgres error, which may quote a value", () => {
    const summary = errorSummary(
      postgresError("22P02", 'invalid input syntax for type uuid: "ada@example.org"'),
    );

    expect(summary).toMatchObject({ code: "22P02", message: "" });
  });

  it("keeps the message and the first frames of an ordinary error", () => {
    const summary = errorSummary(new TypeError("cannot read 'x'"));

    expect(summary).toMatchObject({ name: "TypeError", message: "cannot read 'x'", code: null });
    expect(summary.at).toMatch(/^at /);
  });

  it("describes a thrown value that is not an error", () => {
    expect(errorSummary("boom")).toEqual({ name: "string", message: "", code: null, at: null });
  });
});
