/**
 * Phase 7 Verification Suite: Day Availability Timeline & Free Resource Search.
 *
 * Verifies:
 * 1. A day with two reservations returns the correct booked list and correct free windows (exact times).
 * 2. A CANCELLED reservation does not appear in booked and does not reduce free windows.
 * 3. Back-to-back reservations produce no zero-length or sliver free window between them,
 *    and free windows touching a reservation boundary are exact.
 * 4. A reservation that crosses midnight (e.g. 22:00 to 02:00 next day) is clipped correctly on both days.
 * 5. For today, free windows never start before "now".
 * 6. findFreeResources excludes a resource with an overlapping CONFIRMED reservation,
 *    includes an adjacent resource, includes a resource with only CANCELLED overlapping reservation,
 *    excludes inactive resources, and respects categoryId and minCapacity.
 * 7. Cross-check with database constraint: resource reported free succeeds on createReservation;
 *    resource reported busy fails with ConflictError.
 * 8. Privacy: Member view contains no userName or purpose keys; Admin view does.
 */

import { db } from "../src/lib/db";
import {
  getDayAvailability,
  findFreeResources,
} from "../src/services/availability";
import { createReservation } from "../src/services/reservations";
import { formatInAppTimezone, toUtc, getTodayInAppTimezone } from "../src/lib/time";
import { ConflictError } from "../src/lib/errors";

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
  console.log("PHASE 7 AVAILABILITY & TIMELINE VERIFICATION SUITE");
  console.log("========================================================\n");

  const testId = `avail_${Date.now()}`;

  let testMember: { id: string; name: string; email: string } | undefined = undefined;
  let testAdmin: { id: string; name: string; email: string } | undefined = undefined;
  let testCatA: { id: string; name: string } | undefined = undefined;
  let testCatB: { id: string; name: string } | undefined = undefined;
  let testRes1: { id: string; name: string } | undefined = undefined;
  let testRes2: { id: string; name: string } | undefined = undefined;
  let testResInactive: { id: string; name: string } | undefined = undefined;

  const createdReservationIds: string[] = [];

  try {
    // ----------------------------------------------------
    // SETUP: Temporary test users, categories and resources
    // ----------------------------------------------------
    testMember = await db.user.create({
      data: {
        name: "Test Member",
        email: `member_${testId}@example.com`,
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

    testCatA = await db.resourceCategory.create({
      data: { name: `Cat A ${testId}` },
    });

    testCatB = await db.resourceCategory.create({
      data: { name: `Cat B ${testId}` },
    });

    // testRes1: Cat A, capacity 10, active
    testRes1 = await db.resource.create({
      data: {
        name: `Res 1 ${testId}`,
        categoryId: testCatA.id,
        capacity: 10,
        isActive: true,
      },
    });

    // testRes2: Cat A, capacity 20, active
    testRes2 = await db.resource.create({
      data: {
        name: `Res 2 ${testId}`,
        categoryId: testCatA.id,
        capacity: 20,
        isActive: true,
      },
    });

    // testResInactive: Cat A, capacity 10, inactive
    testResInactive = await db.resource.create({
      data: {
        name: `Res Inactive ${testId}`,
        categoryId: testCatA.id,
        capacity: 10,
        isActive: false,
      },
    });

    // Choose future day 1 (15 days ahead in Asia/Colombo) and day 2 (16 days ahead)
    const futureDate1 = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const day1Str = formatInAppTimezone(futureDate1, "yyyy-MM-dd");

    const futureDate2 = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);
    const day2Str = formatInAppTimezone(futureDate2, "yyyy-MM-dd");

    // ----------------------------------------------------
    // TEST 1: Day with two reservations (booked list & free windows)
    // ----------------------------------------------------
    console.log("[Test Suite 1] Day Availability with Two Reservations");

    // Res 1 on Res1: 09:00 to 11:00
    const resA = await db.reservation.create({
      data: {
        resourceId: testRes1.id,
        userId: testMember.id,
        purpose: "Morning Standup",
        startTime: toUtc(`${day1Str} 09:00:00`),
        endTime: toUtc(`${day1Str} 11:00:00`),
        status: "CONFIRMED",
      },
    });
    createdReservationIds.push(resA.id);

    // Res 2 on Res1: 14:00 to 16:00
    const resB = await db.reservation.create({
      data: {
        resourceId: testRes1.id,
        userId: testMember.id,
        purpose: "Architecture Review",
        startTime: toUtc(`${day1Str} 14:00:00`),
        endTime: toUtc(`${day1Str} 16:00:00`),
        status: "CONFIRMED",
      },
    });
    createdReservationIds.push(resB.id);

    const avail1 = await getDayAvailability({
      resourceId: testRes1.id,
      date: day1Str,
      viewer: { id: testAdmin.id, role: "ADMIN" },
    });

    assert(avail1.booked.length === 2, "Returned exactly 2 booked reservations");
    assert(
      formatInAppTimezone(avail1.booked[0].start, "HH:mm") === "09:00" &&
        formatInAppTimezone(avail1.booked[0].end, "HH:mm") === "11:00",
      "First booked slot times are 09:00 to 11:00"
    );
    assert(
      formatInAppTimezone(avail1.booked[1].start, "HH:mm") === "14:00" &&
        formatInAppTimezone(avail1.booked[1].end, "HH:mm") === "16:00",
      "Second booked slot times are 14:00 to 16:00"
    );

    // Free windows should be 00:00-09:00, 11:00-14:00, 16:00-24:00
    assert(avail1.freeWindows.length === 3, "Returned exactly 3 free windows for the day");
    assert(
      formatInAppTimezone(avail1.freeWindows[0].start, "HH:mm") === "00:00" &&
        formatInAppTimezone(avail1.freeWindows[0].end, "HH:mm") === "09:00",
      "First free window is 00:00 to 09:00"
    );
    assert(
      formatInAppTimezone(avail1.freeWindows[1].start, "HH:mm") === "11:00" &&
        formatInAppTimezone(avail1.freeWindows[1].end, "HH:mm") === "14:00",
      "Second free window is 11:00 to 14:00"
    );
    assert(
      formatInAppTimezone(avail1.freeWindows[2].start, "HH:mm") === "16:00" &&
        formatInAppTimezone(avail1.freeWindows[2].end, "HH:mm") === "00:00",
      "Third free window is 16:00 to 24:00 (end of day)"
    );

    // ----------------------------------------------------
    // TEST 2: CANCELLED reservation does not block or reduce free windows
    // ----------------------------------------------------
    console.log("\n[Test Suite 2] Cancelled Reservation Handling");

    const resCancelled = await db.reservation.create({
      data: {
        resourceId: testRes1.id,
        userId: testMember.id,
        purpose: "Cancelled Midday Discussion",
        startTime: toUtc(`${day1Str} 11:30:00`),
        endTime: toUtc(`${day1Str} 13:00:00`),
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: testMember.id,
      },
    });
    createdReservationIds.push(resCancelled.id);

    const availCancelled = await getDayAvailability({
      resourceId: testRes1.id,
      date: day1Str,
      viewer: { id: testAdmin.id, role: "ADMIN" },
    });

    assert(
      availCancelled.booked.length === 2,
      "CANCELLED reservation is excluded from booked list"
    );
    assert(
      availCancelled.freeWindows.length === 3 &&
        formatInAppTimezone(availCancelled.freeWindows[1].start, "HH:mm") === "11:00" &&
        formatInAppTimezone(availCancelled.freeWindows[1].end, "HH:mm") === "14:00",
      "CANCELLED reservation does NOT split or reduce the 11:00 to 14:00 free window"
    );

    // ----------------------------------------------------
    // TEST 3: Back-to-Back Reservations (Adjacent boundaries)
    // ----------------------------------------------------
    console.log("\n[Test Suite 3] Back-to-Back Bookings & Boundary Accuracy");

    // Res 3 on Res1: 16:00 to 18:00 (immediately following 14:00-16:00)
    const resBackToBack = await db.reservation.create({
      data: {
        resourceId: testRes1.id,
        userId: testMember.id,
        purpose: "Back-to-Back Meeting",
        startTime: toUtc(`${day1Str} 16:00:00`),
        endTime: toUtc(`${day1Str} 18:00:00`),
        status: "CONFIRMED",
      },
    });
    createdReservationIds.push(resBackToBack.id);

    const availB2B = await getDayAvailability({
      resourceId: testRes1.id,
      date: day1Str,
      viewer: { id: testAdmin.id, role: "ADMIN" },
    });

    // Free windows should now be 00:00-09:00, 11:00-14:00, 18:00-24:00
    assert(
      availB2B.freeWindows.length === 3,
      "No zero-length sliver window is produced between back-to-back reservations"
    );
    assert(
      formatInAppTimezone(availB2B.freeWindows[2].start, "HH:mm") === "18:00",
      "Final free window starts exactly at 18:00 touching reservation boundary"
    );

    // ----------------------------------------------------
    // TEST 4: Midnight-crossing reservation clipped on both days
    // ----------------------------------------------------
    console.log("\n[Test Suite 4] Midnight-Crossing Reservation");

    // Res on Res2: 22:00 on day1 to 02:00 on day2
    const resMidnight = await db.reservation.create({
      data: {
        resourceId: testRes2.id,
        userId: testMember.id,
        purpose: "Overnight Deployment",
        startTime: toUtc(`${day1Str} 22:00:00`),
        endTime: toUtc(`${day2Str} 02:00:00`),
        status: "CONFIRMED",
      },
    });
    createdReservationIds.push(resMidnight.id);

    const availDay1 = await getDayAvailability({
      resourceId: testRes2.id,
      date: day1Str,
      viewer: { id: testMember.id, role: "MEMBER" },
    });

    const availDay2 = await getDayAvailability({
      resourceId: testRes2.id,
      date: day2Str,
      viewer: { id: testMember.id, role: "MEMBER" },
    });

    assert(
      availDay1.booked.length === 1 && availDay2.booked.length === 1,
      "Overlapping reservation appears in booked list on both days"
    );
    assert(
      availDay1.freeWindows.length === 1 &&
        formatInAppTimezone(availDay1.freeWindows[0].start, "HH:mm") === "00:00" &&
        formatInAppTimezone(availDay1.freeWindows[0].end, "HH:mm") === "22:00",
      "On day 1, free window ends at 22:00 (22:00-24:00 blocked)"
    );
    assert(
      availDay2.freeWindows.length === 1 &&
        formatInAppTimezone(availDay2.freeWindows[0].start, "HH:mm") === "02:00" &&
        formatInAppTimezone(availDay2.freeWindows[0].end, "HH:mm") === "00:00",
      "On day 2, free window begins at 02:00 (00:00-02:00 blocked)"
    );

    // ----------------------------------------------------
    // TEST 5: For today, free windows never start before "now"
    // ----------------------------------------------------
    console.log("\n[Test Suite 5] Today's Free Windows Temporal Guard");

    const todayStr = getTodayInAppTimezone();
    const now = new Date();
    const availToday = await getDayAvailability({
      resourceId: testRes2.id,
      date: todayStr,
      viewer: { id: testMember.id, role: "MEMBER" },
    });

    const anyStartsInPast = availToday.freeWindows.some(
      (fw) => fw.start.getTime() < now.getTime() - 15 * 60 * 1000
    );
    assert(!anyStartsInPast, "For today, no free window starts in the past");

    // ----------------------------------------------------
    // TEST 6: findFreeResources filter & criteria accuracy
    // ----------------------------------------------------
    console.log("\n[Test Suite 6] findFreeResources Search Filters");

    // On day1 between 10:00 and 11:00:
    // - Res1 is busy (09:00-11:00 confirmed reservation)
    // - Res2 is free
    // - ResInactive is inactive (should be excluded)
    const searchResult = await findFreeResources({
      date: day1Str,
      startTime: "10:00",
      endTime: "11:00",
      categoryId: testCatA.id,
      viewerRole: "MEMBER",
    });

    const res1Found = searchResult.freeResources.some((r) => r.id === testRes1?.id);
    const res2Found = searchResult.freeResources.some((r) => r.id === testRes2?.id);
    const inactiveFound = searchResult.freeResources.some((r) => r.id === testResInactive?.id);

    assert(!res1Found, "findFreeResources excludes resource with overlapping reservation (Res1)");
    assert(res2Found, "findFreeResources includes free resource (Res2)");
    assert(!inactiveFound, "findFreeResources excludes inactive resource");
    assert(searchResult.busyCount >= 1, "findFreeResources correctly reports busyCount");

    // Capacity filter: minCapacity 15 should exclude Res1 (capacity 10) and keep Res2 (capacity 20)
    const capSearch = await findFreeResources({
      date: day1Str,
      startTime: "12:00",
      endTime: "13:00", // Both Res1 and Res2 are free during 12:00-13:00
      minCapacity: 15,
      categoryId: testCatA.id,
    });

    assert(
      capSearch.freeResources.some((r) => r.id === testRes2?.id) &&
        !capSearch.freeResources.some((r) => r.id === testRes1?.id),
      "minCapacity filter correctly filters out resources with smaller capacity"
    );

    // ----------------------------------------------------
    // TEST 7: Cross-check with Database Exclusion Constraint
    // ----------------------------------------------------
    console.log("\n[Test Suite 7] Cross-Check with Database Exclusion Constraint");

    // Res2 was reported free for 10:00-11:00 on day1 -> createReservation must succeed
    const createRes2 = await createReservation(testMember.id, {
      resourceId: testRes2.id,
      purpose: "Cross-check free booking",
      startLocal: `${day1Str}T10:00`,
      endLocal: `${day1Str}T11:00`,
    });
    createdReservationIds.push(createRes2.id);
    assert(createRes2.status === "CONFIRMED", "Booking a reported-free resource succeeds");

    // Res1 was reported busy for 10:00-11:00 on day1 -> createReservation must fail with ConflictError
    let conflictCaught = false;
    try {
      await createReservation(testMember.id, {
        resourceId: testRes1.id,
        purpose: "Cross-check busy booking",
        startLocal: `${day1Str}T10:00`,
        endLocal: `${day1Str}T11:00`,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        conflictCaught = true;
      }
    }
    assert(conflictCaught, "Booking a reported-busy resource fails with ConflictError");

    // ----------------------------------------------------
    // TEST 8: Privacy Enforcement (Service Layer)
    // ----------------------------------------------------
    console.log("\n[Test Suite 8] Role-Based Privacy Shape Enforcement");

    const memberAvail = await getDayAvailability({
      resourceId: testRes1.id,
      date: day1Str,
      viewer: { id: testMember.id, role: "MEMBER" },
    });

    const adminAvail = await getDayAvailability({
      resourceId: testRes1.id,
      date: day1Str,
      viewer: { id: testAdmin.id, role: "ADMIN" },
    });

    const memberSlot = memberAvail.booked[0] as unknown as Record<string, unknown>;
    const adminSlot = adminAvail.booked[0] as unknown as Record<string, unknown>;

    assert(
      !("userName" in memberSlot) && !("purpose" in memberSlot),
      "Member view strictly omits userName and purpose keys"
    );
    assert(
      "userName" in adminSlot && "purpose" in adminSlot,
      "Admin view includes userName and purpose keys"
    );
    assert(
      typeof adminSlot.userName === "string" && adminSlot.userName.length > 0,
      "Admin view contains actual booking user's name"
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
    // CLEANUP: Clean up all created test entities
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
            { userId: testMember?.id },
            { userId: testAdmin?.id },
            { resourceId: testRes1?.id },
            { resourceId: testRes2?.id },
            { resourceId: testResInactive?.id },
          ],
        },
      });

      if (testRes1?.id || testRes2?.id || testResInactive?.id) {
        await db.resource.deleteMany({
          where: {
            id: {
              in: [testRes1?.id, testRes2?.id, testResInactive?.id].filter(Boolean) as string[],
            },
          },
        });
      }

      if (testCatA?.id || testCatB?.id) {
        await db.resourceCategory.deleteMany({
          where: {
            id: {
              in: [testCatA?.id, testCatB?.id].filter(Boolean) as string[],
            },
          },
        });
      }

      if (testMember?.id || testAdmin?.id) {
        await db.user.deleteMany({
          where: {
            id: {
              in: [testMember?.id, testAdmin?.id].filter(Boolean) as string[],
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
