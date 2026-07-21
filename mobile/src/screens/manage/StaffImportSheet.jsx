import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Alert, Modal, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { importStaffFromScreenshots, createEmployee } from '../../lib/firestore';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Screenshot → staff import (mobile). Pick screenshots of the old system's staff
// list; Claude vision (server-side) extracts the people; the admin reviews/edits
// then creates the ones they keep. Nothing is created until confirmed; rows that
// match an existing staff name are flagged + off by default so we don't dupe.
export default function StaffImportSheet({ visible, existingNames = [], nextSortOrder = 0, onClose, onCreated }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const existing = new Set(existingNames.map(norm));
  const [step, setStep] = useState('pick');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  function reset() { setStep('pick'); setRows([]); setBusy(false); }
  function close() { reset(); onClose?.(); }

  async function pickAndExtract() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photos access needed', 'Allow photo access to pick your staff screenshots.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 8, quality: 0.9,
    });
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      const images = [];
      for (const a of res.assets.slice(0, 8)) {
        const m = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: 1600 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        images.push({ imageData: m.base64, mediaType: 'image/jpeg' });
      }
      const { staff } = await importStaffFromScreenshots(images);
      const mapped = (staff || []).map(s => {
        const dupe = existing.has(norm(s.name));
        return { ...s, dupe, include: !dupe };
      });
      if (!mapped.length) { Alert.alert('Import', "Couldn't read any staff — try clearer or closer screenshots."); setBusy(false); return; }
      setRows(mapped); setStep('review');
    } catch (e) {
      Alert.alert('Import failed', e?.message?.replace(/^.*?:\s*/, '') || 'Try again.');
    } finally { setBusy(false); }
  }

  function setField(i, k, v) { setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r)); }

  async function create() {
    const keep = rows.filter(r => r.include && r.name.trim());
    if (!keep.length) { Alert.alert('Import', 'Turn on at least one person to import.'); return; }
    setStep('creating'); setBusy(true);
    let made = 0;
    try {
      for (let i = 0; i < keep.length; i++) {
        const r = keep[i];
        await createEmployee({
          name: r.name.trim(), email: r.email.trim(), phone: r.phone.trim(), instagram: r.instagram.trim(),
          notes: r.role.trim() ? `Role: ${r.role.trim()}` : '', active: true, serviceIds: [], sortOrder: nextSortOrder + i,
        });
        made++;
      }
      onCreated?.(made);
      reset();
    } catch (e) {
      Alert.alert('Import', `Added ${made} before an error: ${e?.message || 'try again'}`);
      setStep('review'); setBusy(false);
    }
  }

  const keepCount = rows.filter(r => r.include && r.name.trim()).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={busy ? undefined : close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Import staff from screenshots</Text>
            <TouchableOpacity onPress={close} disabled={busy}><Text style={styles.close}>×</Text></TouchableOpacity>
          </View>

          {step === 'pick' && (
            <View>
              <Text style={styles.body}>
                GlossGenius has no staff export — pick screenshots of your staff / team list and we'll read the
                people off them. You'll review everything before anything is created.
              </Text>
              <TouchableOpacity style={[styles.primary, busy && { opacity: 0.6 }]} onPress={pickAndExtract} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>📷 Choose screenshots</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 'review' && (
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>Found {rows.length}. Edit anything off, turn off who you don't want. "Already exists" rows are off by default.</Text>
              <ScrollView style={{ maxHeight: 420 }}>
                {rows.map((r, i) => (
                  <View key={i} style={[styles.card, !r.include && { opacity: 0.5 }]}>
                    <View style={styles.cardTop}>
                      <TextInput value={r.name} onChangeText={v => setField(i, 'name', v)} placeholder="Name" placeholderTextColor={theme.textFaint} style={[styles.input, { flex: 1, fontWeight: '700' }]} />
                      <Switch value={r.include} onValueChange={v => setField(i, 'include', v)} trackColor={{ true: theme.green }} />
                    </View>
                    {r.dupe && <Text style={styles.dupe}>already exists</Text>}
                    <TextInput value={r.role} onChangeText={v => setField(i, 'role', v)} placeholder="Role" placeholderTextColor={theme.textFaint} style={styles.input} />
                    <TextInput value={r.email} onChangeText={v => setField(i, 'email', v)} placeholder="Email" placeholderTextColor={theme.textFaint} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
                    <TextInput value={r.phone} onChangeText={v => setField(i, 'phone', v)} placeholder="Phone" placeholderTextColor={theme.textFaint} keyboardType="phone-pad" style={styles.input} />
                    <TextInput value={r.instagram} onChangeText={v => setField(i, 'instagram', v)} placeholder="Instagram" placeholderTextColor={theme.textFaint} autoCapitalize="none" style={styles.input} />
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={[styles.primary, (!keepCount || busy) && { opacity: 0.5 }]} onPress={create} disabled={!keepCount || busy}>
                <Text style={styles.primaryText}>Import {keepCount} staff member{keepCount === 1 ? '' : 's'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'creating' && <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={theme.green} /><Text style={[styles.body, { marginTop: 12 }]}>Creating staff…</Text></View>}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: t.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '700', color: t.text },
  close: { fontSize: 26, color: t.textMuted, paddingHorizontal: 6 },
  body: { fontSize: 14, color: t.textMuted, lineHeight: 20, marginBottom: 14 },
  primary: { backgroundColor: t.green, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: t.bg, borderRadius: 12, borderWidth: 1, borderColor: t.border, padding: 10, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: t.text, marginTop: 6 },
  dupe: { fontSize: 11, color: t.danger, marginTop: 4 },
});
