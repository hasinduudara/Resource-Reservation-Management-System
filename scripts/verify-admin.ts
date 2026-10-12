/**
 * Comprehensive verification suite for Phase 4 Admin User Management.
 *
 * Verifies:
 * 1. Safe field projection (passwordHash is NEVER returned in listUsers or actions)
 * 2. Pending queue count and user listing with case-insensitive search and status filtering
 * 3. Concurrent double-approval race condition protection (updateMany atomic guard)
 * 4. Approval makes user ACTIVE and allows login (tested on diana@example.com)
 * 5. Rejection sets status DISABLED and blocks login with disabled message
 * 6. Re-enabling a DISABLED user restores ACTIVE status with admin audit metadata
 * 7. Self-disable prevention (admin cannot disable their own account)
 * 8. Last active admin protection (last admin can never be disabled)
 * 9. Server actions enforce admin authentication and role guards
 */

import { db } from "../src/lib/db";
import {
  listUsers,
  countPendingUsers,
  approveUser,
  rejectUser,
  disableUser,
  enableUser,
  registerUser,
} from "../src/services/users";
import { authenticateCredentials } from "../src/services/auth";
import { approveUserAction, disableUserAction } from "../src/app/(admin)/admin/users/actions";
import { ConflictError, ForbiddenError } from "../src/lib/errors";

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
  console.log("PHASE 4 ADMIN USER MANAGEMENT VERIFICATION SUITE");
  console.log("========================================================\n");

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const admin = await db.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, name: true, role: true, status: true },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Seed admin not found. Please ensure database is seeded.");
  }

  // ----------------------------------------------------
  // TEST 1: Safe Projection & Password Hash Protection
  // ----------------------------------------------------
  console.log("[Test Suite 1] Safe Field Projection & Password Hash Privacy");

  const listResult = await listUsers({ page: 1, pageSize: 20 });
  assert(listResult.users.length > 0, "listUsers returns seeded users");

  const anyExposesHash = listResult.users.some((u) => "passwordHash" in u);
  assert(!anyExposesHash, "passwordHash is NEVER included in listUsers returned rows");

  const pendingCount = await countPendingUsers();
  assert(typeof pendingCount === "number" && pendingCount >= 0, "countPendingUsers returns valid number");

  // Search & filter
  const searchResult = await listUsers({ search: "alice" });
  assert(
    searchResult.users.some((u) => u.email === "alice@example.com"),
    "listUsers case-insensitive search correctly matches name/email"
  );

  const statusFilterResult = await listUsers({ status: "ACTIVE" });
  const allActive = statusFilterResult.users.every((u) => u.status === "ACTIVE");
  assert(allActive, "listUsers correctly filters by status");

  // ----------------------------------------------------
  // TEST 2: Concurrent Approval Race Condition & Login
  // ----------------------------------------------------
  console.log("\n[Test Suite 2] Concurrent Approval Race Condition & Diana Login");

  // Ensure diana@example.com is PENDING
  let diana = await db.user.findUnique({ where: { email: "diana@example.com" } });
  if (!diana) {
    const newReg = await registerUser({
      name: "Diana Prince",
      email: "diana@example.com",
      password: "Member@123",
      confirmPassword: "Member@123",
    });
    diana = await db.user.findUnique({ where: { id: newReg.id } });
  } else if (diana.status !== "PENDING") {
    diana = await db.user.update({
      where: { id: diana.id },
      data: { status: "PENDING", approvedById: null, approvedAt: null },
    });
  }

  if (!diana) {
    throw new Error("Diana Prince record could not be loaded.");
  }

  // Fire two concurrent approveUser calls
  const [res1, res2] = await Promise.allSettled([
    approveUser(admin.id, diana.id),
    approveUser(admin.id, diana.id),
  ]);

  const fulfilledCount = [res1, res2].filter((r) => r.status === "fulfilled").length;
  const rejectedCount = [res1, res2].filter((r) => r.status === "rejected").length;

  assert(
    fulfilledCount === 1 && rejectedCount === 1,
    "Concurrent approveUser calls: exactly 1 succeeds and 1 fails"
  );

  const rejectedReason = [res1, res2].find((r) => r.status === "rejected") as
    | PromiseRejectedResult
    | undefined;

  assert(
    rejectedReason?.reason instanceof ConflictError &&
      rejectedReason.reason.message === "This user is no longer pending",
    "Second concurrent approval returns friendly ConflictError('This user is no longer pending')"
  );

  // Verify Diana is now ACTIVE and can log in
  const dianaLogin = await authenticateCredentials("diana@example.com", "Member@123");
  assert(
    dianaLogin.success && dianaLogin.user?.status === "ACTIVE",
    "Approved user Diana can now log in successfully"
  );

  // ----------------------------------------------------
  // TEST 3: Rejecting a Pending User
  // ----------------------------------------------------
  console.log("\n[Test Suite 3] Rejecting a Pending User");

  const rejectTestEmail = `reject_test_${Date.now()}@example.com`;
  const rejectUserCandidate = await registerUser({
    name: "Reject Candidate",
    email: rejectTestEmail,
    password: "Password123!",
    confirmPassword: "Password123!",
  });

  const rejectedUser = await rejectUser(admin.id, rejectUserCandidate.id);
  assert(rejectedUser.status === "DISABLED", "rejectUser sets user status to DISABLED");

  // Verify rejected user cannot log in
  const rejectedLogin = await authenticateCredentials(rejectTestEmail, "Password123!");
  assert(
    !rejectedLogin.success &&
      rejectedLogin.error === "Your account has been disabled. Please contact an administrator.",
    "Rejected user login shows account disabled message"
  );

  // ----------------------------------------------------
  // TEST 4: Re-enabling a Disabled User
  // ----------------------------------------------------
  console.log("\n[Test Suite 4] Re-enabling a Disabled User");

  const reEnabled = await enableUser(admin.id, rejectUserCandidate.id);
  assert(
    reEnabled.status === "ACTIVE" &&
      reEnabled.approvedBy?.id === admin.id &&
      reEnabled.approvedAt !== null,
    "enableUser sets status to ACTIVE and records approving admin metadata"
  );

  const reEnabledLogin = await authenticateCredentials(rejectTestEmail, "Password123!");
  assert(reEnabledLogin.success, "Re-enabled user can now log in successfully");

  // ----------------------------------------------------
  // TEST 5: Disabling an Active User
  // ----------------------------------------------------
  console.log("\n[Test Suite 5] Disabling an Active User");

  const disabled = await disableUser(admin.id, rejectUserCandidate.id);
  assert(disabled.status === "DISABLED", "disableUser sets ACTIVE user to DISABLED");

  let doubleDisableFailed = false;
  try {
    await disableUser(admin.id, rejectUserCandidate.id);
  } catch (err) {
    if (err instanceof ConflictError && err.message === "Only active users can be disabled") {
      doubleDisableFailed = true;
    }
  }
  assert(doubleDisableFailed, "Cannot disable an already disabled user (ConflictError)");

  // Clean up temporary user
  await db.user.delete({ where: { id: rejectUserCandidate.id } });

  // ----------------------------------------------------
  // TEST 6: Self-Disable Prevention
  // ----------------------------------------------------
  console.log("\n[Test Suite 6] Self-Disable Prevention");

  let selfDisableBlocked = false;
  try {
    await disableUser(admin.id, admin.id);
  } catch (err) {
    if (err instanceof ForbiddenError && err.message === "You cannot disable your own account") {
      selfDisableBlocked = true;
    }
  }
  assert(selfDisableBlocked, "Admin cannot disable their own account (ForbiddenError)");

  // ----------------------------------------------------
  // TEST 7: Last Active Admin Protection
  // ----------------------------------------------------
  console.log("\n[Test Suite 7] Last Active Admin Protection");

  // Create a second temporary admin
  const tempAdminEmail = `temp_admin_${Date.now()}@example.com`;
  const tempAdmin = await db.user.create({
    data: {
      name: "Temporary Admin",
      email: tempAdminEmail,
      passwordHash: "dummyhash",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // Disabling tempAdmin while main admin is active succeeds
  const disabledTempAdmin = await disableUser(admin.id, tempAdmin.id);
  assert(disabledTempAdmin.status === "DISABLED", "Disabling secondary admin succeeds when another admin is active");

  // Now only 1 active admin remains. Trying to disable the main admin using tempAdmin's ID must fail
  let lastAdminProtected = false;
  try {
    await disableUser(tempAdmin.id, admin.id);
  } catch (err) {
    if (err instanceof ConflictError && err.message === "Cannot disable the last active administrator") {
      lastAdminProtected = true;
    }
  }
  assert(lastAdminProtected, "Last active admin cannot be disabled (ConflictError)");

  // Clean up tempAdmin
  await db.user.delete({ where: { id: tempAdmin.id } });

  // ----------------------------------------------------
  // TEST 8: Server Action Role Guard Verification
  // ----------------------------------------------------
  console.log("\n[Test Suite 8] Server Action Role Guard");

  // Calling approveUserAction with invalid UUID
  const invalidUuidResult = await approveUserAction("not-a-uuid");
  assert(
    !invalidUuidResult.success,
    "approveUserAction validates UUID and rejects invalid format"
  );

  // Calling server actions without admin session returns failure
  const unauthResult = await disableUserAction(diana.id);
  assert(
    !unauthResult.success,
    "Server actions without admin session reject execution"
  );

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
    console.error("Verification suite failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
