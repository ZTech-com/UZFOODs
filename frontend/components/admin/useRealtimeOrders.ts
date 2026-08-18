"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import type { SerializedOrder } from "@/lib/types";

/**
 * Admin panelda real-vaqt yangilanish:
 * - "order.created" → query'lar yangilanadi + onOrderCreated chaqiriladi (toast/bildirishnoma)
 * - "order.updated" → query'lar yangilanadi
 */
export function useRealtimeOrders(
  onOrderCreated?: (order: SerializedOrder) => void,
) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(onOrderCreated);
  callbackRef.current = onOrderCreated;

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    };

    const handleCreated = (order: SerializedOrder) => {
      refresh();
      callbackRef.current?.(order);
    };

    socket.on("order.created", handleCreated);
    socket.on("order.updated", refresh);

    return () => {
      socket.off("order.created", handleCreated);
      socket.off("order.updated", refresh);
    };
  }, [queryClient]);
}
