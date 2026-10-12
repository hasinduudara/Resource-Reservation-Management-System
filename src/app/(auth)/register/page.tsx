import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Register | Resource Reservation Management System",
  description: "Create an account to request access to the reservation system.",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <RegisterForm />
    </div>
  );
}
