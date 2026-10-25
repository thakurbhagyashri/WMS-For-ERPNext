import { TopNavbar } from '@/components/TopNavbar';
import { ConfirmationModal, PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { Fonts } from '@/constants/theme';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { useCompanyContext } from '@/context/CompanyContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    FileText,
    MapPin,
    Minus,
    Package,
    Pencil,
    Plus,
    Scan,
    Search,
    Trash2,
    Truck,
    X
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function DispatchDetailScreen() {
    const { t } = useTranslation();
    const { id, type } = useLocalSearchParams();
    const docType = (Array.isArray(type) ? type[0] : type) || 'Sales Order';
    const router = useRouter();
    const { getResource, postResource, putResource, deleteResource, callMethod, loading: frappeLoading } = useFrappe();
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);

    useEffect(() => {
        if (!hasPermission('can_ship') && !hasPermission('can_pack')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

    const [submitted, setSubmitted] = useState(false);
    const [soDetails, setSoDetails] = useState<any>(null);
    const [step, setStep] = useState(1);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [dispatchItems, setDispatchItems] = useState<any[]>([]);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [alertData, setAlertData] = useState<{ visible: boolean; title: string; message: string; isError?: boolean; onClose?: () => void }>({ visible: false, title: '', message: '', isError: true });

    // Step 2 inputs
    const [qty, setQty] = useState(0);
    const [warehouse, setWarehouse] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
    const [isScanningWarehouse, setIsScanningWarehouse] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [DraftDN, setDraftDN] = useState<any>();
    const [DNName, setDNName] = useState<string | null>(null);


    // Available tracking items for dropdown
    const [availableTrackedItems, setAvailableTrackedItems] = useState<any[]>([]);
    const [showSuggestionsIndex, setShowSuggestionsIndex] = useState<number | null>(null);

    // Batch/Serial Slider state
    const [showBatchSlider, setShowBatchSlider] = useState(false);
    const [batches, setBatches] = useState<any[]>([{ batch_no: '', qty: 1 }]);

    // Scan & Search states
    const [isScanningItem, setIsScanningItem] = useState(false);
    const [isScanningBatch, setIsScanningBatch] = useState(false);
    const [checkingStock, setCheckingStock] = useState(false);
    const [itemSearch, setItemSearch] = useState('');
    const [scannedBatchIndex, setScannedBatchIndex] = useState<number | null>(null);

    // Scroll & Refresh State
    const [refreshing, setRefreshing] = useState(false);
    const [showFooter, setShowFooter] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [inventoryDimention, setInventoryDimention] = useState<any[]>([]);
    const [dimensionValues, setDimensionValues] = useState<Record<string, string>>({});
    const [dimensionOptions, setDimensionOptions] = useState<Record<string, any[]>>({});
    const [dimensionSearch, setDimensionSearch] = useState<Record<string, string>>({});
    const [showDimDropdown, setShowDimDropdown] = useState<string | null>(null);
    const [dimDropPage, setDimDropPage] = useState<Record<string, number>>({});
    const { defaultCurrency } = useCompanyContext();
    const DIM_PAGE_SIZE = 10;

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchSODetails();
        setRefreshing(false);
    };

    const handleScroll = (event: any) => {
        setShowFooter(true);
    };

    useEffect(() => {
        fetchSODetails();
        fetchInventoryDimention();
    }, [id]);

    useEffect(() => {
        setShowDropDownData();
    }, [selectedWarehouse,])
    useEffect(() => {
        if (soDetails?.company)
            fetchWarehouses()
    }, [soDetails?.company])

    async function fetchInventoryDimention() {
        try {
            const data = await getResource('Inventory Dimension', undefined, {
                filters: JSON.stringify({ apply_to_all_doctypes: 1 }),
                fields: '["*"]',
                limit_page_length: 1000
            });
            setInventoryDimention(data);

            const optionsMap: Record<string, any[]> = {};
            for (const dim of data) {
                // For outward transactions, source_fieldname is used
                optionsMap[dim.source_fieldname] = [];
            }
            setDimensionOptions(optionsMap);
        } catch (error) {
            console.log('Failed to fetch inventory dimensions:', error);
        }
    };

    const handleDimensionSearch = async (source_fieldname: string, reference_document: string, text: string) => {
        setDimensionSearch(prev => ({ ...prev, [source_fieldname]: text }));
        setShowDimDropdown(source_fieldname);

        if (!reference_document) return;
        try {
            const docs = await getResource(reference_document, undefined, {
                filters: JSON.stringify([['name', 'like', `%${text}%`]]),
                fields: '["name"]',
                limit_page_length: 50
            });
            setDimensionOptions(prev => ({ ...prev, [source_fieldname]: docs || [] }));
        } catch (e) {
            console.warn(`Failed to search options for ${reference_document}:`, e);
            setDimensionOptions(prev => ({ ...prev, [source_fieldname]: [] }));
        }
    };

    async function fetchWarehouses() {
        try {
            if (!soDetails?.company) {
                setAlertData({ visible: true, title: 'Error', message: 'Warehouse not added yet!', isError: true });
                return;
            }
            // to debuf the issue
            const data = await getResource('Warehouse', undefined, {
                filters: JSON.stringify({
                    disabled: 0,
                    is_group: 0,
                    company: soDetails.company
                }),
                fields: '["name", "warehouse_name", "company"]',
                limit_page_length: 1000
            });
            // to debug the issue
            if (Array.isArray(data)) {
                setWarehouses(data);
            }
        } catch (err) {
            console.warn('Failed to fetch warehouses:', err);
        }
    };

    function setShowDropDownData() {
        setShowWarehouseDropdown(true)
    }
    async function fetchSODetails() {
        try {
            setLoading(true);

            const docId = Array.isArray(id) ? id[0] : id;
            const data = await getResource(
                docType,
                docId
            );

            if (data && data.items) {
                const enritchedItems = await Promise.all(data.items.map(async (item: any) => {
                    try {
                        const itemMaster = await getResource('Item', item.item_code);
                        const barcodes = (itemMaster?.barcodes || []).map((b: any) => b.barcode).filter(Boolean);
                        if (itemMaster?.barcode && !barcodes.includes(itemMaster.barcode)) {
                            barcodes.push(itemMaster.barcode);
                        }
                        return {
                            ...item,
                            has_serial_no: itemMaster?.has_serial_no ?? item.has_serial_no,
                            has_batch_no: itemMaster?.has_batch_no ?? item.has_batch_no,
                            barcodes: barcodes
                        };
                    } catch (e) {
                        return item;
                    }
                }));
                data.items = enritchedItems;
            }

            setSoDetails(data);

            if (docType === 'Sales Order') {
                if (data.docstatus !== 1) {
                    setAlertData({
                        visible: true,
                        title: 'Draft Sales Order',
                        message: 'This Sales Order is not submitted. You cannot dispatch items until it is submitted in ERPNext.',
                        isError: true
                    });
                    return;
                }

                //creating draft delivery note at a time of fetching so, same as per ERP works
                const draftDN = await callMethod(
                    "erpnext.selling.doctype.sales_order.sales_order.make_delivery_note",
                    {
                        source_name: data.name
                    }
                );

                setDraftDN({
                    ...draftDN,
                    items: draftDN.items
                });

                console.log("make_delivery_note response:", JSON.stringify(draftDN, null, 2));
            } else if (docType === 'Delivery Note') {
                if (data.docstatus !== 0) {
                    setAlertData({
                        visible: true,
                        title: 'Submitted Delivery Note',
                        message: 'This Delivery Note is already submitted and cannot be dispatched again.',
                        isError: true
                    });
                    return;
                }

                setDraftDN({
                    ...data,
                    items: data.items
                });
            }

        } catch (error: any) {
            console.error('Error fetching SO details:', error);
            const errorMessage = error?.message || 'Error fetching Sales Order';
            setAlertData({
                visible: true,
                title: 'Error',
                message: errorMessage.replace(/<[^>]*>/g, ''),
                isError: true
            });
        } finally {
            setLoading(false);
        }
    };

    const handleItemSelect = async (item: any) => {
        setSelectedItem(item);
        setEditingItemIndex(null);
        const pendingQty = item.qty - (item.delivered_qty || 0);
        setQty(pendingQty);
        setBatches([{ batch_no: '', qty: pendingQty }]);
        setStep(2);

        if (item.has_serial_no || item.has_batch_no) {
            fetchAvailableTrackedItems(item.item_code, item);
        }
    };

    const fetchAvailableTrackedItems = async (itemCode: string, item: any, searchQuery = '') => {
        try {
            const filters: any = {};
            if (item?.has_serial_no) {
                filters.item_code = itemCode;
                filters.status = 'Active';
                if (searchQuery) filters.name = ['like', `%${searchQuery}%`];
                const serials = await getResource('Serial No', undefined, {
                    filters: JSON.stringify(filters),
                    fields: '["name", "warehouse"]',
                    limit_page_length: 50
                });
                setAvailableTrackedItems(serials || []);
            } else if (item?.has_batch_no) {
                filters.item = itemCode;
                if (searchQuery) filters.name = ['like', `%${searchQuery}%`];
                const batchesData = await getResource('Batch', undefined, {
                    filters: JSON.stringify(filters),
                    fields: '["name", "expiry_date"]',
                    limit_page_length: 50
                });
                setAvailableTrackedItems(batchesData || []);
            }
        } catch (err) {
            console.warn('Failed to fetch tracking items:', err);
        }
    };

    // Debounced search effect
    useEffect(() => {
        if (showSuggestionsIndex !== null && selectedItem) {
            const searchTerm = batches[showSuggestionsIndex]?.batch_no || '';
            const timer = setTimeout(() => {
                fetchAvailableTrackedItems(selectedItem.item_code, selectedItem, searchTerm);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [showSuggestionsIndex, batches, selectedItem]);

    const handleAddToDN = async () => {
        if (qty <= 0) {
            setAlertData({ visible: true, title: 'Invalid Quantity', message: 'Please enter a quantity greater than zero.', isError: true });
            return;
        }

        if (!selectedWarehouse) {
            setAlertData({ visible: true, title: 'Warehouse Required', message: 'Please select a source warehouse.', isError: true });
            return;
        }

        if (selectedItem?.has_serial_no || selectedItem?.has_batch_no) {
            const hasInvalidBatch = batches.some(b => !b.batch_no || b.qty <= 0);
            if (hasInvalidBatch) {
                setAlertData({ visible: true, title: 'Incomplete Batch Details', message: 'Please provide both serial/batch number and quantity.', isError: true });
                return;
            }
        }

        // Verify each batch actually has enough stock in the chosen warehouse before we
        // create bundles / submit - avoids the "negative stock" error surfacing only after
        // ERPNext rejects the Delivery Note submission.
        if (selectedItem?.has_batch_no && !selectedItem?.has_serial_no) {
            setCheckingStock(true);
            try {
                for (const b of batches) {
                    const availableQty = await callMethod(
                        'erpnext.stock.doctype.batch.batch.get_batch_qty',
                        { batch_no: b.batch_no, warehouse: selectedWarehouse.name }
                    );
                    const qtyAvailable = Number(availableQty) || 0;
                    if (qtyAvailable < Number(b.qty)) {
                        setAlertData({
                            visible: true,
                            title: 'Insufficient Batch Stock',
                            message: `Batch ${b.batch_no} only has ${qtyAvailable} ${selectedItem?.uom || 'units'} available in ${selectedWarehouse.name}, but you're trying to dispatch ${b.qty}. Please choose a different batch or warehouse.`,
                            isError: true
                        });
                        return;
                    }
                }
            } catch (err) {
                console.warn('Batch stock check failed, proceeding without it:', err);
            } finally {
                setCheckingStock(false);
            }
        }

        // Validate mandatory dimensions
        for (const dim of inventoryDimention) {
            if (dim.reqd && !dimensionValues[dim.source_fieldname]) {
                setAlertData({ visible: true, title: 'Dimension Required', message: `Please enter a value for Source ${dim.dimension_name}`, isError: true });
                return;
            }
        }

        const newItem = {
            ...selectedItem,
            dispatch_qty_input: qty,
            warehouse: selectedWarehouse.name,
            originalWarehouse: selectedWarehouse,
            batches: [...batches],
            dimensionValues: { ...dimensionValues },
            ...dimensionValues,
            originalItem: selectedItem
        };

        if (editingItemIndex !== null) {
            const updatedItems = [...dispatchItems];
            updatedItems[editingItemIndex] = newItem;
            setDispatchItems(updatedItems);
        } else {
            setDispatchItems(prev => [...prev, newItem]);
        }

        setStep(1);
        setSelectedItem(null);
        setWarehouse('');
        setSelectedWarehouse(null);
        setEditingItemIndex(null);
    };

    const handleEditItem = (index: number) => {
        const item = dispatchItems[index];
        setSelectedItem(item.originalItem);
        setSelectedWarehouse(item.originalWarehouse);
        setWarehouse(item.originalWarehouse.name);
        setBatches(item.batches);
        setDimensionValues(item.dimensionValues || {});
        setQty(item.dispatch_qty_input);
        setEditingItemIndex(index);
        setStep(2);
    };

    const handleRemoveItem = (index: number) => {
        const updatedItems = [...dispatchItems];
        updatedItems.splice(index, 1);
        setDispatchItems(updatedItems);
    };

    const handleSubmitDN = async () => {
        if (dispatchItems.length === 0) return;

        if (soDetails?.docstatus === 0 && docType === 'Sales Order') {
            setAlertData({ visible: true, title: 'Cannot Submit', message: 'This Sales Order is in DRAFT status. Please SUBMIT it in ERPNext first before dispatching items.', isError: true });
            return;
        }
        const createdBundles: string[] = [];
        let createdDNName: string | null = null;
        try {
            setLoading(true);

            const payload = JSON.parse(JSON.stringify(DraftDN));
            const dnItems: any[] = [];

            for (const item of dispatchItems) {
                const dnMappedItem = DraftDN?.items?.find((i: any) => i.item_code === item.item_code) || {};
                let bundleName = dnMappedItem.serial_and_batch_bundle || '';

                if (item.has_serial_no || item.has_batch_no) {
                    const bundleData = {
                        doctype: 'Serial and Batch Bundle',
                        item_code: item.item_code,
                        warehouse: item.warehouse,
                        company: soDetails.company,
                        type: 'Outward',
                        type_of_transaction: 'Outward',
                        voucher_type: 'Delivery Note',
                        has_serial_no: item.has_serial_no ? 1 : 0,
                        has_batch_no: item.has_batch_no ? 1 : 0,
                        entries: item.batches.map((b: any) => ({
                            serial_no: item.has_serial_no ? b.batch_no : undefined,
                            batch_no: (!item.has_serial_no && item.has_batch_no) ? b.batch_no : undefined,
                            qty: b.qty
                        }))
                    };

                    try {
                        if (bundleName) {
                            // Update existing bundle to avoid stock reservation conflicts
                            await putResource('Serial and Batch Bundle', bundleName, {
                                entries: bundleData.entries,
                                warehouse: item.warehouse
                            }, false);
                        } else {
                            //@ts-ignore
                            const bundle = await postResource('Serial and Batch Bundle', bundleData, false);
                            bundleName = bundle.name;
                            if (bundleName) createdBundles.push(bundleName);
                        }
                    } catch (err: any) {
                        console.error('SBB Creation Error:', err);
                        throw new Error(`Failed to create/update Bundle for ${item.item_name}: ${err.message}`);
                    }
                    console.log("serial and batch bundle name:", bundleName);

                }

                // The mapped DN item can come back with rate = 0 in some cases (e.g. price list
                // mismatches at mapping time). Since it's spread after originalItem, it would
                // silently overwrite the correct Sales Order rate. Force the real rate last so it
                // can never be clobbered.
                const correctRate = item.originalItem?.rate ?? dnMappedItem?.rate ?? 0;

                dnItems.push({
                    ...item.originalItem,
                    ...dnMappedItem,
                    ...item.dimensionValues,
                    qty: item.dispatch_qty_input,
                    rate: correctRate,
                    warehouse: item.warehouse,
                    serial_and_batch_bundle: bundleName || undefined,
                    use_serial_batch_fields: 0,
                });
            }

            payload.items = dnItems;

            if (dispatchItems.length > 0 && dispatchItems.every(i => i.warehouse === dispatchItems[0].warehouse)) {
                payload.set_warehouse = dispatchItems[0].warehouse;
            }

            // Ensure ERPNext Currency & Price List details are explicitly set
            payload.currency = soDetails?.currency || DraftDN?.currency || defaultCurrency;
            payload.conversion_rate = soDetails?.conversion_rate || DraftDN?.conversion_rate || 1;
            payload.price_list_currency = soDetails?.price_list_currency || DraftDN?.price_list_currency || payload.currency;
            payload.plc_conversion_rate = soDetails?.plc_conversion_rate || DraftDN?.plc_conversion_rate || 1;
            if (soDetails?.selling_price_list) {
                payload.selling_price_list = soDetails.selling_price_list;
            }

            let cretedDN;
            if (docType === 'Delivery Note') {
                // Update the existing Draft Delivery Note
                cretedDN = await putResource('Delivery Note', DraftDN.name, payload, false);
            } else {
                // Create a new Delivery Note from the Sales Order
                cretedDN = await postResource('Delivery Note', payload, false);
            }

            setDNName(cretedDN.name);
            createdDNName = cretedDN.name;

            // Submit the Delivery Note so it moves from Draft to Submitted
            //@ts-ignore
            await putResource('Delivery Note', cretedDN.name, { docstatus: 1 }, false, undefined, false);

            setAlertData({
                visible: true,
                title: 'Success!',
                message: `Delivery Note ${cretedDN.name} has been successfully created and submitted.`,
                isError: false,
                onClose: () => router.push('/inventory/dispatch')
            });

        } catch (error: any) {
            console.error('Submit DN Error:', error);
            const errorMessage = error?.message || 'Failed to submit Delivery Note';
            const cleanMessage = errorMessage.replace(/<[^>]*>/g, '');
            setAlertData({
                visible: true,
                title: 'Submission Failed',
                message: cleanMessage,
                isError: true
            });

            if (createdDNName) {
                // DN was created but failed to submit - remove the orphaned draft so retry doesn't duplicate it
                console.log(`[Rollback] Cleaning up orphaned draft Delivery Note ${createdDNName}...`);
                try {
                    await deleteResource('Delivery Note', createdDNName, false);
                    setDNName(null);
                } catch (cleanupErr) {
                    console.warn('Failed to cleanup draft Delivery Note:', createdDNName, cleanupErr);
                }
            }

            if (createdBundles && createdBundles.length > 0) {
                console.log(`[Rollback] Cleaning up ${createdBundles.length} orphaned bundles...`);
                for (const bundleName of createdBundles) {
                    try {
                        await deleteResource('Serial and Batch Bundle', bundleName, false);
                    } catch (cleanupErr) {
                        console.warn('Failed to cleanup bundle:', bundleName, cleanupErr);
                    }
                }
            }
        } finally {
            setLoading(false);
        }
    };


    const handleBatchChange = (index: number, field: string, value: any) => {
        const newBatches = [...batches];
        newBatches[index][field] = field === 'qty' ? parseFloat(value || '0') : value;
        setBatches(newBatches);
    };

    const handleAddBatch = () => {
        setBatches([...batches, { batch_no: '', qty: selectedItem?.has_serial_no ? 1 : 0 }]);
    };

    const handleRemoveBatch = (index: number) => {
        const newBatches = [...batches];
        newBatches.splice(index, 1);
        setBatches(newBatches);
    };

    const handleSaveBatchesInfo = () => {
        if (selectedItem?.has_serial_no || selectedItem?.has_batch_no) {
            const invalidEntries = batches.filter(b => b.batch_no.trim() !== '' && !availableTrackedItems.some(item => item.name === b.batch_no));
            if (invalidEntries.length > 0) {
                setAlertData({
                    visible: true,
                    title: 'Invalid Selection',
                    message: `Some ${selectedItem?.has_serial_no ? 'serial' : 'batch'} numbers are not available in inventory. Please select from the suggestions.`,
                    isError: true
                });
                return;
            }
        }

        const totalQty = batches.reduce((sum, b) => sum + (parseFloat(b.qty.toString()) || 0), 0);
        setQty(totalQty);
        setShowBatchSlider(false);
    };

    const onWarehouseScanned = ({ data }: { data: string }) => {
        setIsScanningWarehouse(false);
        const wh = warehouses.find(w => w.name === data || w.warehouse_name === data);
        if (wh) {
            setSelectedWarehouse(wh);
            setWarehouse('');
            setShowWarehouseDropdown(false);
        } else {
            setWarehouse(data);
            setShowWarehouseDropdown(true);
        }
    };

    const onItemScanned = ({ data }: { data: string }) => {
        setIsScanningItem(false);
        const scanData = data.trim().toLowerCase();

        let cleanedScanData = scanData;
        if (scanData.includes('/')) {
            const parts = scanData.split('/');
            cleanedScanData = parts[parts.length - 1];
        }

        const item = soDetails?.items?.find((i: any) => {
            if (i.item_code && i.item_code.toLowerCase() === cleanedScanData) return true;
            if (i.item_name && i.item_name.toLowerCase().includes(cleanedScanData)) return true;
            if (i.barcodes && i.barcodes.some((b: string) => b.toLowerCase() === cleanedScanData)) return true;
            return false;
        });

        if (item) {
            const isAlreadyAdded = dispatchItems.some(di => di.name === item.name);
            if (isAlreadyAdded) {
                setAlertData({ visible: true, title: 'Already Added', message: `Item ${item.item_code} is already added to the Dispatch.`, isError: true });
                return;
            }

            const pendingQty = item.qty - (item.delivered_qty || 0);
            if (pendingQty <= 0) {
                setAlertData({ visible: true, title: 'Fully Dispatched', message: `Item ${item.item_code} is already fully dispatched.`, isError: true });
                return;
            }

            handleItemSelect(item);
        } else {
            setItemSearch(cleanedScanData);
            setAlertData({ visible: true, title: 'Item Not Found', message: `No pending item matches barcode: ${cleanedScanData}`, isError: true });
        }
    };

    const onBatchScanned = ({ data }: { data: string }) => {
        setIsScanningBatch(false);

        const exists = availableTrackedItems.some(item => item.name === data);
        if (!exists) {
            setAlertData({ visible: true, title: 'Invalid Selection', message: `${selectedItem?.has_serial_no ? 'Serial' : 'Batch'} ${data} not found in inventory.`, isError: true });
            return;
        }

        if (scannedBatchIndex !== null) {
            handleBatchChange(scannedBatchIndex, 'batch_no', data);
            setScannedBatchIndex(null);
        } else {
            // New entry
            setBatches(prev => [...prev.filter(b => b.batch_no !== ''), { batch_no: data, qty: selectedItem?.has_serial_no ? 1 : 1 }]);
        }
    };

    if (loading && !soDetails) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7634bc" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <TopNavbar showBackButton={false} />

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 160 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                {/* Stepper */}
                <View style={[styles.stepperContainer, { paddingHorizontal: 24, paddingVertical: 16, marginBottom: 8, position: 'relative' }]}>
                    <View style={styles.stepTrackLine} />
                    <View style={[styles.stepActiveLine, { width: step === 1 ? '0%' : step === 2 ? '45%' : '82%' }]} />
                    <View style={styles.stepWrapper}>
                        <View style={[styles.stepCircle, step >= 1 && styles.stepActive]}>
                            {step > 1 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, step >= 1 && styles.stepNumActive]}>1</Text>}
                        </View>
                        <Text style={[styles.stepLabel, step >= 1 && styles.stepLabelActive]}>Add Item</Text>
                    </View>
                    <View style={styles.stepWrapper}>
                        <View style={[styles.stepCircle, step >= 2 && styles.stepActive]}>
                            {step > 2 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, step >= 2 && styles.stepNumActive]}>2</Text>}
                        </View>
                        <Text style={[styles.stepLabel, step >= 2 && styles.stepLabelActive]}>Input Details</Text>
                    </View>
                    <View style={styles.stepWrapper}>
                        <View style={[styles.stepCircle, step >= 3 && styles.stepActive]}>
                            <Text style={[styles.stepNum, step >= 3 && styles.stepNumActive]}>3</Text>
                        </View>
                        <Text style={[styles.stepLabel, step >= 3 && styles.stepLabelActive]}>Review & Submit</Text>
                    </View>
                </View>

                {/* Header Section */}
                <LinearGradient
                    colors={['#2e1065', '#7634bc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.poInfoCard}
                >
                    <View style={styles.poInfoHeader}>
                        <View style={styles.idBadge}>
                            <ClipboardList size={16} color="#e9d5ff" />
                            <Text style={styles.poIdText}>{soDetails?.name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {soDetails?.docstatus === 0 && (
                                <View style={styles.draftBadge}>
                                    <Text style={styles.draftBadgeText}>{t('draft', 'DRAFT')}</Text>
                                </View>
                            )}
                            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                                <X size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingBottom: 4 }}>
                        <MapPin size={14} color="#e9d5ff" />
                        <Text style={styles.supplierText} numberOfLines={1}>{soDetails?.customer_name || soDetails?.customer}</Text>
                    </View>

                    {soDetails?.docstatus === 0 && docType === 'Sales Order' && (
                        <View style={styles.draftWarningBoard}>
                            <AlertCircle size={16} color="#d97706" style={{ marginTop: 2 }} />
                            <Text style={styles.draftWarningText}>{t('this_sales_order_is_', 'This Sales Order is not yet submitted. You can prepare the dispatch, but cannot submit until it\'s Submitted in ERPNext.')}</Text>
                        </View>
                    )}
                </LinearGradient>

                {step === 1 && (
                    <Animated.View entering={FadeIn} style={styles.stepContent}>
                        <View style={styles.searchBarWrapper}>
                            <View style={styles.searchBar}>
                                <Search size={18} color="#94a3b8" />
                                <TextInput
                                    placeholder="Search items by name or code.."
                                    style={styles.searchInput}
                                    placeholderTextColor="#94a3b8"
                                    value={itemSearch}
                                    onChangeText={setItemSearch}
                                    onSubmitEditing={() => {
                                        if (itemSearch.trim().length > 0) {
                                            onItemScanned({ data: itemSearch });
                                        }
                                    }}
                                />
                                <TouchableOpacity style={styles.scanBtn} onPress={() => setIsScanningItem(true)}>
                                    <Scan size={18} color="#7634bc" />
                                    <Text style={styles.scanText}></Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={styles.listTitle}>
                            Pending Items ({(soDetails?.items || []).filter((i: any) =>
                                (i.qty - (i.delivered_qty || 0)) > 0 &&
                                (i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || i.item_code.toLowerCase().includes(itemSearch.toLowerCase()))
                            ).length || 0})
                        </Text>

                        {(soDetails?.items || [])
                            .filter((item: any) =>
                                (item.qty - (item.delivered_qty || 0)) > 0 &&
                                (item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || item.item_code.toLowerCase().includes(itemSearch.toLowerCase()))
                            )
                            .map((item: any, idx: number) => {
                                const isAlreadyAdded = dispatchItems.some(di => di.name === item.name);
                                if (isAlreadyAdded) return null;

                                return (
                                    <TouchableOpacity key={idx} style={styles.itemCard} onPress={() => handleItemSelect(item)}>
                                        <View style={styles.itemHeader}>
                                            <View style={styles.itemIdentity}>
                                                <View style={styles.indexBadge}>
                                                    <Text style={styles.indexText}>{idx + 1}</Text>
                                                </View>
                                                <View style={styles.itemTextContainer}>
                                                    <Text style={styles.itemCode} numberOfLines={1}>{item.item_code}</Text>
                                                    <Text style={styles.itemName}>{item.item_name}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.qtyContainerItem}>
                                                <Text style={styles.qtyTextItem}>{item.qty - (item.delivered_qty || 0)}</Text>
                                                <Text style={styles.qtyUomItem}>{item.uom || 'Nos'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.locationContainer}>
                                            <View style={styles.locationInfo}>
                                                {(item.has_serial_no || item.has_batch_no) ? (
                                                    <View style={styles.tagBadge}>
                                                        <Text style={styles.tagText}>{item.has_serial_no ? 'Serial Tracked' : 'Batch Tracked'}</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.warehouseText} numberOfLines={1}>{t('untracked_item', 'Untracked Item')}</Text>
                                                )}
                                            </View>
                                            <ChevronRight size={20} color="#94a3b8" />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}

                        {dispatchItems.length > 0 && (
                            <>
                                <Text style={[styles.listTitle, { marginTop: 20 }]}>Added to Dispatch ({dispatchItems.length})</Text>
                                {dispatchItems.map((item, idx) => (
                                    <View key={idx} style={[styles.itemCard, { opacity: 0.8 }]}>
                                        <View style={styles.itemHeader}>
                                            <View style={styles.itemIdentity}>
                                                <View style={styles.indexBadge}>
                                                    <Check size={16} color="#10b981" />
                                                </View>
                                                <View style={styles.itemTextContainer}>
                                                    <Text style={styles.itemCode} numberOfLines={1}>{item.item_code}</Text>
                                                    <Text style={styles.itemName}>{item.item_name}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.qtyContainerItem}>
                                                <Text style={[styles.qtyTextItem, { color: '#10b981' }]}>{item.dispatch_qty_input}</Text>
                                                <Text style={styles.qtyUomItem}>{item.uom || 'Nos'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.locationContainer}>
                                            <View style={styles.locationInfo}>
                                                <Text style={styles.warehouseText} numberOfLines={1}>{t('ready_to_dispatch', 'Ready to dispatch')}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                <TouchableOpacity onPress={() => handleEditItem(idx)}>
                                                    <Pencil size={18} color="#1e1b4b" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleRemoveItem(idx)}>
                                                    <Trash2 size={18} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </>
                        )}



                    </Animated.View>
                )}

                {step === 2 && (
                    <Animated.View entering={FadeIn} style={styles.stepContent}>
                        <View style={styles.activePickCard}>
                            <View style={styles.activeItemHeader}>
                                <View style={styles.activeItemIdentity}>
                                    <View style={styles.activeIndexBadge}>
                                        <Package size={20} color="#94a3b8" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.activeItemCode} numberOfLines={1}>{selectedItem?.item_code}</Text>
                                        <Text style={styles.activeItemName}>{selectedItem?.item_name}</Text>
                                    </View>
                                </View>
                                <View style={styles.targetQtyBox}>
                                    <Text style={styles.targetQtyText}>{selectedItem?.qty - (selectedItem?.delivered_qty || 0)}</Text>
                                    <Text style={styles.targetUomText}>{selectedItem?.uom || 'Nos'}</Text>
                                </View>
                            </View>

                            <View style={styles.locationBanner}>
                                <MapPin size={16} color="#475569" />
                                {(selectedItem?.has_serial_no || selectedItem?.has_batch_no) ? (
                                    <Text style={styles.locationText} numberOfLines={1}>
                                        {selectedItem?.has_serial_no ? 'Serial Tracked' : 'Batch Tracked'}
                                    </Text>
                                ) : (
                                    <Text style={styles.locationText} numberOfLines={1}>
                                        {t('untracked_item', 'Untracked Item')}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>{t('select_source_warehouse', 'Select Source Warehouse')}</Text>
                            {!selectedWarehouse && (
                                <View style={styles.formInputWrapper}>
                                    <Search size={18} color="#94a3b8" />
                                    <TextInput
                                        placeholder="Search or scan warehouse..."
                                        style={styles.formInput}
                                        value={warehouse}
                                        onChangeText={(txt) => {
                                            setWarehouse(txt);
                                            setShowWarehouseDropdown(true);
                                        }}
                                        onFocus={() => setShowWarehouseDropdown(true)}
                                        placeholderTextColor="#94a3b8"
                                    />
                                    <TouchableOpacity onPress={() => setIsScanningWarehouse(true)} style={{ marginRight: 8 }}>
                                        <Scan size={18} color="#1e1b4b" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setShowWarehouseDropdown(!showWarehouseDropdown)}>
                                        <ChevronDown size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Warehouse Suggestions Below Input */}
                            {!selectedWarehouse && (() => {
                                let defaultWhName = selectedItem?.warehouse;
                                if (!defaultWhName) {
                                    const dnMappedItem = DraftDN?.items?.find((i: any) => i.item_code === selectedItem?.item_code);
                                    if (dnMappedItem?.warehouse) defaultWhName = dnMappedItem.warehouse;
                                }
                                const sugs: { type: string; name: string; badgeBg: string; badgeColor: string }[] = [];
                                if (defaultWhName) sugs.push({ type: 'Suggested', name: defaultWhName, badgeBg: '#f3e8ff', badgeColor: '#7c3aed' });
                                if (sugs.length === 0) return null;
                                return (
                                    <View style={{ marginTop: 8, gap: 6 }}>
                                        {sugs.map((sug, idx) => {
                                            const isSelected = selectedWarehouse?.name === sug.name;
                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: isSelected ? '#e0f2fe' : '#f8fafc', borderRadius: 8 }}
                                                    onPress={() => {
                                                        const wh = warehouses.find(w => w.name === sug.name || w.warehouse_name === sug.name);
                                                        setSelectedWarehouse(wh || { name: sug.name, warehouse_name: sug.name.split(' - ')[0], company: soDetails?.company });
                                                    }}
                                                >
                                                    <View style={{ backgroundColor: sug.badgeBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: sug.badgeColor, letterSpacing: 0.3 }}>{sug.type}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 13, color: isSelected ? '#0369a1' : '#1e293b', flex: 1, fontWeight: isSelected ? '600' : '400' }} numberOfLines={1}>{sug.name}</Text>
                                                    {isSelected && <Check size={14} color="#0284c7" />}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                );
                            })()}

                            {selectedWarehouse && (
                                <View style={styles.selectedWarehouseCard}>
                                    <View style={styles.warehouseIconFrame}>
                                        <Package size={16} color="#0f172a" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.warehouseName}>{selectedWarehouse.name}</Text>
                                        <Text style={styles.warehouseCompany}>{selectedWarehouse.company}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedWarehouse(null)}>
                                        <X size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {!selectedWarehouse && showWarehouseDropdown && (
                                <View style={styles.warehouseDropdown}>
                                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                        {warehouses
                                            .filter(w => w.name.toLowerCase().includes(warehouse.toLowerCase()))
                                            .map((w, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={styles.warehouseItem}
                                                    onPress={() => {
                                                        setSelectedWarehouse(w);
                                                        setWarehouse('');
                                                        setShowWarehouseDropdown(false);
                                                    }}
                                                >
                                                    <View style={styles.warehouseIconFrame}>
                                                        <Package size={14} color="#64748b" />
                                                    </View>
                                                    <View>
                                                        <Text style={styles.warehouseName}>{w.name}</Text>
                                                        <Text style={styles.warehouseCompany}>{w.company}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))
                                        }
                                        {warehouses.filter(w => w.name.toLowerCase().includes(warehouse.toLowerCase())).length === 0 && (
                                            <View style={{ padding: 12, alignItems: 'center' }}>
                                                <Text style={{ color: '#94a3b8', fontFamily: Fonts.sans }}>{t('no_warehouses_found', 'No warehouses found')}</Text>
                                            </View>
                                        )}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {(!!selectedItem?.has_serial_no || !!selectedItem?.has_batch_no) && (
                            <View style={styles.trackingSection}>
                                <Text style={styles.formLabel}>{selectedItem?.has_serial_no ? 'Serial Numbers' : 'Batch Numbers'}</Text>
                                <TouchableOpacity style={styles.trackingCard} onPress={() => setShowBatchSlider(true)}>
                                    <View style={styles.trackingInfo}>
                                        <View style={styles.addTrackingBtn}>
                                            <Text style={styles.addTrackingIcon}>#</Text>
                                            <Text style={styles.addTrackingText}>
                                                {batches.filter(s => s.batch_no !== '').length > 0
                                                    ? `${batches.filter(s => s.batch_no !== '').length} ${selectedItem?.has_serial_no ? 'serials' : 'batches'} added`
                                                    : `Add ${selectedItem?.has_serial_no ? 'Serial' : 'Batch'} Numbers`}
                                            </Text>
                                        </View>
                                    </View>
                                    <ChevronRight size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {inventoryDimention.map((dim: any) => (
                            <View key={dim.name} style={styles.formGroup}>
                                {/* Source Dimension */}
                                <Text style={styles.formLabel}>Source {dim.dimension_name} {dim.reqd === 1 && <Text style={{ color: '#ef4444' }}>*</Text>}</Text>

                                <View style={styles.formInputWrapper}>
                                    <TextInput
                                        placeholder={`Search Source ${dim.dimension_name}...`}
                                        style={[styles.formInput, { marginLeft: 0 }]}
                                        value={dimensionValues[dim.source_fieldname] ? dimensionValues[dim.source_fieldname] : (dimensionSearch[dim.source_fieldname] || '')}
                                        onChangeText={(txt) => {
                                            if (dimensionValues[dim.source_fieldname]) {
                                                const newVals = { ...dimensionValues };
                                                delete newVals[dim.source_fieldname];
                                                setDimensionValues(newVals);
                                            }
                                            handleDimensionSearch(dim.source_fieldname, dim.reference_document, txt);
                                        }}
                                        onFocus={() => {
                                            if (!dimensionOptions[dim.source_fieldname] || dimensionOptions[dim.source_fieldname].length === 0) {
                                                handleDimensionSearch(dim.source_fieldname, dim.reference_document, '');
                                            } else {
                                                setShowDimDropdown(dim.source_fieldname);
                                            }
                                        }}
                                        placeholderTextColor="#94a3b8"
                                    />
                                    {dimensionValues[dim.source_fieldname] ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const newVals = { ...dimensionValues };
                                                    delete newVals[dim.source_fieldname];
                                                    setDimensionValues(newVals);
                                                    setDimensionSearch(prev => ({ ...prev, [dim.source_fieldname]: '' }));
                                                }}
                                                style={{ marginRight: 8, padding: 4 }}
                                            >
                                                <X size={18} color="#94a3b8" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (showDimDropdown === dim.source_fieldname) {
                                                        setShowDimDropdown(null);
                                                    } else {
                                                        if (!dimensionOptions[dim.source_fieldname] || dimensionOptions[dim.source_fieldname].length === 0) {
                                                            handleDimensionSearch(dim.source_fieldname, dim.reference_document, '');
                                                        } else {
                                                            setShowDimDropdown(dim.source_fieldname);
                                                        }
                                                    }
                                                }}
                                                style={{ marginRight: 8, padding: 4 }}
                                            >
                                                <ChevronDown size={20} color="#64748b" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (showDimDropdown === dim.source_fieldname) {
                                                    setShowDimDropdown(null);
                                                } else {
                                                    if (!dimensionOptions[dim.source_fieldname] || dimensionOptions[dim.source_fieldname].length === 0) {
                                                        handleDimensionSearch(dim.source_fieldname, dim.reference_document, '');
                                                    } else {
                                                        setShowDimDropdown(dim.source_fieldname);
                                                    }
                                                }
                                            }}
                                            style={{ marginRight: 8, padding: 4 }}
                                        >
                                            <ChevronDown size={20} color="#64748b" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Source Dimension Suggestions Below Input */}
                                {(() => {
                                    let defaultVal = null;
                                    if (selectedItem?.[dim.source_fieldname]) {
                                        defaultVal = selectedItem[dim.source_fieldname];
                                    } else if (soDetails?.[dim.source_fieldname]) {
                                        defaultVal = soDetails[dim.source_fieldname];
                                    } else {
                                        // Attempt to find from mapped DraftDN
                                        const dnMappedItem = DraftDN?.items?.find((i: any) => i.item_code === selectedItem?.item_code);
                                        if (dnMappedItem?.[dim.source_fieldname]) {
                                            defaultVal = dnMappedItem[dim.source_fieldname];
                                        }
                                    }

                                    const sugs: { type: string; name: string; badgeBg: string; badgeColor: string }[] = [];
                                    if (defaultVal) sugs.push({ type: 'Suggested', name: defaultVal, badgeBg: '#f3e8ff', badgeColor: '#7c3aed' });

                                    if (sugs.length === 0) return null;

                                    return (
                                        <View style={{ marginTop: 8, gap: 4 }}>
                                            {sugs.map((sug, idx) => {
                                                const isSelected = dimensionValues[dim.source_fieldname] === sug.name;
                                                return (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: isSelected ? '#e0f2fe' : '#f8fafc', borderRadius: 8 }}
                                                        onPress={() => setDimensionValues(prev => ({ ...prev, [dim.source_fieldname]: sug.name }))}
                                                    >
                                                        <View style={{ backgroundColor: sug.badgeBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 }}>
                                                            <Text style={{ fontSize: 10, fontWeight: '700', color: sug.badgeColor, letterSpacing: 0.3 }}>{sug.type}</Text>
                                                        </View>
                                                        <Text style={{ fontSize: 13, color: isSelected ? '#0369a1' : '#1e293b', flex: 1, fontWeight: isSelected ? '600' : '400' }} numberOfLines={1}>{sug.name}</Text>
                                                        {isSelected && <Check size={14} color="#0284c7" />}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    );
                                })()}

                                {/* Dimension Dropdown */}
                                {showDimDropdown === dim.source_fieldname && (
                                    <View style={styles.warehouseDropdown}>
                                        {(() => {
                                            const options = dimensionOptions[dim.source_fieldname] || [];
                                            const page = dimDropPage[dim.source_fieldname] || 0;
                                            const pageOptions = options.slice(page * DIM_PAGE_SIZE, (page + 1) * DIM_PAGE_SIZE);
                                            const totalPages = Math.ceil(options.length / DIM_PAGE_SIZE);
                                            return (
                                                <>
                                                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                        {pageOptions.map((opt: any, idx: number) => (
                                                            <TouchableOpacity
                                                                key={idx}
                                                                style={styles.warehouseItem}
                                                                onPress={() => {
                                                                    setDimensionSearch(prev => ({ ...prev, [dim.source_fieldname]: '' }));
                                                                    setDimensionValues(prev => ({ ...prev, [dim.source_fieldname]: opt.name }));
                                                                    setShowDimDropdown(null);
                                                                }}
                                                            >
                                                                <View style={{ marginRight: 8 }}>
                                                                    {dimensionValues[dim.source_fieldname] === opt.name ? (
                                                                        <View style={[styles.warehouseIconFrame, { backgroundColor: '#dcfce7' }]}>
                                                                            <Check size={14} color="#10b981" />
                                                                        </View>
                                                                    ) : (
                                                                        <View style={[styles.warehouseIconFrame, { backgroundColor: '#f8fafc' }]}>
                                                                            <FileText size={14} color="#64748b" />
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={styles.warehouseName}>{opt.name}</Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        ))}
                                                        {options.length === 0 && (
                                                            <View style={{ padding: 12, alignItems: 'center' }}>
                                                                <Text style={styles.warehouseText}>No options found</Text>
                                                            </View>
                                                        )}
                                                    </ScrollView>
                                                    {totalPages > 1 && (
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                                                            <TouchableOpacity onPress={() => setDimDropPage(prev => ({ ...prev, [dim.source_fieldname]: Math.max(0, page - 1) }))} disabled={page === 0}>
                                                                <Text style={{ color: page === 0 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Previous</Text>
                                                            </TouchableOpacity>
                                                            <Text style={{ fontSize: 12, color: '#64748b' }}>Page {page + 1} of {totalPages}</Text>
                                                            <TouchableOpacity onPress={() => setDimDropPage(prev => ({ ...prev, [dim.source_fieldname]: Math.min(totalPages - 1, page + 1) }))} disabled={page >= totalPages - 1}>
                                                                <Text style={{ color: page >= totalPages - 1 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Next</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </View>
                                )}
                            </View>
                        ))}

                        <View style={styles.qtyContainer}>
                            <Text style={styles.formLabel}>{t('dispatch_quantity', 'Dispatch Quantity')}</Text>
                            <View style={styles.qtyRow}>
                                <TouchableOpacity
                                    style={styles.qtyBtn}
                                    onPress={() => setQty(Math.max(0, qty - 1))}
                                >
                                    <Minus size={20} color="#1e1b4b" />
                                </TouchableOpacity>
                                <View style={styles.qtyDisplay}>
                                    <TextInput
                                        style={[styles.qtyValue, { padding: 0, textAlign: 'center' }]}
                                        value={qty.toString()}
                                        keyboardType="numeric"
                                        onChangeText={(val) => setQty(parseFloat(val) || 0)}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={styles.qtyBtn}
                                    onPress={() => setQty(qty + 1)}
                                >
                                    <Plus size={20} color="#1e1b4b" />
                                </TouchableOpacity>
                                <Text style={styles.uomText}>{selectedItem?.uom || 'Nos'}</Text>
                            </View>
                        </View>
                    </Animated.View>
                )}

                {step === 3 && (
                    <Animated.View entering={FadeIn} style={styles.stepContent}>
                        <View style={styles.reviewHeader}>
                            <Text style={styles.listTitle}>{t('review_delivery_note', 'Review Delivery Note')}</Text>
                            <Text style={styles.reviewSubtitle}>{t('confirm_the_items_be', 'Confirm the items below before submitting')}</Text>
                        </View>

                        {dispatchItems.map((item, idx) => (
                            <View key={idx} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <View style={styles.itemIdentity}>
                                        <View style={styles.indexBadge}>
                                            <Text style={styles.indexText}>{idx + 1}</Text>
                                        </View>
                                        <View style={styles.itemTextContainer}>
                                            <Text style={styles.itemCode} numberOfLines={1}>{item.item_code}</Text>
                                            <Text style={styles.itemName}>{item.item_name}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.qtyContainerItem}>
                                        <Text style={[styles.qtyTextItem, { color: '#10b981' }]}>{item.dispatch_qty_input}</Text>
                                        <Text style={styles.qtyUomItem}>{item.uom || 'Nos'}</Text>
                                    </View>
                                </View>
                                <View style={styles.locationContainer}>
                                    <View style={styles.locationInfo}>
                                        <Text style={styles.warehouseText}>{item.warehouse}</Text>
                                        {(!!item.has_serial_no || !!item.has_batch_no) && (
                                            <Text style={[styles.warehouseText, { color: '#10b981', marginLeft: 8 }]}>
                                                • {item.batches?.length || 0} batches added
                                            </Text>
                                        )}
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <TouchableOpacity onPress={() => handleEditItem(idx)}>
                                            <Pencil size={18} color="#1e1b4b" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleRemoveItem(idx)}>
                                            <Trash2 size={18} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}

                        <View style={styles.reviewSummary}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('total_items', 'Total Items')}</Text>
                                <Text style={styles.summaryValue}>{dispatchItems.length}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('total_quantity', 'Total Quantity')}</Text>
                                <Text style={styles.summaryValue}>
                                    {dispatchItems.reduce((sum, item) => sum + item.dispatch_qty_input, 0)} units
                                </Text>
                            </View>
                        </View>


                    </Animated.View>
                )}
            </ScrollView>



            {/* Unified Bottom Footer Panel */}
            {showFooter && (
                <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.unifiedFooter}>
                    <View style={styles.bottomActionsInner}>
                        {step === 1 ? (
                            <View style={styles.step1Buttons}>
                                <TouchableOpacity style={styles.cancelBtnView} onPress={() => router.back()}>
                                    <Text style={styles.cancelBtnText}>{t('cancel', 'Cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.submitBtnView,
                                        dispatchItems.length > 0 ? styles.submitBtnViewActive : styles.submitBtnViewDisabled
                                    ]}
                                    onPress={() => dispatchItems.length > 0 && setStep(3)}
                                    disabled={dispatchItems.length === 0}
                                >
                                    <Text style={styles.submitBtnText}>Review ({dispatchItems.length})</Text>
                                </TouchableOpacity>
                            </View>
                        ) : step === 2 ? (
                            <View style={styles.step2Buttons}>
                                <TouchableOpacity style={styles.backBtnForm} onPress={() => setStep(1)}>
                                    <ArrowLeft size={16} color="#2e1065" />
                                    <Text style={styles.backBtnFormText}>{t('back', 'Back')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.addGrnBtn} onPress={handleAddToDN} disabled={checkingStock}>
                                    {checkingStock ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Plus size={16} color="#fff" />
                                            <Text style={styles.addGrnBtnText}>{t('add_to_dn', 'Add to DN')}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.step1Buttons}>
                                <TouchableOpacity style={styles.cancelBtnView} onPress={() => setStep(1)} disabled={loading}>
                                    <Text style={styles.cancelBtnText}>{t('add_more', 'Add More')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.submitBtnView,
                                        styles.submitBtnViewActive,
                                        loading && { opacity: 0.7 }
                                    ]}
                                    onPress={handleSubmitDN}
                                    disabled={loading || dispatchItems.length === 0}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Check size={16} color="#fff" style={{ marginRight: 6 }} />
                                            <Text style={styles.submitBtnText}>{t('submit_dn', 'Submit DN')}</Text>
                                        </>
                                    )}

                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Footer Navigation */}
                    <View style={styles.pillNavbarContainer}>
                        <View style={styles.pillNavbar}>
                            <TouchableOpacity style={styles.pillBackBtn} onPress={() => router.back()}>
                                <ArrowLeft size={20} color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.pillDivider} />
                            <TouchableOpacity style={styles.pillNavBtn} onPress={() => router.replace('/inventory/dispatch')}>
                                <Truck size={18} color="#94a3b8" />
                                <Text style={styles.pillNavText}>{t('dispatch', 'DISPATCH')}</Text>
                            </TouchableOpacity>
                            <View style={[styles.pillNavBtn, styles.pillNavBtnActive]}>
                                <FileText size={18} color="#fff" />
                                <Text style={styles.pillNavTextActive}>{t('dn', 'DN')}</Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* Batch Slider */}
            <Modal visible={showBatchSlider} animationType="slide" transparent statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                <View style={styles.modalIconBg}>
                                    <ClipboardList size={20} color="#7634bc" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTitle}>{t('serial_batch_details', 'Serial/Batch Details')}</Text>
                                    <Text style={styles.modalSubtitle} numberOfLines={1} ellipsizeMode="tail">{selectedItem?.item_name}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setShowBatchSlider(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.batchScroll} keyboardShouldPersistTaps="handled">
                            {batches.map((b, i) => (
                                <View key={i} style={styles.batchCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <Text style={{ fontWeight: 'bold' }}>Entry {i + 1}</Text>
                                        <TouchableOpacity onPress={() => handleRemoveBatch(i)}>
                                            <Trash2 size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>

                                    <View>
                                        <View style={{ position: 'relative', zIndex: 100 }}>
                                            <View style={[
                                                styles.fieldInputGroup,
                                                b.batch_no.trim() !== '' && !availableTrackedItems.some(item => item.name === b.batch_no) && { borderColor: '#ef4444', borderWidth: 1.5 }
                                            ]}>
                                                <TextInput
                                                    placeholder={selectedItem?.has_serial_no ? "Select/Scan Serial" : "Select/Scan Batch"}
                                                    style={styles.fieldInput}
                                                    value={b.batch_no}
                                                    onChangeText={v => {
                                                        handleBatchChange(i, 'batch_no', v);
                                                        setShowSuggestionsIndex(i);
                                                    }}
                                                    onFocus={() => setShowSuggestionsIndex(i)}
                                                />
                                                {b.batch_no.trim() !== '' && availableTrackedItems.some(item => item.name === b.batch_no) && (
                                                    <Check size={14} color="#10b981" style={{ marginRight: 8 }} />
                                                )}
                                                <TouchableOpacity onPress={() => { setScannedBatchIndex(i); setIsScanningBatch(true); }}>
                                                    <Scan size={16} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>

                                            {showSuggestionsIndex === i && (
                                                <View style={styles.suggestionsContainer}>
                                                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                        {availableTrackedItems
                                                            .filter(item => item.name.toLowerCase().includes(b.batch_no.toLowerCase()))
                                                            .slice(0, 20)
                                                            .map((item, idx) => (
                                                                <TouchableOpacity
                                                                    key={idx}
                                                                    style={styles.suggestionItem}
                                                                    onPress={() => {
                                                                        handleBatchChange(i, 'batch_no', item.name);
                                                                        setShowSuggestionsIndex(null);
                                                                    }}
                                                                >
                                                                    <Text style={styles.suggestionText}>{item.name}</Text>
                                                                </TouchableOpacity>
                                                            ))
                                                        }
                                                        {availableTrackedItems.length === 0 && (
                                                            <View style={styles.suggestionItem}>
                                                                <Text style={[styles.suggestionText, { color: '#94a3b8' }]}>{t('no_items_in_stock', 'No items in stock')}</Text>
                                                            </View>
                                                        )}
                                                    </ScrollView>
                                                </View>
                                            )}
                                        </View>

                                        <View style={[styles.fieldInputGroup, { width: '100%', marginTop: 12 }]}>
                                            <Text style={styles.qtyInputLabel}>{t('qty', 'Qty:')}</Text>
                                            <TextInput
                                                placeholder="Quantity"
                                                style={styles.fieldInput}
                                                value={b.qty.toString()}
                                                keyboardType="numeric"
                                                onChangeText={v => handleBatchChange(i, 'qty', v)}
                                                editable={!selectedItem?.has_serial_no}
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addBatchBtnRow} onPress={handleAddBatch}>
                                <Plus size={18} color="#7634bc" />
                                <Text style={styles.addBatchBtnText}>{t('add_more', 'Add More')}</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowBatchSlider(false)}>
                                <Text style={styles.modalCancelText}>{t('cancel', 'Cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSave} onPress={handleSaveBatchesInfo}>
                                <Text style={styles.modalSaveText}>{t('save', 'Save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Scanners */}
            <Modal
                visible={isScanningItem || isScanningBatch || isScanningWarehouse}
                statusBarTranslucent
                onRequestClose={() => { setIsScanningItem(false); setIsScanningBatch(false); setIsScanningWarehouse(false); }}
            >
                <CameraView
                    style={StyleSheet.absoluteFill}
                    onBarcodeScanned={({ data }) => {
                        if (isScanningItem) onItemScanned({ data });
                        if (isScanningBatch) onBatchScanned({ data });
                        if (isScanningWarehouse) onWarehouseScanned({ data });
                    }}
                />
                <TouchableOpacity style={styles.closeScannerBtn} onPress={() => { setIsScanningItem(false); setIsScanningBatch(false); setIsScanningWarehouse(false); }}>
                    <X size={30} color="#fff" />
                </TouchableOpacity>
            </Modal>

            <ConfirmationModal
                visible={alertData.visible}
                title={alertData.title}
                message={alertData.message}
                confirmText="Okay"
                isAlert={true}
                iconType={alertData.isError ? "delete" : "submit"}
                isDestructive={alertData.isError}
                onConfirm={() => {
                    setAlertData({ ...alertData, visible: false });
                    if (alertData.onClose) alertData.onClose();
                }}
                onCancel={() => {
                    setAlertData({ ...alertData, visible: false });
                    if (alertData.onClose) alertData.onClose();
                }}
            />

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Dispatch & Shipping"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_ship') && !hasPermission('can_pack')) {
                        router.back();
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1 },
    poInfoCard: {
        marginHorizontal: 20,
        marginTop: 12,
        marginBottom: 8,
        padding: 20,
        borderRadius: 24,
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    poInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    idBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
    },
    poIdText: { fontSize: 15, fontWeight: '900', color: '#fff', fontFamily: Fonts.rounded },
    supplierText: { fontSize: 14, color: '#e9d5ff', fontFamily: Fonts.sans, fontWeight: '500' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
    stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepWrapper: { alignItems: 'center', zIndex: 2 },
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
    stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
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
    stepContent: { padding: 20 },
    searchBarWrapper: { marginBottom: 20 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
        height: 54,
        paddingLeft: 14,
        paddingRight: 4,
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 14,
        color: '#0f172a',
        fontFamily: Fonts.sans,
        paddingVertical: 0,
        marginLeft: 8,
    },
    scanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f3ff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 6,
        marginRight: 4,
    },
    scanText: { fontSize: 12, fontWeight: 'bold', color: '#7634bc', fontFamily: Fonts.rounded },
    listTitle: { fontSize: 15, fontWeight: '800', color: '#2e1065', marginBottom: 15, fontFamily: Fonts.sans, letterSpacing: -0.2 },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 16,
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.03,
        shadowRadius: 15,
        elevation: 2,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    itemIdentity: {
        flexDirection: 'row',
        gap: 12,
        flex: 1,
    },
    indexBadge: {
        width: 36,
        height: 36,
        backgroundColor: '#f5f3ff',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    indexText: { fontSize: 14, fontWeight: 'bold', color: '#7634bc' },
    itemTextContainer: { flex: 1 },
    itemCode: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', letterSpacing: -0.3 },
    itemName: { fontSize: 13, color: '#64748b', marginTop: 2, lineHeight: 18, fontFamily: Fonts.sans },
    qtyContainerItem: { alignItems: 'flex-end', marginLeft: 12 },
    qtyTextItem: { fontSize: 19, fontWeight: '900', color: '#2e1065' },
    qtyUomItem: { fontSize: 11, fontWeight: '800', color: '#7634bc', marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 14,
        marginTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    locationInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    warehouseText: { flex: 1, fontSize: 12, color: '#94a3b8', fontWeight: '500' },
    tagBadge: { backgroundColor: '#f5f3ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tagText: { fontSize: 10, fontWeight: 'bold', color: '#7634bc', fontFamily: Fonts.sans },
    qtyContainer: { marginBottom: 80 },
    activePickCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 3,
    },
    activeItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    activeItemIdentity: {
        flexDirection: 'row',
        gap: 16,
        flex: 1,
    },
    activeIndexBadge: {
        width: 44,
        height: 44,
        backgroundColor: '#f5f3ff',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e9d5ff',
    },
    activeItemCode: { fontSize: 18, fontWeight: '900', color: '#2e1065', letterSpacing: -0.5 },
    activeItemName: { fontSize: 14, color: '#64748b', marginTop: 4, lineHeight: 20 },
    targetQtyBox: {
        alignItems: 'flex-end',
        marginLeft: 16,
    },
    targetQtyText: { fontSize: 28, fontWeight: '900', color: '#2e1065', letterSpacing: -1 },
    targetUomText: { fontSize: 12, fontWeight: '800', color: '#7634bc', marginTop: -2, textTransform: 'uppercase' },
    locationBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#faf5ff',
        padding: 12,
        borderRadius: 14,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#f3e8ff',
        gap: 8,
    },
    locationText: { fontSize: 14, fontWeight: '600', color: '#7634bc', flex: 1 },
    formGroup: { marginBottom: 24 },
    formLabel: { fontSize: 15, fontWeight: 'bold', color: '#2e1065', marginBottom: 10, fontFamily: Fonts.rounded },
    formInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingLeft: 12,
        paddingRight: 4,
        height: 54,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    formInput: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        color: '#0f172a',
        fontFamily: Fonts.sans,
        paddingVertical: 0,
        marginLeft: 8,
    },
    selectedWarehouseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#faf5ff',
        padding: 16,
        borderRadius: 18,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#f3e8ff',
        gap: 12
    },
    warehouseIconFrame: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center' },
    warehouseName: { fontSize: 14, fontWeight: 'bold', color: '#2e1065', fontFamily: Fonts.rounded },
    warehouseCompany: { fontSize: 11, color: '#94a3b8', fontFamily: Fonts.sans },
    warehouseDropdown: {
        backgroundColor: '#fff',
        borderRadius: 18,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 6,
        maxHeight: 250,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 5,
    },
    warehouseItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 12 },
    trackingSection: { marginBottom: 24 },
    trackingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 15,
        elevation: 2
    },
    trackingInfo: { flex: 1 },
    addTrackingBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    addTrackingIcon: { fontSize: 18, fontWeight: 'bold', color: '#7634bc' },
    addTrackingText: { fontSize: 15, fontWeight: 'bold', color: '#2e1065', fontFamily: Fonts.rounded },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        justifyContent: 'center',
    },
    qtyBtn: {
        width: 56,
        height: 56,
        borderRadius: 18,
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
        minWidth: 120,
        height: 56,
        backgroundColor: '#faf5ff',
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#f3e8ff',
    },
    qtyValue: { fontSize: 26, fontWeight: 'bold', color: '#2e1065', fontFamily: Fonts.rounded, letterSpacing: -0.5 },
    uomText: { fontSize: 16, fontWeight: '700', color: '#7634bc', fontFamily: Fonts.sans, textTransform: 'uppercase' },
    unifiedFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    },
    bottomActionsInner: {
        marginBottom: 12,
    },
    pillNavbarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    step1Buttons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    cancelBtnView: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd6fe' },
    cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#2e1065', fontFamily: Fonts.sans },
    reviewBtnView: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd6fe' },
    reviewBtnViewActive: { backgroundColor: '#f5f3ff' },
    reviewBtnText: { fontSize: 14, fontWeight: '700', color: '#2e1065', fontFamily: Fonts.sans },
    submitBtnView: {
        flex: 1.4,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#cbd5e1',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    submitBtnViewActive: {
        backgroundColor: '#2e1065',
        shadowColor: '#2e1065',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    submitBtnViewDisabled: {
        backgroundColor: '#e2e8f0',
    },
    submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: Fonts.sans },
    step2Buttons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    backBtnForm: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, borderWidth: 1.5, borderColor: '#ddd6fe' },
    backBtnFormText: { fontSize: 14, fontWeight: '700', color: '#2e1065', fontFamily: Fonts.sans },
    addGrnBtn: {
        flex: 2,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#2e1065',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        shadowColor: '#2e1065',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    addGrnBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: Fonts.sans },
    pillNavbar: {
        flexDirection: 'row',
        backgroundColor: '#1e1b4b',
        borderRadius: 30,
        padding: 6,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
    },
    pillBackBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', opacity: 0.8 },
    pillDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
    pillNavBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, borderRadius: 22, gap: 8 },
    pillNavBtnActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
    pillNavTextActive: { fontSize: 12, fontWeight: '900', color: '#fff', fontFamily: Fonts.sans, letterSpacing: 0.5 },
    pillNavText: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', fontFamily: Fonts.sans },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
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
    modalHeaderTitleContainer: { flex: 1, marginRight: 16 },
    modalIconBg: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#faf5ff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f3e8ff',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#2e1065',
        fontFamily: Fonts.rounded,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
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
    batchScroll: { marginBottom: 20 },
    batchCard: { backgroundColor: '#faf5ff', padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#f3e8ff' },
    fieldInputGroup: {
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
    fieldInput: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        height: '100%',
        fontFamily: Fonts.sans,
        paddingVertical: 0,
        marginLeft: 8,
    },
    addBatchBtnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 15,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 14,
        marginTop: 8,
    },
    addBatchBtnText: { fontWeight: 'bold', fontFamily: Fonts.rounded, color: '#7634bc' },
    modalActions: { flexDirection: 'row', gap: 12 },
    modalCancel: { flex: 1, height: 56, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    modalCancelText: { fontWeight: 'bold', color: '#64748b', fontFamily: Fonts.rounded },
    modalSave: {
        flex: 2,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#7634bc',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    modalSaveText: { fontWeight: 'bold', color: '#fff', fontFamily: Fonts.rounded },
    closeScannerBtn: { position: 'absolute', top: 50, right: 30, zIndex: 10 },
    successOverlay: { backgroundColor: 'rgba(21, 2, 71, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 40, zIndex: 2000 },
    successContent: { alignItems: 'center', width: '100%' },
    successCheckBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
    successTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 10, fontFamily: Fonts.rounded },
    successSubtitle: { fontSize: 15, color: '#e9d5ff', textAlign: 'center', marginBottom: 35, fontFamily: Fonts.sans },
    successButton: {
        backgroundColor: '#fff',
        width: '100%',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    successButtonText: { fontSize: 16, fontWeight: 'bold', color: '#7634bc', fontFamily: Fonts.rounded },
    reviewHeader: { marginBottom: 20 },
    reviewSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, fontFamily: Fonts.sans },
    receivedItemCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    receivedItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    receivedItemName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 2, fontFamily: Fonts.rounded },
    receivedItemCode: { fontSize: 12, color: '#64748b', fontFamily: Fonts.sans },
    receivedItemQtySection: { alignItems: 'flex-end' },
    receivedItemQty: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', fontFamily: Fonts.rounded },
    receivedItemWarehouse: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontFamily: Fonts.sans },
    receivedItemTracking: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f8fafc' },
    receivedItemTrackingText: { fontSize: 12, color: '#94a3b8', fontFamily: Fonts.sans },
    reviewSummary: {
        marginTop: 20,
        padding: 20,
        backgroundColor: '#faf5ff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f3e8ff',
        gap: 12
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { fontSize: 14, color: '#64748b', fontFamily: Fonts.sans },
    summaryValue: { fontSize: 14, fontWeight: 'bold', color: '#2e1065', fontFamily: Fonts.rounded },
    draftBadge: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    draftBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', fontFamily: Fonts.sans, letterSpacing: 1 },
    draftWarningBoard: { backgroundColor: 'rgba(254, 243, 199, 0.15)', padding: 12, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: 'rgba(254, 243, 199, 0.3)' },
    draftWarningText: { fontSize: 11, color: '#fef3c7', fontWeight: '500', textAlign: 'center', fontFamily: Fonts.sans, lineHeight: 16 },
    suggestionsContainer: {
        position: 'absolute',
        top: 54, // Height of the input field
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        zIndex: 1000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    suggestionItem: {
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc'
    },
    suggestionText: { fontSize: 14, color: '#0f172a', fontWeight: '500', fontFamily: Fonts.sans },
    qtyInputLabel: { fontSize: 13, color: '#64748b', fontWeight: 'bold', marginRight: 8, fontFamily: Fonts.sans, marginLeft: 8 },
});