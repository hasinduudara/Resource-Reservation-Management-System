import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getResourceById } from "@/services/resources";
import { formatInAppTimezone } from "@/lib/time";
import { NotFoundError } from "@/lib/errors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

interface ResourceDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: ResourceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const resource = await getResourceById(id, "ADMIN");
    return {
      title: `${resource.name} | Resource Reservation Management System`,
      description: resource.description || `View details for ${resource.name}`,
    };
  } catch {
    return {
      title: "Resource Details | Resource Reservation Management System",
    };
  }
}

export default async function ResourceDetailPage({ params }: ResourceDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  let resource;
  try {
    resource = await getResourceById(id, user.role);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6">
      {/* Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to all resources
        </Link>

        {user.role === "ADMIN" && (
          <Link
            href={`/admin/resources/${resource.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Edit Resource
          </Link>
        )}
      </div>

      {/* Main Details Card */}
      <Card className="shadow-xs border">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
              {resource.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {resource.category.name}
              </Badge>
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
            </div>
          </div>
          {resource.description && (
            <CardDescription className="text-sm text-foreground/80 leading-relaxed">
              {resource.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Location</span>
              <p className="text-sm font-medium">
                {resource.location || <span className="text-muted-foreground/60">—</span>}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Capacity</span>
              <p className="text-sm font-medium">
                {resource.capacity !== null ? (
                  `${resource.capacity} people / units`
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Category</span>
              <p className="text-sm font-medium">{resource.category.name}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Created On</span>
              <p className="text-xs font-mono text-muted-foreground">
                {formatInAppTimezone(resource.createdAt, "yyyy-MM-dd HH:mm")}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Last Updated</span>
              <p className="text-xs font-mono text-muted-foreground">
                {formatInAppTimezone(resource.updatedAt, "yyyy-MM-dd HH:mm")}
              </p>
            </div>
          </div>

          {/* Clearly marked placeholder section for future phases */}
          <div className="rounded-xl border border-dashed p-6 sm:p-8 text-center bg-muted/20 space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold tracking-tight">
              Availability and booking will appear here
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Real-time schedule timelines, availability checking, and instant reservation booking will be enabled in upcoming phases.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
