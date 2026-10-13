import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getResourceById, countUpcomingReservations } from "@/services/resources";
import { listCategories } from "@/services/categories";
import { ResourceForm } from "@/components/admin/resource-form";
import { NotFoundError } from "@/lib/errors";

export const metadata: Metadata = {
  title: "Edit Resource | Admin | Resource Reservation Management System",
  description: "Modify an existing organizational resource.",
};

interface EditResourcePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditResourcePage({ params }: EditResourcePageProps) {
  await requireRole("ADMIN");
  const { id } = await params;

  let resource;
  try {
    resource = await getResourceById(id, "ADMIN");
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const [categories, upcomingCount] = await Promise.all([
    listCategories(),
    countUpcomingReservations(id),
  ]);

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6">
      <ResourceForm
        categories={categories}
        initialData={resource}
        upcomingReservationsCount={upcomingCount}
      />
    </div>
  );
}
