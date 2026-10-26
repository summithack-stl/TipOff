// Run: node --test src/lib/api-error.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyError } from "./api-error.ts";

const reply = (body, status, headers) => new Response(JSON.stringify(body), { status, headers });

test("429 says how long to wait from Retry-After", async () => {
  assert.equal(await friendlyError(reply({ error: "x" }, 429, { "Retry-After": "12" })), "Too many requests right now. Try again in 12 seconds.");
  assert.equal(await friendlyError(reply({}, 429)), "Too many requests right now. Try again in a minute.");
});

test("503 passes the server's reason through, else says the service is busy", async () => {
  assert.equal(await friendlyError(reply({ error: "Report storage isn't set up on this deployment yet." }, 503)), "Report storage isn't set up on this deployment yet.");
  assert.equal(await friendlyError(reply({}, 503)), "That service is busy. Try again in a few seconds.");
});

test("other errors pass the server message through, or a generic one", async () => {
  assert.equal(await friendlyError(reply({ error: "bad handle" }, 400)), "bad handle");
  assert.equal(await friendlyError(new Response("oops", { status: 500 })), "Something went wrong (HTTP 500). Try again.");
});
