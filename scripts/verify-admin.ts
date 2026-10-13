/**
 * Comprehensive verification suite for Admin Services and Management.
 * Covers:
 * Part 1: Phase 4 Admin User Management & Guards
 * Part 2: Phase 8 Admin Reservations Management & Usage Overview Dashboard
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
import {
  listAllReservations,
  cancelReservationAsAdmin,
} from "../src/services/reservations";
import {
  getDashboardSummary,
  getUsageByResource,
  computePeriodBounds,
} from "../src/services/stats";
import { adminReservationsQuerySchema } from "../src/lib/validation/admin-reservations";
import { toUtc, getTodayInAppTimezone } from "../src/lib/time";
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
  console.log("PHASE 4 & 8 ADMIN VERIFICATION SUITE");
  console.log("========================================================\n");

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const admin = await db.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, name: true, role: true, status: true },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Seed admin not found. Please ensure database is seeded.");
  }

  // ====================================================
  // PART 1: PHASE 4 ADMIN USER MANAGEMENT
  // ====================================================
  console.log("--------------------------------------------------------");
  console.log("PART 1: Phase 4 Admin User Management Verification");
  console.log("--------------------------------------------------------");

  // TEST 1: Safe Projection & Password Hash Protection
  console.log("[Test Suite 1] Safe Field Projection & Password Hash Privacy");
  const listResult = await listUsers({ page: 1, pageSize: 20 });
  assert(listResult.users.length > 0, "listUsers returns seeded users");
  const anyExposesHash = listResult.users.some((u) => "passwordHash" in u);
  assert(!anyExposesHash, "passwordHash is NEVER included in listUsers returned rows");

  const pendingCount = await countPendingUsers();
  assert(typeof pendingCount === "number" && pendingCount >= 0, "countPendingUsers returns valid number");

  const searchResult = await listUsers({ search: "alice" });
  assert(
    searchResult.users.some((u) => u.email === "alice@example.com"),
    "listUsers case-insensitive search correctly matches name/email"
  );

  const statusFilterResult = await listUsers({ status: "ACTIVE" });
  const allActive = statusFilterResult.users.every((u) => u.status === "ACTIVE");
  assert(allActive, "listUsers correctly filters by status");

  // TEST 2: Concurrent Approval Race Condition & Login
  console.log("\n[Test Suite 2] Concurrent Approval Race Condition & Diana Login");
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

  const dianaLogin = await authenticateCredentials("diana@example.com", "Member@123");
  assert(
    dianaLogin.success && dianaLogin.user?.status === "ACTIVE",
    "Approved user Diana can now log in successfully"
  );

  // TEST 3: Rejecting a Pending User
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

  const rejectedLogin = await authenticateCredentials(rejectTestEmail, "Password123!");
  assert(
    !rejectedLogin.success &&
      rejectedLogin.error === "Your account has been disabled. Please contact an administrator.",
    "Rejected user login shows account disabled message"
  );

  // TEST 4: Re-enabling a Disabled User
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

  // TEST 5: Disabling an Active User
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
  await db.user.delete({ where: { id: rejectUserCandidate.id } });

  // TEST 6: Self-Disable Prevention
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

  // TEST 7: Last Active Admin Protection
  console.log("\n[Test Suite 7] Last Active Admin Protection");
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

  const disabledTempAdmin = await disableUser(admin.id, tempAdmin.id);
  assert(disabledTempAdmin.status === "DISABLED", "Disabling secondary admin succeeds when another admin is active");

  let lastAdminProtected = false;
  try {
    await disableUser(tempAdmin.id, admin.id);
  } catch (err) {
    if (err instanceof ConflictError && err.message === "Cannot disable the last active administrator") {
      lastAdminProtected = true;
    }
  }
  assert(lastAdminProtected, "Last active admin cannot be disabled (ConflictError)");
  await db.user.delete({ where: { id: tempAdmin.id } });

  // TEST 8: Server Action Role Guard Verification
  console.log("\n[Test Suite 8] Server Action Role Guard");
  const invalidUuidResult = await approveUserAction("not-a-uuid");
  assert(!invalidUuidResult.success, "approveUserAction validates UUID and rejects invalid format");
  const unauthResult = await disableUserAction(diana.id);
  assert(!unauthResult.success, "Server actions without admin session reject execution");

  // Restore Diana to PENDING
  await db.user.updateMany({
    where: { email: "diana@example.com" },
    data: { status: "PENDING", approvedById: null, approvedAt: null },
  });

  // ====================================================
  // PART 2: PHASE 8 ADMIN RESERVATIONS & DASHBOARD
  // ====================================================
  console.log("\n--------------------------------------------------------");
  console.log("PART 2: Phase 8 Admin Reservations & Dashboard Verification");
  console.log("--------------------------------------------------------");

  const runId = Date.now();
  const createdUserIds: string[] = [];
  const createdResourceIds: string[] = [];
  let createdCategoryId: string | null = null;

  try {
    // ----------------------------------------------------
    // SETUP TEMPORARY TEST FIXTURES
    // ----------------------------------------------------
    console.log("\n[Setup] Creating isolated test users, category, and resources...");

    // Create 2 test users
    const userA = await db.user.create({
      data: {
        name: `Admin Tester Alpha`,
        email: `tester_alpha_${runId}@example.com`,
        passwordHash: "secret_hash_value_123",
        role: "MEMBER",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(userA.id);

    const userB = await db.user.create({
      data: {
        name: `Admin Tester Bravo`,
        email: `tester_bravo_${runId}@example.com`,
        passwordHash: "secret_hash_value_456",
        role: "MEMBER",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(userB.id);

    // Create test category
    const testCategory = await db.resourceCategory.create({
      data: {
        name: `Admin Category ${runId}`,
        description: "Category for Phase 8 test isolation",
      },
    });
    createdCategoryId = testCategory.id;

    // Create 3 resources:
    // res1: active
    // res2: active (0 reservations)
    // res3: inactive
    const res1 = await db.resource.create({
      data: {
        name: `Admin Test Res1 ${runId}`,
        categoryId: testCategory.id,
        isActive: true,
      },
    });
    createdResourceIds.push(res1.id);

    const res2 = await db.resource.create({
      data: {
        name: `Admin Test Res2 ${runId}`,
        categoryId: testCategory.id,
        isActive: true,
      },
    });
    createdResourceIds.push(res2.id);

    const res3 = await db.resource.create({
      data: {
        name: `Admin Test Res3 ${runId}`,
        categoryId: testCategory.id,
        isActive: false,
      },
    });
    createdResourceIds.push(res3.id);

    // ----------------------------------------------------
    // TEST 9: Zod Validation & Fallback Verification
    // ----------------------------------------------------
    console.log("\n[Test Suite 9] Zod Validation & Error Handling");

    const validQuery = adminReservationsQuerySchema.safeParse({
      status: "upcoming",
      page: "2",
      from: "2026-10-01",
      to: "2026-10-05",
    });
    assert(validQuery.success && validQuery.data.page === 2, "adminReservationsQuerySchema parses valid inputs");

    const invalidDateOrder = adminReservationsQuerySchema.safeParse({
      from: "2026-10-10",
      to: "2026-10-05",
    });
    assert(!invalidDateOrder.success, "adminReservationsQuerySchema rejects from > to");

    const fallbackQuery = adminReservationsQuerySchema.safeParse({
      resourceId: "not-a-uuid",
      status: "invalid-status",
      page: "-10",
    });
    assert(
      fallbackQuery.success &&
        fallbackQuery.data.resourceId === undefined &&
        fallbackQuery.data.status === "all" &&
        fallbackQuery.data.page === 1,
      "Invalid parameters safely fall back to default values instead of crashing"
    );

    // ----------------------------------------------------
    // TEST 10: Deterministic Usage Calculation (Exact Math & Clipping)
    // ----------------------------------------------------
    console.log("\n[Test Suite 10] getUsageByResource Exact Aggregation & Clipping");

    // Use "last7" period bounds
    const periodBounds = computePeriodBounds("last7");
    const { from: pFrom } = periodBounds;

    // Res 1:
    // Reservation 1: starts 2h before pFrom, ends 3h after pFrom (total 5h, clipped to 3.0h)
    const r1ClippedStart = new Date(pFrom.getTime() - 2 * 3600 * 1000);
    const r1ClippedEnd = new Date(pFrom.getTime() + 3 * 3600 * 1000);
    await db.reservation.create({
      data: {
        resourceId: res1.id,
        userId: userA.id,
        purpose: "Usage clipped test",
        startTime: r1ClippedStart,
        endTime: r1ClippedEnd,
        status: "CONFIRMED",
      },
    });

    // Reservation 2: fully inside, 2.0h (from + 4h to from + 6h)
    const r1InsideStart = new Date(pFrom.getTime() + 4 * 3600 * 1000);
    const r1InsideEnd = new Date(pFrom.getTime() + 6 * 3600 * 1000);
    await db.reservation.create({
      data: {
        resourceId: res1.id,
        userId: userA.id,
        purpose: "Usage inside test",
        startTime: r1InsideStart,
        endTime: r1InsideEnd,
        status: "CONFIRMED",
      },
    });

    // Reservation 3: inside period, 3.0h, but CANCELLED!
    const r1CancelledStart = new Date(pFrom.getTime() + 7 * 3600 * 1000);
    const r1CancelledEnd = new Date(pFrom.getTime() + 10 * 3600 * 1000);
    await db.reservation.create({
      data: {
        resourceId: res1.id,
        userId: userB.id,
        purpose: "Cancelled reservation test",
        startTime: r1CancelledStart,
        endTime: r1CancelledEnd,
        status: "CANCELLED",
        cancelledById: admin.id,
        cancelledAt: new Date(),
      },
    });

    // Res 2: 0 reservations.

    // Res 3 (inactive):
    // Reservation 4: 1.5h confirmed reservation
    const r3InsideStart = new Date(pFrom.getTime() + 10 * 3600 * 1000);
    const r3InsideEnd = new Date(pFrom.getTime() + 11.5 * 3600 * 1000);
    await db.reservation.create({
      data: {
        resourceId: res3.id,
        userId: userB.id,
        purpose: "Inactive resource reservation",
        startTime: r3InsideStart,
        endTime: r3InsideEnd,
        status: "CONFIRMED",
      },
    });

    // Fetch usage for "last7"
    const usageResult = await getUsageByResource("last7");

    const uRes1 = usageResult.resources.find((r) => r.resourceId === res1.id);
    const uRes2 = usageResult.resources.find((r) => r.resourceId === res2.id);
    const uRes3 = usageResult.resources.find((r) => r.resourceId === res3.id);

    assert(Boolean(uRes1), "getUsageByResource includes active resource with bookings");
    assert(
      uRes1?.reservationCount === 2 && uRes1?.bookedHours === 5.0,
      `Res1 exact math: 2 confirmed reservations, 5.0 clipped hours (got count=${uRes1?.reservationCount}, hours=${uRes1?.bookedHours})`
    );

    assert(Boolean(uRes2), "getUsageByResource includes resource with ZERO reservations via LEFT JOIN");
    assert(
      uRes2?.reservationCount === 0 && uRes2?.bookedHours === 0.0 && uRes2?.isActive === true,
      `Res2 zero bookings: count=0, hours=0, isActive=true (got count=${uRes2?.reservationCount}, hours=${uRes2?.bookedHours})`
    );

    assert(Boolean(uRes3), "getUsageByResource includes inactive resources");
    assert(
      uRes3?.reservationCount === 1 && uRes3?.bookedHours === 1.5 && uRes3?.isActive === false,
      `Res3 inactive resource: count=1, hours=1.5, isActive=false (got count=${uRes3?.reservationCount}, hours=${uRes3?.bookedHours}, isActive=${uRes3?.isActive})`
    );

    // ----------------------------------------------------
    // TEST 11: listAllReservations Filtering & Timezone Day Boundaries
    // ----------------------------------------------------
    console.log("\n[Test Suite 11] listAllReservations Filter Capabilities & Timezone Boundaries");

    const now = new Date();
    // Create status-specific reservations for res1 to test each status filter:
    // 1. Upcoming: start > now
    const upcomingStart = new Date(now.getTime() + 2 * 3600 * 1000);
    const upcomingEnd = new Date(now.getTime() + 3 * 3600 * 1000);
    const upcomingRes = await db.reservation.create({
      data: {
        resourceId: res1.id,
        userId: userA.id,
        purpose: "Upcoming session for Alpha",
        startTime: upcomingStart,
        endTime: upcomingEnd,
        status: "CONFIRMED",
      },
    });

    // 2. In progress: start <= now < end
    const inProgStart = new Date(now.getTime() - 15 * 60 * 1000);
    const inProgEnd = new Date(now.getTime() + 45 * 60 * 1000);
    await db.reservation.create({
      data: {
        resourceId: res1.id,
        userId: userB.id,
        purpose: "In progress session for Bravo",
        startTime: inProgStart,
        endTime: inProgEnd,
        status: "CONFIRMED",
      },
    });

    // 3. Completed: end <= now
    const compStart = new Date(now.getTime() - 4 * 3600 * 1000);
    const compEnd = new Date(now.getTime() - 3 * 3600 * 1000);
    await db.reservation.create({
      data: {
        resourceId: res1.id,
        userId: userA.id,
        purpose: "Completed session for Alpha",
        startTime: compStart,
        endTime: compEnd,
        status: "CONFIRMED",
      },
    });

    // Test filter by Resource
    const resFilterResult = await listAllReservations(
      { resourceId: res1.id },
      { actor: { role: "ADMIN" } }
    );
    const allRes1 = resFilterResult.items.every((item) => item.resource.id === res1.id);
    assert(
      resFilterResult.total >= 5 && allRes1,
      "listAllReservations filters accurately by resourceId"
    );

    // Test filter by User search (name or email, case-insensitive)
    const userSearchAlpha = await listAllReservations(
      { resourceId: res1.id, q: "tester alpha" },
      { actor: { role: "ADMIN" } }
    );
    const allAlpha = userSearchAlpha.items.every((item) => item.user.name.includes("Alpha"));
    assert(allAlpha && userSearchAlpha.total >= 3, "listAllReservations filters by user name (case-insensitive)");

    const userSearchEmailBravo = await listAllReservations(
      { resourceId: res1.id, q: "TESTER_BRAVO" },
      { actor: { role: "ADMIN" } }
    );
    const allBravo = userSearchEmailBravo.items.every((item) => item.user.email.includes("bravo"));
    assert(allBravo && userSearchEmailBravo.total >= 2, "listAllReservations filters by user email (case-insensitive)");

    // Test status filters
    const upcomingFiltered = await listAllReservations(
      { resourceId: res1.id, status: "upcoming" },
      { actor: { role: "ADMIN" } }
    );
    assert(
      upcomingFiltered.items.every((i) => i.displayStatus === "Upcoming"),
      "listAllReservations status='upcoming' maps correctly"
    );

    const inProgFiltered = await listAllReservations(
      { resourceId: res1.id, status: "in_progress" },
      { actor: { role: "ADMIN" } }
    );
    assert(
      inProgFiltered.items.every((i) => i.displayStatus === "In progress"),
      "listAllReservations status='in_progress' maps correctly"
    );

    const compFiltered = await listAllReservations(
      { resourceId: res1.id, status: "completed" },
      { actor: { role: "ADMIN" } }
    );
    assert(
      compFiltered.items.every((i) => i.displayStatus === "Completed"),
      "listAllReservations status='completed' maps correctly"
    );

    const cancFiltered = await listAllReservations(
      { resourceId: res1.id, status: "cancelled" },
      { actor: { role: "ADMIN" } }
    );
    assert(
      cancFiltered.items.every((i) => i.displayStatus === "Cancelled"),
      "listAllReservations status='cancelled' maps correctly"
    );

    // Test date range filter & Asia/Colombo day boundaries:
    // Create a reservation on target date at 23:30 Asia/Colombo
    const targetDateStr = "2027-06-15";
    const local2330Utc = toUtc(`${targetDateStr} 23:30:00`);
    const localNextDay0015Utc = toUtc("2027-06-16 00:15:00");

    await db.reservation.create({
      data: {
        resourceId: res2.id,
        userId: userA.id,
        purpose: "Late night local boundary test",
        startTime: local2330Utc,
        endTime: new Date(local2330Utc.getTime() + 20 * 60 * 1000),
        status: "CONFIRMED",
      },
    });

    await db.reservation.create({
      data: {
        resourceId: res2.id,
        userId: userA.id,
        purpose: "Next day early morning test",
        startTime: localNextDay0015Utc,
        endTime: new Date(localNextDay0015Utc.getTime() + 20 * 60 * 1000),
        status: "CONFIRMED",
      },
    });

    // Filtering exactly for targetDateStr (inclusive from & to)
    const boundaryCheck = await listAllReservations(
      { resourceId: res2.id, from: targetDateStr, to: targetDateStr },
      { actor: { role: "ADMIN" } }
    );

    assert(
      boundaryCheck.total === 1 && boundaryCheck.items[0].purpose === "Late night local boundary test",
      "Date range filter respects Asia/Colombo day boundaries (23:30 local included, 00:15 next day excluded)"
    );

    // ----------------------------------------------------
    // TEST 12: Combined Filters, Pagination & Safe Projection
    // ----------------------------------------------------
    console.log("\n[Test Suite 12] Combined Filters, Pagination & Security");

    const combinedResult = await listAllReservations(
      { resourceId: res1.id, q: "alpha", status: "upcoming" },
      { actor: { role: "ADMIN" }, page: 1, pageSize: 1 }
    );
    assert(
      combinedResult.total >= 1 && combinedResult.items.length === 1 && combinedResult.pageSize === 1,
      "Filters combine conjunctively and pagination pageSize is respected"
    );

    // Verify results NEVER contain passwordHash
    const anyAdminLeak = (combinedResult.items as unknown[]).some((item: unknown) => {
      const rec = item as Record<string, unknown>;
      const user = rec.user as Record<string, unknown> | undefined;
      return "passwordHash" in rec || (user && "passwordHash" in user);
    });
    assert(!anyAdminLeak, "listAllReservations results NEVER expose passwordHash");

    // ----------------------------------------------------
    // TEST 13: Controlled getDashboardSummary Delta Verification
    // ----------------------------------------------------
    console.log("\n[Test Suite 13] getDashboardSummary Delta Verification");

    const baseSummary = await getDashboardSummary();

    // Add controlled delta data:
    // 1 pending user (+1)
    const deltaUser = await db.user.create({
      data: {
        name: "Delta User",
        email: `delta_${runId}@example.com`,
        passwordHash: "hash",
        role: "MEMBER",
        status: "PENDING",
      },
    });
    createdUserIds.push(deltaUser.id);

    // 1 active resource (+1)
    const deltaResActive = await db.resource.create({
      data: {
        name: `Delta Active Res ${runId}`,
        categoryId: testCategory.id,
        isActive: true,
      },
    });
    createdResourceIds.push(deltaResActive.id);

    // 1 inactive resource (+1)
    const deltaResInactive = await db.resource.create({
      data: {
        name: `Delta Inactive Res ${runId}`,
        categoryId: testCategory.id,
        isActive: false,
      },
    });
    createdResourceIds.push(deltaResInactive.id);

    // 1 confirmed reservation starting today (+1 reservationsToday)
    const todayLocalStr = getTodayInAppTimezone(new Date());
    const deltaTodayStart = toUtc(`${todayLocalStr} 12:00:00`);
    const deltaTodayEnd = new Date(deltaTodayStart.getTime() + 30 * 60 * 1000);
    await db.reservation.create({
      data: {
        resourceId: deltaResActive.id,
        userId: userA.id,
        purpose: "Delta today booking",
        startTime: deltaTodayStart,
        endTime: deltaTodayEnd,
        status: "CONFIRMED",
      },
    });

    // 1 cancelled reservation in last 30 days (+1 cancelledLast30Days)
    await db.reservation.create({
      data: {
        resourceId: deltaResActive.id,
        userId: userA.id,
        purpose: "Delta cancelled booking",
        startTime: new Date(now.getTime() - 10 * 3600 * 1000),
        endTime: new Date(now.getTime() - 9 * 3600 * 1000),
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: admin.id,
      },
    });

    const newSummary = await getDashboardSummary();

    assert(
      newSummary.pendingUsers === baseSummary.pendingUsers + 1,
      `pendingUsers increased by 1 (delta: ${newSummary.pendingUsers - baseSummary.pendingUsers})`
    );
    assert(
      newSummary.activeResources === baseSummary.activeResources + 1,
      `activeResources increased by 1 (delta: ${newSummary.activeResources - baseSummary.activeResources})`
    );
    assert(
      newSummary.inactiveResources === baseSummary.inactiveResources + 1,
      `inactiveResources increased by 1 (delta: ${newSummary.inactiveResources - baseSummary.inactiveResources})`
    );
    assert(
      newSummary.reservationsToday === baseSummary.reservationsToday + 1,
      `reservationsToday increased by 1 (delta: ${newSummary.reservationsToday - baseSummary.reservationsToday})`
    );
    assert(
      newSummary.cancelledLast30Days === baseSummary.cancelledLast30Days + 1,
      `cancelledLast30Days increased by 1 (delta: ${newSummary.cancelledLast30Days - baseSummary.cancelledLast30Days})`
    );

    // ----------------------------------------------------
    // TEST 14: Admin Cancellation & Role Protection
    // ----------------------------------------------------
    console.log("\n[Test Suite 14] Admin Cancellation & Security Role Guards");

    // Admin cancels userA's upcoming reservation
    const cancelResult = await cancelReservationAsAdmin(
      { id: admin.id, role: "ADMIN" },
      upcomingRes.id
    );
    const cancelledRecord = await db.reservation.findUnique({
      where: { id: upcomingRes.id },
    });
    assert(
      cancelResult.success &&
        cancelledRecord?.status === "CANCELLED" &&
        cancelledRecord?.cancelledById === admin.id,
      "cancelReservationAsAdmin successfully cancels reservation and records admin actor"
    );

    // Verify slot is freed up by booking another reservation in that exact slot
    const rebooked = await db.reservation.create({
      data: {
        resourceId: res1.id,
        userId: userB.id,
        purpose: "Rebooking slot freed up by admin cancellation",
        startTime: upcomingStart,
        endTime: upcomingEnd,
        status: "CONFIRMED",
      },
    });
    assert(Boolean(rebooked.id), "Freed time slot is immediately available for new reservations");

    // Member actor must be rejected when attempting to call admin cancellation
    let memberForbidden = false;
    try {
      await cancelReservationAsAdmin(
        { id: userA.id, role: "MEMBER" },
        rebooked.id
      );
    } catch (err) {
      if (err instanceof ForbiddenError) {
        memberForbidden = true;
      }
    }
    assert(memberForbidden, "MEMBER actor is rejected with ForbiddenError by cancelReservationAsAdmin");

    // Member actor must be rejected when calling listAllReservations
    let listForbidden = false;
    try {
      await listAllReservations(undefined, { actor: { role: "MEMBER" } });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        listForbidden = true;
      }
    }
    assert(listForbidden, "MEMBER actor is rejected with ForbiddenError by listAllReservations");

    // Cancelling an already cancelled reservation produces friendly ConflictError
    let doubleCancelConflict = false;
    try {
      await cancelReservationAsAdmin(
        { id: admin.id, role: "ADMIN" },
        upcomingRes.id
      );
    } catch (err) {
      if (err instanceof ConflictError) {
        doubleCancelConflict = true;
      }
    }
    assert(doubleCancelConflict, "Cancelling already cancelled reservation throws ConflictError");

  } finally {
    // ----------------------------------------------------
    // CLEANUP TEMPORARY TEST FIXTURES
    // ----------------------------------------------------
    console.log("\n[Cleanup] Cleaning up temporary test fixtures...");

    if (createdResourceIds.length > 0) {
      await db.reservation.deleteMany({
        where: { resourceId: { in: createdResourceIds } },
      });
      await db.resource.deleteMany({
        where: { id: { in: createdResourceIds } },
      });
    }

    if (createdCategoryId) {
      await db.resourceCategory.deleteMany({
        where: { id: createdCategoryId },
      });
    }

    if (createdUserIds.length > 0) {
      await db.reservation.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await db.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    console.log("  ✓ Temporary fixtures cleaned up successfully.");
  }

  // ----------------------------------------------------
  // OVERALL RESULTS
  // ----------------------------------------------------
  console.log("\n========================================================");
  console.log(`TOTAL RESULTS: ${passed} passed, ${failed} failed`);
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
