"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/session";
import { cancelReservationAsAdmin } from "@/services/reservations";
import { cancelReservationSchema } from "@/lib/validation/reservations";
import { AppError } from "@/lib/errors";

export interface AdminCancelReservationResult {
  success: boolean;
  message: string;
}

export async function adminCancelReservationAction(
  reservationId: string
): Promise<AdminCancelReservationResult> {
  const admin = await assertRole("ADMIN");

  const parsed = cancelReservationSchema.safeParse({ reservationId });
  if (!parsed.success) {
    return {
      success: false,
      message: "Invalid reservation ID.",
    };
  }

  try {
    await cancelReservationAsAdmin(
      { id: admin.id, role: admin.role },
      parsed.data.reservationId
    );

    revalidatePath("/admin/reservations");
    revalidatePath("/admin");
    revalidatePath("/my-reservations");
    revalidatePath("/resources");

    return {
      success: true,
      message: "Reservation successfully cancelled by administrator.",
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: false,
      message: "Failed to cancel reservation. Please try again.",
    };
  }
}
