"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useRemoveTherapist } from "@/lib/queries/therapists";
import type { Therapist } from "@/lib/types";

export function RemoveTherapistDialog({ therapist, onClose, onRemoved }: {
  therapist: Therapist | null;
  onClose: () => void;
  onRemoved: (message: string) => void;
}) {
  const remove = useRemoveTherapist();
  if (!therapist) return null;

  function confirm() {
    remove.mutate(therapist!.id, {
      onSuccess: ({ cancelled_appointments: n }) => {
        onRemoved(
          `${therapist!.full_name} was removed.` +
            (n ? ` ${n} upcoming appointment${n === 1 ? " was" : "s were"} cancelled.` : ""),
        );
        onClose();
      },
    });
  }

  return (
    <Modal open onClose={onClose} size="sm" title={`Remove ${therapist.full_name}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Keep</Button>
          <Button variant="danger" onClick={confirm} disabled={remove.isPending}>
            {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Remove therapist
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink">
        {remove.error && <Alert>{remove.error.message}</Alert>}
        <p>They&apos;ll disappear from the roster and can no longer be booked.</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Their <strong className="text-ink">upcoming</strong> appointments will be cancelled.</li>
          <li>Past appointments and invoices are kept for your records.</li>
        </ul>
      </div>
    </Modal>
  );
}