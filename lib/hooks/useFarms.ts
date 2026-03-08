"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, get, set, push } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Farm } from "@/types";

export function useFarms(userId: string | undefined) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setFarms([]);
      setLoading(false);
      return;
    }
    const farmsRef = ref(getFirebaseDb(), `users/${userId}/farms`);
    const unsub = () => {};
    get(farmsRef).then((snap) => {
      if (!snap.exists()) {
        setFarms([]);
      } else {
        const data = snap.val();
        setFarms(
          Object.entries(data).map(([id, v]) => ({
            id,
            ...(v as Omit<Farm, "id">),
          }))
        );
      }
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  const addFarm = useCallback(
    async (name: string): Promise<string | undefined> => {
      if (!userId) return;
      const farmsRef = ref(getFirebaseDb(), `users/${userId}/farms`);
      const newRef = push(farmsRef);
      await set(newRef, { name });
      const id = newRef.key ?? undefined;
      setFarms((prev) => [...prev, { id: id!, name }]);
      return id;
    },
    [userId]
  );

  return { farms, loading, addFarm };
}
