import { Stack, useRouter } from 'expo-router';
import { ArrowDownCircle, ArrowUpCircle, Building2, CreditCard, EyeOff, Wallet } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { useTransactionStore } from '../../store/useTransactionStore';

const ACCOUNT_TYPE_INFO: Record<string, { label: string; icon: any; color: string }> = {
    cash: { label: '現金', icon: Wallet, color: '#f59e0b' },
    bank: { label: '銀行口座', icon: Building2, color: '#3b82f6' },
    card: { label: 'クレジットカード', icon: CreditCard, color: '#ef4444' },
    others: { label: 'その他', icon: Wallet, color: '#64748b' },
};

export default function BalanceScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { transactions, accounts, accountBalances, fetchData } = useTransactionStore();

    useEffect(() => {
        fetchData();
    }, []);

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
    };

    // 合計資産（純資産）を計算
    const netWorth = useMemo(() => {
        return accounts.reduce((sum, account) => {
            if (account.excludeFromNetWorth) return sum;
            return sum + (accountBalances[account.id] || 0);
        }, 0);
    }, [accountBalances, accounts]);

    // 今月の収支
    const monthlyStats = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let income = 0;
        let expenses = 0;

        transactions.forEach(t => {
            const d = new Date(t.date);
            if (d >= startOfMonth) {
                if (t.amount > 0) income += t.amount;
                else expenses += Math.abs(t.amount);
            }
        });

        return { income, expenses, balance: income - expenses };
    }, [transactions]);

    return (
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: true }} />

            <View style={{ padding: 20, paddingTop: 10 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 20, paddingTop: 10 }}>資産状況</Text>

                {/* 純資産カード */}
                <View style={{ backgroundColor: colors.indigo, padding: 24, borderRadius: 32, marginBottom: 24, shadowColor: colors.indigo, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>現在の合計純資産</Text>
                    <Text style={{ color: 'white', fontSize: 36, fontWeight: 'bold', marginTop: 8 }}>¥{netWorth.toLocaleString()}</Text>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>今月の収支</Text>
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>
                                {monthlyStats.balance >= 0 ? '+' : ''}¥{monthlyStats.balance.toLocaleString()}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>アカウント数</Text>
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>{accounts.filter(a => !a.isHidden).length} 口座</Text>
                        </View>
                    </View>
                </View>

                {/* 口座別残高一覧 */}
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>口座別残高</Text>

                {accounts.filter(a => !a.isHidden).map((account) => {
                    const balance = accountBalances[account.id] || 0;
                    const typeInfo = ACCOUNT_TYPE_INFO[account.type] || ACCOUNT_TYPE_INFO.others;
                    const IconComp = typeInfo.icon;

                    return (
                        <TouchableOpacity
                            key={account.id}
                            onPress={() => router.push(`/accounts/${account.id}`)}
                            style={{
                                backgroundColor: colors.card,
                                padding: 18,
                                borderRadius: 24,
                                marginBottom: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 2,
                                elevation: 1
                            }}
                        >
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: typeInfo.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                                <IconComp size={20} color={typeInfo.color} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 16, marginRight: 8 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }} numberOfLines={1}>{account.name}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                                        {typeInfo.label}
                                    </Text>
                                    {account.excludeFromNetWorth && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                            <EyeOff size={10} color="#f43f5e" />
                                            <Text style={{ fontSize: 10, color: '#f43f5e', fontWeight: 'bold' }}>非計上</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, minWidth: 100, textAlign: 'right' }}>¥{balance.toLocaleString()}</Text>
                        </TouchableOpacity>
                    );
                })}

                {/* 今月のサマリー詳細 */}
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginTop: 12, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>今月の動き</Text>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
                    <View style={{ flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 24, borderLeftWidth: 4, borderLeftColor: '#22c55e' }}>
                        <ArrowUpCircle size={16} color="#22c55e" />
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>収入</Text>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>¥{monthlyStats.income.toLocaleString()}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 24, borderLeftWidth: 4, borderLeftColor: '#ef4444' }}>
                        <ArrowDownCircle size={16} color="#ef4444" />
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>支出</Text>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>¥{monthlyStats.expenses.toLocaleString()}</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}
