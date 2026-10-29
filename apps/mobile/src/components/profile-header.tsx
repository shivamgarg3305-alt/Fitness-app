import { brandConfig } from "@vitacore/brand";
import { useRouter } from "expo-router";
import { GlassHeader, GlassIconButton } from "@/components/glass";
import { Avatar } from "@/components/ui";
import { useAppState } from "@/data/app-state";

/**
 * Persistent brand + avatar entry to Profile/Settings.
 * Use on tab roots and major stack screens so settings stay one tap away.
 */
export function ProfileHeader({
  title,
  eyebrow = brandConfig.name,
}: {
  title: string;
  eyebrow?: string;
}) {
  const router = useRouter();
  const { profile } = useAppState();
  return (
    <GlassHeader
      eyebrow={eyebrow}
      title={title}
      trailing={
        <GlassIconButton label="Open profile and settings" onPress={() => router.push("/profile")}>
          <Avatar label={profile?.displayName ?? brandConfig.name} />
        </GlassIconButton>
      }
    />
  );
}
