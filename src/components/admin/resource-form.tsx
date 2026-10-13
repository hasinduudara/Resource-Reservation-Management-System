"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createResourceAction,
  updateResourceAction,
  type ResourceActionResult,
} from "@/app/(admin)/admin/resources/actions";
import type { ResourceDetails } from "@/services/resources";

interface CategoryOption {
  id: string;
  name: string;
}

interface ResourceFormProps {
  categories: CategoryOption[];
  initialData?: ResourceDetails;
  upcomingReservationsCount?: number;
}

const initialState: ResourceActionResult = {
  success: false,
};

export function ResourceForm({
  categories,
  initialData,
  upcomingReservationsCount = 0,
}: ResourceFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialData);

  const actionFn = isEditing && initialData
    ? updateResourceAction.bind(null, initialData.id)
    : createResourceAction;

  const [state, formAction, isPending] = useActionState(actionFn, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(isEditing ? "Resource updated successfully" : "Resource created successfully");
      router.push("/admin/resources");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, isEditing, router]);

  if (categories.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto border shadow-xs">
        <CardHeader>
          <CardTitle>No Categories Available</CardTitle>
          <CardDescription>
            You must create at least one category before adding or modifying resources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Categories like &quot;Meeting Room&quot;, &quot;Vehicle&quot;, or &quot;Equipment&quot; help organize resources and enable structured browsing.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/admin/categories" className={buttonVariants()}>
            Go to Categories
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto border shadow-xs">
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-tight">
          {isEditing ? `Edit "${initialData?.name}"` : "New Resource"}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? "Update resource configuration, capacity, and details."
            : "Define a new shared facility, room, or asset for organization reservations."}
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {isEditing && upcomingReservationsCount > 0 && (
            <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Note:</span> This resource currently has{" "}
              <strong>{upcomingReservationsCount}</strong> upcoming confirmed reservation(s). Updating attributes will not disrupt existing bookings.
            </div>
          )}

          {state.message && (
            <div
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {state.message}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              Resource Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={initialData?.name || ""}
              placeholder="e.g. Conference Room A, Company Van"
              required
              disabled={isPending}
            />
            {state.fieldErrors?.name?.[0] && (
              <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">
              Category <span className="text-destructive">*</span>
            </Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={initialData?.categoryId || categories[0]?.id}
              required
              disabled={isPending}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.categoryId?.[0] && (
              <p className="text-xs text-destructive">{state.fieldErrors.categoryId[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                defaultValue={initialData?.location || ""}
                placeholder="e.g. 2nd Floor, West Wing"
                disabled={isPending}
              />
              {state.fieldErrors?.location?.[0] && (
                <p className="text-xs text-destructive">{state.fieldErrors.location[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (persons / items)</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min="1"
                max="10000"
                defaultValue={initialData?.capacity ?? ""}
                placeholder="e.g. 10"
                disabled={isPending}
              />
              {state.fieldErrors?.capacity?.[0] && (
                <p className="text-xs text-destructive">{state.fieldErrors.capacity[0]}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initialData?.description || ""}
              placeholder="Features, amenities, projector, whiteboard, etc."
              rows={4}
              disabled={isPending}
            />
            {state.fieldErrors?.description?.[0] && (
              <p className="text-xs text-destructive">{state.fieldErrors.description[0]}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-4">
          <Link
            href="/admin/resources"
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
              ? "Save Changes"
              : "Create Resource"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
