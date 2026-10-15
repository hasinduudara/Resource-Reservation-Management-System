import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "404 – Page Not Found | RRSM",
  description: "The page you are looking for does not exist.",
};

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-md text-center space-y-6">
        <p className="text-8xl font-extrabold tracking-tight text-primary/20 select-none">
          404
        </p>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
          <p className="text-muted-foreground text-sm">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It
            may have been moved or deleted.
          </p>
        </div>

        <div className="flex justify-center gap-3">
          <Link href="/" className={buttonVariants()}>
            Go home
          </Link>
          <Link href="/resources" className={buttonVariants({ variant: "outline" })}>
            Browse resources
          </Link>
        </div>
      </div>
    </div>
  );
}
