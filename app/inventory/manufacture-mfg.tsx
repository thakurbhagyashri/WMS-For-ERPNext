import { FloatingPill } from '@/components/FloatingPill';
import { NotificationBell } from '@/components/NotificationBell';
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useCompanyContext } from '@/context/CompanyContext';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    Calendar,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock,
    Factory,
    Package,
    Plus,
    User,
    X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { StatCard } from '@/components/StatCards';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Animated, { FadeInUp } from 'react-native-reanimated';

const PAGE_SIZE = 10;

const EntryCard = ({ id, status, order_id, fg_qty, owner, date, index, onPress }: any) => {
    const [isHeld, setIsHeld] = React.useState(false);

    return (
        <TouchableOpacity
            onPress={() => onPress?.(id)}
            onPressIn={() => setIsHeld(true)}
            onPressOut={() => setIsHeld(false)}
            onLongPress={() => Alert.alert('Full ID / Number', id)}
            activeOpacity={0.7}
        >
            <Animated.View
                entering={FadeInUp.delay(100 + (index * 50)).duration(600)}
                style={[
                    styles.activityItem,
                    isHeld && { transform: [{ scale: 0.98 }] }
                ]}
            >
                <View style={styles.activityIconContainer}>
                    <LinearGradient
                        colors={['rgba(118, 52, 188, 0.12)', 'rgba(118, 52, 188, 0.2)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.activityIconBg}
                    >
                        <ClipboardList size={20} color="#7634bc" />
                    </LinearGradient>
                </View>
                <View style={styles.activityContent}>
                    <View style={[styles.activityTitleRow, { flexWrap: isHeld ? 'wrap' : 'nowrap' }]}>
                        <Text style={[styles.activityTitle, { flexShrink: isHeld ? 0 : 1 }]} numberOfLines={isHeld ? undefined : 1}>{id}</Text>
                    </View>
                    {order_id && (
                        <View style={styles.activityTitleRow}>
                            <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: 'bold', marginBottom: 4 }}>{order_id}</Text>
                        </View>
                    )}
                    <View style={styles.activitySubRow}>
                        {fg_qty !== undefined && (
                            <View style={styles.qtyBadge}>
                                <Text style={styles.qtyBadgeText}>
                                    Qty: {fg_qty}
                                </Text>
                            </View>
                        )}
                        <StatusBadge status={status === 1 ? 'Submitted' : 'Draft'} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} color="#94a3b8" />
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{date}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <User size={12} color="#94a3b8" />
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{owner}</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.activityArrow}>
                    <ChevronRight size={18} color="#94a3b8" />
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};



export default function ManufactureMFGScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { getResource, callMethod, getCurrentUserEmail } = useFrappe(APP_CONFIG);
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [userInitials, setUserInitials] = useState('U');

    const { activeCompany } = useCompanyContext();

    useEffect(() => {
        if (!hasPermission('can_stock_transfer')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const email = await getCurrentUserEmail();
                if (email) {
                    const doc = await getResource('User', email);
                    const fullName = doc.full_name || email;
                    setUserInitials(fullName.substring(0, 2).toUpperCase());
                }
            } catch (e) {
                console.warn(e);
            }
        };
        fetchUser();
    }, [getCurrentUserEmail]);

    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);
    const [search, setSearch] = useState('');
    const [permission, requestPermission] = useCameraPermissions();
    const [searchResult, setSearchResult] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [hourlyActivity, setHourlyActivity] = useState<any[]>([]);

    const [statCounts, setStatCounts] = useState({
        pending: 0,
        inProgress: 0,
        completedToday: 0,
        produced: 0,
    });

    const [entries, setEntries] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [searchPage, setSearchPage] = useState(1);
    const [searchHasMore, setSearchHasMore] = useState(true);

    const [isSearching, setIsSearching] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Submitted'>('All');

    const fetchEntries = async (pageIndex = 1, isRefresh = false) => {
        if (!activeCompany) return;
        try {
            const filters: any[] = [
                ['stock_entry_type', '=', 'Manufacture'],
                ['company', '=', activeCompany]
            ];
            if (statusFilter === 'Draft') filters.push(['docstatus', '=', 0]);
            else if (statusFilter === 'Submitted') filters.push(['docstatus', '=', 1]);
            else filters.push(['docstatus', '<', 2]);

            const data = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify(filters),
                fields: '["name", "work_order", "creation", "owner", "docstatus", "fg_completed_qty"]',
                order_by: 'creation desc',
                limit_page_length: PAGE_SIZE,
                limit_start: (pageIndex - 1) * PAGE_SIZE
            });
            const fetched = data || [];
            setEntries(prev => isRefresh || pageIndex === 1 ? fetched : [...prev, ...fetched]);
            setHasMore(fetched.length === PAGE_SIZE);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSearchResults = async (query: string, pageIndex = 1) => {
        if (!activeCompany || !query.trim()) return;
        setIsSearching(true);
        try {
            const filters: any[] = [
                ['stock_entry_type', '=', 'Manufacture'],
                ['company', '=', activeCompany]
            ];
            if (statusFilter === 'Draft') filters.push(['docstatus', '=', 0]);
            else if (statusFilter === 'Submitted') filters.push(['docstatus', '=', 1]);
            else filters.push(['docstatus', '<', 2]);

            const data = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify(filters),
                or_filters: JSON.stringify([
                    ['name', 'like', `%${query}%`],
                    ['work_order', 'like', `%${query}%`]
                ]),
                fields: '["name", "work_order", "creation", "owner", "docstatus", "fg_completed_qty"]',
                order_by: 'creation desc',
                limit_page_length: PAGE_SIZE,
                limit_start: (pageIndex - 1) * PAGE_SIZE
            });
            const fetched = data || [];
            setSearchResult(prev => pageIndex === 1 ? fetched : [...prev, ...fetched]);
            setSearchHasMore(fetched.length === PAGE_SIZE);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        setPage(1);
        setSearchPage(1);
        await Promise.all([
            fetchEntries(1, true),
            fetchLatestworkOrders(), // for stats
            search.trim() ? fetchSearchResults(search, 1) : Promise.resolve()
        ]);
        setRefreshing(false);
    };

    useEffect(() => {
        if (activeCompany) {
            fetchLatestworkOrders(); // for stats
            setPage(1);
            fetchEntries(1, true);
        }
    }, [activeCompany, statusFilter]);

    useEffect(() => {
        if (search.trim()) {
            setSearchPage(1);
            const timer = setTimeout(() => {
                fetchSearchResults(search, 1);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setSearchResult([]);
        }
    }, [search, activeCompany]);

    const handleSearch = (q: string) => {
        setSearch(q);
    };

    const stats = [
        { title: 'Pending WOs', value: statCounts.pending.toString(), change: 0, isPositive: false, Icon: Factory, color: '#ef4444' },
        { title: 'In Progress', value: statCounts.inProgress.toString(), change: 0, isPositive: true, Icon: Clock, color: '#3b82f6' },
        { title: 'Completed', value: statCounts.completedToday.toString(), change: 0, isPositive: true, Icon: CheckCircle2, color: '#16a34a' },
        { title: 'Produced', value: statCounts.produced.toString(), change: 0, isPositive: true, Icon: Package, color: '#f97316' },
    ];

    const displayList = search.trim() ? searchResult : entries;

    const onBarcodeScanned = async ({ data }: { data: string }) => {
        setIsScanning(false);
        setSearch(data.trim());
    };

    const requestScanner = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) return;
        }
        setIsScanning(true);
    };



    async function fetchLatestworkOrders() {
        if (!activeCompany) return;
        try {
            //filter 1 : pending wo's
            const pendingCount = await callMethod('frappe.client.get_count', {
                doctype: 'Stock Entry',
                filters: [
                    ['stock_entry_type', '=', 'Manufacture'],
                    ['docstatus', '=', 0],
                    ['company', '=', activeCompany]
                ]
            });
            //filter 2 : in-progress wo's
            const inProgressCount = await callMethod('frappe.client.get_count', {
                doctype: 'Stock Entry',
                filters: [
                    ['stock_entry_type', '=', 'Material Consumption for Manufacture'],
                    ['docstatus', '=', 1],
                    ['company', '=', activeCompany]
                ]
            });

            //filter 3 : completed wo's
            const today = new Date().toISOString().split('T')[0];
            const completedCount = await callMethod('frappe.client.get_count', {
                doctype: 'Work Order',
                filters: [
                    ['status', '=', 'Completed'],
                    ['modified', '>=', today],
                    ['company', '=', activeCompany]
                ]
            });

            //filter 4 : produced
            const producedCount = await callMethod('frappe.client.get_count', {
                doctype: 'Stock Entry',
                filters: [
                    ['stock_entry_type', '=', 'Manufacture'],
                    ['docstatus', '=', 1],
                    ['posting_date', '>=', today],
                    ['company', '=', activeCompany]
                ]
            });

            setStatCounts({
                pending: pendingCount || 0,
                inProgress: inProgressCount || 0,
                completedToday: completedCount || 0,
                produced: producedCount || 0,
            });

            const now = new Date();
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? 6 : currentDay - 1);
            const monday = new Date(now);
            monday.setDate(now.getDate() - diffToMonday);
            monday.setHours(0, 0, 0, 0);
            const mondayStr = monday.toISOString().split('T')[0];

            const weeklyEntries = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify([
                    ['stock_entry_type', '=', 'Manufacture'],
                    ['docstatus', '=', 1],
                    ['posting_date', '>=', mondayStr],
                    ['company', '=', activeCompany]
                ]),
                fields: '["posting_date"]',
                limit_page_length: 10000
            });

            if (Array.isArray(weeklyEntries)) {
                const dayMap: { [key: string]: number } = { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 };
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                weeklyEntries.forEach((se: any) => {
                    const date = new Date(se.posting_date);
                    const dayLabel = days[date.getDay()];
                    if (dayMap[dayLabel] !== undefined) {
                        dayMap[dayLabel]++;
                    }
                });

                const allActivity = [
                    { day: 'Mon', value: dayMap['Mon'] },
                    { day: 'Tue', value: dayMap['Tue'] },
                    { day: 'Wed', value: dayMap['Wed'] },
                    { day: 'Thu', value: dayMap['Thu'] },
                    { day: 'Fri', value: dayMap['Fri'] },
                    { day: 'Sat', value: dayMap['Sat'] },
                    { day: 'Sun', value: dayMap['Sun'] },
                ];

                setHourlyActivity(allActivity);
            }

        } catch (e) {
            console.error('Error fetching dashboard data:', e);
        }
    };


    return (
        <View style={styles.container}>
            {isScanning ? (
                <>
                </>) : (
                <>
                    <View style={styles.svgHeaderContainer}>
                        <Svg height="100%" width="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <Defs>
                                <SvgGradient id="waveGrad" x1="0" y1="0" x2="1" y2="1">
                                    <Stop offset="0" stopColor="#1b3162" stopOpacity="1" />
                                    <Stop offset="1" stopColor="#bc58bf" stopOpacity="1" />
                                </SvgGradient>
                            </Defs>
                            {/* Pink accent wave at the back */}
                            <Path
                                fill="#dea2e0ff"
                                d="M0,0 L0,220 C400,320 1000,320 1440,240 L1440,0 Z"
                                opacity="0.9"
                            />
                            {/* Main purple/pink gradient wave */}
                            <Path
                                fill="url(#waveGrad)"
                                d="M0,0 L0,220 C400,340 1000,180 1440,160 L1440,0 Z"
                            />
                        </Svg>
                    </View>

                    <View style={[styles.headerTopBar, { paddingTop: (insets.top || 0) + 12 }]}>
                        <View style={styles.logoBox}>
                            <Text style={styles.logoText}>{t('cron', 'CRON')}</Text>
                            <View style={styles.logoBadge}>
                                <Text style={styles.logoBadgeText}>{t('wms', 'WMS')}</Text>
                            </View>
                        </View>
                        <View style={styles.headerActions}>
                            <NotificationBell color="#eab308" style={{ marginRight: 10 }} />
                            <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/settings')}>
                                <Text style={styles.profileInitial}>{userInitials}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.greetingContainer}>
                        <Text style={styles.greetingText}>{t('manufacture_entry', 'Manufacture Entry')}</Text>
                        <Text style={styles.subGreetingText}>{t('produce_finished_goo', 'Produce finished goods from BOM')}</Text>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                        }
                    >

                        {/* Stats */}
                        <View style={styles.statsGrid}>
                            {stats.map((s, i) => (
                                <StatCard key={i} {...s} index={i} />
                            ))}
                        </View>

                        {/* Analytics */}
                        <View style={styles.analyticsHeaderRow}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={styles.analyticsTitleText}>{t('analytics_charts', 'Analytics & Charts')}</Text>
                                <Text style={styles.analyticsSubtitleText}>{t('manufacturing_metric', 'Manufacturing metrics')}</Text>
                            </View>
                        </View>

                        {isAnalyticsOpen && (
                            <Animated.View entering={FadeInUp} style={styles.chartsPanel}>
                                <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2, height: 'auto', paddingBottom: 20 }]}>
                                    <View>
                                        {hourlyActivity.length > 0 ? (() => {
                                            const maxVal = Math.max(...hourlyActivity.map(h => h.value), 5);
                                            const yAxisValues = [
                                                Math.round(maxVal).toString(),
                                                Math.round(maxVal * 0.75).toString(),
                                                Math.round(maxVal * 0.5).toString(),
                                                Math.round(maxVal * 0.25).toString(),
                                                '0'
                                            ];
                                            const labels = hourlyActivity.map(h => h.day);

                                            return (
                                                <>
                                                    <Text style={styles.chartLabel}>{t('weekly_manufacture', 'Weekly Manufacture')}</Text>
                                                    <View style={styles.chartWrapper}>
                                                        <View style={styles.yAxis}>
                                                            {yAxisValues.map(v => (
                                                                <Text key={v} style={styles.yAxisText}>{v}</Text>
                                                            ))}
                                                        </View>
                                                        <View style={styles.chartMain}>
                                                            <View style={styles.gridLinesContainer}>
                                                                {yAxisValues.map((v, idx) => (
                                                                    <View key={idx} style={styles.hGridLine} />
                                                                ))}
                                                            </View>
                                                            <View style={styles.barChartBars}>
                                                                {hourlyActivity.map((item, i) => {
                                                                    const BAR_MAX_HEIGHT = 110;
                                                                    const h_px = (item.value / maxVal) * BAR_MAX_HEIGHT;
                                                                    const isActive = item.value > 0;
                                                                    return (
                                                                        <View key={i} style={styles.barContainer}>
                                                                            {isActive && (
                                                                                <Text style={styles.barTopValue}>{item.value}</Text>
                                                                            )}
                                                                            <View style={[styles.bar, { height: Math.max(h_px, 6), backgroundColor: isActive ? '#7634bc' : 'rgba(118,52,188,0.12)' }]} />
                                                                        </View>
                                                                    );
                                                                })}
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <View style={styles.xAxisWrapper}>
                                                        <View style={{ width: 25 }} />
                                                        <View style={styles.chartLabels}>
                                                            {labels.map(l => (
                                                                <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                                                                    <Text style={[styles.barDay, { fontSize: 10, color: '#94a3b8', marginTop: 4, marginBottom: 0 }]}>{l}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    </View>
                                                </>
                                            );
                                        })() : (
                                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: 180 }}>
                                                <ActivityIndicator size="small" color="#94a3b8" />
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </Animated.View>
                        )}

                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => router.push('/inventory/manufacture/new')}
                            style={{
                                marginHorizontal: 24,
                                marginBottom: 24,
                                borderRadius: 16,
                                overflow: 'hidden',
                                shadowColor: '#7634bc',
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: 0.3,
                                shadowRadius: 10,
                                elevation: 5,
                            }}
                        >
                            <LinearGradient
                                colors={['#7634bc', '#2e1065']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: 54,
                                    gap: 12,
                                }}
                            >
                                <Plus size={18} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', fontFamily: Fonts.sans }}>{t('new_stock_entry', 'New Stock Entry')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>


                        {/* Search */}
                        <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
                            <GlobalSearchInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder={t('search_manufacture_entries', 'Search by ID or Work Order...')}
                                onScan={requestScanner}
                                isSearching={isSearching}
                            />
                        </View>

                        {/* Filter Bar */}
                        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 20 }}>
                            {['All', 'Draft', 'Submitted'].map((filter) => (
                                <TouchableOpacity
                                    key={filter}
                                    onPress={() => setStatusFilter(filter as any)}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 20,
                                        backgroundColor: statusFilter === filter ? '#7634bc' : '#f1f5f9',
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 13,
                                        fontWeight: 'bold',
                                        color: statusFilter === filter ? '#fff' : '#64748b'
                                    }}>{filter}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.listSection}>
                            <Text style={styles.sectionTitle}>{t('manufacture_entries', 'Manufacture Entries')}</Text>
                            {isSearching ? (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color="#7634bc" />
                                </View>
                            ) : displayList.length > 0 ? (
                                <View>
                                    {displayList.map((se, i) => (
                                        <EntryCard
                                            key={i}
                                            id={se.name}
                                            status={se.docstatus}
                                            order_id={se.work_order}
                                            owner={se.owner}
                                            fg_qty={se.fg_completed_qty}
                                            date={se.creation?.split(' ')[0]}
                                            index={i}
                                            onPress={(id: string) =>
                                                router.push({
                                                    pathname: '/inventory/manufacture/[id]',
                                                    params: { id },
                                                })
                                            }
                                        />
                                    ))}
                                    {(page > 1 || hasMore || searchPage > 1 || searchHasMore) && (
                                        <NumberedPagination
                                            currentPageIndex={search.trim() ? searchPage : page}
                                            hasMore={search.trim() ? searchHasMore : hasMore}
                                            onNext={() => {
                                                if (search.trim()) {
                                                    const nextP = searchPage + 1;
                                                    setSearchPage(nextP);
                                                    fetchSearchResults(search, nextP);
                                                } else {
                                                    const nextP = page + 1;
                                                    setPage(nextP);
                                                    fetchEntries(nextP);
                                                }
                                            }}
                                            onPrev={() => {
                                                if (search.trim()) {
                                                    const prevP = Math.max(1, searchPage - 1);
                                                    setSearchPage(prevP);
                                                    if (prevP === 1) fetchSearchResults(search, 1);
                                                } else {
                                                    const prevP = Math.max(1, page - 1);
                                                    setPage(prevP);
                                                    if (prevP === 1) fetchEntries(1);
                                                }
                                            }}
                                        />
                                    )}
                                </View>
                            ) : (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Text style={styles.emptyText}>{t('no_matching_entries', 'No entries found')}</Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </>
            )}

            <FloatingPill
                onBackPress={() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/(tabs)');
                    }
                }}
                backIcon={<ArrowLeft size={20} color="#fff" />}
                rightLabel={t('produce', 'PRODUCE')}
                rightIcon={<Factory size={18} color="#fff" />}
                style={{ bottom: Math.max(insets.bottom + 16, 24) }}
            />

            {/* Scanner Modal */}
            <Modal transparent={true} visible={isScanning} animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsScanning(false)}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={onBarcodeScanned}
                    />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 60, right: 30, backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 25 }}
                        onPress={() => setIsScanning(false)}
                    >
                        <X size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{t('scan_stock_entry_id', 'Scan Stock Entry ID')}</Text>
                    </View>
                </View>
            </Modal>

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Manufacture (MFG)"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_stock_transfer')) {
                        router.back();
                    }
                }}
            />
        </View>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    newEntryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 24,
        height: 54,
        borderRadius: 16,
        gap: 12,
        marginBottom: 24,
        elevation: 2,
    },
    newEntryBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
        fontFamily: Fonts.rounded,
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
    greetingContainer: {
        paddingHorizontal: 24,
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

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 24,
    },

    statCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#e0e0e0',
    },

    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },

    // iconWrap: {
    //     backgroundColor: '#eef2ff',
    //     padding: 8,
    //     borderRadius: 10,
    // },
    statIconContainer: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    changeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statChange: {
        fontSize: 11,
        fontWeight: '900'
    },
    statValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },

    statTitle: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Fonts.sans,
    },

    change: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    analyticsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingHorizontal: 24,
    },
    analyticsTitleText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    analyticsSubtitleText: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Fonts.sans,
        marginTop: 2,
    },

    analyticsBox: {
        paddingHorizontal: 24,
        gap: 16,
        marginBottom: 0,
    },

    analyticsPlaceholder: {// remove
        fontSize: 12,
        color: '#94a3b8',
    },
    searchSection: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    searchContainer: {
        marginHorizontal: 16,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 46,
        gap: 8,
        elevation: 1,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingLeft: 12,
        paddingRight: 4,
        height: 52,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    dropdownResult: {
        position: 'absolute',
        top: 65,
        left: 24,
        right: 24,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#e0e0e0',
        padding: 8,
        elevation: 20,
        zIndex: 2000,
    },
    dropdownItem: {

        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc'
    },
    dropdownTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    dropdownMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    scanBtn: {
        backgroundColor: '#f1f5f9',
        padding: 6,
        borderRadius: 8,
    },

    section: {
        paddingHorizontal: 16,
        marginTop: 10,
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 16,
        color: '#0f172a',
    },
    chartsPanel: {
        paddingHorizontal: 24,
        gap: 16,
        marginBottom: 24,
    },
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        height: 250,
        justifyContent: 'center',
    },


    chartLabel: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 16,
    },
    chartWrapper: {
        flexDirection: 'row',
        height: 140,
    },
    yAxis: {
        width: 25,
        justifyContent: 'space-between',
        paddingBottom: 8,
    },
    yAxisText: {
        fontSize: 10,
        color: '#94a3b8',
        textAlign: 'right',
        paddingRight: 5,
    },
    chartMain: {
        flex: 1,
        position: 'relative',
    },
    gridLinesContainer: {
        ...StyleSheet.absoluteFill,
        bottom: 8,
        justifyContent: 'space-between',
    },
    hGridLine: {
        height: 1,
        backgroundColor: '#f1f5f9',
    },
    barChartBars: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingBottom: 2,
    },
    barContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    barTopValue: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    bar: {
        width: 16,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
    },
    xAxisWrapper: {
        flexDirection: 'row',
        marginTop: 8,
    },
    chartLabels: {
        flex: 1,
        flexDirection: 'row',
    },
    barDay: {
        fontSize: 9,
        color: '#94a3b8',
        marginTop: 8,
        fontWeight: 'bold',
    },
    plCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 8,
    },
    plCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    plCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    plId: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    plCardAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
    },
    woCard: {
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        elevation: 1,
    },

    woId: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },

    woTitle: {
        fontSize: 13,
        color: '#475569',
        marginTop: 2,
    },

    woMeta: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 6,
    },

    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#cbd5e1',
    },
    metaText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '700',
    },
    backPill: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.8,
    },
    dividerPill: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginHorizontal: 4,
    },
    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 44,
        borderRadius: 22,
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    floatingContainer: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: '#1e1b4b',
        borderRadius: 30,
        padding: 6,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.45,
        shadowRadius: 15,
        elevation: 12,
    },

    pillText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
        fontFamily: Fonts.rounded,
    },
    plOrderText: {
        fontSize: 13,
        color: '#64748b',
    },
    plCardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    listSection: {
        paddingHorizontal: 24,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
        textAlign: 'center',
        marginTop: 10,
    },
    // EntryCard Styles
    activityItem: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    activityIconContainer: { width: 48, height: 48, borderRadius: 16, overflow: 'hidden', marginRight: 16 },
    activityIconBg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    activityContent: { flex: 1 },
    activityTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
    activityTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    activitySubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    qtyBadge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 6 },
    qtyBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
    activityArrow: { marginLeft: 12 },
});