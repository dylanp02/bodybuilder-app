import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from './lib/supabase';

export default function HomeScreen() {
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setStatus('Supabase error: ' + error.message);
      else setStatus('Supabase connected ✓');
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18 },
});