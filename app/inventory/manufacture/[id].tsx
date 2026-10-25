import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { TopNavbar } from '@/components/TopNavbar';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { FloatingPill } from '@/components/FloatingPill';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Barcode,
    Check,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Calendar,
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
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



export default function StockEntryDetailsScreen() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { getResource, callMethod, postResource, putResource, loading: frappeLoading } = useFrappe(APP_CONFIG);
    const { showSuccess, showError } = useToast();

    const [stockEntry, setStockEntry] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Step state
    const [step, setStep] = useState(2);

    // Step 1 State
    const [woSearch, setWoSearch] = useState('');
    const [woResults, setWoResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedWO, setSelectedWO] = useState<any>(null);
    const [fgCompletedQty, setFgCompletedQty] = useState('');

    const [transferItems, setTransferItems] = useState<any[]>([]);
    const [isFetchingItems, setIsFetchingItems] = useState(false);

    const [isDirty, setIsDirty] = useState(false);

    // Batch/Serial Slider state
    const [showBatchSlider, setShowBatchSlider] = useState(false);
    const [itemModalVisible, setItemModalVisible] = useState(false);
    const [batches, setBatches] = useState<any[]>([{ batch_no: '', serial_no: '', qty: 0, expiry_date: '' }]);
    const [batchList, setBatchList] = useState<any[]>([]);
    const [showBatchDropdownIndex, setShowBatchDropdownIndex] = useState<number | null>(null);
    const [isScanningBatch, setIsScanningBatch] = useState(false);
    const [scannedBatchIndex, setScannedBatchIndex] = useState<{ index: number; field: 'batch_no' | 'serial_no' } | null>(null);
    const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
    const [batchDropPage, setBatchDropPage] = useState<Record<number, number>>({});
    const [showDatePicker, setShowDatePicker] = useState(false);
    const BATCH_PAGE_SIZE = 8;
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
    const [permission, requestPermission] = useCameraPermissions();

    useEffect(() => {
        if (id) fetchStockEntry();
    }, [id]);

    async function fetchStockEntry() {
        try {
            setLoading(true);
            const data = await getResource('Stock Entry', id as string);
            if (data) {
                setStockEntry(data);
                setFgCompletedQty(data.fg_completed_qty?.toString() || '');
                if (data.work_order) {
                    try {
                        const wo = await getResource('Work Order', data.work_order);
                        setSelectedWO(wo);
                    } catch (e) { }
                }
                const items = await Promise.all((data.items || []).map(async (item: any) => {
                    let selected_batches = [];
                    if (item.serial_and_batch_bundle) {
                        try {
                            const bundle = await getResource('Serial and Batch Bundle', item.serial_and_batch_bundle);
                            if (bundle && bundle.entries) {
                                selected_batches = bundle.entries.map((e: any) => ({
                                    batch_no: e.batch_no || e.serial_no,
                                    qty: e.qty || 1
                                }));
                            }
                        } catch (e) { }
                    }
                    let has_batch_no = item.has_batch_no || 0;
                    let has_serial_no = item.has_serial_no || 0;
                    if (!has_batch_no && !has_serial_no) {
                        try {
                            const itemMeta = await getResource('Item', item.item_code);
                            has_batch_no = itemMeta.has_batch_no;
                            has_serial_no = itemMeta.has_serial_no;
                        } catch (e) { }
                    }
                    return { ...item, original_qty: item.qty, has_batch_no, has_serial_no, selected_batches };
                }));
                items.sort((a, b) => (b.is_finished_item === 1 ? 1 : 0) - (a.is_finished_item === 1 ? 1 : 0));
                setTransferItems(items);
                setIsDirty(false);
            }
        } catch (err) {
            showError('Failed to load entry');
        } finally { setLoading(false); }
    };

    // WO Search
    useEffect(() => {
        if (woSearch.length < 2) { setWoResults([]); return; }
        setIsDirty(true);
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await getResource('Work Order', undefined, {
                    filters: JSON.stringify([['status', 'not in', ['Completed', 'Stopped', 'Closed']], ['name', 'like', `%${woSearch}%`], ['docstatus', '=', 1], ['track_semi_finished_goods', '=', 0]]),
                    fields: '["name", "production_item", "qty", "stock_uom", "source_warehouse", "wip_warehouse", "company", "track_semi_finished_goods", "produced_qty", "skip_transfer", "material_transferred_for_manufacturing"]'
                });
                const readyWorkOrders = (results || []).filter((wo: any) => {
                    if (wo.produced_qty >= wo.qty) return false;
                    if (wo.skip_transfer === 1) return true;
                    return wo.material_transferred_for_manufacturing > 0 && wo.produced_qty < wo.material_transferred_for_manufacturing;
                });
                setWoResults(readyWorkOrders);
            } finally { setIsSearching(false); }
        }, 500);
        return () => clearTimeout(timer);
    }, [woSearch]);

    const handleGetItems = async () => {
        if (!selectedWO) return;
        setIsFetchingItems(true);
        try {
            const draft = await callMethod('erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry', {
                work_order_id: selectedWO.name, purpose: 'Manufacture', qty: parseFloat(fgCompletedQty)
            });
            if (draft && draft.items) {
                const results = await Promise.all(draft.items.map(async (item: any) => {
                    const meta = await getResource('Item', item.item_code);
                    return { ...item, original_qty: item.qty, has_batch_no: meta.has_batch_no, has_serial_no: meta.has_serial_no, selected_batches: [] };
                }));
                results.sort((a, b) => (b.is_finished_item === 1 ? 1 : 0) - (a.is_finished_item === 1 ? 1 : 0));
                setTransferItems(results);
                setStep(2);
                setIsDirty(true);
            }
        } catch (err) { showError('Fetch failed'); } finally { setIsFetchingItems(false); }
    };

    const handleSave = async () => {
        try {
            setIsProcessing(true);
            const finalItems = await Promise.all(transferItems.map(async (item) => {
                if ((item.has_batch_no || item.has_serial_no) && item.selected_batches?.length > 0) {
                    // Removed strict frontend validation to allow backend settings to dictate requirements

                    const isFinishedGood = item.is_finished_item === 1;
                    const bundleData = {
                        doctype: 'Serial and Batch Bundle', item_code: item.item_code,
                        warehouse: isFinishedGood ? (item.t_warehouse || item.to_warehouse) : (item.s_warehouse || item.from_warehouse),
                        type_of_transaction: isFinishedGood ? 'Inward' : 'Outward',
                        is_outward: isFinishedGood ? 0 : 1, voucher_type: 'Stock Entry', voucher_no: id, total_qty: parseFloat(item.qty) || 0,
                        entries: item.selected_batches.map((b: any) => {
                            const entry: any = { qty: parseFloat(b.qty) || 0 };
                            if (b.batch_no) entry.batch_no = b.batch_no;
                            if (b.serial_no) entry.serial_no = b.serial_no;
                            return entry;
                        })
                    };
                    const bundle = item.serial_and_batch_bundle
                        ? await putResource('Serial and Batch Bundle', item.serial_and_batch_bundle, bundleData)
                        : await postResource('Serial and Batch Bundle', bundleData);
                    return { ...item, serial_and_batch_bundle: bundle.name };
                }
                return item;
            }));
            const doc = {
                doctype: 'Stock Entry', purpose: 'Manufacture',
                work_order: selectedWO?.name, company: selectedWO?.company,
                fg_completed_qty: parseFloat(fgCompletedQty), items: finalItems
            };
            await putResource('Stock Entry', id as string, doc);
            showSuccess('Saved');
            await fetchStockEntry();
            setIsDirty(false);
        } catch (err) { showError('Save failed'); } finally { setIsProcessing(false); }
    };

    const handleSubmit = async () => {
        try {
            setIsProcessing(true);
            await putResource('Stock Entry', id as string, { docstatus: 1 });
            showSuccess('Submitted');
            router.back();
        } catch (err) { showError('Submission failed'); } finally { setIsProcessing(false); }
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
            setIsDirty(true);
        }
        setItemModalVisible(false);
        setShowBatchSlider(false);
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

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0f172a" /></View>;

    return (
        <View style={styles.container}>
            <TopNavbar title="" showBackButton={true} />
            {renderStepper()}

            <ScrollView
                style={styles.flex1}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {step === 1 ? (
                    <Animated.View entering={FadeIn} style={styles.p24}>
                        <Text style={styles.label}>{t('select_work_order', 'Select Work Order')}</Text>
                        <GlobalSearchInput
                            placeholder="Search..."
                            value={selectedWO ? selectedWO.name : woSearch}
                            onChangeText={(t) => { setWoSearch(t); setIsDirty(true); if(selectedWO) setSelectedWO(null); }}
                            editable={stockEntry?.docstatus === 0}
                            containerStyle={{ marginBottom: 12 }}
                        />
                        {woResults.length > 0 && !selectedWO && (
                            <View style={styles.results}>
                                {woResults.map((wo, i) => (
                                    <TouchableOpacity key={i} style={styles.resultItem} onPress={() => { setSelectedWO(wo); setFgCompletedQty(wo.qty.toString()); setWoResults([]); }}>
                                        <Text style={styles.bold}>{wo.name}</Text><Text style={styles.dim}>{wo.production_item}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        {selectedWO && (
                            <View style={styles.mt24}>
                                <View style={styles.card}>
                                    <View style={styles.row}><ClipboardList size={22} color="#0f172a" /><Text style={styles.woId}>{selectedWO.name}</Text></View>
                                    <View style={[styles.pill, { alignSelf: 'flex-start', marginTop: 12 }]}><Package size={14} color="#64748b" /><Text style={styles.pillText}>{selectedWO.production_item}</Text></View>
                                </View>
                                <View style={styles.qtyContainer}>
                                    <TextInput style={styles.qtyInput} value={fgCompletedQty} editable={stockEntry?.docstatus === 0} onChangeText={(v) => { setFgCompletedQty(v); setIsDirty(true); }} keyboardType="numeric" />
                                    <View style={styles.unitBadge}><Text style={styles.whiteBold}>{selectedWO.stock_uom || 'NOS'}</Text></View>
                                </View>
                                <Text style={styles.qtyHint}>Planned Qty: {selectedWO.qty} {selectedWO.stock_uom || 'NOS'}</Text>
                                {step === 1 && (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={handleGetItems}
                                        disabled={isFetchingItems}
                                        style={{ alignItems: 'center', marginTop: 24 }}
                                    >
                                        <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '800', fontFamily: Fonts.sans }}>
                                            {isFetchingItems ? 'Fetching Items...' : 'Continue to Verify →'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </Animated.View>
                ) : (
                    <Animated.View entering={SlideInRight} style={styles.p24}>
                        <TouchableOpacity disabled={stockEntry?.docstatus > 0} onPress={() => setStep(1)}>
                            <Text style={styles.h1}>{selectedWO?.name}</Text>
                        </TouchableOpacity>
                        <Text style={styles.h2}>{selectedWO?.production_item} × {fgCompletedQty}</Text>
                        <View style={styles.mt24}><Text style={styles.h3}>{t('production_entry', 'Production Entry')}</Text><Text style={styles.h4}>Target: {stockEntry?.to_warehouse}</Text></View>

                        <View style={styles.mt24}>
                            {transferItems.map((item, i) => (
                                <View key={i} style={[styles.itemCard, item.is_finished_item === 1 && styles.finishedItemCard]}>
                                    <View style={styles.rowBetween}>
                                        <View style={[styles.flex1, { paddingRight: 12 }]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                                <Text style={styles.itemCode}>{item.item_code}</Text>
                                                {item.is_finished_item === 1 && (
                                                    <View style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                        <Text style={{ fontSize: 10, color: '#4338ca', fontWeight: 'bold' }}>Finished Good</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.itemName} numberOfLines={2}>{item.item_name}</Text>
                                            {!!item.serial_and_batch_bundle && stockEntry?.docstatus === 0 && (
                                                <View style={styles.bundleRef}>
                                                    <Barcode size={12} color="#64748b" />
                                                    <Text style={styles.bundleRefText}>{item.serial_and_batch_bundle}</Text>
                                                </View>
                                            )}
                                        </View>
                                        {!!(item.has_batch_no || item.has_serial_no) && (
                                            stockEntry?.docstatus > 0 ? (
                                                <View style={{ flexDirection: 'row', gap: 6, marginLeft: 12 }}>
                                                    {!!item.has_batch_no && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ea580c' }} />
                                                            <Text style={{ fontSize: 12, color: '#c2410c', fontWeight: '500' }}>Batch</Text>
                                                        </View>
                                                    )}
                                                    {!!item.has_serial_no && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' }} />
                                                            <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '500' }}>Serial</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            ) : (
                                                <TouchableOpacity style={[styles.trackPill, { marginLeft: 12 }]} onPress={() => openTrackingModal(i)}>
                                                    <Barcode size={14} color="#d97706" />
                                                    <Text style={styles.trackPillText}>
                                                        {(item.selected_batches?.length || 0) > 0 ? `${item.selected_batches.length} Batches` : t('select_batch_serial', 'Select Batch / Serial')}
                                                    </Text>
                                                </TouchableOpacity>
                                            )
                                        )}
                                    </View>
                                    <View style={[styles.rowBetween, { marginTop: 16 }]}>
                                        <View style={styles.qtyRow}>
                                            <TouchableOpacity style={styles.qtyBtn} onPress={() => { setTransferItems(p => { const n = [...p]; if (n[i].qty > 0) n[i].qty -= 1; return n; }); setIsDirty(true); }} disabled={stockEntry?.docstatus > 0}>
                                                <Minus size={20} color="#1e1b4b" />
                                            </TouchableOpacity>
                                            <View style={styles.qtyDisplay}>
                                                <TextInput
                                                    style={styles.qtyValueInput}
                                                    value={item.qty?.toString()}
                                                    keyboardType="numeric"
                                                    editable={stockEntry?.docstatus === 0}
                                                    onChangeText={(v) => { setTransferItems(p => { const n = [...p]; n[i].qty = parseFloat(v) || 0; return n; }); setIsDirty(true); }}
                                                />
                                            </View>
                                            <TouchableOpacity style={styles.qtyBtn} onPress={() => { setTransferItems(p => { const n = [...p]; n[i].qty += 1; return n; }); setIsDirty(true); }} disabled={stockEntry?.docstatus > 0}>
                                                <Plus size={20} color="#1e1b4b" />
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.totalLabel}>/ {item.original_qty || item.qty} {item.uom}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </Animated.View>
                )}
            </ScrollView>

            {/* Unified Bottom Footer Panel */}
            {!itemModalVisible && (
                <>
                    {step === 2 && (
                        <Animated.View entering={FadeIn} style={[styles.unifiedFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                            <View style={[styles.bottomActionsInner, { paddingHorizontal: 16 }]}>
                                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}
                                        onPress={() => router.back()}
                                    >
                                        <Text style={{ color: '#475569', fontSize: 15, fontWeight: '700' }}>{t('back', 'Back')}</Text>
                                    </TouchableOpacity>
                                    {stockEntry?.docstatus !== 1 && (
                                        <TouchableOpacity
                                            style={{ flex: 1.5, height: 50, borderRadius: 12, overflow: 'hidden' }}
                                            onPress={isDirty ? handleSave : handleSubmit}
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
                                                        {isDirty ? 'Save Changes' : 'Submit Entry'}
                                                    </Text>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </Animated.View>
                    )}

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
                </>
            )}

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
                        style={[styles.modalContent, { maxHeight: 800 }]} // use hardcoded 800 or windowHeight if available
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
                                                                                    <Text style={[styles.warehouseName, { color: '#9333ea' }]}>Create new batch "{batch.batch_no}"</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    flex1: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    p24: { padding: 16 },
    mt24: { marginTop: 24 },
    label: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        height: 52,
        paddingLeft: 12,
        paddingRight: 4,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    results: { backgroundColor: '#fff', borderRadius: 20, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0', elevation: 4 },
    resultItem: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', padding: 16 },
    bold: { fontWeight: 'bold', fontSize: 16 },
    dim: { color: '#64748b', fontSize: 13 },
    card: { backgroundColor: '#fff', padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    woId: { fontSize: 18, fontWeight: '900', fontFamily: Fonts.rounded },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    pillText: { fontSize: 13, color: '#64748b' },
    qtyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 52,
        paddingLeft: 12,
        paddingRight: 4,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#7634bc',
        overflow: 'hidden',
    },
    qtyInput: {
        flex: 1,
        height: '100%',
        fontSize: 18,
        fontWeight: '900',
        fontFamily: Fonts.rounded,
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    unitBadge: { backgroundColor: '#7634bc', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    whiteBold: { color: '#fff', fontWeight: 'bold' },
    qtyHint: { fontSize: 13, color: '#94a3b8', marginTop: 12, textAlign: 'right', fontWeight: '600' },
    h1: { fontSize: 24, fontWeight: '900', fontFamily: Fonts.rounded, color: '#0f172a' },
    h2: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: '500' },
    h3: { fontSize: 16, fontWeight: '900', fontFamily: Fonts.rounded },
    h4: { fontSize: 15, color: '#94a3b8', marginTop: 4, fontWeight: '600' },
    itemCard: {
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
    itemCode: { fontSize: 12, fontWeight: '900', color: '#94a3b8' },
    itemName: { fontSize: 14, fontWeight: 'bold', fontFamily: Fonts.rounded, marginTop: 2 },
    bundleRef: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#f1f5f9', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    bundleRefText: { fontSize: 11, fontWeight: '700', color: '#64748b', fontFamily: Fonts.rounded },
    trackPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: '#fde68a' },
    trackPillText: { fontSize: 12, fontWeight: 'bold', color: '#d97706' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    qtyBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    qtyDisplay: {
        width: 80,
        height: 44,
        backgroundColor: '#faf5ff',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#f3e8ff',
    },
    qtyValueInput: {
        width: '100%',
        height: '100%',
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2e1065',
        fontFamily: Fonts.rounded,
        paddingVertical: 0,
        ...Platform.select({
            web: { outlineStyle: 'none' } as any,
        }),
    },
    totalLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '900' },
    unifiedFooter: { backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 16 },
    bottomActionsInner: { marginBottom: 12 },
    pillNavbarContainer: { alignItems: 'center', justifyContent: 'center' },
    linkButtonsRow: { flexDirection: 'row', gap: 24, alignItems: 'center', justifyContent: 'center' },
    linkBtn: { paddingVertical: 12, paddingHorizontal: 20 },
    linkBtnTextDim: { fontSize: 16, fontWeight: 'bold', color: '#64748b', textDecorationLine: 'underline', fontFamily: Fonts.sans },
    linkBtnTextActive: { fontSize: 16, fontWeight: 'bold', color: '#7634bc', textDecorationLine: 'underline', fontFamily: Fonts.sans },
    pillNavbar: { flexDirection: 'row', backgroundColor: '#1e1b4b', borderRadius: 30, padding: 6, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 10 },
    pillBackBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', opacity: 0.8 },
    pillDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
    pillNavBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, borderRadius: 22, gap: 8 },
    pillNavBtnActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
    pillNavTextActive: { fontSize: 12, fontWeight: '900', color: '#fff', fontFamily: Fonts.sans, letterSpacing: 0.5 },
    pillNavText: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', fontFamily: Fonts.sans },
    modalBody: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        width: '100%',
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24,
        maxHeight: '90%',
        minHeight: '60%',
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
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSubHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    modalSubId: { fontSize: 13, fontWeight: 'bold', color: '#94a3b8' },
    createNewBtn: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#eff6ff', borderRadius: 6, borderWidth: 1, borderColor: '#dbeafe' },
    createNewText: { fontSize: 11, fontWeight: 'bold', color: '#3b82f6' },
    modalGrid: { flexDirection: 'row', gap: 12 },
    smallDim: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 'bold' },
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
    selectText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    bgDim: { backgroundColor: '#f1f5f9' },
    scanFieldContainer: { position: 'relative' },
    scanIcon: { position: 'absolute', right: 16, top: 17 },
    dropdown: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8, maxHeight: 250, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
    dropItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    dropName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
    dropSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    erpTable: { marginTop: 24, borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 24, zIndex: 10, backgroundColor: '#fff' },
    erpHead: { flexDirection: 'row', height: 48, backgroundColor: '#f8fafc', alignItems: 'center', paddingHorizontal: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 20 },
    headText: { fontSize: 12, color: '#64748b', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 12 },
    erpRow: { flexDirection: 'row', height: 64, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', position: 'relative', paddingHorizontal: 4, zIndex: 1 },
    w40: { width: 44, alignItems: 'center' },
    w100: { width: 110 },
    check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff' },
    rowIn: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        paddingHorizontal: 12,
        height: '100%',
        flex: 1,
        paddingVertical: 0,
    },
    textRight: { textAlign: 'right' },
    rowDrop: { position: 'absolute', top: 58, left: 2, right: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 25, zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 20 },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginTop: 16, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e2e8f0', zIndex: 1 },
    addBtnText: { fontWeight: 'bold', fontSize: 14, color: '#0f172a' },
    modalFoot: { flexDirection: 'row', gap: 12, marginTop: 32, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 24 },
    lightBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    darkBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#7634bc', justifyContent: 'center', alignItems: 'center' },

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
