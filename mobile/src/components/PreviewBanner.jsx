import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreviewRole } from '../context/PreviewRoleContext';
import { previewRoleLabel } from '../lib/previewAccess';
import { useTheme } from '../theme/ThemeContext';

// Persistent strip shown whenever an admin is previewing the app as another
// role. It sits ABOVE the whole navigator (App.jsx) so it's reachable from any
// screen — important because previewing a non-admin role hides the Admin tile,
// so this banner is the ONLY guaranteed way back out. Tapping Exit clears the
// preview and the real admin view returns instantly.
export default function PreviewBanner() {
  const { previewRole, overlay, setPreviewRole } = usePreviewRole();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (!previewRole) return null;

  const label = previewRoleLabel(previewRole, overlay);
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6, backgroundColor: theme.warning || '#B45309' }]}>
      <Text style={styles.eye}>👁</Text>
      <Text style={styles.text} numberOfLines={1}>
        Previewing as <Text style={styles.role}>{label}</Text> · visual only
      </Text>
      <TouchableOpacity onPress={() => setPreviewRole(null)} style={styles.exitBtn} activeOpacity={0.7}>
        <Text style={styles.exitText}>Exit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 8,
  },
  eye:  { fontSize: 14 },
  text: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  role: { fontWeight: '800', textDecorationLine: 'underline' },
  exitBtn: {
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  exitText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
});
