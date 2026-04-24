import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Stack, useRouter } from 'expo-router';

// Expo Goで実行されているかどうかを判別
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// @react-native-google-signin/google-signin はネイティブモジュールのため、Expo Goでは利用不可
// ビルド後（Development Buildを含む）のみインポートするようにする
let GoogleSignin: any = null;
let statusCodes: any = null;

if (!isExpoGo) {
    try {
        const GoogleSigninModule = require('@react-native-google-signin/google-signin');
        GoogleSignin = GoogleSigninModule.GoogleSignin;
        statusCodes = GoogleSigninModule.statusCodes;
    } catch (e) {
        console.warn('GoogleSignin module could not be loaded', e);
    }
}
import { AlertCircle, CheckCircle2, ChevronLeft, Info, LogOut, Mail, RefreshCw, Terminal } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { databaseService } from '../../services/database';
import { emailImportService } from '../../services/emailImportService';
import { gmailService } from '../../services/gmailService';
import { useTransactionStore } from '../../store/useTransactionStore';


// TODO: 本番環境では正しいクライアントIDを設定してください
const IOS_CLIENT_ID = '707898512731-491f9ltfgsoq46j1sff1pb8gqs4bnrqs.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const WEB_CLIENT_ID = '707898512731-p86et55uhib8kvbcuj27vl5tide4mrf5.apps.googleusercontent.com';

export default function GmailImportScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const isDark = colorScheme === 'dark';
    const [isLoading, setIsLoading] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<any>(null);

    useEffect(() => {
        if (!isExpoGo && GoogleSignin) {
            GoogleSignin.configure({
                scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
                iosClientId: IOS_CLIENT_ID,
                // androidClientId: ANDROID_CLIENT_ID,
            });
        }
        checkToken();
        loadMappings();
    }, []);

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
    };

    const { accounts } = useTransactionStore();
    const [mappings, setMappings] = useState<Record<string, string>>({
        rakuten: '',
        vpass: '',
        jcb: '',
    });

    useEffect(() => {
        checkToken();
        loadMappings();
    }, []);

    const loadMappings = async () => {
        const rakuten = await databaseService.getSetting('gmail_account_id_rakuten');
        const vpass = await databaseService.getSetting('gmail_account_id_vpass');
        const jcb = await databaseService.getSetting('gmail_account_id_jcb');
        setMappings({
            rakuten: rakuten || '',
            vpass: vpass || '',
            jcb: jcb || '',
        });
    };

    const updateMapping = async (key: string, accountId: string) => {
        await databaseService.updateSetting(`gmail_account_id_${key}`, accountId);
        setMappings(prev => ({ ...prev, [key]: accountId }));
    };

    const showAccountPicker = (key: string, title: string) => {
        const cardAccounts = accounts.filter(a => a.type === 'card');
        Alert.alert(
            title,
            '紐付ける口座を選択してください',
            [
                { text: 'キャンセル', style: 'cancel' },
                ...cardAccounts.map(account => ({
                    text: account.name,
                    onPress: () => updateMapping(key, account.id)
                }))
            ]
        );
    };

    const MappingItem = ({ label, mappingKey, title }: { label: string, mappingKey: string, title: string }) => {
        const accountId = mappings[mappingKey];
        const accountName = accounts.find(a => a.id === accountId)?.name || '未設定（自動判別）';

        return (
            <TouchableOpacity
                onPress={() => showAccountPicker(mappingKey, title)}
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border
                }}
            >
                <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: accountId ? colors.indigo : colors.textMuted, fontSize: 14, marginRight: 4 }}>
                        {accountName}
                    </Text>
                    <Info size={14} color={colors.textMuted} />
                </View>
            </TouchableOpacity>
        );
    };

    const handleLogin = async () => {
        if (isExpoGo || !GoogleSignin) {
            Alert.alert('機能制限', 'Googleログインはビルドされたアプリでのみ利用可能です。');
            return;
        }
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const tokens = await GoogleSignin.getTokens();
            
            if (tokens.accessToken) {
                setToken(tokens.accessToken);
                gmailService.saveToken(tokens.accessToken);
            }
        } catch (error: any) {
            if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
                // キャンセルされた
            } else if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
                // すでに進行中
            } else if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                Alert.alert('エラー', 'Google Play Servicesが利用できません。');
            } else {
                Alert.alert('ログインエラー', error.message);
            }
        }
    };

    const checkToken = async () => {
        const storedToken = await gmailService.getStoredToken();
        if (storedToken) {
            setToken(storedToken);
        }
    };

    const handleImport = async () => {
        if (!token) return;
        setIsLoading(true);
        setImportResult(null);
        try {
            const result = await emailImportService.importFromGmail(token);
            setImportResult(result);
        } catch (e: any) {
            if (e.message === 'Unauthorized') {
                setToken(null);
                Alert.alert('認証エラー', 'セッションが切れました。再度ログインしてください。');
            } else {
                Alert.alert('エラー', 'インポート中に問題が発生しました。');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            if (!isExpoGo && GoogleSignin) {
                await GoogleSignin.signOut();
            }
        } catch (e) {}
        await gmailService.removeToken();
        setToken(null);
        setImportResult(null);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.card }}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 15, bottom: 15, left: 30, right: 15 }}>
                    <ChevronLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.text, marginRight: 28 }}>
                    Gmail自動インポート
                </Text>
            </View>

            <ScrollView style={{ flex: 1, padding: 20 }}>
                {/* Account Mappings */}
                <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 24, marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>口座の紐付け設定</Text>
                    <MappingItem label="楽天カード" mappingKey="rakuten" title="楽天カードの設定" />
                    <MappingItem label="三井住友カード (Vpass)" mappingKey="vpass" title="三井住友カードの設定" />
                    <MappingItem label="JCBカードW" mappingKey="jcb" title="JCBカードの設定" />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 12 }}>
                        ※設定しない場合は、口座名から自動的に判別を試みます。
                    </Text>
                </View>

                <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 32, marginBottom: 24 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.indigo + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                        <Mail size={32} color={colors.indigo} />
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
                        利用通知メールから自動入力
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 24 }}>
                        Gmailに届くクレジットカードの利用通知メールを解析して、取引履歴を自動的に作成します。
                    </Text>

                    {!token ? (
                        <View style={{ gap: 12 }}>
                            <TouchableOpacity
                                onPress={handleLogin}
                                style={{
                                    backgroundColor: colors.indigo,
                                    padding: 18,
                                    borderRadius: 20,
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    justifyContent: 'center'
                                }}
                            >
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Googleでログインして開始</Text>
                            </TouchableOpacity>

                            {isExpoGo && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setToken('mock_token');
                                        gmailService.saveToken('mock_token');
                                        Alert.alert('開発者モード', 'モックトークンを使用してログインしました。実際のメール取得は行わず、シミュレーション結果を返します。');
                                    }}
                                    style={{
                                        backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                        padding: 16,
                                        borderRadius: 20,
                                        alignItems: 'center',
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        borderStyle: 'dashed'
                                    }}
                                >
                                    <Terminal size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                    <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: 'bold' }}>開発者用モックログイン</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <View style={{ gap: 12 }}>
                            <TouchableOpacity
                                disabled={isLoading}
                                onPress={handleImport}
                                style={{
                                    backgroundColor: colors.indigo,
                                    padding: 18,
                                    borderRadius: 20,
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    justifyContent: 'center'
                                }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" style={{ marginRight: 10 }} />
                                ) : (
                                    <RefreshCw size={20} color="white" style={{ marginRight: 10 }} />
                                )}
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                                    {isLoading ? 'インポート中...' : 'メールを取得して実行'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleLogout}
                                style={{
                                    padding: 16,
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    justifyContent: 'center'
                                }}
                            >
                                <LogOut size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.textMuted, fontSize: 14 }}>ログアウト</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {importResult && (
                    <View style={{ backgroundColor: colors.card, padding: 24, borderRadius: 32, marginBottom: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>実行結果</Text>

                        <View style={{ gap: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <CheckCircle2 size={20} color="#22c55e" style={{ marginRight: 10 }} />
                                    <Text style={{ color: colors.text }}>新しくインポート</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{importResult.imported} 件</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Info size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
                                    <Text style={{ color: colors.textMuted }}>重複スキップ</Text>
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textMuted }}>{importResult.skipped} 件</Text>
                            </View>

                            {importResult.failed > 0 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <AlertCircle size={20} color="#ef4444" style={{ marginRight: 10 }} />
                                        <Text style={{ color: '#ef4444' }}>解析失敗 / エラー</Text>
                                    </View>
                                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ef4444' }}>{importResult.failed} 件</Text>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => router.push('/')}
                            style={{
                                marginTop: 24,
                                backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                padding: 16,
                                borderRadius: 16,
                                alignItems: 'center'
                            }}
                        >
                            <Text style={{ fontWeight: 'bold', color: colors.text }}>ホームに戻って確認する</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ padding: 16, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 20, marginBottom: 40 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>現在の対応カード</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                        • 楽天カード (利用通知メール){'\n'}
                        • 三井住友カード (ご利用のお知らせ){'\n'}
                        • JCBカードW (ショッピングご利用のお知らせ){'\n\n'}
                        ※メールの形式が変更された場合、正しく解析できないことがあります。
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
