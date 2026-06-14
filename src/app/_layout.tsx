import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { AppStateProvider } from '@/lib/app-state';
import '@/global.css';

function TabIcon({ emoji }: { label: string; emoji: string }) {
  return (
    <View className="justify-center items-center">
      <Text className="text-xl">{emoji}</Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#90c208',
          tabBarInactiveTintColor: 'rgba(34,34,34,0.5)',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: 'rgba(0,0,0,0.05)',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '绘图',
            tabBarIcon: () => <TabIcon label="绘图" emoji="📐" />,
          }}
        />
        <Tabs.Screen
          name="ai-chat"
          options={{
            title: 'AI对话',
            tabBarIcon: () => <TabIcon label="AI对话" emoji="🤖" />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: '更多',
            tabBarIcon: () => <TabIcon label="更多" emoji="📦" />,
          }}
        />
      </Tabs>
    </AppStateProvider>
  );
}
