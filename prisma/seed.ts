import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Colombo";

function localSlotToUtc(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr} ${timeStr}`, APP_TIMEZONE);
}

async function main() {
  console.log("🌱 Starting database seed...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in environment. Please check your .env file."
    );
  }

  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash(adminPassword, saltRounds);
  const memberPasswordHash = await bcrypt.hash("Member@123", saltRounds);

  // 1. Upsert Admin User
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: adminPasswordHash,
    },
    create: {
      name: "System Admin",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });
  console.log(`✓ Admin user upserted: ${admin.email}`);

  // 2. Upsert Active Members (approved by Admin)
  const activeMembersData = [
    { name: "Alice Johnson", email: "alice@example.com" },
    { name: "Bob Smith", email: "bob@example.com" },
    { name: "Charlie Brown", email: "charlie@example.com" },
  ];

  const activeMembers = [];
  for (const member of activeMembersData) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {
        role: "MEMBER",
        status: "ACTIVE",
        approvedById: admin.id,
      },
      create: {
        name: member.name,
        email: member.email,
        passwordHash: memberPasswordHash,
        role: "MEMBER",
        status: "ACTIVE",
        approvedById: admin.id,
        approvedAt: new Date(),
      },
    });
    activeMembers.push(user);
    console.log(`✓ Active member upserted: ${user.email}`);
  }

  // 3. Upsert Pending Member (unapproved)
  const pendingMember = await prisma.user.upsert({
    where: { email: "diana@example.com" },
    update: {
      role: "MEMBER",
      status: "PENDING",
      approvedById: null,
      approvedAt: null,
    },
    create: {
      name: "Diana Prince",
      email: "diana@example.com",
      passwordHash: memberPasswordHash,
      role: "MEMBER",
      status: "PENDING",
      approvedById: null,
      approvedAt: null,
    },
  });
  console.log(`✓ Pending member upserted: ${pendingMember.email}`);

  // 4. Upsert Categories
  const categoriesData = [
    {
      name: "Meeting Room",
      description: "Conference rooms and collaborative team spaces",
    },
    {
      name: "Vehicle",
      description: "Company fleet vehicles for travel and transportation",
    },
    {
      name: "Equipment",
      description: "Audio/visual equipment, projectors, and hardware",
    },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const record = await prisma.resourceCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description },
      create: { name: cat.name, description: cat.description },
    });
    categories[record.name] = record.id;
    console.log(`✓ Category upserted: ${record.name}`);
  }

  // 5. Upsert Resources (~6 resources across categories; 1 with isActive = false)
  const resourcesData = [
    {
      name: "Conference Room A",
      categoryName: "Meeting Room",
      capacity: 12,
      location: "Floor 2, Wing A",
      description: "Large conference room with 4K screen and video conferencing",
      isActive: true,
    },
    {
      name: "Meeting Room B",
      categoryName: "Meeting Room",
      capacity: 6,
      location: "Floor 1, Wing B",
      description: "Huddle room for small team discussions and syncs",
      isActive: true,
    },
    {
      name: "Company Van",
      categoryName: "Vehicle",
      capacity: 10,
      location: "Main Parking Bay 1",
      description: "Passenger transit van for group transport",
      isActive: true,
    },
    {
      name: "Pool Car",
      categoryName: "Vehicle",
      capacity: 4,
      location: "Main Parking Bay 2",
      description: "Standard sedan for client meetings and local travel",
      isActive: true,
    },
    {
      name: "Projector",
      categoryName: "Equipment",
      capacity: null,
      location: "AV Storage Locker 3",
      description: "Portable 4K laser projector with HDMI and wireless casting",
      isActive: true,
    },
    {
      name: "Training Lab",
      categoryName: "Meeting Room",
      capacity: 25,
      location: "Floor 3, Tech Wing",
      description: "Hands-on workstation lab (undergoing maintenance)",
      isActive: false, // Exactly 1 resource isActive = false
    },
  ];

  const resources: Record<string, string> = {};
  for (const res of resourcesData) {
    const existing = await prisma.resource.findFirst({ where: { name: res.name } });
    let record;
    if (existing) {
      record = await prisma.resource.update({
        where: { id: existing.id },
        data: {
          name: res.name,
          categoryId: categories[res.categoryName],
          capacity: res.capacity,
          location: res.location,
          description: res.description,
          isActive: res.isActive,
        },
      });
    } else {
      record = await prisma.resource.create({
        data: {
          name: res.name,
          categoryId: categories[res.categoryName],
          capacity: res.capacity,
          location: res.location,
          description: res.description,
          isActive: res.isActive,
        },
      });
    }
    resources[record.name] = record.id;
    console.log(`✓ Resource upserted: ${record.name} (Active: ${record.isActive})`);
  }

  // 6. Create Demo Reservations (only if reservations table is empty)
  const existingReservationsCount = await prisma.reservation.count();
  if (existingReservationsCount > 0) {
    console.log(`ℹ Reservations table already contains ${existingReservationsCount} records. Skipping reservation seeding to remain idempotent.`);
  } else {
    console.log("Creating initial demo reservations...");
    const now = new Date();
    const todayStr = formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd");
    const yesterdayStr = formatInTimeZone(subDays(now, 1), APP_TIMEZONE, "yyyy-MM-dd");
    const tomorrowStr = formatInTimeZone(addDays(now, 1), APP_TIMEZONE, "yyyy-MM-dd");
    const dayAfterTomorrowStr = formatInTimeZone(addDays(now, 2), APP_TIMEZONE, "yyyy-MM-dd");

    interface DemoReservationInput {
      resourceId: string;
      userId: string;
      purpose: string;
      startTime: Date;
      endTime: Date;
      status: "CONFIRMED" | "CANCELLED";
      cancelledAt?: Date;
      cancelledById?: string;
    }

    const demoReservations: DemoReservationInput[] = [
      // Past reservations (Yesterday)
      {
        resourceId: resources["Conference Room A"],
        userId: activeMembers[0].id,
        purpose: "Sprint Planning Session",
        startTime: localSlotToUtc(yesterdayStr, "09:00:00"),
        endTime: localSlotToUtc(yesterdayStr, "11:00:00"),
        status: "CONFIRMED",
      },
      {
        resourceId: resources["Pool Car"],
        userId: activeMembers[1].id,
        purpose: "Client site inspection in Colombo 03",
        startTime: localSlotToUtc(yesterdayStr, "14:00:00"),
        endTime: localSlotToUtc(yesterdayStr, "17:00:00"),
        status: "CONFIRMED",
      },

      // Today's reservations
      {
        resourceId: resources["Conference Room A"],
        userId: activeMembers[1].id,
        purpose: "Engineering Architecture Review",
        startTime: localSlotToUtc(todayStr, "10:00:00"),
        endTime: localSlotToUtc(todayStr, "12:00:00"),
        status: "CONFIRMED",
      },
      {
        resourceId: resources["Meeting Room B"],
        userId: activeMembers[2].id,
        purpose: "1-on-1 Mentorship Check-in",
        startTime: localSlotToUtc(todayStr, "14:00:00"),
        endTime: localSlotToUtc(todayStr, "15:30:00"),
        status: "CONFIRMED",
      },
      {
        resourceId: resources["Projector"],
        userId: activeMembers[0].id,
        purpose: "Town hall workshop presentation",
        startTime: localSlotToUtc(todayStr, "16:00:00"),
        endTime: localSlotToUtc(todayStr, "17:30:00"),
        status: "CONFIRMED",
      },

      // Upcoming reservations (Tomorrow & Day After)
      {
        resourceId: resources["Conference Room A"],
        userId: activeMembers[2].id,
        purpose: "Client Demo: Product Release v1.0",
        startTime: localSlotToUtc(tomorrowStr, "09:30:00"),
        endTime: localSlotToUtc(tomorrowStr, "11:30:00"),
        status: "CONFIRMED",
      },
      {
        resourceId: resources["Company Van"],
        userId: activeMembers[0].id,
        purpose: "Department team offsite transport",
        startTime: localSlotToUtc(tomorrowStr, "13:00:00"),
        endTime: localSlotToUtc(tomorrowStr, "17:00:00"),
        status: "CONFIRMED",
      },
      {
        resourceId: resources["Meeting Room B"],
        userId: activeMembers[1].id,
        purpose: "Design review with external agency",
        startTime: localSlotToUtc(dayAfterTomorrowStr, "10:00:00"),
        endTime: localSlotToUtc(dayAfterTomorrowStr, "12:00:00"),
        status: "CONFIRMED",
      },

      // Exactly one CANCELLED reservation (cancelledAt and cancelledById set)
      {
        resourceId: resources["Meeting Room B"],
        userId: activeMembers[0].id,
        purpose: "Vendor negotiation meeting (Cancelled due to scheduling conflict)",
        startTime: localSlotToUtc(tomorrowStr, "14:00:00"),
        endTime: localSlotToUtc(tomorrowStr, "16:00:00"),
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: admin.id,
      },
    ];

    for (const res of demoReservations) {
      await prisma.reservation.create({ data: res });
    }
    console.log(`✓ Created ${demoReservations.length} demo reservations.`);
  }

  console.log("✅ Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
