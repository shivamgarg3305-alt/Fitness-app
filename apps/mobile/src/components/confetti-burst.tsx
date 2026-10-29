import { View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { AppText } from "@/components/ui";
import { GlassSurface } from "@/components/glass";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";

/**
 * Lightweight PR celebration banner.
 * Visibility is controlled by the parent (`active`); no local effect state.
 */
export function ConfettiBurst({ active, label = "New personal record" }: { active: boolean; label?: string }) {
  const { colors } = useTheme();
  if (!active) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 12, left: space.xl, right: space.xl, zIndex: 20 }}>
      <Animated.View entering={ZoomIn.springify().damping(14)}>
        <GlassSurface
          style={{ borderColor: colors.accent }}
          contentStyle={{ alignItems: "center", paddingVertical: space.md }}
        >
          <Animated.View entering={FadeIn}>
            <AppText variant="label" color={colors.accent}>
              {label}
            </AppText>
          </Animated.View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}
