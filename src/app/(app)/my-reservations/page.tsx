import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listMyReservations, type ReservationDisplayStatus } from "@/services/reservations";
import { formatInAppTimezone } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CancelReservationDialog } from "./cancel-dialog";

export const metadata: Metadata = {
  title: "My Reservations | Resource Reservation Management System",
  description: "View and manage your resource bookings.",
};

interface MyReservationsPageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
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

export default async function MyReservationsPage({ searchParams }: MyReservationsPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const currentTab = params.tab === "past" ? "past" : "upcoming";
  const currentPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 10;

  const result = await listMyReservations({
    userId: user.id,
    tab: currentTab,
    page: currentPage,
    pageSize,
  });

  const buildUrl = (targetTab: "upcoming" | "past", targetPage: number) => {
    const sp = new URLSearchParams();
    sp.set("tab", targetTab);
    if (targetPage > 1) {
      sp.set("page", targetPage.toString());
    }
    return `/my-reservations?${sp.toString()}`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-6">
      {/* Page Title & Navigation */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Reservations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View your upcoming bookings, track past history, or cancel scheduled slots.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Link
          href={buildUrl("upcoming", 1)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            currentTab === "upcoming"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Upcoming Bookings
        </Link>
        <Link
          href={buildUrl("past", 1)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            currentTab === "past"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Past & Cancelled
        </Link>
      </div>

      {/* Reservations Table / Empty State */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                {currentTab === "upcoming" ? "Scheduled Reservations" : "Reservation History"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                All booking times are formatted in Sri Lanka Time (Asia/Colombo).
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Total: {result.total}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {result.items.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold">
                {currentTab === "upcoming"
                  ? "No upcoming reservations"
                  : "No past reservation history"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {currentTab === "upcoming"
                  ? "You do not have any active or scheduled bookings at this time."
                  : "You have not completed or cancelled any reservations yet."}
              </p>
              {currentTab === "upcoming" && (
                <div className="pt-2">
                  <Link
                    href="/resources"
                    className={buttonVariants({ variant: "default", size: "sm" })}
                  >
                    Browse Available Resources
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Resource</TableHead>
                    <TableHead className="w-[110px]">Category</TableHead>
                    <TableHead className="w-[150px]">Start Time</TableHead>
                    <TableHead className="w-[150px]">End Time</TableHead>
                    <TableHead className="min-w-[180px]">Purpose</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[90px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((item) => {
                    const startFormatted = formatInAppTimezone(item.startTime, "yyyy-MM-dd HH:mm");
                    const endFormatted = formatInAppTimezone(item.endTime, "yyyy-MM-dd HH:mm");

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/resources/${item.resource.id}`}
                            className="hover:underline text-foreground hover:text-primary transition-colors"
                          >
                            {item.resource.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {item.resource.category.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {startFormatted}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {endFormatted}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {item.purpose || <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell>{renderStatusBadge(item.displayStatus)}</TableCell>
                        <TableCell className="text-right">
                          {item.canCancel ? (
                            <CancelReservationDialog
                              reservationId={item.id}
                              resourceName={item.resource.name}
                              timeRange={`${startFormatted} – ${endFormatted}`}
                            />
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

      {/* Pagination */}
      {result.total > 0 && result.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <div>
            Showing <span className="font-medium text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{" "}
            <span className="font-medium text-foreground">
              {Math.min(currentPage * pageSize, result.total)}
            </span> of <span className="font-medium text-foreground">{result.total}</span> reservations
          </div>

          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link
                href={buildUrl(currentTab, currentPage - 1)}
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
              Page {currentPage} of {result.totalPages}
            </span>

            {currentPage < result.totalPages ? (
              <Link
                href={buildUrl(currentTab, currentPage + 1)}
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
        </div>
      )}
    </div>
  );
}
