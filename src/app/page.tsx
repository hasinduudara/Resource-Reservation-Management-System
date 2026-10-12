import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-foreground">
      <Card className="w-full max-w-md text-center shadow-lg border">
        <CardHeader className="space-y-2">
          <div className="flex justify-center">
            <Badge variant="secondary" className="text-xs font-medium">
              Phase 1 Foundation
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Resource Reservation Management System
          </CardTitle>
          <CardDescription>
            System core and foundation initialized successfully.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ready for upcoming reservation, authentication, and management modules.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
