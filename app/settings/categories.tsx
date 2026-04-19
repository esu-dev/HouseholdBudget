import { Stack, useRouter } from 'expo-router';
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronLeft, ChevronUp, CircleEllipsis, Edit2, Plus, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function CategoryManagementScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';

    const {
        majorCategories,
        addMajorCategory, updateMajorCategory, deleteMajorCategory,
        addMinorCategory, updateMinorCategory, deleteMinorCategory,
        reorderMajorCategories, reorderMinorCategories
    } = useTransactionStore();

    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [editingMajor, setEditingMajor] = useState<any>(null);
    const [selectedIcon, setSelectedIcon] = useState('others');
    const [modalVisible, setModalVisible] = useState(false);
    const [minorModalVisible, setMinorModalVisible] = useState(false);
    const [editingMinor, setEditingMinor] = useState<any>(null);
    const [currentParentId, setCurrentParentId] = useState<string | null>(null);
    const [newItemLabel, setNewItemLabel] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        inputBg: isDark ? '#334155' : '#f1f5f9',
    };

    const filteredMajors = majorCategories.filter(m => m.type === type);

    const handleAddMajor = async () => {
        if (!newItemLabel.trim() || isLoading) return;
        setIsLoading(true);
        try {
            const id = `custom_${Date.now()}`;
            await addMajorCategory({
                id,
                label: newItemLabel.trim(),
                icon: selectedIcon,
                color: '#6366f1',
                type,
                displayOrder: filteredMajors.length
            });
            setModalVisible(false);
            setNewItemLabel('');
            setSelectedIcon('others');
        } catch (e) {
            Alert.alert('エラー', '保存に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateMajor = async () => {
        if (!editingMajor || !newItemLabel.trim() || isLoading) return;
        setIsLoading(true);
        try {
            await updateMajorCategory({
                ...editingMajor,
                label: newItemLabel.trim(),
                icon: selectedIcon,
            });
            setModalVisible(false);
            setEditingMajor(null);
            setNewItemLabel('');
            setSelectedIcon('others');
        } catch (e) {
            Alert.alert('エラー', '保存に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMinorSubmit = async () => {
        if (!newItemLabel.trim() || isLoading) return;
        setIsLoading(true);
        try {
            if (editingMinor) {
                await updateMinorCategory({ ...editingMinor, label: newItemLabel.trim() });
            } else if (currentParentId) {
                await addMinorCategory({
                    id: `minor_${Date.now()}`,
                    parent_id: currentParentId,
                    label: newItemLabel.trim(),
                    displayOrder: majorCategories.find(m => m.id === currentParentId)?.subCategories.length || 0
                });
            }
            setMinorModalVisible(false);
            setEditingMinor(null);
            setNewItemLabel('');
        } catch (e) {
            Alert.alert('エラー', '操作に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteMajor = (id: string) => {
        Alert.alert('確認', 'この大カテゴリを削除しますか？配下の小カテゴリもすべて削除されます。', [
            { text: 'キャンセル', style: 'cancel' },
            { text: '削除', style: 'destructive', onPress: () => deleteMajorCategory(id) }
        ]);
    };

    const handleDeleteMinor = (id: string) => {
        Alert.alert('確認', 'この小カテゴリを削除しますか？', [
            { text: 'キャンセル', style: 'cancel' },
            { text: '削除', style: 'destructive', onPress: () => deleteMinorCategory(id) }
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 60, backgroundColor: colors.card }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, flex: 1, textAlign: 'center', marginRight: 24 }}>カテゴリ設定</Text>
            </View>

            {/* Type Toggle */}
            <View style={{ flexDirection: 'row', padding: 16, gap: 12 }}>
                <TouchableOpacity
                    onPress={() => setType('expense')}
                    style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: type === 'expense' ? '#ef4444' : colors.card, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                >
                    <ArrowDownCircle size={16} color={type === 'expense' ? 'white' : '#ef4444'} />
                    <Text style={{ marginLeft: 8, fontWeight: 'bold', color: type === 'expense' ? 'white' : '#ef4444' }}>支出</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setType('income')}
                    style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: type === 'income' ? '#22c55e' : colors.card, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                >
                    <ArrowUpCircle size={16} color={type === 'income' ? 'white' : '#22c55e'} />
                    <Text style={{ marginLeft: 8, fontWeight: 'bold', color: type === 'income' ? 'white' : '#22c55e' }}>収入</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: 16 }}>
                {filteredMajors.map((major, index) => {
                    const IconComp = CATEGORY_ICONS[major.icon] || CircleEllipsis;
                    return (
                        <View key={major.id} style={{ backgroundColor: colors.card, borderRadius: 20, marginBottom: 16, overflow: 'hidden' }}>
                            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: major.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                                    <IconComp size={20} color={major.color} />
                                </View>
                                <Text style={{ flex: 1, marginLeft: 12, fontSize: 16, fontWeight: 'bold', color: colors.text }}>{major.label}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {index > 0 && (
                                        <TouchableOpacity onPress={() => reorderMajorCategories(type, index, index - 1)} style={{ padding: 8 }}>
                                            <ChevronUp size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                    {index < filteredMajors.length - 1 && (
                                        <TouchableOpacity onPress={() => reorderMajorCategories(type, index, index + 1)} style={{ padding: 8 }}>
                                            <ChevronDown size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        onPress={() => {
                                            setEditingMajor(major);
                                            setNewItemLabel(major.label);
                                            setSelectedIcon(major.icon || 'others');
                                            setModalVisible(true);
                                        }}
                                        style={{ padding: 8 }}
                                    >
                                        <Edit2 size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteMajor(major.id)} style={{ padding: 8 }}>
                                        <Trash2 size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={{ padding: 12, backgroundColor: isDark ? '#0f172a44' : '#f8fafc' }}>
                                {major.subCategories.map((minor, mIndex) => (
                                    <View key={minor.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 }}>
                                        <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{minor.label}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            {mIndex > 0 && (
                                                <TouchableOpacity onPress={() => reorderMinorCategories(major.id, mIndex, mIndex - 1)} style={{ padding: 6 }}>
                                                    <ChevronUp size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                            {mIndex < major.subCategories.length - 1 && (
                                                <TouchableOpacity onPress={() => reorderMinorCategories(major.id, mIndex, mIndex + 1)} style={{ padding: 6 }}>
                                                    <ChevronDown size={16} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setEditingMinor(minor);
                                                    setNewItemLabel(minor.label);
                                                    setMinorModalVisible(true);
                                                }}
                                                style={{ padding: 6 }}
                                            >
                                                <Edit2 size={14} color={colors.textMuted} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDeleteMinor(minor.id)} style={{ padding: 6 }}>
                                                <Trash2 size={14} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    onPress={() => {
                                        setCurrentParentId(major.id);
                                        setEditingMinor(null);
                                        setNewItemLabel('');
                                        setMinorModalVisible(true);
                                    }}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 8, borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Plus size={14} color={colors.indigo} />
                                    <Text style={{ marginLeft: 8, fontSize: 12, color: colors.indigo, fontWeight: 'bold' }}>小カテゴリを追加</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}

                <TouchableOpacity
                    onPress={() => {
                        setEditingMajor(null);
                        setNewItemLabel('');
                        setSelectedIcon('others');
                        setModalVisible(true);
                    }}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: colors.indigo,
                        borderStyle: 'dashed',
                        marginTop: 8,
                        marginBottom: 40
                    }}
                >
                    <Plus size={20} color={colors.indigo} />
                    <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: colors.indigo }}>各大カテゴリを追加</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Major Category Edit Modal */}
            <Modal
                transparent
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => { if (!isLoading) setModalVisible(false); }}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>
                            {editingMajor ? '大カテゴリの編集' : '大カテゴリの追加'}
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: colors.inputBg,
                                padding: 16,
                                borderRadius: 12,
                                fontSize: 16,
                                color: colors.text,
                                marginBottom: 20
                            }}
                            placeholder="カテゴリ名"
                            value={newItemLabel}
                            onChangeText={setNewItemLabel}
                            autoFocus
                            editable={!isLoading}
                        />
                        <Text style={{ color: colors.textMuted, marginBottom: 12, fontSize: 13 }}>アイコン</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                            {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => {
                                const isSelected = selectedIcon === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => setSelectedIcon(key)}
                                        style={{
                                            width: 44, height: 44, borderRadius: 12,
                                            backgroundColor: isSelected ? colors.indigo : colors.inputBg,
                                            alignItems: 'center', justifyContent: 'center',
                                            marginRight: 10,
                                            borderWidth: 2, borderColor: isSelected ? colors.indigo : 'transparent'
                                        }}
                                    >
                                        <Icon size={22} color={isSelected ? 'white' : colors.textMuted} />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    setModalVisible(false);
                                    setEditingMajor(null);
                                    setNewItemLabel('');
                                    setSelectedIcon('others');
                                }}
                                disabled={isLoading}
                                style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: isDark ? '#334155' : '#f1f5f9', alignItems: 'center', opacity: isLoading ? 0.5 : 1 }}
                            >
                                <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>キャンセル</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={editingMajor ? handleUpdateMajor : handleAddMajor}
                                disabled={isLoading}
                                style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.indigo, alignItems: 'center', opacity: isLoading ? 0.5 : 1 }}
                            >
                                <Text style={{ fontWeight: 'bold', color: 'white' }}>{isLoading ? '処理中...' : (editingMajor ? '保存' : '追加')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Minor Category Edit Modal (For better Android support) */}
            <Modal
                transparent
                visible={minorModalVisible}
                animationType="fade"
                onRequestClose={() => { if (!isLoading) setMinorModalVisible(false); }}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>
                            {editingMinor ? '小カテゴリの編集' : '小カテゴリの追加'}
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: colors.inputBg,
                                padding: 16,
                                borderRadius: 12,
                                fontSize: 16,
                                color: colors.text,
                                marginBottom: 20
                            }}
                            placeholder="カテゴリ名"
                            value={newItemLabel}
                            onChangeText={setNewItemLabel}
                            autoFocus
                            editable={!isLoading}
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setMinorModalVisible(false)}
                                disabled={isLoading}
                                style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: isDark ? '#334155' : '#f1f5f9', alignItems: 'center', opacity: isLoading ? 0.5 : 1 }}
                            >
                                <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>キャンセル</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleMinorSubmit}
                                disabled={isLoading}
                                style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.indigo, alignItems: 'center', opacity: isLoading ? 0.5 : 1 }}
                            >
                                <Text style={{ fontWeight: 'bold', color: 'white' }}>{isLoading ? '処理中...' : (editingMinor ? '保存' : '追加')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
