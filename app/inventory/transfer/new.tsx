import { AppTextInput as TextInput } from '@/components/ui/AppTextInput';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowDown,
    ArrowLeft,
    Barcode,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Factory,
    FileText,
    Minus,
    Package,
    Plus,
    Scan,
    ScanLine,
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
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInRight } from 'react-native-reanimated';

import { FloatingPill } from '@/components/FloatingPill';
import { TopNavbar } from '@/components/TopNavbar';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { formatToastMessage } from '@/components/ui/Toast';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function NewStockEntryScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { wo } = useLocalSearchParams();
    const { getResource, callMethod, postResource, putResource } = useFrappe(APP_CONFIG);
    const { showSuccess, showError } = useToast();
    const insets = useSafeAreaInsets();

    const [step, setStep] = useState(1);

    const [woSearch, setWoSearch] = useState('');
    const [woResults, setWoResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
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
    const [isScanning, setIsScanning] = useState(false);

    // Handle incoming 'wo' parameter from Button 2 ("From Work Order")
    useEffect(() => {
        if (wo) {
            loadInitialWorkOrder(wo as string);
        }
    }, [wo]);

    async function loadInitialWorkOrder(woName: string) {
        setIsFetchingItems(true);
        try {
            const result = await getResource('Work Order', woName);
            if (result) {
                setSelectedWO(result);
                setFgCompletedQty(result.qty?.toString() || '0');

                // Auto-fetch items immediately
                const stockEntryDraft = await callMethod('erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry', {
                    work_order_id: result.name,
                    purpose: 'Material Transfer for Manufacture',
                    qty: result.qty
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

                    const items = stockEntryDraft.items.map((item: any) => ({
                        ...item,
                        original_qty: item.qty,
                        has_batch_no: metaMap[item.item_code]?.has_batch_no || 0,
                        has_serial_no: metaMap[item.item_code]?.has_serial_no || 0,
                        selected_batches: [],
                        selected_serials: [],
                        t_warehouse: result.wip_warehouse
                    }));
                    setTransferItems(items);
                    setStep(2); // Skip straight to Review UI
                }
            }
        } catch (err) {
            console.error('Failed to auto-load Work Order:', err);
            showError('Failed to load Work Order details');
        } finally {
            setIsFetchingItems(false);
        }
    };

    useEffect(() => {
        if (woSearch.length < 2) {
            setWoResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await getResource('Work Order', undefined, {
                    filters: JSON.stringify([
                        ['status', 'not in', ['Completed', 'Stopped', 'Closed']],
                        ['name', 'like', `%${woSearch}%`],
                        ['docstatus', '=', 1]
                    ]),
                    fields: '["name", "production_item", "qty", "planned_start_date", "status", "wip_warehouse", "source_warehouse", "company", "stock_uom", "material_transferred_for_manufacturing"]',
                    limit_page_length: 50
                });

                // Only show Work Orders that have NOT been fully transferred yet
                const pendingWOs = (results || []).filter((wo: any) => {
                    const transferred = wo.material_transferred_for_manufacturing || 0;
                    return transferred < wo.qty;
                });

                setWoResults(pendingWOs);
            } catch (err) {
                console.warn('WO Search error:', err);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [woSearch]);

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
                purpose: 'Material Transfer for Manufacture',
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
                    t_warehouse: selectedWO.wip_warehouse // Ensure target warehouse is set
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

        const item = transferItems[activeItemIndex];
        const targetQty = parseFloat(autoFetchQty) || item.qty;

        const currentTotal = (item.selected_batches || []).reduce((sum: number, b: any, i: number) => {
            if (index !== undefined && i === index) return sum;
            return sum + (parseFloat(b.qty) || 0);
        }, 0);

        const remainingNeeded = Math.max(0, targetQty - currentTotal);

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

    const onBarcodeScanned = ({ data }: { data: string }) => {
        setIsScanning(false);
        console.log("Scanned:", data);
        setStatusModal({
            visible: true,
            type: 'success',
            title: 'Scanned',
            message: `Scanned: ${data} (Logic to be implemented)`
        });
    };

    const handleSave = async () => {
        setIsProcessing(true);
        try {
            const finalItems = await Promise.all(transferItems.map(async (item) => {
                if ((item.has_batch_no || item.has_serial_no) && !item.serial_and_batch_bundle) {
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
                    return item;
                }
                return item;
            }));

            const stockEntryDoc = {
                doctype: 'Stock Entry',
                stock_entry_type: 'Material Transfer for Manufacture',
                work_order: selectedWO.name,
                company: selectedWO.company,
                from_warehouse: selectedWO.source_warehouse,
                to_warehouse: selectedWO.wip_warehouse,
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
                    router.push('/inventory/transfer-mfg');
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <TopNavbar title="" showBackButton={step === 1} />

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 280 }}>
                {step === 1 ? (
                    <Animated.View entering={FadeIn}>
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>{t('select_work_order', 'Select Work Order')}</Text>
                            <GlobalSearchInput
                                placeholder="Search WO-XXXX..."
                                value={selectedWO ? selectedWO.name : woSearch}
                                onChangeText={(txt) => {
                                    setWoSearch(txt);
                                    if (selectedWO) setSelectedWO(null);
                                }}
                                isSearching={isSearching}
                                containerStyle={{ marginBottom: 12 }}
                            />

                            {woResults.length > 0 && !selectedWO && (
                                <Animated.View entering={FadeInUp} style={styles.resultsContainer}>
                                    {woResults.map((wo, idx) => (
                                        <TouchableOpacity
                                            key={idx} style={styles.resultItem}
                                            onPress={() => {
                                                setSelectedWO(wo);
                                                setWoSearch('');
                                                setWoResults([]);
                                                setFgCompletedQty(wo.qty.toString());
                                            }}
                                        >
                                            <View style={styles.resultInfo}>
                                                <Text style={styles.resultName}>{wo.name}</Text>
                                                <Text style={styles.resultMeta}>{wo.production_item}</Text>
                                            </View>
                                            <ChevronRight size={18} color="#cbd5e1" />
                                        </TouchableOpacity>
                                    ))}
                                </Animated.View>
                            )}
                        </View>

                        {selectedWO && (
                            <Animated.View entering={FadeInUp} style={styles.selectionDetails}>
                                <View style={styles.woInfoCard}>
                                    <View style={styles.woInfoHeader}>
                                        <ClipboardList size={20} color="#0f172a" />
                                        <Text style={styles.woInfoId}>{selectedWO.name}</Text>
                                    </View>
                                    <View style={styles.pillsRow}>
                                        <View style={styles.infoPillLight}>
                                            <Package size={14} color="#64748b" />
                                            <Text style={styles.infoPillText}>{selectedWO.production_item}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.qtySection}>
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
                                </View>
                            </Animated.View>
                        )}
                    </Animated.View>
                ) : (
                    <Animated.View entering={SlideInRight}>
                        <View style={styles.header}>
                            {createdEntryName && (
                                <View style={styles.idBadge}>
                                    <Text style={styles.idBadgeLabel}>{t('stock_entry', 'STOCK ENTRY')}</Text>
                                    <Text style={styles.idBadgeValue}>{createdEntryName}</Text>
                                </View>
                            )}
                            <Text style={styles.activeWoId}>{selectedWO.name}</Text>
                            <Text style={styles.activeWoItem}>{selectedWO.production_item} × {fgCompletedQty}</Text>
                        </View>

                        <View style={styles.itemsBlock}>
                            <Text style={styles.listTitle}>{t('issue_raw_materials', 'Issue Raw Materials')}</Text>
                            <Text style={styles.listSubtitle}>Target: {selectedWO.wip_warehouse}</Text>

                            {transferItems.map((item, idx) => (
                                <Animated.View key={idx} entering={FadeInUp.delay(idx * 50)} style={styles.itemWizardCard}>
                                    <View style={styles.itemWizMain}>
                                        <View style={styles.itemWizHeader}>
                                            <Text style={styles.itemWizCode}>{item.item_code}</Text>
                                            <Text style={styles.itemWizName} numberOfLines={1}>{item.item_name}</Text>
                                        </View>

                                        {(item.has_batch_no || item.has_serial_no) && (
                                            <TouchableOpacity
                                                style={styles.trackingPill}
                                                onPress={() => openTrackingModal(idx)}
                                            >
                                                <Barcode size={14} color="#d97706" />
                                                <Text style={styles.trackingPillText}>
                                                    {(item.selected_batches?.length || 0) > 0 ? `${item.selected_batches.length} Batches` : 'Select Batch / Serial'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={styles.itemWizActions}>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity style={styles.stepBtn} onPress={() => {
                                                setTransferItems(prev => {
                                                    const next = [...prev];
                                                    const current = parseFloat(next[idx].qty.toString()) || 0;
                                                    if (current > 0) next[idx].qty = current - 1;
                                                    return next;
                                                });
                                            }}>
                                                <Minus size={18} color="#0f172a" />
                                            </TouchableOpacity>
                                            <TextInput
                                                style={styles.stepperInput}
                                                value={item.qty?.toString()}
                                                onChangeText={(v) => {
                                                    setTransferItems(prev => {
                                                        const next = [...prev];
                                                        next[idx].qty = v as any;
                                                        return next;
                                                    });
                                                }}
                                                keyboardType="numeric"
                                            />
                                            <TouchableOpacity style={styles.stepBtn} onPress={() => {
                                                setTransferItems(prev => {
                                                    const next = [...prev];
                                                    const current = parseFloat(next[idx].qty.toString()) || 0;
                                                    next[idx].qty = current + 1;
                                                    return next;
                                                });
                                            }}>
                                                <Plus size={18} color="#0f172a" />
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.wizTotalQty}>/ {item.original_qty} {item.uom}</Text>
                                    </View>
                                </Animated.View>
                            ))}
                        </View>

                        {/* Floating FAB for Scanner */}
                        <View style={{ alignItems: 'center', marginTop: 20 }}>
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#0f172a',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 24,
                                    paddingVertical: 14,
                                    borderRadius: 30,
                                    gap: 10,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 10,
                                    elevation: 5,
                                }}
                                onPress={() => setIsScanning(true)}
                            >
                                <ScanLine size={20} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: Fonts.rounded }}>{t('scan_item', 'Scan Item')}</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}
            </ScrollView>

            <Modal visible={trackingModalVisible} animationType="slide" transparent={true} statusBarTranslucent onRequestClose={() => setTrackingModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    {activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no ? (
                                        <Package size={20} color="#0f172a" />
                                    ) : (
                                        <Barcode size={20} color="#0f172a" />
                                    )}
                                    <Text style={styles.modalTitle}>
                                        {activeItemIndex !== null && transferItems[activeItemIndex].has_batch_no ? 'Add Batch Nos' : 'Add Serial Nos'}
                                    </Text>
                                </View>
                                <Text style={styles.modalSubtitle} numberOfLines={1} ellipsizeMode="tail">
                                    {activeItemIndex !== null && transferItems[activeItemIndex].item_name}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setTrackingModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
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
                                            <Scan size={16} color="#94a3b8" />
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
                </View>
            </Modal>

            {/* Footer Buttons */}
            {step === 1 ? (
                <View style={{ width: '100%', alignItems: 'center', marginTop: 12, marginBottom: 100 }}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleGetItems}
                        disabled={!selectedWO || isFetchingItems}
                        style={{ paddingVertical: 12, paddingHorizontal: 24 }}
                    >
                        <Text style={{ color: !selectedWO ? '#cbd5e1' : '#10b981', fontSize: 16, fontWeight: '800', fontFamily: Fonts.rounded, textDecorationLine: 'underline' }}>
                            {isFetchingItems ? 'Fetching Items...' : 'Continue to Verify →'}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* Unified Bottom Footer Panel */}
            {step === 2 && (
                <Animated.View entering={FadeIn} style={[styles.unifiedFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={[styles.bottomActionsInner, { paddingHorizontal: 16 }]}>
                        <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                            <TouchableOpacity
                                style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}
                                onPress={() => setStep(1)}
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
                                            {createdEntryName ? 'Submit Entry' : 'Save as Draft'}
                                        </Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            )}

            {step === 1 && (
                <FloatingPill
                    onBackPress={() => router.back()}
                    backIcon={<ArrowLeft size={20} color="#fff" />}
                    leftLabel={t('mfg_transfer', 'MFG TRANSFER')}
                    leftIcon={<Factory size={18} color="#94a3b8" />}
                    rightLabel={t('ste', 'STE')}
                    rightIcon={<FileText size={18} color="#fff" />}
                    style={{ bottom: Math.max(insets.bottom + 16, 24) }}
                />
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
    );
}

const styles = StyleSheet.create({
    unifiedFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 10,
    },
    bottomActionsInner: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    container: { flex: 1, backgroundColor: '#fff' },
    content: { flex: 1 },
    header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
    idBadge: { backgroundColor: '#f1f5f9', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    idBadgeLabel: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
    idBadgeValue: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },
    section: { paddingHorizontal: 16, marginBottom: 16 },
    sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12, fontFamily: Fonts.sans, marginTop: 12 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingLeft: 12,
        paddingRight: 4,
        height: 52,
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
    resultsContainer: { backgroundColor: '#fff', borderRadius: 20, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 250, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
    resultItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    resultInfo: { flex: 1 },
    resultName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', fontFamily: Fonts.rounded },
    resultMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
    selectionDetails: { paddingHorizontal: 16 },
    woInfoCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 16 },
    woInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    woInfoId: { fontSize: 18, fontWeight: '900', color: '#0f172a', fontFamily: Fonts.rounded },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    infoPillLight: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
    infoPillText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    qtySection: { marginBottom: 16 },
    qtyInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingLeft: 12,
        paddingRight: 4,
        height: 48,
        borderWidth: 1.5,
        borderColor: '#7634bc',
        overflow: 'hidden',
    },
    qtyInput: {
        flex: 1,
        height: '100%',
        width: '100%',
        paddingVertical: 0,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    qtyUnitBadge: { backgroundColor: '#7634bc', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    qtyUnitText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    qtyHint: { fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'right', fontWeight: '600' },
    activeWoId: { fontSize: 18, fontWeight: '900', color: '#0f172a', fontFamily: Fonts.rounded },
    activeWoItem: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: '500' },
    itemsBlock: { paddingHorizontal: 16, marginTop: 12 },
    listTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', fontFamily: Fonts.rounded, marginBottom: 4 },
    listSubtitle: { fontSize: 12, color: '#94a3b8', marginBottom: 12, fontWeight: '600' },
    itemWizardCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: '#f1f5f9', elevation: 2 },
    itemWizMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    itemWizHeader: { flex: 1, marginRight: 12 },
    itemWizCode: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
    itemWizName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', fontFamily: Fonts.rounded, marginTop: 2 },
    trackingPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', gap: 6 },
    trackingPillDisabled: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
    trackingPillText: { fontSize: 12, fontWeight: 'bold', color: '#d97706' },
    itemWizActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        height: 44,
        width: 120,
        overflow: 'hidden',
    },
    stepBtn: { width: 36, height: '100%', borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 1 },
    stepperInput: {
        flex: 1,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
        height: '100%',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    wizTotalQty: { fontSize: 14, color: '#94a3b8', fontWeight: 'bold' },
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
    wizardFooter: { position: 'absolute', bottom: 110, left: 16, right: 16, flexDirection: 'row', gap: 24, alignItems: 'center', justifyContent: 'center', zIndex: 9999, elevation: 9999 },
    linkBtn: { paddingVertical: 12, paddingHorizontal: 20 },
    linkBtnTextDim: { fontSize: 16, fontWeight: 'bold', color: '#64748b', textDecorationLine: 'underline', fontFamily: Fonts.rounded },
    linkBtnTextActive: { fontSize: 16, fontWeight: 'bold', color: '#7634bc', textDecorationLine: 'underline', fontFamily: Fonts.rounded },
    floatingContainer: { position: 'absolute', bottom: 40, alignSelf: 'center', flexDirection: 'row', backgroundColor: '#1e1b4b', borderRadius: 28, height: 56, padding: 6, alignItems: 'center', elevation: 12 },
    backPill: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    dividerPill: { width: 1.5, height: 24, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
    infoPill: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
    activePillItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 24, paddingLeft: 12, backgroundColor: 'rgba(255,255,255,0.1)', height: 44, borderRadius: 22 },
    pillText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
