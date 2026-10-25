import { DotsLoader } from '@/components/DotsLoader';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Box,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock,
    FileText,
    Inbox,
    Layers,
    Plus,
    TrendingUp,
    X
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

const { width } = Dimensions.get('window');

const PicklistCard = ({ id, status, order_id, items, owner, date, index, onPress }: any) => {
    const [isHeld, setIsHeld] = React.useState(false);
    const isDraft = status?.toLowerCase() === 'draft';

    return (
        <TouchableOpacity
            onPress={() => onPress?.(id)}
            onLongPress={() => Alert.alert('Full ID / Number', id)}
            onPressIn={() => setIsHeld(true)}
            onPressOut={() => setIsHeld(false)}
            delayLongPress={200}
            activeOpacity={0.7}
        >
            <Animated.View
                entering={FadeInDown.delay(100 + (index * 50)).duration(600)}
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
                    <View style={[styles.activityTitleRow, { flexWrap: isHeld ? 'wrap' : 'nowrap' }]}>
                        <Text style={[styles.activityTitle, { flexShrink: isHeld ? 0 : 1 }]} numberOfLines={isHeld ? undefined : 1}>{id}</Text>
                    </View>
                    {order_id && (
                        <View style={styles.activityTitleRow}>
                            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{order_id}</Text>
                        </View>
                    )}
                    <View style={styles.activitySubRow}>
                        <View style={[styles.statusBadge, isDraft ? styles.statusBadgeDraft : styles.statusBadgeDefault]}>
                            <Text style={[styles.statusText, isDraft ? styles.statusTextDraft : styles.statusTextDefault]}>
                                {status}
                            </Text>
                        </View>
                        <Text style={styles.activityTime}>• {date}</Text>
                    </View>
                </View>
                <View style={styles.activityArrow}>
                    <ChevronRight size={18} color="#94a3b8" />
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function PicklistScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const filterPurpose = params.purpose as string | undefined;
    const filterDocstatus = params.docstatus as string | undefined;

    const { getResource, callMethod, getCurrentUserEmail } = useFrappe(APP_CONFIG);
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [userInitials, setUserInitials] = useState('U');

    useEffect(() => {
        if (!hasPermission('can_pick')) {
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

    const [permission, requestPermission] = useCameraPermissions();

    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);
    const [search, setSearch] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        setListPage(1);
        await Promise.all([fetchStats(), fetchLatestPicklists(1, false)]);
        setRefreshing(false);
    };
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    // Advanced Filters
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [itemFilter, setItemFilter] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState('');

    const PAGE_SIZE = 10;
    const [searchPage, setSearchPage] = useState(0);
    const [hasMoreResults, setHasMoreResults] = useState(false);
    const [listPage, setListPage] = useState(1);
    const [hasMoreList, setHasMoreList] = useState(false);
    const [loadingMoreList, setLoadingMoreList] = useState(false);

    const [hourlyActivity, setHourlyActivity] = useState<number[]>([4, 12, 8, 25, 18, 10, 5]);
    const [recentPicklists, setRecentPicklists] = useState<any[]>([]);

    const [activeFilter, setActiveFilter] = useState("All")
    const [statCounts, setStatCounts] = useState({
        pending: 0,
        pendingChange: 0,
        pendingPositive: true,
        inProgress: 0,
        inProgressChange: 0,
        inProgressPositive: true,
        completedToday: 0,
        completedChange: 0,
        completedPositive: true,
        exceptions: 0,
        exceptionsChange: 0,
        exceptionsPositive: true,
    });

    const FilteredPicklist = useMemo(() => {
        let filtered = recentPicklists;
        if (activeFilter !== "All") {
            if (activeFilter === "Draft") {
                filtered = filtered.filter(pl => pl.status === "Draft");
            } else if (activeFilter === "Submitted") {
                filtered = filtered.filter(pl => pl.status === "Open" || pl.status === "Completed" || pl.status === "In Progress");
            } else if (activeFilter === "Cancelled") {
                filtered = filtered.filter(pl => pl.status === "Cancelled");
            }

        }
        return filtered;
    }, [recentPicklists, activeFilter]);
    // Local Company Filter for Charts
    const { activeCompany } = useCompanyContext();

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

                    //that comapny is for the  fallback response  
                }
            } catch (e) {
                console.warn("[Picklist] Failed to fetch companies:", e);

            }
        };
        init();
    }, []);

    useEffect(() => {
        if (activeCompany) {
            setListPage(1);
            fetchStats();
            fetchLatestPicklists(1, false);
        }
    }, [activeCompany]);

    async function fetchStats() {
        if (!activeCompany) return;
        try {
            const now = new Date();
            const localToday = now.toLocaleDateString('en-CA');
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const localYesterday = yesterday.toLocaleDateString('en-CA');

            const [
                draftCount,
                draftYesterdayCount,
                openCount,
                openYesterdayCount,
                completedTodayCount,
                completedYesterdayCount,
                createdTodayDocs
            ] = await Promise.all([
                // 1. Pending Picks (Draft)
                callMethod('frappe.client.get_count', { doctype: 'Pick List', filters: [['status', '=', 'Draft'], ['company', '=', activeCompany]] }),
                callMethod('frappe.client.get_count', { doctype: 'Pick List', filters: [['status', '=', 'Draft'], ['company', '=', activeCompany], ['creation', '<', localToday]] }),

                // 2. In Progress Picks (Active/Not Completed)
                callMethod('frappe.client.get_count', { doctype: 'Pick List', filters: [['docstatus', '=', 1], ['status', '!=', 'Completed'], ['company', '=', activeCompany]] }),
                callMethod('frappe.client.get_count', { doctype: 'Pick List', filters: [['docstatus', '=', 1], ['status', '!=', 'Completed'], ['company', '=', activeCompany], ['creation', '<', localToday]] }),

                // 3. Completed Picks
                callMethod('frappe.client.get_count', { doctype: 'Pick List', filters: [['status', '=', 'Completed'], ['company', '=', activeCompany]] }),
                callMethod('frappe.client.get_count', { doctype: 'Pick List', filters: [['status', '=', 'Completed'], ['creation', '<', localToday], ['company', '=', activeCompany]] }),

                // 4 & 5. Today's Activity & Chart
                callMethod('frappe.client.get_list', {
                    doctype: 'Pick List',
                    filters: [['creation', '>=', localToday], ['company', '=', activeCompany]],
                    fields: ['creation'],
                    limit_page_length: 1000
                })
            ]);

            const getVal = (v: any) => typeof v === 'object' ? (v?.message ?? v?.data ?? 0) : (v ?? 0);
            const calcTrend = (curr: number, prev: number) => {
                if (prev === 0) return curr > 0 ? 100 : 0;
                return Math.round(((curr - prev) / prev) * 100);
            };

            const pending = getVal(draftCount);
            const pendingChange = calcTrend(pending, getVal(draftYesterdayCount));

            const inProgress = getVal(openCount);
            const inProgressChange = calcTrend(inProgress, getVal(openYesterdayCount));

            const completedToday = getVal(completedTodayCount);
            const completedChange = calcTrend(completedToday, getVal(completedYesterdayCount));

            const todaysDocs = Array.isArray(createdTodayDocs) ? createdTodayDocs : (createdTodayDocs?.data || []);
            const todaysCount = todaysDocs.length;

            // Hourly Chart Grouping (9 AM to 3 PM)
            const hours = [9, 10, 11, 12, 13, 14, 15];
            const hourlyCounts = [0, 0, 0, 0, 0, 0, 0];

            todaysDocs.forEach((doc: any) => {
                if (doc.creation) {
                    const docHour = new Date(doc.creation).getHours();
                    const index = hours.indexOf(docHour);
                    if (index !== -1) {
                        hourlyCounts[index]++;
                    } else if (docHour < 9) {
                        hourlyCounts[0]++;
                    } else if (docHour > 15) {
                        hourlyCounts[6]++;
                    }
                }
            });
            setHourlyActivity(hourlyCounts);

            setStatCounts({
                pending,
                pendingChange: Math.abs(pendingChange),
                pendingPositive: pendingChange >= 0,
                inProgress,
                inProgressChange: Math.abs(inProgressChange),
                inProgressPositive: inProgressChange >= 0,
                completedToday,
                completedChange: Math.abs(completedChange),
                completedPositive: completedChange >= 0,
                exceptions: todaysCount,
                exceptionsChange: 0,
                exceptionsPositive: true,
            });
        } catch (e) {
            console.error('[Picklist] Fetch Stats Error:', e);
        }
    };

    useEffect(() => {
        if (search.trim().length > 0) {
            const delayDebounceFn = setTimeout(() => {
                handleSearch(true);
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setShowSearchDropdown(false);
            setSearchResults([]);
        }
    }, [search]);

    async function handleSearch(fresh = false) {
        try {
            const currentPage = fresh ? 0 : searchPage;
            if (fresh) setIsSearching(true);

            let filters: any[] = [
                ['company', '=', activeCompany]
            ];
            if (filterPurpose) filters.push(['purpose', '=', filterPurpose]);
            if (filterDocstatus) filters.push(['docstatus', '=', parseInt(filterDocstatus)]);

            if (search.trim()) {
                filters.push(['name', 'like', `%${search}%`]);
            }

            // If advanced filters are used, query child table first
            if (itemFilter.trim() || warehouseFilter.trim()) {
                const childFilters: any[] = [];
                if (itemFilter.trim()) childFilters.push(['item_code', 'like', `%${itemFilter}%`]);
                if (warehouseFilter.trim()) childFilters.push(['warehouse', 'like', `%${warehouseFilter}%`]);

                const childData = await getResource('Pick List Item', undefined, {
                    filters: JSON.stringify(childFilters),
                    fields: '["parent"]',
                    limit_page_length: 500
                });

                if (childData && childData.length > 0) {
                    const parentNames = [...new Set(childData.map((d: any) => d.parent))];
                    filters.push(['name', 'in', parentNames]);
                } else {
                    // No matching children, so no matching parents
                    filters.push(['name', '=', 'NO_MATCH']);
                }
            }

            const data = await getResource('Pick List', undefined, {
                filters: JSON.stringify(filters),
                limit_start: currentPage * PAGE_SIZE,
                limit_page_length: PAGE_SIZE,
                order_by: 'creation desc'
            });

            if (data && data.length > 0) {
                const names = data.map((d: any) => d.name);
                const docs = await Promise.all(names.map((n: string) => getResource('Pick List', n)));

                const formatted = data.map((pl: any, idx: number) => {
                    const doc = docs[idx];
                    return {
                        id: doc.name || pl.name,
                        status: doc.status || 'Unknown',
                        owner: doc.owner || 'Unknown',
                        date: doc.creation?.split(' ')[0] || '',
                        items: doc?.locations?.length || doc?.items?.length || 0,
                        order_id: doc?.parent_sales_order || doc?.material_request || doc?.work_order || doc?.locations?.[0]?.sales_order || doc?.locations?.[0]?.material_request || doc?.locations?.[0]?.work_order || doc?.purpose || 'No Linked Order'
                    };
                });

                if (fresh) {
                    setSearchResults(formatted);
                    setSearchPage(1);
                    setShowSearchDropdown(true);
                } else {
                    setSearchResults(prev => [...prev, ...formatted]);
                    setSearchPage(prev => prev + 1);
                }
                setHasMoreResults(data.length === PAGE_SIZE);
            } else {
                if (fresh) setSearchResults([]);
                setHasMoreResults(false);
            }
        } catch (error) {
            console.error('[Picklist] Search Error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    async function fetchLatestPicklists(page = 1, append = false) {
        if (!activeCompany) return;
        if (!append) {
            setIsLoadingList(true);
        } else {
            setLoadingMoreList(true);
        }
        try {
            const queryFilters: any[] = [['company', '=', activeCompany]];
            if (filterPurpose) queryFilters.push(['purpose', '=', filterPurpose]);
            if (filterDocstatus) queryFilters.push(['docstatus', '=', parseInt(filterDocstatus)]);

            const data = await getResource('Pick List', undefined, {
                filters: JSON.stringify(queryFilters),
                order_by: 'creation desc',
                limit_start: (page - 1) * PAGE_SIZE,
                limit_page_length: PAGE_SIZE
            });
            if (data && data.length > 0) {
                const names = data.map((d: any) => d.name);
                const docs = await Promise.all(names.map((n: string) => getResource('Pick List', n)));

                const formatted = data.map((pl: any, idx: number) => {
                    const doc = docs[idx];
                    return {
                        id: doc.name || pl.name,
                        status: doc.status || 'Unknown',
                        owner: doc.owner || 'Unknown',
                        date: doc.creation?.split(' ')[0] || '',
                        items: doc?.locations?.length || doc?.items?.length || 0,
                        order_id: doc?.parent_sales_order || doc?.material_request || doc?.work_order || doc?.locations?.[0]?.sales_order || doc?.locations?.[0]?.material_request || doc?.locations?.[0]?.work_order || doc?.purpose || 'No Linked Order'
                    };
                });
                if (append) {
                    setRecentPicklists(prev => [...prev, ...formatted]);
                } else {
                    setRecentPicklists(formatted);
                }
                setHasMoreList(data.length === PAGE_SIZE);
            } else {
                if (!append) setRecentPicklists([]);
                setHasMoreList(false);
            }
        } catch (e) {
            console.error('[Picklist] Fetch Latest Error:', e);
            if (!append) setRecentPicklists([]);
        } finally {
            setIsLoadingList(false);
            setLoadingMoreList(false);
        }
    };



    const handleDirectOpen = async (plId: string) => {
        if (!plId.trim()) return;
        setIsSearching(true);
        try {
            const doc = await getResource('Pick List', plId.trim());
            if (doc && doc.name && doc.company === activeCompany) {
                setSearch(doc.name);
                setShowSearchDropdown(false);
                router.push(`/inventory/pick/${doc.name}`);
                return;
            }
        } catch (err) {
            console.log('Direct fetch by name failed, trying filter query', err);
        }

        try {
            const results = await getResource('Pick List', undefined, {
                filters: JSON.stringify([
                    ['name', '=', plId.trim()],
                    ['company', '=', activeCompany]
                ]),
                fields: '["name"]',
                limit_page_length: 1
            });

            if (results && results.length > 0) {
                const foundName = results[0].name;
                setSearch(foundName);
                setShowSearchDropdown(false);
                router.push(`/inventory/pick/${foundName}`);
                return;
            }
        } catch (err) {
            console.error('Filter query search failed', err);
        }

        setIsSearching(false);
        setShowSearchDropdown(true);
        setSearchResults([]);
        Alert.alert(
            t('picklist_not_found', 'Picklist Not Found'),
            t('picklist_not_found_msg', `Picklist "${plId}" was not found.`)
        );
    };

    const handleBarCodeScanned = ({ data }: any) => {
        setIsScanning(false);
        handleDirectOpen(data.trim());
    };

    const requestScanner = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) return;
        }
        setIsScanning(true);
    };

    return (
        <View style={styles.container}>
            {isScanning ? (
                <View style={styles.scannerContainer}>
                    <CameraView
                        onBarcodeScanned={handleBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13'] }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.scannerOverlay}>
                        <View style={styles.scannerHeader}>
                            <TouchableOpacity style={styles.closeScanner} onPress={() => setIsScanning(false)}>
                                <X size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.scannerTitle}>{t('scan_picklist_id', 'Scan Picklist ID')}</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={styles.scanTarget}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>
                        <Text style={styles.scanInstructions}>{t('point_camera_at_barc', 'Point camera at barcode on picklist doc')}</Text>
                    </View>
                </View>
            ) : (
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
                        <Text style={styles.greetingText}>{filterPurpose === 'Material Transfer for Manufacture' ? 'Manufacturing Picks' : t('picklist', 'Picklist')}</Text>
                        <Text style={styles.subGreetingText}>{filterPurpose === 'Material Transfer for Manufacture' ? 'Select a draft Pick List for transfer' : t('pick_items_for_sales', 'Pick items for sales and work orders')}</Text>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.scrollPadding, { paddingTop: 10 }]}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                        }
                    >
                        <View style={styles.statsGrid}>
                            <StatCard title="Pending Picks" value={statCounts.pending.toString()} change={statCounts.pendingChange} isPositive={statCounts.pendingPositive} Icon={ClipboardList} color="#3b82f6" index={0} subtitle="" />
                            <StatCard title="In Progress" value={statCounts.inProgress.toString()} change={statCounts.inProgressChange} isPositive={statCounts.inProgressPositive} Icon={Clock} color="#f59e0b" index={1} subtitle="" />
                            <StatCard title="Completed Picks" value={statCounts.completedToday.toString()} change={statCounts.completedChange} isPositive={statCounts.completedPositive} Icon={CheckCircle2} color="#10b981" index={2} subtitle="" />
                            <StatCard title="Today's Activity" value={statCounts.exceptions.toString()} change={statCounts.exceptionsChange} isPositive={statCounts.exceptionsPositive} Icon={TrendingUp} color="#8b5cf6" index={3} subtitle="" />
                        </View>

                        {isAnalyticsOpen && (
                            <Animated.View entering={FadeInUp} style={styles.chartsPanel}>
                                <View style={[styles.chartCard, { marginBottom: 0, height: 'auto', padding: 20 }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <View>
                                            <Text style={[styles.chartLabel, { color: '#0f172a', marginBottom: 4, fontSize: 16 }]}>{t('today_s_activity_pic', 'Today\'s Activity pick')}</Text>
                                            <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>{t('hourly_picklist_crea', 'Hourly picklist creations')}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', height: 140 }}>
                                        <View style={{ width: 25, justifyContent: 'space-between', paddingBottom: 8 }}>
                                            {(() => {
                                                const maxVal = Math.max(...hourlyActivity, 5);
                                                return [
                                                    Math.round(maxVal).toString(),
                                                    Math.round(maxVal * 0.75).toString(),
                                                    Math.round(maxVal * 0.5).toString(),
                                                    Math.round(maxVal * 0.25).toString(),
                                                    '0'
                                                ].map(v => (
                                                    <Text key={v} style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right', paddingRight: 5 }}>{v}</Text>
                                                ));
                                            })()}
                                        </View>
                                        <View style={{ flex: 1, position: 'relative' }}>
                                            <View style={{ ...StyleSheet.absoluteFill, bottom: 8, justifyContent: 'space-between' }}>
                                                {[0, 1, 2, 3, 4].map(idx => (
                                                    <View key={idx} style={{ height: 1, backgroundColor: '#f1f5f9' }} />
                                                ))}
                                            </View>
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 2 }}>
                                                {hourlyActivity.map((count, i) => {
                                                    const maxValue = Math.max(...hourlyActivity, 5);
                                                    const barHeight = (count / maxValue) * 110;
                                                    const isActive = count > 0;
                                                    return (
                                                        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                                                            {isActive && (
                                                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 }}>{count}</Text>
                                                            )}
                                                            <View style={{ height: Math.max(barHeight, 6), backgroundColor: isActive ? '#7634bc' : 'rgba(118,52,188,0.12)', width: 14, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', marginTop: 8 }}>
                                        <View style={{ width: 25 }} />
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            {hourlyActivity.map((count, i) => {
                                                const hourVal = 9 + i;
                                                const hourLabel = hourVal > 12 ? `${hourVal - 12}p` : `${hourVal}${hourVal === 12 ? 'p' : 'a'}`;
                                                const isActive = count > 0;
                                                return (
                                                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 10, color: isActive ? '#7634bc' : '#94a3b8', fontWeight: isActive ? 'bold' : 'normal' }}>{hourLabel}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                </View>
                            </Animated.View>
                        )}

                        <View style={[styles.searchSection, { zIndex: showSearchDropdown ? 1000 : 1 }]}>
                            <GlobalSearchInput
                                placeholder="Search by picklist#, SO#, or item..."
                                value={search}
                                onChangeText={setSearch}
                                onSubmitEditing={() => {
                                    if (search) handleDirectOpen(search);
                                    else handleSearch(true);
                                }}
                                onScan={requestScanner}
                            />

                            {/*search by warehouse and items -> filter  */}
                            {showAdvancedFilters && (
                                <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, backgroundColor: '#fff', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TextInput
                                            placeholder="Item Code..."
                                            style={{ flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, fontSize: 13 }}
                                            value={itemFilter}
                                            onChangeText={setItemFilter}
                                            onSubmitEditing={() => handleSearch(true)}
                                        />
                                        <TextInput
                                            placeholder="Warehouse..."
                                            style={{ flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, fontSize: 13 }}
                                            value={warehouseFilter}
                                            onChangeText={setWarehouseFilter}
                                            onSubmitEditing={() => handleSearch(true)}
                                        />
                                    </View>
                                    <TouchableOpacity style={{ backgroundColor: '#7634bc', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }} onPress={() => handleSearch(true)}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Apply Filters</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {showSearchDropdown && searchResults.length > 0 && (
                                <View style={styles.dropdownResults}>
                                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                                        {searchResults.map((pl, i) => (
                                            <TouchableOpacity key={i} style={styles.dropdownItem} onPress={() => {
                                                setShowSearchDropdown(false);
                                                router.push(`/inventory/pick/${pl.id}`);
                                            }}>
                                                <Text style={styles.dropdownTitle}>{pl.id}</Text>
                                                <Text style={styles.dropdownMeta}>{pl.status}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        {hasMoreResults && (
                                            <TouchableOpacity style={{ padding: 12, alignItems: 'center', backgroundColor: '#f8fafc' }} onPress={() => handleSearch(false)}>
                                                <Text style={{ color: '#7634bc', fontWeight: 'bold' }}>Load More Results</Text>
                                            </TouchableOpacity>
                                        )}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        <View style={styles.listSection}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 }}>
                                <Text style={[styles.sectionTitle, { marginBottom: 0, paddingHorizontal: 0 }]}>{t('my_picklists', 'My Picklists')}</Text>
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => router.push('/inventory/pick/new')}
                                    style={{
                                        borderRadius: 14,
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
                                            paddingHorizontal: 16,
                                            paddingVertical: 10,
                                            gap: 8,
                                        }}
                                    >
                                        <Plus size={16} color="#fff" strokeWidth={3} />
                                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3, fontFamily: Fonts.sans }}>{t('new_picklist', 'New Picklist')}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* display picklist by status */}
                            {/* <View style={{ paddingHorizontal: 20 }}>
                                <Text style={styles.sectionTitle}>{t('recent_picklists', 'Recent Picklists')}</Text>
                            </View> */}

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
                                {["All", "Draft", "Submitted"].map((f) => {
                                    const icons: any = {
                                        "All": Layers,
                                        "Draft": Box,
                                        "Submitted": CheckCircle2,
                                    };
                                    const IconC = icons[f];
                                    const isActive = activeFilter === f;
                                    return (
                                        <TouchableOpacity
                                            key={f}
                                            onPress={() => setActiveFilter(f)}
                                            style={[styles.filterTag, isActive && styles.filterTagActive]}
                                            activeOpacity={0.7}
                                        >
                                            {IconC && <IconC size={15} color={isActive ? '#7634bc' : '#64748b'} strokeWidth={isActive ? 2.5 : 2} />}
                                            <Text style={[styles.filterTagText, isActive && styles.filterTagTextActive]}>{t(f.toLowerCase(), f)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            {isLoadingList ? (
                                <View style={styles.emptyStateContainer}>
                                    <DotsLoader size={16} color="#7634bc" />
                                    <Text style={[styles.emptyStateText, { marginTop: 16 }]}>{t('loading_picklists', 'Loading picklists...')}</Text>
                                </View>
                            ) : FilteredPicklist.length === 0 ? (
                                <Animated.View entering={FadeInDown.duration(600)} style={styles.emptyStateContainer}>
                                    <View style={styles.emptyStateIconCircle}>
                                        <Inbox size={36} color="#7634bc" />
                                    </View>
                                    <Text style={styles.emptyStateTitle}>{t('no_picklists_found', 'No Picklists Found')}</Text>
                                    <Text style={styles.emptyStateText}>There are no picklists available for {activeCompany}.</Text>
                                </Animated.View>
                            ) : (
                                <>
                                    {FilteredPicklist.map((pl, i) => (
                                        <PicklistCard
                                            key={i}
                                            id={pl.id}
                                            status={pl.status}
                                            order_id={pl.order_id}
                                            items={pl.items}
                                            // owner={pl.owner}
                                            date={pl.date}
                                            index={i}
                                            onPress={(id: string) => router.push(`/inventory/pick/${id}`)}
                                        />
                                    ))}
                                    {hasMoreList && (
                                        <TouchableOpacity
                                            style={styles.loadMoreBtn}
                                            onPress={() => {
                                                const nextPage = listPage + 1;
                                                setListPage(nextPage);
                                                fetchLatestPicklists(nextPage, true);
                                            }}
                                            disabled={loadingMoreList}
                                        >
                                            {loadingMoreList ? (
                                                <DotsLoader size={8} color="#7634bc" />
                                            ) : (
                                                <>
                                                    <TrendingUp size={16} color="#7634bc" />
                                                    <Text style={styles.loadMoreText}>{t('load_more', 'Load More')}</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </View>
                    </ScrollView>
                </>
            )}

            {/* Fab removed and moved to inline button */}

            {!isScanning && (
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
                            <ClipboardList size={18} color="#fff" />
                            <Text style={styles.pillNavTextActive}>{t('picklist', 'PICKLIST')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Pick Lists"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_pick')) {
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
        backgroundColor: '#fff',
    },
    scrollPadding: {
        paddingBottom: 150,
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    statCard: {
        width: (width - 52) / 2,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
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
        fontWeight: '900',
    },
    statValueText: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
    },
    statTitleText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    analyticsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingHorizontal: 20,
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
    chartsPanel: {
        paddingHorizontal: 20,
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
    barChartContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 80,
    },
    barWrapper: {
        alignItems: 'center',
        flex: 1,
    },
    bar: {
        width: 12,
        borderRadius: 4,
    },
    barDay: {
        fontSize: 9,
        color: '#94a3b8',
        marginTop: 8,
        fontWeight: 'bold',
    },
    mapGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    mapZone: {
        width: '23%',
        aspectRatio: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    zoneHigh: {
        backgroundColor: '#fee2e2',
        borderColor: '#fecaca',
    },
    zoneMid: {
        backgroundColor: '#fef3c7',
        borderColor: '#fde68a',
    },
    zoneText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#ef4444',
    },
    lineChartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    searchSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingLeft: 12,
        paddingRight: 8,
        height: 52,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        fontWeight: '500',
        color: '#0f172a',
        paddingVertical: 0,
        marginLeft: 8,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    searchScanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    searchScanText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    dropdownContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        padding: 8,
        elevation: 20,
        zIndex: 2000,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.4)',
        shadowColor: '#2d4171',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 8,
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
    dropdownResults: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
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
    listSection: {
        paddingHorizontal: 20,
    },
    filterRow: {
        marginBottom: 16,
    },
    filterContent: {
        paddingHorizontal: 24,
        gap: 8,
    },
    filterTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 24,
        backgroundColor: "#f1f5f9",
        borderWidth: 1,
        borderColor: "transparent",
    },
    filterTagActive: {
        backgroundColor: "#f3e8ff",
        borderColor: "#d8b4fe",
        shadowColor: "#9333ea",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 2,
    },
    filterTagText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748b",
        fontFamily: Fonts.sans,
    },
    filterTagTextActive: {
        color: "#7634bc",
        fontWeight: "700",
        fontFamily: Fonts.sans,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 16,
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
        fontFamily: Fonts.rounded,
    },
    pendingBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    pendingText: {
        fontSize: 11,
        fontWeight: 'bold',
        fontFamily: Fonts.rounded,
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
        fontFamily: Fonts.rounded,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    fab: {
        position: 'absolute',
        bottom: 110,
        right: 24,
        backgroundColor: '#0f172a',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 20,
        gap: 10,
        elevation: 10,
        zIndex: 50,
    },
    fabText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    newPicklistBtn: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        marginTop: 8,
        marginBottom: 8,
    },
    newPicklistBtnIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(15,23,42,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    newPicklistBtnText: {
        color: '#0f172a',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.3,
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
        fontFamily: Fonts.rounded,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'space-between',
        paddingVertical: 50,
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    closeScanner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    scanTarget: {
        width: 250,
        height: 250,
        alignSelf: 'center',
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#fff',
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
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        fontSize: 14,
        paddingHorizontal: 40,
    },
    emptyStateContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        marginTop: 16,
        marginBottom: 24,
        marginHorizontal: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#94a3b8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 2,
    },
    emptyStateIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#f3e8ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
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
});
