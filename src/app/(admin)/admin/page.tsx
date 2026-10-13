import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getDashboardSummary, getUsageByResource } from "@/services/stats";
import { usagePeriodSchema, type UsagePeriod } from "@/lib/validation/admin-reservations";
import { formatInAppTimezone } from "@/lib/time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReservationDisplayStatus } from "@/services/reservations";

export const metadata: Metadata = {
  title: "Admin Dashboard | Resource Reservation Management System",
  description: "Overview of system activity, resource usage metrics, and schedules.",
};

interface AdminDashboardPageProps {
  searchParams: Promise<{
    period?: string;
  }>;
}

function renderStatusBadge(status: ReservationDisplayStatus) {
  switch (status) {
    case "Upcoming":
      return (
        <Badge variant="default" className="text-[11px] font-medium">
          Upcoming
        </Badge>
      );
    case "In progress":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 text-[11px] font-medium animate-pulse"
        >
          In progress
        </Badge>
      );
    case "Completed":
      return (
        <Badge variant="secondary" className="text-[11px] text-muted-foreground font-medium">
          Completed
        </Badge>
      );
    case "Cancelled":
      return (
        <Badge
          variant="outline"
          className="border-rose-500/40 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 text-[11px] font-medium"
        >
          Cancelled
        </Badge>
      );
  }
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  await requireRole("ADMIN");
  const rawParams = await searchParams;

  const parsedPeriod = usagePeriodSchema.safeParse(rawParams);
  const selectedPeriod: UsagePeriod = parsedPeriod.success ? parsedPeriod.data.period : "last30";

  const [summary, usage] = await Promise.all([
    getDashboardSummary(),
    getUsageByResource(selectedPeriod),
  ]);

  const maxBookedHours = Math.max(...usage.resources.map((r) => r.bookedHours), 0);

  const periodOptions: Array<{ id: UsagePeriod; label: string }> = [
    { id: "last7", label: "Last 7 days" },
    { id: "last30", label: "Last 30 days" },
    { id: "next7", label: "Next 7 days" },
  ];

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System health, reservation schedules, and aggregate resource utilization overview.
        </p>
      </div>

      {/* Row of Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Pending Approvals */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Pending Approvals</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {summary.pendingUsers}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/admin/users"
              className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              Review registrations &rarr;
            </Link>
          </CardContent>
        </Card>

        {/* Active Resources */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Active Resources</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {summary.activeResources}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/admin/resources"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
            >
              {summary.inactiveResources > 0
                ? `${summary.inactiveResources} inactive resources &rarr;`
                : "Manage resources &rarr;"}
            </Link>
          </CardContent>
        </Card>

        {/* Reservations Today */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Reservations Today</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {summary.reservationsToday}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Confirmed starting today
            </p>
          </CardContent>
        </Card>

        {/* Upcoming Reservations */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Upcoming Reservations</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {summary.upcomingReservations}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Confirmed yet to conclude
            </p>
          </CardContent>
        </Card>

        {/* Cancelled (Last 30 Days) */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Cancelled (30 Days)</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {summary.cancelledLast30Days}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Excluded from usage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column Section: Today's Schedule & Next Up */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule Card */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Today&apos;s Schedule</CardTitle>
                <CardDescription className="text-xs">
                  Active or starting today in Asia/Colombo (UTC+05:30).
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {summary.todaySchedule.length} slots
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {summary.todaySchedule.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground px-4">
                No reservations scheduled for today.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">Time</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="w-[90px] text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.todaySchedule.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatInAppTimezone(item.startTime, "HH:mm")} – {formatInAppTimezone(item.endTime, "HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          <Link
                            href={`/resources/${item.resource.id}`}
                            className="hover:underline text-foreground hover:text-primary transition-colors"
                          >
                            {item.resource.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.user.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderStatusBadge(item.displayStatus)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Up Card */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Next Up</CardTitle>
                <CardDescription className="text-xs">
                  Next 5 upcoming confirmed bookings across all resources.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {summary.nextUp.length} items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {summary.nextUp.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground px-4">
                No upcoming bookings scheduled.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Date & Time</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="w-[90px] text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.nextUp.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatInAppTimezone(item.startTime, "MMM d, HH:mm")} – {formatInAppTimezone(item.endTime, "HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          <Link
                            href={`/resources/${item.resource.id}`}
                            className="hover:underline text-foreground hover:text-primary transition-colors"
                          >
                            {item.resource.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.user.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderStatusBadge(item.displayStatus)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage Breakdown Card */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Resource Usage Overview</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Utilization and booked hours breakdown across all inventory items.
              </CardDescription>
            </div>

            {/* Period Selector Tabs */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border text-xs">
              {periodOptions.map((opt) => (
                <Link
                  key={opt.id}
                  href={`/admin?period=${opt.id}`}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    selectedPeriod === opt.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Totals Summary Banner */}
          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground border-t mt-3">
            <div>
              Total Bookings:{" "}
              <span className="font-semibold text-foreground font-mono">
                {usage.totalReservations}
              </span>
            </div>
            <div>•</div>
            <div>
              Total Booked Hours:{" "}
              <span className="font-semibold text-foreground font-mono">
                {usage.totalBookedHours.toFixed(1)} hrs
              </span>
            </div>
            <div>•</div>
            <div>
              Range:{" "}
              <span className="font-mono text-foreground">
                {formatInAppTimezone(usage.from, "yyyy-MM-dd")} –{" "}
                {formatInAppTimezone(new Date(usage.to.getTime() - 1000), "yyyy-MM-dd")}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {usage.resources.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No resources found in inventory.
            </div>
          ) : (
            <div className="space-y-4">
              {usage.resources.map((item) => {
                const percentage =
                  maxBookedHours > 0
                    ? Math.round((item.bookedHours / maxBookedHours) * 100)
                    : 0;

                return (
                  <div key={item.resourceId} className="space-y-1.5 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/resources/${item.resourceId}`}
                          className="font-medium hover:underline text-foreground"
                        >
                          {item.name}
                        </Link>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {item.category}
                        </Badge>
                        {!item.isActive && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span>
                          <strong className="text-foreground">{item.reservationCount}</strong> bookings
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-foreground">{item.bookedHours.toFixed(1)}</strong> hrs
                        </span>
                      </div>
                    </div>

                    {/* Proportional CSS Width Bar with Text Accessibility */}
                    <div className="space-y-1">
                      <div
                        className="w-full bg-muted rounded-full h-2.5 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={item.bookedHours}
                        aria-valuemin={0}
                        aria-valuemax={maxBookedHours}
                        aria-label={`Usage for ${item.name}: ${item.bookedHours} hours (${percentage}% of maximum)`}
                      >
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-3 border-t text-[11px] text-muted-foreground">
            Note: Counts only confirmed reservations. Booked hours are clipped to the selected period boundaries.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
