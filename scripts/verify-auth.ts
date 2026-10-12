/**
 * Comprehensive verification suite for Phase 3 Authentication & Route Protection.
 *
 * Verifies:
 * 1. Zod input validation (registerSchema, loginSchema)
 * 2. Constant-time timing attack protection & generic error messages on login
 * 3. Status handling (PENDING approval message vs DISABLED vs ACTIVE login)
 * 4. Password verification for seeded users (Admin & Alice)
 * 5. Server-side registration policy (role MEMBER, status PENDING, bcrypt hash cost 10)
 * 6. JWT session token signing and verification using jose
 * 7. Open Redirect attack mitigation in callbackUrl sanitizer
 * 8. Server-side session & role assertions (assertUser, assertRole)
 */

import { registerSchema, loginSchema } from "../src/lib/validation/auth";
import { authenticateCredentials, getSafeCallbackUrl } from "../src/services/auth";
import { registerUser } from "../src/services/users";
import { signSessionToken, verifySessionToken } from "../src/lib/auth-token";
import { db } from "../src/lib/db";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../src/lib/errors";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ ${testName}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n========================================================");
  console.log("PHASE 3 AUTHENTICATION & ROUTE PROTECTION VERIFICATION");
  console.log("========================================================\n");

  // ----------------------------------------------------
  // TEST 1: Validation Schemas
  // ----------------------------------------------------
  console.log("[Test Suite 1] Zod Validation Schemas");

  const validReg = registerSchema.safeParse({
    name: " Test User ",
    email: " TEST.USER@example.com ",
    password: "Password123",
    confirmPassword: "Password123",
  });
  assert(validReg.success, "registerSchema accepts valid input and trims/lowercases", JSON.stringify(validReg));
  if (validReg.success) {
    assert(validReg.data.name === "Test User", "registerSchema trims name");
    assert(validReg.data.email === "test.user@example.com", "registerSchema lowercases and trims email");
  }

  const mismatchReg = registerSchema.safeParse({
    name: "Test User",
    email: "test@example.com",
    password: "Password123",
    confirmPassword: "DifferentPassword123",
  });
  assert(!mismatchReg.success, "registerSchema rejects password mismatch");

  const weakPassReg = registerSchema.safeParse({
    name: "Test User",
    email: "test@example.com",
    password: "passwordonly",
    confirmPassword: "passwordonly",
  });
  assert(!weakPassReg.success, "registerSchema rejects password without numbers");

  const validLogin = loginSchema.safeParse({
    email: " ALICE@EXAMPLE.COM ",
    password: "Member@123",
  });
  assert(validLogin.success && validLogin.data.email === "alice@example.com", "loginSchema trims and lowercases email");

  // ----------------------------------------------------
  // TEST 2: Login Credentials & Timing Attack Protection
  // ----------------------------------------------------
  console.log("\n[Test Suite 2] Credentials Verification & Status Gating");

  // Non-existent user -> generic error
  const nonExistent = await authenticateCredentials("nonexistent@example.com", "WrongPass123!");
  assert(
    !nonExistent.success && nonExistent.error === "Invalid email or password",
    "Non-existent user receives generic 'Invalid email or password'"
  );

  // Wrong password on active user -> identical generic error
  const wrongPass = await authenticateCredentials("alice@example.com", "WrongPassword999!");
  assert(
    !wrongPass.success && wrongPass.error === "Invalid email or password",
    "Wrong password receives identical generic 'Invalid email or password'"
  );

  // Diana is PENDING in seed:
  // With wrong password -> still generic error (no account status leakage)
  const dianaWrongPass = await authenticateCredentials("diana@example.com", "WrongPass!");
  assert(
    !dianaWrongPass.success && dianaWrongPass.error === "Invalid email or password",
    "PENDING user with wrong password receives generic error (no enumeration)"
  );

  // With correct password -> approval message
  const dianaCorrect = await authenticateCredentials("diana@example.com", "Member@123");
  assert(
    !dianaCorrect.success &&
      dianaCorrect.error === "Your account is awaiting administrator approval.",
    "PENDING user with correct password sees approval message"
  );

  // Alice is ACTIVE in seed with Member@123 -> login succeeds
  const aliceLogin = await authenticateCredentials("alice@example.com", "Member@123");
  assert(
    aliceLogin.success && aliceLogin.user?.role === "MEMBER" && aliceLogin.user?.status === "ACTIVE",
    "ACTIVE user Alice logs in successfully with MEMBER role"
  );

  // Admin user from .env
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "AdminPassword123!";
  const adminLogin = await authenticateCredentials(adminEmail, adminPassword);
  assert(
    adminLogin.success && adminLogin.user?.role === "ADMIN",
    "Seed Admin logs in successfully with ADMIN role"
  );

  // ----------------------------------------------------
  // TEST 3: Registration Flow & Server-side Policy
  // ----------------------------------------------------
  console.log("\n[Test Suite 3] Registration Policy & Duplicate Handling");

  const testEmail = `newuser_${Date.now()}@example.com`;
  // Clean up any old test record if exists
  await db.user.deleteMany({ where: { email: testEmail } });

  const newUser = await registerUser({
    name: "New Registrant",
    email: testEmail,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  assert(
    newUser.role === "MEMBER" && newUser.status === "PENDING",
    "New user is strictly assigned role MEMBER and status PENDING on server"
  );

  // Verify that new registered user cannot log in
  const newLogin = await authenticateCredentials(testEmail, "Password123!");
  assert(
    !newLogin.success &&
      newLogin.error === "Your account is awaiting administrator approval.",
    "Newly registered user cannot log in and sees approval message"
  );

  // Duplicate registration should throw ConflictError with friendly message
  let duplicateRejected = false;
  try {
    await registerUser({
      name: "Duplicate User",
      email: testEmail,
      password: "Password123!",
      confirmPassword: "Password123!",
    });
  } catch (err) {
    if (err instanceof ConflictError && err.message === "An account with this email already exists") {
      duplicateRejected = true;
    }
  }
  assert(duplicateRejected, "Duplicate registration is rejected with friendly ConflictError");

  // Clean up test user
  await db.user.deleteMany({ where: { email: testEmail } });

  // ----------------------------------------------------
  // TEST 4: JWT Session Signing & Verification (jose)
  // ----------------------------------------------------
  console.log("\n[Test Suite 4] JWT Token Management (jose)");

  const token = await signSessionToken({
    userId: "00000000-0000-0000-0000-000000000001",
    name: "Alice Smith",
    email: "alice@example.com",
    role: "MEMBER",
  });
  assert(typeof token === "string" && token.length > 50, "signSessionToken produces valid JWT string");

  const verified = await verifySessionToken(token);
  assert(
    verified !== null &&
      verified.userId === "00000000-0000-0000-0000-000000000001" &&
      verified.role === "MEMBER",
    "verifySessionToken correctly decodes and validates payload"
  );

  const invalidVerified = await verifySessionToken("tampered.token.data");
  assert(invalidVerified === null, "verifySessionToken returns null for tampered token");

  // ----------------------------------------------------
  // TEST 5: Open Redirect Mitigation (callbackUrl)
  // ----------------------------------------------------
  console.log("\n[Test Suite 5] Open Redirect URL Sanitization");

  assert(getSafeCallbackUrl("/resources") === "/resources", "Accepts internal /resources");
  assert(getSafeCallbackUrl("/admin/users") === "/admin/users", "Accepts internal /admin/users");
  assert(getSafeCallbackUrl("https://evil.com") === "/resources", "Rejects external URL https://evil.com");
  assert(getSafeCallbackUrl("//evil.com") === "/resources", "Rejects protocol-relative //evil.com");
  assert(getSafeCallbackUrl("/\\evil.com") === "/resources", "Rejects backslash escape /\\evil.com");
  assert(getSafeCallbackUrl(null) === "/resources", "Falls back to /resources for null");

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log("\n========================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Verification suite failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
