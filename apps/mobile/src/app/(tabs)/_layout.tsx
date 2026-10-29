import { Tabs } from "expo-router";
import { BottomNavigation, FLOATING_TAB_CLEARANCE } from "@/components/tabs";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Floating glass tab bar is absolutely positioned; screens pad themselves.
        sceneStyle: { backgroundColor: "transparent", paddingBottom: FLOATING_TAB_CLEARANCE },
      }}
      tabBar={(props) => <BottomNavigation state={props.state} navigation={props.navigation} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="workout" options={{ title: "Workout" }} />
      <Tabs.Screen name="sleep" options={{ title: "Sleep" }} />
      <Tabs.Screen name="nutrition" options={{ title: "Nutrition" }} />
    </Tabs>
  );
}
