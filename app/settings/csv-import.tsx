import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, FileUp, Info, Tag, Wallet } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';
import { databaseService } from '../../services/database';
import { externalCsvImportService, ExternalCsvType, ImportResult } from '../../services/externalCsvImportService';
import { useTransactionStore } from '../../store/useTransactionStore';

export default function CsvImportScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const { accounts, majorCategories, fetchData } = useTransactionStore();

    const [isLoading, setIsLoading] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [missingMappings, setMissingMappings] = useState<{ categories: string[], accounts: string[] }>({ categories: [], accounts: [] });
    const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
    const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
    const [savedCategoryMappings, setSavedCategoryMappings] = useState<Record<string, string>>({});
    const [savedAccountMappings, setSavedAccountMappings] = useState<Record<string, string>>({});

    const [mappingModalVisible, setMappingModalVisible] = useState(false);
    const [pendingCsvData, setPendingCsvData] = useState<{ data: string[][], type: ExternalCsvType } | null>(null);

    const isDark = colorScheme === 'dark';
    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        inputBg: isDark ? '#334155' : '#f1f5f9',
    };

    const unsavedCategoryKeys = Object.keys(categoryMappings).filter(
        key => !savedCategoryMappings[key] || categoryMappings[key] !== savedCategoryMappings[key]
    );
    const unsavedAccountKeys = Object.keys(accountMappings).filter(
        key => !savedAccountMappings[key] || accountMappings[key] !== savedAccountMappings[key]
    );
    const hasUnsavedMappings = unsavedCategoryKeys.length > 0 || unsavedAccountKeys.length > 0;

    useEffect(() => {
        loadMappings();
    }, []);

    const loadMappings = async () => {
        const catMap = await databaseService.getCsvCategoryMappings();
        const accMap = await databaseService.getCsvAccountMappings();
        
        // Normalize keys from DB to match session normalization
        const normalize = (val: string) => val ? val.trim().replace(/\s+/g, ' ') : '';
        const normalizedCats: Record<string, string> = {};
        for (const [k, v] of Object.entries(catMap)) {
            normalizedCats[normalize(k)] = v;
        }
        const normalizedAccs: Record<string, string> = {};
        for (const [k, v] of Object.entries(accMap)) {
            normalizedAccs[normalize(k)] = v;
        }

        setCategoryMappings(normalizedCats);
        setAccountMappings(normalizedAccs);
        setSavedCategoryMappings({ ...normalizedCats });
        setSavedAccountMappings({ ...normalizedAccs });
    };

    const handlePickFile = async () => {
        setIsLoading(true);
        const result = await externalCsvImportService.pickAndParseCsv();
        setIsLoading(false);

        if (!result) return;

        setPendingCsvData(result);
        checkMappings(result.data, result.type);
    };
    const checkMappings = (data: string[][], type: ExternalCsvType) => {
        const missingCats: string[] = [];
        const missingAccs: string[] = [];
        const normalize = (val: string) => val ? val.trim().replace(/\s+/g, ' ') : '';

        let startIndex = 0;
        if (data.length > 0 && data[0][0].includes('日')) startIndex = 1;

        for (let i = startIndex; i < data.length; i++) {
            const row = data[i];
            if (row.length < 4) continue;

            if (type === 'income_expense') {
                const extCat = normalize(row[1]);
                const extAcc = normalize(row[6]);
                if (extCat && !categoryMappings[extCat] && !missingCats.includes(extCat)) missingCats.push(extCat);
                if (extAcc && !accountMappings[extAcc] && !missingAccs.includes(extAcc)) missingAccs.push(extAcc);
            } else {
                const extFrom = normalize(row[1]);
                const extTo = normalize(row[4]);
                if (extFrom && !accountMappings[extFrom] && !missingAccs.includes(extFrom)) missingAccs.push(extFrom);
                if (extTo && !accountMappings[extTo] && !missingAccs.includes(extTo)) missingAccs.push(extTo);
            }
        }

        if (missingCats.length > 0 || missingAccs.length > 0) {
            setMissingMappings({ categories: missingCats, accounts: missingAccs });
            setMappingModalVisible(true);
        } else if (hasUnsavedMappings) {
            // No missing but has unsaved, show modal for review
            setMissingMappings({ categories: unsavedCategoryKeys, accounts: unsavedAccountKeys });
            setMappingModalVisible(true);
        } else {
            // All mapped and saved, ready to import
            startImport(data, type, categoryMappings, accountMappings);
        }
    };

    const saveMappingsToDb = async (currentCatMap: Record<string, string>, currentAccMap: Record<string, string>) => {
        const catKeys = Object.keys(currentCatMap).filter(
            key => !savedCategoryMappings[key] || currentCatMap[key] !== savedCategoryMappings[key]
        );
        const accKeys = Object.keys(currentAccMap).filter(
            key => !savedAccountMappings[key] || currentAccMap[key] !== savedAccountMappings[key]
        );

        for (const key of catKeys) {
            await databaseService.updateCsvCategoryMapping(key, currentCatMap[key]);
        }
        for (const key of accKeys) {
            await databaseService.updateCsvAccountMapping(key, currentAccMap[key]);
        }
        
        setSavedCategoryMappings({ ...currentCatMap });
        setSavedAccountMappings({ ...currentAccMap });
    };

    const startImport = async (data: string[][], type: ExternalCsvType, catMap: Record<string, string>, accMap: Record<string, string>) => {
        setIsLoading(true);
        try {
            // Ensure mappings are saved to DB when importing
            await saveMappingsToDb(catMap, accMap);
            
            const result = await externalCsvImportService.processImport(data, type, catMap, accMap);
            setImportResult(result);
            await fetchData();
            Alert.alert('インポート完了', `${result.successCount}件の取引を取り込みました。`);
        } catch (error) {
            Alert.alert('エラー', 'インポート中にエラーが発生しました。');
        } finally {
            setIsLoading(false);
            setPendingCsvData(null);
        }
    };

    const saveAndImport = async () => {
        setMappingModalVisible(false);
        if (pendingCsvData) {
            await startImport(pendingCsvData.data, pendingCsvData.type, categoryMappings, accountMappings);
        } else {
            await saveMappingsToDb(categoryMappings, accountMappings);
            Alert.alert('保存完了', '対応関係を保存しました。');
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 60, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                    <ChevronLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.text, marginRight: 28 }}>
                    外部CSVインポート
                </Text>
            </View>

            <ScrollView style={{ flex: 1, padding: 20 }}>
                {/* Intro Section */}
                <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Info size={20} color={colors.indigo} />
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginLeft: 8 }}>「毎日家計簿」データの取り込み</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 20 }}>
                        毎日家計簿アプリから書き出したCSVファイルを読み込むことができます。収支CSVと振替CSVの両方に対応しています。
                    </Text>
                </View>

                {/* Import Button */}
                <TouchableOpacity
                    onPress={handlePickFile}
                    disabled={isLoading}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    style={{
                        backgroundColor: colors.indigo,
                        padding: 20,
                        borderRadius: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 32,
                        shadowColor: colors.indigo,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 4
                    }}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <>
                            <FileUp size={24} color="white" />
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 12 }}>CSVファイルを選択</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Last Result Section */}
                {importResult && (
                    <View style={{ backgroundColor: colors.card, padding: 20, borderRadius: 24, marginBottom: 32 }}>
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>最新のインポート結果</Text>

                        <View style={{ gap: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: colors.textMuted }}>取り込み成功</Text>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.success }}>{importResult.successCount} 件</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: colors.textMuted }}>重複スキップ</Text>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.warning }}>{importResult.duplicateCount} 件</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: colors.textMuted }}>未設定スキップ</Text>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.danger }}>{importResult.skipCount} 件</Text>
                            </View>
                        </View>

                        {importResult.skipCount > 0 && (
                            <View style={{ marginTop: 20, padding: 12, backgroundColor: colors.danger + '10', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: colors.danger }}>
                                <Text style={{ fontSize: 12, color: colors.danger, fontWeight: 'bold' }}>未設定項目によりスキップされました：</Text>
                                {importResult.missingCategories.length > 0 && (
                                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                                        カテゴリ: {importResult.missingCategories.join(', ')}
                                    </Text>
                                )}
                                {importResult.missingAccounts.length > 0 && (
                                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                                        口座: {importResult.missingAccounts.join(', ')}
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Unsaved Mappings Section */}
                {hasUnsavedMappings && (
                    <View style={{ marginBottom: 32 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.warning, textTransform: 'uppercase', letterSpacing: 1 }}>未保存の対応関係</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setMissingMappings({
                                        categories: unsavedCategoryKeys,
                                        accounts: unsavedAccountKeys
                                    });
                                    setMappingModalVisible(true);
                                }}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Text style={{ fontSize: 12, color: colors.indigo, fontWeight: 'bold' }}>編集する</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16 }}>
                            <View style={{ gap: 8 }}>
                                {unsavedCategoryKeys.map(key => {
                                    const internalId = categoryMappings[key];
                                    const label = majorCategories.flatMap(m => m.subCategories).find(s => s.id === internalId)?.label || internalId;
                                    return (
                                        <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 14, color: colors.text, flex: 1 }} numberOfLines={1}>{key}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                                                <Tag size={12} color={colors.indigo} style={{ marginRight: 4 }} />
                                                <Text style={{ fontSize: 13, color: colors.textMuted }} numberOfLines={1}>{label}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                                {unsavedAccountKeys.map(key => {
                                    const internalId = accountMappings[key];
                                    const label = accounts.find(a => a.id === internalId)?.name || internalId;
                                    return (
                                        <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 14, color: colors.text, flex: 1 }} numberOfLines={1}>{key}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                                                <Wallet size={12} color={colors.indigo} style={{ marginRight: 4 }} />
                                                <Text style={{ fontSize: 13, color: colors.textMuted }} numberOfLines={1}>{label}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                                <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>
                                    ※インポート実行時に自動的に保存されます
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Current Mappings Info */}
                <View style={{ marginBottom: 40 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>保存済みの対応関係</Text>
                        <TouchableOpacity onPress={() => router.push('/settings/csv-mapping-list')} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                            <Text style={{ fontSize: 12, color: colors.indigo, fontWeight: 'bold' }}>すべて見る</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                            <View style={{ alignItems: 'center', flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                                    {Object.entries(savedCategoryMappings).filter(([_, int]) => majorCategories.find(m => m.subCategories.some(s => s.id === int))?.type === 'expense').length}
                                </Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>カテゴリ(支出)</Text>
                            </View>
                            <View style={{ width: 1, height: 24, backgroundColor: colors.border }} />
                            <View style={{ alignItems: 'center', flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                                    {Object.entries(savedCategoryMappings).filter(([_, int]) => majorCategories.find(m => m.subCategories.some(s => s.id === int))?.type === 'income').length}
                                </Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>カテゴリ(収入)</Text>
                            </View>
                            <View style={{ width: 1, height: 24, backgroundColor: colors.border }} />
                            <View style={{ alignItems: 'center', flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{Object.keys(savedAccountMappings).length}</Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>口座</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Mapping Setup Modal */}
            <Modal visible={mappingModalVisible} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', padding: 24 }}>
                        <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>対応関係の設定</Text>
                        <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24 }}>CSV内の項目を、本アプリの項目と紐付けてください。</Text>

                        <ScrollView style={{ flex: 1 }}>
                            {missingMappings.categories.length > 0 && (
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase' }}>カテゴリの紐付け</Text>
                                    {missingMappings.categories.map(extCat => (
                                        <View key={extCat} style={{ marginBottom: 12, backgroundColor: colors.card, padding: 16, borderRadius: 16 }}>
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>{extCat}</Text>
                                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        // Toggle filter if needed, but here we just show both for now or filter.
                                                        // Given the space, maybe just group them with labels is better in horizontal scroll.
                                                    }}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: colors.indigo + '20' }}
                                                >
                                                    <Text style={{ fontSize: 10, color: colors.indigo, fontWeight: 'bold' }}>支出</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                                {majorCategories.filter(m => m.type === 'expense').flatMap(major => major.subCategories).map(minor => (
                                                    <TouchableOpacity
                                                        key={minor.id}
                                                        onPress={() => {
                                                            const normalized = extCat.trim().replace(/\s+/g, ' ');
                                                            setCategoryMappings(prev => ({ ...prev, [normalized]: minor.id }));
                                                        }}
                                                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                                        style={{
                                                            paddingHorizontal: 12,
                                                            paddingVertical: 8,
                                                            borderRadius: 12,
                                                            marginRight: 8,
                                                            backgroundColor: categoryMappings[extCat.trim().replace(/\s+/g, ' ')] === minor.id ? colors.indigo : colors.inputBg,
                                                            borderWidth: 1,
                                                            borderColor: categoryMappings[extCat.trim().replace(/\s+/g, ' ')] === minor.id ? colors.indigo : colors.border
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 12, color: categoryMappings[extCat.trim().replace(/\s+/g, ' ')] === minor.id ? 'white' : colors.text, fontWeight: categoryMappings[extCat.trim().replace(/\s+/g, ' ')] === minor.id ? 'bold' : 'normal' }}>
                                                            {minor.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                            <View style={{ height: 12 }} />
                                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                                <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: colors.warning + '20' }}>
                                                    <Text style={{ fontSize: 10, color: colors.warning, fontWeight: 'bold' }}>収入</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                                {majorCategories.filter(m => m.type === 'income').flatMap(major => major.subCategories).map(minor => (
                                                    <TouchableOpacity
                                                        key={minor.id}
                                                        onPress={() => {
                                                            const normalized = extCat.trim().replace(/\s+/g, ' ');
                                                            setCategoryMappings(prev => ({ ...prev, [normalized]: minor.id }));
                                                        }}
                                                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                                        style={{
                                                            paddingHorizontal: 12,
                                                            paddingVertical: 8,
                                                            borderRadius: 12,
                                                            marginRight: 8,
                                                            backgroundColor: categoryMappings[extCat.trim().replace(/\s+/g, ' ')] === minor.id ? colors.indigo : colors.inputBg,
                                                            borderWidth: 1,
                                                            borderColor: categoryMappings[extCat.trim().replace(/\s+/g, ' ')] === minor.id ? colors.indigo : colors.border
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 12, color: categoryMappings[extCat.trim().replace(/\s+/g, ' ')] === minor.id ? 'white' : colors.text, fontWeight: categoryMappings[extCat.trim().replace(/\s+/g, ' ')] === minor.id ? 'bold' : 'normal' }}>
                                                            {minor.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {missingMappings.accounts.length > 0 && (
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase' }}>口座の紐付け</Text>
                                    {missingMappings.accounts.map(extAcc => (
                                        <View key={extAcc} style={{ marginBottom: 12, backgroundColor: colors.card, padding: 16, borderRadius: 16 }}>
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>{extAcc}</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                                {accounts.map(acc => (
                                                    <TouchableOpacity
                                                        key={acc.id}
                                                        onPress={() => {
                                                            const normalized = extAcc.trim().replace(/\s+/g, ' ');
                                                            setAccountMappings(prev => ({ ...prev, [normalized]: acc.id }));
                                                        }}
                                                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                                        style={{
                                                            paddingHorizontal: 12,
                                                            paddingVertical: 8,
                                                            borderRadius: 12,
                                                            marginRight: 8,
                                                            backgroundColor: accountMappings[extAcc.trim().replace(/\s+/g, ' ')] === acc.id ? colors.indigo : colors.inputBg,
                                                            borderWidth: 1,
                                                            borderColor: accountMappings[extAcc.trim().replace(/\s+/g, ' ')] === acc.id ? colors.indigo : colors.border
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 12, color: accountMappings[extAcc.trim().replace(/\s+/g, ' ')] === acc.id ? 'white' : colors.text, fontWeight: accountMappings[extAcc.trim().replace(/\s+/g, ' ')] === acc.id ? 'bold' : 'normal' }}>
                                                            {acc.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 16 }}>
                            <TouchableOpacity
                                onPress={() => setMappingModalVisible(false)}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: colors.inputBg, alignItems: 'center' }}
                            >
                                <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>キャンセル</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={saveAndImport}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={{ flex: 2, padding: 16, borderRadius: 16, backgroundColor: colors.indigo, alignItems: 'center' }}
                            >
                                <Text style={{ fontWeight: 'bold', color: 'white' }}>保存して取り込む</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
