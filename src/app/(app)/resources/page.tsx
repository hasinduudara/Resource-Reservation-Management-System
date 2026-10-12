import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Resources | Resource Reservation Management System",
  description: "Browse and reserve shared resources.",
};

export default async function ResourcesPage() {
  const user = await requireUser();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card className="shadow-sm border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Resources: coming in Phase 5
            </CardTitle>
            <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
              {user.role}
            </Badge>
          </div>
          <CardDescription>
            Shared equipment, rooms, and facilities will be listed here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Logged in as <span className="font-semibold text-foreground">{user.name}</span> (
            <span className="font-mono text-xs">{user.email}</span>).
          </p>
          <p className="text-sm text-muted-foreground">
            Authentication and route protection are fully operational.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
