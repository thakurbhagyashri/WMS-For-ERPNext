import { FloatingPill } from '@/components/FloatingPill';
import { NotificationBell } from '@/components/NotificationBell';
import { StatCard } from '@/components/StatCards';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
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
    ClipboardList,
    Clock,
    Factory,
    FileText,
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
    Dimensions,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const WorkOrderCard = ({ id, status, order_id, items, owner, date, index, onPress }: any) => {
    const [isHeld, setIsHeld] = React.useState(false);
    return (
        <TouchableOpacity
            onPress={() => onPress?.(id)}
            onLongPress={() => Alert.alert('Full ID / Number', id)}
            onPressIn={() => setIsHeld(true)}
            onPressOut={() => setIsHeld(false)}
            delayLongPress={200}
        >
            <Animated.View
                entering={FadeInDown.delay(200 + index * 100).duration(800)}
                style={styles.plCard}
            >
                <View style={styles.plCardHeader}>
                    <View style={[styles.plCardLeft, { flexShrink: 1, marginRight: 8, flexWrap: isHeld ? 'wrap' : 'nowrap' }]}>
                        <ClipboardList size={18} color="#0f172a" />
                        <Text style={[styles.plId, { flexShrink: isHeld ? 0 : 1 }]} numberOfLines={isHeld ? undefined : 1}>{id}</Text>
                    </View>
                    {status && (
                        <View style={{ backgroundColor: status === 'Submitted' ? '#ecfdf5' : '#fffbeb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: status === 'Submitted' ? 0 : 1, borderColor: status === 'Submitted' ? 'transparent' : '#fde68a' }}>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: status === 'Submitted' ? '#10b981' : '#b45309' }}>{status}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.plCardAction}>
                    <FileText size={14} color="#64748b" />
                    <Text style={styles.plOrderText}>{order_id || 'No Linked Order'}</Text>
                </View>
                <View style={styles.plCardMeta}>
                    <View style={styles.metaItem}>
                        <View style={styles.metaDot} />
                        <Text style={styles.metaText}>{items} items</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <User size={12} color="#94a3b8" />
                        <Text style={styles.metaText}>{owner}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Calendar size={12} color="#94a3b8" />
                        <Text style={styles.metaText}>{date}</Text>
                    </View>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};


export default function TransferMFGScreen() {
    const { t } = useTranslation();
    const router = useRouter();
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
    useEffect(() => {

    })

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
        consumed: 0,
        exceptions: 0,
    });

    const [pendingEntries, setPendingEntries] = useState<any[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'All' | 'Draft' | 'Submitted'>('All');

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchLatestworkOrders();
        setRefreshing(false);
    };

    useEffect(() => {
        if (activeCompany) {
            fetchLatestworkOrders();
        }
    }, [activeCompany, activeTab]);


    const stats = [
        { title: 'Pending WOs', value: statCounts.pending.toString(), change: 0, isPositive: false, Icon: Factory, color: '#d97706' },
        { title: 'In Progress', value: statCounts.inProgress.toString(), change: 0, isPositive: true, Icon: Clock, color: '#3b82f6' },
        { title: 'Completed', value: statCounts.completedToday.toString(), change: 0, isPositive: true, Icon: CheckCircle2, color: '#16a34a' },
        { title: 'Consumed', value: statCounts.consumed.toString(), change: 0, isPositive: true, Icon: Package, color: '#f97316' },
    ];


    const handleSearch = (q: string) => {
        setSearch(q);
        if (q.length < 2) {
            setSearchResult([]);
            setShowSearchDropdown(false);
            return;
        }
    };

    // Debounce search effect
    useEffect(() => {
        if (search.length < 2 || !activeCompany) return;

        const timer = setTimeout(async () => {
            setIsSearching(true);
            setShowSearchDropdown(true);
            try {
                const results = await getResource('Stock Entry', undefined, {
                    filters: JSON.stringify([
                        ['stock_entry_type', '=', 'Material Consumption for Manufacture'],
                        ['docstatus', '<', 2],
                        ['company', '=', activeCompany]
                    ]),
                    or_filters: JSON.stringify([
                        ['name', 'like', `%${search}%`],
                        ['work_order', 'like', `%${search}%`]
                    ]),
                    fields: '["name", "docstatus", "creation", "work_order"]',
                    limit_page_length: 50
                });
                setSearchResult(results || []);
            } catch (err) {
                console.warn('Search error:', err);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [search, activeCompany]);

    const handleDirectOpen = async (seId: string) => {
        if (!seId.trim()) return;
        setIsSearching(true);
        try {
            const data = await getResource('Stock Entry', seId.trim());
            if (data && data.name && data.stock_entry_type === 'Material Consumption for Manufacture' && data.docstatus < 2 && data.company === activeCompany) {
                setSearch(data.name);
                setShowSearchDropdown(false);
                router.push({
                    pathname: '/inventory/consumption/[id]',
                    params: { id: data.name }
                });
                return;
            }
        } catch (err) {
            console.log('Direct fetch by name failed, trying filter query', err);
        }

        try {
            const results = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify([
                    ['name', '=', seId.trim()],
                    ['stock_entry_type', '=', 'Material Consumption for Manufacture'],
                    ['docstatus', '<', 2],
                    ['company', '=', activeCompany]
                ]),
                fields: '["name"]',
                limit_page_length: 1
            });

            if (results && results.length > 0) {
                const foundName = results[0].name;
                setSearch(foundName);
                setShowSearchDropdown(false);
                router.push({
                    pathname: '/inventory/consumption/[id]',
                    params: { id: foundName }
                });
                return;
            }
        } catch (err) {
            console.error('Filter query search failed', err);
        }

        setIsSearching(false);
        setShowSearchDropdown(true);
        setSearchResult([]);
        Alert.alert(
            t('stock_entry_not_found', 'Stock Entry Not Found'),
            t('se_not_found_msg', `Stock Entry "${seId}" was not found.`)
        );
    };

    const onBarcodeScanned = async ({ data }: { data: string }) => {
        setIsScanning(false);
        setSearch(data.trim());
        handleDirectOpen(data.trim());
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
            const filters: any[] = [
                ['stock_entry_type', '=', 'Material Consumption for Manufacture'],
                ['company', '=', activeCompany]
            ];
            if (activeTab === 'Draft') filters.push(['docstatus', '=', 0]);
            else if (activeTab === 'Submitted') filters.push(['docstatus', '=', 1]);

            const seData = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify(filters),
                fields: '["name", "work_order", "creation", "owner", "docstatus"]',
                order_by: 'creation desc',
                limit_page_length: 10
            });
            if (seData) setPendingEntries(seData);

            //filter 1: pending Wo's
            const pendingCount = await callMethod('frappe.client.get_count', {
                doctype: 'Stock Entry',
                filters: [
                    ['stock_entry_type', '=', 'Material Consumption for Manufacture'],
                    ['docstatus', '=', 0],
                    ['company', '=', activeCompany]
                ]
            });
            //filter 2: In progress Wo's
            const inProgressCount = await callMethod('frappe.client.get_count', {
                doctype: 'Work Order',
                filters: [
                    ['status', '=', 'In Progress'],
                    ['company', '=', activeCompany]
                ]
            });
            //      filter 3: Completed Work Orders
            const today = new Date().toISOString().split('T')[0];
            const completedCount = await callMethod('frappe.client.get_count', {
                doctype: 'Work Order',
                filters: [
                    ['status', '=', 'Completed'],
                    ['modified', '>=', today],
                    ['company', '=', activeCompany]
                ]
            });
            //filter 4: Consumed
            const consumedCount = await callMethod('frappe.client.get_count', {
                doctype: 'Stock Entry',
                filters: [
                    ['stock_entry_type', '=', 'Material Consumption for Manufacture'],
                    ['docstatus', '=', 1],
                    ['posting_date', '>=', today],
                    ['company', '=', activeCompany]
                ]
            })

            setStatCounts({
                pending: pendingCount || 0,
                inProgress: inProgressCount || 0,
                completedToday: completedCount || 0,
                consumed: consumedCount || 0,
                exceptions: 0,
            })
            //chart 1: weekly trend of consumption 
            const now = new Date();
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? 6 : currentDay - 1);
            const monday = new Date(now);
            monday.setDate(now.getDate() - diffToMonday);
            monday.setHours(0, 0, 0, 0);
            const mondayStr = monday.toISOString().split('T')[0];

            const weeklyEntries = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify([
                    ['stock_entry_type', '=', 'Material Consumption for Manufacture'],
                    ['docstatus', '=', 1],
                    ['posting_date', '>=', mondayStr],
                    ['company', '=', activeCompany]
                ]),
                fields: '["posting_date"]',
                limit_page_length: 1000
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
                        <Text style={styles.greetingText}>{t('consumption_for_mfg', 'Consumption for MFG')}</Text>
                        <Text style={styles.subGreetingText}>{t('consume_materials_fo', 'Consume materials for production')}</Text>
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
                                <Text style={styles.analyticsSubtitleText}>{t('consumption_metrics', 'Consumption metrics')}</Text>
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
                                                    <Text style={styles.chartLabel}>{t('weekly_transfers', 'Weekly Transfers')}</Text>
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
                            onPress={() => router.push('/inventory/consumption/new')}
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
                        <View style={[styles.searchSection, { zIndex: showSearchDropdown ? 1000 : 1 }]}>
                            <GlobalSearchInput
                                placeholder="Search by ID or Work Order..."
                                value={search}
                                onChangeText={handleSearch}
                                onSubmitEditing={() => handleDirectOpen(search)}
                                onScan={requestScanner}
                            />

                            {/* Dropdown */}
                            {showSearchDropdown && (
                                <View style={styles.dropdownResult}>
                                    {isSearching ? (
                                        <View style={{ padding: 20, alignItems: 'center' }}>
                                            <ActivityIndicator size="small" color="#0f172a" />
                                        </View>
                                    ) : searchResult.length > 0 ? (
                                        <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                                            {searchResult.map((pl, i) => (
                                                <TouchableOpacity
                                                    key={i}
                                                    style={styles.dropdownItem}
                                                    onPress={() => {
                                                        setShowSearchDropdown(false);
                                                        router.push({
                                                            pathname: '/inventory/consumption/[id]',
                                                            params: { id: pl.name }
                                                        });
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <View style={{ flex: 1, marginRight: 12 }}>
                                                            <Text style={styles.dropdownTitle}>{pl.name}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                                <Factory size={10} color="#94a3b8" />
                                                                <Text style={styles.dropdownMeta} numberOfLines={1}>{pl.work_order || 'Individual Transfer'}</Text>
                                                            </View>
                                                            <Text style={[styles.dropdownMeta, { fontSize: 10 }]}>{pl.creation?.split(' ')[0]}</Text>
                                                        </View>
                                                        <View style={[
                                                            styles.statusBadge,
                                                            { backgroundColor: pl.docstatus === 1 ? '#ecfdf5' : '#fffbeb', borderWidth: pl.docstatus === 1 ? 0 : 1, borderColor: pl.docstatus === 1 ? 'transparent' : '#fde68a' }
                                                        ]}>
                                                            <Text style={[
                                                                styles.statusText,
                                                                { color: pl.docstatus === 1 ? '#10b981' : '#b45309' }
                                                            ]}>
                                                                {pl.docstatus === 1 ? 'Submitted' : 'Draft'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    ) : (
                                        <View style={{ padding: 20, alignItems: 'center' }}>
                                            <Text style={styles.emptyText}>{t('no_matching_transfer', 'No matching transfers found')}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Filter Bar */}
                        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 20, zIndex: 0 }}>
                            {['All', 'Draft', 'Submitted'].map((filter) => (
                                <TouchableOpacity
                                    key={filter}
                                    onPress={() => setActiveTab(filter as any)}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 20,
                                        backgroundColor: activeTab === filter ? '#7634bc' : '#f1f5f9',
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 13,
                                        fontWeight: 'bold',
                                        color: activeTab === filter ? '#fff' : '#64748b'
                                    }}>{filter}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.listSection}>
                            <Text style={styles.sectionTitle}>{t('recent_entries', 'Recent Entries')}</Text>
                            {pendingEntries.length > 0 ? pendingEntries.map((se, i) => (
                                <WorkOrderCard
                                    key={i}
                                    id={se.name}
                                    status={se.docstatus === 1 ? 'Submitted' : 'Draft'}
                                    order_id={se.work_order}
                                    owner={se.owner}
                                    items={'-'}
                                    date={se.creation?.split(' ')[0]}
                                    index={i}
                                    onPress={(id: string) =>
                                        router.push({
                                            pathname: '/inventory/consumption/[id]',
                                            params: { id },
                                        })
                                    }
                                />
                            )) : (
                                <View style={{ padding: 32, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                                        <ClipboardList size={28} color="#94a3b8" />
                                    </View>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a', fontFamily: Fonts.rounded, marginBottom: 8 }}>{t('no_entries_found', 'No Entries Found')}</Text>
                                    <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
                                        {activeTab === 'All' ? t('no_entries_found_all', "No consumption entries found for this company.") : activeTab === 'Draft' ? t('no_draft_entries', "You don't have any pending draft consumption entries.") : t('no_submitted_entries', "No submitted consumption entries found for this company.")}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </>
            )}

            <FloatingPill
                onBackPress={() => router.back()}
                backIcon={<ArrowLeft size={20} color="#fff" />}
                leftLabel={t('consume', 'CONSUME')}
                leftIcon={<Factory size={20} color='#fff' />}
                style={{ bottom: Math.max(insets.bottom + 16, 0) }}
            />

            {/* Scanner Modal */}
            <Modal visible={isScanning} animationType="slide" statusBarTranslucent onRequestClose={() => setIsScanning(false)}>
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
                featureName="Consumption (MFG)"
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
        backgroundColor: '#0f172a',
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
        width: (width - 52) / 2,
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
    plCardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
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
});