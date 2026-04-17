import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Plus, Trash2, ZapOff } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function IgnoredPayeesScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { getIgnoredPayees, addIgnoredPayee, removeIgnoredPayee } = useTransactionStore();
    
    const [ignoredPayees, setIgnoredPayees] = useState<string[]>([]);
    const [newPayee, setNewPayee] = useState('');

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        danger: '#ef4444',
    };

    useEffect(() => {
        loadIgnoredPayees();
    }, []);

    const loadIgnoredPayees = async () => {
        const payees = await getIgnoredPayees();
        setIgnoredPayees(payees);
    };

    const handleAdd = async () => {
        if (!newPayee.trim()) return;
        
        try {
            await addIgnoredPayee(newPayee.trim());
            setNewPayee('');
            await loadIgnoredPayees();
        } catch (e) {
            Alert.alert('エラー', '追加に失敗しました');
        }
    };

    const handleDelete = (payee: string) => {
        Alert.alert(
            '除外解除',
            `「${payee}」を自動学習の除外リストから削除しますか？`,
            [
                { text: 'キャンセル', style: 'cancel' },
                { 
                    text: '削除', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeIgnoredPayee(payee);
                            await loadIgnoredPayees();
                        } catch (e) {
                            Alert.alert('エラー', '削除に失敗しました');
                        }
                    }
                }
            ]
        );
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
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>自動学習の除外設定</Text>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                <View style={{ 
                    backgroundColor: colors.indigo + '10', 
                    padding: 16, 
                    borderRadius: 16, 
                    marginBottom: 24,
                    flexDirection: 'row',
                    alignItems: 'center'
                }}>
                    <ZapOff size={20} color={colors.indigo} />
                    <Text style={{ 
                        marginLeft: 12, 
                        fontSize: 14, 
                        color: isDark ? '#a5b4fc' : '#4338ca',
                        flex: 1,
                        lineHeight: 20
                    }}>
                        ここに登録された支払先は、カテゴリの自動学習対象から外れます。Amazonなど、毎回カテゴリが変わる支払先を登録しておくと便利です。
                    </Text>
                </View>

                {/* Input Area */}
                <View style={{ 
                    flexDirection: 'row', 
                    marginBottom: 24,
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2
                }}>
                    <TextInput
                        style={{ 
                            flex: 1, 
                            paddingHorizontal: 16, 
                            paddingVertical: 12,
                            color: colors.text,
                            fontSize: 16
                        }}
                        placeholder="支払先名を入力（例: Amazon）"
                        placeholderTextColor={colors.textMuted}
                        value={newPayee}
                        onChangeText={setNewPayee}
                    />
                    <TouchableOpacity 
                        onPress={handleAdd}
                        style={{ 
                            backgroundColor: colors.indigo, 
                            width: 48, 
                            height: 48, 
                            borderRadius: 12,
                            alignItems: 'center', 
                            justifyContent: 'center'
                        }}
                    >
                        <Plus size={24} color="white" />
                    </TouchableOpacity>
                </View>

                <Text style={{ 
                    fontSize: 13, 
                    fontWeight: 'bold', 
                    color: colors.textMuted, 
                    marginBottom: 12, 
                    marginLeft: 4, 
                    textTransform: 'uppercase', 
                    letterSpacing: 1 
                }}>除外リスト ({ignoredPayees.length})</Text>

                {ignoredPayees.length === 0 ? (
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
                        <Text style={{ color: colors.textMuted }}>除外されている支払先はありません</Text>
                    </View>
                ) : (
                    ignoredPayees.map((payee) => (
                        <View 
                            key={payee}
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                backgroundColor: colors.card, 
                                padding: 16, 
                                borderRadius: 16, 
                                marginBottom: 12,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 1
                            }}
                        >
                            <Text style={{ flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' }}>{payee}</Text>
                            <TouchableOpacity 
                                onPress={() => handleDelete(payee)}
                                style={{ padding: 8 }}
                            >
                                <Trash2 size={20} color={colors.danger} />
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
