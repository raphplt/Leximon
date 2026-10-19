import { resetTestDatabase, testDatabaseUrl } from "./src/testing";

export default async function setup(): Promise<void> {
  await resetTestDatabase(testDatabaseUrl());
}
