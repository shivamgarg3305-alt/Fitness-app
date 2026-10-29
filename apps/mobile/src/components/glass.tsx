import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { AppText } from "@/components/ui";
import { font, glassBlurIntensity, radius, space } from "@/design/tokens";
import { useTheme } from "@/design/theme";

type Tone = "primary" | "secondary" | "ghost" | "danger";

function useReduceTransparency(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((value) => {
        if (mounted) setReduced(Boolean(value));
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.("reduceTransparencyChanged", (value) => {
      setReduced(Boolean(value));
    });
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);
  return reduced;
}

function canUseLiquidGlass(reducedTransparency: boolean): boolean {
  if (reducedTransparency || Platform.OS !== "ios") return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

function canUseBlur(reducedTransparency: boolean): boolean {
  if (reducedTransparency) return false;
  return Platform.OS === "ios" || Platform.OS === "android";
}

type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  padded?: boolean;
};

/**
 * Shared glass plane. Prefers iOS liquid glass when available, then expo-blur,
 * then a translucent solid fallback (web / reduced transparency / unsupported).
 */
export function GlassSurface({
  children,
  style,
  contentStyle,
  intensity = glassBlurIntensity,
  padded = true,
}: GlassSurfaceProps) {
  const { colors, name } = useTheme();
  const reduced = useReduceTransparency();
  const liquid = canUseLiquidGlass(reduced);
  const blur = canUseBlur(reduced);
  const pad = padded ? { padding: space.lg } : null;
  const shell: ViewStyle = {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  };

  if (liquid) {
    return (
      <GlassView
        style={[shell, style]}
        glassEffectStyle="regular"
        tintColor={colors.glassTint}
        colorScheme={name === "dark" ? "dark" : "light"}
      >
        <View style={[pad, contentStyle]}>{children}</View>
      </GlassView>
    );
  }

  if (blur) {
    return (
      <View style={[shell, style]}>
        <BlurView
          intensity={intensity}
          tint={name === "dark" ? "dark" : "light"}
          blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View style={[{ backgroundColor: colors.glassFill }, pad, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[shell, { backgroundColor: colors.glassFallback }, pad, style, contentStyle]}>
      {children}
    </View>
  );
}

export function GlassCard({
  children,
  style,
  enterDelay = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  enterDelay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).springify().damping(18)}>
      <GlassSurface style={style}>{children}</GlassSurface>
    </Animated.View>
  );
}

export function GlassButton({
  label,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const background =
    tone === "primary" ? colors.accent : tone === "danger" ? colors.danger : tone === "secondary" ? colors.glassFill : "transparent";
  const textColor = tone === "primary" ? colors.onAccent : tone === "danger" ? "#FFFFFF" : colors.text;
  const borderColor = tone === "secondary" || tone === "ghost" ? colors.glassBorder : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radius.pill,
        paddingHorizontal: space.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background,
        borderWidth: tone === "secondary" || tone === "ghost" ? StyleSheet.hairlineWidth : 0,
        borderColor,
        opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        transform: [{ scale: disabled ? 1 : pressed ? 0.98 : 1 }],
      })}
    >
      <AppText variant="small" color={textColor} style={{ fontFamily: font.medium }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function GlassInput({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  secureTextEntry,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "numeric" | "decimal-pad" | "numbers-and-punctuation";
  placeholder?: string;
  secureTextEntry?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { colors, name } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <GlassSurface padded={false} style={{ borderRadius: radius.md }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          textContentType={secureTextEntry ? "password" : undefined}
          accessibilityLabel={label}
          style={[
            {
              minHeight: 52,
              paddingHorizontal: space.lg,
              color: colors.text,
              fontFamily: font.regular,
              fontSize: 16,
              backgroundColor: name === "dark" ? "transparent" : colors.glassFill,
            },
            style,
          ]}
        />
      </GlassSurface>
    </View>
  );
}

export function GlassHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <AppText variant="label">{eyebrow}</AppText> : null}
        <AppText variant="h1">{title}</AppText>
      </View>
      {trailing}
    </Animated.View>
  );
}

/** Full-bleed ambient wash behind screens. Not a card — atmosphere only. */
export function AmbientBackground({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.ambientTop, "transparent", colors.ambientBottom]}
        locations={[0, 0.45, 1]}
        style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
      />
      {children}
    </View>
  );
}

export function GlassIconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <GlassSurface
        padded={false}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
        contentStyle={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}
