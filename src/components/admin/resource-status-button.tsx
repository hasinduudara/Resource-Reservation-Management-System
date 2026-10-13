"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setResourceActiveAction } from "@/app/(admin)/admin/resources/actions";

interface ResourceStatusButtonProps {
  resourceId: string;
  resourceName: string;
  isActive: boolean;
  upcomingReservationsCount: number;
}

export function ResourceStatusButton({
  resourceId,
  resourceName,
  isActive,
  upcomingReservationsCount,
}: ResourceStatusButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleActivate = () => {
    startTransition(async () => {
      const res = await setResourceActiveAction(resourceId, true);
      if (res.success) {
        toast.success(`Activated "${resourceName}"`);
      } else {
        toast.error(res.message || "Failed to activate resource");
      }
    });
  };

  const handleDeactivate = () => {
    startTransition(async () => {
      const res = await setResourceActiveAction(resourceId, false);
      if (res.success) {
        toast.success(`Deactivated "${resourceName}"`);
        setOpen(false);
      } else {
        toast.error(res.message || "Failed to deactivate resource");
      }
    });
  };

  if (!isActive) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleActivate}
        disabled={isPending}
        className="h-8 px-2.5 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
      >
        {isPending ? "Activating..." : "Activate"}
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="h-8 px-2.5 text-xs text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
      >
        Deactivate
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Resource</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{" "}
              <strong className="text-foreground">&quot;{resourceName}&quot;</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p>
              {upcomingReservationsCount === 1 ? (
                <>This resource has <strong className="text-foreground">1 upcoming reservation</strong>.</>
              ) : (
                <>This resource has <strong className="text-foreground">{upcomingReservationsCount} upcoming reservations</strong>.</>
              )}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200 dark:border-amber-900/50">
              Existing reservations will stay as they are, but no new reservations can be made on this resource once deactivated.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={isPending}
            >
              {isPending ? "Deactivating..." : "Confirm Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
