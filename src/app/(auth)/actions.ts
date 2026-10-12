"use server";

import { redirect } from "next/navigation";
import { registerSchema, loginSchema } from "@/lib/validation/auth";
import { registerUser } from "@/services/users";
import { authenticateCredentials, getSafeCallbackUrl } from "@/services/auth";
import { signSessionToken, setSessionCookie, deleteSessionCookie } from "@/lib/auth-token";
import { ConflictError, ValidationError } from "@/lib/errors";

export interface RegisterFormState {
  success: boolean;
  message?: string;
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    confirmPassword?: string[];
    _form?: string[];
  };
}

export interface LoginFormState {
  success: boolean;
  message?: string;
  errors?: {
    email?: string[];
    password?: string[];
  };
}

export async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const rawData = {
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
    confirmPassword: formData.get("confirmPassword")?.toString() ?? "",
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await registerUser(parsed.data);
    return {
      success: true,
      message:
        "Registration received. Your account must be approved by an administrator before you can log in.",
    };
  } catch (error) {
    if (error instanceof ConflictError) {
      return {
        success: false,
        errors: {
          email: [error.message],
        },
      };
    }
    if (error instanceof ValidationError) {
      return {
        success: false,
        message: error.message,
      };
    }
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const rawData = {
    email: formData.get("email")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
  };
  const callbackUrl = formData.get("callbackUrl")?.toString();

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await authenticateCredentials(parsed.data.email, parsed.data.password);
  if (!result.success || !result.user) {
    return {
      success: false,
      message: result.error || "Invalid email or password",
    };
  }

  // Generate JWT token and set httpOnly cookie
  const token = await signSessionToken({
    userId: result.user.id,
    name: result.user.name,
    email: result.user.email,
    role: result.user.role,
  });

  await setSessionCookie(token);

  // Redirect to safe callbackUrl (defaults to /resources)
  const safeRedirect = getSafeCallbackUrl(callbackUrl);
  redirect(safeRedirect);
}

export async function logoutAction(): Promise<void> {
  await deleteSessionCookie();
  redirect("/login");
}
