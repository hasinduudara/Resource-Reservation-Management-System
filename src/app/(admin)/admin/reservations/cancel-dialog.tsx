"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adminCancelReservationAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AdminCancelReservationDialogProps {
  reservationId: string;
  userName: string;
  resourceName: string;
  timeRange: string;
}

export function AdminCancelReservationDialog({
  reservationId,
  userName,
  resourceName,
  timeRange,
}: AdminCancelReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      const result = await adminCancelReservationAction(reservationId);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          >
            Cancel
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Reservation</DialogTitle>
          <DialogDescription>
            Cancel this reservation for <span className="font-semibold text-foreground">{userName}</span>? The time slot becomes available again.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted/60 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resource:</span>
            <span className="font-medium text-foreground">{resourceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time slot:</span>
            <span className="font-mono text-foreground">{timeRange}</span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" disabled={isPending} />}>
            Keep Reservation
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? "Cancelling..." : "Cancel Reservation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
