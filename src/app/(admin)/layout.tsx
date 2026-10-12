import Link from "next/link";
import { requireRole } from "@/lib/session";
import { logoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminSubNav } from "@/components/admin/admin-sub-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireRole("ADMIN");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-lg font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity"
            >
              RRSM Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link
                href="/admin"
                className="text-foreground transition-colors hover:text-primary font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/resources"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                App View
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{admin.name}</span>
              <Badge variant="default" className="text-xs">
                ADMIN
              </Badge>
            </div>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <AdminSubNav />

      <main className="flex-1">{children}</main>
    </div>
  );
}
