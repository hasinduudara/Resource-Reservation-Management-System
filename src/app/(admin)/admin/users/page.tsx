import type { Metadata } from "next";
import Link from "next/link";
import type { UserStatus } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { listUsers } from "@/services/users";
import { formatInAppTimezone } from "@/lib/time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ApproveButton,
  RejectButton,
  DisableButton,
  EnableButton,
} from "@/components/admin/user-action-buttons";

export const metadata: Metadata = {
  title: "User Management | Resource Reservation Management System",
  description: "Manage system accounts, approvals, and user status.",
};

interface AdminUsersPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

function renderStatusBadge(status: UserStatus) {
  switch (status) {
    case "PENDING":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 font-medium"
        >
          PENDING
        </Badge>
      );
    case "ACTIVE":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium"
        >
          ACTIVE
        </Badge>
      );
    case "DISABLED":
      return (
        <Badge
          variant="outline"
          className="border-rose-500/40 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 font-medium"
        >
          DISABLED
        </Badge>
      );
  }
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;

  const search = params.search?.trim() || "";
  const rawStatus = params.status?.toUpperCase();
  const statusFilter: UserStatus | undefined =
    rawStatus === "PENDING" || rawStatus === "ACTIVE" || rawStatus === "DISABLED"
      ? (rawStatus as UserStatus)
      : undefined;

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 10;

  // 1. Fetch pending approvals queue
  const pendingQueue = await listUsers({
    status: "PENDING",
    pageSize: 50,
  });

  // 2. Fetch filtered/searched list for "All users" table
  const allUsersResult = await listUsers({
    status: statusFilter,
    search: search || undefined,
    page,
    pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(allUsersResult.total / pageSize));

  // Build pagination query strings preserving filters
  const buildPageUrl = (targetPage: number) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (statusFilter) q.set("status", statusFilter);
    q.set("page", targetPage.toString());
    return `/admin/users?${q.toString()}`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review pending registrations and oversee user access across the organization.
        </p>
      </div>

      {/* SECTION 1: Pending Approvals */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">Pending Approvals</CardTitle>
                <Badge
                  variant={pendingQueue.total > 0 ? "destructive" : "secondary"}
                  className="font-mono text-xs"
                >
                  {pendingQueue.total}
                </Badge>
              </div>
              <CardDescription>
                New user accounts requiring administrator validation before access is granted.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pendingQueue.users.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
              No pending registrations
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingQueue.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatInAppTimezone(user.createdAt, "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <ApproveButton userId={user.id} userName={user.name} />
                          <RejectButton userId={user.id} userName={user.name} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: All Users */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">All Users</CardTitle>
              <CardDescription>
                Directory of all registered, active, and disabled accounts ({allUsersResult.total} total).
              </CardDescription>
            </div>

            {/* Filter and Search Form */}
            <form method="GET" action="/admin/users" className="flex flex-wrap items-center gap-2">
              <Input
                name="search"
                type="search"
                placeholder="Search name or email..."
                defaultValue={search}
                className="w-48 sm:w-60 h-9 text-sm"
              />
              <select
                name="status"
                defaultValue={statusFilter || "ALL"}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
              <Button type="submit" size="sm" variant="secondary" className="h-9">
                Filter
              </Button>
              {(search || statusFilter) && (
                <Link
                  href="/admin/users"
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "h-9 text-xs" })}
                >
                  Reset
                </Link>
              )}
            </form>
          </div>
        </CardHeader>

        <CardContent>
          {allUsersResult.users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
              No users matched your query.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved By / At</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsersResult.users.map((user) => {
                    const isSelf = user.id === admin.id;

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                          {isSelf && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground font-semibold">
                              (You)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.role === "ADMIN" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{renderStatusBadge(user.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.approvedBy ? (
                            <div>
                              <span className="font-medium text-foreground">
                                {user.approvedBy.name}
                              </span>
                              {user.approvedAt && (
                                <div className="text-[11px] text-muted-foreground">
                                  {formatInAppTimezone(user.approvedAt, "yyyy-MM-dd")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatInAppTimezone(user.createdAt, "yyyy-MM-dd")}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          {isSelf ? (
                            <span className="text-xs font-semibold text-muted-foreground px-2 py-1 rounded bg-muted/50">
                              You
                            </span>
                          ) : user.status === "ACTIVE" ? (
                            <DisableButton userId={user.id} userName={user.name} />
                          ) : user.status === "DISABLED" ? (
                            <EnableButton userId={user.id} userName={user.name} />
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <ApproveButton userId={user.id} userName={user.name} />
                              <RejectButton userId={user.id} userName={user.name} />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {allUsersResult.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
              <div>
                Showing{" "}
                <span className="font-medium text-foreground">
                  {(page - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-foreground">
                  {Math.min(page * pageSize, allUsersResult.total)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {allUsersResult.total}
                </span>{" "}
                users
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
