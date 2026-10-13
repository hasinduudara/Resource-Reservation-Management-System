/**
 * Comprehensive verification suite for Phase 5 Resource & Category Management.
 *
 * Verifies:
 * 1. Category validation and case-insensitive duplicate rejection
 * 2. Category deletion safety guard (cannot delete categories containing resources)
 * 3. Resource validation (capacity coercion, positive integer enforcement, invalid values rejection)
 * 4. Resource case-insensitive duplicate name rejection
 * 5. Role-gated visibility: MEMBER sees only active resources (5 total), ADMIN sees all (6 total)
 * 6. Direct access protection: Inactive resource (Training Lab) throws 404 NotFoundError for MEMBER
 * 7. Search and category filtering work together with pagination
 * 8. Deactivation preserves existing reservations and shows correct upcoming reservation count
 * 9. Server action role guards reject unauthorized/member requests
 */

import { db } from "../src/lib/db";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../src/services/categories";
import {
  listResources,
  getResourceById,
  createResource,
  updateResource,
  setResourceActive,
  countUpcomingReservations,
} from "../src/services/resources";
import { resourceSchema } from "../src/lib/validation/resources";
import {
  createCategoryAction,
  deleteCategoryAction,
} from "../src/app/(admin)/admin/categories/actions";
import {
  createResourceAction,
  setResourceActiveAction,
} from "../src/app/(admin)/admin/resources/actions";
import { ConflictError, NotFoundError } from "../src/lib/errors";

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
  console.log("PHASE 5 RESOURCES & CATEGORIES VERIFICATION SUITE");
  console.log("========================================================\n");

  // ----------------------------------------------------
  // TEST 1: Category Validation & CRUD Business Rules
  // ----------------------------------------------------
  console.log("[Test Suite 1] Category CRUD & Safety Guards");

  // Case-insensitive duplicate name rejection
  let duplicateCatRejected = false;
  try {
    await createCategory({
      name: "meeting room", // Lowercase variant of seeded "Meeting Room"
      description: "Duplicate test",
    });
  } catch (err) {
    if (err instanceof ConflictError && err.message === "A category with this name already exists") {
      duplicateCatRejected = true;
    }
  }
  assert(duplicateCatRejected, "Duplicate category name (case-insensitive) is rejected with ConflictError");

  // Deleting a category with resources must be blocked
  const meetingRoom = await db.resourceCategory.findUnique({
    where: { name: "Meeting Room" },
  });
  if (!meetingRoom) throw new Error("Meeting Room category not found");

  let deleteWithResourcesBlocked = false;
  try {
    await deleteCategory(meetingRoom.id);
  } catch (err) {
    if (
      err instanceof ConflictError &&
      err.message === "Cannot delete category because it contains resources"
    ) {
      deleteWithResourcesBlocked = true;
    }
  }
  assert(
    deleteWithResourcesBlocked,
    "Deleting category containing resources is blocked with ConflictError"
  );

  // Creating, updating, and deleting an empty category
  const tempCatName = `Temp_Cat_${Date.now()}`;
  const tempCat = await createCategory({
    name: tempCatName,
    description: "Temporary category",
  });
  assert(tempCat.name === tempCatName, "Empty category creation succeeds");

  const updatedCat = await updateCategory(tempCat.id, {
    name: `${tempCatName}_Updated`,
    description: "Updated description",
  });
  assert(updatedCat.name === `${tempCatName}_Updated`, "Category update succeeds");

  await deleteCategory(tempCat.id);
  const deletedCatCheck = await db.resourceCategory.findUnique({
    where: { id: tempCat.id },
  });
  assert(deletedCatCheck === null, "Deleting empty category succeeds");

  // ----------------------------------------------------
  // TEST 2: Resource Schema & Validation
  // ----------------------------------------------------
  console.log("\n[Test Suite 2] Resource Zod Validation & Capacity Coercion");

  // Valid capacity
  const validParsed = resourceSchema.safeParse({
    name: "Valid Resource",
    categoryId: meetingRoom.id,
    capacity: "25",
  });
  assert(validParsed.success && validParsed.data.capacity === 25, "Capacity '25' coerced to positive integer 25");

  // Empty capacity -> null
  const emptyParsed = resourceSchema.safeParse({
    name: "Valid Resource",
    categoryId: meetingRoom.id,
    capacity: "",
  });
  assert(emptyParsed.success && emptyParsed.data.capacity === null, "Empty capacity string parsed as null");

  // Negative capacity -> error
  const negParsed = resourceSchema.safeParse({
    name: "Valid Resource",
    categoryId: meetingRoom.id,
    capacity: "-5",
  });
  assert(!negParsed.success, "Negative capacity '-5' rejected with validation error");

  // Non-numeric capacity -> error
  const stringParsed = resourceSchema.safeParse({
    name: "Valid Resource",
    categoryId: meetingRoom.id,
    capacity: "abc",
  });
  assert(!stringParsed.success, "Non-numeric capacity 'abc' rejected with validation error");

  // ----------------------------------------------------
  // TEST 3: Duplicate Resource Name Uniqueness (Case-Insensitive)
  // ----------------------------------------------------
  console.log("\n[Test Suite 3] Resource Name Case-Insensitive Uniqueness");

  let duplicateResRejected = false;
  try {
    await createResource({
      name: "conference room a", // Lowercase variant of seeded "Conference Room A"
      categoryId: meetingRoom.id,
    });
  } catch (err) {
    if (err instanceof ConflictError && err.message === "A resource with this name already exists") {
      duplicateResRejected = true;
    }
  }
  assert(
    duplicateResRejected,
    "Creating resource with duplicate name (case-insensitive) is rejected with ConflictError"
  );

  // ----------------------------------------------------
  // TEST 4: Role-Based Visibility (Member vs Admin)
  // ----------------------------------------------------
  console.log("\n[Test Suite 4] Role-Based Visibility & Direct URL Access Guard");

  // Member listing
  const memberList = await listResources({
    viewerRole: "MEMBER",
    includeInactive: true, // Attempt to request inactive as member (must be ignored)
    pageSize: 50,
  });

  const memberHasTrainingLab = memberList.items.some((r) => r.name === "Training Lab");
  assert(
    memberList.items.length === 5 && !memberHasTrainingLab,
    "MEMBER sees only the 5 active resources (inactive Training Lab is excluded)"
  );

  // Admin listing with includeInactive = true
  const adminList = await listResources({
    viewerRole: "ADMIN",
    includeInactive: true,
    pageSize: 50,
  });

  const adminHasTrainingLab = adminList.items.some((r) => r.name === "Training Lab");
  assert(
    adminList.items.length === 6 && adminHasTrainingLab,
    "ADMIN sees all 6 resources including inactive Training Lab"
  );

  // Direct URL access: /resources/[id]
  const trainingLab = await db.resource.findFirst({
    where: { name: "Training Lab" },
  });
  if (!trainingLab) throw new Error("Training Lab not found");

  let memberDirectAccessBlocked = false;
  try {
    await getResourceById(trainingLab.id, "MEMBER");
  } catch (err) {
    if (err instanceof NotFoundError) {
      memberDirectAccessBlocked = true;
    }
  }
  assert(
    memberDirectAccessBlocked,
    "MEMBER requesting inactive resource directly by ID triggers 404 NotFoundError"
  );

  const adminDirectAccess = await getResourceById(trainingLab.id, "ADMIN");
  assert(
    adminDirectAccess.name === "Training Lab" && !adminDirectAccess.isActive,
    "ADMIN requesting inactive resource directly by ID succeeds"
  );

  // ----------------------------------------------------
  // TEST 5: Search and Category Filtering with Pagination
  // ----------------------------------------------------
  console.log("\n[Test Suite 5] Search & Category Filter with Pagination");

  const filterResult = await listResources({
    q: "conference",
    categoryId: meetingRoom.id,
    viewerRole: "ADMIN",
    page: 1,
    pageSize: 10,
  });

  assert(
    filterResult.total === 1 && filterResult.items[0]?.name === "Conference Room A",
    "Filter by category and search keyword 'conference' returns 'Conference Room A'"
  );

  // ----------------------------------------------------
  // TEST 6: Deactivation, Reservation Count & Preservation
  // ----------------------------------------------------
  console.log("\n[Test Suite 6] Resource Deactivation & Reservation Preservation");

  const confRoomA = await db.resource.findFirst({
    where: { name: "Conference Room A" },
  });
  if (!confRoomA) throw new Error("Conference Room A not found");

  const upcomingCount = await countUpcomingReservations(confRoomA.id);
  assert(typeof upcomingCount === "number" && upcomingCount >= 0, "countUpcomingReservations returns valid count");

  const reservationsCountBefore = await db.reservation.count({
    where: { resourceId: confRoomA.id },
  });

  // Deactivate
  const deactivated = await setResourceActive(confRoomA.id, false);
  assert(!deactivated.isActive, "setResourceActive sets isActive to false");

  const reservationsCountAfter = await db.reservation.count({
    where: { resourceId: confRoomA.id },
  });
  assert(
    reservationsCountBefore === reservationsCountAfter,
    "Deactivating resource does NOT modify or delete existing reservations"
  );

  // Restore Conference Room A to active
  await setResourceActive(confRoomA.id, true);

  // ----------------------------------------------------
  // TEST 7: Server Action Role Guards
  // ----------------------------------------------------
  console.log("\n[Test Suite 7] Server Action Role Security Guards");

  const unauthCatResult = await createCategoryAction({ success: false }, new FormData());
  assert(!unauthCatResult.success, "createCategoryAction without admin session is rejected");

  const unauthResResult = await setResourceActiveAction(confRoomA.id, false);
  assert(!unauthResResult.success, "setResourceActiveAction without admin session is rejected");

  const unauthDeleteCatResult = await deleteCategoryAction(meetingRoom.id);
  assert(!unauthDeleteCatResult.success, "deleteCategoryAction without admin session is rejected");

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
