/**
 * Verification suite for Phase 8.5: Role Policies & Admin Promote/Demote.
 *
 * Verifies:
 * 1. createReservation as ADMIN is rejected with ForbiddenError
 * 2. A MEMBER can still book reservations successfully
 * 3. Promoting an ACTIVE member to ADMIN works
 * 4. Promoting a PENDING or DISABLED user is rejected with ConflictError
 * 5. An admin cannot change their own role (ForbiddenError)
 * 6. The last active admin cannot be demoted (ConflictError)
 * 7. Demoting an admin works when another active admin exists
 * 8. A MEMBER actor calling setUserRole is rejected with ForbiddenError
 * 9. Promoted user's role is read as ADMIN by the getCurrentUser code path
 */

import { db } from "../src/lib/db";
import { createReservation } from "../src/services/reservations";
import { setUserRole } from "../src/services/users";
import { setUserRoleAction } from "../src/app/(admin)/admin/users/actions";
import { ConflictError, ForbiddenError } from "../src/lib/errors";
import { formatInAppTimezone } from "../src/lib/time";

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
  console.log("PHASE 8.5 ROLE POLICIES & PROMOTE/DEMOTE VERIFICATION");
  console.log("========================================================\n");

  const runId = Date.now();
  const createdUserIds: string[] = [];
  const createdResourceIds: string[] = [];
  let createdCategoryId: string | null = null;

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const admin = await db.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, name: true, role: true, status: true },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Seed admin not found. Ensure database is seeded.");
  }

  try {
    // ----------------------------------------------------
    // SETUP: Create isolated category and resource
    // ----------------------------------------------------
    const category = await db.resourceCategory.create({
      data: {
        name: `Roles Test Category ${runId}`,
        description: "Category for Phase 8.5 role policy verification",
      },
    });
    createdCategoryId = category.id;

    const resource = await db.resource.create({
      data: {
        name: `Roles Test Resource ${runId}`,
        categoryId: category.id,
        isActive: true,
      },
    });
    createdResourceIds.push(resource.id);

    // Create an active member for booking
    const activeMember = await db.user.create({
      data: {
        name: `Active Member ${runId}`,
        email: `active_member_${runId}@example.com`,
        passwordHash: "dummyhash",
        role: "MEMBER",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(activeMember.id);

    // ----------------------------------------------------
    // TEST 1: Admin Booking Prohibition
    // ----------------------------------------------------
    console.log("[Test Suite 1] Admin Booking Prohibition");

    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const dateStr = formatInAppTimezone(futureDate, "yyyy-MM-dd");

    let adminBlockedByRoleObject = false;
    let adminErrorMessage = "";
    try {
      await createReservation(
        { id: admin.id, role: "ADMIN" },
        {
          resourceId: resource.id,
          purpose: "Admin Attempted Booking",
          startLocal: `${dateStr}T10:00`,
          endLocal: `${dateStr}T11:00`,
        }
      );
    } catch (err) {
      if (err instanceof ForbiddenError) {
        adminBlockedByRoleObject = true;
        adminErrorMessage = err.message;
      }
    }
    assert(
      adminBlockedByRoleObject &&
        adminErrorMessage === "Administrators manage the system and cannot make reservations.",
      "createReservation as ADMIN actor object is rejected with ForbiddenError"
    );

    let adminBlockedByUserIdLookup = false;
    try {
      // Testing string actor lookup fallback
      await createReservation(admin.id, {
        resourceId: resource.id,
        purpose: "Admin Attempted Booking via String ID",
        startLocal: `${dateStr}T11:00`,
        endLocal: `${dateStr}T12:00`,
      });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        adminBlockedByUserIdLookup = true;
      }
    }
    assert(
      adminBlockedByUserIdLookup,
      "createReservation with admin userId string is rejected with ForbiddenError"
    );

    // ----------------------------------------------------
    // TEST 2: Member Booking
    // ----------------------------------------------------
    console.log("\n[Test Suite 2] Member Booking Validation");

    const memberReservation = await createReservation(
      { id: activeMember.id, role: "MEMBER" },
      {
        resourceId: resource.id,
        purpose: "Legitimate Member Booking",
        startLocal: `${dateStr}T10:00`,
        endLocal: `${dateStr}T11:00`,
      }
    );
    assert(
      memberReservation.status === "CONFIRMED" &&
        memberReservation.userId === activeMember.id,
      "A MEMBER can still book reservations successfully"
    );

    // ----------------------------------------------------
    // TEST 3: Promoting an ACTIVE Member to ADMIN
    // ----------------------------------------------------
    console.log("\n[Test Suite 3] Promoting an ACTIVE Member to ADMIN");

    const promoted = await setUserRole(admin.id, activeMember.id, "ADMIN");
    assert(
      promoted.role === "ADMIN" && !("passwordHash" in promoted),
      "Promoting an ACTIVE member to ADMIN succeeds and returns safe fields"
    );

    const promotedInDb = await db.user.findUnique({
      where: { id: activeMember.id },
      select: { role: true },
    });
    assert(promotedInDb?.role === "ADMIN", "Database record reflects promoted role ADMIN");

    // ----------------------------------------------------
    // TEST 4: Promoting PENDING or DISABLED Users
    // ----------------------------------------------------
    console.log("\n[Test Suite 4] Promoting PENDING or DISABLED Users is Rejected");

    const pendingUser = await db.user.create({
      data: {
        name: `Pending Candidate ${runId}`,
        email: `pending_${runId}@example.com`,
        passwordHash: "dummyhash",
        role: "MEMBER",
        status: "PENDING",
      },
    });
    createdUserIds.push(pendingUser.id);

    let pendingRejected = false;
    let pendingMessage = "";
    try {
      await setUserRole(admin.id, pendingUser.id, "ADMIN");
    } catch (err) {
      if (err instanceof ConflictError) {
        pendingRejected = true;
        pendingMessage = err.message;
      }
    }
    assert(
      pendingRejected && pendingMessage === "Only active users can change role",
      "Promoting a PENDING user is rejected with ConflictError('Only active users can change role')"
    );

    const disabledUser = await db.user.create({
      data: {
        name: `Disabled Candidate ${runId}`,
        email: `disabled_${runId}@example.com`,
        passwordHash: "dummyhash",
        role: "MEMBER",
        status: "DISABLED",
      },
    });
    createdUserIds.push(disabledUser.id);

    let disabledRejected = false;
    try {
      await setUserRole(admin.id, disabledUser.id, "ADMIN");
    } catch (err) {
      if (err instanceof ConflictError && err.message === "Only active users can change role") {
        disabledRejected = true;
      }
    }
    assert(
      disabledRejected,
      "Promoting a DISABLED user is rejected with ConflictError('Only active users can change role')"
    );

    // ----------------------------------------------------
    // TEST 5: Self-Role Change Prevention
    // ----------------------------------------------------
    console.log("\n[Test Suite 5] Self-Role Change Prevention");

    let selfChangeBlocked = false;
    try {
      await setUserRole(admin.id, admin.id, "MEMBER");
    } catch (err) {
      if (err instanceof ForbiddenError && err.message === "You cannot change your own role") {
        selfChangeBlocked = true;
      }
    }
    assert(selfChangeBlocked, "An admin cannot change their own role (ForbiddenError)");

    // ----------------------------------------------------
    // TEST 6 & 7: Last Active Admin Protection & Multi-Admin Demotion
    // ----------------------------------------------------
    console.log("\n[Test Suite 6 & 7] Demotion Rules & Last Active Admin Protection");

    // Right now activeMember was promoted to ADMIN, so 2 active admins exist: admin and activeMember.
    // Demoting activeMember back to MEMBER must succeed because 2 active admins exist
    const demoted = await setUserRole(admin.id, activeMember.id, "MEMBER");
    assert(
      demoted.role === "MEMBER",
      "Demoting an admin works when another active admin exists"
    );

    // Now only 1 active admin remains (the main admin).
    // Create a temporary admin actor to attempt demoting the last active admin
    const tempActorAdmin = await db.user.create({
      data: {
        name: `Temp Actor Admin ${runId}`,
        email: `temp_actor_${runId}@example.com`,
        passwordHash: "dummyhash",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(tempActorAdmin.id);

    // Now 2 active admins exist again (admin and tempActorAdmin). Demote tempActorAdmin:
    await setUserRole(admin.id, tempActorAdmin.id, "MEMBER");

    // Now only 1 active admin exists (admin). Attempting to demote the admin using tempActorAdmin (now member) or if admin was targeted:
    // To cleanly test "Cannot demote the last active administrator", create a 2nd admin that gets disabled, so only 1 ACTIVE admin exists.
    const disabledAdmin = await db.user.create({
      data: {
        name: `Disabled Admin ${runId}`,
        email: `disabled_admin_${runId}@example.com`,
        passwordHash: "dummyhash",
        role: "ADMIN",
        status: "DISABLED",
      },
    });
    createdUserIds.push(disabledAdmin.id);

    // Create a helper admin B so admin can demote, then test demoting B when only B is active:
    const adminB = await db.user.create({
      data: {
        name: `Admin Beta ${runId}`,
        email: `admin_beta_${runId}@example.com`,
        passwordHash: "dummyhash",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(adminB.id);

    // Disable main admin temporarily to leave adminB as the ONLY active admin
    await db.user.update({
      where: { id: admin.id },
      data: { status: "DISABLED" },
    });

    let lastAdminProtected = false;
    try {
      // Re-enable admin temporarily as actor to call, but adminB is the sole active admin:
      // In transaction: activeAdminCount for target adminB will be 1!
      // To satisfy adminId check, temporarily enable a caller admin C:
      const adminCaller = await db.user.create({
        data: {
          name: `Admin Caller ${runId}`,
          email: `admin_caller_${runId}@example.com`,
          passwordHash: "dummyhash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      createdUserIds.push(adminCaller.id);

      // Now activeAdminCount = 2 (adminB and adminCaller).
      // Demote adminCaller self -> not allowed.
      // Demote adminB -> succeeds.
      await setUserRole(adminCaller.id, adminB.id, "MEMBER");

      // Now only adminCaller is active admin!
      // If someone tries to demote adminCaller... self is blocked.
      // What if an external function calls demote on adminCaller with adminCaller? Blocked by self.
      // What if an admin D (e.g. re-enabled admin) tries to demote adminCaller when only adminCaller is active?
      // Restore admin to ACTIVE:
      await db.user.update({
        where: { id: admin.id },
        data: { status: "ACTIVE" },
      });
      // Demote adminCaller:
      await setUserRole(admin.id, adminCaller.id, "MEMBER");

      // Now admin is the ONLY active admin in the entire database!
      // If a service call tries to demote admin, target is admin and activeAdminCount is 1:
      // Even if called by another simulated admin ID in DB:
      const rogueAdmin = await db.user.create({
        data: {
          name: `Rogue Admin ${runId}`,
          email: `rogue_${runId}@example.com`,
          passwordHash: "dummyhash",
          role: "ADMIN",
          status: "DISABLED", // Not active
        },
      });
      createdUserIds.push(rogueAdmin.id);

      // Make rogueAdmin ACTIVE:
      await db.user.update({ where: { id: rogueAdmin.id }, data: { status: "ACTIVE" } });
      // Now 2 active admins (admin and rogueAdmin).
      // Demote rogueAdmin -> succeeds.
      await setUserRole(admin.id, rogueAdmin.id, "MEMBER");

      // Now again only admin is ACTIVE.
      // What if a transaction tries to demote admin when activeAdminCount <= 1?
      // Let's create an admin X who is ACTIVE, so 2 exist.
      const adminX = await db.user.create({
        data: {
          name: `Admin X ${runId}`,
          email: `admin_x_${runId}@example.com`,
          passwordHash: "dummyhash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      createdUserIds.push(adminX.id);

      // Now disable admin so adminX is the ONLY active admin:
      await db.user.update({ where: { id: admin.id }, data: { status: "DISABLED" } });

      // Create a temporary caller admin Y that will demote adminX, but wait:
      // If we run tx on adminX where activeAdminCount <= 1:
      const adminY = await db.user.create({
        data: {
          name: `Admin Y ${runId}`,
          email: `admin_y_${runId}@example.com`,
          passwordHash: "dummyhash",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      createdUserIds.push(adminY.id);

      // Disable adminY so only adminX is ACTIVE:
      await db.user.update({ where: { id: adminY.id }, data: { status: "DISABLED" } });

      // If adminY (even if forced as caller) tries to demote adminX:
      // In setUserRole, adminActor check checks adminY is ACTIVE?
      // Let's check: adminY has role ADMIN.
      // If adminY calls setUserRole(adminY.id, adminX.id, "MEMBER"):
      // tx counts active admins (only adminX is active, so activeAdminCount = 1).
      // It should throw ConflictError("Cannot demote the last active administrator")!
      await setUserRole(adminY.id, adminX.id, "MEMBER");
    } catch (err) {
      if (err instanceof ConflictError && err.message === "Cannot demote the last active administrator") {
        lastAdminProtected = true;
      }
    } finally {
      // Ensure main admin is restored to ACTIVE
      await db.user.update({
        where: { id: admin.id },
        data: { status: "ACTIVE" },
      });
    }

    assert(
      lastAdminProtected,
      "The last active admin cannot be demoted (ConflictError('Cannot demote the last active administrator'))"
    );

    // ----------------------------------------------------
    // TEST 8: Member Actor Rejected for setUserRole
    // ----------------------------------------------------
    console.log("\n[Test Suite 8] Member Role Security Guard");

    let memberRoleChangeBlocked = false;
    try {
      await setUserRole(activeMember.id, pendingUser.id, "ADMIN");
    } catch (err) {
      if (err instanceof ForbiddenError && err.message === "Only administrators can change user roles") {
        memberRoleChangeBlocked = true;
      }
    }
    assert(
      memberRoleChangeBlocked,
      "A MEMBER actor calling setUserRole is rejected with ForbiddenError"
    );

    // Server action without admin session
    const unauthAction = await setUserRoleAction(activeMember.id, "ADMIN");
    assert(
      !unauthAction.success,
      "setUserRoleAction without admin session is rejected"
    );

    // ----------------------------------------------------
    // TEST 9: getCurrentUser Role Read Immediacy
    // ----------------------------------------------------
    console.log("\n[Test Suite 9] Promoted Role Read Immediacy (No Token Caching)");

    // Promote activeMember to ADMIN
    await setUserRole(admin.id, activeMember.id, "ADMIN");

    // Exactly replicate getCurrentUser's database query:
    const freshUser = await db.user.findUnique({
      where: { id: activeMember.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    assert(
      freshUser !== null && freshUser.role === "ADMIN",
      "Promoted user's role is immediately read as ADMIN by the getCurrentUser query path"
    );

    // Verify existing reservations of activeMember are untouched
    const memberReservationsAfterPromotion = await db.reservation.findMany({
      where: { userId: activeMember.id },
    });
    assert(
      memberReservationsAfterPromotion.length >= 1 &&
        memberReservationsAfterPromotion[0].id === memberReservation.id &&
        memberReservationsAfterPromotion[0].status === "CONFIRMED",
      "Existing reservations of promoted user remain untouched and confirmed"
    );

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

    // Ensure main seed admin is ACTIVE and ADMIN
    await db.user.updateMany({
      where: { email: adminEmail },
      data: { status: "ACTIVE", role: "ADMIN" },
    });

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
