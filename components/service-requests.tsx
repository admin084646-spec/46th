"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/components/live";
import { ackRequestAction, completeRequestAction } from "@/lib/actions/service";
import { formatTime, minutesSince } from "@/lib/format";
import { Badge, Banner, Button, Card, EmptyState, Spinner } from "@/components/ui";
import type { ServiceRequest } from "@/lib/types";

const LABEL: Record<string, string> = {
  waiter: "Call waiter",
  bill: "Bill requested",
  water: "Water / cutlery",
  custom: "Custom",
};

export function ServiceRequests({
  requests,
}: {
  requests: ServiceRequest[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLive(["role:waiter", "role:admin"], 20000);

  async function run(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    setError(null);
    const res = await fn(id);
    setBusy(null);
    if (!res.ok) setError(res.error ?? "Something went wrong");
    else router.refresh();
  }

  if (!requests.length) {
    return (
      <EmptyState
        title="No open requests"
        hint="Guest requests (waiter, water, bill) appear here."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {error ? <Banner tone="red">{error}</Banner> : null}
      {requests.map((r) => {
        const waited = minutesSince(r.created_at);
        return (
          <Card key={r.id} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{r.table_label}</span>
                  <Badge tone={r.status === "pending" ? "amber" : "blue"}>
                    {LABEL[r.type] ?? r.type}
                  </Badge>
                </div>
                {r.note ? (
                  <p className="text-xs text-muted mt-1">{r.note}</p>
                ) : null}
                <p className={"text-xs mt-1 " + (waited >= 5 ? "text-red font-semibold" : "text-muted")}>
                  {formatTime(r.created_at)} · {waited}m ago
                  {r.status === "ack" ? " · acknowledged" : ""}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {r.status === "pending" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    onClick={() => run(r.id, ackRequestAction)}
                  >
                    {busy === r.id ? <Spinner /> : null} Acknowledge
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="success"
                  disabled={busy === r.id}
                  onClick={() => run(r.id, completeRequestAction)}
                >
                  Done
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
