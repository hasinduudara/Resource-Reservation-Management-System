import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listCategories } from "@/services/categories";
import { findFreeResources } from "@/services/availability";
import { findFreeQuerySchema } from "@/lib/validation/availability";
import { formatInAppTimezone, toUtc, getTodayInAppTimezone } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Find Free Resources | Resource Reservation Management System",
  description: "Search and discover available resources for your requested date and time slot.",
};

interface AvailabilityPageProps {
  searchParams: Promise<{
    date?: string;
    startTime?: string;
    endTime?: string;
    categoryId?: string;
    minCapacity?: string;
  }>;
}

export default async function AvailabilityPage({ searchParams }: AvailabilityPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const todayStr = getTodayInAppTimezone();
  const dateInput = params.date || todayStr;
  const startTimeInput = params.startTime || "";
  const endTimeInput = params.endTime || "";
  const categoryIdInput = params.categoryId || "";
  const minCapacityInput = params.minCapacity || "";

  const categories = await listCategories();

  // If user has provided both times, validate and search
  const hasTimeInputs = Boolean(startTimeInput && endTimeInput);
  let validationErrors: string[] = [];
  let searchResult: Awaited<ReturnType<typeof findFreeResources>> | null = null;

  if (hasTimeInputs) {
    const parsed = findFreeQuerySchema.safeParse({
      date: dateInput,
      startTime: startTimeInput,
      endTime: endTimeInput,
      categoryId: categoryIdInput || undefined,
      minCapacity: minCapacityInput ? parseInt(minCapacityInput, 10) : undefined,
    });

    if (parsed.success) {
      searchResult = await findFreeResources({
        ...parsed.data,
        viewerRole: user.role,
      });
    } else {
      validationErrors = parsed.error.issues.map((i) => i.message);
    }
  }

  // Formatted date string for summary
  const formattedDate = formatInAppTimezone(
    toUtc(`${dateInput} 00:00:00`),
    "d MMM yyyy"
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Find Free Resources
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search across all facilities and equipment to find available slots without booking conflicts.
        </p>
      </div>

      {/* Filter / Search Form */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Search Criteria</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Slots snap to 15-minute increments (Asia/Colombo). Maximum duration: 8 hours.
          </CardDescription>
        </CardHeader>

        <form method="GET" action="/availability">
          <CardContent className="space-y-4">
            {/* Validation Errors Notice */}
            {validationErrors.length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive space-y-1"
              >
                <div className="font-semibold text-xs flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Please review your search criteria:
                </div>
                <ul className="list-disc list-inside text-xs pl-2 space-y-0.5">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Date */}
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="date" className="text-xs font-semibold">
                  Date
                </Label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={dateInput}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Start Time */}
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="startTime" className="text-xs font-semibold">
                  Start Time
                </Label>
                <input
                  id="startTime"
                  name="startTime"
                  type="time"
                  step="900"
                  defaultValue={startTimeInput}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* End Time */}
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="endTime" className="text-xs font-semibold">
                  End Time
                </Label>
                <input
                  id="endTime"
                  name="endTime"
                  type="time"
                  step="900"
                  defaultValue={endTimeInput}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="categoryId" className="text-xs font-semibold">
                  Category
                </Label>
                <select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={categoryIdInput}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Minimum Capacity */}
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="minCapacity" className="text-xs font-semibold">
                  Min Capacity
                </Label>
                <Input
                  id="minCapacity"
                  name="minCapacity"
                  type="number"
                  min="1"
                  placeholder="e.g. 10"
                  defaultValue={minCapacityInput}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2 border-t flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Tip: Times snap to :00, :15, :30, :45.
            </span>
            <div className="flex items-center gap-2">
              {hasTimeInputs && (
                <Link
                  href="/availability"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Clear
                </Link>
              )}
              <Button type="submit" size="sm" className="min-w-24">
                Check Availability
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* Search Results Display */}
      {searchResult && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-lg border bg-muted/30">
            <div className="text-sm font-medium">
              <span className="text-primary font-bold">{searchResult.freeResources.length}</span> of{" "}
              <span className="font-semibold">{searchResult.totalMatching}</span> resources are free from{" "}
              <span className="font-semibold">{startTimeInput}</span> to{" "}
              <span className="font-semibold">{endTimeInput}</span> on{" "}
              <span className="font-semibold">{formattedDate}</span>.
            </div>

            <Badge variant="outline" className="self-start sm:self-auto text-xs font-normal">
              {searchResult.busyCount} busy
            </Badge>
          </div>

          {/* Grid of Free Resources */}
          {searchResult.freeResources.length === 0 ? (
            <Card className="border-dashed p-10 text-center shadow-xs">
              <CardContent className="space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <CardTitle className="text-base">No resources are free for that time</CardTitle>
                <CardDescription className="text-xs">
                  All matching resources are already booked during this period. Try adjusting your time range or category filter.
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {searchResult.freeResources.map((res) => {
                const prefillUrl = `/resources/${res.id}?date=${dateInput}&start=${dateInput}T${startTimeInput}&end=${dateInput}T${endTimeInput}#booking-card`;

                return (
                  <Card key={res.id} className="flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow border">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-bold tracking-tight">
                          <Link href={`/resources/${res.id}`} className="hover:underline">
                            {res.name}
                          </Link>
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {res.category.name}
                        </Badge>
                      </div>
                      {res.description && (
                        <CardDescription className="text-xs line-clamp-2 mt-1">
                          {res.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                        {res.location && (
                          <div className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{res.location}</span>
                          </div>
                        )}
                        {res.capacity !== null && (
                          <div className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>Capacity: {res.capacity}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="pt-3 border-t">
                      <Link
                        href={prefillUrl}
                        className={buttonVariants({ variant: "default", size: "sm", className: "w-full text-xs" })}
                      >
                        Book for this slot
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Busy Resources (Collapsed / Expandable Details) */}
          {searchResult.busyResources.length > 0 && (
            <details className="group rounded-lg border bg-muted/20 p-4 transition-all">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground">
                <span>Not available during this slot ({searchResult.busyResources.length})</span>
                <span className="text-[11px] font-normal group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t">
                {searchResult.busyResources.map((res) => (
                  <div key={res.id} className="flex items-center justify-between p-2 rounded border bg-background/50 text-xs">
                    <div className="truncate mr-2">
                      <span className="font-medium text-foreground">{res.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        ({res.category.name})
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-rose-600 dark:text-rose-400 shrink-0">
                      Booked
                    </Badge>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Initial state prompt before any search */}
      {!hasTimeInputs && !validationErrors.length && (
        <Card className="border-dashed p-10 text-center shadow-xs">
          <CardContent className="space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <CardTitle className="text-base">Find Free Rooms and Equipment</CardTitle>
            <CardDescription className="text-xs max-w-sm mx-auto">
              Select your desired date, start time, and end time above to discover conflict-free shared resources.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
