import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { formatCurrency } from '@/utils/currency';
import { useCompanyContext } from '@/context/CompanyContext';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { NotificationBell } from '@/components/NotificationBell';
import {
    Activity,
    ArrowRightLeft,
    ClipboardCheck,
    ClipboardList,
    Factory,
    LucideIcon,
    PackagePlus,
    ShoppingCart,
    Truck,
    IndianRupee,
    Zap,
    CreditCard
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    RefreshControl,
    useWindowDimensions
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { DonutChart } from '@/components/ui/PieChart';

const { width } = Dimensions.get('window');

const DeliveryDelaysChart = ({ data }: { data: { label: string, value: number, isCritical?: boolean }[] }) => {
    const { t } = useTranslation();
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const total = data.reduce((sum, d) => sum + d.value, 0);

    return (
        <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
                <Text style={styles.chartCardTitle}>{t('delivery_delays', 'Delivery Delays')}</Text>
                <Text style={styles.chartCardSubtitle}>{total} {t('total', 'total')}</Text>
            </View>
            <View style={styles.barChartContainer}>
                {data.map((item, i) => (
                    <View key={i} style={styles.barColumn}>
                        <View style={styles.barTrack}>
                            <View
                                style={[
                                    styles.barFill,
                                    {
                                        height: `${Math.max((item.value / maxVal) * 100, 5)}%`,
                                        backgroundColor: item.isCritical ? '#ef4444' : '#1e1b4b'
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.barLabel}>{item.label}</Text>
                        <Text style={styles.barValue}>{item.value}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const ActivityHeatmapChart = ({ data }: { data: { date: string, count: number }[] }) => {
    const { t } = useTranslation();
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayObj = new Date(year, month, 1);
    const lastDayObj = new Date(year, month + 1, 0);
    const daysInMonth = lastDayObj.getDate();
    const firstDayOfWeek = firstDayObj.getDay();

    const countMap: any = {};
    data.forEach(d => { countMap[d.date] = d.count; });
    const maxCount = Math.max(...data.map(d => d.count), 1);

    const weeks = [];
    let currentWeek = new Array(7).fill(null);
    for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek[i] = null;
    }
    let currentDayOfWeek = firstDayOfWeek;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        currentWeek[currentDayOfWeek] = { date: dateStr, count: countMap[dateStr] || 0 };
        currentDayOfWeek++;
        if (currentDayOfWeek === 7) {
            weeks.push(currentWeek);
            currentWeek = new Array(7).fill(null);
            currentDayOfWeek = 0;
        }
    }
    if (currentDayOfWeek > 0) {
        weeks.push(currentWeek);
    }

    const monthName = date.toLocaleString('default', { month: 'short' });

    return (
        <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
                <Text style={styles.chartCardTitle}>{t('activity_heatmap', 'Activity Heatmap')}</Text>
                <Text style={styles.chartCardSubtitle}>{monthName} {year}</Text>
            </View>
            <View style={styles.heatmapContainer}>
                <View style={styles.heatmapHeader}>
                    <View style={styles.heatmapLabelColumn} />
                    {[t('sun_short', 'S'), t('mon_short', 'M'), t('tue_short', 'T'), t('wed_short', 'W'), t('thu_short', 'T'), t('fri_short', 'F'), t('sat_short', 'S')].map((d, i) => (
                        <Text key={i} style={styles.heatmapDayText}>{d}</Text>
                    ))}
                </View>
                {weeks.map((week, wIndex) => (
                    <View key={wIndex} style={styles.heatmapRow}>
                        <View style={styles.heatmapLabelColumn}>
                            <Text style={styles.heatmapWeekText}>W{wIndex + 1}</Text>
                        </View>
                        {week.map((day, dIndex) => {
                            if (!day) return <View key={dIndex} style={styles.heatmapCellEmpty} />;

                            let opacity = 0;
                            if (day.count > 0) {
                                opacity = 0.3 + (day.count / maxCount) * 0.7;
                            }

                            return (
                                <View
                                    key={dIndex}
                                    style={[
                                        styles.heatmapCell,
                                        { backgroundColor: day.count > 0 ? `rgba(30, 27, 75, ${opacity})` : '#f1f5f9' }
                                    ]}
                                />
                            );
                        })}
                    </View>
                ))}
            </View>
            <View style={styles.heatmapLegend}>
                <Text style={styles.heatmapLegendText}>{t('less', 'Less')}</Text>
                <View style={[styles.heatmapLegendCell, { backgroundColor: '#f1f5f9' }]} />
                <View style={[styles.heatmapLegendCell, { backgroundColor: 'rgba(30, 27, 75, 0.4)' }]} />
                <View style={[styles.heatmapLegendCell, { backgroundColor: 'rgba(30, 27, 75, 0.6)' }]} />
                <View style={[styles.heatmapLegendCell, { backgroundColor: 'rgba(30, 27, 75, 0.8)' }]} />
                <View style={[styles.heatmapLegendCell, { backgroundColor: 'rgba(30, 27, 75, 1)' }]} />
                <Text style={styles.heatmapLegendText}>{t('more', 'More')}</Text>
            </View>
        </View>
    );
};

interface StatCardProps {
    title: string;
    value: string;
    index: number;
    Icon?: any;
    color?: string;
}

interface action {
    id: string;
    Icon: LucideIcon;
    label: string;
    description: string;
    color?: string;
}

const StatCard = ({ title, value, index, Icon, color }: StatCardProps) => (
    <Animated.View
        entering={FadeInDown.delay(index * 100).duration(800)}
        style={styles.statCard}
    >
        <View style={styles.statHeader}>
            <Text style={styles.statTitle}>{title}</Text>
            {Icon && (
                <View style={[styles.statIconContainer, color ? { backgroundColor: color + '15' } : undefined]}>
                    <Icon size={18} color={color || "#64748b"} />
                </View>
            )}
        </View>
        <Text style={styles.statValue}>{value}</Text>
    </Animated.View>
);

const QuickActionCard = ({ Icon, label, description, index, onPress, color }: { Icon: any, label: string, description: string, index: number, onPress?: () => void, color?: string }) => (
    <Animated.View
        entering={FadeInUp.delay(400 + (index * 100)).duration(800)}
        style={styles.actionCardWrapper}
    >
        <TouchableOpacity 
            style={styles.actionCard} 
            onPress={onPress}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel={`${label}: ${description}`}
        >
            <View style={[styles.actionIconBg, color ? { backgroundColor: color + '15' } : undefined]}>
                <Icon size={34} color={color || "#0f172a"} strokeWidth={1.5} />
            </View>
            <Text style={styles.actionLabel}>{label}</Text>
            <Text style={styles.actionDesc}>{description}</Text>
        </TouchableOpacity>
    </Animated.View>
);

export default function InventoryScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { getResource, getCurrentUserEmail, callMethod } = useFrappe(APP_CONFIG);
    const { hasPermission, refreshPermissions } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [deniedFeatureName, setDeniedFeatureName] = useState('');
    const [search, setSearch] = useState('');
    const [userInitials, setUserInitials] = useState('JD');
    const [refreshing, setRefreshing] = useState(false);
    const { defaultCurrency } = useCompanyContext();

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchStats(), refreshPermissions()]);
        setRefreshing(false);
    };

    // Local Company Filter for Charts
    const { activeCompany } = useCompanyContext();

    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);
    const [activeChartIndex, setActiveChartIndex] = useState(0);
    const chartScrollRef = React.useRef<ScrollView>(null);
    const chartNames = [t('delivery_delays', 'Delivery Delays'), t('activity_heatmap', 'Activity Heatmap'), t('stock_aging', 'Stock Aging')];
    const [delayBuckets, setDelayBuckets] = useState([
        { label: '5d', value: 12 },
        { label: '10d', value: 28 },
        { label: '20d', value: 45 },
        { label: '40d', value: 18 },
        { label: '>40d', value: 8, isCritical: true },
    ]);
    const [agingData, setAgingData] = useState([
        { label: '0-30 days', value: 45, color: 'rgba(30, 27, 75, 0.3)' }, // Lightest Heatmap Shade
        { label: '31-60 days', value: 25, color: 'rgba(30, 27, 75, 0.5)' },
        { label: '61-90 days', value: 18, color: 'rgba(30, 27, 75, 0.75)' },
        { label: '90+ days', value: 12, color: 'rgba(30, 27, 75, 1)' }, // Darkest Heatmap Shade
    ]);
    const [heatmapData, setHeatmapData] = useState<{ date: string, count: number }[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    const memoizedDelayBuckets = React.useMemo(() => delayBuckets.map(b => ({ ...b, label: t(b.label.toLowerCase().replace('>', 'gt_'), b.label) })), [delayBuckets, t]);
    const memoizedAgingData = React.useMemo(() => agingData.map(a => ({ ...a, label: t(a.label.toLowerCase().replace('-', '_').replace('+', '_plus'), a.label) })), [agingData, t]);

    const [stats, setStats] = useState([
        { title: t('pending_deliveries', 'PENDING DELIVERIES'), value: '...', Icon: Truck, color: "#3b82f6" },
        { title: t('pending_receipts', 'PENDING RECEIPTS'), value: '...', Icon: ShoppingCart, color: "#f59e0b" },
        { title: t('pending_picklists', 'PENDING PICKLISTS'), value: '...', Icon: ClipboardList, color: "#16a34a" },
        { title: t('total_stock_value', 'TOTAL STOCK VALUE'), value: '...', Icon: CreditCard, color: "#7c3aed" },
    ]);

    useEffect(() => {
        fetchUser();

        const init = async () => {
            try {
                const res = await getResource("Company", undefined, {
                    limit_page_length: 50,
                    fields: '["name"]',
                });
                if (Array.isArray(res) && res.length > 0) {


                } else {

                    fetchStats();
                }
            } catch (e) {
                fetchStats();
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (activeCompany) {
            fetchStats();

        }
    }, [activeCompany]);

    async function fetchStats() {
        const date = new Date();
        const todaysDate = new Date().toISOString().split('T')[0];
        const prevMonth = new Date();
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        const previousMonthDate = prevMonth.toISOString().split('T')[0];

        try {
            let deliveriesCount = 0;
            try {
                deliveriesCount = await callMethod('frappe.client.get_count', {
                    doctype: 'Sales Order',
                    filters: JSON.stringify([
                        ['status', 'not in', ['Completed', 'Cancelled', 'Closed']],
                        ['company', '=', activeCompany]
                    ])
                });
            } catch (e) { console.log('Err fetching Deliveries:', e); }

            let receiptsCount = 0;
            try {
                receiptsCount = await callMethod('frappe.client.get_count', {
                    doctype: 'Purchase Order',
                    filters: JSON.stringify([
                        ['status', 'not in', ['Completed', 'Cancelled', 'Closed']],
                        ['company', '=', activeCompany]
                    ])
                });
            } catch (e) { console.log('Err fetching Receipts:', e); }

            let picklistCount = 0;
            try {
                picklistCount = await callMethod('frappe.client.get_count', {
                    doctype: 'Pick List',
                    filters: JSON.stringify([
                        ['status', 'not in', ['Completed', 'Cancelled']],
                        ['company', '=', activeCompany]
                    ])
                });
            } catch (e) { console.log('Err fetching Picklists:', e); }



            try {

                //graph 1:delivery delays:
                //needs to keep  to date  :today's date ,fromDate:previous month same date  

                const reportData = await callMethod('frappe.desk.query_report.run',
                    { report_name: 'Sales Order Analysis', filters: { from_date: previousMonthDate, to_date: todaysDate, company: activeCompany }, ignore_prepared_report: 1 }
                );
                if (reportData && reportData.result) {
                    let dBuckets: any = { '5d': 0, '10d': 0, '20d': 0, '40d': 0, '>40d': 0 };
                    reportData.result.forEach((row: any) => {
                        if (row && row.sales_order && row.delay > 0) {
                            if (row.delay > 40) dBuckets['>40d']++;
                            else if (row.delay > 20) dBuckets['40d']++;
                            else if (row.delay > 10) dBuckets['20d']++;
                            else if (row.delay > 5) dBuckets['10d']++;
                            else dBuckets['5d']++;
                        }
                    });
                    setDelayBuckets([
                        { label: '5d', value: dBuckets['5d'] },
                        { label: '10d', value: dBuckets['10d'] },
                        { label: '20d', value: dBuckets['20d'] },
                        { label: '40d', value: dBuckets['40d'] },
                        { label: '>40d', value: dBuckets['>40d'], isCritical: true },
                    ]);
                }
            }
            catch (e) { console.warn("Error fetching analytics:", e); }

            //graph 2: delivery notes on the basis of posting date(for heatmap)
            try {
                const dnRes = await callMethod('frappe.client.get_list', {
                    doctype: 'Delivery Note',
                    filters: JSON.stringify([
                        ['posting_date', '>=', previousMonthDate],
                        ['posting_date', '<=', todaysDate],
                        ['company', '=', activeCompany]
                    ]),
                    fields: JSON.stringify(['posting_date']),
                    limit_page_length: 1000

                });

                if (dnRes) {
                    const heatmap: { date: string, count: number }[] = [];
                    const countMap: any = {};
                    dnRes.forEach((dn: any) => {
                        if (dn.posting_date) {
                            countMap[dn.posting_date] = (countMap[dn.posting_date] || 0) + 1;
                        }
                    });
                    for (const date in countMap) {
                        heatmap.push({ date, count: countMap[date] });
                    }
                    setHeatmapData(heatmap);
                }
            } catch (e) { console.log('Err fetching Delivery Notes:', e); }

            let totalStockValue = '0';
            try {
                const stockRes = await callMethod('frappe.desk.query_report.run',
                    { report_name: 'Stock Balance', filters: { company: activeCompany }, ignore_prepared_report: 1 });
                if (stockRes && stockRes.result && stockRes.result.length > 0) {
                    const validRows = stockRes.result.filter((r: any) => r && r.bal_val !== undefined);
                    if (validRows.length > 0) {
                        const lastFigure = validRows[validRows.length - 1].bal_val;
                        const val = parseFloat(lastFigure);
                        totalStockValue = formatCurrency(val, defaultCurrency);
                    }
                }
            } catch (e) { console.log('Err fetching stock balance:', e); }

            //graph 3 : stock ageing report 
            try {
                const todaysDate = new Date().toISOString().split('T')[0];
                const stockAgeingRes = await callMethod(
                    'frappe.desk.query_report.run',
                    {
                        report_name: 'Stock Ageing',
                        filters: {
                            company: activeCompany,
                            to_date: todaysDate,
                            range: '30,60,90,120',
                        },
                        ignore_prepared_report: 1,
                    }
                );

                const resultArr =
                    stockAgeingRes?.result ||
                    stockAgeingRes?.message?.result ||
                    [];

                let r1 = 0,
                    r2 = 0,
                    r3 = 0,
                    r4 = 0,
                    r5 = 0;

                resultArr.forEach((r: any) => {
                    // Use quantity buckets
                    r1 += Number(r.range1 || 0);
                    r2 += Number(r.range2 || 0);
                    r3 += Number(r.range3 || 0);
                    r4 += Number(r.range4 || 0);
                    r5 += Number(r.range5 || 0);
                });

                console.log('Stock Ageing Date:', todaysDate);
                console.log('Buckets:', { r1, r2, r3, r4, r5 });

                setAgingData([
                    { label: '0-30 days', value: r1, color: 'rgba(30, 27, 75, 0.3)' },
                    { label: '31-60 days', value: r2, color: 'rgba(30, 27, 75, 0.5)' },
                    { label: '61-90 days', value: r3, color: 'rgba(30, 27, 75, 0.60)' },
                    { label: '91-120 days', value: r4, color: 'rgba(30, 27, 75, 0.75)' },
                    { label: '>120 days', value: r5, color: 'rgba(30, 27, 75, 1)' },
                ]);
            } catch (e) {
                console.log('Err fetching Stock Ageing:', e);
            }
            setStats([
                { title: t('pending_deliveries', 'PENDING DELIVERIES'), value: (deliveriesCount || 0).toString(), Icon: Truck, color: "#3b82f6" },
                { title: t('pending_receipts', 'PENDING RECEIPTS'), value: (receiptsCount || 0).toString(), Icon: ShoppingCart, color: "#f59e0b" },
                { title: t('pending_picklists', 'PENDING PICKLISTS'), value: (picklistCount || 0).toString(), Icon: ClipboardList, color: "#16a34a" },
                { title: t('total_stock_value', 'TOTAL STOCK VALUE'), value: totalStockValue, Icon: CreditCard, color: "#7c3aed" },
            ]);
        } catch (error) {
            console.error('[Inventory] Failed to fetch live stats:', error);
        }
    };

    async function fetchUser() {
        try {
            const email = await getCurrentUserEmail();
            if (email && email !== 'Guest') {
                const nameParts = email.split('@')[0].split('.');
                const initials = nameParts.length > 1
                    ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                    : nameParts[0].substring(0, 2).toUpperCase();
                setUserInitials(initials);
            }
        } catch (e) { }
    };

    function quickAction(action: action) {
        if (action.id === 'receive') {
            if (!hasPermission('can_receive')) {
                setDeniedFeatureName(t('receive_goods', 'Receive Goods'));
                setDeniedModalVisible(true);
                return;
            }
            router.push('/inventory/receive');
        } else if (action.id === 'dispatch') {
            if (!hasPermission('can_ship') && !hasPermission('can_pack')) {
                setDeniedFeatureName(t('dispatch_goods', 'Dispatch'));
                setDeniedModalVisible(true);
                return;
            }
            router.push('/inventory/dispatch');
        } else if (action.id === 'move') {
            if (!hasPermission('can_put_away')) {
                setDeniedFeatureName(t('internal_move', 'Internal Move / Put-away'));
                setDeniedModalVisible(true);
                return;
            }
            router.push('/inventory/move');
        } else if (action.id === 'picklist') {
            if (!hasPermission('can_pick')) {
                setDeniedFeatureName(t('picklist', 'Picklists'));
                setDeniedModalVisible(true);
                return;
            }
            router.push('/inventory/picklist');
        } else if (action.id === 'transfer-mfg') {
            if (!hasPermission('can_stock_transfer')) {
                setDeniedFeatureName(t('transfer_mfg', 'Transfer for Manufacturing'));
                setDeniedModalVisible(true);
                return;
            }
            router.push('/inventory/transfer-mfg');
        } else if (action.id === 'consumption') {
            if (!hasPermission('can_stock_transfer')) {
                setDeniedFeatureName(t('consumption', 'Material Consumption'));
                setDeniedModalVisible(true);
                return;
            }
            router.push('/inventory/consumption-mfg');
        } else if (action.id === 'manufacture') {
            if (!hasPermission('can_stock_transfer')) {
                setDeniedFeatureName(t('manufacture', 'Manufacture'));
                setDeniedModalVisible(true);
                return;
            }
            router.push('/inventory/manufacture-mfg');
        }
    }

    const quickActions = [
        { id: 'receive', Icon: PackagePlus, label: t('receive_action', 'Receive'), description: t('receive_desc', 'Inbound stock from suppliers and vendors'), color: '#16a34a' },
        { id: 'dispatch', Icon: Truck, label: t('dispatch_action', 'Dispatch'), description: t('dispatch_desc', 'Outbound deliveries to customers'), color: '#3b82f6' },
        { id: 'move', Icon: ArrowRightLeft, label: t('move_action', 'Internal Move'), description: t('move_desc', 'Transfer warehouse locations'), color: '#8b5cf6' },
        { id: 'picklist', Icon: ClipboardCheck, label: t('picklist_action', 'Picklist'), description: t('picklist_desc', 'Order picking operations'), color: '#f59e0b' },
        { id: 'transfer-mfg', Icon: Factory, label: t('transfer_mfg_action', 'Transfer for MFG'), description: t('transfer_mfg_desc', 'Send materials to manufacturing'), color: '#ec4899' },
        { id: 'consumption', Icon: Zap, label: t('consumption_action', 'Consumption'), description: t('consumption_desc', 'Track material usage'), color: '#ef4444' },
        { id: 'manufacture', Icon: Activity, label: t('manufacture_action', 'Manufacture'), description: t('manufacture_desc', 'Record finished goods entry'), color: '#14b8a6' },];

    return (
        <View style={styles.container}>
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

            <View style={[styles.headerTopBar, { paddingTop: Math.max(insets.top, 20) }]}>
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

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
            >


                <View style={styles.mainContent}>
                    <View style={styles.statsGrid}>
                        {stats.map((stat, i) => (
                            <StatCard key={i} {...stat} index={i} />
                        ))}
                    </View>

                    {/* Top Header for Charts (Filter + Tabs) */}
                    <View style={{ zIndex: 1, marginBottom: 15, marginTop: 10 }}>
                        <View style={styles.analyticsHeaderRow}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={styles.analyticsTitleText}>{t('analytics_charts', 'Analytics & Charts')}</Text>
                                <Text style={styles.analyticsSubtitleText}>{t('key_inventory_metrics', 'Key inventory metrics')}</Text>
                            </View>

                            {/* Local Company Picker Chip */}

                        </View>

                        {/* Horizontal Chart Tabs */}
                        <View style={styles.chartTabsContainer}>
                            {chartNames.map((name, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.chartTab, activeChartIndex === idx ? styles.chartTabActive : undefined]}
                                    onPress={() => {
                                        setActiveChartIndex(idx);
                                        chartScrollRef.current?.scrollTo({ x: idx * (width - 30), animated: true }); // width - 30 for horizontal padding
                                    }}
                                >
                                    <Text style={[styles.chartTabText, activeChartIndex === idx ? styles.chartTabTextActive : undefined]}>{name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <Animated.View entering={FadeInUp} style={styles.analyticsContainer}>
                        {loadingAnalytics ? (
                            <ActivityIndicator size="small" color="#0f172a" style={{ marginVertical: 20 }} />
                        ) : (
                            <>
                                <ScrollView
                                    ref={chartScrollRef}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    onMomentumScrollEnd={(e) => {
                                        const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 30));
                                        setActiveChartIndex(newIndex);
                                    }}
                                >
                                    {/* Chart 1: Delivery Delays */}
                                    <View style={{ width: width - 30, paddingHorizontal: 2 }}>
                                        <DeliveryDelaysChart data={memoizedDelayBuckets} />
                                    </View>

                                    {/* Chart 2: Activity Heatmap */}
                                    <View style={{ width: width - 30, paddingHorizontal: 2 }}>
                                        <ActivityHeatmapChart data={heatmapData} />
                                    </View>

                                    {/* Chart 3: Stock Aging */}
                                    <View style={{ width: width - 30 }}>
                                        <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                            <View style={styles.chartHeaderRow}>
                                                <Text style={styles.chartCardTitle}>{t('stock_aging', 'Stock Aging')}</Text>
                                                <Text style={styles.chartCardSubtitle}>{t('distribution', 'Distribution')}</Text>
                                            </View>
                                            <View style={{ width: '100%', paddingHorizontal: 4 }}>
                                                <DonutChart data={memoizedAgingData} size={120} strokeWidth={20} />
                                            </View>
                                        </View>
                                    </View>
                                </ScrollView>

                                {/* Pagination Dots */}
                                <View style={styles.paginationContainer}>
                                    {chartNames.map((_, idx) => (
                                        <View
                                            key={idx}
                                            style={[
                                                styles.paginationDot,
                                                activeChartIndex === idx ? styles.paginationDotActive : null
                                            ]}
                                        />
                                    ))}
                                </View>
                            </>
                        )}
                    </Animated.View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('quick_actions', 'Quick Actions')}</Text>
                    </View>

                    <View style={styles.actionsGrid}>
                        {quickActions.map((action, i) => (
                            <QuickActionCard
                                key={i}
                                {...action}
                                index={i}
                                onPress={() => {
                                    quickAction(action)
                                }}
                                color={action.color}
                            />
                        ))}
                    </View>
                </View>
            </ScrollView>

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
        height: 250,
        zIndex: 0,
    },
    headerTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 20,
        zIndex: 10,
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
        backgroundColor: '#1e1b4b15',
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
        // borderWidth: 2,
        // borderColor: '#1e293b',
    },
    profileBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1e1b4b15',
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
    pageTitleContainer: {
        alignItems: 'center',
        marginTop: 25,
        marginBottom: 15,
    },
    pageTitleDark: {
        fontSize: 26,
        fontWeight: '900',
        color: '#4c1d95',
        fontFamily: Fonts.sans,
    },
    mainContent: {
        paddingHorizontal: 15,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 5,
        justifyContent: 'space-between',
    },
    statCard: {
        width: (width - 45) / 2,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    statTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b',
        letterSpacing: 0.5,
        fontFamily: Fonts.sans,
        flex: 1,
        marginRight: 8,
    },
    statIconContainer: {
        padding: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    analyticsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 18,
        borderRadius: 24,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        shadowColor: '#2d4171',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
    },
    analyticsHeaderTitle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    filterChipText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#475569',
        marginRight: 4,
        maxWidth: 100,
    },
    floatingMenu: {
        position: 'absolute',
        top: 35,
        right: 0,
        width: 180,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        zIndex: 1000,
        overflow: 'hidden',
    },
    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    menuItemActive: {
        backgroundColor: '#f1f5f9',
    },
    menuItemText: {
        fontSize: 12,
        color: '#475569',
    },
    menuItemTextActive: {
        fontWeight: 'bold',
        color: '#0f172a',
    },
    analyticsContainer: {
        marginBottom: 20,
    },
    analyticsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingHorizontal: 4,
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
    chartTabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    chartTab: {
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    chartTabActive: {
        borderBottomColor: '#4f46e5',
    },
    chartTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    chartTabTextActive: {
        color: '#0f172a',
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
        gap: 6,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e2e8f0',
    },
    paginationDotActive: {
        backgroundColor: '#4f46e5',
        width: 24,
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
    chartHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    chartCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    chartCardSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
    },
    barChartContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 150,
        paddingHorizontal: 10,
    },
    barColumn: {
        alignItems: 'center',
        width: 40,
    },
    barTrack: {
        height: 90,
        width: 34,
        justifyContent: 'flex-end',
        marginBottom: 10,
    },
    barFill: {
        width: '100%',
        borderRadius: 6,
    },
    barLabel: {
        fontSize: 11,
        color: '#64748b',
        fontFamily: Fonts.sans,
        marginBottom: 6,
    },
    barValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    heatmapContainer: {
        paddingTop: 10,
    },
    heatmapHeader: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    heatmapLabelColumn: {
        width: 30,
        justifyContent: 'center',
    },
    heatmapDayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
    },
    heatmapRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    heatmapWeekText: {
        fontSize: 10,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
    },
    heatmapCell: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: 8,
        marginHorizontal: 4,
    },
    heatmapCellEmpty: {
        flex: 1,
        aspectRatio: 1,
        marginHorizontal: 4,
    },
    heatmapLegend: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 15,
        gap: 6,
    },
    heatmapLegendText: {
        fontSize: 10,
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    heatmapLegendCell: {
        width: 14,
        height: 14,
        borderRadius: 4,
    },
    sectionHeader: {
        marginBottom: 20,
        paddingLeft: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    actionCardWrapper: {
        width: (width - 45) / 2,
        marginBottom: 15,
    },
    actionCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
        height: 190,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
    },
    actionIconBg: {
        width: 64,
        height: 64,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    actionLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
        fontFamily: Fonts.sans,
    },
    actionDesc: {
        fontSize: 9,
        color: '#64748b',
        textAlign: 'center',
        fontFamily: Fonts.sans,
        lineHeight: 12,
    },
});
