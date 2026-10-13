"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/session";
import { cancelReservation } from "@/services/reservations";
import { cancelReservationSchema } from "@/lib/validation/reservations";
import { AppError } from "@/lib/errors";

export interface CancelReservationResult {
  success: boolean;
  message: string;
}

export async function cancelReservationAction(
  reservationId: string
): Promise<CancelReservationResult> {
  const user = await assertUser();

  const parsed = cancelReservationSchema.safeParse({ reservationId });
  if (!parsed.success) {
    return {
      success: false,
      message: "Invalid reservation ID.",
    };
  }

  try {
    await cancelReservation(
      { id: user.id, role: user.role },
      parsed.data.reservationId
    );

    revalidatePath("/my-reservations");
    revalidatePath("/resources");

    return {
      success: true,
      message: "Reservation successfully cancelled.",
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
