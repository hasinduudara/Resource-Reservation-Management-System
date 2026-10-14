"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/session";
import { createReservation } from "@/services/reservations";
import { createReservationSchema } from "@/lib/validation/reservations";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export interface CreateReservationState {
  success: boolean;
  message?: string;
  fieldErrors?: {
    purpose?: string[];
    startLocal?: string[];
    endLocal?: string[];
    resourceId?: string[];
  };
}

export async function createReservationAction(
  _prevState: CreateReservationState,
  formData: FormData
): Promise<CreateReservationState> {
  const user = await assertUser();

  const rawData = {
    resourceId: formData.get("resourceId")?.toString() ?? "",
    purpose: formData.get("purpose")?.toString() ?? "",
    startLocal: formData.get("startLocal")?.toString() ?? "",
    endLocal: formData.get("endLocal")?.toString() ?? "",
  };

  const parsed = createReservationSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // Actor ID and role are strictly taken from the authenticated session
    await createReservation({ id: user.id, role: user.role }, parsed.data);

    revalidatePath(`/resources/${parsed.data.resourceId}`);
    revalidatePath("/my-reservations");

    return {
      success: true,
      message: "Reservation confirmed successfully!",
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        message: error.message,
        fieldErrors: (error.details as { fieldErrors?: Record<string, string[]> })?.fieldErrors,
      };
    }

    if (error instanceof ConflictError || error instanceof NotFoundError) {
      return {
        success: false,
        message: error.message,
      };
    }

    if (error instanceof AppError) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: false,
      message: "An unexpected error occurred while processing your reservation. Please try again.",
    };
  }
}
