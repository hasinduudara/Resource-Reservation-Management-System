import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listResources, countUpcomingReservations } from "@/services/resources";
import { listCategories } from "@/services/categories";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResourceStatusButton } from "@/components/admin/resource-status-button";

export const metadata: Metadata = {
  title: "Resources | Admin | Resource Reservation Management System",
  description: "Configure and manage organizational resources and facilities.",
};

interface AdminResourcesPageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminResourcesPage({ searchParams }: AdminResourcesPageProps) {
  await requireRole("ADMIN");
  const params = await searchParams;

  const q = params.q?.trim() || "";
  const categoryId = params.categoryId?.trim() || "";
  const rawStatus = params.status?.toUpperCase();
  const statusFilter: "ALL" | "ACTIVE" | "INACTIVE" =
    rawStatus === "ACTIVE" || rawStatus === "INACTIVE" ? rawStatus : "ALL";

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 10;

  const [categories, resourcesResult] = await Promise.all([
    listCategories(),
    listResources({
      q: q || undefined,
      categoryId: categoryId || undefined,
      statusFilter,
      viewerRole: "ADMIN",
      page,
      pageSize,
    }),
  ]);

  // Pre-fetch upcoming reservations for each resource on this page
  const upcomingCounts = await Promise.all(
    resourcesResult.items.map((r) => countUpcomingReservations(r.id))
  );

  const totalPages = Math.max(1, Math.ceil(resourcesResult.total / pageSize));

  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (categoryId) sp.set("categoryId", categoryId);
    if (statusFilter !== "ALL") sp.set("status", statusFilter);
    sp.set("page", targetPage.toString());
    return `/admin/resources?${sp.toString()}`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Resource Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, configure, and maintain organizational resources ({resourcesResult.total} total).
          </p>
        </div>
        <Link href="/admin/resources/new" className={buttonVariants({ size: "sm" })}>
          New Resource
        </Link>
      </div>

      <Card className="shadow-xs border">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Directory</CardTitle>
              <CardDescription>Filter resources by keyword, category, and status.</CardDescription>
            </div>

            <form method="GET" action="/admin/resources" className="flex flex-wrap items-center gap-2">
              <Input
                name="q"
                type="search"
                placeholder="Search name, location..."
                defaultValue={q}
                className="w-40 sm:w-52 h-9 text-sm"
              />
              <select
                name="categoryId"
                defaultValue={categoryId}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={statusFilter}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <Button type="submit" size="sm" variant="secondary" className="h-9">
                Filter
              </Button>
              {(q || categoryId || statusFilter !== "ALL") && (
                <Link
                  href="/admin/resources"
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "h-9 text-xs" })}
                >
                  Reset
                </Link>
              )}
            </form>
          </div>
        </CardHeader>

        <CardContent>
          {resourcesResult.items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
              No resources found matching your criteria.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Capacity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resourcesResult.items.map((resource, idx) => (
                    <TableRow key={resource.id}>
                      <TableCell className="font-semibold text-foreground">
                        {resource.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {resource.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {resource.location || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {resource.capacity ?? <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        {resource.isActive ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium text-xs"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-rose-500/40 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 font-medium text-xs"
                          >
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/resources/${resource.id}/edit`}
                            className={buttonVariants({ variant: "ghost", size: "sm", className: "h-8 px-2.5 text-xs" })}
                          >
                            Edit
                          </Link>
                          <ResourceStatusButton
                            resourceId={resource.id}
                            resourceName={resource.name}
                            isActive={resource.isActive}
                            upcomingReservationsCount={upcomingCounts[idx]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {resourcesResult.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
              <div>
                Showing{" "}
                <span className="font-medium text-foreground">
                  {(page - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-foreground">
                  {Math.min(page * pageSize, resourcesResult.total)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">{resourcesResult.total}</span>{" "}
                resources
              </div>

              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={buildPageUrl(page - 1)}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 text-xs" })}
                  >
                    Previous
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled className="h-8 text-xs">
                    Previous
                  </Button>
                )}

                <span className="text-xs text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>

                {page < totalPages ? (
                  <Link
                    href={buildPageUrl(page + 1)}
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
        </CardContent>
      </Card>
    </div>
  );
}
