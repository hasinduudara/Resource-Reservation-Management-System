import Link from "next/link";
import { requireRole } from "@/lib/session";
import { logoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireRole("ADMIN");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1 overflow-hidden">
            <Link
              href="/admin"
              className="text-lg font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity whitespace-nowrap shrink-0"
            >
              RRSM Admin
            </Link>
            <AdminNav />
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[160px]">
                {admin.name}
              </span>
              <Badge variant="default" className="text-[10px] sm:text-xs">
                ADMIN
              </Badge>
            </div>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit" className="h-8 px-2 sm:px-3 text-xs">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
