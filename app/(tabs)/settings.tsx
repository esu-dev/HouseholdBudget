import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { ListTree, ChevronRight, Wallet, PieChart, Shield, Bell } from 'lucide-react-native';

export default function SettingsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
    };

    const MenuItem = ({ icon: Icon, title, subtitle, onPress }: any) => (
        <TouchableOpacity 
            onPress={onPress}
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
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isDark ? '#312e81' : '#eef2ff', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color={colors.indigo} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{title}</Text>
                {subtitle && <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{subtitle}</Text>}
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 24 }}>設定</Text>
                
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>家計簿の設定</Text>
                
                <MenuItem 
                    icon={ListTree} 
                    title="カテゴリ設定" 
                    subtitle="支出・収入のカテゴリを編集" 
                    onPress={() => router.push('/settings/categories')}
                />
                
                <MenuItem 
                    icon={Wallet} 
                    title="口座・アカウント設定" 
                    subtitle="現金、銀行、カードの管理" 
                    onPress={() => router.push('/settings/accounts')} 
                />

                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginTop: 12, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>アプリ設定</Text>
                
                <MenuItem 
                    icon={Bell} 
                    title="通知設定" 
                    subtitle="入力忘れ防止リマインダーなど" 
                    onPress={() => {}} 
                />
                
                <MenuItem 
                    icon={Shield} 
                    title="プライバシーとセキュリティ" 
                    subtitle="画面ロック、パスコード設定" 
                    onPress={() => {}} 
                />

                <MenuItem 
                    icon={PieChart} 
                    title="データ管理" 
                    subtitle="データのバックアップ・復元" 
                    onPress={() => {}} 
                />

                <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 60 }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Household Budget v1.0.0</Text>
                </View>
            </View>
        </ScrollView>
    );
}
