import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MoreScreen() {
  return (
    <SafeAreaView className="flex-1 justify-center items-center bg-sk-surface-page">
      <Text className="text-sk-text-tertiary text-sk-lg">敬请期待...</Text>
    </SafeAreaView>
  );
}
