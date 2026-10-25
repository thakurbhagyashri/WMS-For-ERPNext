import { Fonts } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    Activity,
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    Calendar,
    ChevronDown,
    ChevronUp,
    DollarSign,
    Filter,
    Layers,
    MapPin,
    Package, PackageX,
    RefreshCw,
    Search,
    TrendingUp,
    X,
    Eye,
    Download
, ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Modal,
    Animated as RNAnimated,
    Platform,
    RefreshControl,
    useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { TopNavbar } from '@/components/TopNavbar';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { APP_CONFIG } from '@/constants/config';
import { useCompanyContext } from '@/context/CompanyContext';
import { useWarehouseContext } from '@/context/WarehouseContext';

const { width } = Dimensions.get('window');

const PulseSkeleton = ({ style }: any) => {
    const anim = React.useRef(new RNAnimated.Value(0.4)).current;
    React.useEffect(() => {
        RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
                RNAnimated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true })
            ])
        ).start();
    }, []);
    return <RNAnimated.View style={[{ backgroundColor: '#e2e8f0', borderRadius: 8 }, style, { opacity: anim }]} />;
};

type ReportType = 'balance' | 'ledger' | 'ageing';


const getVoucherBg = (type: string) => {
    switch (type) {
        case 'Stock Entry': return '#eff6ff'; // blue
        case 'Delivery Note': return '#fff7ed'; // orange
        case 'Purchase Receipt': return '#f0fdf4'; // green
        case 'Opening': return '#f8fafc'; // light slate
        default: return '#f1f5f9';
    }
};

const getVoucherColor = (type: string) => {
    switch (type) {
        case 'Stock Entry': return '#2563eb';
        case 'Delivery Note': return '#ea580c';
        case 'Purchase Receipt': return '#16a34a';
        case 'Opening': return '#64748b';
        default: return '#64748b';
    }
};

export default function ReportsScreen() {
    const { t } = useTranslation();
    const { type } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);

    useEffect(() => {
        if (!hasPermission('can_stock_lookup')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

    const handleTabPress = (tab: ReportType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveTab(tab);
    };

    const [activeTab, setActiveTab] = useState<ReportType>((type as ReportType) || 'balance');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        if (activeTab === 'ledger') {
            await getStockLedgerData();
        } else if (activeTab === 'balance') {
            await getStockBalanceData();
        } else {
            await getStockAgeingData();
        }
        setRefreshing(false);
    };


    // Helper to format Date to YYYY-MM-DD
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Dynamic default dates: toDate = today, fromDate = 30 days ago
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Filters
    const [filterWarehouse, setFilterWarehouse] = useState('');
    const [fromDate, setFromDate] = useState(formatDate(thirtyDaysAgo));
    const [toDate, setToDate] = useState(formatDate(today));
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
    const { callMethod, baseUrl, company: dynamicCompany, getResource } = useFrappe(APP_CONFIG);
    const { activeCompany, companies } = useCompanyContext();
    const { activeWarehouse, warehouses } = useWarehouseContext();

    // Use company from stored config, fall back to activeCompany
    const [selectedCompany, setSelectedCompany] = useState(activeCompany || dynamicCompany || '');
    const [companyName, setCompanyName] = useState();

    // Compute company list from context
    const companyList = useMemo(() => companies.map((c: any) => c.name), [companies]);

    const [warehouseList, setWarehouseList] = useState<string[]>([]);
    const [itemList, setItemList] = useState<{ item_code: string; item_name: string }[]>([]);

    // Sync selectedCompany with activeCompany on load if empty
    useEffect(() => {
        if (activeCompany && !selectedCompany) {
            setSelectedCompany(activeCompany);
        }
    }, [activeCompany]);

    // Fetch warehouses from Frappe (only needed if selected company differs from active context company)
    const fetchWarehouses = async (company: string) => {
        try {
            if (!company) return;

            const res = await getResource('Warehouse', undefined, {
                fields: JSON.stringify(['name', 'is_group', 'company']),
                filters: JSON.stringify([
                    ['is_group', '=', 0],
                    ['company', '=', company]
                ]),
                limit_page_length: 200,
            });

            const data: any[] = Array.isArray(res) ? res : (res?.data ?? []);
            const warehouses = data.map((w: any) => w.name);
            setWarehouseList(warehouses);

            console.log('Warehouses for company:', company, warehouses.length, warehouseList);
        } catch (err) {
            console.log('[Warehouses] fetch failed:', err);
        }
    };


    // Fetch items from Frappe
    const fetchItems = async () => {
        try {
            const res = await getResource('Item', undefined, {
                fields: JSON.stringify(['item_code', 'item_name']),
                limit_page_length: 200,
            });
            const data: any[] = Array.isArray(res) ? res : (res?.data ?? []);
            if (data.length > 0) {
                setItemList(data.map((i: any) => ({ item_code: i.item_code, item_name: i.item_name })));
            }
        } catch (err) {
            console.log('[Items] fetch failed:', err);
        }
    };

    // Fetch items once when baseUrl is ready
    useEffect(() => {
        if (baseUrl) {
            fetchItems();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseUrl]);

    // Fetch warehouses when company changes
    useEffect(() => {
        if (!baseUrl || !selectedCompany) return;

        if (selectedCompany === activeCompany && warehouses.length > 0) {
            // Use context warehouses if matching active company
            setWarehouseList(warehouses.map(w => w.name));
        } else {
            fetchWarehouses(selectedCompany);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseUrl, selectedCompany, activeCompany, warehouses]);
    useEffect(() => {
        setFilterWarehouse('');
    }, [selectedCompany]);
    const [stockBalanceData, setStockBalanceData] = useState<{
        columns: any[];
        rows: any[];
    } | null>(null);
    const [stockLedgerData, setStockLedgerData] = useState<any[] | null>(null);
    const [stockAgeing, setStockAgeing] = useState<any[] | null>(null);
    const [reportError, setReportError] = useState<string | null>(null);
    const [isRebuilding, setIsRebuilding] = useState(false);

    /**
     * Frappe v14+ returns data rows as objects and the grand total as an array.
     * Old filter (Array.isArray) was backwards — it kept only the total row!
     *
     * This handles both formats:
     *  - Object row  → use directly  (real data rows)
     *  - Array row   → zip with cols (grand total row — then filtered out)
     */
    const parseReportRows = (columns: any[], rows: any[]): any[] => {
        return rows
            .map(row => {
                if (Array.isArray(row)) {
                    const obj: any = {};
                    columns.forEach((col, idx) => { obj[col.fieldname] = row[idx] ?? null; });
                    return obj;
                }
                return row;
            })
            .filter(row => row.item_code != null && row.item_code !== '');
    };

    const getStockBalanceData = async () => {
        if (!baseUrl) {
            console.log('[StockBalance] Skipping — baseUrl not ready yet');
            return;
        }
        setReportError(null);
        setIsLoading(true);
        try {
            const filterPayload: any = {
                company: selectedCompany,
                from_date: fromDate,
                to_date: toDate,
                valuation_field_type: 'Currency',
            };

            if (
                filterWarehouse &&
                warehouseList.includes(filterWarehouse)
            ) {
                filterPayload.warehouse =
                    filterWarehouse;
            }
            console.log('[StockBalance] Calling API with filters:', filterPayload);
            const res = await callMethod(
                'frappe.desk.query_report.run',
                {
                    report_name: 'Stock Balance',
                    filters: JSON.stringify(filterPayload),
                    ignore_prepared_report: 1,
                }
            );
            const columns = res?.columns ?? [];
            const rawRows = res?.result ?? [];
            const parsed = parseReportRows(columns, rawRows);
            console.log('[StockBalance] parsed rows:', parsed.length);
            setStockBalanceData({ columns, rows: parsed });
        } catch (error: any) {
            const msg = error?.message || String(error);
            console.log('[StockBalance] Fetch failed:', msg);
            if (msg.includes('IndexError') || msg.includes('list index out of range')) {
                setReportError(
                    'Warehouse tree data is broken on the server. Please rebuild the tree to view this report.'
                );
            } else {
                setReportError(`Report failed: ${msg}`);
            }
        } finally {
            setIsLoading(false);
        }
    };


    const getStockLedgerData = async () => {
        if (!baseUrl) return;
        setReportError(null);
        setIsLoading(true);
        try {
            const filterPayload: any = {
                company: selectedCompany,
                from_date: fromDate,
                to_date: toDate,
            };
            if (filterWarehouse && warehouseList.includes(filterWarehouse)) {
                filterPayload.warehouse = filterWarehouse;
            }
            console.log('[StockLedger] Calling API with filters:', filterPayload);
            const res = await callMethod(
                'frappe.desk.query_report.run',
                {
                    report_name: 'Stock Ledger',
                    filters: JSON.stringify(filterPayload),
                    ignore_prepared_report: 1,
                }
            );
            const columns = res?.columns ?? [];
            const rawRows = res?.result ?? [];
            const parsed = parseReportRows(columns, rawRows);
            console.log('[StockLedger] parsed rows:', parsed.length);
            setStockLedgerData(parsed);
        } catch (error: any) {
            const msg = error?.message || String(error);
            console.log('[StockLedger] API error:', msg);
            setReportError(msg);
        } finally {
            setIsLoading(false);
        }
    };
    //  access the stock ageing report -------------------------> 
    const getStockAgeingData = async () => {
        try {
            const filterPayload: any = {
                company: selectedCompany,
                from_date: fromDate,
                to_date: toDate,
                range: "30, 60, 90, 120"
            }
            if (filterWarehouse && warehouseList.includes(filterWarehouse)) {
                filterPayload.warehouse = filterWarehouse;

            }
            console.log('[Stock Agening date] calling API with filters:', filterPayload);
            const res = await callMethod(
                'frappe.desk.query_report.run',
                {
                    report_name: 'Stock Ageing',
                    filters: JSON.stringify(filterPayload),
                    ignore_prepared_report: 1
                }
            );
            const columns = res?.columns ?? [];
            const rawRows = res?.result ?? [];
            const parsed = parseReportRows(columns, rawRows);
            console.log('[StockAgening] parsed Rows:', parsed.length)
            setStockAgeing(parsed);
        }
        catch (error: any) {
            const msg = error?.message || String(error);
            console.log('[StockLedger] API error:', msg);
            setReportError(msg);
        } finally {
            setIsLoading(false);
        }
    }

    const handleRebuildTree = async () => {
        if (!baseUrl) return;
        setIsRebuilding(true);
        try {
            // Call the correct whitelisted method in Frappe
            await callMethod('frappe.utils.nestedset.rebuild_tree', {
                doctype: 'Warehouse',
                parent_field: 'parent_warehouse'
            });
            alert('Warehouse tree rebuilt successfully! Reloading report...');
            if (activeTab === 'ledger') {
                getStockLedgerData();
            }
            else if (activeTab === 'balance') {
                getStockBalanceData();

            }
            else {
                getStockAgeingData();
            }

        } catch (error: any) {
            const msg = error?.message || String(error);
            console.log('[RebuildTree] Failed:', msg);
            alert(`Could not rebuild automatically (you may need Admin access).\nServer said: ${msg}`);
        } finally {
            setIsRebuilding(false);
        }
    };
    //   stock  Agening report:


    // Fire when baseUrl is ready AND whenever filters change
    useEffect(() => {
        if (activeTab === 'ledger') {
            getStockLedgerData();
        } else if (activeTab === 'balance') {
            getStockBalanceData();
        } else {
            getStockAgeingData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseUrl, activeTab, fromDate, toDate, filterWarehouse, selectedCompany]);

    // Load More: how many rows to display at a time
    const [visibleCount, setVisibleCount] = useState(10);
    const [selectedRowData, setSelectedRowData] = useState<any>(null);

    // Handle resets
    const handleClearFilters = () => {
        setFilterWarehouse('');
        setSearchQuery('');
        setFromDate(formatDate(thirtyDaysAgo));
        setToDate(formatDate(today));
        setShowFilters(false);
        setVisibleCount(10); // reset pagination on filter clear
        setShowWarehouseDropdown(false);

    };

    // Filter warehouse dropdown options (dynamic)
    const filteredWarehouseOptions = useMemo(() => {
        return warehouseList;
    }, [warehouseList]);

    // Filter data — use live API data for balance & ledger tabs
    const filteredData = useMemo(() => {
        let base: any[] = [];
        if (activeTab === 'balance')
            base = stockBalanceData ? stockBalanceData.rows : [];
        else if (activeTab === 'ledger')
            base = stockLedgerData ?? [];
        else if (activeTab === 'ageing') {
            base = stockAgeing ?? [];
        }

        return base.filter(row => {
            if (filterWarehouse && row.warehouse && row.warehouse !== filterWarehouse) return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchCode = row.item_code?.toLowerCase().includes(q);
                const matchName = row.item_name?.toLowerCase().includes(q);
                const matchWhse = row.warehouse ? row.warehouse.toLowerCase().includes(q) : false;
                if (!matchCode && !matchName && !matchWhse) return false;
            }

            // Date Range Filter (only for Ledger Report)
            if (activeTab === 'ledger' && row.date) {
                const rowDateStr = row.date.split(' ')[0];
                if (fromDate && rowDateStr < fromDate) return false;
                if (toDate && rowDateStr > toDate) return false;
            }

            return true;
        });
    }, [activeTab, stockBalanceData, stockLedgerData, stockAgeing, filterWarehouse, searchQuery, fromDate, toDate]);

    // Rows actually rendered (paginated)
    const pagedData = useMemo(() => filteredData.slice(0, visibleCount), [filteredData, visibleCount]);
    const hasMore = visibleCount < filteredData.length;

    // Count active filters for badge
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterWarehouse) count++;
        if (fromDate !== formatDate(thirtyDaysAgo)) count++;
        if (toDate !== formatDate(today)) count++;
        return count;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterWarehouse, fromDate, toDate]);

    // Filtered company dropdown
    const filteredCompanyOptions = useMemo(() => {
        return companyList;
    }, [companyList]);

    // Top Summary KPIs — dynamic from live data
     
    const summaryKPIs = useMemo(() => {
        if (activeTab === 'balance') {
            const totalItems = filteredData.length;
            const totalQty = filteredData.reduce((acc, cur) => acc + (parseFloat(cur.bal_qty) || 0), 0);
            const totalVal = filteredData.reduce((acc, cur) => acc + (parseFloat(cur.bal_val) || 0), 0);
            const uniqueWarehouses = new Set(filteredData.map(d => d.warehouse).filter(Boolean)).size;

            return [
                { title: 'Total Items', value: totalItems.toLocaleString(), desc: 'Unique SKU entries', color: '#2563eb', bg: '#eff6ff', gradient: ['#3b82f6', '#1d4ed8'], icon: Layers },
                { title: 'Stock Qty', value: totalQty.toLocaleString(undefined, { maximumFractionDigits: 0 }), desc: 'Total current units', color: '#16a34a', bg: '#f0fdf4', gradient: ['#22c55e', '#15803d'], icon: Package },
                { title: 'Valuation', value: `₹${totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, desc: 'Total stock value', color: '#ea580c', bg: '#fff7ed', gradient: ['#f97316', '#c2410c'], icon: DollarSign },
                { title: 'Warehouses', value: uniqueWarehouses.toString(), desc: 'Active locations', color: '#9333ea', bg: '#faf5ff', gradient: ['#a855f7', '#7e22ce'], icon: MapPin }
            ];
        } else if (activeTab === 'ledger') {
            const totalTxns = filteredData.length;
            const inflow = filteredData.filter(t => t.qty_change > 0).reduce((acc, cur) => acc + cur.qty_change, 0);
            const outflow = filteredData.filter(t => t.qty_change < 0).reduce((acc, cur) => acc + Math.abs(cur.qty_change), 0);

            return [
                { title: 'Audit Entries', value: totalTxns.toString(), desc: 'Logs recorded', color: '#2563eb', bg: '#eff6ff', gradient: ['#3b82f6', '#1d4ed8'], icon: Activity },
                { title: 'Stock Inflow', value: `+${inflow}`, desc: 'Added units', color: '#16a34a', bg: '#f0fdf4', gradient: ['#22c55e', '#15803d'], icon: ArrowUpRight },
                { title: 'Stock Outflow', value: `-${outflow}`, desc: 'Dispatched units', color: '#dc2626', bg: '#fef2f2', gradient: ['#ef4444', '#b91c1c'], icon: ArrowDownRight },
                { title: 'Active SKUs', value: '—', desc: 'Tracked Items', color: '#9333ea', bg: '#faf5ff', gradient: ['#a855f7', '#7e22ce'], icon: Package }
            ];
        } else {
            const totalQty = filteredData.reduce((acc, cur) => acc + (cur.bal_qty || 0), 0);
            const over90dQty = filteredData.reduce((acc, cur) => acc + (cur.range_4 || 0), 0);
            const slowRatio = totalQty > 0 ? ((over90dQty / totalQty) * 100).toFixed(0) : '0';

            return [
                { title: 'Total Stock', value: totalQty.toLocaleString(), desc: 'Aged units count', color: '#2563eb', bg: '#eff6ff', gradient: ['#3b82f6', '#1d4ed8'], icon: Calendar },
                { title: '90d+ Deadstock', value: over90dQty.toLocaleString(), desc: 'Slowest moving', color: '#dc2626', bg: '#fef2f2', gradient: ['#ef4444', '#b91c1c'], icon: AlertTriangle },
                { title: 'Slow Ratio', value: `${slowRatio}%`, desc: 'Ratio of 90d+', color: '#ea580c', bg: '#fff7ed', gradient: ['#f97316', '#c2410c'], icon: TrendingUp },
                { title: 'Under 30 Days', value: '—', desc: 'Healthy turn rate', color: '#16a34a', bg: '#f0fdf4', gradient: ['#22c55e', '#15803d'], icon: Layers }
            ];
        }
    }, [activeTab, filteredData]);

    const handleExportCSV = async () => {
        if (!filteredData || filteredData.length === 0) {
            alert(t('no_data_to_export', 'No data available to export'));
            return;
        }

        try {
            // Get columns depending on the activeTab
            let columns: string[] = [];
            if (activeTab === 'balance' && stockBalanceData?.columns) {
                columns = stockBalanceData.columns.map(c => c.fieldname);
            } else if (activeTab === 'ledger' || activeTab === 'ageing') {
                // Determine keys from the first object
                columns = Object.keys(filteredData[0]).filter(k => typeof filteredData[0][k] !== 'object');
            }

            if (columns.length === 0) {
                alert('No columns found for export.');
                return;
            }

            // Create CSV Header
            const headerRow = columns.join(',');

            // Create rows
            const csvRows = filteredData.map(row => {
                return columns.map(col => {
                    let val = row[col];
                    if (val === null || val === undefined) val = '';
                    // Escape quotes and wrap in quotes to handle commas safely
                    const valStr = String(val).replace(/"/g, '""');
                    return `"${valStr}"`;
                }).join(',');
            });

            const csvContent = [headerRow, ...csvRows].join('\n');

            // Write to file
            const fileName = `Export_${activeTab}_${formatDate(new Date())}.csv`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(fileUri, csvContent);

            // Share file
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: `Export ${activeTab} data`,
                    UTI: 'public.comma-separated-values-text'
                });
            } else {
                alert('Sharing is not available on this device');
            }
        } catch (error) {
            console.error('Export Error:', error);
            alert('Failed to export data');
        }
    };

    return (
        <View style={styles.container}>
            {/* SVG Background Wave */}
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

            {/* Custom Header with Back Button */}
            <View style={[styles.headerTopBar, { paddingTop: Math.max(insets.top, 12) }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtnLight}
                    >
                        <ArrowLeft size={22} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitleLight}>{t('reports', 'Reports')}</Text>
                </View>
                {/* Optional export button could go here if wanted at top */}
            </View>

            {/* Premium Swipeable Selector Tabs */}
            <View style={styles.tabContainerWrapper}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabScrollContent}
                >
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'balance' && styles.tabActive]}
                        onPress={() => handleTabPress('balance')}
                    >
                        <Layers size={16} color={activeTab === 'balance' ? '#fff' : 'rgba(255,255,255,0.7)'} />
                        <Text style={[styles.tabText, activeTab === 'balance' && styles.tabTextActive]}>
                            {t('stock_balance', 'Stock Balance')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'ledger' && styles.tabActive]}
                        onPress={() => handleTabPress('ledger')}
                    >
                        <Activity size={16} color={activeTab === 'ledger' ? '#fff' : 'rgba(255,255,255,0.7)'} />
                        <Text style={[styles.tabText, activeTab === 'ledger' && styles.tabTextActive]}>
                            {t('stock_ledger', 'Stock Ledger')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'ageing' && styles.tabActive]}
                        onPress={() => handleTabPress('ageing')}
                    >
                        <Calendar size={16} color={activeTab === 'ageing' ? '#fff' : 'rgba(255,255,255,0.7)'} />
                        <Text style={[styles.tabText, activeTab === 'ageing' && styles.tabTextActive]}>
                            {t('stock_ageing', 'Stock Ageing')}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 40) }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
            >


                {/* 3. Filters (Collapsible & Pill Search UI) */}
                <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.searchContainer}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <GlobalSearchInput
                                placeholder="Search by item or location..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.filterIconButton,
                                (filterWarehouse || fromDate !== formatDate(thirtyDaysAgo) || toDate !== formatDate(today)) && styles.filterIconActive,
                                { backgroundColor: '#fff', borderRadius: 12, padding: 12, height: 48, justifyContent: 'center' }
                            ]}
                            onPress={() => setShowFilters(!showFilters)}
                        >
                            <Filter size={18} color={showFilters ? '#2563eb' : activeFilterCount > 0 ? '#16a34a' : '#64748b'} />
                            {activeFilterCount > 0 && (
                                <View style={styles.filterBadge}>
                                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Active Filter Chips */}
                {!!filterWarehouse && (
                    <Animated.View entering={FadeInDown.duration(300)} style={styles.filterChipsRow}>
                        <TouchableOpacity style={styles.filterChip} onPress={() => setFilterWarehouse('')}>
                            <MapPin size={11} color="#2563eb" />
                            <Text style={styles.filterChipText} numberOfLines={1}>{filterWarehouse.split(' - ')[0]}</Text>
                            <X size={11} color="#94a3b8" />
                        </TouchableOpacity>
                    </Animated.View>
                )}


                {/* Data Table Header */}
                <View style={styles.listHeaderRow}>
                    <View>
                        <Text style={styles.listHeaderTitle}>
                            {activeTab === 'balance' && 'Inventory Balances'}
                            {activeTab === 'ledger' && 'Transaction Ledger'}
                            {activeTab === 'ageing' && 'Ageing Batches'}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                            onPress={handleExportCSV}
                            style={{ padding: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Download size={14} color="#a21caf" />
                            <Text style={{ fontSize: 12, color: '#a21caf', fontWeight: 'bold' }}>{t('export', 'Export')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => activeTab === 'ledger' ? getStockLedgerData() : getStockBalanceData()}
                            style={{ padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8 }}
                        >
                            <RefreshCw size={14} color="#64748b" />
                        </TouchableOpacity>
                        <View style={{ padding: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Layers size={14} color="#a21caf" />
                            <Text style={{ fontSize: 12, color: '#a21caf', fontWeight: 'bold' }}>{filteredData.length} records</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.ledgerListWrapper}>
                    {isLoading ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
                            <View>
                                <View style={styles.tableHeaderRow}>
                                    <View style={[styles.tableHeaderCell, { width: 150 }]}><PulseSkeleton style={{ width: '60%', height: 14 }} /></View>
                                    <View style={[styles.tableHeaderCell, { width: 200 }]}><PulseSkeleton style={{ width: '80%', height: 14 }} /></View>
                                    <View style={[styles.tableHeaderCell, { width: 150 }]}><PulseSkeleton style={{ width: '70%', height: 14 }} /></View>
                                    <View style={[styles.tableHeaderCell, { width: 150 }]}><PulseSkeleton style={{ width: '50%', height: 14 }} /></View>
                                    <View style={[styles.tableHeaderCell, { width: 150 }]}><PulseSkeleton style={{ width: '60%', height: 14 }} /></View>
                                </View>
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlternate]}>
                                        <View style={[styles.tableCell, { width: 150 }]}><PulseSkeleton style={{ width: '80%', height: 16 }} /></View>
                                        <View style={[styles.tableCell, { width: 200 }]}><PulseSkeleton style={{ width: '90%', height: 16 }} /></View>
                                        <View style={[styles.tableCell, { width: 150 }]}><PulseSkeleton style={{ width: '70%', height: 16 }} /></View>
                                        <View style={[styles.tableCell, { width: 150 }]}><PulseSkeleton style={{ width: '80%', height: 16 }} /></View>
                                        <View style={[styles.tableCell, { width: 150 }]}><PulseSkeleton style={{ width: '70%', height: 16 }} /></View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    ) : filteredData.length > 0 ? (
                        activeTab === 'ledger' ? (
                            <>
                                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
                                    <View>
                                        {/* Table Header */}
                                        <View style={styles.tableHeaderRow}>
                                            <View style={[styles.tableHeaderCell, { width: 140 }]}><Text style={styles.tableHeaderCellText}>{t('date', 'Date')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 110 }]}><Text style={styles.tableHeaderCellText}>{t('item', 'Item')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 180 }]}><Text style={styles.tableHeaderCellText}>{t('item_name', 'Item Name')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100 }]}><Text style={styles.tableHeaderCellText}>{t('stock_uom', 'Stock UOM')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('box_in_qty', 'Box In Qty')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('in_qty_per_ah', 'In Qty (Per AH)')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 80, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('out_qty', 'Out Qty')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('out_qty_per_ah', 'Out Qty (Per AH)')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('balance_qty', 'Balance Qty')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 140, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('balance_qty_per_ah', 'Balance Qty (Per AH)')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 180 }]}><Text style={styles.tableHeaderCellText}>{t('warehouse', 'Warehouse')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120 }]}><Text style={styles.tableHeaderCellText}>{t('item_group', 'Item Group')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100 }]}><Text style={styles.tableHeaderCellText}>{t('brand', 'Brand')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 200 }]}><Text style={styles.tableHeaderCellText}>{t('description', 'Description')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('incoming_rate', 'Incoming Rate')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 150, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('incoming_rate_per_ah', 'Incoming Rate (Per AH)')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 160, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('avg_rate_bal_stock', 'Avg Rate (Bal Stock)')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 200, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('avg_rate_bal_stock_p', 'Avg Rate (Bal Stock) (Per AH)')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('valuation_rate', 'Valuation Rate')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 160, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('valuation_rate_per_a', 'Valuation Rate (Per AH)')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('balance_value', 'Balance Value')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('value_change', 'Value Change')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 130 }]}><Text style={styles.tableHeaderCellText}>{t('voucher_type', 'Voucher Type')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 130 }]}><Text style={styles.tableHeaderCellText}>{t('voucher', 'Voucher #')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100 }]}><Text style={styles.tableHeaderCellText}>{t('batch', 'Batch')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100 }]}><Text style={styles.tableHeaderCellText}>{t('serial_no', 'Serial No')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 180 }]}><Text style={styles.tableHeaderCellText}>{t('serial_batch_bundle', 'Serial & Batch Bundle')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120 }]}><Text style={styles.tableHeaderCellText}>{t('project', 'Project')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 180 }]}><Text style={styles.tableHeaderCellText}>{t('company', 'Company')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100, alignItems: 'center' }]}><Text style={styles.tableHeaderCellText}>{t('action', 'Action')}</Text></View>
                                        </View>

                                        {/* Table Body */}
                                        {pagedData.map((item, idx) => {
                                            const isEven = idx % 2 === 0;
                                            const isOpening = item.voucher_type === 'Opening';
                                            const n = (v: any) => parseFloat(v ?? 0) || 0;
                                            return (
                                                <View key={idx} style={[styles.tableRow, isEven && styles.tableRowAlternate]}>
                                                    <View style={[styles.tableCell, { width: 140 }]}><Text style={styles.tableCellText}>{item.date}</Text></View>
                                                    <View style={[styles.tableCell, { width: 110 }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>{item.item_code}</Text></View>
                                                    <View style={[styles.tableCell, { width: 180 }]}><Text style={styles.tableCellText} numberOfLines={1}>{item.item_name}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100 }]}><Text style={styles.tableCellText}>{item.stock_uom}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>{n(item.box_in_qty).toFixed(3)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, !isOpening && n(item.in_qty_per_ah) > 0 && { color: '#16a34a', fontWeight: '500' }]}>{isOpening ? '0.000' : n(item.in_qty_per_ah) > 0 ? `+${n(item.in_qty_per_ah).toFixed(3)}` : '-'}</Text></View>
                                                    <View style={[styles.tableCell, { width: 80, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, !isOpening && n(item.out_qty) > 0 && { color: '#ef4444', fontWeight: '500' }]}>{isOpening ? '0.000' : n(item.out_qty) > 0 ? `-${n(item.out_qty).toFixed(3)}` : '-'}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, !isOpening && n(item.out_qty_per_ah) > 0 && { color: '#ef4444', fontWeight: '500' }]}>{isOpening ? '0.000' : n(item.out_qty_per_ah) > 0 ? `-${n(item.out_qty_per_ah).toFixed(3)}` : '-'}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>{n(item.bal_qty).toFixed(3)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 140, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>{n(item.bal_qty_per_ah).toFixed(3)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 180 }]}><Text style={styles.tableCellText} numberOfLines={1}>{item.warehouse}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120 }]}><Text style={styles.tableCellText}>{item.item_group}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100 }]}><Text style={styles.tableCellText}>{item.brand}</Text></View>
                                                    <View style={[styles.tableCell, { width: 200 }]}><Text style={styles.tableCellText} numberOfLines={1}>{item.description}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>₹ {n(item.incoming_rate).toFixed(2)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 150, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>₹ {n(item.incoming_rate_per_ah).toFixed(2)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 160, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>₹ {n(item.avg_rate).toFixed(2)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 200, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>₹ {n(item.avg_rate_per_ah).toFixed(2)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>₹ {n(item.valuation_rate).toFixed(2)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 160, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>₹ {n(item.valuation_rate_per_ah).toFixed(2)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>₹ {n(item.bal_val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>₹ {n(item.value_change).toFixed(2)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 130 }]}>
                                                        <View style={[styles.voucherBadge, { backgroundColor: getVoucherBg(item.voucher_type) }]}>
                                                            <Text style={[styles.voucherBadgeText, { color: getVoucherColor(item.voucher_type) }]}>{item.voucher_type}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={[styles.tableCell, { width: 130 }]}><Text style={[styles.tableCellText, { color: '#2563eb', fontWeight: '500' }]}>{item.voucher_no}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100 }]}><Text style={styles.tableCellText}>{item.batch}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100 }]}><Text style={styles.tableCellText}>{item.serial_no}</Text></View>
                                                    <View style={[styles.tableCell, { width: 180 }]}><Text style={styles.tableCellText}>{item.serial_batch_bundle}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120 }]}><Text style={styles.tableCellText}>{item.project}</Text></View>
                                                    <View style={[styles.tableCell, { width: 180 }]}><Text style={styles.tableCellText} numberOfLines={1}>{item.company}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100, alignItems: 'center', justifyContent: 'center' }]}>
                                                        <TouchableOpacity onPress={() => setSelectedRowData(item)} style={{ padding: 6, borderRadius: 8 }}>
                                                            <Eye size={16} color="#a21caf" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </ScrollView>

                                {/* Load More for Ledger */}
                                {hasMore && (
                                    <TouchableOpacity
                                        onPress={() => setVisibleCount(v => v + 20)}
                                        style={{
                                            margin: 16,
                                            paddingVertical: 14,
                                            borderRadius: 14,
                                            backgroundColor: '#7634bc',
                                            alignItems: 'center',
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            gap: 8,
                                            shadowColor: '#7634bc',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 8,
                                            elevation: 4,
                                        }}
                                    >
                                        <ChevronDown size={16} color="#fff" />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, fontFamily: Fonts.sans }}>
                                            {t('load_more', 'Load More')}
                                        </Text>
                                        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', fontFamily: Fonts.sans }}>
                                                {filteredData.length - visibleCount} left
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : activeTab === 'balance' ? (
                            <>
                                {/* Server error banner */}
                                {!!reportError && (
                                    <View style={{ margin: 16, padding: 16, backgroundColor: '#fef2f2', borderRadius: 16, borderWidth: 1, borderColor: '#fca5a5' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <AlertTriangle size={16} color="#dc2626" />
                                            <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 14 }}>{t('report_error', 'Report Error')}</Text>
                                        </View>
                                        <Text style={{ color: '#b91c1c', fontSize: 12, marginBottom: 12, lineHeight: 18 }}>{reportError}</Text>

                                        {reportError.includes('Warehouse tree') && (
                                            <TouchableOpacity
                                                onPress={handleRebuildTree}
                                                disabled={isRebuilding}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    backgroundColor: '#dc2626',
                                                    paddingVertical: 10,
                                                    paddingHorizontal: 16,
                                                    borderRadius: 10,
                                                    alignSelf: 'flex-start',
                                                    opacity: isRebuilding ? 0.7 : 1
                                                }}
                                            >
                                                <RefreshCw size={14} color="#fff" />
                                                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                                                    {isRebuilding ? 'Rebuilding...' : 'Rebuild Warehouse Tree'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
                                    <View>
                                        {/* Table Header */}
                                        <View style={styles.tableHeaderRow}>
                                            <View style={[styles.tableHeaderCell, { width: 110 }]}><Text style={styles.tableHeaderCellText}>{t('item', 'Item')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 180 }]}><Text style={styles.tableHeaderCellText}>{t('item_name', 'Item Name')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 140 }]}><Text style={styles.tableHeaderCellText}>{t('warehouse', 'Warehouse')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('balance_qty', 'Balance Qty')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('balance_value', 'Balance Value')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100, alignItems: 'center' }]}><Text style={styles.tableHeaderCellText}>{t('action', 'Action')}</Text></View>
                                        </View>

                                        {/* Table Body */}
                                        {pagedData.map((item, idx) => {
                                            const isEven = idx % 2 === 0;
                                            // Frappe returns numbers as strings or null — convert safely
                                            const n = (v: any) => parseFloat(v ?? 0) || 0;
                                            return (
                                                <View key={idx} style={[styles.tableRow, isEven && styles.tableRowAlternate]}>
                                                    <View style={[styles.tableCell, { width: 110 }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>{item.item_code}</Text></View>
                                                    <View style={[styles.tableCell, { width: 180 }]}><Text style={styles.tableCellText} numberOfLines={1}>{item.item_name}</Text></View>
                                                    <View style={[styles.tableCell, { width: 140 }]}><Text style={styles.tableCellText} numberOfLines={1}>{item.warehouse?.split(' - ')[0] || item.warehouse}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>{n(item.bal_qty).toFixed(3)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>₹ {n(item.bal_val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100, alignItems: 'center', justifyContent: 'center' }]}>
                                                        <TouchableOpacity onPress={() => setSelectedRowData(item)} style={{ padding: 6, borderRadius: 8 }}>
                                                            <Eye size={16} color="#a21caf" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </ScrollView>

                                {/* Load More */}
                                {hasMore && (
                                    <TouchableOpacity
                                        onPress={() => setVisibleCount(v => v + 20)}
                                        style={{
                                            margin: 16,
                                            paddingVertical: 14,
                                            borderRadius: 14,
                                            backgroundColor: '#7634bc',
                                            alignItems: 'center',
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            gap: 8,
                                            shadowColor: '#7634bc',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 8,
                                            elevation: 4,
                                        }}
                                    >
                                        <ChevronDown size={16} color="#fff" />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, fontFamily: Fonts.sans }}>
                                            {t('load_more', 'Load More')}
                                        </Text>
                                        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', fontFamily: Fonts.sans }}>
                                                {filteredData.length - visibleCount} left
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <>
                                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
                                    <View>
                                        {/* Table Header */}
                                        <View style={styles.tableHeaderRow}>
                                            <View style={[styles.tableHeaderCell, { width: 110 }]}><Text style={styles.tableHeaderCellText}>{t('item', 'Item')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 180 }]}><Text style={styles.tableHeaderCellText}>{t('item_name', 'Item Name')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 140 }]}><Text style={styles.tableHeaderCellText}>{t('warehouse', 'Warehouse')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('average_age', 'Average Age')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 120, alignItems: 'flex-end' }]}><Text style={styles.tableHeaderCellText}>{t('total_qty', 'Total Qty')}</Text></View>
                                            <View style={[styles.tableHeaderCell, { width: 100, alignItems: 'center' }]}><Text style={styles.tableHeaderCellText}>{t('action', 'Action')}</Text></View>
                                        </View>

                                        {/* Table Body */}
                                        {pagedData.map((item, idx) => {
                                            const isEven = idx % 2 === 0;
                                            const n = (v: any) => parseFloat(v ?? 0) || 0;
                                            return (
                                                <View key={idx} style={[styles.tableRow, isEven && styles.tableRowAlternate]}>
                                                    <View style={[styles.tableCell, { width: 110 }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>{item.item_code}</Text></View>
                                                    <View style={[styles.tableCell, { width: 180 }]}><Text style={styles.tableCellText} numberOfLines={1}>{item.item_name}</Text></View>
                                                    <View style={[styles.tableCell, { width: 140 }]}><Text style={styles.tableCellText} numberOfLines={1}>{item.warehouse?.split(' - ')[0] || item.warehouse}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100, alignItems: 'flex-end' }]}><Text style={styles.tableCellText}>{n(item.average_age)} days</Text></View>
                                                    <View style={[styles.tableCell, { width: 120, alignItems: 'flex-end' }]}><Text style={[styles.tableCellText, styles.tableCellTextBold]}>{n(item.bal_qty).toFixed(3)}</Text></View>
                                                    <View style={[styles.tableCell, { width: 100, alignItems: 'center', justifyContent: 'center' }]}>
                                                        <TouchableOpacity onPress={() => setSelectedRowData(item)} style={{ padding: 6, borderRadius: 8 }}>
                                                            <Eye size={16} color="#a21caf" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </ScrollView>

                                {/* Load More for Ageing */}
                                {hasMore && (
                                    <TouchableOpacity
                                        onPress={() => setVisibleCount(v => v + 20)}
                                        style={{
                                            margin: 16,
                                            paddingVertical: 14,
                                            borderRadius: 14,
                                            backgroundColor: '#7634bc',
                                            alignItems: 'center',
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            gap: 8,
                                            shadowColor: '#7634bc',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 8,
                                            elevation: 4,
                                        }}
                                    >
                                        <ChevronDown size={16} color="#fff" />
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, fontFamily: Fonts.sans }}>
                                            {t('load_more', 'Load More')}
                                        </Text>
                                        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', fontFamily: Fonts.sans }}>
                                                {filteredData.length - visibleCount} left
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </>
                        )
                    ) : (
                        <View style={styles.emptyCard}>
                            <View style={styles.emptyIconWrapper}>
                                <Search size={28} color="#cbd5e1" />
                            </View>
                            <Text style={styles.emptyTitle}>{t('no_results_found', 'No Results Found')}</Text>
                            <Text style={styles.emptyText}>{t('try_adjusting_your_f', 'Try adjusting your filters or search terms')}</Text>
                            {!!(filterWarehouse || searchQuery) && (
                                <TouchableOpacity style={styles.emptyResetBtn} onPress={handleClearFilters}>
                                    <RefreshCw size={14} color="#2563eb" />
                                    <Text style={styles.emptyResetText}>{t('clear_all_filters', 'Clear All Filters')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

            </ScrollView>

            {/* Modal Filter Overlay */}
            <Modal
                visible={showFilters}
                transparent={true}
                statusBarTranslucent={true}
                animationType="fade"
                onRequestClose={() => setShowFilters(false)}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeInUp.duration(300)} style={[styles.filterCardWrapper, { padding: 0, overflow: 'hidden' }]}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', width: '100%' }}>
                            {/* 20% Brand Header */}
                            <LinearGradient
                                colors={['#7634bc', '#2e1065']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Filter size={18} color="#fff" />
                                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', fontFamily: Fonts.sans }}>{t('filters', 'Filters')}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowFilters(false)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                    <X size={20} color="#fff" />
                                </TouchableOpacity>
                            </LinearGradient>

                            <ScrollView
                                style={{ flexShrink: 1, padding: 16 }}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 10 }}
                                keyboardShouldPersistTaps="handled"
                                nestedScrollEnabled={true}
                            >
                                {/* Company Selector */}
                                <View style={[styles.filterInputGroup, { zIndex: 1000, elevation: 1000 }]}>
                                    <Text style={styles.filterLabel}>{t('company', 'Company')}</Text>
                                    <TouchableOpacity
                                        style={styles.filterInputWrapper}
                                        onPress={() => setShowCompanyDropdown(!showCompanyDropdown)}
                                        activeOpacity={0.7}
                                    >
                                        <Package size={16} color="#64748b" />
                                        <Text style={[styles.filterInput, { paddingVertical: 12 }]} numberOfLines={1}>
                                            {selectedCompany || 'Select Company'}
                                        </Text>
                                        {showCompanyDropdown ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                                    </TouchableOpacity>

                                    {showCompanyDropdown && filteredCompanyOptions.length > 0 && (
                                        <Animated.View entering={FadeInDown.duration(200)} style={styles.dropdownBox}>
                                            <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                                                {filteredCompanyOptions.map((company) => (
                                                    <TouchableOpacity
                                                        key={company}
                                                        style={[styles.dropdownOption, selectedCompany === company && styles.dropdownOptionActive]}
                                                        onPress={() => {
                                                            setSelectedCompany(company);
                                                            setShowCompanyDropdown(false);
                                                        }}
                                                    >
                                                        <Text style={[styles.dropdownOptionText, selectedCompany === company && { color: '#2563eb', fontWeight: 'bold' }]}>
                                                            {company}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </Animated.View>
                                    )}
                                </View>

                                {/* Warehouse Selector */}
                                <View style={[styles.filterInputGroup, { zIndex: 500, elevation: 500 }]}>
                                    <Text style={styles.filterLabel}>{t('warehouse_location', 'Warehouse Location')}</Text>
                                    <TouchableOpacity
                                        style={styles.filterInputWrapper}
                                        onPress={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
                                        activeOpacity={0.7}
                                    >
                                        <MapPin size={16} color="#64748b" />
                                        <Text style={[styles.filterInput, { paddingVertical: 12 }]} numberOfLines={1}>
                                            {filterWarehouse || 'Select Warehouse'}
                                        </Text>
                                        {showWarehouseDropdown ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                                    </TouchableOpacity>
                                    {showWarehouseDropdown && filteredWarehouseOptions.length > 0 && (
                                        <Animated.View entering={FadeInDown.duration(200)} style={styles.dropdownBox}>
                                            <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ maxHeight: 120 }}>
                                                {filteredWarehouseOptions.map((wh) => (
                                                    <TouchableOpacity
                                                        key={wh}
                                                        style={[styles.dropdownOption, filterWarehouse === wh && styles.dropdownOptionActive]}
                                                        onPress={() => {
                                                            setFilterWarehouse(wh);
                                                            setShowWarehouseDropdown(false);
                                                        }}
                                                    >
                                                        <Text style={[styles.dropdownOptionText, filterWarehouse === wh && { color: '#2563eb', fontWeight: 'bold' }]}>
                                                            {wh}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </Animated.View>
                                    )}
                                </View>

                                {/* Date Range Fields */}
                                <View style={styles.filterDateRow}>
                                    <View style={[styles.filterInputGroup, { flex: 1, marginRight: 8 }]}>
                                        <Text style={styles.filterLabel}>{t('from_date', 'From Date')}</Text>
                                        <TouchableOpacity style={styles.filterInputWrapper} onPress={() => setShowFromPicker(true)}>
                                            <Calendar size={16} color="#64748b" />
                                            <Text style={[styles.filterInput, { paddingVertical: 12 }]} numberOfLines={1}>
                                                {fromDate}
                                            </Text>
                                        </TouchableOpacity>
                                        {showFromPicker && (
                                            <DateTimePicker
                                                value={new Date(fromDate)}
                                                mode="date"
                                                display="default"
                                                onChange={(event, selectedDate) => {
                                                    setShowFromPicker(Platform.OS === 'ios');
                                                    if (selectedDate) setFromDate(formatDate(selectedDate));
                                                }}
                                            />
                                        )}
                                    </View>
                                    <View style={[styles.filterInputGroup, { flex: 1, marginLeft: 8 }]}>
                                        <Text style={styles.filterLabel}>{t('to_date', 'To Date')}</Text>
                                        <TouchableOpacity style={styles.filterInputWrapper} onPress={() => setShowToPicker(true)}>
                                            <Calendar size={16} color="#64748b" />
                                            <Text style={[styles.filterInput, { paddingVertical: 12 }]} numberOfLines={1}>
                                                {toDate}
                                            </Text>
                                        </TouchableOpacity>
                                        {showToPicker && (
                                            <DateTimePicker
                                                value={new Date(toDate)}
                                                mode="date"
                                                display="default"
                                                onChange={(event, selectedDate) => {
                                                    setShowToPicker(Platform.OS === 'ios');
                                                    if (selectedDate) setToDate(formatDate(selectedDate));
                                                }}
                                            />
                                        )}
                                    </View>
                                </View>

                                {/* Actions */}
                                <View style={styles.filterActionRow}>
                                    <TouchableOpacity style={styles.filterResetBtn} onPress={handleClearFilters}>
                                        <Text style={styles.filterResetText}>{t('reset', 'Reset')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.filterApplyBtn} onPress={() => setShowFilters(false)}>
                                        <Text style={styles.filterApplyText}>{t('apply_filters', 'Apply Filters')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            {/* Single Row Details Modal — premium 80/20 design */}
            <Modal visible={!!selectedRowData} transparent={true} statusBarTranslucent={true} animationType="slide" onRequestClose={() => setSelectedRowData(null)}>
                <View style={styles.modalOverlay}>
                    <Animated.View
                        entering={FadeInUp.duration(320).springify().damping(20)}
                        style={[styles.filterCardWrapper, { backgroundColor: '#fff', height: '85%', marginTop: 'auto', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, overflow: 'hidden', padding: 0 }]}
                    >
                        {/* 20% Brand Header */}
                        <LinearGradient
                            colors={['#7634bc', '#2e1065']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ padding: 20, paddingTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', fontFamily: Fonts.sans }}>{t('record_details', 'Record Details')}</Text>
                                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontFamily: Fonts.sans }}>
                                    {selectedRowData?.item_code || selectedRowData?.item_name || t('showing_all_availabl', 'All fields')}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setSelectedRowData(null)}
                                style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                            >
                                <X size={20} color="#fff" />
                            </TouchableOpacity>
                        </LinearGradient>

                        {/* 80% Content Zone */}
                        <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                            {selectedRowData && (
                                <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9' }}>
                                    {Object.keys(selectedRowData).filter(k => typeof selectedRowData[k] !== 'object' && selectedRowData[k] !== null && selectedRowData[k] !== '').map((key, idx) => {
                                        const val = selectedRowData[key];
                                        const displayVal = typeof val === 'number' ? (Number.isInteger(val) ? val.toString() : val.toFixed(3)) : String(val);
                                        const isEven = idx % 2 === 0;
                                        return (
                                            <View key={key} style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: isEven ? '#fff' : '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                                <View style={{ width: 4, borderRadius: 2, backgroundColor: '#7634bc', marginRight: 12, alignSelf: 'stretch' }} />
                                                <Text style={{ flex: 1.2, color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'capitalize', fontFamily: Fonts.sans }}>{key.replace(/_/g, ' ')}</Text>
                                                <Text style={{ flex: 1.8, color: '#0f172a', fontSize: 13, fontWeight: '600', fontFamily: Fonts.sans }} selectable={true}>{displayVal}</Text>
                                            </View>
                                        );
                                    })}
                                </Animated.View>
                            )}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Stock Reports"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_stock_lookup')) {
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
        backgroundColor: '#f1f5f9',
    },
    tabContainerWrapper: {
        backgroundColor: 'transparent',
        borderBottomWidth: 0,
        marginBottom: 10,
    },
    tabScrollContent: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        marginRight: 12,
    },
    tabActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderColor: 'rgba(255, 255, 255, 0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.7)',
        marginLeft: 6,
        fontFamily: Fonts.sans,
    },
    tabTextActive: {
        color: '#fff',
    },
    scrollContent: {
        paddingTop: 16,
        paddingBottom: 40,
    },
    kpiGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 10,
        marginBottom: 16,
    },
    kpiCell: {
        width: (Dimensions.get('window').width - 42) / 2,
        borderRadius: 18,
        padding: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
        elevation: 4,
    },
    kpiCellHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    kpiCellTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
        fontFamily: Fonts.sans,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    kpiIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    kpiCellVal: {
        fontSize: 20,
        fontWeight: '900',
        fontFamily: Fonts.sans,
    },
    kpiCellDesc: {
        fontSize: 10,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
        marginTop: 4,
    },
    // Loading banner
    loadingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 16,
        marginBottom: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        gap: 8,
    },
    loadingText: {
        fontSize: 12,
        color: '#2563eb',
        fontWeight: '600',
        fontFamily: Fonts.sans,
    },
    // Filter chips
    filterChipsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 10,
        gap: 8,
        flexWrap: 'wrap',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        maxWidth: (width - 48) / 2,
    },
    filterChipText: {
        fontSize: 11,
        color: '#334155',
        fontWeight: '600',
        fontFamily: Fonts.sans,
    },
    // Filter badge on filter icon
    filterBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    dropdownOptionActive: {
        backgroundColor: '#eff6ff',
    },
    graphSectionCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 15,
        elevation: 8,
    },
    graphHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    graphHeaderIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    graphTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    graphSubtitle: {
        fontSize: 10,
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    chartWrapper: {
        height: 150,
        justifyContent: 'flex-end',
    },
    chartCanvas: {
        height: 120,
        position: 'relative',
        width: '100%',
    },
    gridVerticalLine: {
        position: 'absolute',
        top: 15,
        bottom: 0,
        width: 1,
        backgroundColor: '#f1f5f9',
    },
    chartLineSegment: {
        position: 'absolute',
        height: 3,
        backgroundColor: '#2563eb', // Indigo Blue line
        borderRadius: 2,
        zIndex: 5,
        transformOrigin: 'top left',
    },
    chartMarkerDotWrapper: {
        position: 'absolute',
        width: 16,
        height: 16,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chartMarkerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#2563eb',
        borderWidth: 2,
        borderColor: '#fff',
    },
    chartMarkerPulse: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#2563eb22',
    },
    markerValueBadge: {
        position: 'absolute',
        bottom: 20,
        backgroundColor: '#0f172a',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    markerValueText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '900',
    },
    chartLabelsContainer: {
        height: 20,
        position: 'relative',
        width: '100%',
        marginTop: 6,
    },
    axisLabelText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    chartEmpty: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        paddingHorizontal: 16,
        height: 52,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    clearSearchIcon: {
        padding: 6,
    },
    searchDivider: {
        width: 1,
        height: 22,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 8,
    },
    filterIconButton: {
        padding: 6,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    filterIconActive: {
        backgroundColor: '#f0fdf4',
        borderRadius: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: Fonts.sans,
    },
    modalCloseBtn: {
        padding: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
    },
    filterCardWrapper: {
        width: '100%',
        borderRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
        maxHeight: '70%',
    },
    filterCard: {
        borderRadius: 28,
        padding: 24,
        paddingTop: 28,
        overflow: 'hidden',
        maxHeight: '100%',
    },
    filterInputGroup: {
        marginBottom: 16,
        position: 'relative',
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#475569',
        marginBottom: 8,
        marginLeft: 8,
        fontFamily: Fonts.sans,
        letterSpacing: 0.5,
    },
    filterInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        height: 52,
        paddingHorizontal: 16,
    },
    filterInput: {
        flex: 1,
        height: '100%',
        color: '#0f172a',
        fontSize: 14,
        marginLeft: 10,
        fontFamily: Fonts.sans,
    },
    dropdownBox: {
        marginTop: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        maxHeight: 180,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden',
    },
    dropdownOption: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    dropdownOptionText: {
        fontSize: 13,
        color: '#334155',
        fontFamily: Fonts.sans,
        fontWeight: '500',
    },
    filterDateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    filterActionRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 12,
    },
    filterResetBtn: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterResetText: {
        color: '#64748b',
        fontWeight: 'bold',
        fontSize: 14,
        fontFamily: Fonts.sans,
    },
    filterApplyBtn: {
        flex: 2,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#7634bc',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    filterApplyText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 14,
        fontFamily: Fonts.sans,
    },
    listHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        marginBottom: 12,
        marginTop: 8,
    },
    listHeaderTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    listHeaderCountBadge: {
        backgroundColor: '#0f172a',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    listHeaderCountText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    ledgerListWrapper: {
        gap: 12,
    },
    ledgerRecordCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    skuTagWrapper: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    skuTagText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#475569',
        fontFamily: Fonts.sans,
    },
    cardStatusLabel: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    cardStatusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardItemTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 6,
        fontFamily: Fonts.sans,
    },
    cardLocRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    cardLocText: {
        fontSize: 11,
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 12,
    },
    metricGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricHighlight: {
        backgroundColor: '#eff6ff', // Match soft blue background highlight
        borderRadius: 10,
        paddingVertical: 4,
    },
    metricLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginBottom: 4,
        fontFamily: Fonts.sans,
    },
    metricVal: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#334155',
        fontFamily: Fonts.sans,
    },
    timelineWrapper: {
        flexDirection: 'row',
        marginHorizontal: 16,
    },
    timelineGutter: {
        alignItems: 'center',
        marginRight: 12,
        width: 20,
    },
    gutterCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    gutterInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    gutterLine: {
        width: 1.5,
        flex: 1,
        backgroundColor: '#e2e8f0',
        marginTop: 4,
    },
    timelineContentCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.01,
        shadowRadius: 4,
        elevation: 1,
    },
    timelineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    timelineDate: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: 'bold',
    },
    timelineUser: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: 'bold',
    },
    timelineVoucherNo: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
        fontFamily: Fonts.sans,
    },
    timelineItemName: {
        fontSize: 11,
        color: '#475569',
        fontFamily: Fonts.sans,
    },
    timelineFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 8,
    },
    voucherLabelBox: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    voucherLabelText: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: 'bold',
    },
    timelineValues: {
        alignItems: 'flex-end',
    },
    timelineChangeText: {
        fontSize: 13,
        fontWeight: '900',
    },
    timelineBalText: {
        fontSize: 9,
        color: '#94a3b8',
        marginTop: 2,
    },
    ageingTotalQtyText: {
        fontSize: 11,
        color: '#16a34a',
        fontWeight: 'bold',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ageingGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    ageingCol: {
        flex: 1,
        alignItems: 'center',
    },
    ageingColLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    ageingColVal: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#334155',
    },
    progressBarTrack: {
        height: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 3,
        marginTop: 12,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    progressSegment: {
        height: '100%',
    },
    bottomAnalyticsCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 15,
        elevation: 8,
    },
    donutChartTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
        marginBottom: 16,
    },
    donutSectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    donutChartWrapper: {
        position: 'relative',
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    donutCenterLabel: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    donutCenterVal: {
        color: '#0f172a',
        fontSize: 18,
        fontWeight: 'bold',
    },
    donutCenterDesc: {
        color: '#64748b',
        fontSize: 9,
        fontWeight: 'bold',
    },
    donutLegendWrapper: {
        flex: 1,
        gap: 10,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendIndicator: {
        width: 10,
        height: 10,
        borderRadius: 3,
    },
    legendTextWrapper: {
        flex: 1,
    },
    legendName: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#334155',
        fontFamily: Fonts.sans,
    },
    legendPct: {
        fontSize: 9,
        color: '#64748b',
    },
    emptyCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        padding: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyIconWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#334155',
        fontFamily: Fonts.sans,
        marginBottom: 4,
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 12,
        fontFamily: Fonts.sans,
        textAlign: 'center',
    },
    emptyResetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#eff6ff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    emptyResetText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2563eb',
        fontFamily: Fonts.sans,
    },
    // Table Grid Styles
    tableScroll: {
        marginHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        shadowColor: '#686b72ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 16,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#faf5ff',
        height: 44,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f3e8ff',
    },
    tableHeaderCell: {
        justifyContent: 'center',
        paddingHorizontal: 12,
        height: '100%',
    },
    tableHeaderCellText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#7634bc',
        fontFamily: Fonts.sans,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        height: 48,
        alignItems: 'center',
    },
    tableRowAlternate: {
        backgroundColor: '#f8fafc',
    },
    tableCell: {
        justifyContent: 'center',
        paddingHorizontal: 12,
        height: '100%',
    },
    tableCellText: {
        fontSize: 12,
        color: '#334155',
        fontFamily: Fonts.sans,
    },
    tableCellTextBold: {
        fontWeight: 'bold',
        color: '#0f172a',
    },
    voucherBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    voucherBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    // Main Header SVG Styles
    svgHeaderContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 240,
        overflow: 'hidden',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        zIndex: 0,
    },
    headerTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerTitleLight: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
        marginLeft: 12,
    },
    backBtnLight: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
});
