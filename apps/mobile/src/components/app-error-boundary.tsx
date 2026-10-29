import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";
import { AppText, Button, Screen } from "@/components/ui";
import { space } from "@/design/tokens";

type Props = { children: ReactNode; onReset?: () => void };
type State = { error: Error | null };

/**
 * Catches render failures so a single screen bug does not leave a blank root.
 * Does not claim the underlying data was lost — SQLite writes already committed stay on device.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error("AppErrorBoundary", error, info.componentStack);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Screen>
        <AppText variant="h1">Something went wrong</AppText>
        <View style={{ height: space.sm }} />
        <AppText variant="small">
          VitaCore hit an unexpected error on this screen. Data already saved on this device is not deleted by this message.
        </AppText>
        <View style={{ height: space.md }} />
        <AppText variant="caption">{this.state.error.message}</AppText>
        <View style={{ height: space.lg }} />
        <Button
          label="Try again"
          onPress={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
        />
      </Screen>
    );
  }
}

/** Expo Router root error boundary export shape. */
export function RouteErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <Screen>
      <AppText variant="h1">Something went wrong</AppText>
      <View style={{ height: space.sm }} />
      <AppText variant="small">
        VitaCore hit an unexpected error. Data already saved on this device is not deleted by this message.
      </AppText>
      <View style={{ height: space.md }} />
      <AppText variant="caption">{error.message}</AppText>
      <View style={{ height: space.lg }} />
      <Button label="Try again" onPress={retry} />
    </Screen>
  );
}
