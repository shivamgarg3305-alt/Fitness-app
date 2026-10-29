/**
 * VitaCore Dark Glass design tokens.
 * Primary product look is the dark palette. Light remains a readable fallback,
 * not a second brand system.
 */
export const palette = {
  dark: {
    canvas: "#0A0A0E",
    background: "#121218",
    surface: "rgba(28, 30, 40, 0.72)",
    elevated: "rgba(36, 40, 52, 0.88)",
    border: "rgba(255,255,255,0.12)",
    glassBorder: "rgba(255,255,255,0.12)",
    glassFill: "rgba(18, 18, 24, 0.45)",
    glassTint: "rgba(18, 18, 24, 0.55)",
    glassFallback: "rgba(28, 30, 40, 0.92)",
    text: "#F4F6FA",
    textSecondary: "#9AA3B2",
    textMuted: "#6B7382",
    accent: "#E09F67",
    accentMuted: "rgba(224,159,103,0.16)",
    accentSecondary: "#38BDF8",
    accentSecondaryMuted: "rgba(56,189,248,0.14)",
    onAccent: "#1A1208",
    success: "#5EC4A0",
    warning: "#E09F67",
    danger: "#E58B7B",
    info: "#38BDF8",
    track: "rgba(255,255,255,0.08)",
    chart: ["#E09F67", "#38BDF8", "#5EC4A0", "#8EB7FF", "#E58B7B"],
    stageAwake: "#F4F6FA",
    stageLight: "#38BDF8",
    stageRem: "#8EB7FF",
    stageDeep: "#5EC4A0",
    shadow: "rgba(0,0,0,0.45)",
    ambientTop: "rgba(56,189,248,0.10)",
    ambientBottom: "rgba(224,159,103,0.08)",
  },
  light: {
    canvas: "#E8ECF2",
    background: "#F2F5FA",
    surface: "rgba(255,255,255,0.78)",
    elevated: "rgba(255,255,255,0.94)",
    border: "rgba(18,22,32,0.10)",
    glassBorder: "rgba(18,22,32,0.10)",
    glassFill: "rgba(255,255,255,0.55)",
    glassTint: "rgba(255,255,255,0.65)",
    glassFallback: "rgba(255,255,255,0.92)",
    text: "#141821",
    textSecondary: "#5A6475",
    textMuted: "#8A93A3",
    accent: "#C47A3E",
    accentMuted: "rgba(196,122,62,0.12)",
    accentSecondary: "#0284C7",
    accentSecondaryMuted: "rgba(2,132,199,0.12)",
    onAccent: "#FFF9F2",
    success: "#2F7D57",
    warning: "#C47A3E",
    danger: "#A33B32",
    info: "#0284C7",
    track: "rgba(18,22,32,0.08)",
    chart: ["#C47A3E", "#0284C7", "#2F7D57", "#2C5F99", "#A33B32"],
    stageAwake: "#5A6475",
    stageLight: "#0284C7",
    stageRem: "#2C5F99",
    stageDeep: "#2F7D57",
    shadow: "rgba(18,22,32,0.10)",
    ambientTop: "rgba(2,132,199,0.08)",
    ambientBottom: "rgba(196,122,62,0.06)",
  },
} as const;

export type ThemeName = keyof typeof palette;
export type AppColors = (typeof palette)[ThemeName];

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

export const font = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
} as const;

/** Default blur strength for glass surfaces (expo-blur intensity). */
export const glassBlurIntensity = 25;
