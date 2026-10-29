import { Platform, Pressable, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, Dumbbell, House, Moon, Utensils } from "lucide-react-native";
import { GlassSurface } from "@/components/glass";
import { AppText } from "@/components/ui";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";
import { selectionHaptic } from "@/lib/haptics";
import { useAppState } from "@/data/app-state";

function floatingBarShadow(shadowColor: string): ViewStyle {
  if (Platform.OS === "web") {
    return { boxShadow: `0px 8px 24px ${shadowColor}` } as ViewStyle;
  }
  return {
    shadowColor,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  };
}

const items = [
  { name: "index", label: "Home", Icon: House },
  { name: "activity", label: "Activity", Icon: Activity },
  { name: "workout", label: "Workout", Icon: Dumbbell },
  { name: "sleep", label: "Sleep", Icon: Moon },
  { name: "nutrition", label: "Nutrition", Icon: Utensils },
] as const;

/** Approximate floating tab chrome height for screen bottom padding. */
export const FLOATING_TAB_CLEARANCE = 88;

function TabItem({
  label,
  focused,
  Icon,
  onPress,
}: {
  label: string;
  focused: boolean;
  Icon: (typeof items)[number]["Icon"];
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: 4,
        minHeight: 48,
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <View
        style={{
          width: 36,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? colors.accentMuted : "transparent",
        }}
      >
        <Icon color={focused ? colors.accent : colors.textMuted} size={20} strokeWidth={focused ? 2.1 : 1.75} />
      </View>
      <AppText variant="caption" color={focused ? colors.text : colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function BottomNavigation({
  state,
  navigation,
}: {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { haptics } = useAppState();
  const bottom = Math.max(insets.bottom, 10);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: space.lg,
        paddingBottom: bottom,
      }}
    >
      <GlassSurface
        padded={false}
        style={{
          borderRadius: 28,
          ...floatingBarShadow(colors.shadow),
        }}
        contentStyle={{
          flexDirection: "row",
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 4,
        }}
      >
        {state.routes.map((route, index) => {
          const item = items.find((entry) => entry.name === route.name);
          if (!item) return null;
          const focused = state.index === index;
          return (
            <TabItem
              key={route.key}
              label={item.label}
              focused={focused}
              Icon={item.Icon}
              onPress={() => {
                void selectionHaptic(haptics);
                navigation.navigate(route.name);
              }}
            />
          );
        })}
      </GlassSurface>
    </View>
  );
}
