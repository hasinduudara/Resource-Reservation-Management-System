import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in | Resource Reservation Management System",
  description: "Sign in to reserve and manage shared resources.",
};

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = await searchParams;
  const callbackUrl = resolvedParams?.callbackUrl || "/resources";

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  );
}
