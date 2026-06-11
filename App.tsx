import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import SlotMachine from './src/SlotMachine';

export default function App() {
  const [fontsLoaded] = useFonts({
    'FormulaCondensed-Bold': require('./fonts/FormulaCondensed-Bold.otf'),
    'FormulaCondensed-Regular': require('./fonts/FormulaCondensed-Regular.otf'),
    'FormulaCondensed-Light': require('./fonts/FormulaCondensed-Light.otf'),
  });

  // Hold on the sky colour until the fonts are ready (avoids a fallback-font flash).
  if (!fontsLoaded) return <View style={[styles.container, { backgroundColor: '#022ab4' }]} />;

  return (
    <View style={styles.container}>
      <SlotMachine />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
