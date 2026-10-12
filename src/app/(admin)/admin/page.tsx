import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Admin Area | Resource Reservation Management System",
  description: "Administrator control panel and user approval queue.",
};

export default async function AdminPage() {
  const admin = await requireRole("ADMIN");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card className="shadow-sm border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold tracking-tight">Admin Area</CardTitle>
            <Badge variant="default">ADMIN ONLY</Badge>
          </div>
          <CardDescription>
            User approvals, resource categories, and system-wide overrides.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Welcome, <span className="font-semibold text-foreground">{admin.name}</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            User approvals and resource management will be implemented in upcoming phases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
