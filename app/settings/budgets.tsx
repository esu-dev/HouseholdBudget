import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Lightbulb, Save, Target, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORY_ICONS } from '../../constants/categories';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function BudgetSettingsScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const {
        majorCategories,
        budgets,
        fetchBudgets,
        upsertBudget,
        isLoading,
        fetchData,
        averageMonthlyIncome,
        averageMonthlyExpense,
        averageMonthlyExpensesByCategory,
        savingsGoal,
        updateSavingsGoal
    } = useTransactionStore();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [localBudgets, setLocalBudgets] = useState<Record<string, string>>({});
    const [localSavingsGoal, setLocalSavingsGoal] = useState('');

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        indigoSub: isDark ? '#312e81' : '#eef2ff',
        inputBg: isDark ? '#0f172a' : '#f1f5f9',
        amber: '#f59e0b',
        amberSub: isDark ? '#451a03' : '#fff7ed',
        green: '#10b981',
        greenSub: isDark ? '#064e3b' : '#ecfdf5',
    };

    const monthStr = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        fetchBudgets(monthStr);
    }, [monthStr]);

    useEffect(() => {
        const newLocalBudgets: Record<string, string> = {};
        budgets.forEach(b => {
            newLocalBudgets[b.category_id] = b.amount.toString();
        });
        setLocalBudgets(newLocalBudgets);
    }, [budgets]);

    useEffect(() => {
        setLocalSavingsGoal(savingsGoal.toString());
    }, [savingsGoal]);

    const handleSave = async () => {
        try {
            // 希望貯金額の保存
            const savingsAmount = parseInt(localSavingsGoal) || 0;
            await updateSavingsGoal(savingsAmount);

            // カテゴリ別予算の保存
            for (const categoryId in localBudgets) {
                const amount = parseInt(localBudgets[categoryId]) || 0;
                await upsertBudget({
                    month: monthStr,
                    category_id: categoryId,
                    amount: amount
                });
            }
            Alert.alert('成功', '設定を保存しました');
        } catch (e) {
            Alert.alert('エラー', '保存に失敗しました');
        }
    };

    const changeMonth = (offset: number) => {
        const next = new Date(selectedDate);
        next.setMonth(next.getMonth() + offset);
        setSelectedDate(next);
    };

    const expenseCategories = useMemo(() => {
        return majorCategories.filter(cat => cat.type === 'expense');
    }, [majorCategories]);

    const totalBudget = useMemo(() => {
        return Object.values(localBudgets).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    }, [localBudgets]);

    const targetBudget = useMemo(() => {
        const savings = parseInt(localSavingsGoal) || 0;
        return Math.max(0, averageMonthlyIncome - savings);
    }, [averageMonthlyIncome, localSavingsGoal]);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: colors.background }}
        >
            <Stack.Screen options={{
                headerShown: true,
                title: '予算設定',
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
                        <ChevronLeft size={24} color={colors.indigo} />
                    </TouchableOpacity>
                ),
                headerRight: () => (
                    <TouchableOpacity onPress={handleSave} style={{ marginRight: 8 }}>
                        <Save size={24} color={colors.indigo} />
                    </TouchableOpacity>
                ),
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }} />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* 1. 統計・目標セクション */}
                <View style={{ padding: 20 }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                            <TouchableOpacity onPress={() => changeMonth(-1)} style={{ padding: 10 }}>
                                <ChevronLeft size={24} color={colors.indigo} />
                            </TouchableOpacity>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, minWidth: 150, textAlign: 'center' }}>
                                {selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月
                            </Text>
                            <TouchableOpacity onPress={() => changeMonth(1)} style={{ padding: 10 }}>
                                <ChevronRight size={24} color={colors.indigo} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                            <View style={{ flex: 1, backgroundColor: colors.greenSub, padding: 16, borderRadius: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <TrendingUp size={16} color={colors.green} />
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.green, marginLeft: 6 }}>平均月収 (6ヶ月)</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: 'black', color: isDark ? '#fff' : '#064e3b' }}>
                                    ¥{averageMonthlyIncome.toLocaleString()}
                                </Text>
                            </View>

                            <View style={{ flex: 1, backgroundColor: isDark ? '#451a1a' : '#fef2f2', padding: 16, borderRadius: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <TrendingUp size={16} color="#ef4444" style={{ transform: [{ rotate: '180deg' }] }} />
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ef4444', marginLeft: 6 }}>平均支出 (6ヶ月)</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: 'black', color: isDark ? '#fff' : '#451a1a' }}>
                                    ¥{averageMonthlyExpense.toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        <View style={{ flex: 1, backgroundColor: colors.amberSub, padding: 16, borderRadius: 20, marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Target size={16} color={colors.amber} />
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.amber, marginLeft: 6 }}>希望貯金額</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, color: isDark ? '#fff' : '#451a03', marginRight: 4 }}>¥</Text>
                                <TextInput
                                    style={{ fontSize: 18, fontWeight: 'black', color: isDark ? '#fff' : '#451a03', flex: 1, padding: 0 }}
                                    keyboardType="numeric"
                                    value={localSavingsGoal}
                                    onChangeText={(text) => setLocalSavingsGoal(text.replace(/[^0-9]/g, ''))}
                                    placeholder="0"
                                    placeholderTextColor={isDark ? '#94a3b8' : '#a8a29e'}
                                />
                                <Text style={{ fontSize: 12, color: isDark ? '#fff' : '#451a03', marginLeft: 2 }}>円</Text>
                            </View>
                        </View>

                        <View style={{ backgroundColor: colors.indigoSub, padding: 20, borderRadius: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Lightbulb size={18} color={colors.indigo} />
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.indigo, marginLeft: 8 }}>予算の目安</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 20, fontWeight: 'black', color: colors.indigo }}>
                                        ¥{targetBudget.toLocaleString()}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                                        (平均月収 - 希望貯金額)
                                    </Text>
                                </View>
                            </View>

                            <View style={{ height: 1, backgroundColor: colors.indigo, opacity: 0.1, marginBottom: 12 }} />

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textMuted }}>現在の予算合計</Text>
                                <Text style={{ fontSize: 20, fontWeight: 'black', color: totalBudget > targetBudget ? colors.amber : colors.text }}>
                                    ¥{totalBudget.toLocaleString()}
                                </Text>
                            </View>
                            {totalBudget > targetBudget && targetBudget > 0 && (
                                <Text style={{ fontSize: 11, color: colors.amber, marginTop: 4, fontWeight: 'bold', textAlign: 'right' }}>
                                    目安を ¥{(totalBudget - targetBudget).toLocaleString()} 超過しています
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* 2. カテゴリ別予算セクション */}
                <View style={{ paddingHorizontal: 20 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                        カテゴリ別予算
                    </Text>

                    {expenseCategories.map(category => {
                        const IconComp = CATEGORY_ICONS[category.icon] || Save;
                        return (
                            <View key={category.id} style={{
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
                            }}>
                                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: category.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                                    <IconComp size={20} color={category.color} />
                                </View>

                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text }}>{category.label}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                                        過去6ヶ月平均: ¥{(averageMonthlyExpensesByCategory[category.id] || 0).toLocaleString()}
                                    </Text>
                                </View>

                                <View style={{ width: 120 }}>
                                    <TextInput
                                        style={{
                                            backgroundColor: colors.inputBg,
                                            color: colors.text,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 10,
                                            textAlign: 'right',
                                            fontSize: 16,
                                            fontWeight: 'bold'
                                        }}
                                        keyboardType="numeric"
                                        value={localBudgets[category.id] || ''}
                                        onChangeText={(text) => {
                                            setLocalBudgets(prev => ({ ...prev, [category.id]: text.replace(/[^0-9]/g, '') }));
                                        }}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                                <Text style={{ marginLeft: 4, color: colors.textMuted, fontSize: 12 }}>円</Text>
                            </View>
                        );
                    })}

                    <TouchableOpacity
                        onPress={handleSave}
                        style={{
                            backgroundColor: colors.indigo,
                            paddingVertical: 18,
                            borderRadius: 24,
                            alignItems: 'center',
                            marginTop: 10,
                            shadowColor: colors.indigo,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4
                        }}
                    >
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>設定を保存する</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
