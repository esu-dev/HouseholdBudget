import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Save, Search, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { databaseService } from '../../services/database';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function PayeeMappingsScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { majorCategories, fetchData } = useTransactionStore();

    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
    const [selectedPayee, setSelectedPayee] = useState<string | null>(null);

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        danger: '#ef4444',
        inputBg: isDark ? '#273549' : '#f1f5f9',
    };

    useEffect(() => {
        loadMappings();
        if (majorCategories.length === 0) {
            fetchData();
        }
    }, []);

    const loadMappings = async () => {
        const data = await databaseService.getAllPayeeCategoryMappings();
        setMappings(data);
    };

    const handleDelete = (payee: string) => {
        Alert.alert(
            '解除',
            `「${payee}」のカテゴリ対応関係を削除しますか？`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '削除',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await databaseService.deletePayeeCategoryMapping(payee);
                            await loadMappings();
                        } catch (e) {
                            Alert.alert('エラー', '削除に失敗しました');
                        }
                    }
                }
            ]
        );
    };

    const handleUpdateMapping = async (minorId: string) => {
        if (!selectedPayee) return;
        try {
            await databaseService.upsertPayeeCategoryMapping(selectedPayee, minorId);
            setIsCategoryModalVisible(false);
            setSelectedPayee(null);
            await loadMappings();
        } catch (e) {
            Alert.alert('エラー', '更新に失敗しました');
        }
    };

    const filteredMappings = useMemo(() => {
        return Object.entries(mappings).filter(([payee]) =>
            payee.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => a[0].localeCompare(b[0]));
    }, [mappings, searchQuery]);

    const getCategoryInfo = (minorId: string) => {
        for (const major of majorCategories) {
            const minor = major.subCategories.find(m => m.id === minorId);
            if (minor) {
                return { major, minor };
            }
        }
        return null;
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{
                paddingTop: 60,
                paddingHorizontal: 20,
                paddingBottom: 20,
                backgroundColor: colors.card,
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: colors.border
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                    <ChevronLeft size={24} color={colors.indigo} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>支払先ごとのカテゴリ設定</Text>
            </View>

            <View style={{ flex: 1 }}>
                <View style={{ padding: 20 }}>
                    <View style={{
                        backgroundColor: colors.indigo + '10',
                        padding: 16,
                        borderRadius: 16,
                        marginBottom: 12,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}>
                        <Save size={20} color={colors.indigo} />
                        <Text style={{
                            marginLeft: 12,
                            fontSize: 11,
                            color: isDark ? '#a5b4fc' : '#4338ca',
                            flex: 1,
                            lineHeight: 20
                        }}>
                            入力時に学習された「支払先」と「カテゴリ」の対応一覧です。ここでの変更は次回の入力から反映されます。
                        </Text>
                    </View>

                    {/* Search Bar */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        marginBottom: 14
                    }}>
                        <Search size={16} color={colors.textMuted} />
                        <TextInput
                            style={{ flex: 1, marginLeft: 12, color: colors.text, fontSize: 14 }}
                            placeholder="支払先を検索..."
                            placeholderTextColor={colors.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={{
                        fontSize: 13,
                        fontWeight: 'bold',
                        color: colors.textMuted,
                        marginBottom: 0,
                        marginLeft: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 1
                    }}>学習済みデータ ({filteredMappings.length})</Text>
                </View>

                <FlatList
                    data={filteredMappings}
                    keyExtractor={([payee]) => payee}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                    renderItem={({ item: [payee, minorId] }) => {
                        const info = getCategoryInfo(minorId);
                        const Icon = info ? (CATEGORY_ICONS[info.major.icon] || Search) : Search;

                        return (
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedPayee(payee);
                                    setIsCategoryModalVisible(true);
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: colors.card,
                                    padding: 16,
                                    borderRadius: 20,
                                    marginBottom: 12,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 2,
                                    elevation: 1
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{payee}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                        <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: info?.major.color || colors.textMuted, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
                                            <Icon size={10} color="white" />
                                        </View>
                                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                                            {info ? `${info.major.label} > ${info.minor.label}` : '未分類'}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={() => handleDelete(payee)}
                                    style={{ padding: 10 }}
                                >
                                    <Trash2 size={20} color={colors.danger} />
                                </TouchableOpacity>
                                <ChevronRight size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={{
                            padding: 40,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.card,
                            borderRadius: 20,
                            borderStyle: 'dashed',
                            borderWidth: 1,
                            borderColor: colors.border
                        }}>
                            <Text style={{ color: colors.textMuted }}>対応データが見つかりません</Text>
                        </View>
                    }
                />
            </View>

            {/* Category Selection Modal */}
            <Modal
                visible={isCategoryModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsCategoryModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{
                        backgroundColor: colors.card,
                        borderTopLeftRadius: 32,
                        borderTopRightRadius: 32,
                        height: '80%',
                        paddingTop: 20
                    }}>
                        <View style={{ paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>カテゴリを選択</Text>
                                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>「{selectedPayee}」に対応付けるカテゴリ</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsCategoryModalVisible(false)} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                            {majorCategories.map((major) => {
                                const IconComp = CATEGORY_ICONS[major.icon] || Search;
                                return (
                                    <View key={major.id} style={{ marginBottom: 24 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 4 }}>
                                            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: major.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                                <IconComp size={16} color={major.color} />
                                            </View>
                                            <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text }}>{major.label}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                            {major.subCategories.map((minor) => (
                                                <TouchableOpacity
                                                    key={minor.id}
                                                    onPress={() => handleUpdateMapping(minor.id)}
                                                    style={{
                                                        paddingHorizontal: 16,
                                                        paddingVertical: 10,
                                                        borderRadius: 12,
                                                        backgroundColor: isDark ? '#2d3748' : '#f1f5f9',
                                                        borderWidth: 1,
                                                        borderColor: colors.border
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 13, color: colors.text }}>{minor.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
