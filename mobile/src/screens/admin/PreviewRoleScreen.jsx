import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../../components/Icon';
import useTenantAccess from '../../hooks/useTenantAccess';
import { usePreviewRole } from '../../context/PreviewRoleContext';
import { PREVIEWABLE_BUILTIN_ROLES, previewRoleLabel } from '../../lib/previewAccess';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, resolveRoleCaps } from '../../lib/rbac';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';

// Admin tool: pick a role to PREVIEW the app as. Selecting one sets the preview
// (see PreviewRoleContext) and jumps to the Manage grid so the change is
// immediately visible. The persistent PreviewBanner is the way back out.
// Guarded on the REAL admin status so an in-preview admin (isAdmin flips false)
// can still reach it if they navigate here directly.
export default function PreviewRoleScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { realIsAdmin, loading } = useTenantAccess();
  const { previewRole, setPreviewRole, overlay } = usePreviewRole();

  if (!loading && !realIsAdmin) {
    return <View style={styles.center}><Text style={styles.denied}>Admins only.</Text></View>;
  }

  const customRoles = Array.isArray(overlay?.roles) ? overlay.roles.filter(r => r && r.key) : [];

  function preview(role) {
    setPreviewRole(role);
    navigation.popToTop(); // land on the Manage grid so the change is visible
  }
  function clear() {
    setPreviewRole(null);
    navigation.popToTop();
  }

  function Row({ role, label, desc }) {
    const active = previewRole === role;
    const caps = resolveRoleCaps(role, overlay);
    return (
      <TouchableOpacity style={[styles.row, active && styles.rowActive]} activeOpacity={0.7} onPress={() => preview(role)}>
        <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
          <Icon name="people" size={20} color={active ? '#fff' : theme.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{label}</Text>
          {!!desc && <Text style={styles.desc} numberOfLines={2}>{desc}</Text>}
          <Text style={styles.caps}>{role === 'owner' ? 'Full access' : `${caps.length} capabilities`}</Text>
        </View>
        {active ? <Text style={styles.check}>✓</Text> : <Text style={styles.chev}>›</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 14 }}>
      <Text style={styles.intro}>
        See exactly what each role sees on this app. This is a <Text style={{ fontWeight: '800' }}>visual preview only</Text> —
        the server still treats you as an admin, so no data changes and nothing is restricted server-side.
      </Text>

      <TouchableOpacity style={[styles.row, styles.selfRow]} activeOpacity={0.7} onPress={clear}>
        <View style={[styles.iconWrap, !previewRole && styles.iconWrapActive]}>
          <Icon name="check" size={20} color={!previewRole ? '#fff' : theme.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Yourself (admin)</Text>
          <Text style={styles.desc}>Your normal, full-access view</Text>
        </View>
        {!previewRole && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>

      <Text style={styles.section}>Built-in roles</Text>
      {PREVIEWABLE_BUILTIN_ROLES.map(role => (
        <Row key={role} role={role} label={ROLE_LABELS[role] || role} desc={ROLE_DESCRIPTIONS[role]} />
      ))}

      {customRoles.length > 0 && (
        <>
          <Text style={styles.section}>Custom roles</Text>
          {customRoles.map(r => (
            <Row key={r.key} role={r.key} label={previewRoleLabel(r.key, overlay)} desc={r.description || ''} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  wrap:   { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
  denied: { color: t.textFaint, fontSize: 14 },
  intro:  { fontSize: 13, color: t.textMuted, lineHeight: 18, marginBottom: 14, paddingHorizontal: 2 },
  section:{ fontSize: 12, fontWeight: '800', color: t.textFaint, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 8, paddingHorizontal: 2 },
  row:    { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.border },
  rowActive: { borderColor: t.green, backgroundColor: t.greenSoft },
  selfRow: { borderColor: t.blueSoft },
  iconWrap: { width: 42, height: 42, borderRadius: 11, backgroundColor: t.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconWrapActive: { backgroundColor: t.green },
  label:  { fontSize: 15, fontWeight: '700', color: t.text },
  desc:   { fontSize: 12, color: t.textMuted, marginTop: 2, lineHeight: 16 },
  caps:   { fontSize: 11, color: t.textFaint, marginTop: 3, fontWeight: '600' },
  chev:   { fontSize: 22, color: t.textFaint, marginLeft: 6 },
  check:  { fontSize: 20, color: t.green, fontWeight: '800', marginLeft: 6 },
});
