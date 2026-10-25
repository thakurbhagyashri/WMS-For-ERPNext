import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    Barcode,
    Calendar,
    Check,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Factory,
    FileText,
    ListChecks,
    Minus,
    Package,
    Plus,
    Scan,
    Trash2,
    X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
    Alert
} from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInRight } from 'react-native-reanimated';

import { TopNavbar } from '@/components/TopNavbar';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FloatingPill } from '@/components/FloatingPill';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatToastMessage } from '@/components/ui/Toast';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAGE_SIZE = 10;

const WOCard = ({ id, status, item_code, qty, uom, date, index, onPress }: any) => {
    const [isHeld, setIsHeld] = React.useState(false);

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



export default function NewManufactureEntryScreen() {
    const { width: windowWidth, height: SCREEN_HEIGHT } = useWindowDimensions();
    const windowHeight = SCREEN_HEIGHT;
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { getResource, callMethod, postResource, putResource } = useFrappe(APP_CONFIG);
    const { showSuccess, showError } = useToast();

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


    // Batch/Serial Slider state
    const [showBatchSlider, setShowBatchSlider] = useState(false);
    const [itemModalVisible, setItemModalVisible] = useState(false);
    const [batches, setBatches] = useState<any[]>([{ batch_no: '', serial_no: '', qty: 0, expiry_date: '' }]);
    const [batchList, setBatchList] = useState<any[]>([]);
    const [showBatchDropdownIndex, setShowBatchDropdownIndex] = useState<number | null>(null);
    const [isScanningBatch, setIsScanningBatch] = useState(false);
    const [isScanningWo, setIsScanningWo] = useState(false);
    const [scannedBatchIndex, setScannedBatchIndex] = useState<{ index: number; field: 'batch_no' | 'serial_no' } | null>(null);
    const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
    const [batchDropPage, setBatchDropPage] = useState<Record<number, number>>({});
    const [showDatePicker, setShowDatePicker] = useState(false);
    const BATCH_PAGE_SIZE = 8;
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
    const [permission, requestPermission] = useCameraPermissions();

    const [woPage, setWoPage] = useState(1);
    const [woHasMore, setWoHasMore] = useState(true);

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

                const results = await getResource('Work Order', undefined, {
                    filters: JSON.stringify(searchFilters),
                    or_filters: JSON.stringify(orFilters),
                    fields: '["name", "production_item", "qty", "planned_start_date", "status", "wip_warehouse", "source_warehouse", "company", "stock_uom"]',
                    limit_page_length: PAGE_SIZE,
                    limit_start: (woPage - 1) * PAGE_SIZE,
                    order_by: 'creation desc'
                });

                const finalResults = results || [];
                setWoResults(finalResults);
                setWoHasMore(finalResults.length === PAGE_SIZE);
            } catch (err) {
                console.log('WO Search error:', err);
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
                purpose: 'Manufacture',
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
                    // For consumption, raw materials must have s_warehouse set and t_warehouse empty.
                    // For production, finished goods must have s_warehouse empty and t_warehouse set.
                    t_warehouse: item.t_warehouse || (item.is_finished_item === 1 ? selectedWO.wip_warehouse : ''),
                    s_warehouse: item.s_warehouse || (item.is_finished_item !== 1 ? selectedWO.wip_warehouse : '')
                }));
                items.sort((a: any, b: any) => (b.is_finished_item === 1 ? 1 : 0) - (a.is_finished_item === 1 ? 1 : 0));
                setTransferItems(items);
                setStep(2);
            } else {
                throw new Error('No items returned for this Work Order and Quantity.');
            }
        } catch (err: any) {
            console.log('Fetch items error:', err);
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


    const selectedItem = activeItemIndex !== null ? transferItems[activeItemIndex] : null;
    const qty = selectedItem?.qty || 0;

    const openTrackingModal = (index: number) => {
        const item = transferItems[index];
        setActiveItemIndex(index);

        if (item.selected_batches && item.selected_batches.length > 0) {
            setBatches(item.selected_batches);
        } else {
            const isSerial = item.has_serial_no === 1 || item.has_serial_no === true;
            setBatches([{ batch_no: '', serial_no: '', qty: isSerial ? 1 : 0, expiry_date: '' }]);
        }
        setShowBatchSlider(true);
        setItemModalVisible(true);
        getBatchList(item.item_code);
    };

    const getBatchList = async (itemCode?: string) => {
        try {
            const data = await getResource("Batch", undefined, {
                filters: JSON.stringify({ item: itemCode, disabled: 0 }),
                fields: JSON.stringify(["name", "batch_id", "expiry_date"]),
                order_by: "creation desc",
                limit_page_length: 100
            });
            setBatchList(data || []);
        } catch (err) { }
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS !== 'ios') setShowDatePicker(false);
        if (event.type === 'set' && selectedDate && activeBatchIndex !== null) {
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            handleBatchChange(activeBatchIndex, 'expiry_date', `${year}-${month}-${day}`);
        }
        if (Platform.OS !== 'ios') setActiveBatchIndex(null);
    };

    const getDateForPicker = () => {
        if (activeBatchIndex !== null && batches[activeBatchIndex]?.expiry_date) {
            const parsed = new Date(batches[activeBatchIndex].expiry_date);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
    };

    const handleAddBatch = () => {
        const isSerial = selectedItem?.has_serial_no === 1 || selectedItem?.has_serial_no === true;
        setBatches([...batches, { batch_no: '', serial_no: '', qty: isSerial ? 1 : 0, expiry_date: '' }]);
    };

    const handleRemoveBatch = (index: number) => {
        const newBatches = [...batches];
        newBatches.splice(index, 1);
        setBatches(newBatches);
    };

    const handleBatchChange = (index: number, field: string, value: any) => {
        const newBatches = [...batches];
        if (field === 'qty') {
            newBatches[index][field] = parseFloat(value || '0');
        } else {
            newBatches[index][field] = value;
        }
        setBatches(newBatches);
    };

    const onBatchScanned = ({ data }: { data: string }) => {
        setIsScanningBatch(false);
        if (scannedBatchIndex !== null) {
            handleBatchChange(scannedBatchIndex.index, scannedBatchIndex.field, data);
            setScannedBatchIndex(null);
        } else {
            if (selectedItem?.has_serial_no) {
                setBatches(prev => [...prev.filter(b => b.serial_no !== ''), { batch_no: '', serial_no: data, qty: 1, expiry_date: '' }]);
            } else {
                setBatches(prev => [...prev.filter(b => b.batch_no !== ''), { batch_no: data, serial_no: '', qty: 1, expiry_date: '' }]);
            }
        }
    };

    const handleSaveBatchesInfo = () => {
        if (activeItemIndex !== null) {
            setTransferItems(prev => {
                const next = [...prev];
                next[activeItemIndex] = { ...next[activeItemIndex], selected_batches: [...batches] };
                return next;
            });
        }
        setItemModalVisible(false);
        setShowBatchSlider(false);
    };


    const handleSave = async () => {
        setIsProcessing(true);
        try {
            const finalItems = await Promise.all(transferItems.map(async (item) => {
                if ((item.has_batch_no || item.has_serial_no) && !item.serial_and_batch_bundle) {
                    if (item.selected_batches?.length > 0 || item.selected_serials?.length > 0) {
                        // Removed strict frontend validation to allow backend settings to dictate requirements

                        const isFinishedGood = item.is_finished_item === 1;
                        const bundleData = {
                            doctype: 'Serial and Batch Bundle',
                            item_code: item.item_code,
                            warehouse: isFinishedGood ? (item.t_warehouse || item.to_warehouse) : (item.s_warehouse || item.from_warehouse),
                            type_of_transaction: isFinishedGood ? 'Inward' : 'Outward',
                            is_outward: isFinishedGood ? 0 : 1,
                            voucher_type: 'Stock Entry',
                            total_qty: item.qty,
                            entries: item.selected_batches.map((b: any) => {
                                const entry: any = { qty: parseFloat(b.qty) || 0 };
                                if (b.batch_no) entry.batch_no = b.batch_no;
                                if (b.serial_no) entry.serial_no = b.serial_no;
                                return entry;
                            })
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
                stock_entry_type: 'Manufacture',
                work_order: selectedWO.name,
                company: selectedWO.company,
                // Do not force from_warehouse and to_warehouse at the header level,
                // as this overrides the row-level consumption logic.
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
            console.log('Save Error:', err);
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
                    router.push('/inventory/manufacture-mfg');
                }
            });
        } catch (err: any) {
            console.log('Submit Error:', err);
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

    const renderStepper = () => (
        <View style={styles.stepperContainer}>
            <View style={styles.stepWrapper}>
                <View style={[styles.stepCircle, step >= 1 ? styles.stepCircleActive : styles.stepCircleInactive]}>
                    {step > 1 ? <Check size={20} color="#fff" /> : <ClipboardList size={20} color={step === 1 ? "#fff" : "#94a3b8"} />}
                </View>
                <Text style={[styles.stepText, step >= 1 ? styles.stepTextActive : styles.stepTextInactive]}>{t('select_wo', 'Select WO')}</Text>
            </View>
            <View style={[styles.stepLine, step >= 2 ? styles.stepLineActive : styles.stepLineInactive]} />
            <View style={styles.stepWrapper}>
                <View style={[styles.stepCircle, step >= 2 ? styles.stepCircleActive : styles.stepCircleInactive]}>
                    <ListChecks size={20} color={step >= 2 ? "#fff" : "#94a3b8"} />
                </View>
                <Text style={[styles.stepText, step >= 2 ? styles.stepTextActive : styles.stepTextInactive]}>{t('verify_items', 'Verify Items')}</Text>
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <TopNavbar title="" showBackButton={step === 1} />
            {renderStepper()}

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
                {step === 1 ? (
                    <Animated.View entering={FadeIn}>
                        <View style={styles.section}>
                            <View style={{ paddingHorizontal: 4, marginBottom: 20 }}>
                                <GlobalSearchInput
                                    value={woSearch}
                                    onChangeText={setWoSearch}
                                    placeholder={t('search_wo', 'Search Work Order...')}
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
                                />
                            </View>

                            {woResults.length > 0 && !selectedWO && (
                                <View style={styles.resultsContainer}>
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
                                        Production Quantity
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
                                                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('start_production', 'Start Production')}</Text>
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
                        <View style={styles.header}>
                            {createdEntryName && (
                                <View style={styles.idBadge}>
                                    <Text style={styles.idBadgeLabel}>{t('stock_entry', 'STOCK ENTRY')}</Text>
                                    <Text style={styles.idBadgeValue}>{createdEntryName}</Text>
                                </View>
                            )}
                            <Text style={styles.activeWoId}>{selectedWO?.name || ''}</Text>
                            <Text style={styles.activeWoItem}>{`${selectedWO?.production_item || ''} × ${fgCompletedQty || ''}`}</Text>
                        </View>

                        <View style={styles.itemsBlock}>
                            <Text style={styles.listTitle}>{t('production_entry', 'Production Entry')}</Text>
                            <Text style={styles.listSubtitle}>Target: {selectedWO.wip_warehouse}</Text>

                            {transferItems.map((item, idx) => (
                                <Animated.View key={idx} entering={FadeInUp.delay(idx * 50)} style={[styles.itemWizardCard, item.is_finished_item === 1 && styles.finishedItemCard]}>
                                    <View style={[styles.itemWizHeader, { alignItems: 'center' }]}>
                                        <View style={{ flex: 1, paddingRight: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                                <Text style={[styles.itemWizCode, { marginTop: 0, fontSize: 12, fontWeight: '900', color: '#94a3b8' }]}>{item.item_code}</Text>
                                                {item.is_finished_item === 1 && (
                                                    <View style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
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
                                                <Barcode size={14} color="#d97706" />
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



            {/* Unified Bottom Footer Panel — hidden when any modal is open to prevent z-index bleed-through */}
            {!itemModalVisible && !isScanningBatch && (
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

                    {/* Footer Navigation */}
                    {step === 1 && (
                        <FloatingPill
                            onBackPress={() => router.back()}
                            backIcon={<ArrowLeft size={20} color="#fff" />}
                            leftLabel={t('manu', 'MANU')}
                            leftIcon={<Factory size={18} color="#94a3b8" />}
                            rightLabel={t('ste', 'STE')}
                            rightIcon={<FileText size={18} color="#fff" />}
                            style={{ bottom: Math.max(insets.bottom + 16, 24) }}
                        />
                    )}
                </Animated.View>
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
            <Modal
                visible={itemModalVisible}
                transparent={true}
                statusBarTranslucent={true}
                animationType="slide"
                onRequestClose={() => setItemModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={[styles.modalContent, { maxHeight: windowHeight * 0.88 }]}
                    >
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderInfo}>
                                <View style={styles.modalIconBg}>
                                    <ClipboardList size={20} color="#0f172a" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTitle}>
                                        {selectedItem?.has_serial_no ? 'Serial Details' : t('batch_details', 'Batch Details')}
                                    </Text>
                                    <Text style={styles.modalSubtitle} numberOfLines={1} ellipsizeMode="tail">
                                        {selectedItem?.item_name}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setItemModalVisible(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.totalQtyBar}>
                            <Text style={styles.totalQtyLabel}>{t('total_quantity', 'Total Quantity')}</Text>
                            <Text style={styles.totalQtyValue}>
                                {batches.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0)} {selectedItem?.uom}
                            </Text>
                        </View>

                        <ScrollView
                            style={styles.batchScroll}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {batches.map((batch, index) => {
                                const showSerialInput = !!selectedItem?.has_serial_no;
                                const showBatchInput = !!selectedItem?.has_batch_no;
                                const showQtyInput = !!selectedItem?.has_batch_no && !selectedItem?.has_serial_no;
                                const showExpiryInput = !!selectedItem?.has_batch_no;

                                return (
                                    <View key={index} style={styles.batchCard}>
                                        <View style={styles.batchCardHeader}>
                                            <Text style={styles.batchNum}>
                                                {selectedItem?.has_serial_no ? `Serial ${index + 1}` : `Batch ${index + 1}`}
                                            </Text>
                                            {batches.length > 1 && (
                                                <TouchableOpacity onPress={() => handleRemoveBatch(index)} style={{ padding: 12, marginRight: -8, marginTop: -8 }}>
                                                    <Trash2 size={20} color="#ef4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Serial Number Field */}
                                        {showSerialInput && (
                                            <View style={styles.batchField}>
                                                <Text style={styles.fieldLabel}>{t('serial_number', 'Serial Number')} <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                                <View style={styles.fieldInputGroup}>
                                                    <TextInput
                                                        placeholder="Scan or enter serial number"
                                                        placeholderTextColor="#94a3b8"
                                                        style={styles.fieldInput}
                                                        value={batch.serial_no}
                                                        onChangeText={(v) => handleBatchChange(index, 'serial_no', v)}
                                                    />
                                                    <TouchableOpacity
                                                        style={styles.fieldScanBtn}
                                                        onPress={() => {
                                                            setScannedBatchIndex({ index, field: 'serial_no' });
                                                            setIsScanningBatch(true);
                                                        }}
                                                    >
                                                        <Scan size={16} color="#64748b" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}

                                        {/* Batch Number Field */}
                                        {showBatchInput && (
                                            <View style={[styles.batchField, { zIndex: showBatchDropdownIndex === index ? 1000 : 1 }]}>
                                                <Text style={styles.fieldLabel}>{t('batch_number', 'Batch Number')} <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                                <View style={styles.fieldInputGroup}>
                                                    <TextInput
                                                        placeholder="Scan, enter or select batch"
                                                        placeholderTextColor="#94a3b8"
                                                        style={styles.fieldInput}
                                                        value={batch.batch_no}
                                                        onChangeText={(v) => {
                                                            handleBatchChange(index, 'batch_no', v);
                                                            setShowBatchDropdownIndex(index);
                                                        }}
                                                        onFocus={() => setShowBatchDropdownIndex(index)}
                                                    />
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <TouchableOpacity
                                                            style={styles.fieldScanBtn}
                                                            onPress={() => {
                                                                setScannedBatchIndex({ index, field: 'batch_no' });
                                                                setIsScanningBatch(true);
                                                            }}
                                                        >
                                                            <Scan size={16} color="#64748b" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={() => setShowBatchDropdownIndex(showBatchDropdownIndex === index ? null : index)}
                                                            style={{ marginLeft: 4, padding: 4 }}
                                                        >
                                                            <ChevronDown size={20} color="#64748b" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                {showBatchDropdownIndex === index && (
                                                    <View style={styles.warehouseDropdown}>
                                                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                            {(() => {
                                                                const options = batchList.filter(b => !batch.batch_no || b.name.toLowerCase().includes(batch.batch_no.toLowerCase()));
                                                                const page = batchDropPage[index] || 0;
                                                                const pageOptions = options.slice(page * BATCH_PAGE_SIZE, (page + 1) * BATCH_PAGE_SIZE);
                                                                const totalPages = Math.ceil(options.length / BATCH_PAGE_SIZE);
                                                                return (
                                                                    <>
                                                                        {pageOptions.map((b, bIdx) => (
                                                                            <TouchableOpacity
                                                                                key={bIdx}
                                                                                style={styles.warehouseItem}
                                                                                onPress={() => {
                                                                                    handleBatchChange(index, 'batch_no', b.name);
                                                                                    if (b.expiry_date) {
                                                                                        handleBatchChange(index, 'expiry_date', b.expiry_date);
                                                                                    }
                                                                                    setShowBatchDropdownIndex(null);
                                                                                }}
                                                                            >
                                                                                <View style={{ marginRight: 8 }}>
                                                                                    <View style={styles.warehouseIconFrame}>
                                                                                        <Package size={14} color="#64748b" />
                                                                                    </View>
                                                                                </View>
                                                                                <View style={{ flex: 1 }}>
                                                                                    <Text style={styles.warehouseName}>{b.name}</Text>
                                                                                    {b.expiry_date && (
                                                                                        <Text style={styles.warehouseCompany}>Expires: {b.expiry_date}</Text>
                                                                                    )}
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        ))}

                                                                        {batch.batch_no && !batchList.find(b => b.name.toLowerCase() === batch.batch_no.toLowerCase()) && (
                                                                            <TouchableOpacity
                                                                                style={[styles.warehouseItem, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}
                                                                                onPress={() => setShowBatchDropdownIndex(null)}
                                                                            >
                                                                                <View style={{ marginRight: 8 }}>
                                                                                    <View style={[styles.warehouseIconFrame, { backgroundColor: '#f3e8ff' }]}>
                                                                                        <Plus size={14} color="#9333ea" />
                                                                                    </View>
                                                                                </View>
                                                                                <View style={{ flex: 1 }}>
                                                                                    <Text style={[styles.warehouseName, { color: '#9333ea' }]}>Create new batch &quot;{batch.batch_no}&quot;</Text>
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        )}

                                                                        {options.length === 0 && !batch.batch_no && (
                                                                            <View style={styles.emptyWarehouse}>
                                                                                <Text style={styles.emptyWarehouseText}>No existing batches found.</Text>
                                                                            </View>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </ScrollView>
                                                        {(() => {
                                                            const options = batchList.filter(b => !batch.batch_no || b.name.toLowerCase().includes(batch.batch_no.toLowerCase()));
                                                            const page = batchDropPage[index] || 0;
                                                            const totalPages = Math.ceil(options.length / BATCH_PAGE_SIZE);
                                                            if (totalPages <= 1) return null;
                                                            return (
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                                                                    <TouchableOpacity onPress={() => setBatchDropPage(prev => ({ ...prev, [index]: Math.max(0, page - 1) }))} disabled={page === 0}>
                                                                        <Text style={{ color: page === 0 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Previous</Text>
                                                                    </TouchableOpacity>
                                                                    <Text style={{ fontSize: 12, color: '#64748b' }}>Page {page + 1} of {totalPages}</Text>
                                                                    <TouchableOpacity onPress={() => setBatchDropPage(prev => ({ ...prev, [index]: Math.min(totalPages - 1, page + 1) }))} disabled={page >= totalPages - 1}>
                                                                        <Text style={{ color: page >= totalPages - 1 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Next</Text>
                                                                    </TouchableOpacity>
                                                                </View>
                                                            );
                                                        })()}
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        {/* Expiry Date and/or Quantity Row */}
                                        {(showQtyInput || showExpiryInput) && (
                                            <View style={styles.batchRow}>
                                                {showQtyInput && (
                                                    <View style={[styles.batchField, { flex: 1 }]}>
                                                        <Text style={styles.fieldLabel}>{t('quantity', 'Quantity')} <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                                        <TextInput
                                                            placeholder="Enter qty"
                                                            placeholderTextColor="#94a3b8"
                                                            keyboardType="numeric"
                                                            style={styles.fieldInput}
                                                            value={batch.qty === 0 ? '' : batch.qty.toString()}
                                                            onChangeText={(v) => handleBatchChange(index, 'qty', v)}
                                                        />
                                                    </View>
                                                )}

                                                {showExpiryInput && (
                                                    <View style={[styles.batchField, { flex: 1 }]}>
                                                        <Text style={styles.fieldLabel}>{t('expiry_date', 'Expiry Date')}</Text>
                                                        <TouchableOpacity
                                                            style={styles.fieldInputGroup}
                                                            onPress={() => {
                                                                setActiveBatchIndex(index);
                                                                setShowDatePicker(true);
                                                            }}
                                                        >
                                                            <TextInput
                                                                placeholder="dd/mm/yyyy"
                                                                placeholderTextColor="#94a3b8"
                                                                style={[styles.fieldInput, { color: '#0f172a' }]}
                                                                value={batch.expiry_date}
                                                                editable={false}
                                                                pointerEvents="none"
                                                            />
                                                            <Calendar size={16} color="#64748b" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}

                            <TouchableOpacity
                                style={[
                                    styles.addBatchBtnRow,
                                    !!(selectedItem?.has_serial_no && batches.length >= qty) && { opacity: 0.4 }
                                ]}
                                onPress={handleAddBatch}
                                disabled={!!(selectedItem?.has_serial_no && batches.length >= qty)}
                            >
                                <Plus size={18} color="#0f172a" />
                                <Text style={styles.addBatchBtnText}>
                                    {selectedItem?.has_serial_no
                                        ? batches.length >= qty
                                            ? `Max ${qty} serials reached`
                                            : `+ Add Serial No (${batches.length}/${qty})`
                                        : t('add_batch', '+ Add Batch')}
                                </Text>
                            </TouchableOpacity>

                            <View style={{ height: 40 }} />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancel}
                                onPress={() => setItemModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>{t('cancel', 'Cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalSave,
                                    (() => {
                                        const isModalValid = batches.every(b => {
                                            const batchValid = !selectedItem?.has_batch_no || b.batch_no.trim() !== '';
                                            const serialValid = !selectedItem?.has_serial_no || (b.serial_no && b.serial_no.trim() !== '');
                                            const qtyValid = b.qty > 0;
                                            return batchValid && serialValid && qtyValid;
                                        });
                                        return { backgroundColor: isModalValid ? '#0f172a' : '#cbd5e1' };
                                    })()
                                ]}
                                onPress={handleSaveBatchesInfo}
                                disabled={!batches.every(b => {
                                    const batchValid = !selectedItem?.has_batch_no || b.batch_no.trim() !== '';
                                    const serialValid = !selectedItem?.has_serial_no || (b.serial_no && b.serial_no.trim() !== '');
                                    const qtyValid = b.qty > 0;
                                    return batchValid && serialValid && qtyValid;
                                })}
                            >
                                <Text style={styles.modalSaveText}>
                                    Save ({batches.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0)} {selectedItem?.uom})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>


            {showDatePicker && (
                <DateTimePicker
                    value={getDateForPicker()}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
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
                            style={styles.closeScannerBtn} 
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
                    transparent={false}
                    statusBarTranslucent={true}
                    onRequestClose={() => setIsScanningBatch(false)}
                >
                    <View style={styles.scannerWrapper}>
                        {permission?.granted ? (
                            <CameraView
                                style={StyleSheet.absoluteFill}
                                facing="back"
                                onBarcodeScanned={onBatchScanned}
                                barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "pdf417", "aztec", "datamatrix", "code39", "code93", "code128", "upc_a", "upc_e"] }}
                            />
                        ) : (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: '#fff', marginBottom: 20 }}>Camera permission is required.</Text>
                                <TouchableOpacity onPress={requestPermission} style={{ padding: 12, backgroundColor: '#3b82f6', borderRadius: 8 }}>
                                    <Text style={{ color: '#fff' }}>Grant Permission</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={styles.itemScannerOverlay}>
                            <View style={styles.scannerFrame} />
                            <Text style={styles.scannerText}>{t('scan_batch_serial', 'Scan Batch/Serial Barcode')}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setIsScanningBatch(false)}>
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </Modal>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
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
    resultsContainer: { marginTop: 12 },
    resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    resultInfo: { flex: 1 },
    resultName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
    resultMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },

    // WOCard Styles
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
    selectionDetails: { paddingHorizontal: 16 },
    woInfoCard: { backgroundColor: '#fff', padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 12 },
    woInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    woInfoId: { fontSize: 18, fontWeight: '900', color: '#0f172a', fontFamily: Fonts.rounded },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    infoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
    infoPillText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    qtySection: { marginBottom: 16 },
    qtyInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        height: 48,
        paddingLeft: 12,
        paddingRight: 4,
        gap: 12,
        borderWidth: 1.5,
        borderColor: '#7634bc',
        overflow: 'hidden',
    },
    qtyInput: {
        flex: 1,
        height: '100%',
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
    itemWizardCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    finishedItemCard: {
        borderColor: '#818cf8',
        backgroundColor: '#eef2ff',
        borderWidth: 1.5,
    },
    itemWizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
    itemWizName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    itemWizCode: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
    itemWizDivider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: -16, marginBottom: 12 },
    trackingPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', gap: 6 },
    trackingPillDisabled: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
    trackingPillText: { fontSize: 12, fontWeight: 'bold', color: '#d97706' },
    itemWizActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    wizTotalQtyLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    qtyControlsContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    qtyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 4, flex: 1 },
    qtyBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    qtyDisplay: { flex: 1, minWidth: 48, paddingHorizontal: 4, height: 36, justifyContent: 'center', alignItems: 'center' },
    qtyValueInput: { width: '100%', height: '100%', textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#0f172a', fontFamily: Fonts.rounded, paddingVertical: 0, ...Platform.select({ web: { outlineStyle: 'none' } as any }) },
    wizTotalQty: { fontSize: 14, color: '#94a3b8', fontWeight: '500', flexShrink: 1, textAlign: 'right' },
    modalSection: { marginBottom: 16 },
    modalSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
    modalGrid: { flexDirection: 'row', gap: 16 },
    modalGridCol: { flex: 1 },
    modalSubLabel: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 'bold' },
    erpInput: {
        backgroundColor: '#f8fafc',
        height: 44,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#0f172a',
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
        height: 44,
        borderRadius: 10,
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
        height: 44,
        borderRadius: 10,
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
    unifiedFooter: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16 },
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

    // Stepper UI
    stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 0, backgroundColor: '#fff' },
    stepWrapper: { alignItems: 'center', gap: 6, zIndex: 2 },
    stepCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
    stepCircleActive: { backgroundColor: '#7634bc' },
    stepCircleInactive: { backgroundColor: '#f1f5f9', shadowOpacity: 0, elevation: 0 },
    stepText: { fontSize: 12, fontFamily: Fonts.rounded, fontWeight: 'bold' },
    stepTextActive: { color: '#7634bc' },
    stepTextInactive: { color: '#94a3b8' },
    stepLine: { flex: 1, height: 3, borderRadius: 1.5, marginHorizontal: -12, marginTop: -18, zIndex: 1 },
    stepLineActive: { backgroundColor: '#7634bc' },
    stepLineInactive: { backgroundColor: '#f1f5f9' },
    warehouseDropdown: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 4,
        maxHeight: 250,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: { elevation: 4 },
        }),
    },
    warehouseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 12,
    },
    warehouseIconFrame: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    warehouseName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    warehouseCompany: {
        fontSize: 11,
        color: '#94a3b8',
    },
    emptyWarehouse: {
        padding: 20,
        alignItems: 'center',
    },
    emptyWarehouseText: {
        color: '#94a3b8',
        fontSize: 13,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
        paddingHorizontal: 0,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        width: '100%',
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalHeaderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    modalIconBg: {
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
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalQtyBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
    },
    totalQtyLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: 'bold',
    },
    totalQtyValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    batchScroll: {
        flexShrink: 1,
        flexGrow: 0,
    },
    batchCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 8,
            },
            android: { elevation: 2 },
        }),
    },
    batchCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    batchNum: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#94a3b8',
        textTransform: 'uppercase',
    },
    batchField: {
        marginBottom: 12,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 6,
    },
    fieldInputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    fieldInput: {
        flex: 1,
        height: 44,
        fontSize: 14,
        color: '#0f172a',
    },
    fieldScanBtn: {
        padding: 8,
    },
    batchRow: {
        flexDirection: 'row',
        gap: 12,
    },
    addBatchBtnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        gap: 10,
    },
    addBatchBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    modalCancel: {
        flex: 1,
        height: 54,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#64748b',
    },
    modalSave: {
        flex: 2,
        height: 54,
        borderRadius: 14,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSaveText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#fff',
    },
    scannerWrapper: {
        flex: 1,
        backgroundColor: '#000',
    },
    itemScannerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerFrame: {
        width: '70%',
        aspectRatio: 1,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 24,
    },
    scannerText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 40,
        textAlign: 'center',
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    closeScannerBtn: {
        position: 'absolute',
        top: 60,
        right: 30,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
