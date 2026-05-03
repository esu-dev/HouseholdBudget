import { Stack, useRouter } from 'expo-router';
import { Bell, ChevronRight, FileDown, FileUp, ListTree, Palette, PieChart, PiggyBank, Save, Shield, Trash2, Wallet, ZapOff } from 'lucide-react-native';
import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { dataManagementService } from '../../services/dataManagementService';
import { useDeveloperStore } from '../../store/useDeveloperStore';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function SettingsScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const { deleteAllData, fetchData } = useTransactionStore();
    const { isDeveloperMode, setDeveloperMode } = useDeveloperStore();
    const [tapCount, setTapCount] = React.useState(0);

    const handleVersionPress = () => {
        if (isDeveloperMode) return;
        const newCount = tapCount + 1;
        setTapCount(newCount);
        if (newCount >= 7) {
            setDeveloperMode(true);
            Alert.alert('開発者モード', '開発者モードが有効になりました');
            setTapCount(0);
        }
    };

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        danger: '#ef4444',
        success: '#22c55e',
    };

    const handleCsvExport = async () => {
        try {
            await dataManagementService.exportToCsv();
        } catch (e) {
            Alert.alert('エラー', 'CSVの書き出しに失敗しました');
        }
    };

    const handleBackup = async () => {
        try {
            await dataManagementService.backupDatabase();
        } catch (e) {
            Alert.alert('エラー', 'バックアップの作成に失敗しました');
        }
    };

    const handleRestore = async () => {
        Alert.alert(
            'データの復元',
            '既存のデータはすべて上書きされます。バックアップファイル(.db)を選択してください。復元後はアプリの再起動が必要です。',
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: 'ファイルを選択',
                    onPress: async () => {
                        try {
                            await dataManagementService.restoreDatabase();
                            await fetchData();
                            Alert.alert('完了', 'データを復元しました。反映させるためにアプリを再起動してください。');
                        } catch (e) {
                            Alert.alert('エラー', 'データの復元に失敗しました。正しい.dbファイルを選択してください。');
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAll = () => {
        Alert.alert(
            '全データ削除',
            '家計簿の全データ（取引履歴、予算設定、口座、カテゴリなど）を削除し、初期状態に戻します。この操作は取り消せません。本当によろしいですか？',
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '削除する',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteAllData();
                            Alert.alert('完了', 'すべてのデータを削除しました');
                        } catch (e) {
                            Alert.alert('エラー', 'データの削除に失敗しました');
                        }
                    }
                }
            ]
        );
    };

    const MenuItem = ({ icon: Icon, title, subtitle, onPress, iconColor = colors.indigo, iconBgColor = isDark ? '#312e81' : '#eef2ff' }: any) => (
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
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: iconBgColor, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color={iconColor} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: title === '全データの削除' ? colors.danger : colors.text }}>{title}</Text>
                {subtitle && <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{subtitle}</Text>}
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: true }} />

            <View style={{ padding: 20, paddingTop: 30 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>家計簿の設定</Text>

                <MenuItem
                    icon={ListTree}
                    title="カテゴリ設定"
                    subtitle="支出・収入のカテゴリを編集"
                    onPress={() => router.push('/settings/categories')}
                />

                <MenuItem
                    icon={PiggyBank}
                    title="予算設定"
                    subtitle="月ごとのカテゴリ別予算を管理"
                    onPress={() => router.push('/settings/budgets')}
                />

                <MenuItem
                    icon={Wallet}
                    title="口座・アカウント設定"
                    subtitle="現金、銀行、カードの管理"
                    onPress={() => router.push('/settings/accounts')}
                />

                <MenuItem
                    icon={Palette}
                    title="表示設定"
                    subtitle="テーマの変更が可能"
                    onPress={() => router.push('/settings/theme')}
                />

                <MenuItem
                    icon={FileUp}
                    title="外部CSVインポート"
                    subtitle="他アプリ（毎日家計簿）のCSVを読込"
                    onPress={() => router.push('/settings/csv-import')}
                />

                <MenuItem
                    icon={PieChart}
                    title="Gmail自動インポート"
                    subtitle="利用通知メールから取引を自動生成"
                    onPress={() => router.push('/settings/gmail-import')}
                />

                <MenuItem
                    icon={ZapOff}
                    title="自動学習の除外設定"
                    subtitle="カテゴリを自動設定しない支払先"
                    onPress={() => router.push('/settings/ignored-payees')}
                />

                <MenuItem
                    icon={Save}
                    title="支払先ごとのカテゴリ設定"
                    subtitle="学習済みの支払先とカテゴリの対応"
                    onPress={() => router.push('/settings/payee-mappings')}
                />

                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginTop: 12, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>アプリ設定</Text>

                <MenuItem
                    icon={Bell}
                    title="通知設定"
                    subtitle="入力忘れ防止リマインダーなど"
                    onPress={() => { }}
                />

                <MenuItem
                    icon={Shield}
                    title="プライバシーとセキュリティ"
                    subtitle="画面ロック、パスコード設定"
                    onPress={() => { }}
                />

                <MenuItem
                    icon={PieChart}
                    title="データ管理"
                    subtitle="データのバックアップ・復元"
                    onPress={() => { }}
                />

                <View style={{ gap: 12, marginBottom: 24 }}>
                    <MenuItem
                        icon={FileDown}
                        title="CSVエクスポート"
                        subtitle="取引データをCSV形式で出力"
                        onPress={handleCsvExport}
                    />

                    <MenuItem
                        icon={Save}
                        title="データベースのバックアップ"
                        subtitle="現在の状態をファイルとして保存"
                        onPress={handleBackup}
                        iconColor={colors.success}
                        iconBgColor={isDark ? '#064e3b' : '#f0fdf4'}
                    />

                    <MenuItem
                        icon={FileUp}
                        title="データベースの復元"
                        subtitle="バックアップからデータを書き戻す"
                        onPress={handleRestore}
                    />
                </View>

                <MenuItem
                    icon={Trash2}
                    title="全データの削除"
                    subtitle="すべての取引と設定をリセット"
                    onPress={handleDeleteAll}
                    iconColor={colors.danger}
                    iconBgColor={isDark ? '#451a1a' : '#fef2f2'}
                />

                {isDeveloperMode && (
                    <>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginTop: 12, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>開発者設定</Text>
                        <MenuItem
                            icon={Shield}
                            title="開発者モードを無効化"
                            subtitle="ログ表示などの機能をオフにします"
                            onPress={() => {
                                Alert.alert('確認', '開発者モードを無効化しますか？', [
                                    { text: 'キャンセル', style: 'cancel' },
                                    { text: '無効化', onPress: () => setDeveloperMode(false) }
                                ]);
                            }}
                            iconColor={colors.textMuted}
                            iconBgColor={isDark ? '#334155' : '#f1f5f9'}
                        />
                    </>
                )}

                <TouchableOpacity
                    onPress={handleVersionPress}
                    activeOpacity={1}
                    style={{ alignItems: 'center', marginTop: 32, marginBottom: 60 }}
                    hitSlop={{ top: 20, bottom: 20, right: 20, left: 20 }}
                >
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>MyHB v1.2.4</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
