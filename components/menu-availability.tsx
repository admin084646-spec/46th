"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/components/live";
import { setItemAvailabilityAction } from "@/lib/actions/orders";
import { formatINR } from "@/lib/money";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import type { Category, MenuItem } from "@/lib/types";

export function MenuAvailability({
  categories,
  items,
}: {
  categories: Category[];
  items: MenuItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  useLive(["role:admin"], 90000);

  async function toggle(item: MenuItem) {
    setBusy(item.id);
    await setItemAvailabilityAction(item.id, !item.is_available);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {[...categories]
        .sort((a, b) => a.sort - b.sort)
        .map((cat) => {
          const list = items
            .filter((i) => i.category_id === cat.id)
            .sort((a, b) => a.sort - b.sort);
          if (!list.length) return null;
          return (
            <section key={cat.id}>
              <h2 className="text-sm font-semibold text-ink mb-2">{cat.name}</h2>
              <div className="space-y-2">
                {list.map((item) => (
                  <Card key={item.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-ink truncate">
                            {item.name}
                          </p>
                          {!item.is_available ? (
                            <Badge tone="red">Sold out</Badge>
                          ) : (
                            <Badge tone="green">Available</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted tabular-nums">
                          {formatINR(item.price_minor)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={item.is_available ? "outline" : "success"}
                        disabled={busy === item.id}
                        onClick={() => toggle(item)}
                      >
                        {busy === item.id ? <Spinner /> : null}
                        {item.is_available ? "Mark sold out" : "Mark available"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
