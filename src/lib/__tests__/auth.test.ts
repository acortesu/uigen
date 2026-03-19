// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/headers cookies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

beforeEach(() => {
  vi.clearAllMocks();
});

test("createSession sets an httpOnly cookie with a JWT", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-1", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, token, options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3); // valid JWT structure
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  expect(options.expires).toBeInstanceOf(Date);
});

test("createSession encodes userId and email in the token", async () => {
  const { createSession } = await import("@/lib/auth");
  const { jwtVerify } = await import("jose");

  await createSession("user-42", "test@test.com");

  const token = mockCookieStore.set.mock.calls[0][1];
  const { payload } = await jwtVerify(token, JWT_SECRET);
  expect(payload.userId).toBe("user-42");
  expect(payload.email).toBe("test@test.com");
});

test("createSession sets cookie expiry ~7 days from now", async () => {
  const { createSession } = await import("@/lib/auth");

  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const expires: Date = mockCookieStore.set.mock.calls[0][2].expires;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession encodes expiresAt in the token payload", async () => {
  const { createSession } = await import("@/lib/auth");
  const { jwtVerify } = await import("jose");

  await createSession("user-1", "user@example.com");

  const token = mockCookieStore.set.mock.calls[0][1];
  const { payload } = await jwtVerify(token, JWT_SECRET);
  expect(payload.expiresAt).toBeDefined();
});

test("createSession sets secure=false outside production", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-1", "user@example.com");

  const options = mockCookieStore.set.mock.calls[0][2];
  expect(options.secure).toBe(false);
});

test("createSession sets secure=true in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.resetModules();

  const { createSession } = await import("@/lib/auth");
  await createSession("user-1", "user@example.com");

  const options = mockCookieStore.set.mock.calls[0][2];
  expect(options.secure).toBe(true);

  vi.unstubAllEnvs();
  vi.resetModules();
});

// getSession tests

test("getSession returns null when no cookie is present", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const { getSession } = await import("@/lib/auth");
  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns the session payload for a valid token", async () => {
  const { SignJWT } = await import("jose");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ userId: "user-1", email: "user@example.com", expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  mockCookieStore.get.mockReturnValue({ value: token });

  const { getSession } = await import("@/lib/auth");
  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("user@example.com");
});

test("getSession returns null for a tampered token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "invalid.token.value" });

  const { getSession } = await import("@/lib/auth");
  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const { SignJWT } = await import("jose");
  const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(new Date(Date.now() - 1000))
    .setIssuedAt()
    .sign(JWT_SECRET);

  mockCookieStore.get.mockReturnValue({ value: token });

  const { getSession } = await import("@/lib/auth");
  const session = await getSession();

  expect(session).toBeNull();
});
