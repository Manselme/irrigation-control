"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, set } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import {
  type QuickAccessItem,
  getDefaultQuickAccessItems,
  isValidQuickAccessHref,
} from "@/lib/quickAccess";

function validateItems(items: unknown): QuickAccessItem[] {
  if (!Array.isArray(items) || items.length === 0) return getDefaultQuickAccessItems();
  const out: QuickAccessItem[] = [];
  for (const x of items) {
    if (x && typeof x === "object" && "id" in x && "href" in x && "label" in x) {
      const href = String((x as { href: unknown }).href);
      if (isValidQuickAccessHref(href)) {
        out.push({
          id: String((x as { id: unknown }).id),
          href,
          label: String((x as { label: unknown }).label),
        });
      }
    }
  }
  return out.length > 0 ? out : getDefaultQuickAccessItems();
}

export function useQuickAccess(userId: string | undefined) {
  const [items, setItems] = useState<QuickAccessItem[]>(getDefaultQuickAccessItems());

  useEffect(() => {
    if (!userId) {
      setItems(getDefaultQuickAccessItems());
      return;
    }
    const quickAccessRef = ref(getFirebaseDb(), `users/${userId}/quickAccess`);
    const unsubscribe = onValue(quickAccessRef, (snap) => {
      if (!snap.exists()) {
        setItems(getDefaultQuickAccessItems());
        return;
      }
      const val = snap.val();
      setItems(validateItems(val));
    });
    return () => unsubscribe();
  }, [userId]);

  const setQuickAccess = useCallback(
    async (newItems: QuickAccessItem[]) => {
      if (!userId) return;
      const cleaned = newItems.filter((item) => isValidQuickAccessHref(item.href));
      if (cleaned.length === 0) return;
      const quickAccessRef = ref(getFirebaseDb(), `users/${userId}/quickAccess`);
      await set(quickAccessRef, cleaned);
    },
    [userId]
  );

  return { items, setQuickAccess };
}
