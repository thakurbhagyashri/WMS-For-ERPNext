import { NotificationBell } from "@/components/NotificationBell";
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { DonutChart } from "@/components/ui/PieChart";
import { APP_CONFIG } from "@/constants/config";
import { Fonts } from "@/constants/theme";
import { useCompanyContext } from "@/context/CompanyContext";
import { useFrappe, usePermissions } from "@/hooks/use-frappe";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Defs, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { StatCard } from "@/components/StatCards";
import { AccuracyTrendChart } from "@/components/ui/AccuracyTrendChart";
import { VarianceChart } from "@/components/ui/VarianceChart";
import {
    Box,
    ChartBar,
    CheckCircle2,
    ChevronRight,
    Layers,
    Package,
    TriangleAlert,
    X
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
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
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

const { width } = Dimensions.get("window");


// Cards component definitions



const ReconcileCard = ({ name, description, color, Icon, index, onPress }: any) => (
    <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.reconcileCardWrapper}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityLabel={`Select ${name}`}
    >
        <Animated.View
            entering={FadeInUp.delay(400 + index * 100).springify()}
            style={[styles.reconcileCard, { borderColor: color + '30' }]}
        >
            <View style={styles.reconcileCardTop}>
                <View style={[styles.reconcileIconBox, { backgroundColor: color + "15" }]}>
                    <Icon size={28} color={color} />
                </View>
                <View style={styles.reconcileArrowBox}>
                    <ChevronRight size={18} color={color} />
                </View>
            </View>
            <Text style={styles.reconcileName}>{name}</Text>
            <Text style={styles.reconcileDesc}>{description}</Text>
        </Animated.View>
    </TouchableOpacity>
);

const AdjustmentListItem = ({ name, set_warehouse, items_count, posting_date, docstatus, index, onPress }: any) => {
    const { t } = useTranslation();
    const statusLabel = docstatus === 0 ? t('draft', 'Draft') : docstatus === 1 ? t('submitted', 'Submitted') : t('cancelled', 'Cancelled');

    return (
        <TouchableOpacity activeOpacity={0.7} onPress={onPress} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
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
                        <Layers size={20} color="#2d4171" />
                    </LinearGradient>
                </View>
                <View style={styles.activityContent}>
                    <View style={styles.activityTitleRow}>
                        <Text style={styles.activityTitle} numberOfLines={1}>{name}</Text>
                    </View>
                    <View style={styles.activitySubRow}>
                        <View style={[
                            styles.statusBadge,
                            docstatus === 0 && styles.statusBadgeDraft,
                            docstatus === 1 && styles.statusBadgeSubmitted,
                            docstatus === 2 && styles.statusBadgeCancelled
                        ]}>
                            <Text style={[
                                styles.statusText,
                                docstatus === 0 && styles.statusTextDraft,
                                docstatus === 1 && styles.statusTextSubmitted,
                                docstatus === 2 && styles.statusTextCancelled
                            ]}>{statusLabel}</Text>
                        </View>
                        <Text style={styles.activityTime} numberOfLines={1}>• {items_count || 0} {t('items', 'items')} • {set_warehouse || posting_date.split(' ')[0]}</Text>
                    </View>
                </View>
                <View style={styles.activityArrow}>
                    <ChevronRight size={18} color="#64748b" />
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};


export default function AdjustmentScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { getResource, callMethod, loading: apiLoading, getCurrentUserEmail } = useFrappe(APP_CONFIG);
    const { hasPermission, refreshPermissions } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [deniedFeatureName, setDeniedFeatureName] = useState('');
    const [activeFilter, setActiveFilter] = useState("All");
    const [userInitials, setUserInitials] = useState('JD');
    const [searchQuery, setSearchQuery] = useState("");
    const [adjustments, setAdjustments] = useState<any[]>([]);
    const [analyticsOpen, setAnalyticsOpen] = useState(true);
    const [activeSlide, setActiveSlide] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showPicker, setShowPicker] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [itemGroupMap, setItemGroupMap] = useState<Record<string, string>>({});
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    // Pagination state
    const [pageIndex, setPageIndex] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchAdjustments(), refreshPermissions()]);
        setRefreshing(false);
    };

    // Local Company Filter for Charts
    const { activeCompany } = useCompanyContext();

    React.useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const email = await getCurrentUserEmail();
                if (email && email !== 'Guest') {
                    const nameParts = email.split('@')[0].split('.');
                    const initials = nameParts.length > 1
                        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                        : nameParts[0].substring(0, 2).toUpperCase();
                    setUserInitials(initials);
                }
            } catch (error) {
                console.warn('Profile fetch error:', error);
            }
        };
        fetchUserProfile();

        const fetchItemGroups = async () => {
            try {
                const itemsList = await getResource('Item', undefined, {
                    fields: '["name", "item_group"]',
                    limit_page_length: 500
                });
                if (itemsList && Array.isArray(itemsList)) {
                    const map: Record<string, string> = {};
                    itemsList.forEach((it: any) => {
                        map[it.name] = it.item_group;
                    });
                    setItemGroupMap(map);
                }
            } catch (e) {
                console.warn('Error fetching item groups mapping:', e);
            }
        };
        if (activeCompany) {
            fetchItemGroups();
        }
    }, [activeCompany]);
    const fetchAdjustments = async () => {
        setLoading(true);

        try {
            const list = await getResource('Stock Reconciliation', undefined, {
                filters: JSON.stringify([['company', '=', activeCompany]]),
                fields: '["name", "set_warehouse", "posting_date", "docstatus"]',
                limit_page_length: 50,
                order_by: 'modified desc'
            });

            const initialAdjustments = (list || []).map((adj: any) => ({ ...adj, items_count: 0 }));
            setAdjustments(initialAdjustments);
            setPageIndex(1);

            // Enrichment: Fetch full doc for each to get item counts
            initialAdjustments.forEach(async (adj: any) => {
                try {
                    const fullDoc = await getResource('Stock Reconciliation', adj.name);
                    if (fullDoc && fullDoc.items) {
                        const discrepancy_count = fullDoc.items.filter((i: any) => (i.qty || 0) !== (i.current_qty || 0)).length;
                        const itemsVariance = fullDoc.items.map((i: any) => ({
                            item_code: i.item_code,
                            warehouse: i.warehouse || fullDoc.set_warehouse || adj.set_warehouse,
                            diff: (i.qty || 0) - (i.current_qty || 0),
                            qty: i.qty || 0
                        }));
                        setAdjustments(prev => prev.map(item =>
                            item.name === adj.name ? {
                                ...item,
                                items_count: fullDoc.items.length,
                                discrepancy_count,
                                itemsVariance
                            } : item
                        ));
                    }
                } catch (e) {
                    console.warn(`Could not fetch items for ${adj.name}`, e);
                }
            });
        } catch (err) {
            console.error('Fetch adjustments error:', err);
        } finally {
            setLoading(false);
        }
    };



    React.useEffect(() => {
        if (activeCompany) {
            fetchAdjustments();
        }
    }, [activeCompany]);

    const totalSkus = adjustments.reduce((sum, adj) => sum + (adj.items_count || 0), 0);
    const pendingCounts = adjustments.filter(adj => adj.docstatus === 0).length;
    const discrepancies = adjustments.reduce((sum, adj) => sum + (adj.discrepancy_count || 0), 0);
    const accuracyRate = totalSkus > 0 ? (((totalSkus - discrepancies) / totalSkus) * 100).toFixed(1) + "%" : "100%";

    // Aggregated Variance Data for Variance Chart
    const varianceData = useMemo(() => {
        const counts: Record<string, { positive: number; negative: number }> = {};

        adjustments.forEach(adj => {
            if (adj.itemsVariance) {
                adj.itemsVariance.forEach((v: any) => {
                    const rawWh = v.warehouse || "Unknown Warehouse";
                    const whName = rawWh.split(' - ')[0].trim();
                    if (!counts[whName]) {
                        counts[whName] = { positive: 0, negative: 0 };
                    }
                    if (v.diff > 0) {
                        counts[whName].positive += v.diff;
                    } else if (v.diff < 0) {
                        counts[whName].negative += Math.abs(v.diff);
                    }
                });
            }
        });

        const result = Object.entries(counts).map(([label, value]) => ({
            label,
            value
        }));

        return result.slice(0, 5);
    }, [adjustments]);

    // Dynamic Accuracy Trend data for Accuracy Trend Chart
    const accuracyTrendData = useMemo(() => {
        if (adjustments.length === 0) {
            return [];
        }

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const last7Days = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d;
        });

        const result = last7Days.map(date => {
            const dateStr = date.toISOString().split('T')[0];
            const dayName = days[date.getDay()];

            const dayAdjs = adjustments.filter(adj => {
                if (!adj.posting_date) return false;
                return adj.posting_date.startsWith(dateStr);
            });

            if (dayAdjs.length === 0) {
                return { day: dayName, value: 100 };
            }

            let totalItems = 0;
            let totalDiscrepancies = 0;
            dayAdjs.forEach(adj => {
                totalItems += adj.items_count || 0;
                totalDiscrepancies += adj.discrepancy_count || 0;
            });

            const rate = totalItems > 0 ? ((totalItems - totalDiscrepancies) / totalItems) * 100 : 100;
            return { day: dayName, value: Number(rate.toFixed(1)) };
        });

        return result;
    }, [adjustments]);

    // Dynamic Category Data for Donut Chart
    const categoryData = useMemo(() => {
        const counts: Record<string, number> = {};

        adjustments.forEach(adj => {
            if (adj.itemsVariance) {
                adj.itemsVariance.forEach((v: any) => {
                    if (v.item_code) {
                        const category = itemGroupMap[v.item_code] || "Other";
                        counts[category] = (counts[category] || 0) + (v.qty || 0);
                    }
                });
            }
        });

        const colors = ["#1d1f23ff", "#4888f0ff", "#4deea8ff", "#c2c208ff", "rgba(193, 187, 187, 1)"];
        const result = Object.entries(counts)
            .filter(([_, val]) => val > 0)
            .map(([label, value], idx) => ({
                label,
                value,
                color: colors[idx % colors.length]
            }));

        return result;
    }, [adjustments, itemGroupMap]);

    const stats = [
        { title: t('total_skus', 'Total SKUs'), value: totalSkus.toString(), change: 0, isPositive: true, Icon: Package, color: "#3b82f6" },
        { title: t('discrepancies', 'Discrepancies'), value: discrepancies.toString(), change: 0, isPositive: false, Icon: TriangleAlert, color: "#f59e0b" },
        { title: t('accuracy_rate', 'Accuracy Rate'), value: accuracyRate, change: 0, isPositive: true, Icon: CheckCircle2, color: "#16a34a" },
        { title: t('pending_counts', 'Pending Counts'), value: pendingCounts.toString(), change: 0, isPositive: false, Icon: ChartBar, color: "#7c3aed" },
    ];

    const types = [
        { name: t('multi_warehouse', 'Multi-Warehouse'), description: t('multi_warehouse_desc', 'Count items across multiple warehouses'), color: "#3b82f6", Icon: Layers, route: "/stock/multi-warehouse" },
        { name: t('single_warehouse', 'Single Warehouse'), description: t('single_warehouse_desc', 'Count all items in one warehouse'), color: "#16a34a", Icon: Box, route: "/stock/single-warehouse" },
    ];

    const filteredAdjustments = adjustments.filter(adj => {
        if (activeFilter !== "All") {
            const statusMap: Record<string, number> = { "Draft": 0, "Submitted": 1, "Cancelled": 2 };
            if (adj.docstatus !== statusMap[activeFilter]) return false;
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (adj.name?.toLowerCase().includes(query) || adj.set_warehouse?.toLowerCase().includes(query));
        }
        return true;
    });



    const paginatedAdjustments = filteredAdjustments.slice(
        (pageIndex - 1) * ITEMS_PER_PAGE,
        pageIndex * ITEMS_PER_PAGE
    );
    const hasMoreItems = pageIndex * ITEMS_PER_PAGE < filteredAdjustments.length;

    // Stepper
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
                    <Path fill="#dea2e0ff" d="M0,0 L0,220 C400,320 1000,320 1440,240 L1440,0 Z" opacity="0.9" />
                    {/* Main purple/pink gradient wave */}
                    <Path fill="url(#waveGrad)" d="M0,0 L0,220 C400,340 1000,180 1440,160 L1440,0 Z" />
                </Svg>
            </View>

            <View style={[styles.headerTopBar, { justifyContent: 'space-between' }]}>
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
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
            >
                <View style={styles.pageTitleContainer}>
                    <Text style={styles.pageTitleDark}>{t('stock_adjustment', 'Stock Adjustment')}</Text>
                    <Text style={styles.pageSubtitleLight}>{t('stock_adjustment_subtitle', 'Review stock status and reconcile inventory')}</Text>
                </View>

                {/* stat cards:reusable component from component dir*/}
                <View style={styles.statsContainer}>
                    {stats.map((s, i) => <StatCard key={i} {...s} index={i} />)}
                </View>

                {/* Analytics Dropdown Header */}
                <View style={[styles.analyticsHeader, { zIndex: showPicker ? 100 : 1 }]}>
                    <TouchableOpacity
                        style={styles.analyticsHeaderTitle}
                        onPress={() => setAnalyticsOpen(!analyticsOpen)}
                    >
                        <Text style={styles.analyticsTitle}>{t('analytics_charts', 'Analytics & Charts')}</Text>
                        <ChevronRight
                            size={20}
                            color="#94a3b8"
                            style={{ transform: [{ rotate: analyticsOpen ? '90deg' : '0deg' }] }}
                        />
                    </TouchableOpacity>

                    {/* Local Company Picker Chip */}

                </View>

                {analyticsOpen && (
                    <View style={styles.carouselContainer}>
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={(event) => {
                                const slide = Math.round(event.nativeEvent.contentOffset.x / width);
                                if (slide !== activeSlide) {
                                    setActiveSlide(slide);
                                }
                            }}
                            scrollEventThrottle={16}
                            contentContainerStyle={styles.carouselScrollContent}
                        >
                            {/* Slide 1: Variance by Warehouse */}
                            <View style={styles.carouselSlide}>
                                <VarianceChart
                                    data={varianceData}
                                    width={width - 32}
                                    containerStyle={styles.carouselCard}
                                    title={t('variance_by_warehouse', 'Variance by Warehouse')}
                                />
                            </View>

                            {/* Slide 2: Stock by Category */}
                            <View style={styles.carouselSlide}>
                                <View style={styles.carouselCard}>
                                    <Text style={styles.chartTitle}>{t('stock_by_category', 'Stock by Category')}</Text>
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                                        {categoryData.length === 0 ? (
                                            <View style={styles.emptyState}>
                                                <Text style={styles.emptyStateText}>{t('no_category_data', 'No category distribution records')}</Text>
                                            </View>
                                        ) : (
                                            <DonutChart
                                                data={categoryData}
                                                size={120}
                                                strokeWidth={20}
                                            />
                                        )}
                                    </View>
                                </View>
                            </View>

                            {/* Slide 3: Accuracy Trend */}
                            <View style={styles.carouselSlide}>
                                <AccuracyTrendChart
                                    data={accuracyTrendData}
                                    width={width - 32}
                                    title={t('accuracy_trend', 'Accuracy Trend (7 Days)')}
                                    containerStyle={styles.carouselCard}
                                />
                            </View>
                        </ScrollView>

                        {/* Pagination Dots */}
                        <View style={styles.paginationContainer}>
                            {[0, 1, 2].map((i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.paginationDot,
                                        activeSlide === i && styles.paginationDotActive,
                                    ]}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* reconcilation cards */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('select_reconciliation_type', 'Select Reconciliation Type')}</Text>
                </View>
                <View style={styles.reconcileGrid}>
                    {types.map((t, i) => (
                        <ReconcileCard
                            key={i}
                            {...t}
                            index={i}
                            onPress={() => {
                                if (!hasPermission('can_cycle_count')) {
                                    setDeniedFeatureName('Stock Reconciliation / Cycle Count');
                                    setDeniedModalVisible(true);
                                    return;
                                }
                                router.push(t.route as any);
                            }}
                        />
                    ))}
                </View>
                {/*  Adjustments list  buttons*/}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('recent_adjustments', 'Recent Adjustments')}</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
                    {["All", "Draft", "Submitted", "Cancelled"].map((f) => {
                        const icons: any = {
                            "All": Layers,
                            "Draft": Box,
                            "Submitted": CheckCircle2,
                            "Cancelled": TriangleAlert
                        };
                        const IconC = icons[f];
                        const isActive = activeFilter === f;
                        return (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setActiveFilter(f)}
                                style={[styles.filterTag, isActive && styles.filterTagActive]}
                            >
                                {IconC && <IconC size={14} color={isActive ? '#fff' : '#64748b'} />}
                                <Text style={[styles.filterTagText, isActive && styles.filterTagTextActive]}>{t(f.toLowerCase(), f)}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View style={[styles.searchSection, { backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 12 }]}>
                    <GlobalSearchInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={t('search_by_id_warehouse', 'Search by ID or warehouse...')}
                        onScan={async () => {
                            if (!hasPermission('can_cycle_count')) {
                                setDeniedFeatureName('Stock Reconciliation / Cycle Count');
                                setDeniedModalVisible(true);
                                return;
                            }
                            if (!permission?.granted) {
                                const res = await requestPermission();
                                if (!res.granted) {
                                    Alert.alert("Permission Required", "Camera access is needed to scan barcodes.");
                                    return;
                                }
                            }
                            setIsScanning(true);
                        }}
                        containerStyle={{ flex: 1 }}
                    />
                </View>

                <View style={styles.listContainer}>
                    {loading ? (
                        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                            {[1, 2, 3, 4].map(key => (
                                <View key={key} style={styles.skeletonCard}>
                                    <View style={styles.skeletonIconBox} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <View style={styles.skeletonTitle} />
                                        <View style={styles.skeletonSubText} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : paginatedAdjustments.length > 0 ? (
                        paginatedAdjustments.map((item, index) => (
                            <AdjustmentListItem
                                key={item.name}
                                {...item}
                                index={index}
                                onPress={() => {
                                    if (!hasPermission('can_cycle_count')) {
                                        setDeniedFeatureName('Stock Reconciliation / Cycle Count');
                                        setDeniedModalVisible(true);
                                        return;
                                    }
                                    router.push({
                                        pathname: "/stock/single-warehouse",
                                        params: { name: item.name }
                                    } as any);
                                }}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyCardContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Box size={36} color="#7634bc" />
                            </View>
                            <Text style={styles.emptyTitleText}>{t('no_adjustments_found', 'No adjustments found')}</Text>
                            <Text style={styles.emptySubText}>
                                {searchQuery ? t('try_adjusting_search', 'No reconciliations match your search query or selected filter.') : t('no_reconciliations_created', 'No stock reconciliations have been created yet.')}
                            </Text>
                            {(searchQuery.length > 0 || activeFilter !== "All") && (
                                <TouchableOpacity
                                    style={styles.clearFilterButton}
                                    onPress={() => {
                                        setSearchQuery('');
                                        setActiveFilter('All');
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={styles.clearFilterButtonText}>{t('clear_search_filters', 'Reset Search & Filters')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Pagination */}
                    {(pageIndex > 1 || hasMoreItems) && (
                        <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                            <NumberedPagination
                                currentPageIndex={pageIndex - 1}
                                hasMore={hasMoreItems}
                                onNext={() => setPageIndex(p => p + 1)}
                                onPrev={() => setPageIndex(p => Math.max(1, p - 1))}
                            />
                        </View>
                    )}
                </View>
            </ScrollView>

            {isScanning && (
                <Modal visible={isScanning} animationType="slide" transparent={false}>
                    <View style={styles.scannerContainer}>
                        <CameraView
                            onBarcodeScanned={({ data }) => {
                                setSearchQuery(data);
                                setIsScanning(false);
                            }}
                            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13'] }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.scannerOverlay}>
                            <View style={styles.scannerHeader}>
                                <TouchableOpacity style={styles.closeScanner} onPress={() => setIsScanning(false)}>
                                    <X size={24} color="#fff" />
                                </TouchableOpacity>
                                <Text style={styles.scannerTitle}>{t('scan_barcode', 'Scan Barcode')}</Text>
                                <View style={{ width: 40 }} />
                            </View>
                            <View style={styles.scanTarget}>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />
                            </View>
                            <Text style={styles.scanInstructions}>{t('point_camera_at_barc', 'Point camera at barcode')}</Text>
                        </View>
                    </View>
                </Modal>
            )}

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName={deniedFeatureName}
                onClose={() => setDeniedModalVisible(false)}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
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
        paddingTop: 60,
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
        width: 44,
        height: 44,
        backgroundColor: '#1e1b4b15',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
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
    filterIconBtn: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    profileInitial: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    pageTitleContainer: {
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 20,
    },
    pageTitleDark: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        fontFamily: Fonts.sans,
    },
    pageSubtitleLight: {
        fontSize: 14,
        color: '#fff',
        marginTop: 4,
        fontWeight: '500',
        fontFamily: Fonts.sans,
    },

    scrollContent: {
        paddingBottom: 150,
    },

    header: {
        padding: 24,
        paddingBottom: 16,
    },

    title: {
        fontSize: 20,
        fontWeight: "700",
        color: "#0f172a",
        fontFamily: Fonts.sans,
    },

    subtitle: {
        fontSize: 14,
        color: "#64748b",
        marginTop: 4,
        fontFamily: Fonts.sans,
    },

    statsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 20,
        gap: 12,
    },
    analyticsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 16,
        // borderWidth: 1,
        // borderColor: '#f1f5f9',
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
    scannerContainer: { flex: 1, backgroundColor: '#000' },
    scannerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
    scannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, backgroundColor: 'rgba(0,0,0,0.6)' },
    closeScanner: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    scannerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    scanTarget: { width: 250, height: 250, alignSelf: 'center', marginTop: 100, position: 'relative' },
    corner: { position: 'absolute', width: 40, height: 40, borderColor: '#fff' },
    topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
    topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
    bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
    scanInstructions: { color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 16, paddingHorizontal: 20 },
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
        fontFamily: Fonts.sans,
    },

    sectionHeader: {
        paddingHorizontal: 24,
        marginBottom: 16,
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },

    reconcileGrid: {
        flexDirection: "row",
        paddingHorizontal: 24,
        gap: 16,
        marginBottom: 32,
    },

    reconcileCardWrapper: {
        flex: 1,
    },

    reconcileCard: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 28,
        padding: 20,
        borderWidth: 1.5,
        alignItems: "flex-start",
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.04,
        shadowRadius: 24,
        elevation: 8,
    },

    reconcileCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },

    reconcileIconBox: {
        width: 56,
        height: 56,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },

    reconcileArrowBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        justifyContent: "center",
        alignItems: "center",
    },

    reconcileName: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0f172a",
        marginBottom: 8,
        fontFamily: Fonts.sans,
    },

    reconcileDesc: {
        fontSize: 13,
        color: "#64748b",
        lineHeight: 20,
        fontFamily: Fonts.sans,
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
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },

    filterTagActive: {
        backgroundColor: "#7634bcff",
        borderColor: "#7634bcff",
        shadowColor: "#7634bc",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },

    filterTagText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748b",
        fontFamily: Fonts.sans,
    },

    filterTagTextActive: {
        color: "#fff",
        fontFamily: Fonts.sans,
    },

    searchSection: {
        flexDirection: "row",
        paddingHorizontal: 24,
        gap: 12,
        marginBottom: 20,
    },

    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        paddingLeft: 12,
        paddingRight: 4,
        height: 52,
        overflow: 'hidden',
    },

    searchInput: {
        flex: 1,
        height: '100%',
        marginLeft: 10,
        fontSize: 15,
        color: "#1e293b",
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },

    listContainer: {
        paddingHorizontal: 24,
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
    statusBadgeSubmitted: {
        backgroundColor: '#f0fdf4',
    },
    statusBadgeCancelled: {
        backgroundColor: '#fee2e2',
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
    statusTextSubmitted: {
        color: '#16a34a',
    },
    statusTextCancelled: {
        color: '#ef4444',
    },
    activityTime: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
        fontFamily: Fonts.sans,
        flexShrink: 1,
    },
    activityArrow: {
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingLeft: 8,
    },

    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },

    emptyText: {
        color: "#64748b",
        fontWeight: "600",
    },

    // Skeleton loading styles
    skeletonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    skeletonIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
    },
    skeletonTitle: {
        width: '60%',
        height: 14,
        backgroundColor: '#e2e8f0',
        borderRadius: 6,
        marginBottom: 8,
    },
    skeletonSubText: {
        width: '40%',
        height: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
    },

    // Upgraded Empty State Card styles
    emptyCardContainer: {
        padding: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
        borderRadius: 20,
        marginHorizontal: 16,
        marginVertical: 12,
        borderWidth: 1,
        borderColor: "#f1f5f9",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(118, 52, 188, 0.08)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 14,
    },
    emptyTitleText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0f172a",
        marginBottom: 6,
        fontFamily: Fonts.sans,
    },
    emptySubText: {
        fontSize: 13,
        color: "#64748b",
        textAlign: "center",
        lineHeight: 18,
        fontFamily: Fonts.sans,
        marginBottom: 16,
    },
    clearFilterButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "#7634bc",
        borderRadius: 12,
    },
    clearFilterButtonText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
        fontFamily: Fonts.sans,
    },
    //1-4 stepper UI
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 0,
    },
    stepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepCircleActive: {
        backgroundColor: '#7634bc',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    stepCircleCompleted: { backgroundColor: '#10b981' },
    stepCircleInactive: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    stepTextActive: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    stepTextInactive: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    stepDivider: {
        flex: 1,
        height: 2,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 8,
    },
    stepContent: { padding: 20 },
    carouselContainer: {
        marginBottom: 20,
    },
    carouselScrollContent: {
        alignItems: 'center',
    },
    carouselSlide: {
        width: width,
        justifyContent: 'center',
        alignItems: 'center',
    },
    carouselCard: {
        width: width - 32,
        height: 290,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#2d4171',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
        margin: 0,
        marginHorizontal: 16,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 14,
        color: "#111827",
        fontFamily: Fonts.sans,
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        gap: 6,
    },
    paginationDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#cbd5e1',
    },
    paginationDotActive: {
        width: 18,
        backgroundColor: '#7634bc',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
        fontFamily: Fonts.sans,
    },
});