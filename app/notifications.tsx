import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Bell, CheckCheck, ShoppingBag, Truck, ListCheck, Info, X } from 'lucide-react-native';
import { useNotifications } from '@/hooks/useNotifications';
import Animated, { FadeInDown, FadeInRight, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// Pulsing live dot
const LiveDot = () => {
    const pulseAnim = useSharedValue(1);

    useEffect(() => {
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
        opacity: 2 - pulseAnim.value,
    }));

    return (
        <View style={styles.liveDotContainer}>
            <Animated.View style={[styles.liveDotPulse, animatedStyle]} />
            <View style={styles.liveDotCore} />
        </View>
    );
};

export default function NotificationsScreen() {
    const router = useRouter();
    const { notifications, loading, fetchNotifications, markAsRead, unreadCount } = useNotifications();
    const [filterTab, setFilterTab] = useState<'All' | 'Unread' | 'Read'>('Unread');

    const filteredNotifications = notifications.filter((n: any) => {
        if (filterTab === 'Unread') return n.read === 0;
        if (filterTab === 'Read') return n.read === 1;
        return true;
    });

    const handleNotificationClick = (notification: any) => {
        if (notification.read === 0) {
            markAsRead(notification.name);
        }
    };

    const getDocIcon = (type: string) => {
        switch (type) {
            case 'Purchase Order': return <ShoppingBag size={22} color="#7634bc" />;
            case 'Sales Order': return <Truck size={22} color="#7634bc" />;
            case 'Picklist': return <ListCheck size={22} color="#7634bc" />;
            default: return <Info size={22} color="#7634bc" />;
        }
    };

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        const isUnread = item.read === 0;

        return (
            <Animated.View entering={FadeInRight.delay(index * 100).duration(500)}>
                <TouchableOpacity
                    style={[styles.notificationCard, isUnread && styles.unreadCard]}
                    onPress={() => handleNotificationClick(item)}
                    activeOpacity={0.85}
                >
                    <View style={styles.cardContent}>
                        <View style={[styles.iconContainer, isUnread ? styles.iconContainerUnread : styles.iconContainerRead]}>
                            {getDocIcon(item.document_type)}
                        </View>

                        <View style={styles.textContainer}>
                            <View style={styles.headerRow}>
                                <Text style={[styles.subject, isUnread && styles.subjectUnread]}>
                                    {item.subject}
                                </Text>
                                {isUnread && <LiveDot />}
                            </View>

                            {item.creation && (
                                <Text style={styles.time}>
                                    {new Date(item.creation).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </Text>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={() => router.back()}>
            <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.5)" />
            <Stack.Screen
                options={{
                    headerShown: false
                }}
            />

            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                <View style={styles.simpleHeader}>
                    <View style={styles.titleRow}>
                        <Text style={styles.pageTitle}>Notifications</Text>
                        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                            <X size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.headerActions}>
                        <Text style={styles.subtitle}>
                            {unreadCount > 0
                                ? `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
                                : 'You are all caught up!'}
                        </Text>
                    </View>

                    {/* Filter Tabs */}
                    <View style={styles.tabContainer}>
                        {['All', 'Unread', 'Read'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabButton, filterTab === tab && styles.tabButtonActive]}
                                onPress={() => setFilterTab(tab as any)}
                            >
                                <Text style={[styles.tabText, filterTab === tab && styles.tabTextActive]}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.listWrapper}>
                    {loading && notifications.length === 0 ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color="#7634bc" />
                        </View>
                    ) : filteredNotifications.length === 0 ? (
                        <Animated.View entering={FadeInDown.delay(100)} style={styles.center}>
                            <View style={styles.emptyIconBg}>
                                {filterTab === 'Unread' ? (
                                    <CheckCheck size={44} color="#7634bc" />
                                ) : (
                                    <Bell size={44} color="#94a3b8" />
                                )}
                            </View>
                            <Text style={styles.emptyText}>
                                {filterTab === 'Unread'
                                    ? 'All Caught Up!'
                                    : filterTab === 'Read'
                                        ? 'No Read Notifications'
                                        : 'No Notifications Yet'}
                            </Text>
                            <Text style={styles.emptySubtext}>
                                {filterTab === 'Unread'
                                    ? 'You have read all your notifications.'
                                    : 'We will notify you when something important happens.'}
                            </Text>
                        </Animated.View>
                    ) : (
                        <View style={styles.listContainer}>
                            <FlatList
                                data={filteredNotifications}
                                keyExtractor={(item) => item.name}
                                renderItem={renderItem}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                showsVerticalScrollIndicator={false}
                                refreshControl={
                                    <RefreshControl refreshing={loading} onRefresh={fetchNotifications} colors={["#7634bc"]} tintColor="#7634bc" />
                                }
                            />
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        height: '80%',
        backgroundColor: '#f8fafc',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    simpleHeader: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#fff',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    pageTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    closeBtn: {
        padding: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    markAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    markAllText: {
        color: '#7634bc',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    listWrapper: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        padding: 16,
    },
    listContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
    },
    notificationCard: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    unreadCard: {
        backgroundColor: '#faf5ff',
    },
    cardContent: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    iconContainerUnread: {
        backgroundColor: '#faf5ff',
        borderWidth: 1,
        borderColor: '#e9d5ff',
    },
    iconContainerRead: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    actionArrowContainer: {
        marginLeft: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        marginTop: 16,
        backgroundColor: '#f1f5f9',
        padding: 4,
        borderRadius: 24,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 24,
    },
    tabButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#7634bc',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    subject: {
        flex: 1,
        fontSize: 16,
        color: '#334155',
        lineHeight: 24,
        marginRight: 12,
    },
    subjectUnread: {
        fontWeight: 'bold',
        color: '#0f172a',
    },
    docBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 8,
    },
    docBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#7634bc',
        textTransform: 'uppercase',
    },
    time: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    liveDotContainer: {
        width: 10,
        height: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    liveDotCore: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#f6b3ea',
        position: 'absolute',
    },
    liveDotPulse: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(246, 179, 234, 0.5)',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyIconBg: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#faf5ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 20,
        color: '#4c4a75',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 15,
        color: '#8b7ca6',
        textAlign: 'center',
        lineHeight: 22,
    }
});
