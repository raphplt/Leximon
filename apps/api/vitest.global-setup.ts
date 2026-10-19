import { resetTestDatabase, testDatabaseUrl } from "@leximon/db/testing";

export default async function setup(): Promise<void> {
  await resetTestDatabase(testDatabaseUrl());
}
