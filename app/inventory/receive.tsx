import { StatCard } from '@/components/StatCards';
import { LineChart } from '@/components/ui/LineChart';
import { DonutChart } from '@/components/ui/PieChart';
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { Fonts } from '@/constants/theme';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { formatCurrency } from '@/utils/currency';
import { useCompanyContext } from '@/context/CompanyContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { NotificationBell } from '@/components/NotificationBell';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { OrderIdPopup } from '@/components/ui/OrderIdPopup';
import {
    ArrowLeft,
    Box,
    Building2,
    Calendar,
    ChevronRight,
    Clock,
    FileText,
    Package,
    TrendingUp,
    X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    RefreshControl,
    useWindowDimensions
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');



const PurchaseOrderItem = ({ id, vendor, amount, date, totalItems, pendingCount, index, onPress, status, onLongPress }: { id: string, vendor: string, amount: string, date: string, totalItems: number, pendingCount: number, index: number, onPress: () => void, status?: string, onLongPress?: () => void }) => {
    const { t } = useTranslation();
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
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
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

                    <View style={{ flex: 1 }}>
                        <View style={styles.dropdownItemHeader}>
                            <View style={styles.idGroup}>
                                <Text style={styles.dropdownItemId}>{id}</Text>
                                {status === 'Draft' ? (
                                    <StatusBadge status="Draft" />
                                ) : pendingCount > 0 ? (
                                    <View style={styles.pendingBadge}>
                                        <Text style={styles.pendingText}>{pendingCount} pending</Text>
                                    </View>
                                ) : null}
                            </View>
                            <ChevronRight size={18} color="#94a3b8" />
                        </View>

                        <View style={styles.detailsRow}>
                            <View style={[styles.detailItem, { flex: 1.5 }]}>
                                <Building2 size={14} color="#94a3b8" />
                                <Text style={styles.detailText} numberOfLines={1}>{vendor}</Text>
                            </View>
                            <View style={[styles.detailItem, { flex: 1 }]}>
                                <Calendar size={14} color="#94a3b8" />
                                <Text style={styles.detailText}>{date}</Text>
                            </View>
                        </View>

                        <View style={styles.bottomRow}>
                            <View style={styles.detailItem}>
                                <Package size={14} color="#94a3b8" />
                                <Text style={styles.detailText}>{totalItems} items</Text>
                            </View>
                            <Text style={styles.dropdownItemPrice}>{amount}</Text>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function ReceiveScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const { t } = useTranslation();
    const router = useRouter();
    const { getResource, callMethod, baseUrl, getCurrentUserEmail } = useFrappe();
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [userInitials, setUserInitials] = useState('U');

    useEffect(() => {
        if (!hasPermission('can_receive')) {
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

    const [search, setSearch] = useState('');
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [todaysPOCount, setTodaysPOCount] = useState<number>(0);
    const [pendingPOCount, setPendingPOCount] = useState<number>(0);
    const [draftPOCount, setDraftPOCount] = useState<number>(0);
    const [avgTime, setAvgTime] = useState({ value: '0.0h', change: 0, isPositive: true });
    const [weeklyTrends, setWeeklyTrends] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [itemGroupDist, setItemGroupDist] = useState<any[]>([]);
    const [topReceivers, setTopReceivers] = useState<any[]>([]);
    const [Performance, setPerformace] = useState([
        { label: 'Week1 ', onTime: 0, delayed: 0 },
        { label: 'Week2 ', onTime: 0, delayed: 0 },
        { label: 'Week3 ', onTime: 0, delayed: 0 },
        { label: 'Week4 ', onTime: 0, delayed: 0 },])
    const [selectedReceiverIndex, setSelectedReceiverIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPurchaseOrders();
        setRefreshing(false);
    };

    // Local Company Filter for Charts
    const { activeCompany } = useCompanyContext();

    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchPage, setSearchPage] = useState(0);
    const [hasMoreResults, setHasMoreResults] = useState(true);
    const { defaultCurrency } = useCompanyContext();

    const [showOrderIdPopup, setShowOrderIdPopup] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [activeChartIndex, setActiveChartIndex] = useState(0);
    const chartScrollRef = React.useRef<ScrollView>(null);
    const chartNames = ['Receipt Trends', 'Item Groups', 'Receivers', 'Performance'];
    const PAGE_SIZE = 10;
    const [poListPage, setPoListPage] = useState(1);
    const [hasMorePOs, setHasMorePOs] = useState(false);
    const [loadingMorePOs, setLoadingMorePOs] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const res = await getResource("Company", undefined, {
                    limit_page_length: 50,
                    fields: '["name"]',
                });
                if (Array.isArray(res) && res.length > 0) {


                } else {
                    // Fallback

                    fetchPurchaseOrders(); // if no companies found
                }
            } catch (e) {
                console.warn("[Receive] Failed to fetch companies:", e);
                fetchPurchaseOrders();
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (activeCompany) {
            fetchPurchaseOrders();
        }
    }, [activeCompany]);

    const handleDirectOpen = async (poId: string) => {
        if (!poId.trim()) return;
        setIsSearching(true);
        try {
            const data = await getResource('Purchase Order', poId.trim());
            if (data && data.name && data.status !== 'Closed' && data.docstatus < 2 && data.company === activeCompany) {
                setSearch(data.name);
                setShowDropdown(false);
                router.push(`/inventory/${encodeURIComponent(data.name)}`);
                return;
            }
        } catch (err) {
            console.log('Direct fetch by name failed, trying filter query', err);
        }

        try {
            const results = await getResource('Purchase Order', undefined, {
                filters: JSON.stringify([
                    ['name', 'like', `%${poId.trim()}%`],
                    ['status', '!=', 'Closed'],
                    ['docstatus', '<', 2],
                    ['company', '=', activeCompany]
                ]),
                fields: '["name"]',
                limit_page_length: 5
            });

            if (results && results.length > 0) {
                const exact = results.find((r: any) => r.name.toLowerCase() === poId.trim().toLowerCase());
                if (exact) {
                    setSearch(exact.name);
                    setShowDropdown(false);
                    router.push(`/inventory/${encodeURIComponent(exact.name)}`);
                    return;
                }
                if (results.length === 1) {
                    const foundName = results[0].name;
                    setSearch(foundName);
                    setShowDropdown(false);
                    router.push(`/inventory/${encodeURIComponent(foundName)}`);
                    return;
                }
            }
        } catch (err) {
            console.error('Filter query search failed', err);
        }

        setIsSearching(false);
        setShowDropdown(true);
        setSearchResults([]);
        Alert.alert(
            t('order_not_found', 'Order Not Found'),
            t('po_not_found_msg', `Purchase Order "${poId}" was not found or is closed/cancelled.`)
        );
    };

    const onBarcodeScanned = ({ data }: { data: string }) => {
        setIsScanning(false);
        let poId = data.trim();
        if (data.includes('/')) {
            const parts = data.split('/');
            poId = parts[parts.length - 1].trim();
        }
        setSearch(poId);
        handleDirectOpen(poId);
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
            const data = await getResource('Purchase Order', undefined, {
                filters: JSON.stringify([
                    ['name', 'like', `%${search}%`],
                    ['status', '!=', 'Closed'],
                    ['docstatus', '<', 2],
                    ['company', '=', activeCompany]
                ]),
                fields: '["name", "supplier", "grand_total", "status", "currency", "modified", "transaction_date"]',
                limit_start: pageIndex * PAGE_SIZE,
                limit_page_length: PAGE_SIZE,
                order_by: 'modified desc'
            });

            if (data && data.length > 0) {
                const poNames = data.map((po: any) => po.name);

                let itemsData: any[] = [];
                try {
                    // Fetch full document for each PO to reliably get items (avoids listing child tables 403)
                    const docs = await Promise.all(poNames.map((name: string) => getResource('Purchase Order', name)));
                    itemsData = [];
                    docs.forEach((doc: any, idx: number) => {
                        const poItems = (doc.items || []).map((item: any) => ({
                            parent: doc.name || poNames[idx],
                            qty: item.qty,
                            received_qty: item.received_qty
                        }));
                        itemsData.push(...poItems);
                    });
                } catch (e) {
                    console.error('[Receive] Search: Error fetching PO item details:', e);
                }

                const poItemStats = poNames.reduce((acc: any, name: string) => {
                    const poItems = itemsData?.filter((item: any) => item.parent === name) || [];
                    acc[name] = {
                        totalItems: poItems.length,
                        pendingLines: poItems.filter((item: any) => (Number(item.qty) - Number(item.received_qty)) > 0).length
                    };
                    return acc;
                }, {});

                const formatted = data.map((po: any) => ({
                    id: po.name,
                    vendor: po.supplier,
                    amount: formatCurrency(Number(po.grand_total), po.currency || defaultCurrency),
                    status: po.status,
                    date: po.transaction_date,
                    totalItems: poItemStats[po.name].totalItems,
                    pendingCount: poItemStats[po.name].pendingLines
                }));

                setSearchResults(formatted);
                setSearchPage(pageIndex);
                if (pageIndex === 0) {
                    setShowDropdown(true);

                    // Auto-open exact match or single result
                    const exactMatch = formatted.find(
                        (po: any) => po.id.toLowerCase() === search.trim().toLowerCase()
                    );
                    if (exactMatch) {
                        setSearch(exactMatch.id);
                        setShowDropdown(false);
                        router.push(`/inventory/${encodeURIComponent(exactMatch.id)}`);
                        return;
                    }
                    if (formatted.length === 1) {
                        const singleMatch = formatted[0];
                        setSearch(singleMatch.id);
                        setShowDropdown(false);
                        router.push(`/inventory/${encodeURIComponent(singleMatch.id)}`);
                        return;
                    }
                }
                setHasMoreResults(data.length === PAGE_SIZE);
            } else {
                if (pageIndex === 0) setSearchResults([]);
                setHasMoreResults(false);
            }
        } catch (error) {
            console.error('[Receive] Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };
    //recent purchase orders with limit 10
    async function fetchPurchaseOrders(page = 1, append = false) {
        try {
            if (!append) {
                setLoading(true);
            } else {
                setLoadingMorePOs(true);
            }
            const data = await getResource('Purchase Order',
                undefined, {
                filters: JSON.stringify([['status', '!=', 'Closed'], ['per_received', '<', '100.0'], ['docstatus', '<', 2], ['company', '=', activeCompany]]),
                fields: '["name", "supplier", "grand_total", "status", "currency", "transaction_date"]',
                limit_start: (page - 1) * PAGE_SIZE,
                limit_page_length: PAGE_SIZE,
                order_by: 'modified desc'
            });

            if (data && data.length > 0) {
                const poNames = data.map((po: any) => po.name);

                let itemsData: any[] = [];
                try {
                    const docs = await Promise.all(poNames.map((name: string) => getResource('Purchase Order', name)));
                    itemsData = [];
                    docs.forEach((doc: any, idx: number) => {
                        const poItems = (doc.items || []).map((item: any) => ({
                            parent: doc.name || poNames[idx],
                            qty: item.qty,
                            received_qty: item.received_qty
                        }));
                        itemsData.push(...poItems);
                    });
                } catch (e) {
                    console.error('[Receive] Error fetching PO items details:', e);
                }

                const poItemStats = poNames.reduce((acc: any, name: string) => {
                    const poItems = itemsData?.filter((item: any) => item.parent === name) || [];
                    acc[name] = {
                        totalItems: poItems.length,
                        pendingLines: poItems.filter((item: any) => (Number(item.qty) - Number(item.received_qty)) > 0).length
                    };
                    return acc;
                }, {});

                const formattedPOs = data.map((po: any) => ({
                    id: po.name,
                    vendor: po.supplier,
                    amount: formatCurrency(Number(po.grand_total), po.currency || defaultCurrency),
                    status: po.status,
                    date: po.transaction_date,
                    totalItems: poItemStats[po.name].totalItems,
                    pendingCount: poItemStats[po.name].pendingLines
                }));
                setPurchaseOrders(formattedPOs);
                setHasMorePOs(data.length === PAGE_SIZE);
            } else {
                if (page === 1) setPurchaseOrders([]);
                setHasMorePOs(false);
            }
            const today = new Date().toISOString().split('T')[0];

            // filter 1 :Fetch Count of Today's POs
            const todaysCount = await callMethod('frappe.client.get_count', {
                doctype: 'Purchase Order',
                filters: JSON.stringify([
                    ['transaction_date', '=', today],
                    ['docstatus', '!=', 2],
                    ['company', '=', activeCompany]
                ])
            });
            setTodaysPOCount(typeof todaysCount === 'object' ? (todaysCount?.message ?? todaysCount?.data ?? 0) : (todaysCount ?? 0));

            //filter 2.purchase reciept pending
            const pendingCount = await callMethod('frappe.client.get_count', {
                doctype: 'Purchase Order',
                filters: JSON.stringify([
                    ['transaction_date', '<=', today],
                    ['status', '!=', 'Closed'],
                    ['docstatus', '=', 1],
                    ['company', '=', activeCompany]
                ])
            });
            setPendingPOCount(typeof pendingCount === 'object' ? (pendingCount?.message ?? pendingCount?.data ?? 0) : (pendingCount ?? 0));

            //filter 3 : receipts in draft
            const draftCount = await callMethod('frappe.client.get_count', {
                doctype: 'Purchase Receipt',
                filters: JSON.stringify([
                    ['docstatus', '=', 0],
                    ['company', '=', activeCompany]
                ])
            });
            setDraftPOCount(typeof draftCount === 'object' ? (draftCount?.message ?? draftCount?.data ?? 0) : (draftCount ?? 0));

            //filter 4: Avg time :
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1)
            const yesterday = yesterdayDate.toISOString().split('T')[0];
            // const currentMonthStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1,).toISOString().split('T')[0];

            const todaysReceiptData = await getResource('Purchase Receipt', undefined, {
                filters: JSON.stringify([['docstatus', '=', 1],
                // ['posting_date', '>', currentMonthStartDate],
                ['posting_date', '=', today],
                // ['posting_date', '<=', today],
                ['company', '=', activeCompany]]),
                fields: '["name","creation","modified","posting_date","posting_time"]',
            });

            const yesterdayReceiptData = await getResource('Purchase Receipt', undefined, {
                filters: JSON.stringify([
                    ['posting_date', '=', yesterday],
                    ['docstatus', '=', 1],
                    ['company', '=', activeCompany]]),
                fields: '["name","creation","modified","posting_date","posting_time"]'
            })


            let todayAvgTime = 0;
            let yesterdayAvgTime = 0;
            if (Array.isArray(todaysReceiptData) && todaysReceiptData.length > 0) {
                let totalHours = 0;
                todaysReceiptData.forEach((r: any) => {
                    const created = new Date(r.creation).getTime();
                    const modifiedDate = new Date(r.modified).getTime();
                    const timediff = modifiedDate - created;
                    const hours = timediff / (60 * 60 * 1000);
                    totalHours += hours;
                })
                todayAvgTime = totalHours / todaysReceiptData.length;
            }
            console.log('todays  total avg time data : --------------- >', todayAvgTime);


            if (Array.isArray(yesterdayReceiptData) && yesterdayReceiptData.length > 0) {
                let totalHours = 0;
                yesterdayReceiptData.forEach((r: any) => {
                    const created = new Date(r.creation).getTime();
                    const modifiedDate = new Date(r.modified).getTime();
                    const diff = modifiedDate - created;
                    const hours = diff / (60 * 60 * 1000);
                    totalHours += hours;
                })
                yesterdayAvgTime = totalHours / yesterdayReceiptData.length;
            }

            let timeChange = 0;
            let isPositive = true;

            if (yesterdayAvgTime > 0) {
                timeChange = Math.round(((todayAvgTime - yesterdayAvgTime) / yesterdayAvgTime) * 100);
                isPositive = timeChange <= 0;
            } else if (yesterdayAvgTime === 0 && todayAvgTime > 0) {
                timeChange = 100;
                isPositive = false;
            }

            setAvgTime({
                value: `${todayAvgTime.toFixed(1)}h`,
                change: Math.abs(timeChange),
                isPositive: isPositive
            });

            // Fetch Analytics Data for Charts
            try {
                const now = new Date();
                const currentDay = now.getDay(); // 0 is Sun, 1 is Mon, 2 is Tue, 3 is Wed...
                // Calculate diff to get to Monday (if Sun, diff is 6; if Mon, diff is 0; if Tue, diff is 1)
                const diffToMonday = (currentDay === 0 ? 6 : currentDay - 1);
                const monday = new Date(now);
                monday.setDate(now.getDate() - diffToMonday);
                const mondayStr = monday.toISOString().split('T')[0];

                // 1. Weekly Trends (Receipts per day)
                const receipts = await getResource('Purchase Receipt', undefined, {
                    filters: JSON.stringify([
                        ['posting_date', '>=', mondayStr],
                        ['docstatus', '=', 1],
                        ['company', '=', activeCompany]
                    ]),
                    fields: '["posting_date", "name"]',
                    limit_page_length: 500
                });

                const trends = [0, 0, 0, 0, 0, 0, 0];
                if (Array.isArray(receipts)) {
                    receipts.forEach(r => {
                        const date = new Date(r.posting_date);
                        const day = date.getDay(); // 0 is Sun, 1 is Mon...
                        const index = (day === 0 ? 6 : day - 1); // map to 0=Mon, ..., 6=Sun
                        trends[index]++;
                    });
                }
                setWeeklyTrends(trends);

                //chart 2 : Item Groups (Distribution) from Purchase Receipt Trends Report
                try {
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    const currentMonthLabel = `${monthNames[now.getMonth()]} (Amt)`;
                    const currentMonthKey = currentMonthLabel.toLowerCase().replace(/ /g, '_').replace(/\(/g, '').replace(/\)/g, '');

                    let fiscalYear = "";
                    try {
                        const fiscalYears = await getResource('Fiscal Year', undefined, {
                            filters: JSON.stringify([['disabled', '=', 0]]),
                            order_by: 'year_start_date desc',
                            limit_page_length: 1,
                            fields: '["name"]'
                        });
                        if (fiscalYears && fiscalYears.length > 0) {
                            fiscalYear = fiscalYears[0].name;
                        }
                    } catch (e) {
                        console.error('[Receive] Error fetching fiscal year:', e);
                    }

                    const report = await callMethod('frappe.desk.query_report.run', {
                        report_name: 'Purchase Receipt Trends',
                        filters: {
                            company: activeCompany,
                            fiscal_year: fiscalYear,
                            period: 'Monthly',
                            based_on: 'Item Group'
                        }
                    });

                    if (report && report.result && Array.isArray(report.result)) {
                        const rows = report.result;
                        const monthShort = monthNames[now.getMonth()].toLowerCase(); // e.g. 'mar'
                        console.log('rows---------------------->', rows,);
                        console.log(monthShort);


                        // Process rows: extract item group and current month value
                        const groupValues: { label: string; value: number }[] = rows
                            .filter((r: any) => (r.item_group || r.label) && r.item_group !== 'Total' && !r.__is_group_footer)
                            .map((r: any) => {
                                // Find the value. Try constructions: 'mar_amt', 'Mar (Amt)', 'mar', 'March'
                                // Also search keys for anything containing the month name
                                let val = 0;
                                const keys = Object.keys(r);

                                // 1. Try explicit constructions
                                const possibleKeys = [currentMonthLabel, currentMonthKey, monthShort, `${monthShort}_amt`];
                                for (const k of possibleKeys) {
                                    if (r[k] !== undefined) {
                                        val = parseFloat(r[k] || 0);
                                        break;
                                    }
                                }
                                console.log(possibleKeys);

                                // 2. Fallback: Search keys for month name match if still 0
                                if (val === 0) {
                                    // Look for any key that contains the month short name and 'amt' (case-insensitive)
                                    const matchingKey = keys.find(k => k.toLowerCase().includes(monthShort) && k.toLowerCase().includes('amt'));
                                    if (matchingKey) val = parseFloat(r[matchingKey] || 0);
                                }

                                return {
                                    label: (r.item_group || r.label || 'Unknown') as string,
                                    value: val
                                };
                            })
                            .filter((r: any) => r.value > 0);

                        const grandTotal = groupValues.reduce((sum: number, r) => sum + r.value, 0);

                        if (grandTotal > 0) {
                            const colors = ['rgba(30, 27, 75, 1)', 'rgba(30, 27, 75, 0.75)', 'rgba(30, 27, 75, 0.5)', 'rgba(30, 27, 75, 0.3)', 'rgba(30, 27, 75, 0.15)'];
                            const dist = groupValues
                                .sort((a, b) => b.value - a.value) // Highest first
                                .slice(0, 5) // Top 5
                                .map((item, idx) => ({
                                    label: item.label,
                                    percentage: Math.round((item.value / grandTotal) * 100),
                                    color: colors[idx % colors.length]
                                }));
                            setItemGroupDist(dist);
                        }
                    }
                } catch (reportErr) {
                    console.warn('[Analytics] Item groups report skipped:', reportErr);
                }

                // chart 3. Top Receivers This Month (Horizontal Bar Chart)
                try {
                    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const prs = await getResource('Purchase Receipt', undefined, {
                        filters: JSON.stringify([
                            ['posting_date', '>=', firstDayOfMonth],
                            ['docstatus', '=', 1],
                            ['company', '=', activeCompany]
                        ]),
                        fields: '["owner", "name"]',
                        limit_page_length: 1000
                    });
                    console.log('top receivers chart data ---------------------->', prs);

                    if (Array.isArray(prs)) {
                        const counts = prs.reduce((acc: any, pr: any) => {
                            acc[pr.owner] = (acc[pr.owner] || 0) + 1;
                            return acc;
                        }, {});

                        const sorted = Object.entries(counts)
                            .map(([name, count]) => ({
                                name: name.split('@')[0].split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                                count: count as number
                            }))
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5);

                        setTopReceivers(sorted);
                    }
                } catch (err) {
                    console.warn('[Analytics] Top receivers skipped:', err);
                }
            } catch (analyticsErr) {
                console.warn('[Analytics] Failed to resolve chart data:', analyticsErr);
            }
        } catch (error) {
            console.error('[Receive] Failed to fetch POs:', error);
        } finally {
            setLoading(false);
            setLoadingMorePOs(false);
        }

        //chart 4: Receipt Performance (On-Time vs Delayed)
        try {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

            // 1. Fetch Receipts for this month
            const pos = await getResource('Purchase Order', undefined, {
                filters: JSON.stringify([
                    ['transaction_date', '>=', firstDayOfMonth],
                    ['company', '=', activeCompany],
                    ['status', 'in', ['Completed', 'To Bill', 'Closed']]
                ]),
                fields: '["name", "transaction_date", "modified"]',
                limit_page_length: 1000,
            }, false, undefined, true); // hideErrorToast = true

            if (Array.isArray(pos)) {
                const weeklyStats = [
                    { onTime: 0, delayed: 0, total: 0 },
                    { onTime: 0, delayed: 0, total: 0 },
                    { onTime: 0, delayed: 0, total: 0 },
                    { onTime: 0, delayed: 0, total: 0 }
                ];

                pos.forEach((po: any) => {
                    if (po.transaction_date && po.modified) {
                        const schedDate = new Date(po.transaction_date);
                        const modDate = new Date(po.modified);
                        const dayOfMonth = modDate.getDate();

                        let weekIndex = Math.floor((dayOfMonth - 1) / 7);
                        if (weekIndex > 3) weekIndex = 3;

                        if (modDate > schedDate) {
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

                setPerformace(finalData);
            }
        } catch (error) {
            console.warn('[Analytics] Performance chart skipped:', error);
        }
    };

    const stats = [
        { title: "TODAY'S RECEIPTS", value: todaysPOCount.toString(), change: 12, isPositive: true, Icon: FileText, color: "#3b82f6" },
        { title: "PENDING PO", value: pendingPOCount.toString(), change: 2, isPositive: false, Icon: Clock, color: "#f59e0b" },
        { title: "DRAFT RECEIPTS", value: draftPOCount.toString(), change: 5, isPositive: true, Icon: Box, color: "#8b5cf6" },
        { title: "AVG. TIME", value: avgTime.value, change: avgTime.change, isPositive: avgTime.isPositive, Icon: TrendingUp, color: "#10b981", subtitle: "vs yesterday" },
    ];

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
                <Text style={styles.greetingText}>{t('receive', 'Receive')}</Text>
                <Text style={styles.subGreetingText}>{t('manage_incoming_stoc', 'Manage incoming stock from purchase orders')}</Text>
            </View>

            {/* Barcode Scanner Modal */}
            <Modal
                visible={isScanning}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsScanning(false)}
            >
                <View style={styles.scannerContainer}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={isScanning ? onBarcodeScanned : undefined}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr', 'code128', 'code39'],
                        }}
                    />
                    <View style={styles.scannerOverlay}>
                        <View style={styles.scannerHeader}>
                            <TouchableOpacity
                                onPress={() => setIsScanning(false)}
                                style={styles.closeScanner}
                            >
                                <X size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.scannerTitle}>{t('scan_po_barcode', 'Scan PO Barcode')}</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <View style={styles.scanTarget}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>

                        <Text style={styles.scanInstructions}>
                            {t('align_the_purchase_o', 'Align the purchase order barcode within the frame to scan')}
                        </Text>
                    </View>
                </View>
            </Modal>

            <OrderIdPopup
                visible={showOrderIdPopup}
                orderId={selectedOrderId}
                onClose={() => setShowOrderIdPopup(false)}
            />

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
                            <Text style={styles.analyticsSubtitleText}>{t('real_time_receipt_me', 'Real-time receipt metrics')}</Text>
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
                    >
                        {/* Chart 1: Daily Receipt Trends */}
                        <View style={{ width: width - 32 }}>
                            <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                <View style={styles.barChartSim}>
                                    {(() => {
                                        const now = new Date();
                                        const day = now.getDay();
                                        const currentIdx = day === 0 ? 6 : day - 1;

                                        const visibleTrends = weeklyTrends;
                                        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                        const max = Math.max(...visibleTrends, 5);
                                        const yAxisValues = ['20', '15', '10', '5', '0'];

                                        return (
                                            <>
                                                <View style={styles.chartWrapper}>
                                                    <View style={styles.yAxis}>
                                                        {yAxisValues.map(v => (
                                                            <Text key={v} style={styles.yAxisText}>{v}</Text>
                                                        ))}
                                                    </View>
                                                    <View style={styles.chartMain}>
                                                        <View style={styles.gridLines}>
                                                            {yAxisValues.map(v => (
                                                                <View key={v} style={styles.gridLine} />
                                                            ))}
                                                        </View>
                                                        <View style={styles.barChartBars}>
                                                            {visibleTrends.map((val, i) => {
                                                                const h = (val / max) * 100;
                                                                const isFuture = i > currentIdx;
                                                                const barColor = isFuture ? '#e5e7eb' : ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#6366f1', '#14b8a6'][i % 7];
                                                                return (
                                                                    <View key={i} style={styles.barContainer}>
                                                                        <View style={[styles.bar, { height: Math.max(h, 2), backgroundColor: barColor }]} />
                                                                    </View>
                                                                );
                                                            })}
                                                        </View>
                                                    </View>
                                                </View>
                                                <View style={styles.xAxisWrapper}>
                                                    <View style={styles.yAxisPlaceholder} />
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

                        {/* Chart 2: Item Groups (Donut) */}
                        <View style={{ width: width - 32 }}>
                            <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                <DonutChart
                                    data={itemGroupDist.map(item => ({ label: item.label, value: item.percentage, color: item.color }))}
                                    size={120}
                                    strokeWidth={20}
                                />
                            </View>
                        </View>

                        {/* Chart 3: Top Receivers */}
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
                                            <View style={styles.hGridLinesHorizontal}>
                                                {[0, 1, 2, 3, 4].map(v => (
                                                    <View key={v} style={styles.hGridLineH} />
                                                ))}
                                            </View>
                                        </View>
                                        <View style={styles.hBarList}>
                                            {topReceivers.length > 0 ? (
                                                topReceivers.map((item, idx) => {
                                                    const maxCount = Math.max(...topReceivers.map(r => r.count), 60);
                                                    const barWidth = Math.min((item.count / maxCount) * 100, 100);
                                                    return (
                                                        <View key={idx} style={styles.hBarRow}>
                                                            <View style={styles.hBarLabelGroup}>
                                                                <Text style={styles.hBarLabel} numberOfLines={1}>{item.name}</Text>
                                                                <View style={styles.hBarConnector} />
                                                            </View>
                                                            <View style={styles.hBarContainer}>
                                                                <View style={[styles.hBar, { width: `${barWidth}%`, backgroundColor: '#0f172a' }]} />
                                                            </View>
                                                        </View>
                                                    );
                                                })
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
                                            {['0', '15', '30', '45', '60'].map(l => (
                                                <Text key={l} style={styles.hXAxisText}>{l}</Text>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Chart 4: Receipt Performance */}
                        <View style={{ width: width - 32 }}>
                            <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                <LineChart
                                    title=""
                                    data={Performance}
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

                <View style={styles.receiveSection}>
                    <Text style={styles.sectionTitle}>{t('receive_against_po', 'Receive Against PO')}</Text>
                    <Text style={styles.sectionSubtitle}>{t('search_for_a_purchas', 'Search for a purchase order to start receiving items')}</Text>

                    <View style={styles.searchContainer}>
                        <GlobalSearchInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder={t('search_po_by_id_or_sc', 'Search PO by ID or scan...')}
                            onScan={handleOpenScanner}
                            onSubmitEditing={() => handleDirectOpen(search)}
                            isSearching={isSearching}
                        />

                        {/* Search Dropdown Results */}
                        {showDropdown && (
                            <View style={styles.dropdownContainer}>
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
                                            {searchResults.map((po, i) => (
                                                <PurchaseOrderItem
                                                    key={po.id}
                                                    {...po}
                                                    index={i}
                                                    onPress={() => {
                                                        setSearch(po.id);
                                                        setShowDropdown(false);
                                                        router.push(`/inventory/${encodeURIComponent(po.id)}`);
                                                    }}
                                                    onLongPress={() => {
                                                        setSelectedOrderId(po.id);
                                                        setShowOrderIdPopup(true);
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
                </View>

                <View style={styles.recentSection}>
                    <Text style={styles.sectionHeaderTitle}>{t('recent_purchase_order', 'Recent Purchase Orders')}</Text>
                    <View style={styles.poList}>
                        {loading && (
                            <View style={styles.loaderContainer}>
                                <ActivityIndicator size="small" color="#0f172a" />
                                <Text style={styles.loaderText}>{t('loading', 'loading...')}</Text>
                            </View>
                        )}
                        {!loading && purchaseOrders.length > 0 && purchaseOrders.map((po, i) => (
                            <PurchaseOrderItem
                                key={po.id || i}
                                {...po}
                                index={i}
                                onPress={() => router.push(`/inventory/${encodeURIComponent(po.id)}`)}
                                onLongPress={() => {
                                    setSelectedOrderId(po.id);
                                    setShowOrderIdPopup(true);
                                }}
                            />
                        ))}
                        {!loading && (poListPage > 1 || hasMorePOs) && (
                            <NumberedPagination
                                currentPageIndex={poListPage}
                                hasMore={hasMorePOs}
                                onNext={() => {
                                    const nextPage = poListPage + 1;
                                    setPoListPage(nextPage);
                                    fetchPurchaseOrders(nextPage, true);
                                }}
                                onPrev={() => {
                                    const prevPage = poListPage - 1;
                                    setPoListPage(prevPage);
                                    fetchPurchaseOrders(prevPage, true);
                                }}
                            />
                        )}
                        {!loading && purchaseOrders.length === 0 && (
                            <View style={styles.emptyState}>
                                <Box size={40} color="#e2e8f0" />
                                <Text style={styles.emptyText}>{t('no_pending_purchase_', 'No pending purchase orders found.')}</Text>
                            </View>
                        )}
                    </View>
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
                        <Package size={18} color="#fff" />
                        <Text style={styles.pillNavTextActive}>{t('receive', 'RECEIVE')}</Text>
                    </TouchableOpacity>

                    {/* GRN Button removed as per Screenshot 2 for Receive screen */}
                </View>
            </View>

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Receive Goods"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_receive')) {
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
        backgroundColor: '#f8fafc',
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 20,
    },

    analyticsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 20,
    },
    analyticsHeaderTitle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    filterChipText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#334155',
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
    analyticsContent: {
        marginBottom: 20,
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
    chartTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 20,
        fontFamily: Fonts.sans,
    },
    barChartSim: {
        width: '100%',
        marginTop: 10,
    },
    chartWrapper: {
        flexDirection: 'row',
        height: 110,
    },
    yAxis: {
        height: 100,
        justifyContent: 'space-between',
        paddingRight: 8,
        alignItems: 'flex-end',
    },
    yAxisText: {
        fontSize: 10,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
    },
    chartMain: {
        flex: 1,
        height: 100,
        position: 'relative',
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
    },
    gridLines: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'space-between',
    },
    gridLine: {
        height: 0,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
        width: '100%',
    },
    barChartBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        gap: 15,
        height: 100,
        paddingHorizontal: 10,
        zIndex: 2,
    },
    bar: {
        width: '100%',
        backgroundColor: '#0f172a',
        borderRadius: 4,
    },
    barContainer: {
        width: 18,
        height: '100%',
        justifyContent: 'flex-end',
    },
    xAxisWrapper: {
        flexDirection: 'row',
    },
    yAxisPlaceholder: {
        width: 22, // adjust to match yAxis width
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 15,
        marginTop: 10,
        paddingHorizontal: 10,
    },
    chartLabel: {
        fontSize: 9,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
        width: 18,
        textAlign: 'center',
    },
    donutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 40,
        marginTop: 10,
    },
    donutSim: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    donutSegment: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 24,
        borderColor: '#0f172a',
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
    },
    donutInner: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#fff',
        zIndex: 20,
    },
    donutLegend: {
        flex: 1,
        gap: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 4,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 2,
    },
    legendLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    legendText: {
        fontSize: 13,
        color: '#475569',
        fontFamily: Fonts.sans,
        fontWeight: '500',
    },
    legendValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    receiveSection: {
        marginBottom: 30,
        zIndex: 50, // Stacking context for children
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
        marginBottom: 15,
        fontFamily: Fonts.sans,
    },
    searchContainer: {
        zIndex: 1000,
        position: 'relative',
        marginBottom: 15,
        // Remove isolation as it can cause clipping
    },
    searchBar: {
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
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    searchIconFrame: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        flexShrink: 1,
        height: '100%',
        fontSize: 14,
        color: '#0f172a',
        fontFamily: Fonts.sans,
        marginHorizontal: 4,
        paddingVertical: 0,
    },
    searchActions: {
        flexDirection: 'row',
        alignItems: 'center',
        height: '100%',
    },
    clearBtn: {
        padding: 8,
        marginRight: 2,
    },
    searchDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#f1f5f9',
        marginHorizontal: 4,
    },
    searchScanBtn: {
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerHeader: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    closeScanner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    scanTarget: {
        width: 260,
        height: 260,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#3b82f6',
        borderWidth: 4,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderTopLeftRadius: 20,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: 20,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 20,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: 20,
    },
    scanInstructions: {
        color: '#fff',
        marginTop: 40,
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 20,
        fontFamily: Fonts.sans,
    },
    dropdownContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        maxHeight: 380,
        zIndex: 99999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 30,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    dropdownList: {
        padding: 10,
    },
    dropdownItem: {
        padding: 16,
        borderRadius: 14,
        marginBottom: 10,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    activityIconContainer: {
        marginRight: 16,
    },
    activityIconBg: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    idGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dropdownItemId: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    pendingBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    pendingText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#d97706',
        fontFamily: Fonts.sans,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 15,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 13,
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    dropdownItemPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    dropdownLoading: {
        padding: 40,
        alignItems: 'center',
    },
    dropdownEmpty: {
        padding: 40,
        alignItems: 'center',
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
        fontSize: 14,
        color: '#7634bc',
        fontWeight: '700',
    },
    recentSection: {
        marginTop: 0,
        marginBottom: 20,
        zIndex: 1,
    },

    sectionHeaderTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 15,
        fontFamily: Fonts.sans,
    },

    poList: {
        gap: 12,
    },

    loaderContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },

    loaderText: {
        marginTop: 12,
        fontSize: 12,
        color: '#64748b',
        fontFamily: Fonts.sans,
    },

    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
    },

    emptyText: {
        marginTop: 12,
        fontSize: 13,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
    },

    poItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    poContent: {
        flex: 1,
    },
    poHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    poId: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    poStatusBadge: {
        backgroundColor: '#fff7ed',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    poStatusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#f97316',
        fontFamily: Fonts.sans,
    },
    poDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    vendorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    vendorText: {
        fontSize: 12,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
    },
    poAmount: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    floatingFooterContainer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
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
    pillNavText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#94a3b8',
        letterSpacing: 0.5,
        fontFamily: Fonts.sans,
    },
    navText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 0.5,
    },
    navTextActive: {
        color: '#fff',
    },
    hBarChartWrapper: {
        height: 160,
        justifyContent: 'center',
    },
    hChartMain: {
        flex: 1,
        position: 'relative',
    },
    hGridLines: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 70,
        right: 0,
    },
    hGridLinesVertical: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        height: '100%',
    },
    hGridLineV: {
        width: 1,
        height: '100%',
        backgroundColor: '#f1f5f9',
    },
    hGridLinesHorizontal: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'space-between',
    },
    hGridLineH: {
        height: 1,
        width: '100%',
        backgroundColor: '#f1f5f9',
    },
    hBarList: {
        flex: 1,
        justifyContent: 'space-around',
    },
    hBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
    },
    hBarLabelGroup: {
        width: 70,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 8,
    },
    hBarLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '500',
        fontFamily: Fonts.sans,
    },
    hBarConnector: {
        width: 4,
        height: 1,
        backgroundColor: '#cbd5e1',
        marginLeft: 4,
    },
    hBarContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    hBar: {
        height: 12,
        borderRadius: 6,
    },
    hXAxis: {
        flexDirection: 'row',
        marginTop: 8,
    },
    hXAxisLabels: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    hXAxisText: {
        fontSize: 9,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
    },
});
