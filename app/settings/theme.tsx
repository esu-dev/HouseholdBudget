import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Sun, Moon, Smartphone } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useThemeStore, ThemeMode } from '../../store/useThemeStore';
import { useAppColorScheme } from '../../hooks/useAppColorScheme';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: any; description: string }[] = [
    { mode: 'system', label: 'システム設定に従う', icon: Smartphone, description: '端末のbright/darkモードに合わせる' },
    { mode: 'light', label: 'ライトモード', icon: Sun, description: '常に明るい配色で表示' },
    { mode: 'dark', label: 'ダークモード', icon: Moon, description: '常に暗い配色で表示' },
];

export default function ThemeSettingsScreen() {
    const router = useRouter();
    const colorScheme = useAppColorScheme();
    const { themeMode, setThemeMode } = useThemeStore();
    
    const isDark = colorScheme === 'dark';

    const colors = {
        background: isDark ? '#0f172a' : '#f8fafc',
        card: isDark ? '#1e293b' : 'white',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#334155' : '#e2e8f0',
        indigo: '#6366f1',
        inputBg: isDark ? '#334155' : '#f1f5f5',
    };

    const currentLabel = THEME_OPTIONS.find(o => o.mode === themeMode)?.label || 'システム設定に従う';

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 60, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ChevronLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.text, marginRight: 28 }}>
                    表示設定
                </Text>
            </View>

            <ScrollView style={{ flex: 1, padding: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textMuted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                    テーマ
                </Text>

                <View style={{ backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', marginBottom: 40 }}>
                    {THEME_OPTIONS.map((option, index) => {
                        const IconComp = option.icon;
                        const isSelected = themeMode === option.mode;
                        const isLast = index === THEME_OPTIONS.length - 1;

                        return (
                            <TouchableOpacity
                                key={option.mode}
                                onPress={() => setThemeMode(option.mode)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 20,
                                    borderBottomWidth: isLast ? 0 : 1,
                                    borderBottomColor: colors.border,
                                }}
                            >
                                <View style={{ 
                                    width: 48, 
                                    height: 48, 
                                    borderRadius: 14, 
                                    backgroundColor: isSelected ? colors.indigo : colors.inputBg,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 16,
                                }}>
                                    <IconComp size={24} color={isSelected ? 'white' : colors.textMuted} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                                        {option.label}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                                        {option.description}
                                    </Text>
                                </View>
                                {isSelected && (
                                    <View style={{ 
                                        width: 24, 
                                        height: 24, 
                                        borderRadius: 12, 
                                        backgroundColor: colors.indigo,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>✓</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{ 
                    padding: 16, 
                    backgroundColor: colors.card, 
                    borderRadius: 16,
                    alignItems: 'center',
                }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        現在の設定: <Text style={{ fontWeight: 'bold' }}>{currentLabel}</Text>
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
