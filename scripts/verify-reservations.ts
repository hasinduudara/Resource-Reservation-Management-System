/**
 * Phase 6 Verification Suite: Reservation Creation, Cancellation & List.
 *
 * Verifies:
 * 1. A valid reservation succeeds.
 * 2. An overlapping reservation on the same resource fails with ConflictError,
 *    and the message contains the blocking time range but NOT the other user's name.
 * 3. Back-to-back reservations succeed.
 * 4. The same time on a different resource succeeds.
 * 5. A cancelled reservation frees the slot for a new reservation.
 * 6. Past start, end <= start, a non-15-minute boundary, duration > 8 hours,
 *    more than 180 days ahead, and an inactive resource are each rejected with
 *    a ValidationError (or NotFoundError for the resource).
 * 7. Two createReservation calls for the same slot fired concurrently with Promise.all:
 *    exactly one succeeds and the other fails with ConflictError.
 * 8. A member cannot cancel another member's reservation; a member cannot cancel
 *    a reservation that already started; an admin can cancel anyone's upcoming reservation;
 *    cancelling twice returns a friendly error the second time.
 * 9. Time conversion: a local input "2026-12-01T10:00" (Asia/Colombo) is stored as 2026-12-01T04:30:00.000Z.
 */

import { db } from "../src/lib/db";
import {
  createReservation,
  cancelReservation,
  listMyReservations,
  listUpcomingForResource,
} from "../src/services/reservations";
import { formatInAppTimezone } from "../src/lib/time";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../src/lib/errors";

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
  console.log("PHASE 6 RESERVATIONS & BOOKING VERIFICATION SUITE");
  console.log("========================================================\n");

  const testId = `test_${Date.now()}`;

  // Temporary entities created for this verification run
  let testMember1: { id: string; email: string; name: string } | undefined = undefined;
  let testMember2: { id: string; email: string; name: string } | undefined = undefined;
  let testAdmin: { id: string; email: string; name: string } | undefined = undefined;
  let testCategory: { id: string; name: string } | undefined = undefined;
  let testResource1: { id: string; name: string } | undefined = undefined;
  let testResource2: { id: string; name: string } | undefined = undefined;
  let testInactiveResource: { id: string; name: string } | undefined = undefined;

  const createdReservationIds: string[] = [];

  try {
    // ----------------------------------------------------
    // SETUP: Create temporary users, category, and resources
    // ----------------------------------------------------
    testMember1 = await db.user.create({
      data: {
        name: "Test Member One",
        email: `member1_${testId}@example.com`,
        passwordHash: "hash_placeholder",
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    testMember2 = await db.user.create({
      data: {
        name: "Test Member Two",
        email: `member2_${testId}@example.com`,
        passwordHash: "hash_placeholder",
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    testAdmin = await db.user.create({
      data: {
        name: "Test Admin",
        email: `admin_${testId}@example.com`,
        passwordHash: "hash_placeholder",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    testCategory = await db.resourceCategory.create({
      data: {
        name: `Test Cat ${testId}`,
        description: "Category for automated reservation verification",
      },
    });

    testResource1 = await db.resource.create({
      data: {
        name: `Test Resource Alpha ${testId}`,
        categoryId: testCategory.id,
        isActive: true,
      },
    });

    testResource2 = await db.resource.create({
      data: {
        name: `Test Resource Beta ${testId}`,
        categoryId: testCategory.id,
        isActive: true,
      },
    });

    testInactiveResource = await db.resource.create({
      data: {
        name: `Test Inactive Resource ${testId}`,
        categoryId: testCategory.id,
        isActive: false,
      },
    });

    // Compute safe future dates (around 10 days ahead)
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const dayStr = formatInAppTimezone(futureDate, "yyyy-MM-dd");

    const slot1Start = `${dayStr}T10:00`;
    const slot1End = `${dayStr}T11:00`;

    // ----------------------------------------------------
    // TEST 1: Valid Reservation Creation
    // ----------------------------------------------------
    console.log("[Test Suite 1] Valid Reservation Creation");

    const res1 = await createReservation(testMember1.id, {
      resourceId: testResource1.id,
      purpose: "Sprint Planning Meeting",
      startLocal: slot1Start,
      endLocal: slot1End,
    });
    createdReservationIds.push(res1.id);

    assert(
      res1.id !== undefined && res1.status === "CONFIRMED",
      "Valid reservation succeeds with status CONFIRMED"
    );
    assert(
      res1.purpose === "Sprint Planning Meeting",
      "Reservation records purpose accurately"
    );

    // ----------------------------------------------------
    // TEST 2: Overlapping Reservation Rejection & Message Privacy
    // ----------------------------------------------------
    console.log("\n[Test Suite 2] Overlap Prevention & Privacy Message");

    let overlapCaught = false;
    let overlapMessage = "";

    try {
      // Overlapping slot: 10:30 to 11:30 on same resource
      await createReservation(testMember2.id, {
        resourceId: testResource1.id,
        purpose: "Conflicting Client Presentation",
        startLocal: `${dayStr}T10:30`,
        endLocal: `${dayStr}T11:30`,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        overlapCaught = true;
        overlapMessage = err.message;
      }
    }

    assert(overlapCaught, "Overlapping reservation on same resource fails with ConflictError");
    assert(
      overlapMessage.includes("10:00") && overlapMessage.includes("11:00"),
      "Conflict error message includes the blocking time range (10:00 to 11:00)",
      `Message: "${overlapMessage}"`
    );
    assert(
      !overlapMessage.toLowerCase().includes("test member one") &&
        !overlapMessage.toLowerCase().includes(testMember1.email.toLowerCase()),
      "Conflict error message does NOT reveal the booking user's identity"
    );

    // ----------------------------------------------------
    // TEST 3: Back-to-Back Reservations
    // ----------------------------------------------------
    console.log("\n[Test Suite 3] Back-to-Back Reservations");

    // Immediately following slot: 11:00 to 12:00 on testResource1
    const res2 = await createReservation(testMember2.id, {
      resourceId: testResource1.id,
      purpose: "Design System Review",
      startLocal: `${dayStr}T11:00`,
      endLocal: `${dayStr}T12:00`,
    });
    createdReservationIds.push(res2.id);

    assert(
      res2.id !== undefined && res2.status === "CONFIRMED",
      "Back-to-back reservation (11:00-12:00 immediately following 10:00-11:00) succeeds"
    );

    // ----------------------------------------------------
    // TEST 4: Same Time on Different Resource
    // ----------------------------------------------------
    console.log("\n[Test Suite 4] Cross-Resource Independence");

    // Same time slot 10:00 to 11:00 on testResource2
    const resDifferentResource = await createReservation(testMember2.id, {
      resourceId: testResource2.id,
      purpose: "Different Resource Concurrent Booking",
      startLocal: slot1Start,
      endLocal: slot1End,
    });
    createdReservationIds.push(resDifferentResource.id);

    assert(
      resDifferentResource.id !== undefined && resDifferentResource.status === "CONFIRMED",
      "Same time slot on a different resource succeeds"
    );

    // ----------------------------------------------------
    // TEST 5: Cancelled Reservation Frees the Slot
    // ----------------------------------------------------
    console.log("\n[Test Suite 5] Slot Reclamation on Cancellation");

    // Member 1 cancels res1 (which was 10:00 to 11:00 on testResource1)
    await cancelReservation({ id: testMember1.id, role: "MEMBER" }, res1.id);

    // Now Member 2 can book the newly freed 10:00 to 11:00 slot
    const resFreed = await createReservation(testMember2.id, {
      resourceId: testResource1.id,
      purpose: "Newly Freed Slot Booking",
      startLocal: slot1Start,
      endLocal: slot1End,
    });
    createdReservationIds.push(resFreed.id);

    assert(
      resFreed.id !== undefined && resFreed.status === "CONFIRMED",
      "Cancelled reservation frees the slot for a new booking"
    );

    // ----------------------------------------------------
    // TEST 6: Validation Rules & Inactive Resource Guard
    // ----------------------------------------------------
    console.log("\n[Test Suite 6] Validation Rules & Guards");

    // 6a. Past start time
    let pastCaught = false;
    try {
      await createReservation(testMember1.id, {
        resourceId: testResource1.id,
        purpose: "Past booking attempt",
        startLocal: "2020-01-01T10:00",
        endLocal: "2020-01-01T11:00",
      });
    } catch (err) {
      if (err instanceof ValidationError) pastCaught = true;
    }
    assert(pastCaught, "Past start time is rejected with ValidationError");

    // 6b. End <= Start
    let endBeforeStartCaught = false;
    try {
      await createReservation(testMember1.id, {
        resourceId: testResource1.id,
        purpose: "Reversed times attempt",
        startLocal: `${dayStr}T14:00`,
        endLocal: `${dayStr}T13:00`,
      });
    } catch (err) {
      if (err instanceof ValidationError) endBeforeStartCaught = true;
    }
    assert(endBeforeStartCaught, "End time <= start time is rejected with ValidationError");

    // 6c. Non-15-minute boundary
    let non15MinCaught = false;
    try {
      await createReservation(testMember1.id, {
        resourceId: testResource1.id,
        purpose: "Unaligned slot attempt",
        startLocal: `${dayStr}T14:07`,
        endLocal: `${dayStr}T15:00`,
      });
    } catch (err) {
      if (err instanceof ValidationError) non15MinCaught = true;
    }
    assert(non15MinCaught, "Non-15-minute boundary is rejected with ValidationError");

    // 6d. Duration > 8 hours (e.g. 9 hours)
    let maxDurationCaught = false;
    try {
      await createReservation(testMember1.id, {
        resourceId: testResource1.id,
        purpose: "Too long meeting",
        startLocal: `${dayStr}T08:00`,
        endLocal: `${dayStr}T17:30`, // 9.5 hours
      });
    } catch (err) {
      if (err instanceof ValidationError) maxDurationCaught = true;
    }
    assert(maxDurationCaught, "Duration > 8 hours is rejected with ValidationError");

    // 6e. More than 180 days ahead
    let maxAdvanceCaught = false;
    const farFutureDate = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000);
    const farDayStr = formatInAppTimezone(farFutureDate, "yyyy-MM-dd");
    try {
      await createReservation(testMember1.id, {
        resourceId: testResource1.id,
        purpose: "Far future booking",
        startLocal: `${farDayStr}T10:00`,
        endLocal: `${farDayStr}T11:00`,
      });
    } catch (err) {
      if (err instanceof ValidationError) maxAdvanceCaught = true;
    }
    assert(maxAdvanceCaught, "Start time > 180 days ahead is rejected with ValidationError");

    // 6f. Inactive resource
    let inactiveCaught = false;
    try {
      await createReservation(testMember1.id, {
        resourceId: testInactiveResource.id,
        purpose: "Inactive resource booking attempt",
        startLocal: `${dayStr}T15:00`,
        endLocal: `${dayStr}T16:00`,
      });
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) {
        inactiveCaught = true;
      }
    }
    assert(inactiveCaught, "Inactive resource is rejected with ValidationError or NotFoundError");

    // ----------------------------------------------------
    // TEST 7: Concurrent Slot Booking (Promise.all Race Condition)
    // ----------------------------------------------------
    console.log("\n[Test Suite 7] Concurrent Booking Race Condition");

    const concurrentSlotStart = `${dayStr}T16:00`;
    const concurrentSlotEnd = `${dayStr}T17:00`;

    const [raceRes1, raceRes2] = await Promise.allSettled([
      createReservation(testMember1.id, {
        resourceId: testResource1.id,
        purpose: "Concurrent Race Participant 1",
        startLocal: concurrentSlotStart,
        endLocal: concurrentSlotEnd,
      }),
      createReservation(testMember2.id, {
        resourceId: testResource1.id,
        purpose: "Concurrent Race Participant 2",
        startLocal: concurrentSlotStart,
        endLocal: concurrentSlotEnd,
      }),
    ]);

    const successes = [raceRes1, raceRes2].filter((r) => r.status === "fulfilled");
    const rejections = [raceRes1, raceRes2].filter((r) => r.status === "rejected");

    if (raceRes1.status === "fulfilled") createdReservationIds.push(raceRes1.value.id);
    if (raceRes2.status === "fulfilled") createdReservationIds.push(raceRes2.value.id);

    assert(
      successes.length === 1 && rejections.length === 1,
      "Concurrent Promise.all bookings: exactly one succeeds and one fails"
    );

    const rejectedError = rejections[0] && (rejections[0] as PromiseRejectedResult).reason;
    assert(
      rejectedError instanceof ConflictError,
      "The losing concurrent booking fails with ConflictError"
    );

    // ----------------------------------------------------
    // TEST 8: Cancellation Security & Status Integrity
    // ----------------------------------------------------
    console.log("\n[Test Suite 8] Cancellation Rules & Role Protections");

    // 8a. Member cannot cancel another member's reservation
    let otherMemberCancelCaught = false;
    try {
      await cancelReservation(
        { id: testMember1.id, role: "MEMBER" },
        res2.id // res2 belongs to Member 2
      );
    } catch (err) {
      if (err instanceof ForbiddenError || err instanceof ConflictError) {
        otherMemberCancelCaught = true;
      }
    }
    assert(otherMemberCancelCaught, "Member cannot cancel another member's reservation");

    // 8b. Member cannot cancel a reservation that already started
    // Insert an already started reservation directly into DB for testing
    const pastStart = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
    const futureEnd = new Date(Date.now() + 30 * 60 * 1000); // 30 mins from now
    const startedRes = await db.reservation.create({
      data: {
        resourceId: testResource2.id,
        userId: testMember1.id,
        purpose: "Already Started Meeting",
        startTime: pastStart,
        endTime: futureEnd,
        status: "CONFIRMED",
      },
    });
    createdReservationIds.push(startedRes.id);

    let startedCancelCaught = false;
    try {
      await cancelReservation({ id: testMember1.id, role: "MEMBER" }, startedRes.id);
    } catch (err) {
      if (err instanceof ConflictError) {
        startedCancelCaught = true;
      }
    }
    assert(startedCancelCaught, "Member cannot cancel a reservation that has already started");

    // 8c. Admin CAN cancel anyone's upcoming reservation
    let adminCancelSuccess = false;
    try {
      const adminCancelResult = await cancelReservation(
        { id: testAdmin.id, role: "ADMIN" },
        res2.id
      );
      adminCancelSuccess = adminCancelResult.success;
    } catch {
      adminCancelSuccess = false;
    }
    assert(adminCancelSuccess, "Admin can cancel any member's upcoming reservation");

    // 8d. Cancelling twice returns a friendly error
    let doubleCancelCaught = false;
    let doubleCancelMessage = "";
    try {
      await cancelReservation({ id: testAdmin.id, role: "ADMIN" }, res2.id);
    } catch (err) {
      if (err instanceof ConflictError) {
        doubleCancelCaught = true;
        doubleCancelMessage = err.message;
      }
    }
    assert(
      doubleCancelCaught && doubleCancelMessage.includes("already been cancelled"),
      "Cancelling twice returns friendly ConflictError ('already been cancelled')"
    );

    // ----------------------------------------------------
    // TEST 9: Timezone & UTC Storage Conversion
    // ----------------------------------------------------
    console.log("\n[Test Suite 9] Local to UTC Conversion Accuracy");

    // Use a fixed future local time in Asia/Colombo (UTC+5:30)
    // 2026-12-01T10:00 (Asia/Colombo) -> 2026-12-01T04:30:00.000Z
    const localInputStart = "2026-12-01T10:00";
    const localInputEnd = "2026-12-01T11:00";

    const tzRes = await createReservation(testMember1.id, {
      resourceId: testResource2.id,
      purpose: "Timezone Verification Booking",
      startLocal: localInputStart,
      endLocal: localInputEnd,
    });
    createdReservationIds.push(tzRes.id);

    const storedReservation = await db.reservation.findUnique({
      where: { id: tzRes.id },
      select: { startTime: true, endTime: true },
    });

    const expectedUtcIso = "2026-12-01T04:30:00.000Z";
    const actualUtcIso = storedReservation?.startTime.toISOString();

    assert(
      actualUtcIso === expectedUtcIso,
      `Local "2026-12-01T10:00" in Asia/Colombo is correctly stored as ${expectedUtcIso}`,
      `Actual: ${actualUtcIso}`
    );

    // ----------------------------------------------------
    // TEST 10: Query Functions (listMyReservations & listUpcomingForResource)
    // ----------------------------------------------------
    console.log("\n[Test Suite 10] Reservation Query Functions");

    const myUpcoming = await listMyReservations({
      userId: testMember1.id,
      tab: "upcoming",
    });
    assert(
      myUpcoming.items.length > 0 && myUpcoming.items.every((i) => i.displayStatus !== "Cancelled"),
      "listMyReservations upcoming returns active bookings"
    );

    const upcomingSlots = await listUpcomingForResource(testResource2.id, {
      days: 60,
      viewerId: testMember1.id,
    });
    assert(
      upcomingSlots.length > 0 &&
        upcomingSlots.some((s) => s.isMine) &&
        !Object.prototype.hasOwnProperty.call(upcomingSlots[0], "userName") &&
        !Object.prototype.hasOwnProperty.call(upcomingSlots[0], "purpose"),
      "listUpcomingForResource omits user identity and purposes for privacy"
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
  } finally {
    // ----------------------------------------------------
    // CLEANUP: Clean up all created test data
    // ----------------------------------------------------
    try {
      if (createdReservationIds.length > 0) {
        await db.reservation.deleteMany({
          where: { id: { in: createdReservationIds } },
        });
      }

      await db.reservation.deleteMany({
        where: {
          OR: [
            { userId: testMember1?.id },
            { userId: testMember2?.id },
            { userId: testAdmin?.id },
            { resourceId: testResource1?.id },
            { resourceId: testResource2?.id },
            { resourceId: testInactiveResource?.id },
          ],
        },
      });

      if (testResource1?.id || testResource2?.id || testInactiveResource?.id) {
        await db.resource.deleteMany({
          where: {
            id: {
              in: [testResource1?.id, testResource2?.id, testInactiveResource?.id].filter(
                Boolean
              ) as string[],
            },
          },
        });
      }

      if (testCategory?.id) {
        await db.resourceCategory.delete({
          where: { id: testCategory.id },
        });
      }

      if (testMember1?.id || testMember2?.id || testAdmin?.id) {
        await db.user.deleteMany({
          where: {
            id: {
              in: [testMember1?.id, testMember2?.id, testAdmin?.id].filter(Boolean) as string[],
            },
          },
        });
      }
    } catch (cleanupErr) {
      console.error("Cleanup warning:", cleanupErr);
    } finally {
      await db.$disconnect();
    }
  }
}

runTests().catch((err) => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
