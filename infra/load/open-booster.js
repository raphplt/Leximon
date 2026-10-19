// k6 load test: guests arriving from a stream link, each opening boosters until the stock is empty.
//
//   docker run --rm -i --network host -e BASE_URL=http://localhost:8787 grafana/k6:1.0.0 run - < infra/load/open-booster.js
//
// Against a local `wrangler dev`, results only show that nothing breaks under concurrency: the
// numbers that matter come from a run against the deployed staging environment.
import { check } from "k6";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const ORIGIN = __ENV.ORIGIN || "http://localhost:3000";
const VUS = Number(__ENV.VUS || 50);

export const options = {
  scenarios: {
    stream_spike: {
      executor: "ramping-vus",
      stages: [
        { duration: "10s", target: VUS },
        { duration: "20s", target: VUS },
        { duration: "5s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:open}": ["p(95)<500"],
    checks: ["rate>0.99"],
  },
};

// An empty stock (409) is an expected answer, not a failure.
http.setResponseCallback(http.expectedStatuses(200, 409));

/** RFC 4122 version 4 UUID; Math.random is enough for test idempotency keys. */
function uuidV4() {
  const hex = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export default function () {
  const signIn = http.post(`${BASE_URL}/api/auth/sign-in/anonymous`, "{}", {
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    tags: { name: "sign-in" },
  });
  check(signIn, { "guest signed in": (response) => response.status === 200 });

  // Capacity is 6: the 7th open must be refused with 409.
  for (let attempt = 1; attempt <= 7; attempt++) {
    const response = http.post(`${BASE_URL}/boosters/open`, JSON.stringify({ kind: "discovery" }), {
      headers: { Origin: ORIGIN, "Content-Type": "application/json", "Idempotency-Key": uuidV4() },
      tags: { name: "open" },
    });
    check(response, {
      "booster opened while stock remains": (r) => attempt > 6 || r.status === 200,
      "stock empty after six": (r) => attempt <= 6 || r.status === 409,
    });
  }
}
