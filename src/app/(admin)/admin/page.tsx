import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { countPendingUsers } from "@/services/users";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Admin Dashboard | Resource Reservation Management System",
  description: "Administrator overview and pending approval counter.",
};

export default async function AdminPage() {
  const admin = await requireRole("ADMIN");
  const pendingCount = await countPendingUsers();

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {admin.name}. Review registrations and oversee system accounts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-xs border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approvals
              </CardTitle>
              {pendingCount > 0 ? (
                <Badge variant="destructive" className="font-mono">
                  {pendingCount}
                </Badge>
              ) : (
                <Badge variant="secondary" className="font-mono">
                  0
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="text-3xl font-bold tracking-tight">{pendingCount}</div>
            <CardDescription className="text-xs mt-1">
              {pendingCount === 1
                ? "1 user awaiting approval"
                : `${pendingCount} users awaiting approval`}
            </CardDescription>
          </CardContent>
          <CardFooter className="pt-2">
            <Link
              href="/admin/users"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
            >
              Manage Users & Approvals
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
