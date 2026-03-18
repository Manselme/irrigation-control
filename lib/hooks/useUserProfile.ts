"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get, ref, set } from "firebase/database";
import { updatePassword, updateProfile } from "firebase/auth";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import type { UserProfile } from "@/types";
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";

export function useUserProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const load = async () => {
      const profileRef = ref(getFirebaseDb(), `users/${userId}/profile`);
      const snap = await get(profileRef);
      const authUser = getFirebaseAuth().currentUser;
      const base = snap.exists() ? (snap.val() as UserProfile) : {};
      const merged: UserProfile = {
        ...base,
        displayName: base.displayName ?? authUser?.displayName ?? "",
        photoURL: base.photoURL ?? authUser?.photoURL ?? "",
        email: base.email ?? authUser?.email ?? "",
      };
      setProfile(merged);
      setLoading(false);
    };
    load();
  }, [userId]);

  const saveProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!userId) return;
      const authUser = getFirebaseAuth().currentUser;
      const current = profile ?? {};
      const next = {
        ...current,
        ...updates,
        updatedAt: Date.now(),
      } satisfies UserProfile;
      await set(ref(getFirebaseDb(), `users/${userId}/profile`), next);
      if (authUser && typeof updates.displayName === "string") {
        await updateProfile(authUser, { displayName: updates.displayName });
      }
      setProfile(next);
    },
    [userId, profile]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!userId) return "";
      const ext = file.name.split(".").pop() || "jpg";
      const avatarRef = storageRef(getFirebaseStorage(), `avatars/${userId}/avatar.${ext}`);
      await uploadBytes(avatarRef, file);
      const url = await getDownloadURL(avatarRef);
      const authUser = getFirebaseAuth().currentUser;
      if (authUser) await updateProfile(authUser, { photoURL: url });
      await saveProfile({ photoURL: url });
      return url;
    },
    [userId, saveProfile]
  );

  const changePassword = useCallback(async (nextPassword: string) => {
    const authUser = getFirebaseAuth().currentUser;
    if (!authUser) throw new Error("Utilisateur non authentifié.");
    await updatePassword(authUser, nextPassword);
  }, []);

  const effectiveDisplayName = useMemo(() => {
    if (!profile) return "";
    if (profile.displayName) return profile.displayName;
    return [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  }, [profile]);

  return {
    profile,
    loading,
    saveProfile,
    uploadAvatar,
    changePassword,
    effectiveDisplayName,
  };
}

