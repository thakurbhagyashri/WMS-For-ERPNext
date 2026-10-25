import { TopNavbar } from "@/components/TopNavbar";
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';

import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useCompanyContext } from '@/context/CompanyContext';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Building2, Calculator, CalculatorIcon, Calendar, Check, ChevronDown, ChevronRight, Hash, Layers, Minus, Plus, Scan, Search, ScanLine, Trash2, X } from "lucide-react-native";
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { FloatingPill } from '@/components/FloatingPill';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
export default function WarehouseCount() {
    const { t } = useTranslation();

    const router = useRouter();
    const { type, name } = useLocalSearchParams();
    const { getResource, postResource, callMethod, loading: apiLoading, company } = useFrappe(APP_CONFIG);
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const { showSuccess, showError } = useToast();
    const { activeCompany } = useCompanyContext();

    React.useEffect(() => {
        if (!hasPermission('can_cycle_count')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanTargetContext, setScanTargetContext] = useState<any>(null);

    const requestScanner = async (context: any = null) => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) return;
        }
        setScanTargetContext(context);
        setIsScanning(true);
    };

    const handleBarCodeScanned = ({ data }: any) => {
        setIsScanning(false);
        if (scanTargetContext?.type === 'batch') {
            updateBatch(scanTargetContext.index, 'batchNumber', data);
            showSuccess('Batch scanned');
        } else if (scanTargetContext?.type === 'serial') {
            updateBatch(scanTargetContext.index, 'batchNumber', data);
            showSuccess('Serial scanned');
        } else {
            handleSearch(data);
            showSuccess('Code scanned');
        }
    };


    const config: any = {
        "multi-warehouse": {
            title: "Multi-Warehouse Count",
            steps: ['Scan Item', 'Warehouse', 'Input Qty', 'Review']
        },
        "single-warehouse": {
            title: "Single Warehouse Count",
            steps: ['Warehouse', 'Scan Item', 'Input Qty', 'Review']
        }
    };


    const current = config[type as string] || config["multi-warehouse"];
    const [currentStep, setCurrentStep] = useState(0);

    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [itemPage, setItemPage] = useState(1);
    const [hasMoreItems, setHasMoreItems] = useState(true);
    const [warehousePage, setWarehousePage] = useState(1);
    const [hasMoreWarehouses, setHasMoreWarehouses] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
    const [countedItems, setCountedItems] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isSerialModalOpen, setIsSerialModalOpen] = useState<boolean>(false);
    const [batches, setBatches] = useState<any[]>([]);
    const [serialNumber, setSerialNumber] = useState(false);
    const [isSubmit, setIsSubmit] = useState(false);
    const [availableBatchDetails, setAvailableBatchDetails] = useState<any[]>([]);
    const [isSearchingBatches, setIsSearchingBatches] = useState(false);
    const [draftRecon, setDraftRecon] = useState<any>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
    const [batchSearchTimer, setBatchSearchTimer] = useState<any>(null);

    const [inventoryDimention, setInventoryDimention] = useState<any[]>([]);
    const [dimensionValues, setDimensionValues] = useState<Record<string, string>>({});
    const [dimensionSearch, setDimensionSearch] = useState<Record<string, string>>({});
    const [dimensionOptions, setDimensionOptions] = useState<Record<string, any[]>>({});
    const [showDimDropdown, setShowDimDropdown] = useState<string | null>(null);

    const fetchInventoryDimention = async () => {
        try {
            const data = await getResource('Inventory Dimension', undefined, {
                filters: JSON.stringify({ apply_to_all_doctypes: 1 }),
                fields: '["*"]',
                limit_page_length: 1000
            });
            setInventoryDimention(data || []);

            const optionsMap: Record<string, any[]> = {};
            for (const dim of (data || [])) {
                optionsMap[dim.target_fieldname] = [];
            }
            setDimensionOptions(optionsMap);
        } catch (error) {
            console.log('Failed to fetch inventory dimensions:', error);
        }
    };

    const handleDimensionSearch = async (target_fieldname: string, reference_document: string, text: string) => {
        setDimensionSearch(prev => ({ ...prev, [target_fieldname]: text }));
        setShowDimDropdown(target_fieldname);

        if (!reference_document) return;
        try {
            const docs = await getResource(reference_document, undefined, {
                filters: JSON.stringify([['name', 'like', `%${text}%`]]),
                fields: '["name"]',
                limit_page_length: 50
            });
            setDimensionOptions(prev => ({ ...prev, [target_fieldname]: docs || [] }));
        } catch (e) {
            console.warn(`Failed to search options for ${reference_document}:`, e);
            setDimensionOptions(prev => ({ ...prev, [target_fieldname]: [] }));
        }
    };

    React.useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchInventoryDimention();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const fetchExistingRecon = async (docName: string) => {
        try {
            const doc = await getResource('Stock Reconciliation', docName);
            if (doc) {
                setDraftRecon(doc);
                if (doc.warehouse) {
                    setSelectedWarehouse({ id: doc.warehouse, name: doc.warehouse });
                }

                const mappedItems = await Promise.all(doc.items.map(async (item: any) => {
                    let batches: any[] = [];
                    if (item.serial_and_batch_bundle) {
                        try {
                            const bundle = await getResource('Serial and Batch Bundle', item.serial_and_batch_bundle);
                            if (bundle && bundle.entries) {
                                batches = bundle.entries.map((e: any) => ({
                                    batchNumber: e.batch_no || e.serial_no || '',
                                    quantity: e.qty?.toString() || '1'
                                }));
                            }
                        } catch (e) {
                            console.warn('Bundle fetch error:', e);
                        }
                    }

                    // Get item details
                    let itemData: any = null;
                    try {
                        itemData = await getResource('Item', item.item_code);
                    } catch (e) {
                        console.warn('Item fetch error:', e);
                    }

                    return {
                        id: item.item_code,
                        name: itemData?.item_name || item.item_code,
                        type: itemData?.has_batch_no ? 'Batch' : (itemData?.has_serial_no ? 'Serial' : null),
                        has_batch_no: itemData?.has_batch_no,
                        has_serial_no: itemData?.has_serial_no,
                        warehouse: { id: item.warehouse, name: item.warehouse },
                        batches: batches,
                        totalQty: item.qty
                    };
                }));

                setCountedItems(mappedItems);
                setCurrentStep(3); // Go directly to review screen
            }
        } catch (err) {
            console.error('Fetch existing recon error:', err);
            showError('Failed to load existing reconciliation');
        }
    };

    React.useEffect(() => {
        if (name) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchExistingRecon(name as string);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);


    const fetchWarehouses = async (query = '', pageIndex = 1) => {
        if (pageIndex > 1) setIsLoadingMore(true);
        try {
            const filters: any[] = [['is_group', '=', 0]];
            if (activeCompany) {
                filters.push(['company', '=', activeCompany]);
            }
            if (query) {
                filters.push(['name', 'like', `%${query}%`]);
            }
            const res = await getResource('Warehouse', undefined, {
                filters: JSON.stringify(filters),
                fields: '["name"]',
                limit_start: (pageIndex - 1) * 10,
                limit_page_length: 10
            });
            const newWarehouses = res?.map((w: any) => ({ id: w.name, name: w.name })) || [];

            setWarehouses(newWarehouses);
            setWarehousePage(pageIndex);
            setHasMoreWarehouses(newWarehouses.length === 10);
            if (pageIndex === 1 && newWarehouses.length === 0) {
                setWarehouses([]);
            }
        } catch (err) {
            console.error('Fetch warehouses error:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const fetchItems = async (query = '', pageIndex = 1) => {
        if (pageIndex > 1) setIsLoadingMore(true);
        try {
            const filters: any[] = [['disabled', '=', 0]];
            if (query) {
                // Try resolving as barcode first
                let resolvedItemCode = query;
                try {
                    const barcodeDocs = await getResource('Item Barcode', undefined, {
                        filters: JSON.stringify([['barcode', '=', query]])
                    }, false, undefined, true);
                    if (barcodeDocs && barcodeDocs.length > 0) {
                        resolvedItemCode = barcodeDocs[0].parent;
                    }
                } catch (e) { }

                filters.push(['name', 'like', `%${resolvedItemCode}%`]);
            }
            const res = await getResource('Item', undefined, {
                filters: JSON.stringify(filters),
                fields: '["name", "item_name", "has_batch_no", "has_serial_no"]',
                limit_start: (pageIndex - 1) * 10,
                limit_page_length: 10
            });
            const newItems = res?.map((item: any) => ({
                id: item.name,
                name: item.item_name || item.name,
                type: item.has_batch_no ? 'Batch' : (item.has_serial_no ? 'Serial' : null),
                has_batch_no: item.has_batch_no,
                has_serial_no: item.has_serial_no
            })) || [];

            setItems(newItems);
            setItemPage(pageIndex);
            setHasMoreItems(newItems.length === 10);
            if (pageIndex === 1 && newItems.length === 0) {
                setItems([]);
            }
        } catch (err) {
            console.error('Fetch items error:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    React.useEffect(() => {
        if (type === 'single-warehouse' && currentStep === 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchWarehouses();
        } else if (type === 'multi-warehouse' && currentStep === 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchItems();
        } else if (type === 'single-warehouse' && currentStep === 1) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchItems();
        } else if (type === 'multi-warehouse' && currentStep === 1) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchWarehouses();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, currentStep]);


    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (isMulti && currentStep === 0) {
            fetchItems(text, 1);
        } else if (isSingle && currentStep === 0) {
            fetchWarehouses(text, 1);
        } else if (isSingle && currentStep === 1) {
            fetchItems(text, 1);
        } else if (isMulti && currentStep === 1) {
            fetchWarehouses(text, 1);
        }
    };

    React.useEffect(() => {
        if (isSubmit && !apiLoading) {
            const timer = setTimeout(() => {
                router.back();
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [isSubmit, apiLoading]);

    const handleSaveDraft = async () => {
        if (countedItems.length === 0) return;

        try {
            // Step 1: Save as Draft
            const finalItems = (await Promise.all(countedItems.map(async (item) => {
                let bundleName = null;
                const validBatches = item.batches?.filter((b: any) =>
                    b.batchNumber?.trim() !== '' &&
                    (item.has_serial_no || (parseFloat(b.quantity) > 0))
                ) || [];

                if ((item.has_batch_no || item.has_serial_no) && validBatches.length > 0) {
                    const bundleData = {
                        doctype: 'Serial and Batch Bundle',
                        item_code: item.id,
                        warehouse: item.warehouse?.id,
                        type_of_transaction: 'Inward',
                        is_outward: 0,
                        voucher_type: 'Stock Reconciliation',
                        total_qty: item.has_serial_no ? validBatches.length : validBatches.reduce((s: number, b: any) => s + (parseFloat(b.quantity) || 0), 0),
                        entries: validBatches.map((b: any) => ({
                            batch_no: item.has_batch_no ? b.batchNumber : undefined,
                            serial_no: item.has_serial_no ? b.batchNumber : undefined,
                            qty: item.has_serial_no ? 1 : parseFloat(b.quantity) || 0
                        }))
                    };
                    const bundle = await postResource('Serial and Batch Bundle', bundleData);
                    bundleName = bundle.name;
                }

                if ((item.has_batch_no || item.has_serial_no) && !bundleName) {
                    throw new Error(`Please add Serial and Batch numbers for Item ${item.id} before saving.`);
                }

                const row: any = {
                    item_code: item.id,
                    warehouse: item.warehouse?.id,
                    qty: item.totalQty,
                    use_serial_and_batch_bundle: bundleName ? 1 : 0,
                    serial_no: "",
                    batch_no: ""
                };

                // Inject selected inventory dimensions
                if (item.dimensionValues) {
                    inventoryDimention.forEach(dim => {
                        const val = item.dimensionValues[dim.target_fieldname];
                        if (val) {
                            if (dim.source_fieldname) row[dim.source_fieldname] = val;
                            if (dim.target_fieldname) row[dim.target_fieldname] = val;
                        }
                    });
                }

                if (bundleName) {
                    row.serial_and_batch_bundle = bundleName;
                }
                return row;
            }))).filter(item => item !== null);

            if (finalItems.length === 0) {
                showError('No items have been counted to save as draft');
                return;
            }

            const reconDoc = {
                doctype: 'Stock Reconciliation',
                purpose: 'Stock Reconciliation',
                company: activeCompany || company,
                warehouse: selectedWarehouse?.id,
                set_warehouse: selectedWarehouse?.id,
                items: finalItems,
                docstatus: 0,
                custom_remarks: 'test'
            };

            const res = await postResource('Stock Reconciliation', reconDoc);
            setDraftRecon(res);
            showSuccess('Draft Stock Reconciliation created successfully');
        } catch (err: any) {
            console.error('Save Draft error:', err);
            let msg = err.message || 'Failed to save draft';
            if (msg.includes('None of the items have any change in quantity or value')) {
                msg = 'No adjustment needed: The counted quantity matches the current system stock perfectly.';
            }
            showError(msg);
        }
    };

    const handleSubmitRecon = async () => {
        if (!draftRecon) return;
        try {
            await postResource('Stock Reconciliation', {
                ...draftRecon,
                docstatus: 1
            }, {
                method: 'PUT',
                name: draftRecon.name
            } as any);

            showSuccess('Stock Reconciliation submitted successfully');
            setIsSubmit(true);
        } catch (err: any) {
            console.error('Submit error:', err);
            showError(err.message || 'Failed to submit reconciliation');
        }
    };

    const updateBatch = (index: number, field: string, value: any) => {
        const newBatches = [...batches];
        newBatches[index] = { ...newBatches[index], [field]: value };
        setBatches(newBatches);

        if (field === 'batchNumber') {
            setActiveBatchIndex(index);
            if (batchSearchTimer) clearTimeout(batchSearchTimer);
            const timer = setTimeout(() => {
                if (selectedItem?.type?.toLowerCase() === 'serial') {
                    searchAvailableSerials(value);
                } else if (selectedItem?.type?.toLowerCase() === 'batch') {
                    searchAvailableBatches(value);
                }
            }, 300);
            setBatchSearchTimer(timer);
        }
    };

    const searchAvailableBatches = async (q: string) => {
        if (!selectedItem || !selectedWarehouse) return;
        setIsSearchingBatches(true);
        try {
            const results = await callMethod('erpnext.controllers.queries.get_batch_no', {
                doctype: 'Batch',
                txt: q,
                searchfield: 'name',
                start: 0,
                page_len: 20,
                filters: {
                    item_code: selectedItem.id,
                    warehouse: selectedWarehouse.id,
                    posting_date: new Date().toISOString().split('T')[0]
                }
            });
            // Results format: [[name, balance_with_uom], ...]
            setAvailableBatchDetails(results.map((r: any) => ({
                name: r[0],
                balance: r[1]
            })) || []);
        } catch (err) {
            console.warn('Batch search error:', err);
        } finally {
            setIsSearchingBatches(false);
        }
    };

    const searchAvailableSerials = async (q: string) => {
        if (!selectedItem || !selectedWarehouse) return;
        setIsSearchingBatches(true);
        try {
            const results = await getResource('Serial No', undefined, {
                filters: JSON.stringify([
                    ['item_code', '=', selectedItem.id],
                    ['warehouse', '=', selectedWarehouse.id],
                    ['name', 'like', `%${q}%`]
                ]),
                fields: '["name"]',
                limit_page_length: 20
            });
            setAvailableBatchDetails(results.map((r: any) => ({
                name: r.name,
                balance: '1.0'
            })) || []);
        } catch (err) {
            console.warn('Serial search error:', err);
        } finally {
            setIsSearchingBatches(false);
        }
    };



    const addBatch = () => {
        setBatches([
            ...batches,
            {
                id: Date.now(),
                batchNumber: '',
                quantity: '',
                expiryDate: null,
                showCal: false
            }
        ]);
    };

    const removeBatch = (index: number) => {
        setBatches(batches.filter((_, i) => i !== index));
    };

    const handleAddItem = () => {
        if (!selectedItem) return;

        for (const dim of inventoryDimention) {
            if (dim.reqd && !dimensionValues[dim.target_fieldname]) {
                showError(`Please enter a value for ${dim.dimension_name || dim.document_type}`);
                return;
            }
        }

        const updatedItem = {
            ...selectedItem,
            warehouse: selectedWarehouse,
            batches: [...batches],
            totalQty: totalQty,
            dimensionValues: { ...dimensionValues }
        };

        if (editingIndex !== null) {
            const newCountedItems = [...countedItems];
            newCountedItems[editingIndex] = updatedItem;
            setCountedItems(newCountedItems);
            setEditingIndex(null);
            setCurrentStep(3); // Go back to review
        } else {
            setCountedItems([...countedItems, updatedItem]);
            if (type === 'single-warehouse') {
                setCurrentStep(1);
            } else {
                setSelectedWarehouse(null);
                setCurrentStep(0);
            }
        }

        // Reset state for next item
        setSelectedItem(null);
        setBatches([]);
        setSearchQuery('');
        setDimensionValues({});
        setDimensionSearch({});
    };

    const handleEditItem = (index: number) => {
        const item = countedItems[index];
        setSelectedItem(item);
        setSelectedWarehouse(item.warehouse);
        setBatches([...item.batches]);
        setDimensionValues(item.dimensionValues || {});
        setEditingIndex(index);
        setCurrentStep(2);
    };

    const removeCountedItem = (index: number) => {
        setCountedItems(countedItems.filter((_, i) => i !== index));
    };

    const onDateChange = (index: number, event: any, selectedDate?: Date) => {
        updateBatch(index, 'showCal', false);
        if (selectedDate) {
            updateBatch(index, 'expiryDate', selectedDate);
        }
    };

    const totalQty = selectedItem?.type?.toLowerCase() === 'serial'
        ? batches.filter(b => b.batchNumber.trim() !== '').length
        : batches.reduce(
            (sum, b) => sum + (parseFloat(b.quantity) || 0),
            0
        );

    const isMulti = type === 'multi-warehouse';
    const isSingle = type === 'single-warehouse';

    const renderStepContent = () => {
        if (currentStep === 0) {
            return (
                <View style={{ flex: 1, width: '100%' }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        {/* Counted Items List */}
                        {countedItems.length > 0 && (
                            <View style={styles.countedSection}>
                                <TouchableOpacity
                                    style={styles.reviewButtonTop}
                                    onPress={() => setCurrentStep(3)}
                                >
                                    <Text style={styles.reviewButtonTopText}>Review ({countedItems.length} items)</Text>
                                </TouchableOpacity>

                                <Text style={styles.countedSectionTitle}>Items Counted ({countedItems.length})</Text>
                                {countedItems.map((item, index) => (
                                    <View key={index} style={styles.countedItemCard}>
                                        <View style={styles.countedItemContent}>
                                            <Text style={styles.countedItemName}>{item.name}</Text>
                                            <Text style={styles.countedItemDetail}>
                                                Counted: {item.totalQty} Pcs • {item.warehouse?.id || 'N/A'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.removeCountedItemBtn}
                                            onPress={() => removeCountedItem(index)}
                                        >
                                            <X size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Search */}
                        <View style={styles.searchSection}>
                            <GlobalSearchInput
                                value={searchQuery}
                                onChangeText={handleSearch}
                                placeholder={isMulti ? "Search or scan item..." : "Search or scan warehouse..."}
                                onScan={() => requestScanner()}
                            />
                        </View>

                        {/* List */}
                        <View style={styles.listContainer}>
                            {isMulti ? (
                                <>
                                    {items.map((item, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={styles.listItem}
                                            onPress={() => {
                                                setSelectedItem(item);
                                                setCurrentStep(1);
                                                setSearchQuery('');
                                                fetchWarehouses();
                                                // Initialize default batch for non-tracked items
                                                if (!item.type) {
                                                    setBatches([{ id: Date.now().toString(), batchNumber: '', quantity: '', expiryDate: undefined, showCal: false }]);
                                                }
                                            }}
                                        >
                                            <View style={styles.listContent}>
                                                <View style={styles.listHeaderRow}>
                                                    <LinearGradient colors={['rgba(118, 52, 188, 0.12)', 'rgba(76, 29, 149, 0.12)']} style={[styles.iconContainer, { width: 32, height: 32, borderRadius: 8, marginRight: 12 }]}>
                                                        <Layers size={16} color="#7634bc" />
                                                    </LinearGradient>
                                                    <Text style={styles.listTitle}>{item.name}</Text>
                                                    {item.type && (
                                                        <View style={[styles.badge, item.type === 'Batch' ? { backgroundColor: '#fff7ed', borderColor: '#ffedd5' } : { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                                                            <Text style={[styles.badgeText, item.type === 'Batch' ? { color: '#ea580c' } : { color: '#16a34a' }]}>{item.type}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.listSubtitle}>{item.id}</Text>
                                            </View>
                                            <ChevronRight size={20} color="#cbd5e1" />
                                        </TouchableOpacity>
                                    ))}
                                    {(itemPage > 1 || hasMoreItems) && (
                                        <NumberedPagination
                                            currentPageIndex={itemPage}
                                            hasMore={hasMoreItems}
                                            onNext={() => fetchItems(searchQuery, itemPage + 1)}
                                            onPrev={() => fetchItems(searchQuery, itemPage - 1)}
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    {warehouses.map((wh, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={styles.listItem}
                                            onPress={() => {
                                                setSelectedWarehouse(wh as any);
                                                setCurrentStep(1);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <LinearGradient colors={['rgba(59, 130, 246, 0.12)', 'rgba(37, 99, 235, 0.12)']} style={styles.iconContainer}>
                                                <Building2 size={24} color="#3b82f6" />
                                            </LinearGradient>
                                            <View style={styles.listContent}>
                                                <Text style={styles.listTitle}>{wh.name}</Text>
                                                <Text style={styles.listSubtitle}>{wh.id}</Text>
                                            </View>
                                            <ChevronRight size={20} color="#cbd5e1" />
                                        </TouchableOpacity>
                                    ))}
                                    {(warehousePage > 1 || hasMoreWarehouses) && (
                                        <NumberedPagination
                                            currentPageIndex={warehousePage}
                                            hasMore={hasMoreWarehouses}
                                            onNext={() => fetchWarehouses(searchQuery, warehousePage + 1)}
                                            onPrev={() => fetchWarehouses(searchQuery, warehousePage - 1)}
                                        />
                                    )}
                                </>
                            )}
                        </View>
                    </ScrollView>

                    {/* Review Button */}
                    {countedItems.length > 0 && currentStep === 0 && (
                        <View style={styles.bottomButtonsContainer}>
                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: '#7634bc' }]}
                                onPress={() => setCurrentStep(3)}
                            >
                                <Text style={styles.primaryButtonText}>Review ({countedItems.length} items)</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            );
        }

        if (currentStep == 1) {
            if (isMulti) { // Warehouse selection for multi-warehouse
                return (
                    <View style={{ flex: 1, width: '100%' }}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                            {/* Selected Item Card */}
                            <View style={styles.selectedItemCard}>
                                <View style={styles.listContent}>
                                    <Text style={styles.selectedItemTitle}>{selectedItem?.name}</Text>
                                    <Text style={styles.selectedItemSubtitle}>{selectedItem?.id}</Text>
                                </View>
                            </View>

                            {/* Search Warehouse */}
                            <View style={styles.searchSection}>
                                <GlobalSearchInput
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    placeholder={t('search_or_scan_wareh', "Search or scan warehouse...")}
                                    onScan={() => requestScanner()}
                                />
                            </View>

                            {/* Warehouse List */}
                            <View style={styles.listContainer}>
                                {warehouses.map((wh, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.listItem}
                                        onPress={() => {
                                            setSelectedWarehouse(wh as any);
                                            setCurrentStep(2);
                                            setSearchQuery('');
                                            // Initialize default batch for non-tracked items
                                            if (!selectedItem?.type) {
                                                setBatches([{ id: Date.now().toString(), batchNumber: '', quantity: '', expiryDate: undefined, showCal: false }]);
                                            }
                                        }}
                                    >
                                        <LinearGradient colors={['rgba(59, 130, 246, 0.12)', 'rgba(37, 99, 235, 0.12)']} style={styles.iconContainer}>
                                            <Building2 size={24} color="#3b82f6" />
                                        </LinearGradient>
                                        <View style={styles.listContent}>
                                            <Text style={styles.listTitle}>{wh.name}</Text>
                                            <Text style={styles.listSubtitle}>{wh.id}</Text>
                                        </View>
                                        <ChevronRight size={20} color="#cbd5e1" />
                                    </TouchableOpacity>
                                ))}
                                {(warehousePage > 1 || hasMoreWarehouses) && (
                                    <NumberedPagination
                                        currentPageIndex={warehousePage}
                                        hasMore={hasMoreWarehouses}
                                        onNext={() => fetchWarehouses(searchQuery, warehousePage + 1)}
                                        onPrev={() => fetchWarehouses(searchQuery, warehousePage - 1)}
                                    />
                                )}
                            </View>
                        </ScrollView>
                    </View>
                );
            } else { // Scan Item for single-warehouse
                return (
                    <View style={{ flex: 1, width: '100%' }}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                            {/* Counted Items List (for Single Warehouse) */}
                            {countedItems.length > 0 && (
                                <View style={styles.countedSection}>
                                    <TouchableOpacity
                                        style={styles.reviewButtonTop}
                                        onPress={() => setCurrentStep(3)}
                                    >
                                        <Text style={styles.reviewButtonTopText}>Review ({countedItems.length} items)</Text>
                                    </TouchableOpacity>

                                    <Text style={styles.countedSectionTitle}>Items Counted ({countedItems.length})</Text>
                                    {countedItems.map((item, index) => (
                                        <View key={index} style={styles.countedItemCard}>
                                            <View style={styles.countedItemContent}>
                                                <Text style={styles.countedItemName}>{item.name}</Text>
                                                <Text style={styles.countedItemDetail}>
                                                    Counted: {item.totalQty} Pcs • {item.warehouse?.id || 'N/A'}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.removeCountedItemBtn}
                                                onPress={() => removeCountedItem(index)}
                                            >
                                                <X size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Search */}
                            <View style={styles.searchSection}>
                                <GlobalSearchInput
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    placeholder={t('search_or_scan_item', "Search or scan item...")}
                                    onScan={() => requestScanner()}
                                />
                            </View>

                            {/* List */}
                            <View style={styles.listContainer}>
                                {items.map((item, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.listItem}
                                        onPress={() => {
                                            setSelectedItem(item);
                                            setCurrentStep(2);
                                            setSearchQuery('');
                                            // Initialize default batch for non-tracked items
                                            if (!item.type) {
                                                setBatches([{ id: Date.now().toString(), batchNumber: '', quantity: '', expiryDate: undefined, showCal: false }]);
                                            }
                                        }}
                                    >
                                        <View style={styles.listContent}>
                                            <View style={styles.listHeaderRow}>
                                                <LinearGradient colors={['rgba(118, 52, 188, 0.12)', 'rgba(76, 29, 149, 0.12)']} style={[styles.iconContainer, { width: 32, height: 32, borderRadius: 8, marginRight: 12 }]}>
                                                    <Layers size={16} color="#7634bc" />
                                                </LinearGradient>
                                                <Text style={styles.listTitle}>{item.name}</Text>
                                                {item.type && (
                                                    <View style={[styles.badge, item.type === 'Batch' ? { backgroundColor: '#fff7ed', borderColor: '#ffedd5' } : { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                                                        <Text style={[styles.badgeText, item.type === 'Batch' ? { color: '#ea580c' } : { color: '#16a34a' }]}>{item.type}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.listSubtitle}>{item.id}</Text>
                                        </View>
                                        <ChevronRight size={20} color="#cbd5e1" />
                                    </TouchableOpacity>
                                ))}
                                {(itemPage > 1 || hasMoreItems) && (
                                    <NumberedPagination
                                        currentPageIndex={itemPage}
                                        hasMore={hasMoreItems}
                                        onNext={() => fetchItems(searchQuery, itemPage + 1)}
                                        onPrev={() => fetchItems(searchQuery, itemPage - 1)}
                                    />
                                )}
                            </View>
                        </ScrollView>
                    </View>
                );
            }
        }

        if (currentStep == 2) { // Input Qty / Batch Details
            return (
                <View style={{ flex: 1, width: '100%' }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        {/* Consolidated Item Card */}
                        <View style={styles.selectedItemCard}>
                            <View style={styles.summaryHeader}>
                                <Text style={styles.selectedItemTitle}>{selectedItem?.name}</Text>
                                {selectedItem?.type && (
                                    <View style={[styles.typeBadge, selectedItem.type === 'Batch' ? { backgroundColor: '#fff7ed', borderColor: '#ffedd5' } : { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                                        <Text style={[styles.typeBadgeText, selectedItem.type === 'Batch' ? { color: '#ea580c' } : { color: '#16a34a' }]}>{selectedItem.type} Tracked</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.selectedItemSubtitle}>{selectedItem?.id}</Text>

                            <View style={styles.summaryWarehouse}>
                                <Building2 size={14} color="#64748b" />
                                <Text style={styles.summaryWarehouseText}>{(selectedWarehouse as any)?.id}</Text>
                            </View>

                            {/* Integrated Quantity Selector - Only for Non-Serial Items */}
                            {selectedItem?.type?.toLowerCase() !== 'serial' && (
                                <View style={styles.inlineQtyContainer}>
                                    <TouchableOpacity
                                        style={styles.inlineQtyBtn}
                                        onPress={() => {
                                            if (batches.length > 0) {
                                                const current = parseFloat(batches[0].quantity) || 0;
                                                updateBatch(0, 'quantity', Math.max(0, current - 1).toString());
                                            } else {
                                                setBatches([{ id: Date.now().toString(), batchNumber: '', quantity: '0', expiryDate: undefined, showCal: false }]);
                                            }
                                        }}
                                    >
                                        <Minus size={14} color="#4c1d95" />
                                    </TouchableOpacity>

                                    <TextInput
                                        style={styles.inlineQtyInput}
                                        keyboardType="numeric"
                                        value={batches.length > 0 ? batches[0].quantity : '0'}
                                        underlineColorAndroid="transparent"
                                        onChangeText={(val) => {
                                            if (batches.length > 0) {
                                                updateBatch(0, 'quantity', val);
                                            } else {
                                                setBatches([{ id: Date.now().toString(), batchNumber: '', quantity: val, expiryDate: undefined, showCal: false }]);
                                            }
                                        }}
                                    />

                                    <TouchableOpacity
                                        style={styles.inlineQtyBtn}
                                        onPress={() => {
                                            if (batches.length > 0) {
                                                const current = parseFloat(batches[0].quantity) || 0;
                                                updateBatch(0, 'quantity', (current + 1).toString());
                                            } else {
                                                setBatches([{ id: Date.now().toString(), batchNumber: '', quantity: '1', expiryDate: undefined, showCal: false }]);
                                            }
                                        }}
                                    >
                                        <Plus size={14} color="#4c1d95" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Action Button inside Card */}
                            {(selectedItem?.has_batch_no || selectedItem?.has_serial_no) && (
                                <TouchableOpacity
                                    style={styles.integratedActionBtn}
                                    onPress={() => {
                                        if (selectedItem?.has_serial_no || selectedItem?.type?.toLowerCase() === 'serial') {
                                            setIsSerialModalOpen(true);
                                        } else {
                                            setIsModalOpen(true);
                                        }
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Layers size={16} color="#64748b" />
                                        <Text style={styles.integratedActionText}>
                                            {(selectedItem?.has_serial_no || selectedItem?.type?.toLowerCase() === 'serial') ? 'Enter Serial Numbers' : 'Enter Batch Details'}
                                        </Text>
                                    </View>
                                    <ChevronRight size={16} color="#cbd5e1" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Dimensions Block exactly like in receive.tsx */}
                        {inventoryDimention.length > 0 && (
                            <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                    <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                        <Layers size={14} color="#7c3aed" />
                                    </View>
                                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1e293b' }}>
                                        Inventory Dimensions
                                    </Text>
                                </View>

                                {inventoryDimention.map((dim: any) => (
                                    <View key={dim.target_fieldname} style={{ marginBottom: 16, position: 'relative', zIndex: showDimDropdown === dim.target_fieldname ? 10 : 1 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#475569', marginBottom: 6 }}>
                                            {dim.dimension_name || dim.document_type} {dim.reqd ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
                                        </Text>

                                        <View style={[{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 0 }]}>
                                            <Search size={20} color="#94a3b8" />
                                            <TextInput
                                                style={{ flex: 1, height: "100%", fontSize: 15, color: "#1e293b", paddingLeft: 8 }}
                                                placeholder={`Search ${dim.dimension_name || dim.document_type}...`}
                                                placeholderTextColor="#94a3b8"
                                                value={dimensionValues[dim.target_fieldname] || dimensionSearch[dim.target_fieldname] || ''}
                                                onChangeText={(text) => handleDimensionSearch(dim.target_fieldname, dim.reference_document, text)}
                                                onFocus={() => {
                                                    if (!dimensionOptions[dim.target_fieldname] || dimensionOptions[dim.target_fieldname].length === 0) {
                                                        handleDimensionSearch(dim.target_fieldname, dim.reference_document, '');
                                                    } else {
                                                        setShowDimDropdown(dim.target_fieldname);
                                                    }
                                                }}
                                            />
                                            {dimensionValues[dim.target_fieldname] && (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setDimensionValues(prev => ({ ...prev, [dim.target_fieldname]: '' }));
                                                        setDimensionSearch(prev => ({ ...prev, [dim.target_fieldname]: '' }));
                                                    }}
                                                    style={{ marginRight: 8, padding: 4 }}
                                                >
                                                    <X size={18} color="#94a3b8" />
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (showDimDropdown === dim.target_fieldname) {
                                                        setShowDimDropdown(null);
                                                    } else {
                                                        if (!dimensionOptions[dim.target_fieldname] || dimensionOptions[dim.target_fieldname].length === 0) {
                                                            handleDimensionSearch(dim.target_fieldname, dim.reference_document, '');
                                                        } else {
                                                            setShowDimDropdown(dim.target_fieldname);
                                                        }
                                                    }
                                                }}
                                                style={{ marginRight: 8, padding: 4 }}
                                            >
                                                <ChevronDown size={20} color="#64748b" />
                                            </TouchableOpacity>
                                        </View>

                                        {showDimDropdown === dim.target_fieldname && (
                                            <View style={{
                                                position: 'absolute',
                                                top: 75,
                                                left: 0,
                                                right: 0,
                                                backgroundColor: '#fff',
                                                borderRadius: 12,
                                                borderWidth: 1,
                                                borderColor: '#e2e8f0',
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 12,
                                                elevation: 8,
                                                zIndex: 999,
                                                maxHeight: 200,
                                                overflow: 'hidden'
                                            }}>
                                                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                    {(dimensionOptions[dim.target_fieldname] || []).slice(0, 50).map((opt: any, idx: number) => (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            style={{
                                                                flexDirection: 'row', alignItems: 'center',
                                                                padding: 12,
                                                                borderBottomWidth: idx < (dimensionOptions[dim.target_fieldname].length - 1) ? 1 : 0,
                                                                borderBottomColor: '#f1f5f9'
                                                            }}
                                                            onPress={() => {
                                                                setDimensionSearch(prev => ({ ...prev, [dim.target_fieldname]: '' }));
                                                                setDimensionValues(prev => ({ ...prev, [dim.target_fieldname]: opt.name }));
                                                                setShowDimDropdown(null);
                                                            }}
                                                        >
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ fontSize: 15, fontWeight: '500', color: '#1e293b' }}>{opt.name}</Text>
                                                            </View>
                                                            {dimensionValues[dim.target_fieldname] === opt.name && (
                                                                <Check size={18} color="#10b981" />
                                                            )}
                                                        </TouchableOpacity>
                                                    ))}
                                                    {(dimensionOptions[dim.target_fieldname] || []).length === 0 && (
                                                        <View style={{ padding: 16, alignItems: 'center' }}>
                                                            <Text style={{ color: '#94a3b8' }}>No options found</Text>
                                                        </View>
                                                    )}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>

                    {/* Batch Details Modal */}
                    <Modal visible={isModalOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setIsModalOpen(false)}>
                        <View style={styles.modalOverlay}>
                            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsModalOpen(false)} />
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                                style={styles.keyboardAvoidingViewContainer}
                            >
                                <View style={styles.modalContent}>
                                    {/* Header */}
                                <View style={styles.modalHeader}>
                                    <View style={styles.modalHeaderLeft}>
                                        <View style={styles.modalHeaderIcon}>
                                            <Layers size={22} color="#4c1d95" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.modalTitle} numberOfLines={1}>
                                                {selectedItem?.name}
                                            </Text>
                                            <Text style={styles.modalSubtitle}>
                                                Item ID: {selectedItem?.id}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.closeButton}
                                        onPress={() => setIsModalOpen(false)}
                                    >
                                        <X size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>

                                {/* Total Quantity Row */}
                                <View style={styles.totalQtyRow}>
                                    <View>
                                        <Text style={styles.totalQtyLabel}>{t('total_quantity', 'Total Quantity')}</Text>
                                        <Text style={styles.totalQtySubLabel}>{t('sum_of_all_entered_c', 'Sum of all entered counts')}</Text>
                                    </View>
                                    <View style={styles.totalQtyBadge}>
                                        <Text style={styles.totalQtyValue}>{totalQty} Pcs</Text>
                                    </View>
                                </View>



                                {/* Batches List */}
                                <ScrollView style={styles.batchesList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                        {batches.map((batch, index) => (
                                            <View key={batch.id} style={[styles.batchCard, activeBatchIndex === index && { zIndex: 10000 }]}>

                                                <View style={styles.batchCardHeader}>
                                                    <Text style={styles.batchLabel}>
                                                        {selectedItem?.type?.toLowerCase() === 'serial' ? 'Serial' : 'Batch'} {index + 1}
                                                    </Text>
                                                    {batches.length > 1 && (
                                                        <TouchableOpacity onPress={() => removeBatch(index)}>
                                                            <X size={18} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>

                                                <View style={[styles.inputGroup, activeBatchIndex === index && { zIndex: 12000 }]}>
                                                    <Text style={styles.inputLabel}>
                                                        {selectedItem.type}
                                                    </Text>
                                                    <GlobalSearchInput
                                                        value={batch.batchNumber}
                                                        onChangeText={(val) => updateBatch(index, 'batchNumber', val)}
                                                        placeholder="Scan or enter batch number"
                                                        onFocus={() => {
                                                            setActiveBatchIndex(index);
                                                            setAvailableBatchDetails([]); // Clear stale results
                                                            if (selectedItem?.type?.toLowerCase() === 'batch') {
                                                                searchAvailableBatches(batch.batchNumber);
                                                            }
                                                        }}
                                                        onScan={() => requestScanner({ type: 'batch', index })}
                                                        containerStyle={[
                                                            { flex: 1, backgroundColor: '#f8fafc', height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
                                                            activeBatchIndex === index && { zIndex: 11000, borderColor: '#4c1d95' }
                                                        ]}
                                                    />
                                                        {activeBatchIndex === index && (
                                                            <View style={styles.dropdownContainer}>
                                                                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                                                                    {isSearchingBatches ? (
                                                                        <View style={{ padding: 15, alignItems: 'center' }}>
                                                                            <ActivityIndicator size="small" color="#4c1d95" />
                                                                        </View>
                                                                    ) : availableBatchDetails.length > 0 ? (
                                                                        availableBatchDetails.map((item, i) => (
                                                                            <TouchableOpacity
                                                                                key={i}
                                                                                style={styles.dropdownItem}
                                                                                onPress={() => {
                                                                                    updateBatch(index, 'batchNumber', item.name);
                                                                                    setAvailableBatchDetails([]);
                                                                                    setActiveBatchIndex(null);
                                                                                }}
                                                                            >
                                                                                <View>
                                                                                    <Text style={styles.dropdownItemText}>{item.name}</Text>
                                                                                    <Text style={styles.dropdownItemBalance}>{item.balance}</Text>
                                                                                </View>
                                                                                <Plus size={16} color="#4c1d95" />
                                                                            </TouchableOpacity>
                                                                        ))
                                                                    ) : (
                                                                        <View style={{ padding: 15, alignItems: 'center' }}>
                                                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>{t('no_results_found', 'No results found')}</Text>
                                                                        </View>
                                                                    )}
                                                                </ScrollView>
                                                            </View>
                                                        )}
                                                </View>

                                                <View style={styles.row}>
                                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                                        <Text style={styles.inputLabel}>{t('quantity', 'Quantity')}</Text>
                                                        <TextInput
                                                            style={[styles.modalInput, selectedItem?.type?.toLowerCase() === 'serial' && { backgroundColor: '#f1f5f9', color: '#94a3b8' }]}
                                                            placeholder="Enter qty"
                                                            keyboardType="numeric"
                                                            value={selectedItem?.type?.toLowerCase() === 'serial' ? '1' : batch.quantity}
                                                            editable={selectedItem?.type !== 'serial'}
                                                            onChangeText={(val) => updateBatch(index, 'quantity', val)}
                                                        />
                                                    </View>
                                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                                        <Text style={styles.inputLabel}>{t('expiry_date', 'Expiry Date')}</Text>


                                                        <TouchableOpacity
                                                            style={styles.inputWrapper}
                                                            onPress={() => updateBatch(index, 'showCal', true)}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <Text style={styles.textInput}>
                                                                    {batch.expiryDate
                                                                        ? batch.expiryDate.toLocaleDateString('en-GB')
                                                                        : 'dd/mm/yyyy'}
                                                                </Text>
                                                                <Calendar size={18} color="#94a3b8" />
                                                            </View>
                                                        </TouchableOpacity>

                                                        {/* Date Picker */}
                                                        {batch.showCal && (
                                                            Platform.OS === 'web' ? (
                                                                <input
                                                                    type="date"
                                                                    style={{
                                                                        position: 'absolute',
                                                                        opacity: 0,
                                                                        width: '100%',
                                                                        height: '100%',
                                                                    }}
                                                                    autoFocus
                                                                    onChange={(e) =>
                                                                        onDateChange(
                                                                            index,
                                                                            {},
                                                                            e.target.value ? new Date(e.target.value) : undefined
                                                                        )
                                                                    }
                                                                    onBlur={() => updateBatch(index, 'showCal', false)}
                                                                />
                                                            ) : (
                                                                <View />
                                                            )
                                                        )}
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    {/*   make copy of batches  */}
                                    <TouchableOpacity style={styles.addBatchBtn} onPress={addBatch}>
                                        <Text style={styles.addBatchText}>
                                            + Add {selectedItem.type}
                                        </Text>
                                    </TouchableOpacity>
                                </ScrollView>

                                <View style={styles.modalFooter}>
                                    <TouchableOpacity
                                        style={styles.modalSecondaryBtn}
                                        onPress={() => setIsModalOpen(false)}
                                    >
                                        <Text style={styles.modalSecondaryBtnText}>{t('cancel', 'Cancel')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.modalPrimaryBtn,
                                            { backgroundColor: totalQty > 0 ? '#7634bc' : '#cbd5e1' }
                                        ]}
                                        disabled={totalQty <= 0}
                                        onPress={() => {
                                            const itemsCopy = [...countedItems];
                                            const idx = itemsCopy.findIndex(i => i.id === selectedItem.id);
                                            const itemData = {
                                                ...selectedItem,
                                                quantity: totalQty,
                                                batches: batches.filter(b => b.batchNumber && b.quantity)
                                            };
                                            if (idx >= 0) {
                                                itemsCopy[idx] = itemData;
                                            } else {
                                                itemsCopy.push(itemData);
                                            }
                                            setCountedItems(itemsCopy);
                                            setIsModalOpen(false);
                                        }}
                                    >
                                        <Text style={styles.modalPrimaryBtnText}>Save ({totalQty} Pcs)</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            </KeyboardAvoidingView>
                        </View>
                    </Modal>

                    {/* Serial Numbers Modal */}
                    <Modal visible={isSerialModalOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setIsSerialModalOpen(false)}>
                        <View style={styles.modalOverlay}>
                            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsSerialModalOpen(false)} />
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                                style={styles.keyboardAvoidingViewContainer}
                            >
                                <View style={styles.modalContent}>
                                    {/* Header */}
                                    <View style={styles.modalHeader}>
                                        <View style={styles.modalHeaderLeft}>
                                            <View style={styles.modalHeaderIcon}>
                                                <Calculator size={22} color="#4c1d95" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.modalTitle} numberOfLines={1}>{t('serial_numbers', 'Serial Numbers')}</Text>
                                                <Text style={styles.modalSubtitle} numberOfLines={1}>{selectedItem?.name}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.closeButton}
                                            onPress={() => setIsSerialModalOpen(false)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            accessibilityLabel="Close serial modal"
                                        >
                                            <X size={20} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Stats Bar */}
                                    <View style={styles.serialsStatsBar}>
                                        <Text style={styles.statsLabel}>{t('serials_added', 'Serials Added')}</Text>
                                        <Text style={styles.statsValue}>{batches.filter(b => b.batchNumber.trim() !== '').length}</Text>
                                    </View>

                                    {/* Serial List */}
                                    <ScrollView 
                                        style={styles.batchesList} 
                                        contentContainerStyle={{ paddingBottom: 20 }}
                                        showsVerticalScrollIndicator={false} 
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {batches.length === 0 ? (
                                            <View style={styles.emptySerialsContainer}>
                                                <Hash size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
                                                <Text style={styles.emptySerialsTitle}>{t('no_serial_numbers_ad', 'No serial numbers added yet')}</Text>
                                                <Text style={styles.emptySerialsSubtitle}>{t('add_serial_numbers_m', 'Add serial numbers manually or use the scanner icon')}</Text>
                                            </View>
                                        ) : (
                                            batches.map((batch, index) => {
                                                return (
                                                    <View key={batch.id} style={[styles.serialInputRow, activeBatchIndex === index && { zIndex: 10000 }]}>
                                                        <View style={styles.checkCircle}>
                                                            <Check size={14} color="#94a3b8" />
                                                        </View>
                                                        <GlobalSearchInput
                                                            value={batch.batchNumber}
                                                            onChangeText={(val) => updateBatch(index, 'batchNumber', val)}
                                                            placeholder="Serial number"
                                                            onFocus={() => {
                                                                setActiveBatchIndex(index);
                                                                setAvailableBatchDetails([]); // Clear stale results
                                                                if (selectedItem?.type?.toLowerCase() === 'serial') {
                                                                    searchAvailableSerials(batch.batchNumber);
                                                                }
                                                            }}
                                                            onScan={() => requestScanner({ type: 'serial', index })}
                                                            containerStyle={[
                                                                { flex: 1, backgroundColor: '#f8fafc', height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
                                                                activeBatchIndex === index && { zIndex: 11000, borderColor: '#4c1d95' }
                                                            ]}
                                                        />
                                                        {activeBatchIndex === index && (
                                                            <View style={styles.dropdownContainer}>
                                                                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                                                                    {isSearchingBatches ? (
                                                                        <View style={{ padding: 15, alignItems: 'center' }}>
                                                                            <ActivityIndicator size="small" color="#4c1d95" />
                                                                        </View>
                                                                    ) : availableBatchDetails.length > 0 ? (
                                                                        availableBatchDetails.map((item, i) => (
                                                                            <TouchableOpacity
                                                                                key={i}
                                                                                style={styles.dropdownItem}
                                                                                onPress={() => {
                                                                                    updateBatch(index, 'batchNumber', item.name);
                                                                                    setAvailableBatchDetails([]);
                                                                                    setActiveBatchIndex(null);
                                                                                }}
                                                                            >
                                                                                <View>
                                                                                    <Text style={styles.dropdownItemText}>{item.name}</Text>
                                                                                </View>
                                                                                <Plus size={16} color="#4c1d95" />
                                                                            </TouchableOpacity>
                                                                        ))
                                                                    ) : (
                                                                        <View style={{ padding: 15, alignItems: 'center' }}>
                                                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>{t('no_results_found', 'No results found')}</Text>
                                                                        </View>
                                                                    )}
                                                                </ScrollView>
                                                            </View>
                                                        )}
                                                        <TouchableOpacity
                                                            style={styles.trashBtn}
                                                            onPress={() => removeBatch(index)}
                                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                        >
                                                            <Trash2 size={20} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            })
                                        )}
                                        <TouchableOpacity
                                            style={styles.addSerialBtn}
                                            onPress={addBatch}
                                        >
                                            <Text style={styles.addSerialText}>{t('add_serial_number', '+ Add Serial Number')}</Text>
                                        </TouchableOpacity>
                                    </ScrollView>

                                    {/* Modal Footer */}
                                    <View style={styles.bottomButtonsContainer2}>
                                        <TouchableOpacity
                                            style={styles.secondaryButton}
                                            onPress={() => setIsSerialModalOpen(false)}
                                        >
                                            <Text style={styles.secondaryButtonText}>{t('cancel', 'Cancel')}</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.primaryButton,
                                                { backgroundColor: totalQty > 0 ? '#7634bc' : '#cbd5e1' }
                                            ]}
                                            onPress={() => setIsSerialModalOpen(false)}
                                            disabled={totalQty === 0}
                                        >
                                            <Text style={styles.primaryButtonText}>Save({totalQty}Pcs)</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    </Modal>
                    {/* Bottom Buttons */}
                    <View style={styles.bottomButtonsContainer}>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => setCurrentStep(0)}
                        >
                            <Text style={styles.secondaryButtonText}>{t('back', 'Back')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                { backgroundColor: '#7634bc' }
                            ]}
                            onPress={handleAddItem}
                        >
                            <Text style={styles.primaryButtonText}>
                                {editingIndex !== null ? 'Update Item' : 'Add Item'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        if (currentStep === 3) {
            return (
                <View style={{ flex: 1, width: '100%' }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        <View style={styles.reviewHeader}>
                            <Text style={styles.reviewTitle}>{t('final_review', 'Final Review')}</Text>
                            <Text style={styles.reviewSubtitle}>{countedItems.length} items ready to sync</Text>
                        </View>

                        {countedItems.map((item, index) => {
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.reviewItemCard}
                                    onPress={() => draftRecon?.docstatus >= 1 ? null : handleEditItem(index)}
                                    activeOpacity={draftRecon?.docstatus >= 1 ? 1 : 0.7}
                                >
                                    <View style={styles.reviewItemInfo}>
                                        <Text style={styles.reviewItemName}>{item.name}</Text>
                                        <Text style={styles.reviewItemId}>{item.id}</Text>
                                        <View style={styles.reviewItemMeta}>
                                            <View style={styles.miniBadge}>
                                                <Building2 size={10} color="#64748b" />
                                                <Text style={styles.miniBadgeText}>{item.warehouse?.id}</Text>
                                            </View>
                                            {item.type && (
                                                <View style={[styles.miniBadge, item.type === 'Batch' ? { backgroundColor: '#fff7ed', borderColor: '#ffedd5' } : { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                                                    <Layers size={10} color={item.type === 'Batch' ? '#ea580c' : '#16a34a'} />
                                                    <Text style={[styles.miniBadgeText, item.type === 'Batch' ? { color: '#ea580c' } : { color: '#16a34a' }]}>{item.type}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.reviewItemQtyContainer}>
                                        <Text style={styles.reviewItemQtyLabel}>{t('counted', 'Counted')}</Text>
                                        <Text style={styles.reviewItemQtyValue}>{item.totalQty}</Text>
                                        {!(draftRecon?.docstatus >= 1) && (
                                            <TouchableOpacity
                                                style={styles.reviewEditIcon}
                                                onPress={() => handleEditItem(index)}
                                            >
                                                <Plus size={16} color="#4c1d95" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {!(draftRecon?.docstatus >= 1) && (
                            <TouchableOpacity
                                style={styles.addMoreItemsBtn}
                                onPress={() => {
                                    setEditingIndex(null);
                                    if (type === 'single-warehouse') {
                                        setCurrentStep(1);
                                    } else {
                                        setCurrentStep(0);
                                    }
                                }}
                            >
                                <Plus size={20} color="#64748b" />
                                <Text style={styles.addMoreItemsText}>{t('add_more_items', 'Add More Items')}</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {draftRecon && (
                        <View style={styles.draftInfoCard}>
                            <View style={[styles.draftBadge, draftRecon.docstatus >= 1 && { backgroundColor: '#10b981' }]}>
                                <Text style={styles.draftBadgeText}>
                                    {draftRecon.docstatus === 1 ? 'SUBMITTED' : (draftRecon.docstatus === 2 ? 'CANCELLED' : t('draft', 'DRAFT'))}
                                </Text>
                            </View>
                            <Text style={styles.draftName}>{draftRecon.name}</Text>
                        </View>
                    )}

                    <View style={styles.bottomButtonsContainer}>
                        <TouchableOpacity
                            style={[
                                styles.primaryButton, 
                                { backgroundColor: draftRecon?.docstatus >= 1 ? '#94a3b8' : (draftRecon ? '#059669' : '#7634bc') }
                            ]}
                            onPress={draftRecon ? handleSubmitRecon : handleSaveDraft}
                            disabled={apiLoading || draftRecon?.docstatus >= 1}
                        >
                            {apiLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    {draftRecon?.docstatus >= 1 ? 'Submitted' : (draftRecon ? 'Submit Reconciliation' : 'Save as Draft')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return <View />;
    };

    const totalVariance = countedItems.reduce((sum, item) => sum + (item.totalQty - 500), 0);

    return (
        <Animated.View style={[styles.container, isSubmit && { backgroundColor: '#000' }]}>
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
            ) : (
                <>
                    {/* Header */}
                    <TopNavbar title="" showBackButton={false} />
                    {!isSubmit && (

                        <View style={styles.topHeaderActions}>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {isSubmit ? (
                        <View style={styles.successOverlay}>
                            <View style={styles.successContent}>
                                <View style={styles.successIconContainer}>
                                    <Check size={40} color="#10b981" />
                                </View>

                                <Text style={styles.successTitle}>{t('stock_count_submitte', 'Stock Count Submitted!')}</Text>

                                <Text style={styles.successSubtitle}>
                                    {countedItems.length} items reconciled with total variance of {totalVariance > 0 ? `+${totalVariance}` : totalVariance}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <>
                            {/* Stepper */}
                            <View style={styles.stepperHeader}>
                                {current.steps.map((step: string, index: number) => {
                                    const isActive = index === currentStep;
                                    const isCompleted = index < currentStep;
                                    const canNavigate = (() => {
                                        if (name) return true; // loaded existing draft
                                        if (index === currentStep) return true;
                                        if (index < currentStep) return true; // can always go back

                                        // going forward:
                                        if (isSingle) {
                                            if (index === 1) return !!selectedWarehouse;
                                            if (index === 2) return !!selectedWarehouse && !!selectedItem;
                                            if (index === 3) return countedItems.length > 0;
                                        } else { // isMulti
                                            if (index === 1) return !!selectedItem;
                                            if (index === 2) return !!selectedItem && !!selectedWarehouse;
                                            if (index === 3) return countedItems.length > 0;
                                        }
                                        return false;
                                    })();

                                    return (
                                        <React.Fragment key={index}>
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                disabled={!canNavigate}
                                                style={[
                                                    styles.stepItemWrapper,
                                                    !canNavigate && { opacity: 0.4 }
                                                ]}
                                                onPress={() => setCurrentStep(index)}
                                            >
                                                <View
                                                    style={[
                                                        styles.stepCircle,
                                                        isActive ? styles.stepActive : (isCompleted ? styles.stepCompleted : styles.stepPending)
                                                    ]}
                                                >
                                                    {isCompleted ? (
                                                        <Check size={18} color="#fff" />
                                                    ) : (
                                                        <Text style={[styles.stepText, isActive ? styles.stepTextActive : styles.stepTextPending]}>
                                                            {index + 1}
                                                        </Text>
                                                    )}
                                                </View>
                                                <Text style={[styles.stepLabel, isActive ? styles.stepLabelActive : (isCompleted ? styles.stepLabelCompleted : styles.stepLabelPending)]}>{step}</Text>
                                            </TouchableOpacity>

                                            {index < current.steps.length - 1 && (
                                                <View style={styles.stepLineContainer}>
                                                    <View style={[
                                                        styles.stepLine,
                                                        index < currentStep ? styles.stepCompletedLine : undefined
                                                    ]} />
                                                </View>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </View>

                            {/* Step Content */}
                            <View style={styles.content}>
                                {renderStepContent()}
                            </View>

                            {/* Floating Navigation Pill:reusable component */}

                            <FloatingPill
                                style={{ padding: 8, borderRadius: 30, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.45, shadowRadius: 15 }}
                                onBackPress={() => router.back()}
                                backIcon={<ArrowLeft size={18} color="#94a3b8" />}
                                leftLabel="ADJUST"
                                leftIcon={<Building2 size={18} color="#94a3b8" />}
                                rightLabel="COUNT"
                                rightIcon={<CalculatorIcon size={18} color="#fff" />}
                            />

                        </>
                    )}
                </>
            )}

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Cycle Count"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_cycle_count')) {
                        router.back();
                    }
                }}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({

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

    container: {
        flex: 1,

        backgroundColor: '#fff'
    },
    countedSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
        paddingTop: 16,
    },
    countedSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 16,
        marginTop: 8,
    },
    countedItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    countedItemContent: {
        flex: 1,
    },
    countedItemName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4c1d95',
        marginBottom: 4,
    },
    countedItemDetail: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    removeCountedItemBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },

    topHeaderActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: '#fff',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },

    // Stepper
    stepperHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },

    stepIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start'
    },

    stepItemWrapper: {
        alignItems: 'center',
        flex: 0,
        width: 76, // Generous width to prevent text wrap
    },

    stepCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },

    stepActive: {
        backgroundColor: '#4c1d95',
        borderWidth: 2,
        borderColor: '#ede9fe',
    },

    stepPending: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },

    stepText: {
        fontWeight: '700',
        fontSize: 15,
    },

    stepTextActive: {
        color: '#fff',
    },

    stepTextPending: {
        color: '#64748b',
    },

    stepLabel: {
        fontSize: 11,
        textAlign: 'center',
        fontWeight: '600',
        marginTop: 2,
    },

    stepLabelActive: {
        color: '#4c1d95',
    },

    stepLabelPending: {
        color: '#94a3b8',
    },

    stepCompleted: {
        backgroundColor: '#10b981',
        borderWidth: 1,
        borderColor: '#10b981',
    },

    stepLabelCompleted: {
        color: '#10b981',
    },

    stepLineContainer: {
        flex: 1,
        height: 36, // Matches the height of stepCircle to center perfectly
        justifyContent: 'center',
        marginHorizontal: -20, // Reaches exactly to the edge of the 36px circle inside the 76px wrapper
        zIndex: -1, // Renders behind the wrappers
    },

    stepLine: {
        height: 3,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
    },
    
    stepCompletedLine: {
        backgroundColor: '#10b981',
    },

    // Content
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },





    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    typeBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4c1d95',
    },
    summaryWarehouse: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    summaryWarehouseText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#4c1d95',
    },
    actionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 8,
        borderWidth: 1.5,
        borderColor: '#e0e0e0',
        marginTop: 10,
    },
    actionCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    actionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionCardTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#4c1d95',

    },
    bottomButtonsContainer: {
        flexDirection: 'row',
        gap: 8,
        height: 40,
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 90,
    },
    bottomButtonsContainer2: {
        flexDirection: 'row',
        gap: 8,
        height: 40,
        width: '100%',
        paddingHorizontal: 20,
        padding: 16
    },
    primaryButton: {
        flex: 1,
        height: 40,
        backgroundColor: '#7634bc',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '400', // Match user's font-weight if specified (Inter default)
        lineHeight: 24,
    },
    secondaryButton: {
        flex: 1,
        height: 40,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#7634bc',
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
    },
    bottomButtons: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },

    summaryBadge: {
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    summaryBadgeText: {
        color: '#10b981',
        fontSize: 11,
        fontWeight: '700',
    },

    // Batch Details Section
    batchDetailsSection: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginTop: 16,
    },
    batchDetailsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4c1d95',
        marginBottom: 16,
    },
    batchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    batchNumberText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4c1d95',
    },
    batchQtyText: {
        fontSize: 14,
        color: '#64748b',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    keyboardAvoidingViewContainer: {
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '90%',
        width: '100%',
        alignSelf: 'center',
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 25,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
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
        fontWeight: '800',
        color: '#4c1d95',
        fontFamily: Fonts.sans,
        letterSpacing: -0.5,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalQtyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    totalQtyLabel: {
        fontSize: 15,
        color: '#4c1d95',
        fontWeight: '700',
    },
    totalQtySubLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    totalQtyBadge: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    totalQtyValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#4c1d95',
    },
    batchesList: {
        flexShrink: 1,
    },
    batchCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    batchCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    batchLabel: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4c1d95',
        marginBottom: 8,
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        borderRadius: 14,
        paddingLeft: 12,
        height: 52,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    inputScanIcon: {
        width: 44,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9',
    },
    modalInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#4c1d95',
        fontWeight: '500',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    row: {
        flexDirection: 'row',
    },
    addBatchBtn: {
        height: 56,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: '#fff',
    },
    addBatchText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#4c1d95',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 16,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    modalPrimaryBtn: {
        flex: 1,
        height: 56,
        backgroundColor: '#7634bc',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalPrimaryBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    modalSecondaryBtn: {
        flex: 0.6,
        height: 56,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    modalSecondaryBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4c1d95',
    },

    // Selected Item Card
    selectedItemCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        width: '100%',
    },
    selectedItemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#4c1d95',
    },
    selectedItemSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
    },


    // --- Custom UI for Step 1 ---
    searchSection: {
        marginBottom: 24,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        height: 52,
        paddingHorizontal: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        fontWeight: '500',
        color: '#4c1d95',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    scanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3e8ff', // Soft purple
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    scanButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4c1d95',
    },
    listContainer: {
        paddingBottom: 100, // Make room for floating nav
    },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        padding: 16,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        minHeight: 74,
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
        fontSize: 14,
        fontWeight: '700',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    listContent: {
        flex: 1,
        justifyContent: 'center',
    },
    listHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '400',
        color: '#7634bc',
        lineHeight: 24,
    },
    listSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    badge: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8,
    },
    badgeText: {
        fontSize: 12,
        color: '#4c1d95',
        fontWeight: '500',
    },
    floatingContainer: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: '#18181b',
        borderRadius: 28,
        height: 56,
        padding: 6,
        alignItems: 'center',
        elevation: 12,
    },

    backPill: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },

    dividerPill: {
        width: 1.5,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginHorizontal: 4,
    },

    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
    },

    activePillItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        height: 44,
        borderRadius: 22,
    },

    pillText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    //Date[icker style
    inputWrapper: {
        borderWidth: 1.5,
        borderColor: '#e0e0e0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        justifyContent: 'center',
    },

    textInput: {
        fontSize: 14,
        color: '#4c1d95',
    },

    // Review Styles
    reviewTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#737373',
        marginVertical: 16,
    },
    reviewCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginBottom: 16,
    },
    reviewHeader: {
        paddingHorizontal: 20,
        paddingTop: 10,
        marginBottom: 20,
    },
    reviewSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    reviewItemCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 20,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    reviewItemInfo: {
        flex: 1,
    },
    reviewItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4c1d95',
    },
    reviewItemId: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    reviewItemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    miniBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    miniBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
    },
    reviewItemQtyContainer: {
        alignItems: 'flex-end',
        gap: 2,
    },
    reviewItemQtyLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
    },
    reviewItemQtyValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4c1d95',
    },
    reviewEditIcon: {
        backgroundColor: '#f1f5f9',
        padding: 4,
        borderRadius: 6,
        marginTop: 4,
    },

    varianceRow: {
        flexDirection: 'row',
        gap: 12,
    },
    varianceBox1: {
        flex: 1,
        backgroundColor: '#7634bc1a',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    varianceBox: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    varianceLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    varianceValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#4c1d95',
    },
    totalVarianceCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginTop: 8,
    },
    totalVarianceLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#4c1d95',
    },
    totalVarianceValue: {
        fontSize: 16,
        fontWeight: '500',
        color: '#ef4444',
    },

    // Serial Modal Specific Styles
    scanModeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    scanModeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    scanIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanModeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e40af',
    },
    modalScanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#1e40af',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    modalScanBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    serialsStatsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 16,
    },
    inlineQtyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    inlineQtyBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f3e8ff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e9d5ff',
    },
    inlineQtyInput: {
        fontSize: 20,
        fontWeight: '700',
        color: '#7634bc',
        textAlign: 'center',
        minWidth: 60,
        height: 40,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 10,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any
        })
    },
    integratedActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    integratedActionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    statsLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    statsValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4c1d95',
    },
    emptySerialsContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptySerialsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4c1d95',
        marginBottom: 8,
    },
    emptySerialsSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
    },
    serialInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        gap: 12,
    },
    checkCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    serialInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        borderRadius: 14,
        paddingLeft: 12,
        paddingRight: 4,
        height: 52,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    serialInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#4c1d95',
        fontWeight: '500',
        paddingVertical: 0,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    trashBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addSerialBtn: {
        height: 56,
        borderWidth: 1.5,
        borderColor: '#e0e0e0',
        borderStyle: 'dashed',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    addSerialText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#4c1d95',
    },
    serialsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    serialBadge: {
        backgroundColor: '#f8fafc',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: '100%',
    },
    serialBadgeText: {
        fontSize: 16,
        color: '#4c1d95',
        fontWeight: '500',
    },

    successOverlay: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successContent: {
        alignItems: 'center',
        paddingHorizontal: 40,
        marginTop: -100,
    },
    successIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#4c1d95',
        marginBottom: 12,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
    },
    dropdownContainer: {
        position: 'absolute',
        top: 48,
        left: -1,
        right: -1,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#4c1d95',
        elevation: 10,
        zIndex: 20000,
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        overflow: 'hidden',
    },
    dropdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownItemText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#4c1d95',
    },
    dropdownItemBalance: {
        fontSize: 12,
        color: '#64748b',
    },
    reviewButtonTop: {
        backgroundColor: '#18181b',
        borderRadius: 12,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    reviewButtonTopText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    draftInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        marginHorizontal: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 12,
    },
    draftBadge: {
        backgroundColor: '#cbd5e1',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    draftBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
    },
    draftName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4c1d95',
    },
    addMoreItemsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 20,
        marginTop: 12,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
        backgroundColor: '#f8fafc',
    },
    addMoreItemsText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748b',
    },
});