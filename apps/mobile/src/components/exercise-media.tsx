import { View } from "react-native";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import type { Exercise } from "@/exercises/catalog";
import { AppText } from "@/components/ui";
import { GlassSurface } from "@/components/glass";
import { radius, space } from "@/design/tokens";
import { useTheme } from "@/design/theme";

/** Clear placeholder when no licensed demonstration media exists. */
export function ExerciseMediaPanel({ exercise }: { exercise: Exercise }) {
  const { colors } = useTheme();
  return (
    <GlassSurface padded={false} style={{ borderRadius: radius.lg }} contentStyle={{ padding: space.lg, gap: space.md }}>
      <View style={{ alignItems: "center" }}>
        <Svg width={220} height={140} accessibilityLabel={`${exercise.name} diagram placeholder`}>
          <Rect x={8} y={8} width={204} height={124} rx={18} fill={colors.glassFill} stroke={colors.glassBorder} />
          <Circle cx={110} cy={36} r={14} stroke={colors.accentSecondary} strokeWidth={2} fill="none" />
          <Line x1={110} y1={50} x2={110} y2={88} stroke={colors.textSecondary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={110} y1={60} x2={78} y2={78} stroke={colors.textMuted} strokeWidth={3} strokeLinecap="round" />
          <Line x1={110} y1={60} x2={142} y2={78} stroke={colors.textMuted} strokeWidth={3} strokeLinecap="round" />
          <Line x1={110} y1={88} x2={86} y2={118} stroke={colors.textMuted} strokeWidth={3} strokeLinecap="round" />
          <Line x1={110} y1={88} x2={134} y2={118} stroke={colors.textMuted} strokeWidth={3} strokeLinecap="round" />
          <SvgText x={110} y={28} fill={colors.accent} fontSize="10" textAnchor="middle">
            {exercise.movementType.toUpperCase()}
          </SvgText>
        </Svg>
      </View>
      <AppText variant="label" color={colors.accent}>
        {exercise.media.placeholderLabel}
      </AppText>
      <AppText variant="small" color={colors.textSecondary}>
        {exercise.media.note}
      </AppText>
    </GlassSurface>
  );
}

export function MuscleTags({
  primary,
  secondary,
  groups,
}: {
  primary: string;
  secondary: string[];
  groups?: string[];
}) {
  const { colors } = useTheme();
  const tags = [
    { label: primary, tone: "primary" as const },
    ...secondary.map((label) => ({ label, tone: "secondary" as const })),
    ...(groups ?? []).filter((label) => label !== primary && !secondary.includes(label)).map((label) => ({
      label,
      tone: "muted" as const,
    })),
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {tags.map((tag) => (
        <View
          key={`${tag.tone}-${tag.label}`}
          style={{
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderWidth: 1,
            borderColor: tag.tone === "primary" ? colors.accent : colors.glassBorder,
            backgroundColor: tag.tone === "primary" ? colors.accentMuted : colors.glassFill,
          }}
        >
          <AppText
            variant="caption"
            color={tag.tone === "primary" ? colors.accent : tag.tone === "secondary" ? colors.text : colors.textMuted}
          >
            {tag.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function ExerciseCueCard({ exercise }: { exercise: Exercise }) {
  const { colors } = useTheme();
  return (
    <GlassSurface>
      <AppText variant="label">Setup</AppText>
      {exercise.setup.map((line) => (
        <AppText key={line} variant="small" color={colors.textSecondary}>
          · {line}
        </AppText>
      ))}
      <View style={{ height: space.md }} />
      <AppText variant="label">Execution</AppText>
      {exercise.instructions.map((line, index) => (
        <AppText key={line} variant="small" color={colors.textSecondary}>
          {index + 1}. {line}
        </AppText>
      ))}
      <View style={{ height: space.md }} />
      <AppText variant="label">Form cues</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {exercise.formCues.map((cue) => (
          <View
            key={cue}
            style={{
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.glassBorder,
              backgroundColor: colors.glassFill,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <AppText variant="caption">{cue}</AppText>
          </View>
        ))}
      </View>
      {exercise.breathing ? (
        <>
          <View style={{ height: space.md }} />
          <AppText variant="label">Breathing</AppText>
          <AppText variant="small" color={colors.textSecondary}>
            {exercise.breathing}
          </AppText>
        </>
      ) : null}
      {exercise.tempo ? (
        <>
          <View style={{ height: space.sm }} />
          <AppText variant="label">Tempo</AppText>
          <AppText variant="small" color={colors.textSecondary}>
            {exercise.tempo} (eccentric · pause · concentric)
          </AppText>
        </>
      ) : null}
      <View style={{ height: space.md }} />
      <AppText variant="caption" color={colors.accent}>
        Safety · {exercise.safety}
      </AppText>
    </GlassSurface>
  );
}
