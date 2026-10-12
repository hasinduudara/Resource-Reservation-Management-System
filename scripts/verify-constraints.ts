import { PrismaClient } from "@prisma/client";
import { isReservationOverlapError } from "../src/lib/db-errors";

const prisma = new PrismaClient();

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  details?: string;
}

async function runVerification() {
  console.log("=================================================");
  console.log("   RESERVATION CONSTRAINTS VERIFICATION SUITE   ");
  console.log("=================================================\n");

  const results: TestResult[] = [];
  const testId = Date.now();

  let tempUser: { id: string } | null = null;
  let tempCategory: { id: string } | null = null;
  let tempResourceA: { id: string } | null = null;
  let tempResourceB: { id: string } | null = null;

  try {
    // -----------------------------------------------------------------
    // Setup Clean Test Environment
    // -----------------------------------------------------------------
    console.log("Setting up temporary test data...");
    const createdUser = await prisma.user.create({
      data: {
        name: `Test Runner ${testId}`,
        email: `test-runner-${testId}@example.com`,
        passwordHash: "dummy-hash",
        role: "MEMBER",
        status: "ACTIVE",
      },
    });
    tempUser = createdUser;

    const createdCategory = await prisma.resourceCategory.create({
      data: {
        name: `Test Category ${testId}`,
        description: "Temporary verification category",
      },
    });
    tempCategory = createdCategory;

    const createdResourceA = await prisma.resource.create({
      data: {
        name: `Test Resource A ${testId}`,
        categoryId: createdCategory.id,
        isActive: true,
      },
    });
    tempResourceA = createdResourceA;

    const createdResourceB = await prisma.resource.create({
      data: {
        name: `Test Resource B ${testId}`,
        categoryId: createdCategory.id,
        isActive: true,
      },
    });
    tempResourceB = createdResourceB;

    const user = createdUser;
    const resA = createdResourceA;
    const resB = createdResourceB;

    console.log("Temporary environment created successfully.\n");

    // -----------------------------------------------------------------
    // Test 1: Overlapping CONFIRMED reservation on SAME resource is REJECTED
    // -----------------------------------------------------------------
    try {
      const start1 = new Date("2026-11-01T10:00:00Z");
      const end1 = new Date("2026-11-01T11:00:00Z");
      const startOverlap = new Date("2026-11-01T10:30:00Z");
      const endOverlap = new Date("2026-11-01T11:30:00Z");

      await prisma.reservation.create({
        data: {
          resourceId: resA.id,
          userId: user.id,
          startTime: start1,
          endTime: end1,
          status: "CONFIRMED",
          purpose: "Test 1: Base reservation",
        },
      });

      let overlapCaught = false;
      let detectedByHelper = false;

      try {
        await prisma.reservation.create({
          data: {
            resourceId: resA.id,
            userId: user.id,
            startTime: startOverlap,
            endTime: endOverlap,
            status: "CONFIRMED",
            purpose: "Test 1: Overlapping reservation",
          },
        });
      } catch (err: unknown) {
        overlapCaught = true;
        detectedByHelper = isReservationOverlapError(err);
      }

      const passed = overlapCaught && detectedByHelper;
      results.push({
        num: 1,
        description: "Overlapping CONFIRMED reservation on same resource is REJECTED",
        passed,
        details: passed
          ? "Exclusion constraint triggered & isReservationOverlapError returned true"
          : `overlapCaught=${overlapCaught}, isReservationOverlapError=${detectedByHelper}`,
      });
    } catch (err) {
      results.push({
        num: 1,
        description: "Overlapping CONFIRMED reservation on same resource is REJECTED",
        passed: false,
        details: `Unexpected error: ${String(err)}`,
      });
    }

    // -----------------------------------------------------------------
    // Test 2: Back-to-back reservations (10:00-11:00 then 11:00-12:00) are ALLOWED
    // -----------------------------------------------------------------
    try {
      const start1 = new Date("2026-11-02T10:00:00Z");
      const end1 = new Date("2026-11-02T11:00:00Z");
      const start2 = new Date("2026-11-02T11:00:00Z");
      const end2 = new Date("2026-11-02T12:00:00Z");

      const res1 = await prisma.reservation.create({
        data: {
          resourceId: resA.id,
          userId: user.id,
          startTime: start1,
          endTime: end1,
          status: "CONFIRMED",
          purpose: "Test 2: Slot 10:00-11:00",
        },
      });

      const res2 = await prisma.reservation.create({
        data: {
          resourceId: resA.id,
          userId: user.id,
          startTime: start2,
          endTime: end2,
          status: "CONFIRMED",
          purpose: "Test 2: Slot 11:00-12:00",
        },
      });

      results.push({
        num: 2,
        description: "Back-to-back reservations (10:00-11:00 then 11:00-12:00) are ALLOWED",
        passed: Boolean(res1.id && res2.id),
        details: "Half-open interval [) allows adjacent boundary times",
      });
    } catch (err) {
      results.push({
        num: 2,
        description: "Back-to-back reservations (10:00-11:00 then 11:00-12:00) are ALLOWED",
        passed: false,
        details: `Failed with error: ${String(err)}`,
      });
    }

    // -----------------------------------------------------------------
    // Test 3: Same time range on a DIFFERENT resource is ALLOWED
    // -----------------------------------------------------------------
    try {
      const start = new Date("2026-11-03T10:00:00Z");
      const end = new Date("2026-11-03T11:00:00Z");

      const resCreatedA = await prisma.reservation.create({
        data: {
          resourceId: resA.id,
          userId: user.id,
          startTime: start,
          endTime: end,
          status: "CONFIRMED",
          purpose: "Test 3: Resource A",
        },
      });

      const resCreatedB = await prisma.reservation.create({
        data: {
          resourceId: resB.id,
          userId: user.id,
          startTime: start,
          endTime: end,
          status: "CONFIRMED",
          purpose: "Test 3: Resource B",
        },
      });

      results.push({
        num: 3,
        description: "Same time range on a DIFFERENT resource is ALLOWED",
        passed: Boolean(resCreatedA.id && resCreatedB.id),
        details: "Exclusion constraint is scoped per resource_id",
      });
    } catch (err) {
      results.push({
        num: 3,
        description: "Same time range on a DIFFERENT resource is ALLOWED",
        passed: false,
        details: `Failed with error: ${String(err)}`,
      });
    }

    // -----------------------------------------------------------------
    // Test 4: A CANCELLED reservation does NOT block a new CONFIRMED one
    // -----------------------------------------------------------------
    try {
      const start = new Date("2026-11-04T10:00:00Z");
      const end = new Date("2026-11-04T11:00:00Z");

      const cancelledRes = await prisma.reservation.create({
        data: {
          resourceId: resA.id,
          userId: user.id,
          startTime: start,
          endTime: end,
          status: "CANCELLED",
          cancelledAt: new Date(),
          purpose: "Test 4: Cancelled Slot",
        },
      });

      const confirmedRes = await prisma.reservation.create({
        data: {
          resourceId: resA.id,
          userId: user.id,
          startTime: start,
          endTime: end,
          status: "CONFIRMED",
          purpose: "Test 4: Confirmed replacement Slot",
        },
      });

      results.push({
        num: 4,
        description: "A CANCELLED reservation does NOT block a new CONFIRMED one",
        passed: Boolean(cancelledRes.id && confirmedRes.id),
        details: "Exclusion constraint has partial filter WHERE (status = 'CONFIRMED')",
      });
    } catch (err) {
      results.push({
        num: 4,
        description: "A CANCELLED reservation does NOT block a new CONFIRMED one",
        passed: false,
        details: `Failed with error: ${String(err)}`,
      });
    }

    // -----------------------------------------------------------------
    // Test 5: end_time <= start_time is REJECTED
    // -----------------------------------------------------------------
    try {
      const t1 = new Date("2026-11-05T12:00:00Z");
      const t2 = new Date("2026-11-05T11:00:00Z"); // end < start
      const tSame = new Date("2026-11-05T12:00:00Z"); // end == start

      let rejectedLesser = false;
      let rejectedEqual = false;

      try {
        await prisma.reservation.create({
          data: {
            resourceId: resA.id,
            userId: user.id,
            startTime: t1,
            endTime: t2,
            status: "CONFIRMED",
            purpose: "Test 5: end < start",
          },
        });
      } catch {
        rejectedLesser = true;
      }

      try {
        await prisma.reservation.create({
          data: {
            resourceId: resA.id,
            userId: user.id,
            startTime: t1,
            endTime: tSame,
            status: "CONFIRMED",
            purpose: "Test 5: end == start",
          },
        });
      } catch {
        rejectedEqual = true;
      }

      const passed = rejectedLesser && rejectedEqual;
      results.push({
        num: 5,
        description: "end_time <= start_time is REJECTED",
        passed,
        details: passed
          ? "Check constraint reservations_valid_range rejected both end < start and end == start"
          : `rejectedLesser=${rejectedLesser}, rejectedEqual=${rejectedEqual}`,
      });
    } catch (err) {
      results.push({
        num: 5,
        description: "end_time <= start_time is REJECTED",
        passed: false,
        details: `Failed with error: ${String(err)}`,
      });
    }

    // -----------------------------------------------------------------
    // Test 6: Two overlapping inserts with Promise.all: exactly ONE succeeds
    // -----------------------------------------------------------------
    try {
      const startRace = new Date("2026-11-06T14:00:00Z");
      const endRace = new Date("2026-11-06T15:00:00Z");

      const p1 = prisma.reservation.create({
        data: {
          resourceId: resA.id,
          userId: user.id,
          startTime: startRace,
          endTime: endRace,
          status: "CONFIRMED",
          purpose: "Test 6: Race Insert 1",
        },
      });

      const p2 = prisma.reservation.create({
        data: {
          resourceId: resA.id,
          userId: user.id,
          startTime: startRace,
          endTime: endRace,
          status: "CONFIRMED",
          purpose: "Test 6: Race Insert 2",
        },
      });

      const raceResults = await Promise.allSettled([p1, p2]);
      const fulfilled = raceResults.filter((r) => r.status === "fulfilled");
      const rejected = raceResults.filter((r) => r.status === "rejected");

      const exactlyOneSucceeded = fulfilled.length === 1 && rejected.length === 1;
      const rejectedReason = rejected[0]?.status === "rejected" ? rejected[0].reason : null;
      const errorDetected = isReservationOverlapError(rejectedReason);

      const passed = exactlyOneSucceeded && errorDetected;
      results.push({
        num: 6,
        description: "Two overlapping inserts fired with Promise.all: exactly ONE succeeds",
        passed,
        details: passed
          ? `Concurrency handled by GiST lock: 1 fulfilled, 1 rejected with detected overlap error`
          : `fulfilled=${fulfilled.length}, rejected=${rejected.length}, errorDetected=${errorDetected}`,
      });
    } catch (err) {
      results.push({
        num: 6,
        description: "Two overlapping inserts fired with Promise.all: exactly ONE succeeds",
        passed: false,
        details: `Failed with error: ${String(err)}`,
      });
    }
  } finally {
    // -----------------------------------------------------------------
    // Cleanup temporary test data
    // -----------------------------------------------------------------
    console.log("Cleaning up temporary test data...");
    if (tempResourceA && tempResourceB) {
      await prisma.reservation.deleteMany({
        where: {
          resourceId: { in: [tempResourceA.id, tempResourceB.id] },
        },
      });
      await prisma.resource.deleteMany({
        where: { id: { in: [tempResourceA.id, tempResourceB.id] } },
      });
    }
    if (tempCategory) {
      await prisma.resourceCategory.delete({ where: { id: tempCategory.id } });
    }
    if (tempUser) {
      await prisma.user.delete({ where: { id: tempUser.id } });
    }
    await prisma.$disconnect();
    console.log("Cleanup complete.\n");
  }

  // -----------------------------------------------------------------
  // Print Test Report
  // -----------------------------------------------------------------
  console.log("----------------------- TEST RESULTS -----------------------");
  let allPassed = true;
  for (const r of results) {
    const statusText = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${statusText} - Test ${r.num}: ${r.description}`);
    if (r.details) {
      console.log(`         Details: ${r.details}`);
    }
    if (!r.passed) {
      allPassed = false;
    }
  }
  console.log("------------------------------------------------------------");

  if (allPassed) {
    console.log("\n🎉 ALL 6 CONSTRAINT TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  } else {
    console.error("\n💥 SOME TESTS FAILED. PLEASE REVIEW THE DETAILS ABOVE.\n");
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
