import { useMemo, useRef } from "react";
import { FlatList, Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { AppText } from "@/components/ui";
import { GlassSurface } from "@/components/glass";
import { font, radius, space } from "@/design/tokens";
import { useTheme } from "@/design/theme";
import type { UnitSystem } from "@vitacore/domain";
import { cmToFeetAndInches, feetAndInchesToCm, kgToLb, lbToKg } from "@vitacore/domain";

const AGE_MIN = 13;
const AGE_MAX = 100;
const AGE_ITEM = 44;

export function AgeWheel({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (age: number) => void;
}) {
  const { colors } = useTheme();
  const ages = useMemo(() => Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, i) => AGE_MIN + i), []);
  const listRef = useRef<FlatList<number>>(null);
  const selected = value ?? 28;

  return (
    <View style={{ height: AGE_ITEM * 5, borderRadius: radius.lg, overflow: "hidden" }}>
      <GlassSurface padded={false} style={{ flex: 1 }} contentStyle={{ flex: 1 }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: AGE_ITEM * 2,
            height: AGE_ITEM,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.accent,
            zIndex: 2,
          }}
        />
        <FlatList
          ref={listRef}
          data={ages}
          keyExtractor={(item) => String(item)}
          showsVerticalScrollIndicator={false}
          snapToInterval={AGE_ITEM}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: AGE_ITEM, offset: AGE_ITEM * index, index })}
          contentContainerStyle={{ paddingVertical: AGE_ITEM * 2 }}
          initialScrollIndex={Math.max(0, selected - AGE_MIN)}
          onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const index = Math.round(event.nativeEvent.contentOffset.y / AGE_ITEM);
            const age = ages[Math.max(0, Math.min(ages.length - 1, index))] ?? selected;
            onChange(age);
          }}
          renderItem={({ item }) => (
            <View style={{ height: AGE_ITEM, alignItems: "center", justifyContent: "center" }}>
              <AppText
                variant={item === selected ? "h2" : "body"}
                color={item === selected ? colors.text : colors.textMuted}
                style={{ fontFamily: item === selected ? font.medium : font.regular }}
              >
                {item}
              </AppText>
            </View>
          )}
        />
      </GlassSurface>
      <AppText variant="caption" color={colors.textSecondary} style={{ textAlign: "center", marginTop: space.sm }}>
        Years · scroll to select
      </AppText>
    </View>
  );
}

const RULER_ITEM = 12;

export function HeightRuler({
  units,
  heightCm,
  onChangeCm,
}: {
  units: UnitSystem;
  heightCm: number | null;
  onChangeCm: (cm: number) => void;
}) {
  const { colors } = useTheme();
  const metricValues = useMemo(() => Array.from({ length: 121 }, (_, i) => 120 + i), []); // 120–240 cm
  const selectedCm = heightCm ?? 170;
  const imperial = cmToFeetAndInches(selectedCm);

  if (units === "imperial") {
    const feetOptions = [4, 5, 6, 7];
    const inchOptions = Array.from({ length: 12 }, (_, i) => i);
    return (
      <View style={{ gap: space.md }}>
        <AppText variant="h2" style={{ textAlign: "center" }}>
          {`${imperial.feet} ft ${imperial.inches} in`}
        </AppText>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1, gap: space.sm }}>
            <AppText variant="label">Feet</AppText>
            {feetOptions.map((feet) => (
              <Pressable
                key={feet}
                onPress={() => onChangeCm(feetAndInchesToCm(feet, imperial.inches))}
                style={{
                  minHeight: 44,
                  borderRadius: radius.md,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: imperial.feet === feet ? colors.accent : colors.glassBorder,
                  backgroundColor: imperial.feet === feet ? colors.accentMuted : colors.glassFill,
                }}
              >
                <AppText color={imperial.feet === feet ? colors.accent : colors.text}>{feet}</AppText>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1, gap: space.sm }}>
            <AppText variant="label">Inches</AppText>
            <FlatList
              data={inchOptions}
              keyExtractor={(item) => String(item)}
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onChangeCm(feetAndInchesToCm(imperial.feet, item))}
                  style={{
                    minHeight: 40,
                    borderRadius: radius.sm,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: imperial.inches === item ? colors.accent : colors.glassBorder,
                    backgroundColor: imperial.inches === item ? colors.accentMuted : colors.glassFill,
                  }}
                >
                  <AppText color={imperial.inches === item ? colors.accent : colors.text}>{item}</AppText>
                </Pressable>
              )}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="h2" style={{ textAlign: "center" }}>
        {Math.round(selectedCm)} cm
      </AppText>
      <GlassSurface padded={false} style={{ height: 88 }} contentStyle={{ justifyContent: "center" }}>
        <FlatList
          horizontal
          data={metricValues}
          keyExtractor={(item) => String(item)}
          showsHorizontalScrollIndicator={false}
          snapToInterval={RULER_ITEM}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: RULER_ITEM, offset: RULER_ITEM * index, index })}
          contentContainerStyle={{ paddingHorizontal: 160 }}
          initialScrollIndex={Math.max(0, selectedCm - 120)}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / RULER_ITEM);
            const cm = metricValues[Math.max(0, Math.min(metricValues.length - 1, index))] ?? selectedCm;
            onChangeCm(cm);
          }}
          renderItem={({ item }) => {
            const major = item % 10 === 0;
            return (
              <View style={{ width: RULER_ITEM, alignItems: "center", justifyContent: "flex-end", height: 72 }}>
                <View
                  style={{
                    width: 2,
                    height: major ? 36 : item % 5 === 0 ? 24 : 14,
                    backgroundColor: item === Math.round(selectedCm) ? colors.accent : colors.textMuted,
                    borderRadius: 1,
                  }}
                />
                {major ? (
                  <AppText variant="caption" color={colors.textSecondary}>
                    {item}
                  </AppText>
                ) : null}
              </View>
            );
          }}
        />
      </GlassSurface>
      <AppText variant="caption" color={colors.textSecondary} style={{ textAlign: "center" }}>
        Scroll the ruler · centimetres
      </AppText>
    </View>
  );
}

export function WeightDial({
  units,
  weightKg,
  onChangeKg,
}: {
  units: UnitSystem;
  weightKg: number | null;
  onChangeKg: (kg: number) => void;
}) {
  const { colors } = useTheme();
  const kg = weightKg ?? 70;
  const display = units === "imperial" ? kgToLb(kg) : kg;
  const unitLabel = units === "imperial" ? "lb" : "kg";
  const min = units === "imperial" ? 66 : 30;
  const max = units === "imperial" ? 440 : 200;
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radiusRing = 78;

  function nudge(delta: number) {
    const nextDisplay = Math.max(min, Math.min(max, Math.round(display + delta)));
    onChangeKg(units === "imperial" ? lbToKg(nextDisplay) : nextDisplay);
  }

  const ticks = Array.from({ length: 24 }, (_, i) => i);

  return (
    <View style={{ alignItems: "center", gap: space.md }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={radiusRing + 8} stroke={colors.glassBorder} strokeWidth={10} fill="none" />
        <Circle cx={cx} cy={cy} r={radiusRing} stroke={colors.accentMuted} strokeWidth={14} fill={colors.glassFill} />
        <G>
          {ticks.map((tick) => {
            const angle = (tick / 24) * Math.PI * 2 - Math.PI / 2;
            const inner = radiusRing - 6;
            const outer = radiusRing + 6;
            return (
              <Line
                key={tick}
                x1={cx + Math.cos(angle) * inner}
                y1={cy + Math.sin(angle) * inner}
                x2={cx + Math.cos(angle) * outer}
                y2={cy + Math.sin(angle) * outer}
                stroke={tick % 6 === 0 ? colors.accent : colors.textMuted}
                strokeWidth={tick % 6 === 0 ? 2.5 : 1}
              />
            );
          })}
        </G>
        <SvgText
          x={cx}
          y={cy - 4}
          fill={colors.text}
          fontSize="34"
          fontWeight="600"
          textAnchor="middle"
        >
          {Math.round(display)}
        </SvgText>
        <SvgText x={cx} y={cy + 22} fill={colors.textSecondary} fontSize="14" textAnchor="middle">
          {unitLabel}
        </SvgText>
      </Svg>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Pressable
          accessibilityLabel={`Decrease weight`}
          onPress={() => nudge(-1)}
          style={{
            minWidth: 72,
            minHeight: 48,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassFill,
          }}
        >
          <AppText variant="h2">−</AppText>
        </Pressable>
        <Pressable
          accessibilityLabel={`Increase weight`}
          onPress={() => nudge(1)}
          style={{
            minWidth: 72,
            minHeight: 48,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassFill,
          }}
        >
          <AppText variant="h2">+</AppText>
        </Pressable>
      </View>
      <AppText variant="caption" color={colors.textSecondary}>
        Dial adjust · not a connected scale reading
      </AppText>
    </View>
  );
}

export function WearablePrefCard({
  value,
  onChange,
}: {
  value: "apple_health" | "health_connect" | "none_yet" | "unsure" | null;
  onChange: (value: "apple_health" | "health_connect" | "none_yet" | "unsure") => void;
}) {
  const { colors } = useTheme();
  const options = [
    { value: "apple_health" as const, label: "Apple Health", detail: "Steps, sleep, and stress-related samples when HealthKit has them." },
    { value: "health_connect" as const, label: "Health Connect", detail: "Android store for steps, sleep, and compatible device writes." },
    { value: "none_yet" as const, label: "Not connecting yet", detail: "You can log manually. No mock metrics are shown as connected." },
    { value: "unsure" as const, label: "Not sure", detail: "Examples below are labels only — not live readings." },
  ];

  return (
    <View style={{ gap: space.md }}>
      <GlassSurface>
        <AppText variant="label">Example metrics (labels only)</AppText>
        <View style={{ height: space.sm }} />
        <AppText variant="small" color={colors.textSecondary}>
          Steps · Sleep · Stress — shown as examples of what a connected source can provide. These are not measurements from this device.
        </AppText>
        <View style={{ height: space.md }} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {["Steps", "Sleep", "Stress"].map((label) => (
            <View
              key={label}
              style={{
                flex: 1,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.glassBorder,
                backgroundColor: colors.glassFill,
                padding: space.sm,
                alignItems: "center",
                gap: 4,
              }}
            >
              <AppText variant="caption" color={colors.textMuted}>
                Example
              </AppText>
              <AppText variant="small" color={colors.textSecondary}>
                {label}
              </AppText>
              <AppText variant="caption" color={colors.accent}>
                Not connected
              </AppText>
            </View>
          ))}
        </View>
      </GlassSurface>
      <View style={{ gap: space.sm }}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.glassBorder,
                backgroundColor: selected ? colors.accentMuted : colors.glassFill,
                padding: space.lg,
                gap: 4,
              }}
            >
              <AppText variant="h3" color={selected ? colors.accent : colors.text}>
                {option.label}
              </AppText>
              <AppText variant="small" color={colors.textSecondary}>
                {option.detail}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
