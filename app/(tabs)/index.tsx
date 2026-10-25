import { NotificationBell } from '@/components/NotificationBell';
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
//want to show active company name in home page  use useCompanyContext
import { useCompanyContext } from '@/context/CompanyContext';
import { formatCurrency } from '@/utils/currency';
import {
    Activity,
    Box,
    Calendar,
    ChevronRight,
    CreditCard,
    Factory,
    FileText,
    Layers,
    Scan,
    ShoppingCart,
    TrendingUp,
    Truck,
    X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Pressable,
    RefreshControl,
    Animated as RNAnimated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

interface StatCardProps {
    title: string;
    value: string;
    change: string;
    isPositive: boolean;
    Icon: any;
    index: number;
    color?: string;
}

const StatCard = ({ title, value, change, isPositive, Icon, index, color, width }: StatCardProps & { width?: number }) => {
    const { t } = useTranslation();
    const { width: windowWidth } = useWindowDimensions();
    return (
        <Animated.View
            entering={FadeInDown.delay(index * 100).duration(800)}
            style={[styles.statCard, { width: (windowWidth - 42) / 2 }]}
        >
            <View style={styles.statHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.statTitle}>{title}</Text>
                    <Text style={styles.statValue}>{value}</Text>
                </View>
                <View style={[styles.statIconContainer, color ? { backgroundColor: color + '15' } : undefined]}>
                    <Icon size={18} color={color || "#64748b"} />
                </View>
            </View>

            <View style={styles.statFooter}>
                <View style={[styles.statBadge, isPositive ? styles.statBadgePositive : styles.statBadgeNegative]}>
                    <TrendingUp
                        size={10}
                        color={isPositive ? "#10b981" : "#ef4444"}
                        style={{ transform: [{ rotate: isPositive ? '0deg' : '180deg' }] }}
                    />
                    <Text style={[styles.statBadgeText, isPositive ? styles.statBadgeTextPositive : styles.statBadgeTextNegative]}>
                        {change}
                    </Text>
                </View>
                <Text style={styles.statFooterText} numberOfLines={1}>{t('vs_last_month', 'vs last month')}</Text>
            </View>
        </Animated.View>
    );
};


const AnimatedTouchable = ({ children, onPress, style }: any) => {
    const [scale] = React.useState(() => new RNAnimated.Value(1));
    const [glowOpacity] = React.useState(() => new RNAnimated.Value(0));

    const handlePressIn = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        RNAnimated.parallel([
            RNAnimated.spring(scale, {
                toValue: 0.96,
                useNativeDriver: true,
                speed: 20,
            }),
            RNAnimated.timing(glowOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handlePressOut = () => {
        RNAnimated.parallel([
            RNAnimated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                speed: 20,
            }),
            RNAnimated.timing(glowOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    return (
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
            <RNAnimated.View style={[style, { transform: [{ scale }] }]}>
                {/* Glow overlay */}
                <RNAnimated.View
                    style={{
                        ...StyleSheet.absoluteFill,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderRadius: 16,
                        opacity: glowOpacity,
                    }}
                    pointerEvents="none"
                />
                {children}
            </RNAnimated.View>
        </Pressable>
    );
};



const QuickAction = ({ Icon, label, index, onPress, themeColor }: { Icon: any, label: string, index: number, onPress?: () => void, themeColor?: string }) => (
    <Animated.View
        entering={FadeInUp.delay(500 + (index * 100)).duration(800)}
        style={styles.quickActionWrapper}
    >
        <TouchableOpacity 
            style={styles.quickActionBtnContainer} 
            onPress={onPress} 
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={label}
        >
            <View style={[styles.quickActionBtn, { backgroundColor: (themeColor || '#0f172a') + '15' }]}>
                <Icon size={28} color={themeColor || '#0f172a'} />
            </View>
        </TouchableOpacity>
        <Text style={styles.quickActionLabel}>{label}</Text>
    </Animated.View>
);

const formatRelativeTime = (dateTimeStr: string, t: any): string => {
    if (!dateTimeStr) return '';
    try {
        const tDate = new Date(dateTimeStr.replace(' ', 'T'));
        const now = new Date();
        const diffMs = now.getTime() - tDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return t('just_now', 'Just now');
        if (diffMins < 60) return `${diffMins} ${t('min_ago', 'min ago')}`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? t('hour_ago', 'hour ago') : t('hours_ago', 'hours ago')}`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return t('yesterday', 'Yesterday');
        if (diffDays < 7) return `${diffDays} ${t('days_ago', 'days ago')}`;

        return dateTimeStr.split(' ')[0];
    } catch (e) {
        return dateTimeStr.split(' ')[0];
    }
};

const RecentActivityItem = ({ title, sub, value, time, index }: { title: string, sub: string, value: string, time: string, index: number }) => {
    const isDraft = value?.toLowerCase() === 'draft';

    return (
        <Animated.View
            entering={FadeInDown.delay(700 + (index * 100)).duration(800)}
            style={styles.activityItem}
        >
            <View style={styles.activityIconContainer}>
                <LinearGradient
                    colors={['rgba(45, 65, 113, 0.12)', 'rgba(151, 56, 90, 0.12)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activityIconBg}
                >
                    <FileText size={20} color="#2d4171" />
                </LinearGradient>
            </View>
            <View style={styles.activityContent}>
                <View style={styles.activityTitleRow}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{title}</Text>
                </View>
                <View style={styles.activitySubRow}>
                    <View style={[styles.statusBadge, isDraft ? styles.statusBadgeDraft : styles.statusBadgeDefault]}>
                        <Text style={[styles.statusText, isDraft ? styles.statusTextDraft : styles.statusTextDefault]}>
                            {value}
                        </Text>
                    </View>
                    <Text style={styles.activityTime}>• {time}</Text>
                </View>
            </View>
            <View style={styles.activityArrow}>
                <ChevronRight size={18} color="#64748b" />
            </View>
        </Animated.View>
    );
};

export default function DashboardScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { width: windowWidth } = useWindowDimensions();
    const { getCurrentUserEmail, getResource, callMethod } = useFrappe(APP_CONFIG);
    const { hasPermission, refreshPermissions } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [deniedFeatureName, setDeniedFeatureName] = useState('');
    const [search, setSearch] = useState('');
    const [totalItemCount, setTotalItemCount] = useState(0);
    const [totalItemChange, setTotalItemChange] = useState('0.00%');
    const [pendingOrders, setPendingOrders] = useState(0);
    const [pendingOrderChange, setPendingOrderChange] = useState('0%');//need this to compare last  month montn PO
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalRevenueChange, setTotalRevenueChnage] = useState('0%');//need this to update the change value for revenue
    const [totalDispathchOrders, setTotalDispatchOrders] = useState(0);
    const [totalDispathchOrdersChange, setTotalDispatchOrdersChnage] = useState('%0')
    const [draftPicklists, setDraftPicklists] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);
    const [loadingPicklists, setLoadingPicklists] = useState(false);
    const [userName, setUserName] = useState('');
    const [userInitials, setUserInitials] = useState('');
    const { activeCompany, companies, defaultCurrency } = useCompanyContext();
    const [refreshing, setRefreshing] = useState(false);



    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('good_morning', 'Good morning');
        if (hour < 17) return t('good_afternoon', 'Good afternoon');
        return t('good_evening', 'Good evening');
    };

    useEffect(() => {
        if (activeCompany) {
            loadDashboardData();
        }
    }, [activeCompany]);

    const loadDashboardData = async () => {
        try {
            const email = await getCurrentUserEmail();
            if (email && email !== 'Guest') {
                let name = '';
                let initials = '';
                
                try {
                    const userDoc = await getResource('User', email, undefined, false, undefined, true);
                    if (userDoc && userDoc.first_name) {
                        name = userDoc.first_name;
                        initials = name.substring(0, 2).toUpperCase();
                    }
                } catch (userError) {
                    // Fallback will handle this
                }

                if (!name) {
                    const nameParts = email.split('@')[0].split('.');
                    name = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
                    initials = name.substring(0, 2).toUpperCase();
                }

                setUserName(name);
                setUserInitials(initials || 'UN');
            }

            // Run APIs in parallel for faster loading
            await Promise.all([
                getTotalItems(),
                getPendingOrders(),
                getTotalRevenue(),
                getTotalDispathOrders(),
                getPicklistCards()
            ]);
        } catch (error) {
            console.error(
                "Dashboard API error:",
                error
            );
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadDashboardData(), refreshPermissions()]);
        setRefreshing(false);
    };

    //  dropdown in search bar to search  draft picklist by id :

    // reusable dateRange function :
    const getMonthDateRanges = () => {
        const today = new Date();

        // Current Month
        const currentMonthStart =
            new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );

        const currentMonthEnd =
            new Date(
                today.getFullYear(),
                today.getMonth() + 1,
                0
            );

        // Previous Month
        const previousMonthStart =
            new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                1
            );

        const previousMonthEnd =
            new Date(
                today.getFullYear(),
                today.getMonth(),
                0
            );

        const formatDate = (
            date: Date
        ) =>
            date
                .toISOString()
                .split('T')[0];

        return {
            currentStart:
                formatDate(
                    currentMonthStart
                ),
            currentEnd:
                formatDate(
                    currentMonthEnd
                ),
            previousStart:
                formatDate(
                    previousMonthStart
                ),
            previousEnd:
                formatDate(
                    previousMonthEnd
                ),
        };
    };


    // get total active Items count without change value :  need to skip the chage UI
    const getTotalItems =
        async () => {
            try {
                const ItemCount =
                    await callMethod(
                        'frappe.client.get_count',
                        {
                            doctype:
                                'Item',
                            filters: [
                                [
                                    'disabled',
                                    '=',
                                    0
                                ]
                            ]
                        }
                    );

                setTotalItemCount(ItemCount || 0)
            } catch (error) {
                console.error(
                    'Error fetching total items:',
                    error
                );
            }
        };

    // Pending order - pending sales orders who’s delivery is pending vs last month based on delivery date 
    const getPendingOrders =
        async () => {
            try {
                const {
                    currentStart,
                    currentEnd,
                    previousStart,
                    previousEnd
                } =
                    getMonthDateRanges();

                // Current Month Pending Orders
                const currentMonthCount =
                    await callMethod(
                        'frappe.client.get_count',
                        {
                            doctype:
                                'Sales Order',
                            filters: [
                                [
                                    'docstatus',
                                    '=',
                                    1
                                ],
                                [
                                    'per_delivered',
                                    '<',
                                    100
                                ],
                                [
                                    'delivery_date',
                                    'between',
                                    [
                                        currentStart,
                                        currentEnd
                                    ]
                                ],
                                ['company', '=', activeCompany]
                            ]
                        }
                    );
                console.log('current month count----------------->', currentMonthCount, currentStart, currentEnd);

                // Previous Month Pending Orders
                const previousMonthData =
                    await callMethod(
                        'frappe.client.get_list',
                        {
                            doctype:
                                'Sales Order',
                            filters: [
                                [
                                    'docstatus',
                                    '=',
                                    1
                                ],
                                [
                                    'per_delivered',
                                    '<',
                                    100
                                ],
                                [
                                    'delivery_date',
                                    'between',
                                    [
                                        previousStart,
                                        previousEnd
                                    ]
                                ],
                                ['company', '=', activeCompany]
                            ],
                            fields: [
                                'name'
                            ]
                        }
                    );

                const previousCount =
                    previousMonthData
                        ?.length || 0;
                // Set dashboard card value
                setPendingOrders(
                    currentMonthCount || 0
                );

                // Calculate %
                let change =
                    '0.00%';

                if (
                    previousCount > 0
                ) {

                    const percentage =
                        (
                            ((currentMonthCount -
                                previousCount) /
                                previousCount) *
                            100
                        ).toFixed(1);

                    change =
                        `${percentage}%`;

                } else if (
                    currentMonthCount > 0
                ) {
                    change =
                        '+100.00%';
                }

                setPendingOrderChange(
                    change
                );
            } catch (error) {
                console.error(
                    'Error fetching pending orders:',
                    error
                );
            }
        };
    // Revenue - No of Purchase receipts this month vs last month (docstatus = 1)
    const getTotalRevenue =
        async () => {
            try {

                const {
                    currentStart,
                    currentEnd,
                    previousStart,
                    previousEnd
                } =
                    getMonthDateRanges();

                // Current Month Revenue
                const currentMonthData =
                    await callMethod(
                        'frappe.client.get_list',
                        {
                            doctype:
                                'Sales Invoice',
                            filters: [
                                [
                                    'docstatus',
                                    '=',
                                    1
                                ],
                                [
                                    'posting_date',
                                    'between',
                                    [
                                        currentStart,
                                        currentEnd
                                    ]
                                ],
                                ['company', '=', activeCompany]
                            ],
                            fields: [
                                'grand_total',
                                'currency'
                            ],
                            limit_page_length:
                                1000
                        }
                    );

                // Previous Month Revenue
                const previousMonthData =
                    await callMethod(
                        'frappe.client.get_list',
                        {
                            doctype:
                                'Sales Invoice',
                            filters: [
                                [
                                    'docstatus',
                                    '=',
                                    1
                                ],
                                [
                                    'posting_date',
                                    'between',
                                    [
                                        previousStart,
                                        previousEnd
                                    ]
                                ],
                                ['company', '=', activeCompany]
                            ],
                            fields: [
                                'grand_total',
                                'currency'
                            ],
                            limit_page_length:
                                1000
                        }
                    );

                // Sum Current Revenue
                const currentRevenue =
                    currentMonthData.reduce(
                        (
                            sum: number,
                            item: any
                        ) =>
                            sum +
                            Number(
                                item.grand_total || 0
                            ),
                        0
                    );

                // Sum Previous Revenue
                const previousRevenue =
                    previousMonthData.reduce(
                        (
                            sum: number,
                            item: any
                        ) =>
                            sum +
                            Number(
                                item.grand_total || 0
                            ),
                        0
                    );
                // Card Value
                setTotalRevenue(
                    currentRevenue || 0
                );

                // Legacy currency logic removed in favor of CompanyContext defaultCurrency

                // Percentage Change
                let change =
                    '0.00%';

                if (
                    previousRevenue > 0
                ) {

                    const percentage =
                        (
                            (
                                (
                                    currentRevenue -
                                    previousRevenue
                                ) /
                                previousRevenue
                            ) * 100
                        ).toFixed(2);

                    change =
                        `${percentage}%`;

                } else if (
                    currentRevenue > 0
                ) {
                    change =
                        '+100.00%';
                }

                setTotalRevenueChnage(
                    change
                );
            } catch (error) {

                console.log(
                    'error occurred while fetching total revenue:',
                    error
                );
            }
        };
    // Dispatched - Delivery note submitted this month vs last month
    const getTotalDispathOrders =
        async () => {

            try {

                const {
                    currentStart,
                    currentEnd,
                    previousStart,
                    previousEnd
                } =
                    getMonthDateRanges();

                // Current Month
                const currentMonthData =
                    await callMethod(
                        'frappe.client.get_count',
                        {
                            doctype:
                                'Delivery Note',
                            filters: [
                                [
                                    'docstatus',
                                    '=',
                                    1
                                ],
                                [
                                    'posting_date',
                                    'between',
                                    [
                                        currentStart,
                                        currentEnd
                                    ]
                                ],
                                ['company', '=', activeCompany]
                            ]
                        }
                    );

                // Previous Month
                const previousMonthData =
                    await callMethod(
                        'frappe.client.get_count',
                        {
                            doctype:
                                'Delivery Note',
                            filters: [
                                [
                                    'docstatus',
                                    '=',
                                    1
                                ],
                                [
                                    'posting_date',
                                    'between',
                                    [
                                        previousStart,
                                        previousEnd
                                    ]
                                ],
                                ['company', '=', activeCompany]
                            ]
                        }
                    );
                setTotalDispatchOrders(
                    currentMonthData || 0
                );

                let change =
                    '0.00%';

                const previousCount =
                    previousMonthData || 0;

                if (
                    previousCount > 0
                ) {

                    const percentage =
                        (
                            (
                                (
                                    currentMonthData -
                                    previousCount
                                ) /
                                previousCount
                            ) * 100
                        ).toFixed(2);

                    change =
                        `${percentage}%`;

                } else if (
                    currentMonthData > 0
                ) {

                    change =
                        '+100.00%';
                }

                setTotalDispatchOrdersChnage(change);
            } catch (error) {

                console.log(
                    'Error fetching dispatched orders:',
                    error
                );
            }
        };

    const getPicklistCards = async () => {
        try {
            setLoadingPicklists(true);
            const res = await callMethod(
                'frappe.client.get_list',
                {
                    doctype: 'Pick List',
                    filters: [['status', '=', 'Draft'], ['company', '=', activeCompany]],
                    fields: ['name', 'status', 'creation', 'owner'],
                    order_by: 'creation desc',
                    limit_page_length: 10
                },
                false,
                undefined,
                true // hideErrorToast = true
            );
            if (res) {
                setDraftPicklists(res);
            }
        } catch (error) {
            console.error('Error fetching draft picklists:', error);
        } finally {
            setLoadingPicklists(false);
        }
    };

    const stats = [
        { title: t('total_items', 'TOTAL ITEMS'), value: totalItemCount.toString(), change: totalItemChange, isPositive: true, Icon: Box, color: "#3b82f6" },
        { title: t('pending_orders', 'PENDING ORDERS'), value: pendingOrders.toString(), change: pendingOrderChange, isPositive: false, Icon: ShoppingCart, color: "#f59e0b" },
        { title: t('revenue', 'REVENUE'), value: formatCurrency(totalRevenue, defaultCurrency), change: totalRevenueChange, isPositive: true, Icon: CreditCard, color: "#16a34a" },
        { title: t('dispatched', 'DISPATCHED'), value: totalDispathchOrders.toString(), change: totalDispathchOrdersChange, isPositive: false, Icon: Truck, color: "#7c3aed" },
    ];

    const quickActions = [
        { id: 'scan', Icon: Scan, label: t('scan_action', 'Scan'), themeColor: '#6366f1' },
        { id: 'receive', Icon: Box, label: t('receive_action', 'Receive'), themeColor: '#16a34a' },
        { id: 'dispatch', Icon: Truck, label: t('dispatch_action', 'Dispatch'), themeColor: '#3b82f6' },
        { id: 'report', Icon: FileText, label: t('report_action', 'Report'), themeColor: '#f97316' },
    ];

    // activities are loaded dynamically from Draft Picklists


    return (
        <View style={styles.container}>
            <View style={styles.svgHeaderContainer}>
                <Svg height="100%" width="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <Defs>
                        <SvgGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#150247ff" stopOpacity="1" />
                            <Stop offset="1" stopColor="#f6b3eaff" stopOpacity="1" />
                        </SvgGradient>
                    </Defs>
                    {/* Sky */}
                    <Rect width="1440" height="320" fill="url(#skyGrad)" />

                    {/* Back Layer: Smooth Wave */}
                    <Path
                        fill="#8b7ca6"
                        d="M0 220 C 500 160, 900 320, 1440 200 L 1440 320 L 0 320 Z"
                    />

                    {/* Front Layer: Smooth Wave */}
                    <Path
                        fill="#4c4a75"
                        d="M0 320 L 0 280 C 400 230, 1000 320, 1440 260 L 1440 320 Z"
                    />
                </Svg>
            </View>

            <View style={styles.headerTopBar}>
                <View style={styles.logoBox}>
                    <Text style={styles.logoText}>{t('cron', 'CRON')}</Text>
                    <View style={styles.logoBadge}>
                        <Text style={styles.logoBadgeText}>{t('wms', 'WMS')}</Text>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    <NotificationBell color="#eab308" style={{ marginRight: 16 }} />
                    <TouchableOpacity
                        style={styles.profileBtn}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/settings');
                        }}
                    >
                        <Text style={styles.profileInitial}>{userInitials}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.greetingContainer}>
                <Text style={styles.greetingText}>{getGreeting()}, {userName || 'User'}</Text>
                <TouchableOpacity
                    style={styles.activeCompanyBadge}
                    onPress={() => {
                        if (companies && companies.length > 1) {
                            router.push('/settings');
                        }
                    }}
                    activeOpacity={companies && companies.length > 1 ? 0.85 : 1}
                    disabled={!companies || companies.length <= 1}
                >
                    <View style={styles.activeCompanyDot} />
                    <Factory size={13} color="#ddd6fe" style={{ marginRight: 6 }} />
                    <Text style={styles.activeCompanyText} numberOfLines={1}>
                        {activeCompany || 'Master Site'}
                    </Text>
                    {companies && companies.length > 1 && (
                        <ChevronRight size={13} color="#e2e8f0" style={{ marginLeft: 4 }} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
            >
                {/* <View style={styles.mainCardWrapper}>
                    <View style={styles.titleRow}>
                        <Text style={styles.pageTitle}>{t('overview', 'Overview')}</Text>
                    </View>
                </View> */}

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {stats.map((stat, i) => (
                        <StatCard key={i} {...stat} index={i} width={(windowWidth - 42) / 2} />
                    ))}
                </View>

                {/* Quick Actions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('quick_actions', 'Quick Actions')}</Text>
                </View>
                <View style={styles.quickActionsContainer}>
                    {quickActions.map((action, i) => (
                        <QuickAction
                            key={i}
                            {...action}
                            index={i}
                            onPress={() => {
                                if (action.id === 'receive') {
                                    if (!hasPermission('can_receive')) {
                                        setDeniedFeatureName(t('receive_goods', 'Receive Goods'));
                                        setDeniedModalVisible(true);
                                        return;
                                    }
                                    router.push('/inventory/receive');
                                } else if (action.id === 'dispatch') {
                                    if (!hasPermission('can_ship') && !hasPermission('can_pack')) {
                                        setDeniedFeatureName(t('dispatch_goods', 'Dispatch & Shipping'));
                                        setDeniedModalVisible(true);
                                        return;
                                    }
                                    router.push('/inventory/dispatch');
                                } else if (action.id === 'scan') {
                                    if (!hasPermission('can_stock_lookup')) {
                                        setDeniedFeatureName(t('scan_lookup', 'Scan & Stock Lookup'));
                                        setDeniedModalVisible(true);
                                        return;
                                    }
                                    router.push('/scan');
                                } else if (action.id === 'report') {
                                    if (!hasPermission('can_stock_lookup')) {
                                        setDeniedFeatureName(t('reports', 'Reports'));
                                        setDeniedModalVisible(true);
                                        return;
                                    }
                                    setShowReportModal(true);
                                }
                            }}
                        />
                    ))}
                </View>

                {/* Recent Picklists */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('recent_picklists', 'Recent Picklists')}</Text>
                    <TouchableOpacity onPress={() => {
                        if (!hasPermission('can_pick')) {
                            setDeniedFeatureName(t('picklist', 'Picklists'));
                            setDeniedModalVisible(true);
                            return;
                        }
                        router.push('/inventory/picklist');
                    }}>
                        <Text style={styles.viewAllText}>{t('view_all', 'View All')}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.activityContainer}>
                    {loadingPicklists ? (
                        <ActivityIndicator size="small" color="#0f172a" style={{ padding: 20 }} />
                    ) : draftPicklists.length > 0 ? (
                        draftPicklists.map((pl, i) => (
                            <TouchableOpacity
                                key={pl.name}
                                onPress={() => {
                                    if (!hasPermission('can_pick')) {
                                        setDeniedFeatureName(t('order_picking', 'Order Picking'));
                                        setDeniedModalVisible(true);
                                        return;
                                    }
                                    router.push(`/inventory/pick/${pl.name}`);
                                }}
                            >
                                <RecentActivityItem
                                    title={pl.name}
                                    sub={`Created by ${pl.owner || 'System'}`}
                                    value={pl.status}
                                    time={formatRelativeTime(pl.creation, t)}
                                    index={i}
                                />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={{ textAlign: 'center', color: '#64748b', padding: 20, fontFamily: Fonts.sans }}>
                            {t('no_draft_picklists', 'No draft picklists found')}
                        </Text>
                    )}
                </View>

                {/* Padding for floating tab bar */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Report Selection Bottom Sheet Modal */}
            <Modal
                visible={showReportModal}
                transparent={true}
                statusBarTranslucent={true}
                animationType="fade"
                onRequestClose={() => setShowReportModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowReportModal(false)}>
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        <Animated.View entering={FadeInUp.duration(400)} style={styles.filterCardWrapper}>
                            <LinearGradient
                                colors={['#ffffff', '#ffffff', '#ffffff']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.filterCard}
                            >
                                {/* Decorative top handle */}
                                <View style={{ alignItems: 'center', marginBottom: 18 }}>
                                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#d8b4fe' }} />
                                </View>

                                {/* Header */}
                                <View style={styles.modalHeaderLight}>
                                    <View>
                                        <Text style={styles.modalTitleLight}>{t('inventory_reports', 'Inventory Reports')}</Text>
                                        <Text style={{ fontSize: 13, color: '#64748b', fontFamily: Fonts.sans, marginTop: 4 }}>{t('choose_report', 'Choose a report to generate')}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.modalCloseBtnLight}
                                        onPress={() => setShowReportModal(false)}
                                    >
                                        <X size={16} color="#7634bc" />
                                    </TouchableOpacity>
                                </View>

                                {/* Divider */}
                                <View style={{ height: 1, backgroundColor: '#f3e8ff', marginBottom: 20 }} />

                                {/* Stock Balance Option */}
                                <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                                    <AnimatedTouchable
                                        style={styles.reportOptionLight}
                                        onPress={() => {
                                            setShowReportModal(false);
                                            router.push({ pathname: '/inventory/report', params: { type: 'balance' } });
                                        }}
                                    >
                                        <View style={[styles.reportOptionIconContainer, { backgroundColor: '#f5f3ff', borderColor: '#ede9fe' }]}>
                                            <Layers size={20} color="#7c3aed" />
                                        </View>
                                        <View style={styles.reportOptionTextContainer}>
                                            <Text style={styles.reportOptionTitleLight}>{t('stock_balance', 'Stock Balance')}</Text>
                                            <Text style={styles.reportOptionDescLight}>{t('stock_balance_desc', 'Current inventory levels & valuations')}</Text>
                                        </View>
                                        <View style={styles.reportOptionArrow}>
                                            <ChevronRight size={16} color="#7634bc" />
                                        </View>
                                    </AnimatedTouchable>
                                </Animated.View>

                                {/* Stock Ledger Option */}
                                <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                                    <AnimatedTouchable
                                        style={styles.reportOptionLight}
                                        onPress={() => {
                                            setShowReportModal(false);
                                            router.push({ pathname: '/inventory/report', params: { type: 'ledger' } });
                                        }}
                                    >
                                        <View style={[styles.reportOptionIconContainer, { backgroundColor: '#fdf4ff', borderColor: '#fae8ff' }]}>
                                            <Activity size={20} color="#d946ef" />
                                        </View>
                                        <View style={styles.reportOptionTextContainer}>
                                            <Text style={styles.reportOptionTitleLight}>{t('stock_ledger', 'Stock Ledger')}</Text>
                                            <Text style={styles.reportOptionDescLight}>{t('stock_ledger_desc', 'Historic inventory transaction logs')}</Text>
                                        </View>
                                        <View style={styles.reportOptionArrow}>
                                            <ChevronRight size={16} color="#7634bc" />
                                        </View>
                                    </AnimatedTouchable>
                                </Animated.View>

                                {/* Stock Ageing Option */}
                                <Animated.View entering={FadeInDown.delay(300).duration(400)}>
                                    <AnimatedTouchable
                                        style={[styles.reportOptionLight, { marginBottom: 0 }]}
                                        onPress={() => {
                                            setShowReportModal(false);
                                            router.push({ pathname: '/inventory/report', params: { type: 'ageing' } });
                                        }}
                                    >
                                        <View style={[styles.reportOptionIconContainer, { backgroundColor: '#f0fdfa', borderColor: '#ccfbf1' }]}>
                                            <Calendar size={20} color="#0d9488" />
                                        </View>
                                        <View style={styles.reportOptionTextContainer}>
                                            <Text style={styles.reportOptionTitleLight}>{t('stock_ageing', 'Stock Ageing')}</Text>
                                            <Text style={styles.reportOptionDescLight}>{t('stock_ageing_desc', 'Slow-moving stock batches & ages')}</Text>
                                        </View>
                                        <View style={styles.reportOptionArrow}>
                                            <ChevronRight size={16} color="#7634bc" />
                                        </View>
                                    </AnimatedTouchable>
                                </Animated.View>

                                {/* Footer hint */}
                                <View style={{ alignItems: 'center', marginTop: 20 }}>
                                    <Text style={{ fontSize: 11, color: '#94a3b8', fontFamily: Fonts.sans }}>{t('tap_outside_dismiss', 'Tap outside to dismiss')}</Text>
                                </View>
                            </LinearGradient>
                        </Animated.View>
                    </Pressable>
                </Pressable>
            </Modal>

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName={deniedFeatureName}
                onClose={() => setDeniedModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    svgHeaderContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280,
        overflow: 'hidden',
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
        zIndex: 0,
    },
    headerTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 20,
    },
    greetingText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: Fonts.sans,
    },
    subGreetingText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
        fontFamily: Fonts.sans,
    },
    profileBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    profileInitial: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    mainCardWrapper: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    logoBox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoText: {
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 1,
        color: '#fff',
        fontFamily: Fonts.sans,
    },
    logoBadge: {
        backgroundColor: '#fff',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
    },
    logoBadgeText: {
        color: '#4c1d95',
        fontSize: 12,
        fontWeight: '900',
        fontFamily: Fonts.sans,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconBtn: {
        marginRight: 16,
        position: 'relative',
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationDot: {
        // position: 'absolute',
        // top: 10,
        // right: 10,
        // width: 10,
        // height: 10,
        // borderRadius: 5,
        // backgroundColor: '#ef4444',
        // borderWidth: 1.5,
        // borderColor: '#150247',
    },
    greetingContainer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    activeCompanyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    activeCompanyDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#4ade80',
        marginRight: 8,
    },
    activeCompanyText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
        fontFamily: Fonts.sans,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 15,
        marginTop: 0,
        justifyContent: 'space-between',
    },
    statCard: {
        width: (Dimensions.get("window").width - 50) / 2,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 6,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    statTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#94a3b8',
        letterSpacing: 0.8,
        fontFamily: Fonts.sans,
        flex: 1,
    },
    statIconContainer: {
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 15,
        fontFamily: Fonts.sans,
    },
    statFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 4,
    },
    statBadgePositive: {
        backgroundColor: '#f0fdf4',
    },
    statBadgeNegative: {
        backgroundColor: '#fef2f2',
    },
    statBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        marginLeft: 2,
        fontFamily: Fonts.sans,
    },
    statBadgeTextPositive: {
        color: '#16a34a',
    },
    statBadgeTextNegative: {
        color: '#dc2626',
    },
    statFooterText: {
        fontSize: 9,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
        flexShrink: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 25,
        marginTop: 10,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    viewAllText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
        fontFamily: Fonts.sans,
    },
    quickActionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 25,
        marginBottom: 20,
    },
    quickActionWrapper: {
        alignItems: 'center',
        flex: 1,
    },
    quickActionBtnContainer: {
        marginBottom: 10,
    },
    quickActionBtn: {
        width: 60,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        fontFamily: Fonts.sans,
    },
    activityContainer: {
        marginHorizontal: 20,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        shadowColor: '#2d4171',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
    },
    activityIconContainer: {
        marginRight: 14,
    },
    activityIconBg: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityContent: {
        flex: 1,
        justifyContent: 'center',
    },
    activityTitleRow: {
        marginBottom: 4,
    },
    activityTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        fontFamily: Fonts.sans,
        letterSpacing: -0.3,
    },
    activitySubRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginRight: 6,
    },
    statusBadgeDraft: {
        backgroundColor: '#fef3c7',
    },
    statusBadgeDefault: {
        backgroundColor: '#f1f5f9',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
        fontFamily: Fonts.sans,
        textTransform: 'uppercase',
    },
    statusTextDraft: {
        color: '#d97706',
    },
    statusTextDefault: {
        color: '#64748b',
    },
    activityTime: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
        fontFamily: Fonts.sans,
    },
    activityArrow: {
        marginLeft: 8,
        width: 32,
        height: 32,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    filterCardWrapper: {
        width: '100%',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
        maxHeight: '85%',
    },
    filterCard: {
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 30,
        paddingTop: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderBottomWidth: 0,
        paddingBottom: 40,
    },
    modalHeaderLight: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    modalTitleLight: {
        fontSize: 20,
        fontWeight: '900',
        color: '#150247',
        fontFamily: Fonts.sans,
        letterSpacing: -0.3,
    },
    modalCloseBtnLight: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3e8ff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e9d5ff',
    },
    reportOptionLight: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 14,
        paddingRight: 12,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#4c4a75',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    reportOptionTitleLight: {
        fontSize: 16,
        fontWeight: '700',
        color: '#150247',
        fontFamily: Fonts.sans,
        marginBottom: 3,
        letterSpacing: -0.2,
    },
    reportOptionDescLight: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Fonts.sans,
        lineHeight: 16,
    },
    reportOptionIconContainer: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        borderWidth: 1,
    },
    reportOptionTextContainer: {
        flex: 1,
    },
    reportOptionArrow: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#f3e8ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});
