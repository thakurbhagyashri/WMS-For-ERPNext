import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import {
    ArrowDown,
    ArrowLeft,
    Barcode,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Factory,
    FileText,
    Info,
    Minus,
    Package,
    Plus,
    Scan,
    Trash2,
    X
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInRight } from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';

import { FloatingPill } from '@/components/FloatingPill';
import { TopNavbar } from '@/components/TopNavbar';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatToastMessage } from '@/components/ui/Toast';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const WOCard = ({ id, status, item_code, qty, uom, date, index, onPress }: any) => {
    const [isHeld, setIsHeld] = useState(false);

    return (
        <TouchableOpacity
            onPress={() => onPress?.(id)}
            onPressIn={() => setIsHeld(true)}
            onPressOut={() => setIsHeld(false)}
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
                    {item_code && (
                        <View style={styles.activityTitleRow}>
                            <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: 'bold', marginBottom: 4 }}>{item_code}</Text>
                        </View>
                    )}
                    <View style={styles.activitySubRow}>
                        <View style={styles.qtyBadge}>
                            <Text style={styles.qtyBadgeText}>
                                {qty} {uom}
                            </Text>
                        </View>
                        <StatusBadge status={status} />
                    </View>
                </View>
                <View style={styles.activityArrow}>
                    <ChevronRight size={18} color="#94a3b8" />
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function NewStockEntryScreen() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const router = useRouter();
    const { getResource, callMethod, postResource, putResource } = useFrappe(APP_CONFIG);
    const { showSuccess, showError } = useToast();

    const [step, setStep] = useState(1);

    const [woSearch, setWoSearch] = useState('');
    const [woResults, setWoResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [woPage, setWoPage] = useState(1);
    const [woHasMore, setWoHasMore] = useState(true);
    const PAGE_SIZE = 20;
    const [isScanningWo, setIsScanningWo] = useState(false);
    const [isScanningBatch, setIsScanningBatch] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [selectedWO, setSelectedWO] = useState<any>(null);
    const [fgCompletedQty, setFgCompletedQty] = useState('');

    const [isFetchingItems, setIsFetchingItems] = useState(false);
    const [transferItems, setTransferItems] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const [createdEntryName, setCreatedEntryName] = useState<string | null>(null);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [statusModal, setStatusModal] = useState<{
        visible: boolean;
        type: 'success' | 'error';
        title: string;
        message: string;
        action?: () => void;
    }>({
        visible: false,
        type: 'success',
        title: '',
        message: ''
    });

    const [trackingModalVisible, setTrackingModalVisible] = useState(false);
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
    const [batchSearch, setBatchSearch] = useState('');
    const [availableBatches, setAvailableBatches] = useState<any[]>([]);
    const [isSearchingBatches, setIsSearchingBatches] = useState(false);
    const [autoFetchQty, setAutoFetchQty] = useState('');
    const [fetchBasedOn, setFetchBasedOn] = useState('FIFO');
    const [rowSearchIndex, setRowSearchIndex] = useState<number | null>(null);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [searchTimer, setSearchTimer] = useState<any>(null);

    useEffect(() => {
        setWoPage(1);
    }, [woSearch]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const searchFilters: any[] = [
                    ['status', 'not in', ['Completed', 'Stopped', 'Closed']],
                    ['docstatus', '=', 1]
                ];

                if (woSearch) {
                    searchFilters.push(['name', 'like', `%${woSearch}%`]);
                }

                const orFilters: any[] = [
                    ['skip_transfer', '=', 1],
                    ['material_transferred_for_manufacturing', '>', 0]
                ];

                // 1. Fetch Work Orders
                const results = await getResource('Work Order', undefined, {
                    filters: JSON.stringify(searchFilters),
                    or_filters: JSON.stringify(orFilters),
                    fields: JSON.stringify([
                        'name',
                        'production_item',
                        'qty',
                        'planned_start_date',
                        'status',
                        'wip_warehouse',
                        'source_warehouse',
                        'company',
                        'stock_uom'
                    ]),
                    limit_page_length: PAGE_SIZE,
                    limit_start: (woPage - 1) * PAGE_SIZE,
                    order_by: 'creation desc'
                });

                console.log(
                    'WORK ORDERS:',
                    JSON.stringify(results, null, 2)
                );

                const fetchedResults = results || [];


                // 2. Get Work Order names

                const workOrderNames = fetchedResults.map((wo: any) => wo.name)


                if (workOrderNames.length === 0) {
                    setWoResults([]);
                    setIsSearching(false);
                    return;
                }

                // 3. Fetch child-table rows and filter via custom Python method
                const pendingWOs = await callMethod('wms_api.wms_api.api.get_work_orders_with_required_items', {
                    work_orders: JSON.stringify(workOrderNames)
                });

                console.log('PENDING WORK ORDERS:', JSON.stringify(pendingWOs, null, 2));

                setWoResults(pendingWOs);
                setWoHasMore(fetchedResults.length === PAGE_SIZE);

            } catch (err) {
                console.warn('WO Search error:', err);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [woSearch, woPage]);

    const handleGetItems = async () => {
        if (!selectedWO) return;

        const qtyToFetch = parseFloat(fgCompletedQty);
        if (isNaN(qtyToFetch) || qtyToFetch <= 0) {
            setStatusModal({
                visible: true,
                type: 'error',
                title: t('invalid_quantity', 'Invalid Quantity'),
                message: t('please_enter_fg_qty', 'Please enter a valid FG completed quantity.')
            });
            return;
        }

        setIsFetchingItems(true);
        try {
            const stockEntryDraft = await callMethod('erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry', {
                work_order_id: selectedWO.name,
                purpose: 'Material Consumption for Manufacture',
                qty: qtyToFetch
            });

            if (stockEntryDraft && stockEntryDraft.items) {
                const itemCodes = [...new Set(stockEntryDraft.items.map((i: any) => i.item_code))];
                const itemMetas = await getResource('Item', undefined, {
                    filters: JSON.stringify([['name', 'in', itemCodes]]),
                    fields: '["name", "has_batch_no", "has_serial_no"]'
                });

                const metaMap = (itemMetas || []).reduce((acc: any, m: any) => {
                    acc[m.name] = m;
                    return acc;
                }, {});

                const items = stockEntryDraft.items.map((item: any, idx: number) => ({
                    ...item,
                    original_qty: item.qty,
                    has_batch_no: metaMap[item.item_code]?.has_batch_no || 0,
                    has_serial_no: metaMap[item.item_code]?.has_serial_no || 0,
                    selected_batches: [],
                    selected_serials: [],
                    t_warehouse: item.t_warehouse || '',
                    s_warehouse: item.s_warehouse || selectedWO.wip_warehouse
                }));
                setTransferItems(items);
                setStep(2);
            } else {
                throw new Error('No items returned for this Work Order and Quantity.');
            }
        } catch (err: any) {
            console.error('Fetch items error:', err);
            setStatusModal({
                visible: true,
                type: 'error',
                title: t('error', 'Error'),
                message: err.message || 'Failed to fetch items from Work Order.'
            });
        } finally {
            setIsFetchingItems(false);
        }
    };

    const openTrackingModal = (index: number) => {
        const item = transferItems[index];
        setActiveItemIndex(index);
        setTrackingModalVisible(true);
        setBatchSearch('');
        setAvailableBatches([]);
        setAutoFetchQty(item.qty?.toString() || '');
        setFetchBasedOn('FIFO');
    };

    const handleAutoFetch = async () => {
        if (activeItemIndex === null) return;
        setIsProcessing(true);
        try {
            const item = transferItems[activeItemIndex];
            const warehouse = item.s_warehouse || item.from_warehouse;
            const targetQty = parseFloat(autoFetchQty) || item.qty;

            const batches = await getResource('Batch', undefined, {
                filters: JSON.stringify([
                    ['item', '=', item.item_code],
                    ['disabled', '=', 0]
                ]),
                fields: '["name", "expiry_date"]',
                order_by: fetchBasedOn === 'Expiry' ? 'expiry_date asc' : 'creation desc',
                limit_page_length: 50
            });

            if (batches && Array.isArray(batches)) {
                let allocated = 0;
                const result: any[] = [];

                for (const b of batches) {
                    if (allocated >= targetQty) break;
                    const needed = targetQty - allocated;
                    result.push({ batch_no: b.name, qty: needed });
                    allocated += needed;
                }

                setTransferItems(prev => {
                    const next = [...prev];
                    const updatedItem = { ...next[activeItemIndex] };
                    updatedItem.selected_batches = result;
                    next[activeItemIndex] = updatedItem;
                    return next;
                });
                showSuccess(`Pulled ${result.length} candidate batches`);
            }
        } catch (err: any) {
            showError('Failed to pull batches: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const addEmptyRow = () => {
        if (activeItemIndex === null) return;
        setTransferItems(prev => {
            const next = [...prev];
            const item = { ...next[activeItemIndex] };
            const currentSelected = [...(item.selected_batches || [])];

            const targetQty = parseFloat(autoFetchQty) || item.qty;
            const currentTotal = currentSelected.reduce((sum: number, b: any) => sum + (parseFloat(b.qty) || 0), 0);
            const remaining = Math.max(0, targetQty - currentTotal);

            item.selected_batches = [...currentSelected, {
                batch_no: '',
                qty: remaining || 0
            }];
            next[activeItemIndex] = item;
            return next;
        });
    };

    const updateBatchNo = (index: number, val: string) => {
        if (activeItemIndex === null) return;
        setTransferItems(prev => {
            const next = [...prev];
            const item = { ...next[activeItemIndex] };
            const selected = [...(item.selected_batches || [])];
            selected[index] = { ...selected[index], batch_no: val };
            item.selected_batches = selected;
            next[activeItemIndex] = item;
            return next;
        });

        if (searchTimer) clearTimeout(searchTimer);
        const timer = setTimeout(() => {
            setRowSearchIndex(index);
            searchBatches(val);
        }, 350);
        setSearchTimer(timer);
    };

    const searchBatches = async (q: string) => {
        if (activeItemIndex === null) return;
        setIsSearchingBatches(true);
        try {
            const item = transferItems[activeItemIndex];
            const results = await callMethod('erpnext.controllers.queries.get_batch_no', {
                doctype: 'Batch',
                txt: q,
                searchfield: 'name',
                start: 0,
                page_len: 20,
                filters: {
                    item_code: item.item_code,
                    warehouse: item.s_warehouse || item.from_warehouse
                }
            });

            // get_batch_no returns [[name, balance_with_uom], ...]
            setAvailableBatches(results.map((r: any) => ({
                name: r[0],
                batch_id: r[0],
                balance: r[1]
            })) || []);
        } catch (err) {
            console.warn('Batch search error:', err);
        } finally {
            setIsSearchingBatches(false);
        }
    };

    const addBatchToItem = (batch: any, index?: number) => {
        if (activeItemIndex === null) return;
        const batchNo = batch.batch_id || batch.name;

        // Calculate default quantity: remaining needed based on target fetch quantity
        const item = transferItems[activeItemIndex];
        const targetQty = parseFloat(autoFetchQty) || item.qty;

        // Exclude the currently editing row index from the total calculation to get the true remaining needed
        const currentTotal = (item.selected_batches || []).reduce((sum: number, b: any, i: number) => {
            if (index !== undefined && i === index) return sum;
            return sum + (parseFloat(b.qty) || 0);
        }, 0);

        const remainingNeeded = Math.max(0, targetQty - currentTotal);

        let batchBalance = 999999;
        if (batch.balance) {
            const cleaned = typeof batch.balance === 'string' ? batch.balance.replace(/,/g, '') : batch.balance.toString();
            const match = cleaned.match(/[\d.]+/);
            if (match) batchBalance = parseFloat(match[0]);
        }

        const defaultQty = remainingNeeded;

        setTransferItems(prev => {
            const next = [...prev];
            const item = { ...next[activeItemIndex] };
            const selected = [...(item.selected_batches || [])];

            if (index !== undefined && index > -1) {
                selected[index] = { ...selected[index], batch_no: batchNo, qty: defaultQty || 1 };
            } else if (!selected.some((b: any) => b.batch_no === batchNo)) {
                selected.push({
                    batch_no: batchNo,
                    qty: defaultQty || 1
                });
            }

            item.selected_batches = selected;
            next[activeItemIndex] = item;
            return next;
        });

        if (index === undefined) {
            setAvailableBatches([]);
            setBatchSearch('');
        } else {
            setRowSearchIndex(null);
            setAvailableBatches([]);
        }
    };
    const removeBatchFromItem = (batchNo: string) => {
        if (activeItemIndex === null) return;
        setTransferItems(prev => {
            const next = [...prev];
            const item = { ...next[activeItemIndex] };
            item.selected_batches = (item.selected_batches || []).filter((b: any) => b.batch_no !== batchNo);
            next[activeItemIndex] = item;
            return next;
        });
    };

    const updateBatchQty = (batchNo: string, val: string) => {
        if (activeItemIndex === null) return;
        // Keep as string to avoid cursor jumping during decimal typing
        setTransferItems(prev => {
            const next = [...prev];
            const item = { ...next[activeItemIndex] };
            const selected = [...(item.selected_batches || [])];
            const batchIdx = selected.findIndex((b: any) => b.batch_no === batchNo);
            if (batchIdx > -1) {
                selected[batchIdx] = { ...selected[batchIdx], qty: val };
                item.selected_batches = selected;
                next[activeItemIndex] = item;
            }
            return next;
        });
    };

    const handleSave = async () => {
        setIsProcessing(true);
        try {
            const finalItems = await Promise.all(transferItems.map(async (item) => {
                if ((item.has_batch_no || item.has_serial_no) && !item.serial_and_batch_bundle) {
                    // Only create bundle if details are provided, otherwise allow saving Draft without it
                    if (item.selected_batches?.length > 0 || item.selected_serials?.length > 0) {

                        const bundleData = {
                            doctype: 'Serial and Batch Bundle',
                            item_code: item.item_code,
                            warehouse: item.s_warehouse,
                            type_of_transaction: 'Outward',
                            is_outward: 1,
                            voucher_type: 'Stock Entry',
                            total_qty: item.qty,
                            entries: item.selected_batches.map((b: any) => ({
                                batch_no: b.batch_no,
                                qty: b.qty
                            }))
                        };
                        const bundle = await postResource('Serial and Batch Bundle', bundleData);
                        return { ...item, serial_and_batch_bundle: bundle.name };
                    }
                    return item; // Return item as draft without bundle
                }
                return item;
            }));

            const stockEntryDoc = {
                doctype: 'Stock Entry',
                stock_entry_type: 'Material Consumption for Manufacture',
                work_order: selectedWO.name,
                company: selectedWO.company,
                items: finalItems,
                fg_completed_qty: parseFloat(fgCompletedQty),
                from_bom: 1
            };

            if (createdEntryName) {
                await putResource('Stock Entry', createdEntryName, stockEntryDoc, false, undefined, true);
                setStatusModal({
                    visible: true,
                    type: 'success',
                    title: t('success', 'Success'),
                    message: `Stock Entry ${createdEntryName} updated.`
                });
            } else {
                const response = await postResource('Stock Entry', stockEntryDoc, false, undefined, true);
                setCreatedEntryName(response.name);
                setStatusModal({
                    visible: true,
                    type: 'success',
                    title: t('success', 'Success'),
                    message: `Stock Entry ${response.name} saved as Draft.`
                });
            }
        } catch (err: any) {
            console.error('Save Error:', err);
            const errorMsg = err.message || '';
            if (errorMsg.toLowerCase().includes('valuation') || errorMsg.toLowerCase().includes('valuation_rate') || errorMsg.includes('0')) {
                setStatusModal({
                    visible: true,
                    type: 'error',
                    title: t('unable_to_save', 'Unable to save stock entry'),
                    message: t('valuation_error_msg', 'The selected item does not have a valuation rate or stock cost configured.\n\nPlease contact Admin/Inventory Team or enable zero valuation for this item.')
                });
            } else {
                setStatusModal({
                    visible: true,
                    type: 'error',
                    title: t('error', 'Error'),
                    message: errorMsg || 'Failed to save Stock Entry'
                });
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubmit = async () => {
        if (!createdEntryName) return;
        setShowSubmitModal(false);
        setIsProcessing(true);
        try {
            await putResource('Stock Entry', createdEntryName, { docstatus: 1 }, false, undefined, true);
            setStatusModal({
                visible: true,
                type: 'success',
                title: t('success', 'Success'),
                message: t('stock_entry_submitted', 'Stock Entry submitted successfully.'),
                action: () => {
                    router.push('/inventory/consumption-mfg');
                }
            });
        } catch (err: any) {
            console.error('Submit Error:', err);
            const errorMsg = err.message || '';
            if (errorMsg.toLowerCase().includes('valuation') || errorMsg.toLowerCase().includes('valuation_rate') || errorMsg.includes('0')) {
                setStatusModal({
                    visible: true,
                    type: 'error',
                    title: t('unable_to_submit', 'Unable to submit stock entry'),
                    message: t('valuation_error_msg', 'The selected item does not have a valuation rate or stock cost configured.\n\nPlease contact Admin/Inventory Team or enable zero valuation for this item.')
                });
            } else {
                setStatusModal({
                    visible: true,
                    type: 'error',
                    title: t('error', 'Error'),
                    message: errorMsg || 'Failed to submit Stock Entry'
                });
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <TopNavbar title="" showBackButton={step === 1} />

                <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 280 }}>
                    {step === 1 ? (
                        <Animated.View entering={FadeIn}>
                            {createdEntryName && (
                                <View style={{ marginHorizontal: 24, marginTop: 24, backgroundColor: '#fffbeb', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#fde68a', marginBottom: 12 }}>
                                    <Info size={20} color="#d97706" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#b45309' }}>{t('draft_saved', 'Draft Saved')}</Text>
                                        <Text style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>{t('draft_saved_desc', `Stock Entry ${createdEntryName} has been saved as draft.`)}</Text>
                                    </View>
                                </View>
                            )}
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>{t('select_work_order', 'Select Work Order')}</Text>
                                <GlobalSearchInput
                                    placeholder="Search WO-XXXX..."
                                    value={selectedWO ? selectedWO.name : woSearch}
                                    onChangeText={(txt) => {
                                        setWoSearch(txt);
                                        if (selectedWO) setSelectedWO(null);
                                    }}
                                    onScan={async () => {
                                        if (!permission?.granted) {
                                            const { granted } = await requestPermission();
                                            if (!granted) {
                                                Alert.alert(t('camera_permission_required', 'Camera Permission Required'), t('please_grant_camera_permission', 'Please grant camera permission to use the scanner.'));
                                                return;
                                            }
                                        }
                                        setIsScanningWo(true);
                                    }}
                                    isSearching={isSearching}
                                    containerStyle={{ marginBottom: 12 }}
                                />

                                {!isSearching && woResults.length === 0 && !selectedWO && (
                                    <View style={{ padding: 32, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 24 }}>
                                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                                            <ClipboardList size={28} color="#64748b" />
                                        </View>
                                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#334155', fontFamily: Fonts.rounded, marginBottom: 8 }}>{t('no_work_orders_found', 'No Work Orders Found')}</Text>
                                        <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
                                            {woSearch.trim().length > 0
                                                ? t('no_work_orders_search_desc', `We couldn't find any pending work orders matching "${woSearch}".`)
                                                : t('no_work_orders_desc', "There are currently no pending work orders available for consumption.")}
                                        </Text>
                                    </View>
                                )}

                                {woResults.length > 0 && !selectedWO && (
                                    <View style={{ gap: 12 }}>
                                        {woResults.map((wo, idx) => (
                                            <WOCard
                                                key={idx}
                                                index={idx}
                                                id={wo.name}
                                                status={wo.status}
                                                item_code={wo.production_item}
                                                qty={wo.qty}
                                                uom={wo.stock_uom}
                                                date={wo.creation?.split(' ')[0]}
                                                onPress={() => {
                                                    setSelectedWO(wo);
                                                    setWoSearch('');
                                                    setWoResults([]);
                                                    setFgCompletedQty(wo.qty.toString());
                                                }}
                                            />
                                        ))}
                                        {(woPage > 1 || woHasMore) && (
                                            <NumberedPagination
                                                currentPageIndex={woPage}
                                                hasMore={woHasMore}
                                                onNext={() => setWoPage(p => p + 1)}
                                                onPrev={() => setWoPage(p => Math.max(1, p - 1))}
                                            />
                                        )}
                                    </View>
                                )}
                            </View>

                            {selectedWO && (
                                <Animated.View entering={FadeInUp} style={styles.selectionDetails}>
                                    <View style={styles.woInfoCard}>
                                        <View style={styles.woInfoHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                                <ClipboardList size={20} color="#0f172a" />
                                                <Text style={styles.woInfoId} numberOfLines={1}>{selectedWO.name}</Text>
                                            </View>
                                            <StatusBadge status={selectedWO.status} />
                                        </View>
                                        <View style={styles.pillsRow}>
                                            <View style={styles.infoPill}>
                                                <Package size={14} color="#64748b" />
                                                <Text style={styles.infoPillText}>{selectedWO.production_item}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.qtySection}>
                                        <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' }}>
                                            Consumption Quantity
                                        </Text>
                                        <View style={styles.qtyInputContainer}>
                                            <TextInput
                                                style={styles.qtyInput}
                                                value={fgCompletedQty}
                                                onChangeText={setFgCompletedQty}
                                                keyboardType="numeric"
                                                placeholder="Enter Qty..."
                                            />
                                            <View style={styles.qtyUnitBadge}>
                                                <Text style={styles.qtyUnitText}>{selectedWO.stock_uom}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.qtyHint}>Planned Qty: {selectedWO.qty} {selectedWO.stock_uom}</Text>

                                        <TouchableOpacity
                                            style={{ marginTop: 24, borderRadius: 12, overflow: 'hidden' }}
                                            onPress={handleGetItems}
                                            disabled={isFetchingItems}
                                        >
                                            <LinearGradient
                                                colors={['#7634bc', '#2e1065']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={{ height: 50, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }}
                                            >
                                                {isFetchingItems ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <>
                                                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('start_consumption', 'Start Consumption')}</Text>
                                                        <ChevronRight size={18} color="#fff" />
                                                    </>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                </Animated.View>
                            )}
                        </Animated.View>
                    ) : (
                        <Animated.View entering={SlideInRight}>
                            <View style={[styles.header, { paddingBottom: 16 }]}>
                                {createdEntryName && (
                                    <View style={styles.idBadge}>
                                        <Text style={styles.idBadgeLabel}>{t('stock_entry', 'STOCK ENTRY')}</Text>
                                        <Text style={styles.idBadgeValue}>{createdEntryName}</Text>
                                    </View>
                                )}
                                <View style={{ backgroundColor: '#2e1065', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#7634bc', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 10 }}>
                                            <ClipboardList size={18} color="#e9d5ff" />
                                        </View>
                                        <Text style={[styles.activeWoId, { color: '#ffffff' }]}>{selectedWO.name}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                        <Package size={14} color="#d8b4fe" />
                                        <Text style={[styles.activeWoItem, { color: '#f3e8ff' }]}>{selectedWO.production_item} × {fgCompletedQty}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.itemsBlock}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#f3e8ff', justifyContent: 'center', alignItems: 'center' }}>
                                            <Package size={20} color="#7634bc" />
                                        </View>
                                        <View>
                                            <Text style={styles.listTitle}>{t('consume_raw_material', 'Consume Raw Materials')}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <Factory size={12} color="#94a3b8" />
                                                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600' }}>Target: {selectedWO.wip_warehouse || 'N/A'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {transferItems.map((item, idx) => (
                                    <Animated.View key={idx} entering={FadeInUp.delay(idx * 50)} style={[styles.itemWizardCard, item.is_finished_item === 1 && styles.finishedItemCard]}>
                                        <View style={[styles.itemWizHeader, { alignItems: 'center' }]}>
                                            <View style={{ flex: 1, paddingRight: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                                    <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                        <Text style={[styles.itemWizCode, { marginTop: 0, fontSize: 11, fontWeight: '800', color: '#475569' }]}>{item.item_code}</Text>
                                                    </View>
                                                    {item.is_finished_item === 1 && (
                                                        <View style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                            <Text style={{ fontSize: 10, color: '#4338ca', fontWeight: 'bold' }}>Finished Good</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.itemWizName} numberOfLines={2}>{item.item_name}</Text>
                                            </View>
                                            {!!(item.has_batch_no || item.has_serial_no) && (
                                                <TouchableOpacity
                                                    style={styles.trackingPill}
                                                    onPress={() => openTrackingModal(idx)}
                                                >
                                                    <Barcode size={14} color="#7634bc" />
                                                    <Text style={styles.trackingPillText}>
                                                        {(item.selected_batches?.length || 0) > 0 ? `${item.selected_batches.length} Batches` : 'Select Batch / Serial'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <View style={styles.itemWizDivider} />

                                        <View style={styles.itemWizActions}>
                                            <Text style={[styles.wizTotalQtyLabel, { marginRight: 12 }]}>{t('qty', 'Quantity')}</Text>
                                            <View style={styles.qtyControlsContainer}>
                                                <View style={styles.qtyRow}>
                                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => {
                                                        setTransferItems(prev => {
                                                            const next = [...prev];
                                                            const current = parseFloat(next[idx].qty.toString()) || 0;
                                                            if (current > 0) next[idx].qty = current - 1;
                                                            return next;
                                                        });
                                                    }}>
                                                        <Minus size={16} color="#0f172a" />
                                                    </TouchableOpacity>
                                                    <View style={styles.qtyDisplay}>
                                                        <TextInput
                                                            style={styles.qtyValueInput}
                                                            value={item.qty?.toString()}
                                                            onChangeText={(v) => {
                                                                const val = parseFloat(v) || 0;
                                                                setTransferItems(prev => {
                                                                    const next = [...prev];
                                                                    next[idx].qty = val;
                                                                    return next;
                                                                });
                                                            }}
                                                            keyboardType="numeric"
                                                        />
                                                    </View>
                                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => {
                                                        setTransferItems(prev => {
                                                            const next = [...prev];
                                                            const current = parseFloat(next[idx].qty.toString()) || 0;
                                                            next[idx].qty = current + 1;
                                                            return next;
                                                        });
                                                    }}>
                                                        <Plus size={16} color="#0f172a" />
                                                    </TouchableOpacity>
                                                </View>
                                                <Text style={styles.wizTotalQty}>/ {item.original_qty} {item.uom}</Text>
                                            </View>
                                        </View>
                                    </Animated.View>
                                ))}
                            </View>
                        </Animated.View>
                    )}
                </ScrollView>

                <Modal visible={trackingModalVisible} animationType="slide" transparent={true} statusBarTranslucent onRequestClose={() => setTrackingModalVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.modalTitle}>
                                        {activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no ? 'Add Batch Nos' : 'Add Serial Nos'}
                                    </Text>
                                    <Text style={styles.modalSubtitle} numberOfLines={1} ellipsizeMode="tail">
                                        {activeItemIndex !== null && transferItems[activeItemIndex].item_name}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setTrackingModalVisible(false)} style={styles.modalCloseBtn}>
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                {/* Auto Fetch Section */}
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalSectionTitle}>{t('auto_fetch', 'Auto Fetch')}</Text>
                                    <View style={styles.modalGrid}>
                                        <View style={styles.modalGridCol}>
                                            <Text style={styles.modalSubLabel}>{t('qty_to_fetch', 'Qty to Fetch')}</Text>
                                            <TextInput
                                                style={styles.erpInput}
                                                value={autoFetchQty}
                                                onChangeText={setAutoFetchQty}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={styles.modalGridCol}>
                                            <Text style={styles.modalSubLabel}>{t('fetch_based_on', 'Fetch Based On')}</Text>
                                            <TouchableOpacity
                                                style={styles.erpSelect}
                                                onPress={() => {
                                                    Alert.alert(
                                                        "Fetch Based On",
                                                        "Choose a strategy for auto-fetching",
                                                        [
                                                            { text: "FIFO", onPress: () => { setFetchBasedOn('FIFO'); handleAutoFetch(); } },
                                                            { text: "LIFO", onPress: () => { setFetchBasedOn('LIFO'); handleAutoFetch(); } },
                                                            { text: "Expiry", onPress: () => { setFetchBasedOn('Expiry'); handleAutoFetch(); } },
                                                            { text: "Cancel", style: "cancel" }
                                                        ]
                                                    );
                                                }}
                                            >
                                                <Text style={styles.erpSelectText}>{fetchBasedOn}</Text>
                                                <ChevronDown size={14} color="#64748b" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Warehouse & Scan Section */}
                                <View style={styles.modalSection}>
                                    <View style={styles.modalGrid}>
                                        <View style={styles.modalGridCol}>
                                            <Text style={styles.modalSubLabel}>{t('warehouse', 'Warehouse')}</Text>
                                            <View style={styles.erpLinkField}>
                                                <TextInput
                                                    style={styles.erpLinkInput}
                                                    value={activeItemIndex !== null ? (transferItems[activeItemIndex].s_warehouse || transferItems[activeItemIndex].from_warehouse) : ''}
                                                    onChangeText={(t) => {
                                                        if (activeItemIndex !== null) {
                                                            setTransferItems(prev => {
                                                                const next = [...prev];
                                                                next[activeItemIndex] = { ...next[activeItemIndex], s_warehouse: t };
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                />
                                                <View style={styles.erpLinkIcons}>
                                                    <X size={14} color="#94a3b8" />
                                                    <ArrowDown size={14} color="#94a3b8" style={{ transform: [{ rotate: '-90deg' }] }} />
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.modalGridCol}>
                                            <Text style={styles.modalSubLabel}>
                                                {activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no ? 'Scan Batch No' : 'Scan Serial No'}
                                            </Text>
                                            <View style={styles.erpScanField}>
                                                <TextInput
                                                    style={styles.erpScanInput}
                                                    placeholder=""
                                                    value={batchSearch}
                                                    onFocus={() => {
                                                        setRowSearchIndex(null);
                                                        setIsDropdownVisible(true);
                                                        searchBatches(batchSearch);
                                                    }}
                                                    onChangeText={(t) => {
                                                        setBatchSearch(t);
                                                        if (searchTimer) clearTimeout(searchTimer);
                                                        const timer = setTimeout(() => {
                                                            searchBatches(t);
                                                        }, 350);
                                                        setSearchTimer(timer);
                                                    }}
                                                />
                                                <TouchableOpacity onPress={async () => {
                                                    if (!permission?.granted) {
                                                        const { granted } = await requestPermission();
                                                        if (!granted) {
                                                            Alert.alert(t('camera_permission_required', 'Camera Permission Required'), t('please_grant_camera_permission', 'Please grant camera permission to use the scanner.'));
                                                            return;
                                                        }
                                                    }
                                                    setIsScanningBatch(true);
                                                }}>
                                                    <Scan size={16} color="#94a3b8" />
                                                </TouchableOpacity>
                                                {rowSearchIndex === null && isDropdownVisible && (
                                                    <View style={styles.batchDropdown}>
                                                        {isSearchingBatches ? (
                                                            <ActivityIndicator size="small" color="#0f172a" style={{ padding: 15 }} />
                                                        ) : availableBatches.length > 0 ? (
                                                            availableBatches.map((b, idx) => (
                                                                <TouchableOpacity key={idx} style={styles.batchDropItem} onPress={() => { addBatchToItem(b); setAvailableBatches([]); setBatchSearch(''); setIsDropdownVisible(false); }}>
                                                                    <View>
                                                                        <Text style={styles.batchDropId}>{b.batch_id || b.name}</Text>
                                                                        {b.balance && <Text style={styles.batchDropSubtitle}>{b.balance}</Text>}
                                                                    </View>
                                                                    <Plus size={16} color="#0f172a" />
                                                                </TouchableOpacity>
                                                            ))
                                                        ) : (
                                                            <Text style={{ padding: 15, color: '#94a3b8', textAlign: 'center' }}>{t('no_batches_found', 'No batches found')}</Text>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                </View>

                                <View style={styles.modalDivider} />

                                {/* Table Section */}
                                <View style={styles.erpTableContainer}>
                                    <View style={styles.erpTableHeader}>
                                        <View style={styles.erpColCheck}>
                                            <View style={styles.erpCheckbox} />
                                        </View>
                                        <View style={styles.erpColId}>
                                            <Text style={styles.erpHeaderText}>
                                                {activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no ? 'Batch No' : 'Serial No'}
                                            </Text>
                                        </View>
                                        {activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no && (
                                            <View style={styles.erpColQty}>
                                                <Text style={styles.erpHeaderText}>{t('quantity', 'Quantity')}</Text>
                                            </View>
                                        )}
                                        <View style={styles.erpColAction} />
                                    </View>

                                    {activeItemIndex !== null && transferItems[activeItemIndex].selected_batches?.map((b: any, i: number) => (
                                        <View key={i} style={{ zIndex: rowSearchIndex === i ? 2000 : 1 }}>
                                            <View style={styles.erpTableRow}>
                                                <View style={styles.erpColCheck}>
                                                    <View style={styles.erpCheckbox} />
                                                </View>
                                                <View style={styles.erpColId}>
                                                    <TextInput
                                                        style={styles.erpRowInput}
                                                        value={b.batch_no}
                                                        onChangeText={(v) => updateBatchNo(i, v)}
                                                        onFocus={() => {
                                                            setRowSearchIndex(i);
                                                            setIsDropdownVisible(true);
                                                            searchBatches(b.batch_no);
                                                        }}
                                                        placeholder={activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no ? "Batch No" : "Serial No"}
                                                    />

                                                    {rowSearchIndex === i && isDropdownVisible && (
                                                        <View style={styles.rowDropdown}>
                                                            {isSearchingBatches ? (
                                                                <ActivityIndicator size="small" color="#0f172a" style={{ padding: 10 }} />
                                                            ) : availableBatches.length > 0 ? (
                                                                availableBatches.map((res: any, idx: number) => (
                                                                    <TouchableOpacity
                                                                        key={idx}
                                                                        style={styles.rowDropItem}
                                                                        onPress={() => { addBatchToItem(res, i); setIsDropdownVisible(false); }}
                                                                    >
                                                                        <Text style={styles.rowDropText}>{res.name}</Text>
                                                                        <Text style={styles.rowDropSubtitle}>Balance: {res.balance || '0.000'}</Text>
                                                                    </TouchableOpacity>
                                                                ))
                                                            ) : (
                                                                <Text style={{ padding: 10, color: '#94a3b8', textAlign: 'center', fontSize: 12 }}>{t('no_results', 'No results')}</Text>
                                                            )}
                                                        </View>
                                                    )}
                                                </View>
                                                {activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no && (
                                                    <View style={styles.erpColQty}>
                                                        <TextInput
                                                            style={[styles.erpRowInput, { textAlign: 'right' }]}
                                                            value={b.qty?.toString()}
                                                            onChangeText={(v) => updateBatchQty(b.batch_no, v)}
                                                            keyboardType="numeric"
                                                        />
                                                    </View>
                                                )}
                                                <View style={styles.erpColAction}>
                                                    <TouchableOpacity onPress={() => removeBatchFromItem(b.batch_no)}>
                                                        <Trash2 size={14} color="#94a3b8" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                        </View>
                                    ))}
                                </View>

                                <TouchableOpacity style={styles.erpAddRowBtn} onPress={addEmptyRow}>
                                    <Text style={styles.erpAddRowText}>{t('add_row', 'Add Row')}</Text>
                                </TouchableOpacity>
                            </ScrollView>

                            <View style={styles.erpModalFooter}>
                                <TouchableOpacity style={styles.erpLightBtn}>
                                    <Text style={styles.erpLightBtnText}>{t('edit_full_form', 'Edit Full Form')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.erpDarkBtn}
                                    onPress={() => {
                                        handleAutoFetch(); // Trigger auto fetch if needed, then close or stay
                                        setTrackingModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.erpDarkBtnText}>
                                        {activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no ? 'Add Batch Nos' : 'Add Serial Nos'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* Unified Bottom Footer Panel — hidden when modal is open to prevent bleed-through */}
                {!trackingModalVisible && !isScanningWo && (
                    <Animated.View entering={FadeIn} style={[styles.unifiedFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                        {step === 2 && (
                            <View style={[styles.bottomActionsInner, { paddingHorizontal: 16 }]}>
                                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}
                                        onPress={() => setStep(1)}
                                        disabled={isProcessing}
                                    >
                                        <Text style={{ color: '#475569', fontSize: 15, fontWeight: '700' }}>{t('back', 'Back')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ flex: 1.5, height: 50, borderRadius: 12, overflow: 'hidden' }}
                                        onPress={() => createdEntryName ? setShowSubmitModal(true) : handleSave()}
                                        disabled={isProcessing}
                                    >
                                        <LinearGradient
                                            colors={['#7634bc', '#2e1065']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                                                    {createdEntryName ? t('submit_entry', 'Submit') : t('save_draft', 'Save Draft')}
                                                </Text>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </Animated.View>
                )}

                {step === 1 && (
                    <FloatingPill
                        onBackPress={() => router.back()}
                        backIcon={<ArrowLeft size={20} color="#fff" />}
                        leftLabel={t('consume', 'CONSUME')}
                        leftIcon={<Factory size={18} color="#94a3b8" />}
                        rightLabel={t('ste', 'STE')}
                        rightIcon={<FileText size={18} color="#fff" />}
                        style={{ bottom: Math.max(insets.bottom + 16, 24) }}
                    />
                )}



                {isScanningWo && (
                    <Modal
                        visible={isScanningWo}
                        animationType="slide"
                        transparent={true}
                        onRequestClose={() => setIsScanningWo(false)}
                    >
                        <View style={{ flex: 1, backgroundColor: 'black' }}>
                            <CameraView
                                style={{ flex: 1 }}
                                facing="back"
                                barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "pdf417", "aztec", "datamatrix", "code39", "code93", "code128", "upc_a", "upc_e"] }}
                                onBarcodeScanned={({ data }) => {
                                    setWoSearch(data);
                                    if (selectedWO) setSelectedWO(null);
                                    setIsScanningWo(false);
                                }}
                            >
                                <View style={StyleSheet.absoluteFill} />
                            </CameraView>
                            <TouchableOpacity
                                style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 24 }}
                                onPress={() => setIsScanningWo(false)}
                            >
                                <X size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </Modal>
                )}

                {isScanningBatch && (
                    <Modal
                        visible={isScanningBatch}
                        animationType="slide"
                        transparent={true}
                        onRequestClose={() => setIsScanningBatch(false)}
                    >
                        <View style={{ flex: 1, backgroundColor: 'black' }}>
                            <CameraView
                                style={{ flex: 1 }}
                                facing="back"
                                barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "pdf417", "aztec", "datamatrix", "code39", "code93", "code128", "upc_a", "upc_e"] }}
                                onBarcodeScanned={({ data }) => {
                                    setBatchSearch(data);
                                    setIsScanningBatch(false);
                                    setRowSearchIndex(null);
                                    setIsDropdownVisible(true);
                                    searchBatches(data);
                                }}
                            >
                                <View style={StyleSheet.absoluteFill} />
                            </CameraView>
                            <TouchableOpacity
                                style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 24 }}
                                onPress={() => setIsScanningBatch(false)}
                            >
                                <X size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </Modal>
                )}

                <ConfirmationModal
                    visible={showSubmitModal}
                    title="Submit Entry"
                    message="Are you sure you want to permanently submit this stock entry? This action cannot be easily reversed."
                    confirmText="Submit"
                    iconType="submit"
                    onConfirm={handleSubmit}
                    onCancel={() => setShowSubmitModal(false)}
                />

                <ConfirmationModal
                    visible={showCancelModal}
                    title="Cancel Entry"
                    message="Are you sure you want to cancel? All unsaved data will be permanently lost."
                    confirmText="Discard"
                    cancelText="Keep Editing"
                    isDestructive={true}
                    iconType="delete"
                    onConfirm={() => {
                        setShowCancelModal(false);
                        router.back();
                    }}
                    onCancel={() => setShowCancelModal(false)}
                />

                <ConfirmationModal
                    visible={statusModal.visible}
                    title={statusModal.title}
                    message={formatToastMessage(statusModal.message) || statusModal.message}
                    confirmText="Okay"
                    isDestructive={statusModal.type === 'error'}
                    isAlert={true}
                    iconType={statusModal.type === 'success' ? 'submit' : 'alert'}
                    onCancel={() => {
                        const action = statusModal.action;
                        setStatusModal(prev => ({ ...prev, visible: false }));
                        if (action) action();
                    }}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { flex: 1 },
    header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
    idBadge: { backgroundColor: '#f1f5f9', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    idBadgeLabel: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
    idBadgeValue: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },
    section: { paddingHorizontal: 24, marginBottom: 24 },
    sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12, fontFamily: Fonts.sans, marginTop: 12 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        height: 52,
        paddingLeft: 12,
        paddingRight: 4,
        gap: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#0f172a',
        fontFamily: Fonts.sans,
        fontWeight: '500',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    resultsContainer: { backgroundColor: '#fff', borderRadius: 20, marginTop: 0, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 250, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
    resultItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    resultInfo: { flex: 1 },
    resultName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', fontFamily: Fonts.rounded },
    resultMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
    selectionDetails: { paddingHorizontal: 24 },
    woInfoCard: { backgroundColor: '#fff', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 24, shadowColor: '#7634bc', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.03, shadowRadius: 15, elevation: 2 },
    woInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    woInfoId: { fontSize: 22, fontWeight: '900', color: '#0f172a', fontFamily: Fonts.rounded },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    infoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
    infoPillText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    qtySection: { marginBottom: 32 },
    qtyInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        height: 52,
        paddingLeft: 12,
        paddingRight: 4,
        gap: 12,
        borderWidth: 1.5,
        borderColor: '#0f172a',
        overflow: 'hidden',
    },
    qtyInput: {
        flex: 1,
        height: '100%',
        width: '100%',
        paddingVertical: 0,
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    qtyUnitBadge: { backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    qtyUnitText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    qtyHint: { fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'right', fontWeight: '600' },
    activeWoId: { fontSize: 18, fontWeight: '800', color: '#0f172a', fontFamily: Fonts.rounded },
    activeWoItem: { fontSize: 13, color: '#475569', fontWeight: '600' },
    itemsBlock: { paddingHorizontal: 20, marginTop: 4 },
    listTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', fontFamily: Fonts.rounded, marginBottom: 2 },
    listSubtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16, fontWeight: '600' },
    itemWizardCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
    finishedItemCard: { borderColor: '#c7d2fe', backgroundColor: '#fafafa', shadowColor: '#4338ca' },
    itemWizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
    itemWizCode: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 0 },
    itemWizName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    itemWizDivider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: -16, marginBottom: 10 },
    trackingPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
    trackingPillDisabled: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
    trackingPillText: { fontSize: 11, fontWeight: '700', color: '#334155' },
    itemWizActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    wizTotalQtyLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    qtyControlsContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 4,
    },
    qtyBtn: {
        width: 36,
        height: 36,
        borderRadius: 16,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    qtyDisplay: {
        width: 60,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyValueInput: {
        width: '100%',
        height: '100%',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
        paddingVertical: 0,
        ...Platform.select({
            web: { outlineStyle: 'none' } as any,
        }),
    },
    wizTotalQty: { fontSize: 13, color: '#94a3b8', fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, height: SCREEN_HEIGHT * 0.9 },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        fontFamily: Fonts.rounded,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSection: { marginBottom: 16 },
    modalSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
    modalGrid: { flexDirection: 'row', gap: 16 },
    modalGridCol: { flex: 1 },
    modalSubLabel: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
    erpInput: {
        backgroundColor: '#f8fafc',
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#1f2937',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    erpSelect: {
        backgroundColor: '#f8fafc',
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    erpSelectText: { fontSize: 14, color: '#1f2937' },
    erpLinkField: {
        backgroundColor: '#f8fafc',
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    erpLinkInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#1f2937',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    erpLinkIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    erpScanField: {
        position: 'relative',
        backgroundColor: '#f8fafc',
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        zIndex: 10,
        overflow: 'hidden',
    },
    erpScanInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#1f2937',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    modalDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 16 },
    erpTableContainer: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#fff', zIndex: 1 },
    erpTableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', height: 40, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    erpHeaderText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
    erpTableRow: { flexDirection: 'row', height: 44, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    erpColCheck: { width: 40, alignItems: 'center' },
    erpCheckbox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
    erpColId: { position: 'relative', flex: 1, paddingHorizontal: 8 },
    erpColQty: { width: 100, paddingRight: 12 },
    erpColAction: { width: 40, alignItems: 'center' },
    erpRowInput: {
        fontSize: 14,
        color: '#1f2937',
        padding: 0,
        height: '100%',
        flex: 1,
    },
    emptyTable: { padding: 20, alignItems: 'center' },
    emptyTableText: { fontSize: 13, color: '#9ca3af' },
    erpAddRowBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start', marginTop: 12 },
    erpAddRowText: { fontSize: 12, fontWeight: 'bold', color: '#374151' },
    erpModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
    erpLightBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    erpLightBtnText: { fontSize: 13, fontWeight: '500', color: '#374151' },
    erpDarkBtn: { backgroundColor: '#111827', paddingHorizontal: 16, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    erpDarkBtnText: { fontSize: 13, fontWeight: 'bold', color: '#fff' },
    itemActionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    itemActionText: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginTop: 4 },
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
    batchDropdown: {
        position: 'absolute',
        top: 42,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 0,
        maxHeight: 200,
        overflow: 'hidden',
        elevation: 100,
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    batchDropItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    batchDropId: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    batchDropSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    rowDropdown: {
        position: 'absolute',
        top: 36,
        left: 0,
        right: -100,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 100,
        zIndex: 9999,
        maxHeight: 200,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
    },
    rowDropItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    rowDropText: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
    rowDropSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    unifiedFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 12 },
    bottomActionsInner: { marginBottom: 12 },
    pillNavbarContainer: { alignItems: 'center', justifyContent: 'center' },
    linkButtonsRow: { flexDirection: 'row', gap: 24, alignItems: 'center', justifyContent: 'center' },
    linkBtn: { paddingVertical: 12, paddingHorizontal: 20 },
    linkBtnTextDim: { fontSize: 16, fontWeight: 'bold', color: '#64748b', textDecorationLine: 'underline', fontFamily: Fonts.rounded },
    linkBtnTextActive: { fontSize: 16, fontWeight: 'bold', color: '#7634bc', textDecorationLine: 'underline', fontFamily: Fonts.rounded },
    pillNavbar: { flexDirection: 'row', backgroundColor: '#1e1b4b', borderRadius: 30, padding: 6, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 10 },
    pillBackBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', opacity: 0.8 },
    pillDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
    pillNavBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, borderRadius: 22, gap: 8 },
    pillNavBtnActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
    pillNavTextActive: { fontSize: 12, fontWeight: '900', color: '#fff', fontFamily: Fonts.sans, letterSpacing: 0.5 },
    pillNavText: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', fontFamily: Fonts.sans },
});
