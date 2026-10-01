"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useDeletePatient } from "@/lib/queries/patients";
import type { Patient } from "@/lib/types";

export function DeletePatientDialog({ patient, onClose, onDeleted }: {
  patient: Patient;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const del = useDeletePatient();

  return (
    <Modal open onClose={onClose} size="sm" title={`Delete ${patient.full_name}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={del.isPending}
            onClick={() => del.mutate(patient.id, { onSuccess: () => { onDeleted?.(); onClose(); } })}>
            {del.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete patient
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink">
        {del.error && <Alert>{del.error.message}</Alert>}
        <p>This permanently removes the patient record and all of their appointments.</p>
        <p className="text-muted">Invoices are kept for your financial records, under the patient&apos;s name.</p>
      </div>
    </Modal>
  );
}