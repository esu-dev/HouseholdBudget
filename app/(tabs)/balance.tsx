import { useRouter } from 'expo-router';
import { ArrowDownCircle, ArrowUpCircle, Scale, Wallet } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function BalanceScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
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
        return Object.values(accountBalances).reduce((sum, val) => sum + val, 0);
    }, [accountBalances]);

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
            <View style={{ padding: 20 }}>
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
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>{accounts.length} 口座</Text>
                        </View>
                    </View>
                </View>

                {/* 口座別残高一覧 */}
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>口座別残高</Text>
                
                {accounts.map((account) => {
                    const balance = accountBalances[account.id] || 0;
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
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.indigo + '15', alignItems: 'center', justifyContent: 'center' }}>
                                <Wallet size={20} color={colors.indigo} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{account.name}</Text>
                                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                                    {account.type === 'cash' ? '現金' : account.type === 'bank' ? '銀行口座' : 'クレジットカード'}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>¥{balance.toLocaleString()}</Text>
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
