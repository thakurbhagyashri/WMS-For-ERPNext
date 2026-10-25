import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe } from '@/hooks/use-frappe';
import { storage } from '@/utils/storage';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationBell } from './NotificationBell';

import * as Haptics from 'expo-haptics';

interface TopNavbarProps {
    title?: string;
    showBackButton?: boolean;
    showProfile?: boolean;
    showNotifications?: boolean;
}

export const TopNavbar = ({
    title,
    showBackButton = false,
    showProfile = true,
    showNotifications = true
}: TopNavbarProps) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { getCurrentUserEmail, getResource } = useFrappe(APP_CONFIG);
    const [userInitials, setUserInitials] = useState('..');
    const [siteUrl, setSiteUrl] = useState('');

    useEffect(() => {
        const loadUserData = async () => {
            const email = await getCurrentUserEmail();
            if (email && email !== 'Guest') {
                try {
                    const userDoc = await getResource('User', email, undefined, false, undefined, true);
                    if (userDoc && userDoc.full_name) {
                        const nameParts = userDoc.full_name.split(' ');
                        const initials = nameParts.length > 1
                            ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                            : nameParts[0].substring(0, 2).toUpperCase();
                        setUserInitials(initials);
                    } else {
                        // Fallback to email splitting
                        const nameParts = email.split('@')[0].split('.');
                        const initials = nameParts.length > 1
                            ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                            : nameParts[0].substring(0, 2).toUpperCase();
                        setUserInitials(initials);
                    }
                } catch (e) {
                    const nameParts = email.split('@')[0].split('.');
                    const initials = nameParts.length > 1
                        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                        : nameParts[0].substring(0, 2).toUpperCase();
                    setUserInitials(initials);
                }
            }

            const savedUrl = await storage.getItem('dynamic_base_url');
            if (savedUrl) {
                setSiteUrl(savedUrl.replace('https://', '').replace('http://', ''));
            }
        };

        loadUserData();
    }, [getCurrentUserEmail]);

    return (
        <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
            <View style={styles.topBar}>
                {/* Unified Left Section: Navigation + Title */}
                <View style={styles.leftSection}>
                    {showBackButton ? (
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (router.canGoBack()) {
                                    router.back();
                                } else {
                                    router.replace('/');
                                }
                            }}
                            style={styles.backBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityLabel="Go back"
                        >
                            <ArrowLeft size={22} color="#0f172a" />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.logoBox}>
                            <Text style={styles.logoText}>CRON</Text>
                            <View style={styles.logoBadge}>
                                <Text style={styles.logoBadgeText}>WMS</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.titleContainer}>
                        {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : null}
                        {siteUrl ? <Text style={styles.siteText} numberOfLines={1}>{siteUrl}</Text> : null}
                    </View>
                </View>

                {/* Right Slot: Actions */}
                <View style={styles.rightSection}>
                    {showNotifications && (
                        <NotificationBell color="#eab308" style={{ marginRight: 16 }} />
                    )}
                    {showProfile && (
                        <TouchableOpacity
                            style={styles.profileBtn}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push('/settings');
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityLabel="User profile settings"
                        >
                            <Text style={styles.profileInitial}>{userInitials}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 15,
        paddingBottom: 12,
        backgroundColor: '#fff',
        zIndex: 100,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 50,
    },
    leftSection: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    titleContainer: {
        marginLeft: 12,
        justifyContent: 'center',
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    logoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    logoText: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5,
        color: '#fff',
        fontFamily: Fonts.sans,
    },
    logoBadge: {
        backgroundColor: '#fff',
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 2,
        marginLeft: 3,
    },
    logoBadgeText: {
        color: '#0f172a',
        fontSize: 9,
        fontWeight: '900',
        fontFamily: Fonts.sans,
    },
    siteText: {
        color: '#10b981',
        fontSize: 8,
        fontWeight: '700',
        marginTop: 1,
        fontFamily: Fonts.sans,
        opacity: 0.9,
    },
    headerTitle: {
        color: '#0f172a',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    headerIconBtn: {
        marginRight: 8,
        position: 'relative',
        width: 34,
        height: 34,
        backgroundColor: '#f8fafc',
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    notificationDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    profileBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileInitial: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
});
