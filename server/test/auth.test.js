// Ensures env vars exist before importing the app (which validates them at load time).
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://u:p@localhost:5432/db";
process.env.NODE_ENV = "test";

const { test } = await import("node:test");
const assert = await import("node:assert");
const request = (await import("supertest")).default;
const jwt = (await import("jsonwebtoken")).default;

const { default: app } = await import("../server.js");

test("protected routes reject unauthenticated requests with 401", async () => {
  const noAuth = [
    request(app).post("/api/auth/lose-heart"),
    request(app).post("/api/generate"),
    request(app).get("/api/auth/me")
  ];
  for (const r of noAuth) {
    const res = await r;
    assert.strictEqual(res.status, 401);
  }
});

test("a valid auth cookie passes verifyToken (reaches controller, not 401)", async () => {
  const token = jwt.sign({ id: 1, role: "user" }, process.env.JWT_SECRET);
  const res = await request(app)
    .post("/api/auth/lose-heart")
    .set("Cookie", `token=${token}`);
  // No DB in tests, so it errors past auth (500), but must NOT be 401.
  assert.notStrictEqual(res.status, 401);
});

test("helmet sets security headers", async () => {
  const res = await request(app).get("/");
  assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
});

test("SPA fallback serves index.html", async () => {
  const res = await request(app).get("/some-client-route");
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /<html/i);
});
