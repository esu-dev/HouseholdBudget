import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Trash2, Tag, Wallet, Edit2, Check } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert, Modal } from 'react-native';
import { databaseService } from '../../services/database';
import { useTransactionStore } from '../../store/useTransactionStore';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';

export default function CsvMappingListScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const { accounts, majorCategories } = useTransactionStore();
    
    const [isLoading, setIsLoading] = useState(true);
    const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
    const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
    
    // Modal state
    const [editingItem, setEditingItem] = useState<{ type: 'category' | 'account', externalName: string, internalId: string } | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const isDark = colorScheme === 'dark';
    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        danger: '#ef4444',
        inputBg: isDark ? '#334155' : '#f1f5f9',
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const cats = await databaseService.getCsvCategoryMappings();
        const accs = await databaseService.getCsvAccountMappings();
        setCategoryMappings(cats);
        setAccountMappings(accs);
        setIsLoading(false);
    };

    const handleDelete = (type: 'category' | 'account', externalName: string) => {
        Alert.alert(
            '削除の確認',
            `「${externalName}」の対応関係を削除しますか？`,
            [
                { text: 'キャンセル', style: 'cancel' },
                { 
                    text: '削除', 
                    style: 'destructive', 
                    onPress: async () => {
                        if (type === 'category') {
                            await databaseService.deleteCsvCategoryMapping(externalName);
                        } else {
                            await databaseService.deleteCsvAccountMapping(externalName);
                        }
                        loadData();
                    } 
                }
            ]
        );
    };

    const handleEdit = (type: 'category' | 'account', externalName: string, internalId: string) => {
        setEditingItem({ type, externalName, internalId });
        setModalVisible(true);
    };

    const saveMapping = async (newInternalId: string) => {
        if (!editingItem) return;

        if (editingItem.type === 'category') {
            await databaseService.updateCsvCategoryMapping(editingItem.externalName, newInternalId);
        } else {
            await databaseService.updateCsvAccountMapping(editingItem.externalName, newInternalId);
        }
        
        setModalVisible(false);
        setEditingItem(null);
        loadData();
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 60, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ChevronLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.text, marginRight: 28 }}>
                    インポート対応表
                </Text>
            </View>

            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={colors.indigo} size="large" />
                </View>
            ) : (
                <ScrollView style={{ flex: 1, padding: 20 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 16, textTransform: 'uppercase' }}>カテゴリ対応</Text>
                    {Object.keys(categoryMappings).length === 0 ? (
                        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 32 }}>設定されていません</Text>
                    ) : (
                        <View style={{ backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', marginBottom: 32 }}>
                            {Object.entries(categoryMappings).map(([ext, int], index) => {
                                const internalLabel = majorCategories.flatMap(m => m.subCategories).find(s => s.id === int)?.label || int;
                                return (
                                    <View key={ext} style={{ padding: 16, borderBottomWidth: index === Object.keys(categoryMappings).length - 1 ? 0 : 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 12, color: colors.textMuted }}>CSV項目: {ext}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Tag size={14} color={colors.indigo} />
                                                <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text, marginLeft: 6 }}>{internalLabel}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            <TouchableOpacity onPress={() => handleEdit('category', ext, int)}>
                                                <Edit2 size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete('category', ext)}>
                                                <Trash2 size={20} color={colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 16, textTransform: 'uppercase' }}>口座対応</Text>
                    {Object.keys(accountMappings).length === 0 ? (
                        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 32 }}>設定されていません</Text>
                    ) : (
                        <View style={{ backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', marginBottom: 40 }}>
                            {Object.entries(accountMappings).map(([ext, int], index) => {
                                const internalLabel = accounts.find(a => a.id === int)?.name || int;
                                return (
                                    <View key={ext} style={{ padding: 16, borderBottomWidth: index === Object.keys(accountMappings).length - 1 ? 0 : 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 12, color: colors.textMuted }}>CSV項目: {ext}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Wallet size={14} color={colors.indigo} />
                                                <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text, marginLeft: 6 }}>{internalLabel}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            <TouchableOpacity onPress={() => handleEdit('account', ext, int)}>
                                                <Edit2 size={20} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete('account', ext)}>
                                                <Trash2 size={20} color={colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Edit Mapping Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '70%', padding: 24 }}>
                        <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
                        
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>対応関係の編集</Text>
                        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24 }}>
                            CSV項目「{editingItem?.externalName}」の紐付け先を選択してください。
                        </Text>

                        <ScrollView style={{ flex: 1 }}>
                            {editingItem?.type === 'category' ? (
                                <View style={{ gap: 8 }}>
                                    {majorCategories.flatMap(major => major.subCategories).map(minor => {
                                        const isSelected = editingItem.internalId === minor.id;
                                        return (
                                            <TouchableOpacity 
                                                key={minor.id}
                                                onPress={() => saveMapping(minor.id)}
                                                style={{ 
                                                    flexDirection: 'row', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between',
                                                    padding: 16, 
                                                    borderRadius: 16, 
                                                    backgroundColor: isSelected ? colors.indigo : colors.card,
                                                    borderWidth: 1,
                                                    borderColor: isSelected ? colors.indigo : colors.border
                                                }}
                                            >
                                                <Text style={{ fontWeight: 'bold', color: isSelected ? 'white' : colors.text }}>{minor.label}</Text>
                                                {isSelected && <Check size={20} color="white" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View style={{ gap: 8 }}>
                                    {accounts.map(acc => {
                                        const isSelected = editingItem?.internalId === acc.id;
                                        return (
                                            <TouchableOpacity 
                                                key={acc.id}
                                                onPress={() => saveMapping(acc.id)}
                                                style={{ 
                                                    flexDirection: 'row', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between',
                                                    padding: 16, 
                                                    borderRadius: 16, 
                                                    backgroundColor: isSelected ? colors.indigo : colors.card,
                                                    borderWidth: 1,
                                                    borderColor: isSelected ? colors.indigo : colors.border
                                                }}
                                            >
                                                <Text style={{ fontWeight: 'bold', color: isSelected ? 'white' : colors.text }}>{acc.name}</Text>
                                                {isSelected && <Check size={20} color="white" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity 
                            onPress={() => setModalVisible(false)}
                            style={{ marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: colors.inputBg, alignItems: 'center' }}
                        >
                            <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>キャンセル</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
