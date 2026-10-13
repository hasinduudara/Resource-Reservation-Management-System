import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listResources } from "@/services/resources";
import { listCategories } from "@/services/categories";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Resources | Resource Reservation Management System",
  description: "Browse and discover shared equipment, rooms, and facilities.",
};

interface ResourcesPageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    includeInactive?: string;
    page?: string;
  }>;
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() || "";
  const categoryId = params.categoryId?.trim() || "";
  const includeInactive = user.role === "ADMIN" && params.includeInactive === "true";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 9; // Clean 3x3 grid for responsive display

  const [categories, resourcesResult] = await Promise.all([
    listCategories(),
    listResources({
      q: q || undefined,
      categoryId: categoryId || undefined,
      includeInactive,
      viewerRole: user.role,
      page,
      pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(resourcesResult.total / pageSize));

  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (categoryId) sp.set("categoryId", categoryId);
    if (includeInactive) sp.set("includeInactive", "true");
    sp.set("page", targetPage.toString());
    return `/resources?${sp.toString()}`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-8">
      {/* Page Title & Search Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Available Resources</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and discover shared facilities, equipment, and meeting spaces.
          </p>
        </div>

        {/* Filter Form */}
        <form method="GET" action="/resources" className="flex flex-wrap items-center gap-2">
          <Input
            name="q"
            type="search"
            placeholder="Search resources..."
            defaultValue={q}
            className="w-44 sm:w-56 h-9 text-sm"
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

          {user.role === "ADMIN" && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded border border-input bg-background h-9">
              <input
                type="checkbox"
                name="includeInactive"
                value="true"
                defaultChecked={includeInactive}
                className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span>Include inactive</span>
            </label>
          )}

          <Button type="submit" size="sm" variant="secondary" className="h-9">
            Search
          </Button>
          {(q || categoryId || includeInactive) && (
            <Link
              href="/resources"
              className={buttonVariants({ variant: "ghost", size: "sm", className: "h-9 text-xs" })}
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Grid of Resource Cards */}
      {resourcesResult.items.length === 0 ? (
        <Card className="shadow-xs border border-dashed py-16 text-center">
          <CardContent className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <CardTitle className="text-lg">No resources found</CardTitle>
            <CardDescription>
              {q || categoryId
                ? "Try adjusting your search criteria or removing filters."
                : "No shared resources are currently available in the system."}
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resourcesResult.items.map((resource) => (
            <Card
              key={resource.id}
              className={`flex flex-col justify-between shadow-xs transition-shadow hover:shadow-md border ${
                !resource.isActive ? "bg-muted/30 border-dashed border-rose-300 dark:border-rose-900/40" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold tracking-tight">
                      {resource.name}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge variant="secondary" className="text-xs">
                        {resource.category.name}
                      </Badge>
                      {!resource.isActive && (
                        <Badge
                          variant="outline"
                          className="border-rose-500/40 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 font-medium text-xs"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 flex-1">
                {resource.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {resource.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground pt-1">
                  {resource.location && (
                    <div className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{resource.location}</span>
                    </div>
                  )}

                  {resource.capacity !== null && (
                    <div className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Capacity: {resource.capacity}</span>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t">
                <Link
                  href={`/resources/${resource.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "w-full text-xs" })}
                >
                  View Details
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {resourcesResult.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t text-sm text-muted-foreground">
          <div>
            Showing <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}</span> to{" "}
            <span className="font-medium text-foreground">
              {Math.min(page * pageSize, resourcesResult.total)}
            </span> of <span className="font-medium text-foreground">{resourcesResult.total}</span> resources
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
    </div>
  );
}
