import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import SlotMachine from './src/SlotMachine';

const isWeb = Platform.OS === 'web';

export default function App() {
  const [fontsLoaded] = useFonts({
    'FormulaCondensed-Bold': require('./fonts/FormulaCondensed-Bold.otf'),
    'FormulaCondensed-Regular': require('./fonts/FormulaCondensed-Regular.otf'),
    'FormulaCondensed-Light': require('./fonts/FormulaCondensed-Light.otf'),
  });

  if (!fontsLoaded) return <View style={[styles.backdrop, { backgroundColor: '#022ab4' }]} />;

  return (
    <View style={styles.backdrop}>
      <View style={styles.phone}>
        <SlotMachine />
        <StatusBar style="light" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: isWeb ? '#000' : undefined,
    alignItems: isWeb ? 'center' : undefined,
  },
  phone: {
    flex: 1,
    width: isWeb ? '100%' : undefined,
    maxWidth: isWeb ? 390 : undefined,
    overflow: isWeb ? 'hidden' : undefined,
  },
});
