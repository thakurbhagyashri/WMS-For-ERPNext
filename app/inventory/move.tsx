import { NotificationBell } from '@/components/NotificationBell';
import { StatCard } from '@/components/StatCards';
import { TopNavbar } from '@/components/TopNavbar';
import { ConfirmationModal, PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { OrderIdPopup } from '@/components/ui/OrderIdPopup';
import { DonutChart } from '@/components/ui/PieChart';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useCompanyContext } from '@/context/CompanyContext';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    ArrowRight,
    ArrowRightLeft,
    Barcode,
    Box,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Clock,
    FileText,
    Layers,
    Minus,
    Package,
    Plus,
    Scan,
    Search,
    Warehouse,
    X
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    RefreshControl,
    useWindowDimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeInUp } from 'react-native-reanimated';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

const { width } = Dimensions.get('window');



const TransferCard = ({ id, from, to, items, date, index, status }: any) => {
    const { t } = useTranslation();
    return (
        <Animated.View
            entering={FadeInDown.delay(100 + index * 50).duration(500)}
            style={styles.dropdownItem}
        >
            <View style={styles.dropdownItemHeader}>
                <View style={styles.idGroup}>
                    <ClipboardList size={16} color="#64748b" style={{ marginRight: 6 }} />
                    <Text style={styles.dropdownItemId}>{id}</Text>
                </View>
                {status !== undefined && (
                    <StatusBadge status={status} />
                )}
            </View>

            <View style={[styles.detailsRow, { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fafc', borderRadius: 12 }]}>
                <Animated.View entering={FadeInLeft.delay(300 + index * 50)} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{t('from', 'From')}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }} numberOfLines={1}>{from}</Text>
                </Animated.View>

                <Animated.View entering={FadeIn.delay(400 + index * 50)} style={{ paddingHorizontal: 12 }}>
                    <ArrowRight size={16} color="#7634bc" />
                </Animated.View>

                <Animated.View entering={FadeInRight.delay(500 + index * 50)} style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{t('to', 'To')}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }} numberOfLines={1}>{to}</Text>
                </Animated.View>
            </View>

            <View style={[styles.bottomRow, { marginTop: 4 }]}>
                <View style={[styles.statsRow, { gap: 15 }]}>
                    <View style={styles.detailItem}>
                        <Layers size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                        <Text style={styles.detailText}>{items}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Clock size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                        <Text style={styles.dueDateLabel}>{date}</Text>
                    </View>
                </View>
                <ChevronRight size={18} color="#94a3b8" />
            </View>
        </Animated.View>
    );
};

export default function InternalMoveScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { callMethod, getResource, postResource, putResource, deleteResource, company, getCurrentUserEmail } = useFrappe(APP_CONFIG);
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [userInitials, setUserInitials] = useState('U');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!hasPermission('can_put_away')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchStats(),
            fetchLatestTransfers()
        ]);
        setRefreshing(false);
    };

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

    const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
    const [transferStep, setTransferStep] = useState(1);
    const [sourceWh, setSourceWh] = useState<any>(null);
    const [targetWh, setTargetWh] = useState<any>(null);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [whSearch, setWhSearch] = useState('');
    const [itemSearchText, setItemSearchText] = useState('');
    const [whList, setWhList] = useState<any[]>([]);
    const [whOffset, setWhOffset] = useState(0);
    const [hasMoreWh, setHasMoreWh] = useState(true);
    const [isFetchingWh, setIsFetchingWh] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [itemResults, setItemResults] = useState<any[]>([]);
    const [isWhDropdownOpen, setIsWhDropdownOpen] = useState<'source' | 'target' | null>(null);
    const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stats, setStats] = useState([
        {
            title: "Today's Transfers",
            value: '0',
            change: 0,
            isPositive: true,
            subtitle: 'vs yesterday',
            Icon: ArrowRightLeft,
            color: '#3b82f6',
        },
        {
            title: 'Pending',
            value: '0',
            change: undefined as number | undefined,
            isPositive: true,
            subtitle: '',
            Icon: Clock,
            color: '#f59e0b',
        },
        {
            title: 'Completed',
            value: '0',
            change: 0,
            isPositive: true,
            subtitle: 'vs last month',
            Icon: CheckCircle2,
            color: '#10b981',
        },
        {
            title: 'Exception',
            value: '0',
            change: 0,
            isPositive: true,
            subtitle: '',
            Icon: X,
            color: '#ef4444',
        }
    ]);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);
    const [weeklyTrends, setWeeklyTrends] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [routes, setRoutes] = useState<{ label: string, percent: number, color: string }[]>([]);
    const [search, setSearch] = useState('');

    const [latestTransfers, setLatestTransfers] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [activeFilter, setActiveFilter] = useState("All");
    const [listPage, setListPage] = useState(1);
    const [hasMoreList, setHasMoreList] = useState(false);
    const [loadingMoreList, setLoadingMoreList] = useState(false);
    const PAGE_SIZE = 10;
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [activeChartIndex, setActiveChartIndex] = useState(0);
    const chartScrollRef = React.useRef<ScrollView>(null);
    const chartNames = ['Weekly Trends', 'Transfer Routes'];
    const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
    const [editingModified, setEditingModified] = useState<string | null>(null);
    const [editingDocStatus, setEditingDocStatus] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scannerMode, setScannerMode] = useState<'main' | 'source' | 'target' | 'item' | 'tracking' | null>(null);
    const [permission, requestPermission] = useCameraPermissions();

    const [showTrackingModal, setShowTrackingModal] = useState(false);
    const [trackingItemIndex, setTrackingItemIndex] = useState<number | null>(null);
    const [availableTrackedItems, setAvailableTrackedItems] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState<string | null>(null);
    const [isScanningTracking, setIsScanningTracking] = useState(false);
    const [scannedTrackingIndex, setScannedTrackingIndex] = useState<number | null>(null);
    const [companyName, setCompanyName] = useState<string>(APP_CONFIG.company || '');
    const [defaultNamingSeries, setDefaultNamingSeries] = useState<string>('MAT-STE-');
    const [alertData, setAlertData] = useState<{ visible: boolean; title: string; message: string; isError?: boolean }>({ visible: false, title: '', message: '', isError: true });
    const [showPicklistModal, setShowPicklistModal] = useState(false);
    const [availablePicklists, setAvailablePicklists] = useState<any[]>([]);
    const [isLoadingPicklists, setIsLoadingPicklists] = useState(false);
    const [selectedPicklistId, setSelectedPicklistId] = useState<string | null>(null);
    const [reviewingPicklistData, setReviewingPicklistData] = useState<any>(null);
    const [picklistSearchQuery, setPicklistSearchQuery] = useState('');
    const [showOrderIdPopup, setShowOrderIdPopup] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [expandedReviewItems, setExpandedReviewItems] = useState<Record<number, boolean>>({});
    const [revealedTransferIds, setRevealedTransferIds] = useState<Record<string, boolean>>({});

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

                }
            } catch (e) {

            }
        };
        init();
    }, []);

    useEffect(() => {
        if (!activeCompany) return;
        setCompanyName(activeCompany);
        fetchStats();
        fetchDefaultNamingSeries();
    }, [activeCompany]);

    useEffect(() => {
        if (!activeCompany) return;
        setListPage(1);
        fetchLatestTransfers(1);
    }, [activeCompany, activeFilter]);

    const handleNewTransfer = () => {
        setEditingTransferId(null);
        setEditingModified(null);
        setEditingDocStatus(null);
        setSourceWh(null);
        setTargetWh(null);
        setSelectedItems([]);
        setTransferStep(1);
        setIsNewTransferOpen(true);
    };
    const handleTransferFromPicklist = async () => {
        setShowPicklistModal(true);
        setIsLoadingPicklists(true);
        try {
            const openPicklists = await getResource('Pick List', undefined, {
                filters: JSON.stringify([
                    ['status', '=', 'Draft'],
                    ['purpose', '=', 'Material Transfer'],
                    ['company', '=', activeCompany || APP_CONFIG.company]
                ]),
                fields: '["name", "status", "creation", "owner"]',
                limit_page_length: 50,
                order_by: 'creation desc'
            });
            setAvailablePicklists(Array.isArray(openPicklists) ? openPicklists : []);
        } catch (err) {
            console.error("Error fetching draft picklists:", err);
            setAlertData({ visible: true, title: 'Error', message: 'Failed to fetch draft Picklists', isError: true });
        } finally {
            setIsLoadingPicklists(false);
        }
    };

    const handleReviewSubmit = async () => {
        if (!reviewingPicklistData) return;
        setIsSubmitting(true);
        try {
            const id = reviewingPicklistData.picklistId;
            let updatedDoc = await getResource('Pick List', id as string);

            if (updatedDoc.docstatus === 0) {
                console.log(`[MTFM] Auto-submitting Draft Pick List: ${id}`);

                const updatedLocations = updatedDoc.locations.map((loc: any) => ({
                    ...loc,
                    picked_qty: loc.picked_qty > 0 ? loc.picked_qty : loc.qty
                }));

                await putResource('Pick List', id, { locations: updatedLocations, docstatus: 1 }, false, undefined, false);

                updatedDoc = await getResource('Pick List', id as string);
            }

            console.log(`[MTFM] Creating Stock Entry for: ${id}`);
            const seResult = await callMethod(
                'erpnext.stock.doctype.pick_list.pick_list.create_stock_entry',
                { pick_list: updatedDoc },
                false, undefined, true
            );
            console.log('createdSEItems---------------->', seResult);

            if (seResult && seResult._server_messages) {
                try {
                    const messages = JSON.parse(seResult._server_messages);
                    if (messages.length > 0) {
                        const msgObj = JSON.parse(messages[0]);
                        if (msgObj.message) {
                            throw new Error(msgObj.message);
                        }
                    }
                } catch (e: any) {
                    if (e.message !== 'Failed to parse server messages') {
                        throw e;
                    }
                }
            }

            const seDoc = seResult?.message || seResult?.data || seResult;

            if (seDoc && seDoc.doctype) {
                const isAlreadySaved = seDoc.name && !seDoc.name.startsWith('New');
                if (isAlreadySaved) {
                    console.log(`[MTFM] Stock Entry Created: ${seDoc.name}`);
                    setReviewingPicklistData((prev: any) => ({ ...prev, success: true, savedSEName: seDoc.name }));
                } else {
                    const savedSE = await postResource('Stock Entry', seDoc, false, undefined, true);
                    console.log(`[MTFM] Stock Entry Created: ${savedSE?.name || 'Unknown'}`);
                    setReviewingPicklistData((prev: any) => ({ ...prev, success: true, savedSEName: savedSE?.name }));
                }
            } else {
                throw new Error('Failed to generate Stock Entry mapping from ERPNext.');
            }
        } catch (err: any) {
            console.error('Error creating stock entry:', err);
            setAlertData({ visible: true, title: 'Error', message: `Stock Entry creation failed: ${err.message || 'Unknown Error'}.`, isError: true });
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectPicklist = async (picklistId: string) => {
        setIsLoadingPicklists(true);
        try {
            const doc = await getResource('Pick List', picklistId);
            if (doc) {
                console.log("======= COMPLETE PICK LIST DOC =======");
                console.log(JSON.stringify(doc, null, 2));
                console.log("======================================");

                // Auto-fill stepper
                setEditingTransferId(null);
                setEditingModified(null);
                setEditingDocStatus(null);
                setSelectedPicklistId(picklistId);

                // For Material Transfer picklists, source and target are usually on the item level,
                // but we can set the top-level ones from the first item as a fallback.
                const itemsToMap = doc.locations || doc.items || [];

                let seDoc = null;
                try {
                    const seResult = await callMethod(
                        'erpnext.stock.doctype.pick_list.pick_list.create_stock_entry',
                        { pick_list: doc },
                        false, undefined, true
                    );
                    seDoc = seResult?.message || seResult?.data || seResult;
                } catch (e) {
                    console.log("Could not generate Stock Entry mapping early (likely already fulfilled or missing setup).", e);
                }

                let fallbackTargetWarehouse = '';
                try {
                    // Try to get target warehouse directly from Pick List (for_warehouse)
                    if (doc.for_warehouse) {
                        fallbackTargetWarehouse = doc.for_warehouse;
                    }
                    // Otherwise, try to fetch the linked Material Request
                    else if (doc.locations && doc.locations.length > 0 && doc.locations[0].material_request) {
                        const mr = await getResource('Material Request', doc.locations[0].material_request);
                        if (mr && mr.set_warehouse) {
                            fallbackTargetWarehouse = mr.set_warehouse;
                        }
                    }
                } catch (mrErr) {
                    console.log("Could not fetch Material Request fallback", mrErr);
                }

                setReviewingPicklistData({
                    picklistId,
                    rawDoc: doc,
                    seDoc,
                    fallbackTargetWarehouse
                });
                setShowPicklistModal(false);
            }
        } catch (err) {
            console.error("Failed to load picklist details", err);
            setAlertData({ visible: true, title: 'Error', message: 'Failed to load picklist details', isError: true });
        } finally {
            setIsLoadingPicklists(false);
        }
    };
    const handleEditTransfer = async (id: string) => {
        try {
            setIsSearching(true);
            const doc = await getResource('Stock Entry', id);
            if (doc) {
                setEditingTransferId(id);
                setEditingModified(doc.modified);
                setEditingDocStatus(doc.docstatus);
                setDefaultNamingSeries(doc.naming_series);
                setSourceWh({ name: doc.from_warehouse || (doc.items && doc.items.length > 0 ? doc.items[0].s_warehouse : '') });
                setTargetWh({ name: doc.to_warehouse || doc.warehouse || (doc.items && doc.items.length > 0 ? doc.items[0].t_warehouse : '') });

                const items = await Promise.all((doc.items || []).map(async (item: any) => {
                    let itemMaster: any = null;
                    try {
                        itemMaster = await getResource('Item', item.item_code);
                    } catch (e) {
                        console.warn('Failed to fetch item master', item.item_code);
                    }

                    const mappedItem: any = {
                        item_code: item.item_code,
                        item_name: item.item_name || item.item_code,
                        qty: item.qty,
                        stock_uom: item.uom,
                        actual_qty: item.qty,
                        has_serial_no: itemMaster?.has_serial_no || 0,
                        has_batch_no: itemMaster?.has_batch_no || 0,
                        sbb: item.serial_and_batch_bundle,
                        batches: []
                    };

                    if (item.serial_and_batch_bundle) {
                        try {
                            const bundle = await getResource('Serial and Batch Bundle', item.serial_and_batch_bundle);
                            if (bundle && bundle.entries) {
                                mappedItem.batches = bundle.entries.map((e: any) => ({
                                    batch_no: e.serial_no || e.batch_no,
                                    qty: e.qty
                                }));
                            }
                        } catch (e) {
                            console.warn('Failed to fetch bundle', e);
                        }
                    }
                    return mappedItem;
                }));
                setSelectedItems(items);
                setTransferStep(doc.docstatus === 1 ? 3 : 1);
                setIsNewTransferOpen(true);
            }
        } catch (e) {
            console.error('Failed to fetch transfer details', e);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (search.trim().length > 0) {
            const delayDebounceFn = setTimeout(() => {
                handleSearchTransfers();
            }, 600);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setShowSearchDropdown(false);
            setSearchResults([]);
        }
    }, [search]);

    async function fetchLatestTransfers(page = 1) {
        if (page > 1) setLoadingMoreList(true);
        try {
            const limit_start = (page - 1) * PAGE_SIZE;
            const filters: any[] = [
                ['purpose', '=', 'Material Transfer'],
                ['company', '=', activeCompany]
            ];

            if (activeFilter === "Draft") filters.push(['docstatus', '=', 0]);
            else if (activeFilter === "Submitted") filters.push(['docstatus', '=', 1]);
            else if (activeFilter === "Cancelled") filters.push(['docstatus', '=', 2]);

            const data = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify(filters),
                fields: '["name", "posting_date", "docstatus", "from_warehouse", "to_warehouse"]',
                limit_start,
                limit_page_length: PAGE_SIZE,
                order_by: 'modified desc'
            });
            if (Array.isArray(data)) {
                if (data.length > 0) {
                    const namesWithMissingWh = data.filter(d => !d.from_warehouse || !d.to_warehouse).map(d => d.name);
                    if (namesWithMissingWh.length > 0) {
                        try {
                            const fullDocs = await Promise.all(namesWithMissingWh.map(name => getResource('Stock Entry', name)));
                            data.forEach(d => {
                                if (!d.from_warehouse || !d.to_warehouse) {
                                    const fullDoc = fullDocs.find((doc: any) => doc && doc.name === d.name);
                                    if (fullDoc && fullDoc.items && fullDoc.items.length > 0) {
                                        if (!d.from_warehouse) d.from_warehouse = fullDoc.items[0].s_warehouse;
                                        if (!d.to_warehouse) d.to_warehouse = fullDoc.items[0].t_warehouse;
                                    }
                                }
                            });
                        } catch (err) {
                            console.warn('Failed to fetch full docs for list fallback', err);
                        }
                    }
                }

                // For Numbered Pagination, we replace data instead of appending
                setLatestTransfers(data);
                setHasMoreList(data.length === PAGE_SIZE);
            } else {
                setLatestTransfers([]);
                setHasMoreList(false);
            }
        } catch (e) {
            console.error('Failed to fetch latest transfers', e);
            if (page === 1) setLatestTransfers([]);
        } finally {
            setLoadingMoreList(false);
        }
    };

    const handleLoadMoreList = () => {
        if (!loadingMoreList && hasMoreList) {
            const nextPage = listPage + 1;
            setListPage(nextPage);
            fetchLatestTransfers(nextPage);
        }
    };

    async function handleSearchTransfers() {
        setIsSearching(true);
        try {
            const data = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify([
                    ['purpose', '=', 'Material Transfer'],
                    ['name', 'like', `%${search}%`],
                    ['company', '=', activeCompany]
                ]),
                fields: '["name", "posting_date", "docstatus", "from_warehouse", "to_warehouse"]',
                limit_page_length: 10,
                order_by: 'modified desc'
            });
            if (Array.isArray(data)) {
                setSearchResults(data);
                setShowSearchDropdown(true);
            }
        } catch (e) {
            console.error('Search failed', e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleOpenScanner = async (mode: 'main' | 'source' | 'target' | 'item' | 'tracking', index: number | null = null) => {
        if (!permission || !permission.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                setAlertData({ visible: true, title: 'Permission Required', message: 'Camera access is needed to scan barcodes.', isError: true });
                return;
            }
        }
        setScannerMode(mode);
        if (mode === 'tracking') {
            setScannedTrackingIndex(index);
            setShowTrackingModal(false);
        }
        setIsScanning(true);
    };

    const onBarcodeScanned = async ({ data }: { data: string }) => {
        setIsScanning(false);
        const mode = scannerMode;
        const scannedValue = data.trim();
        setScannerMode(null);

        if (mode === 'main') {
            handleEditTransfer(scannedValue);
        } else if (mode === 'source') {
            const wh = whList.find(w => w.name.toLowerCase() === scannedValue.toLowerCase() || w.name === scannedValue);
            if (wh) setSourceWh(wh);
            else {
                setWhSearch(scannedValue);
                setIsWhDropdownOpen('source');
            }
        } else if (mode === 'target') {
            const wh = whList.find(w => w.name.toLowerCase() === scannedValue.toLowerCase() || w.name === scannedValue);
            if (wh) setTargetWh(wh);
            else {
                setWhSearch(scannedValue);
                setIsWhDropdownOpen('target');
            }
        } else if (mode === 'item') {
            let cleanedScanData = data.trim();
            if (cleanedScanData.includes('/')) {
                const parts = cleanedScanData.split('/');
                cleanedScanData = parts[parts.length - 1];
            }
            const lowerScanData = cleanedScanData.toLowerCase();

            const existing = selectedItems.find(i =>
                (i.item_code && i.item_code.toLowerCase() === lowerScanData) ||
                (i.item_name && i.item_name.toLowerCase().includes(lowerScanData)) ||
                (i.barcodes && i.barcodes.some((b: string) => b.toLowerCase() === lowerScanData))
            );

            if (existing) {
                if (existing.has_serial_no || existing.has_batch_no) {
                    const idx = selectedItems.findIndex(i => i.item_code === existing.item_code);
                    openTracking(idx);
                } else {
                    updateItemQty(existing.item_code, 1);
                }
            } else {
                try {
                    let item = null;
                    try { item = await getResource('Item', cleanedScanData); } catch (e) { }

                    if (!item) {
                        try {
                            const bcRes = await getResource('Item Barcode', undefined, {
                                filters: JSON.stringify([['barcode', '=', cleanedScanData]]),
                                fields: '["parent"]',
                                limit_page_length: 1
                            });
                            if (bcRes && bcRes.length > 0) {
                                item = await getResource('Item', bcRes[0].parent);
                            } else {
                                const nameRes = await getResource('Item', undefined, {
                                    filters: JSON.stringify([['item_name', 'like', `%${cleanedScanData}%`], ['is_stock_item', '=', 1]]),
                                    fields: '["name"]',
                                    limit_page_length: 1
                                });
                                if (nameRes && nameRes.length > 0) {
                                    item = await getResource('Item', nameRes[0].name);
                                }
                            }
                        } catch (e) { }
                    }

                    if (item) {
                        const itemBarcodes = (item.barcodes || []).map((b: any) => b.barcode).filter(Boolean);
                        if (item.barcode && !itemBarcodes.includes(item.barcode)) {
                            itemBarcodes.push(item.barcode);
                        }
                        handleAddItem({
                            item_code: item.item_code,
                            item_name: item.item_name,
                            stock_uom: item.stock_uom,
                            has_serial_no: item.has_serial_no,
                            has_batch_no: item.has_batch_no,
                            barcodes: itemBarcodes
                        });
                    } else {
                        setItemSearchText(cleanedScanData);
                        fetchItems(cleanedScanData);
                    }
                } catch (e) {
                    setItemSearchText(cleanedScanData);
                    fetchItems(cleanedScanData);
                }
            }
        } else if (mode === 'tracking') {
            if (trackingItemIndex === null) return;
            if (scannedTrackingIndex !== null) {
                handleTrackingChange(trackingItemIndex, scannedTrackingIndex, 'batch_no', scannedValue);
            } else {
                const item = selectedItems[trackingItemIndex];
                const newBatches = [...(item.batches || [])];
                const emptyIdx = newBatches.findIndex(b => !b.batch_no);
                if (emptyIdx !== -1) {
                    newBatches[emptyIdx].batch_no = scannedValue;
                } else {
                    newBatches.push({ batch_no: scannedValue, qty: item.has_serial_no === 1 ? 1 : 1 });
                }
                const newItems = [...selectedItems];
                newItems[trackingItemIndex].batches = newBatches;
                setSelectedItems(newItems);
            }
            setShowTrackingModal(true);
        }
    };

    const fetchWarehouses = async (query = '', isLoadMore = false) => {
        if (isFetchingWh) return;
        setIsFetchingWh(true);

        const currentOffset = isLoadMore ? whOffset : 0;
        try {
            const filters: any[] = [
                ['is_group', '=', 0],
                ['disabled', '=', 0],
                ['company', '=', activeCompany]
            ];
            if (query) {
                filters.push(['name', 'like', `%${query}%`]);
            }

            const data = await getResource('Warehouse', undefined, {
                filters: JSON.stringify(filters),
                fields: '["name", "warehouse_name"]',
                limit_start: currentOffset,
                limit_page_length: 20
            });

            if (Array.isArray(data)) {
                if (isLoadMore) {
                    setWhList(prev => {
                        // Prevent duplicates
                        const newItems = data.filter(d => !prev.some(p => p.name === d.name));
                        return [...prev, ...newItems];
                    });
                } else {
                    setWhList(data);
                }
                setWhOffset(currentOffset + 20);
                setHasMoreWh(data.length === 20);
            }
        } catch (e) {
            console.error('Failed to fetch warehouses', e);
        } finally {
            setIsFetchingWh(false);
        }
    };

    const handleWhSearchChange = (text: string) => {
        setWhSearch(text);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            fetchWarehouses(text, false);
        }, 400);
    };

    useEffect(() => {
        if (isWhDropdownOpen) {
            fetchWarehouses(whSearch, false);
        }
    }, [isWhDropdownOpen, activeCompany]);

    const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: any) => {
        return layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    };


    async function fetchDefaultNamingSeries() {
        try {
            // Fetch one record to get its naming series as fallback
            const latest = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify([['purpose', '=', 'Material Transfer']]),
                fields: '["naming_series"]',
                limit_page_length: 1,
                order_by: 'modified desc'
            });
            if (latest && latest.length > 0) {
                setDefaultNamingSeries(latest[0].naming_series);
            }
        } catch (e) {
            console.warn('Failed to fetch naming series', e);
        }
    };

    const fetchItems = async (q: string) => {
        if (q.length < 2) {
            setItemResults([]);
            setIsItemDropdownOpen(false);
            return;
        }
        try {
            const itemsData = await getResource('Item', undefined, {
                filters: JSON.stringify([
                    ['item_code', 'like', `%${q}%`],
                    ['is_stock_item', '=', 1],
                    ['disabled', '=', 0]
                ]),
                fields: '["item_code", "item_name", "stock_uom", "has_serial_no", "has_batch_no"]',
                limit_page_length: 50
            });

            if (Array.isArray(itemsData) && itemsData.length > 0) {
                if (sourceWh) {
                    const itemCodes = itemsData.map((i: any) => i.item_code);
                    const binData = await getResource('Bin', undefined, {
                        filters: JSON.stringify([
                            ['warehouse', '=', sourceWh.name],
                            ['item_code', 'in', itemCodes],
                            ['actual_qty', '>', 0]
                        ]),
                        fields: '["item_code", "actual_qty"]',
                        limit_page_length: 100
                    });

                    if (Array.isArray(binData)) {
                        const validItemCodes = new Set(binData.map((b: any) => b.item_code));
                        const filteredItems = itemsData.filter((i: any) => validItemCodes.has(i.item_code));
                        setItemResults(filteredItems);
                    } else {
                        setItemResults([]);
                    }
                } else {
                    setItemResults(itemsData);
                }
                setIsItemDropdownOpen(true);
            } else {
                setItemResults([]);
            }
        } catch (e) {
            console.error('Failed to fetch items', e);
        }
    };

    const fetchAvailableTrackedItems = async (itemCode: string, hasSerial: boolean, hasBatch: boolean, searchQuery = '') => {
        try {
            if (hasSerial) {
                const filters: any = { item_code: itemCode, status: 'Active' };
                if (searchQuery) filters.name = ['like', `%${searchQuery}%`];
                if (sourceWh) filters.warehouse = sourceWh.name;

                const serials = await getResource('Serial No', undefined, {
                    filters: JSON.stringify(filters),
                    fields: '["name", "warehouse"]',
                    limit_page_length: 50
                });
                setAvailableTrackedItems(serials || []);
            } else if (hasBatch) {
                const filters: any = { item: itemCode, disabled: 0 };
                if (searchQuery) filters.name = ['like', `%${searchQuery}%`];
                const batchesData = await getResource('Batch', undefined, {
                    filters: JSON.stringify(filters),
                    fields: '["name", "expiry_date"]',
                    limit_page_length: 50
                });
                setAvailableTrackedItems(batchesData || []);
            }
        } catch (err) {
            console.warn('Failed tracking fetch', err);
        }
    };

    const handleAddItem = (item: any) => {
        const exists = selectedItems.find(i => i.item_code === item.item_code);
        if (exists) {
            setSelectedItems(selectedItems.map(i =>
                i.item_code === item.item_code ? { ...i, qty: i.qty + 1 } : i
            ));
        } else {
            setSelectedItems([...selectedItems, {
                ...item,
                qty: 1,
                batches: []
            }]);
        }
        setItemSearchText('');
        setItemResults([]);
        setIsItemDropdownOpen(false);
    };

    const updateItemQty = (itemCode: string, delta: number) => {
        setSelectedItems(selectedItems.map(i => {
            if (i.item_code === itemCode) {
                const currentQty = parseFloat(i.qty?.toString() || '0') || 0;
                const newQty = Math.max(1, currentQty + delta);
                return { ...i, qty: newQty };
            }
            return i;
        }));
    };

    const removeItem = (itemCode: string) => {
        setSelectedItems(selectedItems.filter(i => i.item_code !== itemCode));
    };

    const openTracking = (index: number) => {
        const item = selectedItems[index];
        setTrackingItemIndex(index);
        setShowTrackingModal(true);
        fetchAvailableTrackedItems(item.item_code, item.has_serial_no === 1, item.has_batch_no === 1);
    };

    const handleTrackingChange = (itemIndex: number, batchIndex: number, field: string, value: any) => {
        const newItems = [...selectedItems];
        const item = newItems[itemIndex];
        const newBatches = [...(item.batches || [])];
        newBatches[batchIndex] = { ...newBatches[batchIndex], [field]: field === 'qty' ? parseFloat(value || '0') : value };

        if (item.has_serial_no === 1 && field === 'batch_no') {
            newBatches[batchIndex].qty = 1;
        }
        item.batches = newBatches;
        setSelectedItems(newItems);
    };

    const addTrackingEntry = (itemIndex: number) => {
        const newItems = [...selectedItems];
        const item = newItems[itemIndex];
        item.batches = [...(item.batches || []), { batch_no: '', qty: item.has_serial_no === 1 ? 1 : 1 }];
        setSelectedItems(newItems);
    };

    const removeTrackingEntry = (itemIndex: number, batchIndex: number) => {
        const newItems = [...selectedItems];
        const item = newItems[itemIndex];
        item.batches = item.batches.filter((_: any, i: number) => i !== batchIndex);
        setSelectedItems(newItems);
    };

    const saveTracking = () => {
        if (trackingItemIndex === null) return;
        const item = selectedItems[trackingItemIndex];
        const totalQty = item.batches.reduce((sum: number, b: any) => sum + (parseFloat(b.qty) || 0), 0);

        const newItems = [...selectedItems];
        newItems[trackingItemIndex].qty = totalQty;
        setSelectedItems(newItems);

        setShowTrackingModal(false);
        setTrackingItemIndex(null);
    };

    const submitTransfer = async () => {
        if (selectedItems.length === 0) return;
        setIsSubmitting(true);
        const createdBundles: string[] = [];

        try {
            const itemsWithBundles = await Promise.all(selectedItems.map(async (item) => {
                let bundleName = item.sbb;

                if ((item.has_serial_no || item.has_batch_no) && item.batches?.length > 0) {
                    const bundleData = {
                        doctype: 'Serial and Batch Bundle',
                        item_code: item.item_code,
                        warehouse: item.s_warehouse || sourceWh?.name,
                        company: company || companyName,
                        type: 'Outward',
                        type_of_transaction: 'Outward',
                        voucher_type: 'Stock Entry',
                        has_serial_no: item.has_serial_no ? 1 : 0,
                        has_batch_no: item.has_batch_no ? 1 : 0,
                        entries: item.batches.map((b: any) => ({
                            batch_no: item.has_batch_no ? b.batch_no : undefined,
                            serial_no: item.has_serial_no ? b.batch_no : undefined,
                            qty: b.qty
                        }))
                    };

                    try {
                        const bundle = await postResource('Serial and Batch Bundle', bundleData, false);
                        bundleName = bundle.name;
                        if (bundleName) createdBundles.push(bundleName);
                    } catch (err: any) {
                        console.error('SBB Creation Error:', err);
                        throw new Error(`Failed to create Bundle for ${item.item_code}: ${err.message}`);
                    }
                }

                return {
                    item_code: item.item_code,
                    qty: ((item.has_serial_no || item.has_batch_no) && item.batches?.length > 0)
                        ? item.batches.reduce((sum: number, b: any) => sum + (parseFloat(b.qty) || 0), 0)
                        : item.qty,
                    s_warehouse: item.s_warehouse || sourceWh?.name,
                    t_warehouse: item.t_warehouse || targetWh?.name,
                    uom: item.stock_uom,
                    serial_and_batch_bundle: bundleName || undefined,
                    use_serial_batch_fields: 0,
                    allow_zero_valuation_rate: 1,
                    ...(item.pick_list_name ? { pick_list: item.pick_list_name, pick_list_item: item.pick_list_item } : {})
                };
            }));

            const doc: any = {
                doctype: 'Stock Entry',
                purpose: 'Material Transfer',
                stock_entry_type: 'Material Transfer',
                docstatus: 1,
                company: company || companyName,
                naming_series: defaultNamingSeries,
                from_warehouse: sourceWh?.name,
                to_warehouse: targetWh?.name,
                apply_putaway_rule: 0,
                items: itemsWithBundles
            };

            if (editingTransferId) {
                doc.name = editingTransferId;
                doc.modified = editingModified;
                await callMethod('frappe.client.save', { doc }, false, undefined, true);
                setAlertData({ visible: true, title: 'Success', message: 'Stock Transfer updated successfully', isError: false });
            } else {
                await callMethod('frappe.client.insert', { doc }, false, undefined, true);
                setAlertData({ visible: true, title: 'Success', message: 'Stock Transfer created successfully', isError: false });
            }

            setIsNewTransferOpen(false);
            setEditingTransferId(null);
            setEditingModified(null);
            setTransferStep(1);
            setSourceWh(null);
            setTargetWh(null);
            setSelectedItems([]);
            fetchStats();
            fetchLatestTransfers();
        } catch (e: any) {
            console.error('Transfer failed', e);
            const errorMessage = e?.message || 'Failed to submit Stock Transfer';
            const cleanMessage = errorMessage.replace(/<[^>]*>/g, '');
            setAlertData({
                visible: true,
                title: 'Transfer Failed',
                message: cleanMessage,
                isError: true
            });

            if (createdBundles.length > 0) {
                for (const b of createdBundles) {
                    try { await deleteResource('Serial and Batch Bundle', b, false); } catch (err) { console.warn('Rollback failed', b); }
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    async function fetchStats() {
        try {
            const now = new Date();
            const localToday = now.toLocaleDateString('en-CA');
            console.log('Local Today--------------------->', localToday);

            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const localYesterday = yesterday.toLocaleDateString('en-CA');

            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString('en-CA');
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-CA');

            const [
                todayResp, yesterdayResp,
                pendingResp,
                completedThisMonthResp, completedLastMonthResp
            ] = await Promise.all([
                // filter 1 : today's transfers
                callMethod('frappe.client.get_count', {
                    doctype: 'Stock Entry',
                    filters: [['purpose', '=', 'Material Transfer'], ['posting_date', '=', localToday], ['company', '=', activeCompany]]
                }),
                callMethod('frappe.client.get_count', {
                    doctype: 'Stock Entry',
                    filters: [['purpose', '=', 'Material Transfer'], ['posting_date', '=', localYesterday], ['company', '=', activeCompany]]
                }),

                //filter 2: pending
                callMethod('frappe.client.get_count', {
                    doctype: 'Stock Entry',
                    filters: [['purpose', '=', 'Material Transfer'], ['docstatus', '=', 0], ['company', '=', activeCompany]]
                }),

                //filter 3: completed this month
                callMethod('frappe.client.get_count', {
                    doctype: 'Stock Entry',
                    filters: [['purpose', '=', 'Material Transfer'], ['docstatus', '=', 1], ['posting_date', '>=', startOfThisMonth], ['company', '=', activeCompany]]
                }),
                callMethod('frappe.client.get_count', {
                    doctype: 'Stock Entry',
                    filters: [['purpose', '=', 'Material Transfer'], ['docstatus', '=', 1], ['posting_date', 'between', [startOfLastMonth, endOfLastMonth]], ['company', '=', activeCompany]]
                }),


            ]);

            const displayToday = typeof todayResp === 'object' ? (todayResp?.message ?? todayResp?.data ?? 0) : (todayResp ?? 0);
            const displayYesterday = typeof yesterdayResp === 'object' ? (yesterdayResp?.message ?? yesterdayResp?.data ?? 0) : (yesterdayResp ?? 0);
            const displayPending = typeof pendingResp === 'object' ? (pendingResp?.message ?? pendingResp?.data ?? 0) : (pendingResp ?? 0);
            const displayCompletedThisMonth = typeof completedThisMonthResp === 'object' ? (completedThisMonthResp?.message ?? completedThisMonthResp?.data ?? 0) : (completedThisMonthResp ?? 0);
            const displayCompletedLastMonth = typeof completedLastMonthResp === 'object' ? (completedLastMonthResp?.message ?? completedLastMonthResp?.data ?? 0) : (completedLastMonthResp ?? 0);

            const calculateTrend = (current: number, previous: number) => {
                if (previous === 0) return current > 0 ? 100 : 0;
                const diff = current - previous;
                return Math.round((diff / previous) * 100);
            };

            const todayChange = calculateTrend(displayToday, displayYesterday);
            const completedChange = calculateTrend(displayCompletedThisMonth, displayCompletedLastMonth);

            setStats(prev => {
                const newStats = [...prev];
                newStats[0].value = displayToday.toString();
                newStats[0].change = Math.abs(todayChange);
                newStats[0].isPositive = todayChange >= 0;

                newStats[1].value = displayPending.toString();

                newStats[2].value = displayCompletedThisMonth.toString();
                newStats[2].change = Math.abs(completedChange);
                newStats[2].isPositive = completedChange >= 0;
                return newStats;
            });
            //filter 5: chart 1 : weekly trends
            const currentDay = now.getDay();
            const diffToMonday = (currentDay === 0 ? 6 : currentDay - 1);
            const monday = new Date(now);
            monday.setDate(now.getDate() - diffToMonday);
            monday.setHours(0, 0, 0, 0);
            const mondayStr = monday.toLocaleDateString('en-CA');

            const trendsData = await getResource('Stock Entry', undefined, {
                filters: JSON.stringify([
                    ['purpose', '=', 'Material Transfer'],
                    ['docstatus', '=', 1],
                    ['posting_date', '>=', mondayStr],
                    ['company', '=', activeCompany]
                ]),
                fields: '["posting_date", "from_warehouse", "to_warehouse"]',
                limit_page_length: 5000
            });

            if (Array.isArray(trendsData)) {
                const newTrends = [0, 0, 0, 0, 0, 0, 0];
                const routeCounts: Record<string, number> = {};
                let totalRoutes = 0;

                trendsData.forEach((se: any) => {
                    if (se.posting_date) {
                        const [y, m, d] = se.posting_date.substring(0, 10).split('-').map(Number);
                        const date = new Date(y, m - 1, d);
                        const day = date.getDay(); // 0 is Sun, 1 is Mon...
                        const index = (day === 0 ? 6 : day - 1); // map to 0=Mon, ..., 6=Sun
                        if (index >= 0 && index < 7) newTrends[index]++;
                    }

                    if (se.from_warehouse && se.to_warehouse) {
                        const fromName = se.from_warehouse.split('-')[0].trim();
                        const toName = se.to_warehouse.split('-')[0].trim();
                        const routeLabel = `${fromName} → ${toName}`;
                        routeCounts[routeLabel] = (routeCounts[routeLabel] || 0) + 1;
                        totalRoutes++;
                    }
                });
                setWeeklyTrends(newTrends);

                const sortedRoutes = Object.entries(routeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4);

                const colors = ['#1e293b', '#64748b', '#94a3b8', '#cbd5e1'];
                const newRoutes = sortedRoutes.map(([label, count], index) => ({
                    label,
                    percent: Math.round((count / totalRoutes) * 100),
                    color: colors[index % colors.length]
                }));

                setRoutes(newRoutes);
            }
        } catch (error) {
            console.error('[MoveScreen] Failed to fetch stats:', error);
            setStats(prev => {
                const newStats = [...prev];
                newStats[0].value = '0';
                return newStats;
            });
        }
    };

    const requiresTracking = selectedItems.some((i: any) => i.has_batch_no == 1 || i.has_batch_no == '1' || i.has_serial_no == 1 || i.has_serial_no == '1');
    const totalSteps = requiresTracking ? 4 : 3;

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
                <Text style={styles.greetingText}>{t('internal_move', 'Internal Move')}</Text>
                <Text style={styles.subGreetingText}>{t('transfer_stock_betwe', 'Transfer stock between warehouses')}</Text>
            </View>

            {/* Picklist Selection Modal */}
            <Modal
                visible={showPicklistModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowPicklistModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.warehouseModalContent, { maxHeight: '70%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_picklist', 'Select Draft Picklist')}</Text>
                            <TouchableOpacity onPress={() => setShowPicklistModal(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        {isLoadingPicklists ? (
                            <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 40 }} />
                        ) : availablePicklists.length === 0 ? (
                            <Text style={styles.noWarehouseText}>{t('no_picklists_found', 'No draft Material Transfer Picklists found')}</Text>
                        ) : (
                            <ScrollView style={styles.warehouseList}>
                                {availablePicklists.map((pl: any, idx: number) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.dropdownItem}
                                        onPress={() => selectPicklist(pl.name)}
                                    >
                                        <View style={styles.dropdownItemHeader}>
                                            <View style={styles.idGroup}>
                                                <ClipboardList size={18} color="#0f172a" style={{ marginRight: 10 }} />
                                                <Text style={styles.dropdownItemId}>{pl.name}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.bottomRow}>
                                            <View style={[styles.statsRow, { gap: 15 }]}>
                                                <View style={styles.detailItem}>
                                                    <Clock size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                                                    <Text style={styles.dueDateLabel}>{pl.creation?.split(' ')[0]}</Text>
                                                </View>
                                                <Text style={{ fontSize: 11, color: '#f97316', fontWeight: 'bold' }}>{pl.status}</Text>
                                            </View>
                                            <ChevronRight size={18} color="#94a3b8" />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

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
                            <Text style={styles.scannerTitle}>
                                {scannerMode === 'main' ? 'Scan Transfer ID' :
                                    scannerMode === 'source' ? 'Scan Source Warehouse' :
                                        scannerMode === 'target' ? 'Scan Target Warehouse' :
                                            scannerMode === 'tracking' ? 'Scan Serial/Batch' : 'Scan Item Code'}
                            </Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <View style={styles.scanTarget}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>

                        <Text style={styles.scanInstructions}>
                            {t('align_the_code_withi', 'Align the code within the frame to scan')}
                        </Text>
                    </View>
                </View>
            </Modal>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 150, paddingTop: 10 }}
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

                <View style={{ paddingHorizontal: 20 }}>
                    {/* Top Header for Charts (Filter + Tabs) */}
                    <View style={{ zIndex: 1, marginBottom: 15, marginTop: 10 }}>
                        <View style={styles.analyticsHeaderRow}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={styles.analyticsTitleText}>{t('analytics_charts', 'Analytics & Charts')}</Text>
                                <Text style={styles.analyticsSubtitleText}>{t('internal_movement_me', 'Internal movement metrics')}</Text>
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
                                        chartScrollRef.current?.scrollTo({ x: idx * (width - 40), animated: true }); // width - 40 because of paddingHorizontal: 20 on both sides
                                    }}
                                >
                                    <Text style={[styles.chartTabText, activeChartIndex === idx ? styles.chartTabTextActive : undefined]}>{name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <Animated.View entering={FadeInUp} style={styles.chartsContent}>
                        <ScrollView
                            ref={chartScrollRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(e) => {
                                const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
                                setActiveChartIndex(newIndex);
                            }}
                        >
                            {/* Chart 1: Weekly Transfer Trend */}
                            <View style={{ width: width - 40 }}>
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
                                                            <View style={styles.gridLines}>
                                                                {yAxisValues.map((v, idx) => (
                                                                    <View key={idx} style={styles.gridLine} />
                                                                ))}
                                                            </View>
                                                            <View style={styles.barChartBars}>
                                                                {visibleTrends.map((val, i) => {
                                                                    const h = (val / maxVal) * 100;
                                                                    return (
                                                                        <View key={i} style={styles.barContainer}>
                                                                            <View style={[styles.bar, { height: Math.max(h, 2), backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#6366f1', '#14b8a6'][i % 7] }]} />
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

                            {/* Chart 2: Transfer Routes */}
                            <View style={{ width: width - 40 }}>
                                <View style={[styles.chartCard, { marginBottom: 0, marginHorizontal: 2 }]}>
                                    <DonutChart
                                        data={routes.map(r => ({ label: r.label, value: r.percent, color: r.color }))}
                                        size={120}
                                        strokeWidth={20}
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
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 25, gap: 12 }}>
                    <TouchableOpacity
                        style={[styles.newTransferBtn, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}
                        onPress={handleNewTransfer}
                    >
                        <Plus size={18} color="#fff" />
                        <Text style={styles.newTransferText}>{t('stock_transfer', 'Stock Transfer')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.newTransferBtn, { flex: 1, marginHorizontal: 0, marginBottom: 0, backgroundColor: '#f1f5f9', shadowOpacity: 0, borderWidth: 1, borderColor: '#e2e8f0' }]}
                        onPress={handleTransferFromPicklist}
                    >
                        <ClipboardList size={18} color="#0f172a" />
                        <Text style={[styles.newTransferText, { color: '#0f172a' }]}>{t('from_picklist', 'From Picklist')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Transfers */}
                <View style={styles.searchSection}>
                    <GlobalSearchInput
                        value={search || ''}
                        onChangeText={setSearch}
                        placeholder={t('search_transfers', 'Search transfers by Picklist...')}
                        onScan={() => handleOpenScanner('main')}
                        isSearching={isSearching}
                    />
                    {showSearchDropdown && searchResults.length > 0 && (
                        <View style={styles.dropdownResults}>
                            <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
                                {searchResults.map((se, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.dropdownListItem}
                                        onPress={() => {
                                            setShowSearchDropdown(false);
                                            handleEditTransfer(se.name);
                                        }}
                                    >
                                        <View style={styles.dropdownInfo}>
                                            <Text style={styles.dropdownId}>{se.name}</Text>
                                            <Text style={styles.dropdownMeta}>{se.posting_date} • {se.docstatus === 0 ? 'Draft' : 'Submitted'}</Text>
                                        </View>
                                        <ChevronRight size={18} color="#cbd5e1" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Latest Transfers List */}
                <View style={styles.listSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={styles.listTitle}>{t('latest_transfers', 'Latest Transfers')}</Text>
                    </View>

                    {/* Status Filters */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }} contentContainerStyle={{ gap: 8 }}>
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

                    {latestTransfers.length > 0 ? (
                        <>
                            {latestTransfers.map((se, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => handleEditTransfer(se.name)}
                                    onLongPress={() => {
                                        setSelectedOrderId(se.name);
                                        setShowOrderIdPopup(true);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <TransferCard
                                        id={se.name}
                                        from={se.from_warehouse || 'N/A'}
                                        to={se.to_warehouse || 'N/A'}
                                        items="Items"
                                        date={se.posting_date}
                                        status={se.docstatus}
                                        index={i}
                                    />
                                </TouchableOpacity>
                            ))}
                            {(listPage > 1 || hasMoreList) && (
                                <NumberedPagination
                                    currentPageIndex={listPage - 1}
                                    hasMore={hasMoreList}
                                    onNext={() => {
                                        setListPage(listPage + 1);
                                        fetchLatestTransfers(listPage + 1);
                                    }}
                                    onPrev={() => {
                                        setListPage(listPage - 1);
                                        fetchLatestTransfers(listPage - 1);
                                    }}
                                />
                            )}
                        </>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>{t('no_transfers_found', 'No transfers found')}</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* New Transfer Wizard Modal */}
            {reviewingPicklistData && reviewingPicklistData.success ? (
                <Animated.View entering={FadeInRight} style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', zIndex: 2000, justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={{ backgroundColor: '#f0fdf4', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                        <Check size={40} color="#16a34a" />
                    </View>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>Stock Entry Created!</Text>
                    <Text style={{ fontSize: 16, color: '#64748b', marginBottom: 40 }}>Draft Stock Entry <Text style={{ fontWeight: '700', color: '#0f172a' }}>{reviewingPicklistData.savedSEName}</Text> is ready.</Text>

                    <View style={{ width: '100%', paddingHorizontal: 32, gap: 16 }}>
                        <TouchableOpacity
                            style={[styles.reviewBtnView, styles.reviewBtnViewActive, { width: '100%', height: 56, borderRadius: 14 }]}
                            onPress={() => {
                                const seName = reviewingPicklistData.savedSEName;
                                setReviewingPicklistData(null);
                                if (seName) handleEditTransfer(seName);
                            }}
                        >
                            <Text style={[styles.reviewBtnText, { fontSize: 16 }]}>View Stock Entry</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.cancelBtnView, { width: '100%', height: 56, borderRadius: 14 }]}
                            onPress={() => setReviewingPicklistData(null)}
                        >
                            <Text style={[styles.cancelBtnText, { fontSize: 16 }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            ) : reviewingPicklistData ? (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#f8fafc', zIndex: 2000 }]}>
                    <TopNavbar showBackButton={false} />

                    <Animated.View entering={FadeInRight} style={{ flex: 1 }}>
                        {/* <View style={[styles.header, { padding: 20, paddingBottom: -9 }]}>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }} onPress={() => setReviewingPicklistData(null)}>
                                <ArrowLeft size={20} color="#64748b" />
                                <Text style={{ marginLeft: 8, color: '#64748b', fontSize: 16, fontWeight: '500' }}>Back</Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 26, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 }}>Transfer From Picklist</Text>
                            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Review and confirm the material transfer</Text>
                        </View> */}

                        <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

                            {/* Summary Card */}
                            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <ClipboardList size={18} color="#7634bc" />
                                        <Text style={{ fontSize: 16, color: '#7634bc', fontWeight: '700', marginLeft: 8 }}>{reviewingPicklistData.picklistId}</Text>
                                    </View>
                                    <View style={{ backgroundColor: '#f3e8ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                        <Text style={{ color: '#7634bc', fontWeight: '700', fontSize: 12 }}>Draft</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12, justifyContent: 'space-between' }}>
                                    <View>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Purpose</Text>
                                        <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: '600', marginTop: 2 }}>{reviewingPicklistData.rawDoc?.purpose || 'Material Transfer'}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Items</Text>
                                        <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: '600', marginTop: 2 }}>{reviewingPicklistData.rawDoc?.locations?.length || 0} Lines</Text>
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Total Qty</Text>
                                        <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: '600', marginTop: 2 }}>
                                            {reviewingPicklistData.rawDoc?.locations?.reduce((sum: number, i: any) => sum + (i.qty || i.stock_qty || 0), 0)}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Stock Movement Card */}
                            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Stock Movement</Text>

                                <View style={{ alignItems: 'flex-start' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ backgroundColor: '#f1f5f9', padding: 8, borderRadius: 10 }}>
                                            <Warehouse size={16} color="#64748b" />
                                        </View>
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={{ fontSize: 12, color: '#64748b' }}>FROM (Source)</Text>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{reviewingPicklistData.seDoc?.from_warehouse || reviewingPicklistData.rawDoc?.locations?.[0]?.warehouse || 'Multiple / Per-item'}</Text>
                                        </View>
                                    </View>

                                    <View style={{ marginLeft: 16, paddingVertical: 4 }}>
                                        <ArrowRight size={16} color="#cbd5e1" style={{ transform: [{ rotate: '90deg' }], marginVertical: 4 }} />
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ backgroundColor: '#f3e8ff', padding: 8, borderRadius: 10 }}>
                                            <Box size={16} color="#7634bc" />
                                        </View>
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={{ fontSize: 12, color: '#64748b' }}>TO (Target)</Text>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#7634bc', marginTop: 2 }}>{reviewingPicklistData.seDoc?.to_warehouse || reviewingPicklistData.fallbackTargetWarehouse || 'Multiple / Not set'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Transfer Validation Checklist */}
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 10, marginLeft: 4 }}>Validation</Text>
                            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                {[
                                    { text: 'Draft Pick List', active: true },
                                    { text: 'Purpose = Material Transfer', active: reviewingPicklistData.rawDoc?.purpose === 'Material Transfer' },
                                    { text: 'Source warehouse verified', active: !!reviewingPicklistData.seDoc || !!reviewingPicklistData.rawDoc?.locations?.every((l: any) => l.warehouse || l.s_warehouse) },
                                    { text: 'Target warehouse verified', active: !!reviewingPicklistData.seDoc?.to_warehouse || !!reviewingPicklistData.seDoc?.warehouse || !!reviewingPicklistData.fallbackTargetWarehouse },
                                    { text: 'Items ready', active: reviewingPicklistData.rawDoc?.locations?.length > 0 }
                                ].map((check, i) => (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i === 4 ? 0 : 10 }}>
                                        {check.active ? <CheckCircle2 size={16} color="#16a34a" /> : <X size={16} color="#ef4444" />}
                                        <Text style={{ marginLeft: 10, fontSize: 14, color: check.active ? '#334155' : '#ef4444', fontWeight: '500' }}>{check.text}</Text>
                                    </View>
                                ))}
                            </View>

                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 10, marginLeft: 4 }}>Items to Transfer</Text>
                            {reviewingPicklistData.rawDoc?.locations?.map((item: any, idx: number) => {
                                const hasBatchOrSerial = !!item.batch_no || !!item.serial_no;
                                const isExpanded = !!expandedReviewItems[idx];
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        activeOpacity={hasBatchOrSerial ? 0.7 : 1}
                                        onPress={() => {
                                            if (hasBatchOrSerial) {
                                                setExpandedReviewItems(prev => ({ ...prev, [idx]: !prev[idx] }));
                                            }
                                        }}
                                        style={{
                                            backgroundColor: '#fff',
                                            borderRadius: 16,
                                            padding: 16,
                                            marginBottom: 12,
                                            borderWidth: 1,
                                            borderColor: '#f1f5f9',
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1, paddingRight: 10 }}>
                                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>{item.item_code}</Text>
                                                <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4, lineHeight: 20 }}>{item.item_name}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <View style={{ backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#7634bc' }}>{item.qty || item.stock_qty} <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b' }}>{item.stock_uom || item.uom}</Text></Text>
                                                </View>
                                                {hasBatchOrSerial && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                                        <Text style={{ fontSize: 12, color: '#7634bc', fontWeight: '600', marginRight: 4 }}>Details</Text>
                                                        <ArrowRight size={14} color="#7634bc" style={{ transform: [{ rotate: isExpanded ? '-90deg' : '90deg' }] }} />
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {isExpanded && hasBatchOrSerial && (
                                            <Animated.View entering={FadeInRight.duration(200)} style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                                                <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16 }}>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Tracking Details</Text>

                                                    {item.batch_no && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: item.serial_no ? 12 : 0 }}>
                                                            <View style={{ backgroundColor: '#e2e8f0', width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                                                <Package size={16} color="#475569" />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ fontSize: 12, color: '#64748b' }}>Batch Number</Text>
                                                                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{item.batch_no}</Text>
                                                            </View>
                                                        </View>
                                                    )}

                                                    {item.serial_no && (
                                                        <>
                                                            {item.batch_no && <View style={{ height: 1, backgroundColor: '#e2e8f0', marginLeft: 44, marginBottom: 12 }} />}

                                                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                                                <View style={{ backgroundColor: '#e2e8f0', width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                                                    <Barcode size={16} color="#475569" />
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Serial Numbers</Text>
                                                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                                        {item.serial_no.split('\n').filter(Boolean).map((sn: string, i: number) => (
                                                                            <View key={i} style={{ backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' }}>
                                                                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>{sn}</Text>
                                                                            </View>
                                                                        ))}
                                                                    </View>
                                                                </View>
                                                            </View>
                                                        </>
                                                    )}
                                                </View>
                                            </Animated.View>
                                        )}
                                    </TouchableOpacity>
                                )
                            })}
                        </ScrollView>

                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10, flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.cancelBtnView, { flex: 1, height: 56, borderRadius: 16 }]}
                                onPress={() => setReviewingPicklistData(null)}
                            >
                                <Text style={[styles.cancelBtnText, { fontSize: 16 }]}>Back</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.reviewBtnView, styles.reviewBtnViewActive, (isSubmitting || !reviewingPicklistData.seDoc) && { opacity: 0.7 }, { flex: 2, height: 56, borderRadius: 16 }]}
                                onPress={handleReviewSubmit}
                                disabled={isSubmitting || !reviewingPicklistData.seDoc}
                            >
                                {isSubmitting ? (
                                    <>
                                        <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
                                        <Text style={[styles.reviewBtnText, { fontSize: 16 }]}>Creating...</Text>
                                    </>
                                ) : (
                                    <>
                                        <Check size={20} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={[styles.reviewBtnText, { fontSize: 16 }]}>Create Stock Entry</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            ) : null}

            {!reviewingPicklistData && isNewTransferOpen && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', zIndex: 2000 }]}>
                    <TopNavbar showBackButton={false} />

                    <View style={styles.wizardContainer}>
                        {/* Stepper */}
                        <View style={[styles.header, { position: 'relative', paddingHorizontal: 30, paddingVertical: 20 }]}>
                            <View style={{ position: 'absolute', top: 38, left: 60, right: 60, height: 2, backgroundColor: '#e2e8f0', zIndex: 1 }} />
                            <View style={{ position: 'absolute', top: 38, left: 60, width: transferStep === 1 ? '0%' : transferStep === 2 ? (requiresTracking ? '33%' : '50%') : transferStep === 3 ? (requiresTracking ? '66%' : '100%') : '100%', height: 2, backgroundColor: '#7634bc', zIndex: 2 }} />
                            <View style={styles.stepContainer}>
                                <View style={[styles.stepCircle, transferStep >= 1 && styles.stepActive]}>
                                    {transferStep > 1 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, transferStep >= 1 && styles.stepNumActive]}>1</Text>}
                                </View>
                                <Text style={[styles.stepLabel, transferStep >= 1 && styles.stepLabelActive]}>Locations</Text>
                            </View>
                            <View style={styles.stepContainer}>
                                <View style={[styles.stepCircle, transferStep >= 2 && styles.stepActive]}>
                                    {transferStep > 2 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, transferStep >= 2 && styles.stepNumActive]}>2</Text>}
                                </View>
                                <Text style={[styles.stepLabel, transferStep >= 2 && styles.stepLabelActive]}>Items</Text>
                            </View>

                            {requiresTracking && (
                                <View style={styles.stepContainer}>
                                    <View style={[styles.stepCircle, transferStep >= 3 && styles.stepActive]}>
                                        {transferStep > 3 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, transferStep >= 3 && styles.stepNumActive]}>3</Text>}
                                    </View>
                                    <Text style={[styles.stepLabel, transferStep >= 3 && styles.stepLabelActive]}>Tracking</Text>
                                </View>
                            )}

                            <View style={styles.stepContainer}>
                                <View style={[styles.stepCircle, transferStep >= totalSteps && styles.stepActive]}>
                                    <Text style={[styles.stepNum, transferStep >= totalSteps && styles.stepNumActive]}>{totalSteps}</Text>
                                </View>
                                <Text style={[styles.stepLabel, transferStep >= totalSteps && styles.stepLabelActive]}>Review</Text>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 250 }}>
                            {transferStep === 1 && (
                                <Animated.View entering={FadeInRight} style={styles.stepContent}>
                                    {editingDocStatus === 1 && (
                                        <View style={styles.submittedBanner}>
                                            <CheckCircle2 size={16} color="#16a34a" />
                                            <Text style={styles.submittedBannerText}>{t('this_stock_entry_is_', 'This stock entry is submitted. You can only review this and cannot edit.')}</Text>
                                        </View>
                                    )}
                                    <Text style={styles.wizardTitle}>{t('select_warehouses', 'Select Warehouses')}</Text>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>{t('source_warehouse', 'Source Warehouse')}</Text>
                                        <View style={[styles.whInputWrapper, isWhDropdownOpen === 'source' && styles.whInputWrapperActive]}>
                                            <View style={styles.whInputLeft}>
                                                <View style={[styles.whInputIconBg, { backgroundColor: '#f1f5f9' }]}>
                                                    <ArrowLeft size={16} color="#475569" />
                                                </View>
                                                <TextInput
                                                    placeholder="Search source..."
                                                    style={styles.whTextInput}
                                                    value={isWhDropdownOpen === 'source' ? whSearch : (sourceWh?.name || '')}
                                                    editable={editingDocStatus !== 1}
                                                    onChangeText={handleWhSearchChange}
                                                    onFocus={() => {
                                                        if (editingDocStatus !== 1) {
                                                            setIsWhDropdownOpen('source');
                                                            if (whSearch) {
                                                                setWhSearch('');
                                                            }
                                                        }
                                                    }}
                                                    placeholderTextColor="#94a3b8"
                                                />
                                            </View>
                                            <TouchableOpacity style={styles.whInputScanBtn} onPress={() => handleOpenScanner('source')} disabled={editingDocStatus === 1}>
                                                <Scan size={18} color={editingDocStatus === 1 ? '#94a3b8' : '#0f172a'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.whInputScanBtn, { borderLeftWidth: 0 }]}
                                                onPress={() => setIsWhDropdownOpen(isWhDropdownOpen === 'source' ? null : 'source')}
                                                disabled={editingDocStatus === 1}
                                            >
                                                <ChevronDown size={20} color={editingDocStatus === 1 ? '#94a3b8' : '#64748b'} />
                                            </TouchableOpacity>
                                        </View>

                                        {isWhDropdownOpen === 'source' && (
                                            <Animated.View entering={FadeInUp.duration(200)} style={styles.dropdownPortal}>
                                                <ScrollView
                                                    style={styles.dropdownListContainer}
                                                    onScroll={({ nativeEvent }) => {
                                                        if (isCloseToBottom(nativeEvent) && hasMoreWh && !isFetchingWh) {
                                                            fetchWarehouses(whSearch, true);
                                                        }
                                                    }}
                                                    scrollEventThrottle={400}
                                                >
                                                    {whList.length > 0 ? (
                                                        whList.map((wh, idx) => (
                                                            <TouchableOpacity
                                                                key={idx}
                                                                style={styles.dropdownListItem}
                                                                onPress={() => {
                                                                    setSourceWh(wh);
                                                                    setIsWhDropdownOpen(null);
                                                                    setWhSearch('');
                                                                }}
                                                            >
                                                                <Text style={styles.whListItemText}>{wh.name}</Text>
                                                            </TouchableOpacity>
                                                        ))
                                                    ) : (
                                                        <View style={styles.noResults}>
                                                            <Text style={styles.noResultsText}>{isFetchingWh ? 'Loading...' : t('no_warehouses_found', 'No warehouses found')}</Text>
                                                        </View>
                                                    )}
                                                    {isFetchingWh && whList.length > 0 && (
                                                        <View style={{ padding: 10, alignItems: 'center' }}>
                                                            <ActivityIndicator size="small" color="#94a3b8" />
                                                        </View>
                                                    )}
                                                </ScrollView>
                                            </Animated.View>
                                        )}
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>{t('target_warehouse', 'Target Warehouse')}</Text>
                                        <View style={[styles.whInputWrapper, isWhDropdownOpen === 'target' && styles.whInputWrapperActive]}>
                                            <View style={styles.whInputLeft}>
                                                <View style={[styles.whInputIconBg, { backgroundColor: '#f0fdf4' }]}>
                                                    <Plus size={16} color="#16a34a" />
                                                </View>
                                                <TextInput
                                                    placeholder="Search target..."
                                                    style={styles.whTextInput}
                                                    value={isWhDropdownOpen === 'target' ? whSearch : (targetWh?.name || '')}
                                                    editable={editingDocStatus !== 1}
                                                    onChangeText={handleWhSearchChange}
                                                    onFocus={() => {
                                                        if (editingDocStatus !== 1) {
                                                            setIsWhDropdownOpen('target');
                                                            if (whSearch) {
                                                                setWhSearch('');
                                                            }
                                                        }
                                                    }}
                                                    placeholderTextColor="#94a3b8"
                                                />
                                            </View>
                                            <TouchableOpacity style={styles.whInputScanBtn} onPress={() => handleOpenScanner('target')} disabled={editingDocStatus === 1}>
                                                <Scan size={18} color={editingDocStatus === 1 ? '#94a3b8' : '#0f172a'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.whInputScanBtn, { borderLeftWidth: 0 }]}
                                                onPress={() => setIsWhDropdownOpen(isWhDropdownOpen === 'target' ? null : 'target')}
                                                disabled={editingDocStatus === 1}
                                            >
                                                <ChevronDown size={20} color={editingDocStatus === 1 ? '#94a3b8' : '#64748b'} />
                                            </TouchableOpacity>
                                        </View>

                                        {isWhDropdownOpen === 'target' && (
                                            <Animated.View entering={FadeInUp.duration(200)} style={styles.dropdownPortal}>
                                                <ScrollView
                                                    style={styles.dropdownListContainer}
                                                    onScroll={({ nativeEvent }) => {
                                                        if (isCloseToBottom(nativeEvent) && hasMoreWh && !isFetchingWh) {
                                                            fetchWarehouses(whSearch, true);
                                                        }
                                                    }}
                                                    scrollEventThrottle={400}
                                                >
                                                    {whList.length > 0 ? (
                                                        whList.map((wh, idx) => (
                                                            <TouchableOpacity
                                                                key={idx}
                                                                style={styles.dropdownListItem}
                                                                onPress={() => {
                                                                    setTargetWh(wh);
                                                                    setIsWhDropdownOpen(null);
                                                                    setWhSearch('');
                                                                }}
                                                            >
                                                                <Text style={styles.whListItemText}>{wh.name}</Text>
                                                            </TouchableOpacity>
                                                        ))
                                                    ) : (
                                                        <View style={styles.noResults}>
                                                            <Text style={styles.noResultsText}>{isFetchingWh ? 'Loading...' : t('no_warehouses_found', 'No warehouses found')}</Text>
                                                        </View>
                                                    )}
                                                    {isFetchingWh && whList.length > 0 && (
                                                        <View style={{ padding: 10, alignItems: 'center' }}>
                                                            <ActivityIndicator size="small" color="#94a3b8" />
                                                        </View>
                                                    )}
                                                </ScrollView>
                                            </Animated.View>
                                        )}
                                    </View>
                                </Animated.View>
                            )}

                            {transferStep === 2 && (
                                <Animated.View entering={FadeInRight} style={styles.stepContent}>
                                    <View style={styles.stepHeaderRow}>
                                        {/* <Text style={styles.wizardTitle}>{t('add_items', 'Add Items')}</Text> */}
                                        <Text style={styles.wizardSubtitle}>{sourceWh?.name} → {targetWh?.name}</Text>
                                    </View>

                                    <View style={styles.itemSearchContainer}>
                                        <View style={styles.itemSearchInputWrapper}>
                                            <Search size={18} color="#94a3b8" />
                                            <TextInput
                                                placeholder="Search or scan item..."
                                                style={styles.itemSearchInput}
                                                value={itemSearchText || ''}
                                                editable={editingDocStatus !== 1}
                                                onChangeText={(t: string) => {
                                                    setItemSearchText(t);
                                                    fetchItems(t);
                                                }}
                                            />
                                            <TouchableOpacity style={styles.miniScanBtn} onPress={() => handleOpenScanner('item')}>
                                                <Scan size={16} color="#0f172a" />
                                                {/* <Text style={styles.miniScanText}>{t('scan', 'Scan')}</Text> */}
                                            </TouchableOpacity>
                                        </View>

                                        {isItemDropdownOpen && itemResults.length > 0 && (
                                            <View style={styles.itemResultsDropdown}>
                                                {itemResults.map((item, idx) => (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={styles.itemResultItem}
                                                        onPress={() => handleAddItem(item)}
                                                    >
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.itemResultCode}>{item.item_code}</Text>
                                                            <Text style={styles.itemResultName}>{item.item_name}</Text>
                                                        </View>
                                                        {item.actual_qty !== undefined && <Text style={styles.itemResultAvail}>Avail: {item.actual_qty} {item.stock_uom}</Text>}
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.selectedItemsList}>
                                        {selectedItems.map((item, idx) => (
                                            <View key={idx} style={styles.selectedItemCard}>
                                                <View style={styles.selectedItemHeader}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.selectedItemCode}>{item.item_code}</Text>
                                                        <Text style={styles.selectedItemDescription}>{item.item_name}</Text>
                                                    </View>
                                                    <TouchableOpacity onPress={() => editingDocStatus !== 1 && removeItem(item.item_code)} disabled={editingDocStatus === 1}>
                                                        <X size={20} color="#94a3b8" />
                                                    </TouchableOpacity>
                                                </View>
                                                <View style={styles.selectedItemFooter}>
                                                    <View style={[styles.qtyControl, { backgroundColor: '#f1f5f9' }]}>
                                                        <TouchableOpacity style={[styles.qtyBtn, { width: 36, height: 36 }]} onPress={() => editingDocStatus !== 1 && updateItemQty(item.item_code, -1)} disabled={editingDocStatus === 1 || !!item.has_serial_no || !!item.has_batch_no}>
                                                            <Minus size={18} color={editingDocStatus === 1 ? "#94a3b8" : "#334155"} />
                                                        </TouchableOpacity>
                                                        <TextInput
                                                            style={[styles.qtyInputText, { minWidth: 44, fontSize: 18 }]}
                                                            value={item.qty?.toString()}
                                                            onChangeText={(v: string) => {
                                                                setSelectedItems(selectedItems.map(i => i.item_code === item.item_code ? { ...i, qty: v as any } : i));
                                                            }}
                                                            keyboardType="numeric"
                                                            editable={editingDocStatus !== 1 && !item.has_serial_no && !item.has_batch_no}
                                                        />
                                                        <TouchableOpacity style={[styles.qtyBtn, { width: 36, height: 36 }]} onPress={() => editingDocStatus !== 1 && updateItemQty(item.item_code, 1)} disabled={editingDocStatus === 1 || !!item.has_serial_no || !!item.has_batch_no}>
                                                            <Plus size={18} color={editingDocStatus === 1 ? "#94a3b8" : "#334155"} />
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={{ flex: 1 }} />

                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </Animated.View>
                            )}

                            {transferStep === 3 && requiresTracking && (
                                <Animated.View entering={FadeInRight} style={styles.stepContent}>
                                    <View style={styles.stepHeaderRow}>
                                        <Text style={styles.wizardTitle}>{t('tracking_details', 'Tracking Details')}</Text>
                                    </View>

                                    {selectedItems.map((item, idx) => {
                                        if (!item.has_serial_no && !item.has_batch_no) return null;
                                        return (
                                            <View key={idx} style={[styles.reviewSummaryCard, { marginBottom: 16, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1 }]}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.reviewItemCode}>{item.item_code}</Text>
                                                        <Text style={styles.reviewItemName} numberOfLines={1}>{item.item_name}</Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Required: {item.qty}</Text>
                                                        <Text style={{ fontSize: 12, color: '#10b981', fontWeight: 'bold' }}>
                                                            Selected: {item.batches?.reduce((acc: number, b: any) => acc + (Number(b.qty) || 0), 0) || 0}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {item.batches?.map((batch: any, bIdx: number) => (
                                                    <View key={bIdx} style={[styles.batchRow, { zIndex: showSuggestions === `${idx}-${bIdx}` ? 100 : 1, position: 'relative', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }]}>
                                                        <View style={styles.batchInputGroup}>
                                                            <Text style={styles.batchLabel}>{item.has_serial_no ? 'Serial No' : 'Batch No'}</Text>
                                                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', height: 48 }}>
                                                                <View style={{ flex: 1, position: 'relative', zIndex: showSuggestions === `${idx}-${bIdx}` ? 1000 : 1, height: '100%' }}>
                                                                    <TextInput
                                                                        style={[styles.batchInput, { backgroundColor: '#fff', borderColor: '#cbd5e1' }]}
                                                                        value={batch.batch_no}
                                                                        placeholder={`Select ${item.has_serial_no ? 'serial' : 'batch'}...`}
                                                                        onChangeText={(v: string) => {
                                                                            handleTrackingChange(idx, bIdx, 'batch_no', v);
                                                                            setShowSuggestions(`${idx}-${bIdx}`);
                                                                            fetchAvailableTrackedItems(item.item_code, item.has_serial_no === 1, item.has_batch_no === 1, v);
                                                                        }}
                                                                    />
                                                                    {showSuggestions === `${idx}-${bIdx}` && availableTrackedItems.length > 0 && (
                                                                        <View style={styles.suggestionsBox}>
                                                                            {availableTrackedItems.map((s, si) => (
                                                                                <TouchableOpacity
                                                                                    key={si} style={styles.suggestionItem}
                                                                                    onPress={() => {
                                                                                        handleTrackingChange(idx, bIdx, 'batch_no', s.name);
                                                                                        setShowSuggestions(null);
                                                                                    }}
                                                                                >
                                                                                    <Text style={styles.suggestionText}>{s.name}</Text>
                                                                                    {s.warehouse && <Text style={styles.suggestionSub}>{s.warehouse}</Text>}
                                                                                </TouchableOpacity>
                                                                            ))}
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                <TouchableOpacity
                                                                    style={[styles.batchScanBtn, { backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1 }]}
                                                                    onPress={() => { setTrackingItemIndex(idx); handleOpenScanner('tracking', bIdx); }}
                                                                >
                                                                    <Scan size={18} color="#0f172a" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                        {!item.has_serial_no && (
                                                            <View style={[styles.batchInputGroup, { flex: 0.4 }]}>
                                                                <Text style={styles.batchLabel}>{t('qty', 'Qty')}</Text>
                                                                <View style={{ height: 48 }}>
                                                                    <TextInput
                                                                        style={[styles.batchInput, { backgroundColor: '#fff', borderColor: '#cbd5e1' }]}
                                                                        value={batch.qty.toString()}
                                                                        keyboardType="numeric"
                                                                        onChangeText={(v: string) => handleTrackingChange(idx, bIdx, 'qty', v)}
                                                                    />
                                                                </View>
                                                            </View>
                                                        )}
                                                        <TouchableOpacity style={styles.removeBatchBtn} onPress={() => removeTrackingEntry(idx, bIdx)}>
                                                            <X size={18} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                                <TouchableOpacity style={styles.addBatchBtn} onPress={() => addTrackingEntry(idx)}>
                                                    <Plus size={18} color="#0f172a" />
                                                    <Text style={styles.addBatchText}>{t('add_entry', 'Add Entry')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </Animated.View>
                            )}

                            {transferStep === totalSteps && (
                                <Animated.View entering={FadeInRight} style={styles.stepContent}>
                                    <View style={styles.stepHeaderRow}>
                                        <Text style={styles.wizardTitle}>{t('review_submit', 'Review & Submit')}</Text>
                                    </View>

                                    <View style={[styles.reviewSummaryCard, {
                                        backgroundColor: '#fff',
                                        shadowColor: '#7634bc',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 12,
                                        elevation: 5,
                                        borderWidth: 1,
                                        borderColor: '#e2e8f0',
                                        padding: 24,
                                        overflow: 'hidden'
                                    }]}>
                                        {/* Subtle background decoration */}
                                        <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: '#f3e8ff', opacity: 0.5 }} />

                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                            <View style={{ alignItems: 'center', flex: 1 }}>
                                                <View style={{ backgroundColor: '#f1f5f9', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                                    <Warehouse size={24} color="#64748b" />
                                                </View>
                                                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 4 }}>Source</Text>
                                                <Text style={{ fontSize: 16, color: '#0f172a', fontWeight: 'bold', textAlign: 'center' }}>{sourceWh?.name}</Text>
                                            </View>

                                            <View style={{ alignItems: 'center', paddingHorizontal: 10 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={{ height: 2, width: 30, backgroundColor: '#e2e8f0', borderStyle: 'dashed' }} />
                                                    <View style={{ backgroundColor: '#7634bc', padding: 8, borderRadius: 20, marginHorizontal: 4 }}>
                                                        <ArrowRight size={16} color="#fff" />
                                                    </View>
                                                    <View style={{ height: 2, width: 30, backgroundColor: '#e2e8f0', borderStyle: 'dashed' }} />
                                                </View>
                                            </View>

                                            <View style={{ alignItems: 'center', flex: 1 }}>
                                                <View style={{ backgroundColor: '#ecfdf5', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                                    <Warehouse size={24} color="#10b981" />
                                                </View>
                                                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 4 }}>Target</Text>
                                                <Text style={{ fontSize: 16, color: '#0f172a', fontWeight: 'bold', textAlign: 'center' }}>{targetWh?.name}</Text>
                                            </View>
                                        </View>

                                        <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 14, color: '#475569', fontWeight: '500' }}>
                                                Total Transfer Volume
                                            </Text>
                                            <Text style={{ fontSize: 16, color: '#0f172a', fontWeight: 'bold' }}>
                                                {selectedItems.length} {t('items', 'items')} • {selectedItems.reduce((acc, item) => acc + (item.qty || 0), 0)} {t('units', 'units')}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12, marginLeft: 4 }}>Items to Transfer</Text>

                                    <View style={styles.reviewItemsWrapper}>
                                        {selectedItems.map((item, idx) => (
                                            <View key={idx} style={[styles.reviewItemRow, { flexDirection: 'column', alignItems: 'stretch', padding: 16, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16 }]}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: (item.has_batch_no || item.has_serial_no) && item.batches?.length ? 12 : 0 }}>
                                                    <View style={{ flex: 1, marginRight: 12 }}>
                                                        <Text style={[styles.reviewItemCode, { fontSize: 15, color: '#0f172a', marginBottom: 4 }]}>{item.item_code}</Text>
                                                        <Text style={[styles.reviewItemName, { fontSize: 13, color: '#64748b' }]} numberOfLines={1}>{item.item_name}</Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <View style={{ backgroundColor: '#f3e8ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 4 }}>
                                                            <Text style={{ fontSize: 14, color: '#7634bc', fontWeight: 'bold' }}>
                                                                {item.qty} {item.stock_uom}
                                                            </Text>
                                                        </View>
                                                        {(item.has_batch_no || item.has_serial_no) && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
                                                                <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '600' }}>
                                                                    {item.has_serial_no ? 'Serial Tracked' : 'Batch Tracked'}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>

                                                {/* Tracking Details Sub-section */}
                                                {(item.has_batch_no || item.has_serial_no) && item.batches && item.batches.length > 0 && (
                                                    <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
                                                        <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600', marginBottom: 8 }}>Selected {item.has_serial_no ? 'Serials' : 'Batches'}:</Text>
                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                            {item.batches.map((b: any, bIdx: number) => {
                                                                if (!b.batch_no) return null;
                                                                return (
                                                                    <View key={bIdx} style={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                        <Text style={{ fontSize: 12, color: '#334155', fontWeight: '500' }}>{b.batch_no}</Text>
                                                                        {!item.has_serial_no && (
                                                                            <View style={{ backgroundColor: '#e2e8f0', width: 1, height: 12 }} />
                                                                        )}
                                                                        {!item.has_serial_no && (
                                                                            <Text style={{ fontSize: 11, color: '#64748b' }}>Qty: {b.qty}</Text>
                                                                        )}
                                                                    </View>
                                                                );
                                                            })}
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                </Animated.View>
                            )}
                        </ScrollView>

                        {/* Wizard Bottom Actions */}
                        {/* Wizard Bottom Actions */}
                        <View style={styles.bottomActions}>
                            <View style={styles.step1Buttons}>
                                <TouchableOpacity
                                    style={styles.cancelBtnView}
                                    onPress={() => {
                                        if (transferStep === 1) setIsNewTransferOpen(false);
                                        else setTransferStep(transferStep - 1);
                                    }}
                                >
                                    <Text style={styles.cancelBtnText}>{transferStep === 1 ? 'Cancel' : 'Back'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.reviewBtnView,
                                        !((transferStep === 1 && (!sourceWh || !targetWh)) || (transferStep === 2 && selectedItems.length === 0)) && styles.reviewBtnViewActive
                                    ]}
                                    onPress={() => {
                                        if (editingDocStatus === 1) {
                                            if (transferStep < totalSteps) setTransferStep(transferStep + 1);
                                            else setIsNewTransferOpen(false);
                                            return;
                                        }
                                        if (transferStep < totalSteps) setTransferStep(transferStep + 1);
                                        else submitTransfer();
                                    }}
                                    disabled={isSubmitting || (transferStep === 1 && (!sourceWh || !targetWh)) || (transferStep === 2 && selectedItems.length === 0)}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.reviewBtnText}>
                                            {editingDocStatus === 1 ? (transferStep === totalSteps ? 'Done' : 'Next') : (transferStep === totalSteps ? (editingTransferId ? 'Update Transfer' : 'Submit Transfer') : 'Next')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Stepper Footer Navbar */}
                    <View style={styles.floatingFooterContainer}>
                        <View style={styles.pillNavbar}>
                            <TouchableOpacity style={styles.pillBackBtn} onPress={() => setIsNewTransferOpen(false)}>
                                <ArrowLeft size={20} color="#94a3b8" />
                            </TouchableOpacity>
                            <View style={styles.pillDivider} />
                            <TouchableOpacity style={styles.pillNavBtn}>
                                <ArrowRightLeft size={18} color="#94a3b8" />
                                <Text style={styles.pillNavText}>{t('move', 'MOVE')}</Text>
                            </TouchableOpacity>
                            <View style={styles.pillDivider} />
                            <TouchableOpacity style={[styles.pillNavBtn, styles.pillNavBtnActive]}>
                                <FileText size={18} color="#fff" />
                                <Text style={styles.pillNavTextActive}>{t('ste', 'STE')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Bottom Actions */}
            <View style={styles.floatingFooterContainer}>
                <View style={styles.pillNavbar}>
                    <TouchableOpacity style={styles.pillBackBtn} onPress={() => router.back()}>
                        <ArrowLeft size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    <View style={styles.pillDivider} />
                    <TouchableOpacity style={[styles.pillNavBtn, styles.pillNavBtnActive]}>
                        <ArrowRightLeft size={18} color="#fff" />
                        <Text style={styles.pillNavTextActive}>{t('move', 'MOVE')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <OrderIdPopup
                visible={showOrderIdPopup}
                orderId={selectedOrderId}
                onClose={() => setShowOrderIdPopup(false)}
            />

            <ConfirmationModal
                visible={alertData.visible}
                title={alertData.title}
                message={alertData.message}
                confirmText="Okay"
                isAlert={true}
                iconType={alertData.isError ? "delete" : "submit"}
                isDestructive={alertData.isError}
                onCancel={() => setAlertData({ ...alertData, visible: false })}
            />

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Internal Move & Put-away"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_put_away')) {
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
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 14,
        justifyContent: 'space-between',
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
    analyticsTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    chartsContent: {
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
        width: 22,
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

    newTransferBtn: {
        marginHorizontal: 20,
        backgroundColor: '#2e1065',
        height: 54,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 25,
        shadowColor: '#2e1065',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    newTransferText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: Fonts.rounded,
    },
    searchSection: {
        paddingHorizontal: 20,
        marginBottom: 25,
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
    },
    searchInput: {
        flex: 1,
        height: '100%',
        marginLeft: 10,
        fontSize: 14,
        color: '#0f172a',
        fontFamily: Fonts.sans,
        paddingVertical: 0,
    },
    scanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    scanText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
    },
    listSection: {
        paddingHorizontal: 20,
    },
    listTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 15,
        fontFamily: Fonts.sans,
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
    detailsRow: {
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
    dueDateLabel: {
        fontSize: 11,
        color: '#94a3b8',
    },
    transferInfo: {
        flex: 1,
    },
    transferId: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
        letterSpacing: -0.2,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    routeText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        fontFamily: Fonts.sans,
    },
    metaRow: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 15,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
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
        fontFamily: Fonts.sans,
    },
    // Wizard Styles
    wizardContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    stepCircleActive: {
        backgroundColor: '#18181b',
    },
    stepCircleCompleted: {
        backgroundColor: '#10b981',
    },
    stepCircleInactive: {
        backgroundColor: '#f1f5f9',
    },
    stepTextActive: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    stepTextInactive: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
    },
    stepDivider: {
        width: 30,
        height: 1,
        backgroundColor: '#f1f5f9',
    },
    stepContent: {
        padding: 20,
    },
    wizardTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
        marginBottom: 8,
    },
    wizardSubtitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: 'bold',
    },
    stepHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 10,
    },
    whInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 60,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
    },
    whInputWrapperActive: {
        borderColor: '#18181b',
    },
    whInputLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        height: '100%',
    },
    whInputIconBg: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    whTextInput: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    whInputScanBtn: {
        width: 40,
        height: 40,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noResults: {
        padding: 20,
        alignItems: 'center',
    },
    noResultsText: {
        color: '#94a3b8',
        fontSize: 14,
    },
    dropdownPortal: {
        marginTop: 4,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        maxHeight: 250,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    dropdownSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 48,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 10,
    },
    dropdownSearchInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#0f172a',
    },
    dropdownListContainer: {
        maxHeight: 200,
    },
    dropdownListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    whListItemText: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
    },
    itemSearchContainer: {
        marginBottom: 20,
        zIndex: 100,
    },
    itemSearchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 15,
        height: 54,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
    },
    itemSearchInput: {
        flex: 1,
        height: '100%',
        marginLeft: 10,
        fontSize: 14,
        color: '#0f172a',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    miniScanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    miniScanText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    itemResultsDropdown: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    itemResultItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    itemResultCode: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    itemResultName: {
        fontSize: 11,
        color: '#64748b',
    },
    itemResultAvail: {
        fontSize: 11,
        color: '#10b981',
        fontWeight: 'bold',
    },
    selectedItemsList: {
        gap: 15,
    },
    selectedItemCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
    },
    selectedItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    selectedItemCode: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
    },
    selectedItemDescription: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    selectedItemFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    qtyControl: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 4,
        gap: 15,
    },
    qtyBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    qtyInputText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
        minWidth: 40,
        textAlign: 'center',
        paddingVertical: 0,
        ...Platform.select({
            web: { outlineStyle: 'none' } as any,
        }),
    },
    availHelper: {
        fontSize: 12,
        color: '#94a3b8',
        marginLeft: 10,
        flex: 1,
    },
    scanTargetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
    },
    scanTargetText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    reviewSummaryCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        marginBottom: 15,
    },
    summaryRouteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: 10,
    },
    summaryWhItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    summaryWhText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
        flex: 1,
    },
    summarySubtext: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
    },
    reviewItemsWrapper: {
        gap: 10,
    },
    reviewItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        marginHorizontal: 4,
    },
    reviewItemInfo: {
        flex: 1,
    },
    reviewItemCode: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    reviewItemName: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    reviewItemQty: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    stepContainer: { alignItems: 'center', zIndex: 2 },
    stepTrackLine: {
        position: 'absolute',
        top: 32,
        left: 44,
        right: 44,
        height: 2,
        backgroundColor: '#e2e8f0',
        zIndex: 1,
    },
    stepActiveLine: {
        position: 'absolute',
        top: 32,
        left: 44,
        height: 2,
        backgroundColor: '#7634bc',
        zIndex: 1,
    },
    stepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    stepActive: {
        backgroundColor: '#7634bc',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    stepNum: { fontSize: 14, fontWeight: 'bold', color: '#64748b', fontFamily: Fonts.rounded },
    stepNumActive: { color: '#fff' },
    stepLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500', fontFamily: Fonts.sans },
    stepLabelActive: { color: '#2e1065', fontWeight: 'bold' },
    bottomActions: { position: 'absolute', bottom: 110, left: 20, right: 20, zIndex: 10 },
    step1Buttons: { flexDirection: 'row', gap: 12 },
    cancelBtnView: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd6fe' },
    cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#2e1065', fontFamily: Fonts.sans },
    reviewBtnView: { flex: 1.4, height: 48, borderRadius: 14, backgroundColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
    reviewBtnViewActive: {
        backgroundColor: '#2e1065',
        shadowColor: '#2e1065',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    reviewBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: Fonts.sans },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusDraft: {
        backgroundColor: '#fff7ed',
    },
    statusSubmitted: {
        backgroundColor: '#f0fdf4',
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    statusTextDraft: {
        color: '#f97316',
    },
    statusTextSubmitted: {
        color: '#10b981',
    },
    dropdownResults: {
        marginTop: 4,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 5,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        elevation: 5,
        maxHeight: 260,
        overflow: 'hidden',
    },
    dropdownId: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    dropdownMeta: {
        fontSize: 11,
        color: '#94a3b8',
    },
    dropdownInfo: {
        flex: 1,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 14,
    },
    submittedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        gap: 10,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    submittedBannerText: {
        fontSize: 13,
        color: '#16a34a',
        fontWeight: '600',
        flex: 1,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        height: 100
    },
    warehouseModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
    },
    noWarehouseText: {
        textAlign: 'center',
        color: '#64748b',
        marginTop: 40,
        fontFamily: Fonts.sans,
    },
    warehouseList: {
        marginBottom: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        height: '100%',
        paddingBottom: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1.5,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#fff',
    },
    modalHeaderIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    modalBody: {
        flex: 1,
        padding: 24,
    },
    batchRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
        alignItems: 'flex-end',
        backgroundColor: '#fff',
    },
    batchInputGroup: {
        flex: 1,
    },
    batchLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
    },
    batchInput: {
        height: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '600',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    suggestionsBox: {
        position: 'absolute',
        top: 52,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 12,
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        maxHeight: 200,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    suggestionText: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: 'bold',
    },
    suggestionSub: {
        fontSize: 11,
        color: '#94a3b8',
    },
    removeBatchBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fff1f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    addBatchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        borderRadius: 16,
        marginTop: 8,
        backgroundColor: '#f8fafc',
    },
    addBatchText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    modalFooter: {
        padding: 24,
        borderTopWidth: 1.5,
        borderTopColor: '#f1f5f9',
    },
    modalSaveBtn: {
        height: 56,
        backgroundColor: '#0f172a',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSaveText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    batchScanBtn: {
        width: 48,
        height: 48,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
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
    loadMoreBtn: {
        marginTop: 15,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadMoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6366f1',
    },
});
