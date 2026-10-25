import { NotificationBell } from '@/components/NotificationBell';
import { StatCard } from '@/components/StatCards';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { LineChart } from '@/components/ui/LineChart';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { OrderIdPopup } from '@/components/ui/OrderIdPopup';
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { DonutChart } from '@/components/ui/PieChart';
import { Fonts } from '@/constants/theme';
import { useCompanyContext } from '@/context/CompanyContext';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { formatCurrency } from '@/utils/currency';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    ChevronRight,
    Clock,
    FileText,
    Package,
    ShoppingCart,
    Truck,
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
    useWindowDimensions,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

const { width } = Dimensions.get('window');



const SalesOrderItem = ({ id, customer, amount, date, totalItems, pendingCount, index, onPress, onLongPress }: { id: string, customer: string, amount: string, date: string, totalItems: number, pendingCount: number, index: number, onPress: () => void, onLongPress?: () => void }) => {
    const [isHeld, setIsHeld] = React.useState(false);
    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={() => setIsHeld(true)}
            onPressOut={() => setIsHeld(false)}
            delayLongPress={200}
            activeOpacity={0.9}
        >
            <Animated.View
                entering={FadeInDown.delay(100 + index * 50).duration(500)}
                style={[styles.dropdownItem, isHeld && { transform: [{ scale: 0.98 }] }]}
            >
                <View style={styles.dropdownItemHeader}>
                    <View style={[styles.idGroup, { flexShrink: 1, marginRight: 8, flexWrap: isHeld ? 'wrap' : 'nowrap' }]}>
                        <ShoppingCart size={18} color="#0f172a" style={{ marginRight: 10 }} />
                        <Text style={[styles.dropdownItemId, { flexShrink: isHeld ? 0 : 1 }]} numberOfLines={isHeld ? undefined : 1}>{id}</Text>
                    </View>
                    <Text style={styles.dropdownItemPrice}>{amount}</Text>
                </View>

                <View style={styles.detailsRow}>
                    <Text style={styles.customerText} numberOfLines={1}>{customer}</Text>
                </View>

                <View style={styles.bottomRow}>
                    <View style={[styles.statsRow, { gap: 15 }]}>
                        <View style={styles.detailItem}>
                            <Package size={14} color="#94a3b8" />
                            <Text style={styles.detailText}>{totalItems} items</Text>
                        </View>
                        <Text style={styles.pendingOrangeText}>{pendingCount} pending</Text>
                        <Text style={styles.dueDateLabel}>Due: {date}</Text>
                    </View>
                    <ChevronRight size={18} color="#94a3b8" />
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function DispatchScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const { t } = useTranslation();
    const router = useRouter();
    const { getResource, getCurrentUserEmail, callMethod } = useFrappe();
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [userInitials, setUserInitials] = useState('');

    useEffect(() => {
        if (!hasPermission('can_ship') && !hasPermission('can_pack')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const email = await getCurrentUserEmail();
                if (email && email !== 'Guest') {
                    const nameParts = email.split('@')[0].split('.');
                    const initials = nameParts.length > 1
                        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                        : nameParts[0].substring(0, 2).toUpperCase();
                    setUserInitials(initials);
                }
            } catch (e) {
                console.warn(e);
            }
        };
        fetchUser();
    }, [getCurrentUserEmail]);

    const [search, setSearch] = useState('');
    const [showAnalytics, setShowAnalytics] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [todaysDispatchCount, setTodaysDispatchCount] = useState<number>(0);
    const [pendingSOCount, setPendingSOCount] = useState<number>(0);
    const [draftDNCount, setDraftDNCount] = useState<number>(0);
    const [avgDispatchTime, setAvgDispatchTime] = useState<string>('0h');
    const [weeklyTrends, setWeeklyTrends] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [recentSO, setRecentSO] = useState<any[]>([]);
    const [regionData, setRegionData] = useState<any[]>([]);
    const [dispatcherData, setDispatcherData] = useState<any[]>([]);
    const [performance, setPerformance] = useState([
        { label: 'Week 1', onTime: 0, delayed: 0 },
        { label: 'Week 2', onTime: 0, delayed: 0 },
        { label: 'Week 3', onTime: 0, delayed: 0 },
        { label: 'Week 4', onTime: 0, delayed: 0 },
    ]);
    const [permission, requestPermission] = useCameraPermissions();

    // Local Company Filter for Charts
    const { activeCompany } = useCompanyContext();

    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [hasMoreResults, setHasMoreResults] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchPage, setSearchPage] = useState(0);
    const { defaultCurrency } = useCompanyContext();

    const [showOrderIdPopup, setShowOrderIdPopup] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [activeChartIndex, setActiveChartIndex] = useState(0);
    const chartScrollRef = React.useRef<ScrollView>(null);
    const chartNames = ['Dispatch Trends', 'Regional', 'Dispatchers', 'Performance'];
    const PAGE_SIZE = 10;
    const [soListPage, setSoListPage] = useState(1);
    const [hasMoreSO, setHasMoreSO] = useState(false);
    const [loadingMoreSO, setLoadingMoreSO] = useState(false);

    const [recentDN, setRecentDN] = useState<any[]>([]);
    const [dnListPage, setDnListPage] = useState(1);
    const [hasMoreDN, setHasMoreDN] = useState(false);
    const [loadingMoreDN, setLoadingMoreDN] = useState(false);
    const [activeListTab, setActiveListTab] = useState<'so' | 'dn'>('so');

    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const init = async () => {
            try {
                const res = await getResource("Company", undefined, {
                    limit_page_length: 50,
                    fields: '["name"]',
                });
                if (Array.isArray(res) && res.length > 0) {


                } else {

                }
            } catch (e) {

            }
        };
        init();
    }, []);

    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchStatsData();
        setRefreshing(false);
    };

    const fetchStatsData = async () => {
        if (!activeCompany) return;
        if (!refreshing) setIsLoading(true);
        //filter 1: today's dispatch!
        try {
            const today = new Date().toISOString().split('T')[0];
            const todaysSOSPromise = callMethod('frappe.client.get_count', {
                doctype: 'Sales Order',
                filters: JSON.stringify([
                    ['delivery_date', '=', today],
                    ['docstatus', '=', 1],
                    ['status', '!=', 'Closed'],
                    ['company', '=', activeCompany]
                ])
            });

            // filter : 2
            const pendingSOSPromise = callMethod('frappe.client.get_count', {
                doctype: 'Sales Order',
                filters: JSON.stringify([
                    ['status', '=', 'To Deliver and Bill'],
                    ['company', '=', activeCompany]
                ])
            });

            //filter : 3
            const draftDNSPromise = callMethod('frappe.client.get_count', {
                doctype: 'Delivery Note',
                filters: JSON.stringify([
                    ['docstatus', '=', 0],
                    ['company', '=', activeCompany]
                ])
            });

            //filter :4 Avg. Time
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            // const yesterday = yesterdayDate.toISOString().split('T')[0]
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            console.log('dates for filter 4:  today, monthStart', today, monthStart);

            const todayDispatchPromise = callMethod('frappe.desk.query_report.run', {
                report_name: 'Sales Order Analysis',
                filters: {
                    company: activeCompany,
                    from_date: monthStart,
                    to_date: today
                }
            }, false, undefined, true).catch((e: any) => {
                console.error('[Dispatch] Report Error:', e);
                return { result: [] };
            });
            console.log('todayDispatchPromise', todayDispatchPromise);

            //filter :recent sales orders list
            const recentSORawPromise = getResource('Sales Order', undefined, {
                filters: JSON.stringify([['status', '!=', 'Closed'], ['docstatus', '=', 1], ['per_delivered', '<', 100], ['company', '=', activeCompany]]),
                fields: '["name", "customer", "grand_total", "delivery_date", "modified"]',
                limit_page_length: 10,
                order_by: 'modified desc'
            });

            //filter: fetching draft delivery notes:
            const fetchDraftDNs = getResource('Delivery Note', undefined, {
                filters: JSON.stringify([['docstatus', '=', '0'], ['company', '=', activeCompany]]),
                fields: '["name"]',
                limit_page: 1000
            })
            console.log('fetchDraftDNs -->', fetchDraftDNs);

            const recentDNRawPromise = getResource('Delivery Note', undefined, {
                filters: JSON.stringify([['docstatus', '=', 0], ['company', '=', activeCompany]]),
                fields: '["name", "customer", "grand_total", "posting_date", "modified"]',
                limit_page_length: 10,
                order_by: 'modified desc'
            });

            //chart 1: trends data for current week
            const now = new Date();
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? 6 : currentDay - 1);


            const monday = new Date(now);
            monday.setDate(now.getDate() - diffToMonday);
            monday.setHours(0, 0, 0, 0);

            const y = monday.getFullYear();
            const m = String(monday.getMonth() + 1).padStart(2, '0');
            const d = String(monday.getDate()).padStart(2, '0');
            const fromDateStr = `${y}-${m}-${d}`;
            console.log('fromDate str-->', fromDateStr);

            const trendsDataPromise = getResource(
                'Delivery Note',
                undefined,
                {
                    filters: JSON.stringify([
                        ['posting_date', '>=', fromDateStr],
                        ['docstatus', '=', 1],
                        ['company', '=', activeCompany]
                    ]),
                    fields: '["name","posting_date","total_qty"]',
                    limit_page_length: 10000
                }
            );

            // chart 2:
            // Regional data for current week
            const regionPromise = getResource('Delivery Note', undefined, {
                filters: JSON.stringify([
                    ['posting_date', '>=', fromDateStr],
                    ['docstatus', '=', 1],
                    ['company', '=', activeCompany]
                ]),
                fields: '["territory", "grand_total"]',
                limit_page_length: 10000
            });
            console.log('region promise------>', regionPromise);

            //chart 3:  dispatchers data for current month
            const y_m = now.getFullYear();
            const m_m = String(now.getMonth() + 1).padStart(2, '0');
            const startOfMonth = `${y_m}-${m_m}-01`;

            const dispatchersPromise = getResource('Delivery Note', undefined, {
                filters: JSON.stringify([
                    ['posting_date', '>=', startOfMonth],
                    ['docstatus', '=', 1],
                    ['company', '=', activeCompany]
                ]),
                fields: '["owner"]',
                limit_page_length: 5000
            });
            console.log('date data for the performance chart ->', today, startOfMonth,);

            //chart 4 : performance chart data for the current month 
            const dispatchPerformancePromise = getResource('Sales Order', undefined, {
                filters: JSON.stringify([
                    ['delivery_date', '>=', monthStart],
                    ['company', '=', activeCompany],
                    ['status', 'in', ['Completed', 'To Bill', 'Delivered']]
                ]),
                fields: '["name", "delivery_date", "modified"]',
                limit_page_length: 1000
            });

            const [todaysSOS, pendingSOS, draftDNs, trendsData, regionDNs, dispatchPerformance, dispatchersData, recentSORaw, avgTimeDataRaw, recentDNRaw] = await Promise.all([
                todaysSOSPromise,
                pendingSOSPromise,
                draftDNSPromise,
                trendsDataPromise,
                regionPromise,
                dispatchPerformancePromise,
                dispatchersPromise,
                recentSORawPromise,
                todayDispatchPromise,
                recentDNRawPromise
            ]);

            console.log('ACTUAL RESOLVED TRENDS DATA:', trendsData);

            if (todaysSOS !== undefined) setTodaysDispatchCount(typeof todaysSOS === 'object' ? (todaysSOS?.message ?? todaysSOS?.data ?? 0) : todaysSOS);
            if (pendingSOS !== undefined) setPendingSOCount(typeof pendingSOS === 'object' ? (pendingSOS?.message ?? pendingSOS?.data ?? 0) : pendingSOS);
            if (draftDNs !== undefined) setDraftDNCount(typeof draftDNs === 'object' ? (draftDNs?.message ?? draftDNs?.data ?? 0) : draftDNs);

            if (avgTimeDataRaw && avgTimeDataRaw.result) {
                let totalHours = 0;
                let count = 0;
                const rows = Array.isArray(avgTimeDataRaw.result) ? avgTimeDataRaw.result : [];
                rows.forEach((row: any) => {
                    if (row.transaction_date && row.delivery_date) {
                        const tDate = new Date(row.transaction_date).getTime();
                        const dDate = new Date(row.delivery_date).getTime();
                        if (!isNaN(tDate) && !isNaN(dDate)) {
                            const diffMs = Math.abs(dDate - tDate);
                            totalHours += diffMs / (1000 * 60 * 60);
                            count++;
                        }
                    }
                });
                if (count > 0) {
                    const avg = totalHours / count;
                    if (avg > 24) {
                        setAvgDispatchTime((avg / 24).toFixed(1) + 'd');
                    } else {
                        setAvgDispatchTime(avg.toFixed(1) + 'h');
                    }
                }
            }
            //chart 1: trends data for current week
            if (Array.isArray(trendsData)) {
                const newTrends = [0, 0, 0, 0, 0, 0, 0];
                trendsData.forEach((dn: any) => {
                    if (dn.posting_date) {
                        const [yr, mo, da] = dn.posting_date.substring(0, 10).split('-').map(Number);
                        const recordDate = new Date(yr, mo - 1, da);

                        const day = recordDate.getDay(); // 0 is Sun, 1 is Mon
                        const index = (day === 0 ? 6 : day - 1); // map to 0=Mon, ..., 6=Sun

                        if (index >= 0 && index < 7) {
                            // Add the total_qty of items dispatched, fallback to 1 if missing
                            newTrends[index] += (Number(dn.total_qty) || 1);
                        }
                    }
                });
                setWeeklyTrends(newTrends);
            }
            if (Array.isArray(recentSORaw)) {
                const soNames = recentSORaw.map((so: any) => so.name);
                let itemsData: any[] = [];
                try {
                    const docs = await Promise.all(soNames.map((name: string) => getResource('Sales Order', name)));
                    docs.forEach((doc: any, idx: number) => {
                        const soItems = (doc.items || []).map((item: any) => ({
                            parent: doc.name || soNames[idx],
                            qty: item.qty,
                            delivered_qty: item.delivered_qty
                        }));
                        itemsData.push(...soItems);
                    });
                } catch (e) {
                    console.error('[Dispatch] Error fetching recent SO items:', e);
                }

                const soItemStats = soNames.reduce((acc: any, name: string) => {
                    const soItems = itemsData?.filter((item: any) => item.parent === name) || [];
                    acc[name] = {
                        totalItems: soItems.length,
                        pendingLines: soItems.filter((item: any) => (Number(item.qty) - Number(item.delivered_qty)) > 0).length
                    };
                    return acc;
                }, {});

                const formatted = recentSORaw.map((so: any) => ({
                    id: so.name,
                    customer: so.customer,
                    amount: formatCurrency(Number(so.grand_total), so.currency || defaultCurrency),
                    date: so.delivery_date,
                    totalItems: soItemStats[so.name].totalItems,
                    pendingCount: soItemStats[so.name].pendingLines,
                }));
                setRecentSO(formatted);
                setHasMoreSO(recentSORaw.length === PAGE_SIZE);
            }

            if (Array.isArray(recentDNRaw)) {
                const dnNames = recentDNRaw.map((dn: any) => dn.name);
                let itemsData: any[] = [];
                try {
                    const docs = await Promise.all(dnNames.map((name: string) => getResource('Delivery Note', name)));
                    docs.forEach((doc: any, idx: number) => {
                        const dnItems = (doc.items || []).map((item: any) => ({
                            parent: doc.name || dnNames[idx],
                            qty: item.qty
                        }));
                        itemsData.push(...dnItems);
                    });
                } catch (e) {
                    console.error('[Dispatch] Error fetching recent DN items:', e);
                }

                const dnItemStats = dnNames.reduce((acc: any, name: string) => {
                    const dnItems = itemsData?.filter((item: any) => item.parent === name) || [];
                    acc[name] = {
                        totalItems: dnItems.length,
                        pendingLines: 0
                    };
                    return acc;
                }, {});

                const formatted = recentDNRaw.map((dn: any) => ({
                    id: dn.name,
                    customer: dn.customer,
                    amount: formatCurrency(Number(dn.grand_total), dn.currency || defaultCurrency),
                    date: dn.posting_date,
                    totalItems: dnItemStats[dn.name].totalItems,
                    pendingCount: 0,
                }));
                setRecentDN(formatted);
                setHasMoreDN(recentDNRaw.length === PAGE_SIZE);
            }

            // chart 2 :rocess Region Chart Data
            if (Array.isArray(regionDNs)) {
                const territoryAgg: Record<string, number> = {};
                regionDNs.forEach((dn: any) => {
                    const t = dn.territory || 'Unassigned';
                    territoryAgg[t] = (territoryAgg[t] || 0) + Number(dn.grand_total || 0);
                });

                const totalValue = Object.values(territoryAgg).reduce((a, b) => a + Number(b), 0);
                const colors = ['rgba(30, 27, 75, 1)', 'rgba(30, 27, 75, 0.75)', 'rgba(30, 27, 75, 0.5)', 'rgba(30, 27, 75, 0.3)', 'rgba(30, 27, 75, 0.15)'];

                const formattedRegionData = Object.entries(territoryAgg)
                    .map(([name, value], idx) => ({
                        name,
                        p: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0,
                        color: colors[idx % colors.length]
                    }))
                    .filter(item => item.p > 0)
                    .sort((a, b) => b.p - a.p)
                    .slice(0, 5);


                setRegionData(formattedRegionData);
            }

            // chart 3 :  Dispatcher Chart Data
            if (Array.isArray(dispatchersData)) {
                const counts: Record<string, number> = {};
                dispatchersData.forEach((dn: any) => {
                    const owner = dn.owner || 'Unknown';
                    counts[owner] = (counts[owner] || 0) + 1;
                });

                const formatted = Object.entries(counts)
                    .map(([owner, val]) => {
                        const namePart = owner.split('@')[0];
                        const parts = namePart.split(/[._]/);
                        let formattedName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                        if (parts.length > 1) {
                            formattedName += ' ' + parts[1].charAt(0).toUpperCase() + '.';
                        }
                        return { name: formattedName, val };
                    })
                    .sort((a, b) => b.val - a.val)
                    .slice(0, 5);

                setDispatcherData(formatted);
            }

            // chart 4 : Performance Chart Data 
            if (Array.isArray(dispatchPerformance)) {
                const weeklyStats = [
                    { onTime: 0, delayed: 0, total: 0 },
                    { onTime: 0, delayed: 0, total: 0 },
                    { onTime: 0, delayed: 0, total: 0 },
                    { onTime: 0, delayed: 0, total: 0 }
                ];

                dispatchPerformance.forEach((so: any) => {
                    if (so.delivery_date && so.modified) {
                        const delDate = new Date(so.delivery_date);
                        const modDate = new Date(so.modified);
                        const dayOfMonth = modDate.getDate();

                        let weekIndex = Math.floor((dayOfMonth - 1) / 7);
                        if (weekIndex > 3) weekIndex = 3;

                        if (modDate > delDate) {
                            weeklyStats[weekIndex].delayed += 1;
                        } else {
                            weeklyStats[weekIndex].onTime += 1;
                        }
                        weeklyStats[weekIndex].total += 1;
                    }
                });

                const finalData = weeklyStats.map((week, idx) => ({
                    label: `Week ${idx + 1}`,
                    onTime: week.total > 0 ? Math.round((week.onTime / week.total) * 100) : 0,
                    delayed: week.total > 0 ? Math.round((week.delayed / week.total) * 100) : 0
                }));
                setPerformance(finalData);
            }
        } catch (error) {
            console.error('[Dispatch] Failed to fetch stats counts:', error);
        } finally {
            if (!refreshing) setIsLoading(false);
        }
    };

    const fetchMoreSalesOrders = async (nextPage: number) => {
        try {
            setLoadingMoreSO(true);
            const data = await getResource('Sales Order', undefined, {
                filters: JSON.stringify([['status', '!=', 'Closed'], ['docstatus', '=', 1], ['per_delivered', '<', 100], ['company', '=', activeCompany]]),
                fields: '["name", "customer", "grand_total", "delivery_date", "modified"]',
                limit_start: (nextPage - 1) * PAGE_SIZE,
                limit_page_length: PAGE_SIZE,
                order_by: 'modified desc'
            });

            if (data && data.length > 0) {
                const soNames = data.map((so: any) => so.name);
                let itemsData: any[] = [];
                try {
                    const docs = await Promise.all(soNames.map((name: string) => getResource('Sales Order', name)));
                    docs.forEach((doc: any, idx: number) => {
                        const soItems = (doc.items || []).map((item: any) => ({
                            parent: doc.name || soNames[idx],
                            qty: item.qty,
                            delivered_qty: item.delivered_qty
                        }));
                        itemsData.push(...soItems);
                    });
                } catch (e) {
                    console.error('[Dispatch] Error fetching SO items details:', e);
                }

                const soItemStats = soNames.reduce((acc: any, name: string) => {
                    const soItems = itemsData?.filter((item: any) => item.parent === name) || [];
                    acc[name] = {
                        totalItems: soItems.length,
                        pendingLines: soItems.filter((item: any) => (Number(item.qty) - Number(item.delivered_qty)) > 0).length
                    };
                    return acc;
                }, {});

                const formatted = data.map((so: any) => ({
                    id: so.name,
                    customer: so.customer,
                    amount: formatCurrency(Number(so.grand_total), so.currency || defaultCurrency),
                    date: so.delivery_date,
                    totalItems: soItemStats[so.name].totalItems,
                    pendingCount: soItemStats[so.name].pendingLines,
                }));
                setRecentSO(formatted);
                setHasMoreSO(data.length === PAGE_SIZE);
                setSoListPage(nextPage);
            } else {
                setHasMoreSO(false);
                if (nextPage === 1) {
                    setRecentSO([]);
                }
            }
        } catch (e) {
            console.error('[Dispatch] Fetch More SO Error:', e);
        } finally {
            setLoadingMoreSO(false);

        }
    };

    const fetchMoreDeliveryNotes = async (nextPage: number) => {
        try {
            setLoadingMoreDN(true);
            const data = await getResource('Delivery Note', undefined, {
                filters: JSON.stringify([['docstatus', '=', 0], ['company', '=', activeCompany]]),
                fields: '["name", "customer", "grand_total", "posting_date", "modified"]',
                limit_start: (nextPage - 1) * PAGE_SIZE,
                limit_page_length: PAGE_SIZE,
                order_by: 'modified desc'
            });

            if (data && data.length > 0) {
                const dnNames = data.map((dn: any) => dn.name);
                let itemsData: any[] = [];
                try {
                    const docs = await Promise.all(dnNames.map((name: string) => getResource('Delivery Note', name)));
                    docs.forEach((doc: any, idx: number) => {
                        const dnItems = (doc.items || []).map((item: any) => ({
                            parent: doc.name || dnNames[idx],
                            qty: item.qty
                        }));
                        itemsData.push(...dnItems);
                    });
                } catch (e) {
                    console.error('[Dispatch] Error fetching DN items details:', e);
                }

                const dnItemStats = dnNames.reduce((acc: any, name: string) => {
                    const dnItems = itemsData?.filter((item: any) => item.parent === name) || [];
                    acc[name] = {
                        totalItems: dnItems.length,
                        pendingLines: 0
                    };
                    return acc;
                }, {});

                const formatted = data.map((dn: any) => ({
                    id: dn.name,
                    customer: dn.customer,
                    amount: formatCurrency(Number(dn.grand_total), dn.currency || defaultCurrency),
                    date: dn.posting_date,
                    totalItems: dnItemStats[dn.name].totalItems,
                    pendingCount: 0,
                }));
                setRecentDN(formatted);
                setHasMoreDN(data.length === PAGE_SIZE);
                setDnListPage(nextPage);
            } else {
                setHasMoreDN(false);
                if (nextPage === 1) {
                    setRecentDN([]);
                }
            }
        } catch (e) {
            console.error('[Dispatch] Fetch More DN Error:', e);
        } finally {
            setLoadingMoreDN(false);
        }
    };

    useEffect(() => {
        fetchStatsData();
    }, [activeCompany]);

    useEffect(() => {
        if (search.trim().length > 0) {
            const delayDebounceFn = setTimeout(() => {
                handleSearch(0);
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setShowDropdown(false);
            setSearchResults([]);
        }
    }, [search]);

    async function handleSearch(pageIndex = 0) {
        try {
            if (pageIndex === 0) setIsSearching(true);

            const data = await getResource('Sales Order', undefined, {
                filters: JSON.stringify([
                    ['name', 'like', `%${search}%`],
                    ['status', '!=', 'Closed'],
                    ['docstatus', '<', 2],
                    ['company', '=', activeCompany]
                ]),
                fields: '["name", "customer", "grand_total", "status", "currency", "modified", "delivery_date"]',
                limit_start: pageIndex * PAGE_SIZE,
                limit_page_length: PAGE_SIZE,
                order_by: 'modified desc'
            });

            if (data && data.length > 0) {
                const soNames = data.map((so: any) => so.name);

                let itemsData: any[] = [];
                try {
                    const docs = await Promise.all(soNames.map((name: string) => getResource('Sales Order', name)));
                    docs.forEach((doc: any, idx: number) => {
                        const soItems = (doc.items || []).map((item: any) => ({
                            parent: doc.name || soNames[idx],
                            qty: item.qty,
                            delivered_qty: item.delivered_qty
                        }));
                        itemsData.push(...soItems);
                    });
                } catch (e) {
                    console.error('[Dispatch] Search: Error fetching SO item details:', e);
                }

                const soItemStats = soNames.reduce((acc: any, name: string) => {
                    const soItems = itemsData?.filter((item: any) => item.parent === name) || [];
                    acc[name] = {
                        totalItems: soItems.length,
                        pendingLines: soItems.filter((item: any) => (Number(item.qty) - Number(item.delivered_qty)) > 0).length
                    };
                    return acc;
                }, {});

                const formatted = data.map((so: any) => ({
                    id: so.name,
                    customer: so.customer,
                    amount: formatCurrency(Number(so.grand_total), so.currency || defaultCurrency),
                    status: so.status,
                    date: so.delivery_date,
                    totalItems: soItemStats[so.name].totalItems,
                    pendingCount: soItemStats[so.name].pendingLines
                }));

                setSearchResults(formatted);
                setSearchPage(pageIndex);
                if (pageIndex === 0) {
                    setShowDropdown(true);
                }
                setHasMoreResults(data.length === 10);
            } else {
                if (pageIndex === 0) {
                    setSearchResults([]);
                    setShowDropdown(search.length > 0);
                }
                setHasMoreResults(false);
            }
        } catch (error) {
            console.error('[Dispatch] Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleDirectOpen = async (soId: string) => {
        if (!soId.trim()) return;
        setIsSearching(true);
        // First try to fetch exact match from Sales Order
        try {
            const exactDoc = await getResource('Sales Order', soId.trim());
            if (exactDoc && exactDoc.name) {
                setSearch(exactDoc.name);
                setShowDropdown(false);
                setIsSearching(false);
                router.push({ pathname: '/inventory/dispatch/[id]', params: { id: exactDoc.name, type: 'Sales Order' } });
                return;
            }
        } catch (err) {
            console.log('Not a Sales Order, checking Delivery Note...');
        }

        // Try fetching exact match from Delivery Note
        try {
            const exactDn = await getResource('Delivery Note', soId.trim());
            if (exactDn && exactDn.name && exactDn.docstatus === 0) {
                setSearch(exactDn.name);
                setShowDropdown(false);
                setIsSearching(false);
                router.push({ pathname: '/inventory/dispatch/[id]', params: { id: exactDn.name, type: 'Delivery Note' } });
                return;
            }
        } catch (err) {
            console.error('Error fetching DN details:', err);
        }

        try {
            const results = await getResource('Sales Order', undefined, {
                filters: JSON.stringify([
                    ['name', '=', soId.trim()],
                    ['status', '!=', 'Closed'],
                    ['docstatus', '<', 2],
                    ['company', '=', activeCompany]
                ]),
                fields: '["name"]',
                limit_page_length: 1
            });

            if (results && results.length > 0) {
                const foundName = results[0].name;
                setSearch(foundName);
                setShowDropdown(false);
                setIsSearching(false);
                router.push({ pathname: '/inventory/dispatch/[id]', params: { id: foundName, type: 'Sales Order' } });
                return;
            }
        } catch (err) {
            console.error('Filter query search failed', err);
        }

        setIsSearching(false);
        setShowDropdown(true);
        setSearchResults([]);
        Alert.alert(
            t('order_not_found', 'Order Not Found'),
            t('so_not_found_msg', `Sales Order "${soId}" was not found or is closed/cancelled.`)
        );
    };

    const handleOpenScanner = async () => {
        if (!permission || !permission.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert('Permission Required', 'Camera access is needed to scan barcodes.');
                return;
            }
        }
        setIsScanning(true);
    };

    const onBarcodeScanned = ({ data }: { data: string }) => {
        setIsScanning(false);
        let soId = data;
        if (data.includes('/')) {
            const parts = data.split('/');
            soId = parts[parts.length - 1];
        }
        setSearch(soId.trim());
        handleDirectOpen(soId.trim());
    };

    const stats = [
        { title: "TODAY'S DISPATCH", value: todaysDispatchCount.toString(), Icon: Truck, color: "#3b82f6" },
        { title: "PENDING SO", value: pendingSOCount.toString(), Icon: Clock, color: "#f59e0b" },
        { title: "DRAFT DN", value: draftDNCount.toString(), Icon: FileText, color: "#8b5cf6" },
        { title: "AVG. TIME", value: avgDispatchTime, Icon: Clock, color: "#10b981" },
    ];

    //loder
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0f172a" />
            </View>
        );
    }
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
                    <NotificationBell color="#eab308" style={{ marginRight: 10 }} />
                    <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/settings')}>
                        <Text style={styles.profileInitial}>{userInitials}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.greetingContainer}>
                <Text style={styles.greetingText}>{t('dispatch', 'Dispatch')}</Text>
                <Text style={styles.subGreetingText}>{t('manage_outgoing_stoc', 'Manage outgoing stock from sales orders')}</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
            >

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {stats.map((stat, i) => (
                        //@ts-ignore
                        <StatCard key={i} {...stat} index={i} />
                    ))}
                </View>

                {/* Top Header for Charts (Filter + Tabs) */}
                <View style={{ zIndex: 1, marginBottom: 15, marginTop: 10 }}>
                    <View style={styles.analyticsHeaderRow}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.analyticsTitleText}>{t('analytics_charts', 'Analytics & Charts')}</Text>
                            <Text style={styles.analyticsSubtitleText}>{t('real_time_dispatch_m', 'Real-time dispatch metrics')}</Text>
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
                                    chartScrollRef.current?.scrollTo({ x: idx * (width - 32), animated: true });
                                }}
                            >
                                <Text style={[styles.chartTabText, activeChartIndex === idx ? styles.chartTabTextActive : undefined]}>{name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <Animated.View entering={FadeInUp} style={styles.analyticsContent}>
                    <ScrollView
                        ref={chartScrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(e) => {
                            const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
                            setActiveChartIndex(newIndex);
                        }}
                        contentContainerStyle={{ paddingBottom: 10 }}
                    >
                        {/* Chart 1: Daily Dispatch Trends */}
                        <View style={{ width: width - 32 }}>
                            <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                <View style={styles.barChartSim}>
                                    {(() => {
                                        const now = new Date();
                                        const day = now.getDay();
                                        const currentIdx = day === 0 ? 6 : day - 1;

                                        const visibleTrends = weeklyTrends.slice(0, currentIdx + 1);
                                        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, currentIdx + 1);

                                        const maxVal = Math.max(...visibleTrends, 5);
                                        const yAxisValues = [
                                            Math.round(maxVal).toString(),
                                            Math.round(maxVal * 0.75).toString(),
                                            Math.round(maxVal * 0.5).toString(),
                                            Math.round(maxVal * 0.25).toString(),
                                            '0'
                                        ];

                                        return (
                                            <>
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
                                                            {labels.map((l, idx) => (
                                                                <View key={idx} style={[styles.vGridLine, { left: `${(idx / labels.length) * 100}%` }]} />
                                                            ))}
                                                        </View>
                                                        <View style={styles.barChartBars}>
                                                            {visibleTrends.map((val, i) => {
                                                                const BAR_MAX_HEIGHT = 160;
                                                                const h_px = (val / maxVal) * BAR_MAX_HEIGHT;
                                                                return (
                                                                    <View key={i} style={styles.barContainer}>
                                                                        {!!(val > 0) ? (
                                                                            <Text style={styles.barTopValue}>{val}</Text>
                                                                        ) : null}
                                                                        <View style={[styles.bar, { height: Math.max(h_px, 4) }]} />
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
                                                            <Text key={l} style={styles.chartLabel}>{l}</Text>
                                                        ))}
                                                    </View>
                                                </View>
                                            </>
                                        );
                                    })()}
                                </View>
                            </View>
                        </View>

                        {/* Chart 2: Dispatches by Region */}
                        <View style={{ width: width - 32 }}>
                            <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                <DonutChart
                                    data={regionData.map(d => ({ label: d.name, value: d.p, color: d.color }))}
                                    size={120}
                                    strokeWidth={20}
                                />
                            </View>
                        </View>

                        {/* Chart 3: Top Dispatchers */}
                        <View style={{ width: width - 32 }}>
                            <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                <View style={styles.hBarChartWrapper}>
                                    <View style={styles.hChartMain}>
                                        <View style={styles.hGridLines}>
                                            <View style={styles.hGridLinesVertical}>
                                                {[0, 1, 2, 3, 4].map(v => (
                                                    <View key={v} style={styles.hGridLineV} />
                                                ))}
                                            </View>
                                        </View>
                                        <View style={styles.hBarList}>
                                            {dispatcherData.length > 0 ? (
                                                (() => {
                                                    const maxVal = Math.max(...dispatcherData.map(d => d.val), 10);
                                                    const chartMax = Math.ceil(maxVal / 10) * 10 + 10;
                                                    return dispatcherData.map((item, idx) => {
                                                        const barWidth = Math.max((item.val / chartMax) * 100, 2);
                                                        return (
                                                            <View key={idx} style={styles.hBarRow}>
                                                                <View style={styles.hBarLabelGroup}>
                                                                    <Text style={styles.hBarTextLabel} numberOfLines={1}>{item.name}</Text>
                                                                    <View style={styles.hBarConnector} />
                                                                </View>
                                                                <View style={styles.hBarContainer}>
                                                                    <View style={[styles.hBar, { width: `${barWidth}%`, backgroundColor: '#0f172a' }]} />
                                                                </View>
                                                            </View>
                                                        );
                                                    });
                                                })()
                                            ) : (
                                                [1, 2, 3, 4, 5].map(i => (
                                                    <View key={i} style={styles.hBarRow}>
                                                        <View style={styles.hBarLabelGroup}>
                                                            <View style={{ width: 40, height: 10, backgroundColor: '#f1f5f9', borderRadius: 4 }} />
                                                            <View style={styles.hBarConnector} />
                                                        </View>
                                                        <View style={styles.hBarContainer}>
                                                            <View style={[styles.hBar, { width: '10%', backgroundColor: '#f1f5f9' }]} />
                                                        </View>
                                                    </View>
                                                ))
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.hXAxis}>
                                        <View style={{ width: 70 }} />
                                        <View style={styles.hXAxisLabels}>
                                            {dispatcherData.length > 0 ? (
                                                (() => {
                                                    const maxVal = Math.max(...dispatcherData.map(d => d.val), 10);
                                                    const chartMax = Math.ceil(maxVal / 10) * 10 + 10;
                                                    return [0, Math.round(chartMax * 0.25), Math.round(chartMax * 0.5), Math.round(chartMax * 0.75), chartMax].map(l => (
                                                        <Text key={l} style={styles.hXAxisText}>{l}</Text>
                                                    ));
                                                })()
                                            ) : (
                                                ['0', '15', '30', '45', '60'].map(l => (
                                                    <Text key={l} style={styles.hXAxisText}>{l}</Text>
                                                ))
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Chart 4: Delivery Performance */}
                        <View style={{ width: width - 32 }}>
                            <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                <LineChart
                                    title=""
                                    data={performance}
                                    series={[
                                        { name: 'On-Time %', color: '#10b981', dataKey: 'onTime' },
                                        { name: 'Delayed %', color: '#ef4444', dataKey: 'delayed' }
                                    ]}
                                />
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
                </Animated.View>

                <View style={styles.dispatchSection}>
                    <View style={styles.searchContainer}>
                        <GlobalSearchInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder={t('search_so_customer', 'Search by SO#, customer, or items...')}
                            onScan={handleOpenScanner}
                            onSubmitEditing={() => handleDirectOpen(search)}
                            isSearching={isSearching}
                        />

                        {/* Search Dropdown Results */}
                        {showDropdown && (
                            <View style={styles.dropdownWrapper}>
                                <ScrollView
                                    style={styles.dropdownList}
                                    nestedScrollEnabled={true}
                                >
                                    {isSearching && searchResults.length === 0 ? (
                                        <View style={styles.dropdownLoading}>
                                            <ActivityIndicator size="small" color="#0f172a" />
                                        </View>
                                    ) : searchResults.length > 0 ? (
                                        <>
                                            {searchResults.map((so, i) => (
                                                <SalesOrderItem
                                                    key={so.id}
                                                    {...so}
                                                    index={i}
                                                    onPress={() => {
                                                        setSearch(so.id);
                                                        setShowDropdown(false);
                                                        router.push({ pathname: '/inventory/dispatch/[id]', params: { id: so.id, type: 'Sales Order' } });
                                                    }}
                                                />
                                            ))}
                                            {(searchPage > 0 || hasMoreResults) && (
                                                <NumberedPagination
                                                    currentPageIndex={searchPage}
                                                    hasMore={hasMoreResults}
                                                    onNext={() => handleSearch(searchPage + 1)}
                                                    onPrev={() => handleSearch(searchPage - 1)}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <View style={styles.dropdownEmpty}>
                                            <Text style={styles.emptyText}>{t('no_matching_orders', 'No matching orders')}</Text>
                                        </View>
                                    )}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    <View style={[styles.chartTabsContainer, { justifyContent: 'flex-start', gap: 24, marginBottom: 16 }]}>
                        <TouchableOpacity
                            style={[styles.chartTab, activeListTab === 'so' ? styles.chartTabActive : undefined]}
                            onPress={() => setActiveListTab('so')}
                        >
                            <Text style={[styles.chartTabText, activeListTab === 'so' ? styles.chartTabTextActive : undefined]}>
                                {t('recent_sales_orders', 'Recent Sales Orders')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.chartTab, activeListTab === 'dn' ? styles.chartTabActive : undefined]}
                            onPress={() => setActiveListTab('dn')}
                        >
                            <Text style={[styles.chartTabText, activeListTab === 'dn' ? styles.chartTabTextActive : undefined]}>
                                {t('draft_delivery_notes', 'Draft Delivery Notes')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {activeListTab === 'so' ? (
                        <>
                            {recentSO.map((so, i) => (
                                <SalesOrderItem
                                    key={i}
                                    {...so}
                                    index={i}
                                    onPress={() => {
                                        router.push({ pathname: '/inventory/dispatch/[id]', params: { id: so.id, type: 'Sales Order' } });
                                    }}
                                />
                            ))}
                            {(soListPage > 1 || hasMoreSO) && (
                                <NumberedPagination
                                    currentPageIndex={soListPage}
                                    hasMore={hasMoreSO}
                                    onNext={() => {
                                        const nextPage = soListPage + 1;
                                        fetchMoreSalesOrders(nextPage);
                                    }}
                                    onPrev={() => {
                                        const prevPage = soListPage - 1;
                                        fetchMoreSalesOrders(prevPage);
                                    }}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            {recentDN.map((dn, i) => (
                                <SalesOrderItem
                                    key={i}
                                    {...dn}
                                    index={i}
                                    onPress={() => {
                                        router.push({ pathname: '/inventory/dispatch/[id]', params: { id: dn.id, type: 'Delivery Note' } });
                                    }}
                                />
                            ))}
                            {(dnListPage > 1 || hasMoreDN) && (
                                <NumberedPagination
                                    currentPageIndex={dnListPage}
                                    hasMore={hasMoreDN}
                                    onNext={() => {
                                        const nextPage = dnListPage + 1;
                                        fetchMoreDeliveryNotes(nextPage);
                                    }}
                                    onPrev={() => {
                                        const prevPage = dnListPage - 1;
                                        fetchMoreDeliveryNotes(prevPage);
                                    }}
                                />
                            )}
                        </>
                    )}
                </View>
            </ScrollView>

            {/* Mode Toggler (Footer Custom Pill) */}
            <View style={styles.floatingFooterContainer}>
                <View style={styles.pillNavbar}>
                    <TouchableOpacity
                        style={styles.pillBackBtn}
                        onPress={() => router.back()}
                    >
                        <ArrowLeft size={20} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.pillDivider} />

                    <TouchableOpacity style={[styles.pillNavBtn, styles.pillNavBtnActive]}>
                        <Truck size={18} color="#fff" />
                        <Text style={styles.pillNavTextActive}>{t('dispatch', 'DISPATCH')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Modal for Scanner */}
            <Modal
                visible={isScanning}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsScanning(false)}
            >
                <View style={styles.scannerContainer}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={onBarcodeScanned}
                    />
                    <View style={styles.scannerOverlay}>
                        <TouchableOpacity style={styles.closeScanner} onPress={() => setIsScanning(false)}>
                            <X size={24} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.scanTarget}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>

                        <Text style={styles.scanInstructions}>
                            {t('align_the_sales_orde', 'Align the sales order barcode within the frame to scan')}
                        </Text>
                    </View>
                </View>
            </Modal>

            <OrderIdPopup
                visible={showOrderIdPopup}
                orderId={selectedOrderId}
                onClose={() => setShowOrderIdPopup(false)}
            />

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Dispatch & Shipping"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_ship') && !hasPermission('can_pack')) {
                        router.back();
                    }
                }}
            />
        </View>
    );
}

const styles: any = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
        // position: 'absolute',
        // top: 10,
        // right: 10,
        // width: 10,
        // height: 10,
        // borderRadius: 5,
        // backgroundColor: '#f5f5f5ff',
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 120,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    analyticsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
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
    analyticsTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    analyticsContent: {
        marginBottom: 20,
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
    chartTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 20,
    },
    barChartSim: {
        height: 200,
    },
    chartWrapper: {
        flex: 1,
        flexDirection: 'row',
    },
    yAxis: {
        width: 25,
        justifyContent: 'space-between',
        paddingVertical: 5,
    },
    yAxisText: {
        fontSize: 9,
        color: '#94a3b8',
        textAlign: 'right',
    },
    chartMain: {
        flex: 1,
        marginLeft: 8,
        position: 'relative',
    },
    gridLinesContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'space-between',
    },
    hGridLine: {
        height: 1,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
    },
    vGridLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 1,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
    },
    barChartBars: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        paddingBottom: 2,
    },
    barContainer: {
        width: (width - 32 - 33) / 7,
        alignItems: 'center',
        justifyContent: 'flex-end',

    },
    barTopValue: {
        fontSize: 8,
        color: '#64748b',
        marginBottom: 2,

    },

    bar: {
        width: 30,
        backgroundColor: '#000',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
    },
    xAxisWrapper: {
        flexDirection: 'row',
        marginTop: 8,
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginLeft: 8,

    },
    chartLabel: {
        width: (width - 32 - 33) / 7,
        fontSize: 9,
        color: '#94a3b8',
        textAlign: 'center',

    },
    donutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,

    },
    donutSim: {
        width: 120,
        height: 120,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    donutPlaceholder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: 'bold',
    },
    donutArc: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 25,
        borderColor: 'transparent',
    },
    donutInner: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#fff',
        zIndex: 200,
        position: 'absolute',
    },
    donutLegend: {
        flex: 1,
    },
    legendItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    legendLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    legendText: {
        fontSize: 11,
        color: '#475569',
    },
    legendValue: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    hBarChartWrapper: {
        height: 160,
    },
    hChartMain: {
        flex: 1,
        position: 'relative',
    },
    hGridLines: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 60,
        right: 0,
    },
    hGridLinesVertical: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flex: 1,
    },
    hGridLineV: {
        width: 1,
        backgroundColor: '#f1f5f9',
    },
    hBarList: {
        flex: 1,
        paddingVertical: 5,
        justifyContent: 'space-between',
    },
    hBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 28,
    },
    hBarLabelGroup: {
        width: 70,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    hBarTextLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
        fontFamily: Fonts.sans,
        textAlign: 'right',
    },
    hBarConnector: {
        width: 10,
        height: 1,
        backgroundColor: '#cbd5e1',
        marginLeft: 4,
    },
    hBarContainer: {
        flex: 1,
        height: 22,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        borderLeftWidth: 2,
        borderLeftColor: '#0f172a',
    },
    hBar: {
        height: 22,
        borderTopRightRadius: 6,
        borderBottomRightRadius: 6,
        minWidth: 4,
    },
    hXAxis: {
        flexDirection: 'row',
        marginTop: 10,
    },
    hXAxisLabels: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    hXAxisText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#94a3b8',
        fontFamily: Fonts.sans,
        textAlign: 'center',
        width: 20,
    },
    lineChartWrapper: {
        height: 150,
        flexDirection: 'row',
    },
    linesContainer: {
        flex: 1,
        position: 'relative',
    },
    linePathGreen: {
        position: 'absolute',
        top: 0,
        left: 10,
        right: 10,
        bottom: 0,
    },
    linePathRed: {
        position: 'absolute',
        top: 0,
        left: 10,
        right: 10,
        bottom: 0,
    },
    lineDot: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        marginLeft: -3,
        marginBottom: -3,
    },
    lineLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginTop: 15,
    },
    lineLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lineLegendDot: {
        width: 10,
        height: 2,
        borderRadius: 1,
        marginRight: 6,
    },
    lineLegendText: {
        fontSize: 10,
        color: '#64748b',
    },
    dispatchSection: {
        marginTop: 5,
        marginBottom: 10,
    },
    searchContainer: {
        marginBottom: 15,
        position: 'relative',
        zIndex: 50,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        height: 52,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    searchIconFrame: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    scanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    scanBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0f172a',
        marginLeft: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 12,
        fontFamily: Fonts.sans,
    },
    dropdownWrapper: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginTop: -10,
        marginHorizontal: 0,
        maxHeight: 400,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        zIndex: 1000,
    },
    dropdownList: {
        padding: 5,
    },
    dropdownItem: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    idGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dropdownItemId: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    dropdownItemPrice: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    customerText: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 8,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 11,
        color: '#94a3b8',
    },
    pendingOrangeText: {
        fontSize: 11,
        color: '#f97316',
        fontWeight: '600',
    },
    dueDateLabel: {
        fontSize: 11,
        color: '#94a3b8',
    },
    dropdownLoading: {
        padding: 20,
        alignItems: 'center',
    },
    dropdownEmpty: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 13,
    },
    loadMoreBtn: {
        backgroundColor: 'rgba(118, 52, 188, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(118, 52, 188, 0.15)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        marginBottom: 24,
        width: '90%',
        flexDirection: 'row',
        gap: 8
    },
    loadMoreText: {
        color: '#7634bc',
        fontWeight: '700',
        fontSize: 14,
    },

    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeScanner: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
    },
    scanTarget: {
        width: 250,
        height: 250,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#fff',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 3,
        borderLeftWidth: 3,
        borderTopLeftRadius: 15,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 3,
        borderRightWidth: 3,
        borderTopRightRadius: 15,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 3,
        borderLeftWidth: 3,
        borderBottomLeftRadius: 15,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 3,
        borderRightWidth: 3,
        borderBottomRightRadius: 15,
    },
    scanInstructions: {
        color: '#fff',
        marginTop: 40,
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    floatingFooterContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    },
    pillNavbar: {
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
    pillBackBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.8,
    },
    pillDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginHorizontal: 4,
    },
    pillNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 44,
        borderRadius: 22,
        gap: 8,
    },
    pillNavBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    pillNavTextActive: {
        fontSize: 12,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
        fontFamily: Fonts.sans,
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
    }
});