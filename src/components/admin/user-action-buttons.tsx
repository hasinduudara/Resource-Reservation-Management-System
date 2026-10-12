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
import {
  approveUserAction,
  rejectUserAction,
  disableUserAction,
  enableUserAction,
} from "@/app/(admin)/admin/users/actions";

interface ApproveButtonProps {
  userId: string;
  userName: string;
}

export function ApproveButton({ userId, userName }: ApproveButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approveUserAction(userId);
      if (res.success) {
        toast.success(`Approved account for ${userName}`);
      } else {
        toast.error(res.message || "Failed to approve user");
      }
    });
  };

  return (
    <Button
      size="sm"
      variant="default"
      onClick={handleApprove}
      disabled={isPending}
      className="h-8 px-3 text-xs"
    >
      {isPending ? "Approving..." : "Approve"}
    </Button>
  );
}

interface RejectButtonProps {
  userId: string;
  userName: string;
}

export function RejectButton({ userId, userName }: RejectButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleReject = () => {
    startTransition(async () => {
      const res = await rejectUserAction(userId);
      if (res.success) {
        toast.success(`Rejected registration for ${userName}`);
        setOpen(false);
      } else {
        toast.error(res.message || "Failed to reject user");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="h-8 px-3 text-xs"
      >
        Reject
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User Registration</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject the registration for{" "}
              <strong className="text-foreground">{userName}</strong>? Their account status
              will be set to <strong>DISABLED</strong> and they will not be able to log in.
            </DialogDescription>
          </DialogHeader>
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
              onClick={handleReject}
              disabled={isPending}
            >
              {isPending ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface DisableButtonProps {
  userId: string;
  userName: string;
}

export function DisableButton({ userId, userName }: DisableButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDisable = () => {
    startTransition(async () => {
      const res = await disableUserAction(userId);
      if (res.success) {
        toast.success(`Disabled account for ${userName}`);
        setOpen(false);
      } else {
        toast.error(res.message || "Failed to disable user");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="h-8 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
      >
        Disable
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable User Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to disable{" "}
              <strong className="text-foreground">{userName}</strong>? The user will immediately
              lose access to the application. All existing reservation data will be preserved.
            </DialogDescription>
          </DialogHeader>
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
              onClick={handleDisable}
              disabled={isPending}
            >
              {isPending ? "Disabling..." : "Confirm Disable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface EnableButtonProps {
  userId: string;
  userName: string;
}

export function EnableButton({ userId, userName }: EnableButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleEnable = () => {
    startTransition(async () => {
      const res = await enableUserAction(userId);
      if (res.success) {
        toast.success(`Re-enabled account for ${userName}`);
      } else {
        toast.error(res.message || "Failed to enable user");
      }
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleEnable}
      disabled={isPending}
      className="h-8 px-3 text-xs"
    >
      {isPending ? "Enabling..." : "Enable"}
    </Button>
  );
}
