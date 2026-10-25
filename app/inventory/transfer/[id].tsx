import { TopNavbar } from '@/components/TopNavbar';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { FloatingPill } from '@/components/FloatingPill';
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Barcode,
    ChevronDown,
    ClipboardList,
    Factory,
    FileText,
    Minus,
    Package,
    Plus,
    Trash2,
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
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { AppTextInput as TextInput } from '@/components/ui/AppTextInput';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StockEntryDetailsScreen() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { getResource, callMethod, postResource, putResource, loading: frappeLoading } = useFrappe(APP_CONFIG);
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const { showSuccess, showError } = useToast();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (!hasPermission('can_stock_transfer')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

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

    const [trackingModalVisible, setTrackingModalVisible] = useState(false);
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
    const [batchSearch, setBatchSearch] = useState('');
    const [availableBatches, setAvailableBatches] = useState<any[]>([]);
    const [autoFetchQty, setAutoFetchQty] = useState('');
    const [fetchBasedOn, setFetchBasedOn] = useState('FIFO');
    const [isSearchingBatches, setIsSearchingBatches] = useState(false);
    const [rowSearchIndex, setRowSearchIndex] = useState<number | null>(null);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [searchTimer, setSearchTimer] = useState<any>(null);
    const [isDirty, setIsDirty] = useState(false);

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
                    filters: JSON.stringify([['status', 'not in', ['Completed', 'Stopped', 'Closed']], ['name', 'like', `%${woSearch}%`], ['docstatus', '=', 1]]),
                    fields: '["name", "production_item", "qty", "stock_uom", "source_warehouse", "wip_warehouse", "company"]'
                });
                setWoResults(results || []);
            } finally { setIsSearching(false); }
        }, 500);
        return () => clearTimeout(timer);
    }, [woSearch]);

    const handleGetItems = async () => {
        if (!selectedWO) return;
        setIsFetchingItems(true);
        try {
            const draft = await callMethod('erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry', {
                work_order_id: selectedWO.name, purpose: 'Material Transfer for Manufacture', qty: parseFloat(fgCompletedQty)
            });
            if (draft && draft.items) {
                const results = await Promise.all(draft.items.map(async (item: any) => {
                    const meta = await getResource('Item', item.item_code);
                    return { ...item, original_qty: item.qty, has_batch_no: meta.has_batch_no, has_serial_no: meta.has_serial_no, selected_batches: [] };
                }));
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
                    const bundleData = {
                        doctype: 'Serial and Batch Bundle', item_code: item.item_code,
                        warehouse: item.s_warehouse || item.from_warehouse, type_of_transaction: 'Outward',
                        is_outward: 1, voucher_type: 'Stock Entry', voucher_no: id, total_qty: parseFloat(item.qty) || 0,
                        entries: item.selected_batches.map((b: any) => ({ batch_no: b.batch_no, qty: parseFloat(b.qty) || 0 }))
                    };
                    const bundle = item.serial_and_batch_bundle
                        ? await putResource('Serial and Batch Bundle', item.serial_and_batch_bundle, bundleData)
                        : await postResource('Serial and Batch Bundle', bundleData);
                    return { ...item, serial_and_batch_bundle: bundle.name };
                }
                return item;
            }));
            const doc = {
                doctype: 'Stock Entry', purpose: 'Material Transfer for Manufacture',
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

    const openTrackingModal = (index: number) => {
        setActiveItemIndex(index);
        setTrackingModalVisible(true);
        setAutoFetchQty(transferItems[index].qty?.toString() || '');
    };

    const handleAutoFetch = async () => {
        if (activeItemIndex === null) return;
        setIsProcessing(true);
        try {
            const item = transferItems[activeItemIndex];
            const targetQty = parseFloat(autoFetchQty) || item.qty;
            const batches = await getResource('Batch', undefined, {
                filters: JSON.stringify([['item', '=', item.item_code], ['disabled', '=', 0]]),
                fields: '["name"]', limit_page_length: 50
            });
            if (batches) {
                let allocated = 0; const result: any[] = [];
                for (const b of batches) {
                    if (allocated >= targetQty) break;
                    const needed = targetQty - allocated;
                    result.push({ batch_no: b.name, qty: needed }); allocated += needed;
                }
                setTransferItems(p => { const next = [...p]; next[activeItemIndex].selected_batches = result; return next; });
                setIsDirty(true);
            }
        } finally { setIsProcessing(false); }
    };

    const searchBatches = async (q: string) => {
        if (activeItemIndex === null) return;
        setIsSearchingBatches(true);
        try {
            const item = transferItems[activeItemIndex];
            const res = await callMethod('erpnext.controllers.queries.get_batch_no', {
                doctype: 'Batch',
                txt: q || '',
                searchfield: 'name',
                start: 0,
                page_len: 20,
                filters: { item_code: item.item_code, warehouse: item.s_warehouse || item.from_warehouse }
            });
            setAvailableBatches(res.map((r: any) => ({ name: r[0], balance: r[1] })));
        } finally { setIsSearchingBatches(false); }
    };

    const addBatchToItem = (batch: any, index?: number) => {
        if (activeItemIndex === null) return;
        const item = transferItems[activeItemIndex];
        const targetQty = parseFloat(autoFetchQty) || item.qty;
        const currentTotal = (item.selected_batches || []).reduce((sum: number, b: any, i: number) => (index !== undefined && i === index) ? sum : sum + (parseFloat(b.qty) || 0), 0);
        const needed = Math.max(0, targetQty - currentTotal);
        setTransferItems(p => {
            const next = [...p]; const sel = [...(next[activeItemIndex].selected_batches || [])];
            if (index !== undefined) sel[index] = { ...sel[index], batch_no: batch.name, qty: needed || 1 };
            else if (!sel.some(b => b.batch_no === batch.name)) sel.push({ batch_no: batch.name, qty: needed || 1 });
            next[activeItemIndex].selected_batches = sel; return next;
        });
        setIsDirty(true);
        setAvailableBatches([]); setIsDropdownVisible(false);
    };

    const updateBatchQty = (index: number, val: string) => {
        if (activeItemIndex === null) return;
        setTransferItems(p => {
            const next = [...p]; const sel = [...(next[activeItemIndex].selected_batches || [])];
            sel[index] = { ...sel[index], qty: val };
            next[activeItemIndex].selected_batches = sel; return next;
        });
        setIsDirty(true);
    };

    const updateBatchNo = (index: number, val: string) => {
        if (activeItemIndex === null) return;
        setTransferItems(p => {
            const next = [...p]; const sel = [...(next[activeItemIndex].selected_batches || [])];
            sel[index] = { ...sel[index], batch_no: val };
            next[activeItemIndex].selected_batches = sel; return next;
        });
        setIsDirty(true);
        if (searchTimer) clearTimeout(searchTimer);
        setSearchTimer(setTimeout(() => { setRowSearchIndex(index); searchBatches(val); setIsDropdownVisible(true); }, 350));
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0f172a" /></View>;

    return (
        <View style={styles.container}>
            <TopNavbar title="" showBackButton={true} />

            <ScrollView
                style={styles.flex1}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 280 }} // Extra padding for footer and pill
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
                                    <View style={[styles.pill, { alignSelf: 'flex-start', marginTop: 12 }]}><Package size={14} color="#64748b" /><Text style={styles.pillTextLight}>{selectedWO.production_item}</Text></View>
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
                        <View style={styles.mt24}><Text style={styles.h3}>{t('issue_raw_materials', 'Issue Raw Materials')}</Text><Text style={styles.h4}>Target: {stockEntry?.to_warehouse}</Text></View>

                        <View style={styles.mt24}>
                            {transferItems.map((item, i) => (
                                <View key={i} style={styles.itemCard}>
                                    <View style={styles.rowBetween}>
                                        <View style={styles.flex1}>
                                            <Text style={styles.itemCode}>{item.item_code}</Text>
                                            <Text style={styles.itemName} numberOfLines={2}>{item.item_name}</Text>
                                            {!!item.serial_and_batch_bundle && (
                                                <View style={styles.bundleRef}>
                                                    <Barcode size={12} color="#64748b" />
                                                    <Text style={styles.bundleRefText}>{item.serial_and_batch_bundle}</Text>
                                                </View>
                                            )}
                                        </View>
                                        {(item.has_batch_no || item.has_serial_no) && (
                                            <TouchableOpacity style={[styles.trackPill, { marginLeft: 12 }]} onPress={() => openTrackingModal(i)}>
                                                <Barcode size={14} color="#d97706" /><Text style={styles.trackPillText}>{t('select_batch_serial', 'Select Batch / Serial')}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={[styles.rowBetween, { marginTop: 16 }]}>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity onPress={() => { setTransferItems(p => { const n = [...p]; const curr = parseFloat(n[i].qty?.toString() || '0') || 0; if (curr > 0) n[i].qty = curr - 1; return n; }); setIsDirty(true); }} disabled={stockEntry?.docstatus > 0}><Minus size={18} color="#0f172a" /></TouchableOpacity>
                                            <TextInput style={styles.stepperInput} value={item.qty?.toString()} keyboardType="numeric" editable={stockEntry?.docstatus === 0} onChangeText={(v) => { setTransferItems(p => { const n = [...p]; n[i].qty = v as any; return n; }); setIsDirty(true); }} />
                                            <TouchableOpacity onPress={() => { setTransferItems(p => { const n = [...p]; const curr = parseFloat(n[i].qty?.toString() || '0') || 0; n[i].qty = curr + 1; return n; }); setIsDirty(true); }} disabled={stockEntry?.docstatus > 0}><Plus size={18} color="#0f172a" /></TouchableOpacity>
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
                    leftLabel={t('mfg_transfer', 'MFG TRANSFER')}
                    leftIcon={<Factory size={18} color="#94a3b8" />}
                    rightLabel={t('ste', 'STE')}
                    rightIcon={<FileText size={18} color="#fff" />}
                    style={{ bottom: Math.max(insets.bottom + 16, 24) }}
                />
            )}

            {/* Modal remains the same but zIndex fixed */}
            <Modal visible={trackingModalVisible} animationType="slide" transparent statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBody}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={styles.modalTitle}>{t('add_batch_nos', 'Add Batch Nos')}</Text>
                                <Text style={styles.modalSubtitle} numberOfLines={1} ellipsizeMode="tail">
                                    {activeItemIndex !== null && transferItems[activeItemIndex].item_name}
                                </Text>
                                {activeItemIndex !== null && !!transferItems[activeItemIndex].serial_and_batch_bundle && (
                                    <View style={styles.modalSubHeader}>
                                        <Text style={styles.modalSubId}>{transferItems[activeItemIndex].serial_and_batch_bundle}</Text>
                                        <TouchableOpacity
                                            style={styles.createNewBtn}
                                            onPress={() => {
                                                Alert.alert("Create New Bundle?", "This will unlink the current bundle. A new one will be created when you save.", [
                                                    { text: "Cancel", style: "cancel" },
                                                    {
                                                        text: "Unlink & New", onPress: () => {
                                                            setTransferItems(p => {
                                                                const next = [...p];
                                                                next[activeItemIndex].serial_and_batch_bundle = null;
                                                                return next;
                                                            });
                                                            setIsDirty(true);
                                                        }
                                                    }
                                                ]);
                                            }}
                                        >
                                            <Text style={styles.createNewText}>{t('create_new', 'Create New')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setTrackingModalVisible(false)} style={styles.closeBtn}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <View style={styles.modalGrid}>
                                <View style={styles.flex1}><Text style={styles.smallDim}>{t('qty', 'Qty')}</Text><TextInput style={styles.erpInput} value={autoFetchQty} onChangeText={setAutoFetchQty} keyboardType="numeric" /></View>
                                <View style={styles.flex1}><Text style={styles.smallDim}>{t('based_on', 'Based On')}</Text><TouchableOpacity style={styles.erpSelect} onPress={() => { Alert.alert("Select Strategy", "Choose auto-fetch method", [{ text: "FIFO", onPress: () => { setFetchBasedOn('FIFO'); handleAutoFetch(); } }, { text: "LIFO", onPress: () => { setFetchBasedOn('LIFO'); handleAutoFetch(); } }, { text: "Cancel", style: "cancel" }]); }}><Text style={styles.selectText}>{fetchBasedOn}</Text><ChevronDown size={14} color="#64748b" /></TouchableOpacity></View>
                            </View>
                            <View style={[styles.modalGrid, { marginTop: 16 }]}>
                                <View style={styles.flex1}><Text style={styles.smallDim}>{t('warehouse', 'Warehouse')}</Text><TextInput style={[styles.erpInput, styles.bgDim]} value={activeItemIndex !== null ? (transferItems[activeItemIndex].s_warehouse || transferItems[activeItemIndex].from_warehouse) : ''} editable={false} /></View>
                                <View style={styles.flex1}>
                                    <Text style={styles.smallDim}>{t('scan', 'Scan')}</Text>
                                    <View style={styles.scanFieldContainer}>
                                        <TextInput style={styles.erpInput} value={batchSearch} onFocus={() => { setRowSearchIndex(null); setIsDropdownVisible(true); searchBatches(batchSearch); }} onChangeText={(t) => { setBatchSearch(t); searchBatches(t); }} />
                                        <Plus size={16} color="#94a3b8" style={styles.scanIcon} />
                                    </View>
                                </View>
                            </View>
                            {isDropdownVisible && rowSearchIndex === null && (
                                <View style={styles.dropdown}>{availableBatches.map((b, i) => (<TouchableOpacity key={i} style={styles.dropItem} onPress={() => { addBatchToItem(b); setIsDropdownVisible(false); }}><View><Text style={styles.dropName}>{b.name}</Text>{b.balance && <Text style={styles.dropSub}>{b.balance}</Text>}</View><Plus size={16} color="#0f172a" /></TouchableOpacity>))}</View>
                            )}
                            <View style={styles.erpTable}>
                                <View style={styles.erpHead}><View style={styles.w40} /><View style={styles.flex1}><Text style={styles.headText}>{t('batch_no', 'Batch No')}</Text></View><View style={styles.w100}><Text style={[styles.headText, { textAlign: 'right' }]}>{t('quantity', 'Quantity')}</Text></View><View style={styles.w40} /></View>
                                {activeItemIndex !== null && transferItems[activeItemIndex].selected_batches?.map((b: any, i: number) => (
                                    <View key={i} style={[styles.erpRow, { zIndex: rowSearchIndex === i ? 5000 : 1 }]}>
                                        <View style={styles.w40}><View style={styles.check} /></View>
                                        <View style={styles.flex1}>
                                            <TextInput style={styles.rowIn} value={b.batch_no} onFocus={() => { setRowSearchIndex(i); setIsDropdownVisible(true); searchBatches(b.batch_no); }} onChangeText={(v) => updateBatchNo(i, v)} placeholder="Batch No" />
                                        </View>
                                        <View style={styles.w100}><TextInput style={[styles.rowIn, styles.textRight]} value={b.qty?.toString()} keyboardType="numeric" onChangeText={(v) => updateBatchQty(i, v)} /></View>
                                        <View style={styles.w40}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (activeItemIndex === null) return;
                                                    setTransferItems(p => {
                                                        const n = [...p];
                                                        const sel = [...(n[activeItemIndex].selected_batches || [])];
                                                        sel.splice(i, 1);
                                                        n[activeItemIndex].selected_batches = sel;
                                                        return n;
                                                    });
                                                    setIsDirty(true);
                                                }}
                                            >
                                                <Trash2 size={16} color="#94a3b8" />
                                            </TouchableOpacity>
                                        </View>
                                        {isDropdownVisible && rowSearchIndex === i && (
                                            <View style={styles.rowDrop}>
                                                {availableBatches.map((res: any, idx) => (
                                                    <TouchableOpacity key={idx} style={styles.dropItem} onPress={() => { addBatchToItem(res, i); setIsDropdownVisible(false); }}>
                                                        <View>
                                                            <Text style={styles.dropName}>{res.name}</Text>
                                                            {res.balance && <Text style={styles.dropSub}>{res.balance}</Text>}
                                                        </View>
                                                        <Plus size={16} color="#0f172a" />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                            <TouchableOpacity
                                style={styles.addBtn}
                                onPress={() => {
                                    if (activeItemIndex === null) return;
                                    setTransferItems(p => {
                                        const n = [...p];
                                        const item = n[activeItemIndex];
                                        const targetQty = parseFloat(autoFetchQty) || item.qty;
                                        const currentTotal = (item.selected_batches || []).reduce((sum: number, b: any) => sum + (parseFloat(b.qty) || 0), 0);
                                        const remaining = Math.max(0, targetQty - currentTotal);
                                        n[activeItemIndex].selected_batches = [...(n[activeItemIndex].selected_batches || []), { batch_no: '', qty: remaining || 1 }];
                                        return n;
                                    });
                                    setIsDirty(true);
                                }}
                            >
                                <Plus size={14} color="#0f172a" />
                                <Text style={styles.addBtnText}>{t('add_row', 'Add Row')}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                        <View style={styles.modalFoot}><TouchableOpacity style={styles.lightBtn} onPress={() => setTrackingModalVisible(false)}><Text>{t('edit_full_form', 'Edit Full Form')}</Text></TouchableOpacity><TouchableOpacity style={styles.darkBtn} onPress={() => setTrackingModalVisible(false)}><Text style={styles.whiteBold}>{t('done', 'Done')}</Text></TouchableOpacity></View>
                    </View>
                </View>
            </Modal>

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Stock Transfer"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_stock_transfer')) {
                        router.back();
                    }
                }}
            />
        </View>
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
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    woId: { fontSize: 18, fontWeight: '900', fontFamily: Fonts.rounded },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    pillTextLight: { fontSize: 13, color: '#64748b' },
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
    itemCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: '#f1f5f9' },
    itemCode: { fontSize: 12, fontWeight: '900', color: '#94a3b8' },
    itemName: { fontSize: 14, fontWeight: 'bold', fontFamily: Fonts.rounded, marginTop: 2 },
    bundleRef: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#f1f5f9', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    bundleRefText: { fontSize: 11, fontWeight: '700', color: '#64748b', fontFamily: Fonts.rounded },
    trackPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: '#fde68a' },
    trackPillText: { fontSize: 12, fontWeight: 'bold', color: '#d97706' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
    stepperInput: {
        flex: 1,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '900',
        fontFamily: Fonts.rounded,
        height: '100%',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    totalLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '900' },
    footerBar: { position: 'absolute', bottom: 110, left: 16, right: 16, alignItems: 'center', zIndex: 9999, elevation: 9999 },
    footerActionRow: { flexDirection: 'row', gap: 24, alignItems: 'center', justifyContent: 'center' },
    linkBtn: { paddingVertical: 12, paddingHorizontal: 20 },
    linkBtnTextDim: { fontSize: 16, fontWeight: 'bold', color: '#64748b', textDecorationLine: 'underline', fontFamily: Fonts.rounded },
    linkBtnTextActive: { fontSize: 16, fontWeight: 'bold', color: '#7634bc', textDecorationLine: 'underline', fontFamily: Fonts.rounded },
    btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    submitBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#7634bc', justifyContent: 'center', alignItems: 'center', elevation: 4 },
    btnDisabled: { opacity: 0.7 },
    floatingContainer: { position: 'absolute', bottom: 40, alignSelf: 'center', flexDirection: 'row', backgroundColor: '#1e1b4b', borderRadius: 28, height: 56, padding: 6, alignItems: 'center', elevation: 12 },
    backPill: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    dividerPill: { width: 1.5, height: 24, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
    infoPill: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
    activePillItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 24, paddingLeft: 12, backgroundColor: 'rgba(255,255,255,0.1)', height: 44, borderRadius: 22 },
    pillText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBody: { backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 24, height: '90%' },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        fontFamily: Fonts.rounded,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 2,
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
    smallDim: { fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: '600' },
    erpInput: {
        height: 52,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 16,
        fontSize: 15,
        fontWeight: '600',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    erpSelect: {
        height: 52,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
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
    reviewBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: Fonts.sans }
});
