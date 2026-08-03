"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidPayment, waivePenalty } from "@/lib/actions/payments";

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        const reason = window.prompt("Reason for voiding this payment?");
        if (!reason) return;
        startTransition(async () => {
          const res = await voidPayment(paymentId, reason);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? "Voiding…" : "Void"}
    </button>
  );
}

export function WaivePenaltyButton({ penaltyId }: { penaltyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          setTimeout(() => setConfirming(false), 3000);
          return;
        }
        startTransition(async () => {
          const res = await waivePenalty(penaltyId);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
      className="text-sm font-medium text-amber-700 hover:text-amber-800 disabled:opacity-50"
    >
      {pending ? "Waiving…" : confirming ? "Confirm waive?" : "Waive"}
    </button>
  );
}
