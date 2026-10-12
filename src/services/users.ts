import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ConflictError, ValidationError } from "@/lib/errors";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "ACTIVE" | "DISABLED";
  createdAt: Date;
}

/**
 * Register a new user in the system.
 * Enforces role MEMBER and status PENDING regardless of client input.
 * Hashes password with bcryptjs (cost 10).
 */
export async function registerUser(input: RegisterInput): Promise<SafeUser> {
  const validated = registerSchema.safeParse(input);
  if (!validated.success) {
    throw new ValidationError("Invalid registration data", validated.error.flatten());
  }

  const { name, email, password } = validated.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new ConflictError("An account with this email already exists");
  }

  // Cost 10 bcrypt hash
  const passwordHash = await bcrypt.hash(password, 10);

  // Strictly enforce MEMBER role and PENDING status on the server
  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "MEMBER",
      status: "PENDING",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return user;
}
