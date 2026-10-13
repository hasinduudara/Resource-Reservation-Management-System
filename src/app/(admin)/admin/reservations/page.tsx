import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { listAllReservations, type ReservationDisplayStatus } from "@/services/reservations";
import { adminReservationsQuerySchema } from "@/lib/validation/admin-reservations";
import { formatInAppTimezone } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminCancelReservationDialog } from "./cancel-dialog";

export const metadata: Metadata = {
  title: "Reservations Management | Admin",
  description: "Monitor and manage all system reservations across resources.",
};

interface AdminReservationsPageProps {
  searchParams: Promise<{
    resourceId?: string;
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
}

function renderStatusBadge(status: ReservationDisplayStatus) {
  switch (status) {
    case "Upcoming":
      return (
        <Badge variant="default" className="text-xs font-medium">
          Upcoming
        </Badge>
      );
    case "In progress":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-medium animate-pulse"
        >
          In progress
        </Badge>
      );
    case "Completed":
      return (
        <Badge variant="secondary" className="text-xs text-muted-foreground font-medium">
          Completed
        </Badge>
      );
    case "Cancelled":
      return (
        <Badge
          variant="outline"
          className="border-rose-500/40 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-medium"
        >
          Cancelled
        </Badge>
      );
  }
}

export default async function AdminReservationsPage({
  searchParams,
}: AdminReservationsPageProps) {
  const admin = await requireRole("ADMIN");
  const rawParams = await searchParams;

  // Validate and parse search parameters with graceful fallback
  const parsed = adminReservationsQuerySchema.safeParse(rawParams);
  let hasFilterError = false;
  let filters: {
    resourceId?: string;
    q?: string;
    status: "all" | "upcoming" | "in_progress" | "completed" | "cancelled";
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  };

  if (parsed.success) {
    filters = parsed.data;
  } else {
    hasFilterError = true;
    filters = {
      resourceId: undefined,
      q: undefined,
      status: "all",
      from: undefined,
      to: undefined,
      page: 1,
      pageSize: 15,
    };
  }

  // Fetch all resources (including inactive) for the filter dropdown
  const allResources = await db.resource.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      category: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  // Query reservations with filters
  const result = await listAllReservations(
    {
      resourceId: filters.resourceId,
      q: filters.q,
      status: filters.status,
      from: filters.from,
      to: filters.to,
    },
    {
      page: filters.page,
      pageSize: 15,
      actor: { role: admin.role },
    }
  );

  const startRecord = result.total === 0 ? 0 : (filters.page - 1) * result.pageSize + 1;
  const endRecord = Math.min(filters.page * result.pageSize, result.total);

  // Helper to build URL with preserved filters
  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (filters.resourceId) sp.set("resourceId", filters.resourceId);
    if (filters.q) sp.set("q", filters.q);
    if (filters.status && filters.status !== "all") sp.set("status", filters.status);
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    if (targetPage > 1) sp.set("page", targetPage.toString());
    return `/admin/reservations?${sp.toString()}`;
  };

  const isFiltered =
    Boolean(filters.resourceId) ||
    Boolean(filters.q) ||
    filters.status !== "all" ||
    Boolean(filters.from) ||
    Boolean(filters.to);

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reservations Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor scheduled sessions across resources, filter reservations, and manage cancellations.
        </p>
      </div>

      {hasFilterError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
          Invalid filter parameters provided (e.g. &apos;From&apos; date occurs after &apos;To&apos; date). Displaying default reservations view.
        </div>
      )}

      {/* Filter Card */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Filter Reservations</CardTitle>
          <CardDescription className="text-xs">
            Filter reservations by resource, user name or email, lifecycle status, and Sri Lanka (Asia/Colombo) date range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" action="/admin/reservations" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Resource Select */}
              <div className="space-y-1">
                <label htmlFor="filter-resource" className="text-xs font-medium text-muted-foreground">
                  Resource
                </label>
                <select
                  id="filter-resource"
                  name="resourceId"
                  defaultValue={filters.resourceId || ""}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Resources</option>
                  {allResources.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.name} {res.isActive ? "" : "(Inactive)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* User Search */}
              <div className="space-y-1">
                <label htmlFor="filter-user" className="text-xs font-medium text-muted-foreground">
                  User Search
                </label>
                <Input
                  id="filter-user"
                  name="q"
                  type="search"
                  placeholder="Name or email..."
                  defaultValue={filters.q || ""}
                  className="h-9 text-sm"
                />
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label htmlFor="filter-status" className="text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <select
                  id="filter-status"
                  name="status"
                  defaultValue={filters.status || "all"}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Statuses</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* From Date */}
              <div className="space-y-1">
                <label htmlFor="filter-from" className="text-xs font-medium text-muted-foreground">
                  From (Date)
                </label>
                <Input
                  id="filter-from"
                  type="date"
                  name="from"
                  defaultValue={filters.from || ""}
                  className="h-9 text-sm"
                />
              </div>

              {/* To Date */}
              <div className="space-y-1">
                <label htmlFor="filter-to" className="text-xs font-medium text-muted-foreground">
                  To (Date)
                </label>
                <Input
                  id="filter-to"
                  type="date"
                  name="to"
                  defaultValue={filters.to || ""}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              {isFiltered && (
                <Link
                  href="/admin/reservations"
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "h-8 text-xs" })}
                >
                  Reset
                </Link>
              )}
              <Button type="submit" size="sm" className="h-8 text-xs">
                Apply Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Reservations Table */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Reservations Log</CardTitle>
              <CardDescription className="text-xs">
                All start and end times are shown in Asia/Colombo (UTC+05:30).
              </CardDescription>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Total: {result.total}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <div className="py-16 text-center space-y-2 px-4">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground">
                No reservations match these filters
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Try adjusting or resetting your filter criteria to see existing reservation records.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Resource</TableHead>
                    <TableHead className="w-[180px]">User</TableHead>
                    <TableHead className="w-[150px]">Start</TableHead>
                    <TableHead className="w-[150px]">End</TableHead>
                    <TableHead className="min-w-[160px]">Purpose</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((item) => {
                    const startFormatted = formatInAppTimezone(item.startTime, "yyyy-MM-dd HH:mm");
                    const endFormatted = formatInAppTimezone(item.endTime, "yyyy-MM-dd HH:mm");

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div>
                            <Link
                              href={`/resources/${item.resource.id}`}
                              className="hover:underline text-foreground hover:text-primary transition-colors text-sm font-medium"
                            >
                              {item.resource.name}
                            </Link>
                            <div className="text-[11px] text-muted-foreground">
                              {item.resource.category.name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm text-foreground">{item.user.name}</div>
                            <div className="font-mono text-[11px] text-muted-foreground truncate max-w-[170px]">
                              {item.user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {startFormatted}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {endFormatted}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={item.purpose || undefined}>
                          {item.purpose || <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell>{renderStatusBadge(item.displayStatus)}</TableCell>
                        <TableCell className="text-right">
                          {item.canCancel ? (
                            <AdminCancelReservationDialog
                              reservationId={item.id}
                              userName={item.user.name}
                              resourceName={item.resource.name}
                              timeRange={`${startFormatted} – ${endFormatted}`}
                            />
                          ) : item.displayStatus === "Cancelled" ? (
                            <div className="text-[11px] text-muted-foreground text-right leading-tight">
                              <div>Cancelled by {item.cancelledBy?.name || "System"}</div>
                              {item.cancelledAt && (
                                <div className="font-mono text-[10px] text-muted-foreground/70">
                                  {formatInAppTimezone(item.cancelledAt, "yyyy-MM-dd HH:mm")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination & Summary */}
      {result.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground pt-1">
          <div>
            Showing <span className="font-medium text-foreground">{startRecord}</span>-
            <span className="font-medium text-foreground">{endRecord}</span> of{" "}
            <span className="font-medium text-foreground">{result.total}</span>
          </div>

          {result.totalPages > 1 && (
            <div className="flex items-center gap-2">
              {filters.page > 1 ? (
                <Link
                  href={buildPageUrl(filters.page - 1)}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 text-xs" })}
                >
                  Previous
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled className="h-8 text-xs">
                  Previous
                </Button>
              )}

              <span className="px-2">
                Page {filters.page} of {result.totalPages}
              </span>

              {filters.page < result.totalPages ? (
                <Link
                  href={buildPageUrl(filters.page + 1)}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 text-xs" })}
                >
                  Next
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled className="h-8 text-xs">
                  Next
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
