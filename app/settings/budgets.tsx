import { Stack, useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Lightbulb, Save, Settings, Target, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
        fetchStatistics,
        averageMonthlyIncome,
        averageMonthlyExpense,
        averageMonthlyExpensesByCategory,
        savingsGoal,
        updateSavingsGoal,
        incomeCategoryIdsForAverage,
        updateIncomeCategoriesForAverage
    } = useTransactionStore();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [localBudgets, setLocalBudgets] = useState<Record<string, string>>({});
    const [localSavingsGoal, setLocalSavingsGoal] = useState('');
    const [showIncomeSettings, setShowIncomeSettings] = useState(false);

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
        fetchData(monthStr + '-01');
    }, []);

    useEffect(() => {
        fetchBudgets(monthStr);
        fetchStatistics(monthStr + '-01');
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

    const incomeCategories = useMemo(() => {
        return majorCategories.filter(cat => cat.type === 'income');
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
                        <ChevronLeft size={24} color={colors.indigo} hitSlop={{ top: 60, bottom: 60, right: 60, left: 60 }} />
                    </TouchableOpacity>
                ),
                headerRight: () => (
                    <TouchableOpacity onPress={handleSave} style={{ marginRight: 8 }}>
                        <Save size={24} color={colors.indigo} hitSlop={{ top: 30, bottom: 30, right: 30, left: 30 }} />
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

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
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
                                    <TrendingDown size={16} color="#ef4444" />
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ef4444', marginLeft: 6 }}>平均支出 (6ヶ月)</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: 'black', color: isDark ? '#fff' : '#451a1a' }}>
                                    ¥{averageMonthlyExpense.toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowIncomeSettings(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                alignSelf: 'flex-end',
                                marginBottom: 16,
                                paddingRight: 4
                            }}
                        >
                            <Settings size={12} color={colors.textMuted} />
                            <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: 4 }}>平均月収の計算対象を設定</Text>
                        </TouchableOpacity>

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

            <Modal
                visible={showIncomeSettings}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowIncomeSettings(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{
                        backgroundColor: colors.card,
                        borderTopLeftRadius: 32,
                        borderTopRightRadius: 32,
                        padding: 24,
                        maxHeight: '80%'
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>計算に含める収入カテゴリ</Text>
                        </View>

                        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20 }}>
                            平均月収の計算に含めるカテゴリを選択してください。選択を外したカテゴリの収入は計算から除外されます。
                        </Text>

                        <ScrollView>
                            {incomeCategories.map(category => {
                                const isSelected = incomeCategoryIdsForAverage.length === 0 || incomeCategoryIdsForAverage.includes(category.id);
                                const IconComp = CATEGORY_ICONS[category.icon] || Save;
                                return (
                                    <TouchableOpacity
                                        key={category.id}
                                        onPress={async () => {
                                            let newIds = [...incomeCategoryIdsForAverage];
                                            if (newIds.length === 0) {
                                                // もし空（＝全て選択）なら、今のカテゴリ以外を全て入れる
                                                newIds = incomeCategories.map(c => c.id);
                                            }

                                            if (newIds.includes(category.id)) {
                                                newIds = newIds.filter(id => id !== category.id);
                                            } else {
                                                newIds.push(category.id);
                                            }

                                            // 全て選択されている状態なら空にする（デフォルト）
                                            if (newIds.length === incomeCategories.length) {
                                                newIds = [];
                                            }

                                            await updateIncomeCategoriesForAverage(newIds);
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingVertical: 16,
                                            borderBottomWidth: 1,
                                            borderBottomColor: colors.border
                                        }}
                                    >
                                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: category.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                                            <IconComp size={20} color={category.color} />
                                        </View>
                                        <Text style={{ flex: 1, marginLeft: 12, fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                                            {category.label}
                                        </Text>
                                        <View style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            backgroundColor: isSelected ? colors.indigo : 'transparent',
                                            borderWidth: isSelected ? 0 : 2,
                                            borderColor: colors.border,
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {isSelected && <Check size={16} color="white" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity
                            onPress={() => setShowIncomeSettings(false)}
                            style={{
                                backgroundColor: colors.indigo,
                                paddingVertical: 16,
                                borderRadius: 20,
                                alignItems: 'center',
                                marginTop: 24,
                                marginBottom: Platform.OS === 'ios' ? 20 : 0
                            }}
                        >
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>閉じる</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}
