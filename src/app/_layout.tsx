import { AISparkleIcon, GeoGebraIcon } from "@/constants/icons";
import "@/global.css";
import { AppStateProvider } from "@/lib/app-state";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

function KnowledgeTabIcon({ color }: { color: string }) {
    return (
        <View className="items-center justify-center">
            <Text className="text-xl">📚</Text>
        </View>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <AppStateProvider>
                <StatusBar style="dark" />
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: "#90c208",
                    tabBarInactiveTintColor: "rgba(34,34,34,0.5)",
                    tabBarStyle: {
                        backgroundColor: "#ffffff",
                        borderTopColor: "rgba(0,0,0,0.05)",
                    },
                    animation: "shift",
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: "GeoGebra",
                        tabBarIcon: ({ color }) => (
                            <GeoGebraIcon size={26} color={String(color)} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="ai-chat"
                    options={{
                        title: "AI对话",
                        tabBarIcon: ({ color }) => (
                            <AISparkleIcon size={26} color={String(color)} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="knowledge"
                    options={{
                        title: "知识库",
                        tabBarIcon: ({ color }) => (
                            <KnowledgeTabIcon color={String(color)} />
                        ),
                    }}
                />
            </Tabs>
            </AppStateProvider>
        </SafeAreaProvider>
    );
}
