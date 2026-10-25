
import { TopNavbar } from '@/components/TopNavbar';
import { ConfirmationModal, PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { Fonts } from '@/constants/theme';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { useCompanyContext } from '@/context/CompanyContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Calendar,
    Check,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    FileText,
    Minus,
    Package,
    Plus,
    Scan,
    Search,
    Trash2,
    X,
    MapPin,
    Sparkles,
    Pencil
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
    View,
    RefreshControl,
    useWindowDimensions
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function GRNScreen() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { getResource, postResource, putResource, deleteResource, callMethod, loading: frappeLoading } = useFrappe();
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const { height: windowHeight } = useWindowDimensions();

    useEffect(() => {
        if (!hasPermission('can_receive')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

    const [submitted, setSubmitted] = useState(false);
    const [poDetails, setPoDetails] = useState<any>(null);
    const [draftPRName, setDraftPRName] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [receivedItems, setReceivedItems] = useState<any[]>([]);
    const [alertData, setAlertData] = useState<{ visible: boolean; title: string; message: string; isError?: boolean }>({ visible: false, title: '', message: '', isError: true });
    const [refreshing, setRefreshing] = useState(false);
    const [dimensionValues, setDimensionValues] = useState<Record<string, string>>({});
    const [dimensionSearch, setDimensionSearch] = useState<Record<string, string>>({});
    const [showDimDropdown, setShowDimDropdown] = useState<string | null>(null);
    const [dimensionOptions, setDimensionOptions] = useState<Record<string, any[]>>({});
    const [rejectedDimensionValues, setRejectedDimensionValues] = useState<Record<string, string>>({});
    const [rejectedDimensionSearch, setRejectedDimensionSearch] = useState<Record<string, string>>({});
    const [showRejectedDimDropdown, setShowRejectedDimDropdown] = useState<string | null>(null);
    const [showFooter, setShowFooter] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [wasScanned, setWasScanned] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchPODetails(),
            fetchWarehouses(),
            fetchLocations(),
            fetchInventoryDimention(),
        ]);
        setRefreshing(false);
    };


    // Step 2 inputs
    const [qty, setQty] = useState(0);
    const [warehouse, setWarehouse] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [inventoryDimention, setInventoryDimention] = useState<any[]>([]);
    const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
    const [isScanningWarehouse, setIsScanningWarehouse] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // Putaway rules state
    const [applyPutawayRule, setApplyPutawayRule] = useState(false);
    const [putawaySuggestions, setPutawaySuggestions] = useState<Record<string, any>>({});

    // Batch/Serial Slider state
    const [showBatchSlider, setShowBatchSlider] = useState(false);
    const [batches, setBatches] = useState<any[]>([{ batch_no: '', serial_no: '', qty: 0, expiry_date: '' }]);
    const [batchList, setBatchList] = useState<any[]>([]); //get batch lis from backend for dropdown
    const [showBatchDropdownIndex, setShowBatchDropdownIndex] = useState<number | null>(null);
    // New Scan & Search states
    const [isScanningItem, setIsScanningItem] = useState(false);
    const [isScanningBatch, setIsScanningBatch] = useState(false);
    const [itemSearch, setItemSearch] = useState('');
    const [scannedBatchIndex, setScannedBatchIndex] = useState<{ index: number; field: 'batch_no' | 'serial_no' } | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [targetEfficacy, setTargetEfficacy] = useState<number | null>(null);
    const [prItemFields, setPrItemFields] = useState<string[]>([]);
    // Suggestion list toggle & pagination
    const [showWHSuggestions, setShowWHSuggestions] = useState(true);
    const [whDropPage, setWhDropPage] = useState(0);
    const [showDimSuggestions, setShowDimSuggestions] = useState<Record<string, boolean>>({});
    const [dimDropPage, setDimDropPage] = useState<Record<string, number>>({});
    const [batchDropPage, setBatchDropPage] = useState<Record<number, number>>({});
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const { defaultCurrency } = useCompanyContext();
    const WH_PAGE_SIZE = 8;
    const DIM_PAGE_SIZE = 8;
    const BATCH_PAGE_SIZE = 8;



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


    useEffect(() => {
        fetchPODetails();
    }, [id]);
    const getBatchList = async (itemCode?: string) => {
        try {
            const data = await getResource("Batch", undefined, {
                filters: JSON.stringify({
                    item: itemCode,
                    disabled: 0
                }),
                fields: JSON.stringify([
                    "name",
                    "batch_id",
                    "expiry_date"
                ]),
                order_by: "creation desc",
                limit_page_length: 100
            });

            setBatchList(data || []);
        } catch (err) {
            console.log("Failed to fetch batches", err);
        }
    };

    const fetchWarehouses = async () => {
        try {
            if (!poDetails?.company) return;
            const data = await getResource('Warehouse', undefined, {
                filters: JSON.stringify({ disabled: 0, is_group: 0, company: poDetails.company }),
                fields: '["name", "warehouse_name", "company"]',
                limit_page_length: 1000
            });
            if (Array.isArray(data)) {
                setWarehouses(data);
            }
        } catch (err) {
            console.warn('Failed to fetch warehouses:', err);
        }
    };

    const fetchLocations = async () => {
        try {
            const data = await getResource('Location', undefined, {
                filters: JSON.stringify({ is_group: 0 }),
                fields: '["name"]',
                limit_page_length: 1000
            });
            if (Array.isArray(data)) {
                setLocations(data);
            }
        } catch (err) {
            console.warn('Failed to fetch locations:', err);
        }
    };

    const fetchInventoryDimention = async () => {
        try {
            const data = await getResource('Inventory Dimension', undefined, {
                filters: JSON.stringify({ apply_to_all_doctypes: 1 }),
                fields: '["*"]',
                limit_page_length: 1000
            });
            setInventoryDimention(data);

            const optionsMap: Record<string, any[]> = {};
            for (const dim of data) {
                optionsMap[dim.target_fieldname] = [];
            }
            console.log(optionsMap, 'optionsMap------->');
            setDimensionOptions(optionsMap);
            console.log('diemention  option  in list------------>', setDimensionOptions);
        } catch (error) {
            console.log('Failed to fetch inventory dimensions:', error);
        }
    };

    const handleDimensionSearch = async (target_fieldname: string, reference_document: string, text: string, isRejected: boolean = false) => {
        if (isRejected) {
            setRejectedDimensionSearch(prev => ({ ...prev, [target_fieldname]: text }));
            setShowRejectedDimDropdown(target_fieldname);
        } else {
            setDimensionSearch(prev => ({ ...prev, [target_fieldname]: text }));
            setShowDimDropdown(target_fieldname);
        }

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

    if (inventoryDimention.length > 0) {
        console.log('inventory dimention list ---------->', inventoryDimention);

    }
    useEffect(() => {
        if (poDetails?.company) {
            fetchWarehouses();
            fetchLocations();
            fetchInventoryDimention();
        }
    }, [poDetails?.company]);

    useEffect(() => {
        if (applyPutawayRule && selectedItem) {
            fetchPutawaySuggestion(selectedItem.item_code, qty).then(suggestion => {
                if (suggestion && suggestion.warehouse) {
                    const wh = warehouses.find(
                        w => w.name === suggestion.warehouse
                    );

                    if (wh && wh.is_group) {
                        setAlertData({
                            visible: true,
                            title: 'Invalid Warehouse Location',
                            message: `The Putaway Rule suggested "${wh.name}", which is a Group Node (folder) and cannot store inventory directly. Please check your Putaway Rules in ERPNext.`,
                            isError: true
                        });
                        return;
                    }



                    // Auto-apply dimension values from the Putaway Rule automatically on item select/qty change
                    const newDimVals = { ...dimensionValues };
                    let dimUpdated = false;
                    for (const dim of inventoryDimention) {
                        const valFromRule = suggestion[dim.source_fieldname] || suggestion[dim.target_fieldname];
                        if (valFromRule) {
                            newDimVals[dim.target_fieldname] = valFromRule;
                            dimUpdated = true;
                        }
                    }
                    if (dimUpdated) {
                        setDimensionValues({});
                    }

                    setPutawaySuggestions(prev => ({
                        ...prev,
                        [selectedItem.item_code]: suggestion
                    }));
                }
            });
            console.log(fetchPutawaySuggestion(selectedItem.item_code, qty), 'putaway suggestion------------------>');
        }
    }, [applyPutawayRule, selectedItem, qty]);

    const handleOpenScanner = async () => {
        const { status } = await requestPermission();
        if (status === 'granted') {
            setIsScanningWarehouse(true);
        } else {
            setAlertData({ visible: true, title: 'Permission needed', message: 'Camera permission is required to scan.', isError: true });
        }
    };

    const onWarehouseScanned = ({ data }: { data: string }) => {
        setIsScanningWarehouse(false);
        const cleaned = data.trim().toLowerCase();

        // Check if it is an item barcode instead of a warehouse
        const isItem = poDetails?.items?.some((i: any) => {
            if (i.item_code && i.item_code.toLowerCase() === cleaned) return true;
            if (i.barcodes && i.barcodes.some((b: string) => b.toLowerCase() === cleaned)) return true;
            return false;
        });

        if (isItem) {
            Alert.alert(
                t('invalid_warehouse_barcode', 'Invalid Warehouse Barcode'),
                t('scanned_item_barcode_wh_msg', 'You scanned an item barcode instead of a warehouse barcode. Please scan a valid warehouse.')
            );
            return;
        }

        const wh = warehouses.find(w => w.name === data || w.warehouse_name === data);
        if (wh) {
            // setSelectedWarehouse(wh);
            setWarehouse('');
            setShowWarehouseDropdown(false);
        } else {
            // If not found in current list, just set the text so they can search
            setWarehouse(data);
            setShowWarehouseDropdown(true);
        }
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
            // New batch/serial entry depending on item tracking
            if (selectedItem?.has_serial_no) {
                setBatches(prev => [...prev.filter(b => b.serial_no !== ''), { batch_no: '', serial_no: data, qty: 1, expiry_date: '' }]);
            } else {
                setBatches(prev => [...prev.filter(b => b.batch_no !== ''), { batch_no: data, serial_no: '', qty: 1, expiry_date: '' }]);
            }
        }
    };

    async function fetchPutawaySuggestion(itemCode: string, qtyValue: number,) {
        try {
            const rules = await getResource('Putaway Rule', undefined, {
                filters: JSON.stringify([
                    ['item_code', '=', itemCode],
                    ['company', '=', poDetails?.company],
                    ['disable', '=', 0]
                ]),
                fields: '["*"]',
                order_by: 'priority asc',
                limit_page_length: 5
            });
            if (Array.isArray(rules) && rules.length > 0) {
                return { ...rules[0], warehouse: rules[0].warehouse, qty: qtyValue };
            }
        } catch (err) {
            console.warn('Putaway Rule query failed:', err);
        }
        return null;
    };

    const onItemScanned = ({ data }: { data: string }) => {
        setIsScanningItem(false);
        const scanData = data.trim().toLowerCase();

        let cleanedScanData = scanData;
        if (scanData.includes('/')) {
            const parts = scanData.split('/');
            cleanedScanData = parts[parts.length - 1];
        }

        const item = poDetails?.items?.find((i: any) => {
            if (i.item_code && i.item_code.toLowerCase() === cleanedScanData) return true;
            if (i.item_name && i.item_name.toLowerCase().includes(cleanedScanData)) return true;
            if (i.barcodes && i.barcodes.some((b: string) => b.toLowerCase() === cleanedScanData)) return true;
            return false;
        });

        if (item) {
            const isAlreadyAdded = receivedItems.some(ri => ri.name === item.name);
            if (isAlreadyAdded) {
                setAlertData({ visible: true, title: 'Already Added', message: `Item ${item.item_code} is already added to the GRN.`, isError: true });
                return;
            }

            const pendingQty = item.qty - (item.received_qty || 0);
            if (pendingQty <= 0) {
                setAlertData({ visible: true, title: 'Fully Received', message: `Item ${item.item_code} is already fully received.`, isError: true });
                return;
            }

            handleItemSelect(item, true);
        } else {
            const availableItems = poDetails?.items?.map((i: any) =>
                `${i.item_code} (${i.barcodes ? i.barcodes.join(',') : 'no barcodes'})`
            ).join(' | ');

            setItemSearch(cleanedScanData);
            setAlertData({
                visible: true,
                title: 'Item Not Found (Debug)',
                message: `Camera Saw: "${cleanedScanData}"\n\nLooking for:\n${availableItems}`,
                isError: true
            });
        }
    };

    const handleSaveBatchesInfo = () => {
        const totalQty = batches.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0);
        console.log('total qty------------------------>', batches, totalQty);

        setQty(totalQty);
        setShowBatchSlider(false);

    };

    const formatExpiryDate = (dateStr?: string) => {
        if (!dateStr || dateStr.trim() === '') return undefined;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
            let [d, m, y] = parts;
            if (y.length === 2) y = '20' + y;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return dateStr;
    };

    const resolveFieldNameForDimension = (dim: any, fieldsList: string[]) => {

        if (fieldsList.length > 0 && fieldsList.includes(dim.target_fieldname)) {
            return dim.target_fieldname;  // Some ERPNext setups use target name directly
        }
        if (fieldsList.length > 0 && fieldsList.includes(dim.source_fieldname)) {
            return dim.source_fieldname;
        }
        // Fallback: source_fieldname is the transaction-document convention
        return dim.source_fieldname || dim.target_fieldname;
    };

    const resolveRejectedFieldNameForDimension = (dim: any, fieldsList: string[]) => {
        const sourceRej = `rejected_${dim.source_fieldname}`;
        const targetRej = `rejected_${dim.target_fieldname}`;
        if (fieldsList.length > 0 && fieldsList.includes(targetRej)) {
            return targetRej;
        }
        if (fieldsList.length > 0 && fieldsList.includes(sourceRej)) {
            return sourceRej;
        }
        // Fallback: source-based rejected field is the transaction-document convention
        return sourceRej || targetRej;
    };

    const handleSubmitGRN = async () => {
        if (receivedItems.length === 0) return;

        if (poDetails?.docstatus === 0) {
            setAlertData({ visible: true, title: 'Cannot Submit', message: 'This Purchase Order is in DRAFT status. Please SUBMIT it in ERPNext first before receiving items.', isError: true });
            return;
        }


        for (const item of receivedItems) {
            for (const dim of inventoryDimention) {
                if (!dim.reqd) continue;
                const val =
                    item[dim.target_fieldname] ||
                    item.dimensionValues?.[dim.target_fieldname];
                if (!val) {
                    setAlertData({
                        visible: true,
                        title: 'Dimension Value Required',
                        message: `Item "${item.item_name || item.item_code}" is missing a required value for "${dim.dimension_name}". Please edit the item and select a ${dim.dimension_name} before submitting.`,
                        isError: true
                    });
                    return;
                }
            }
        }

        const createdBundles: string[] = [];
        try {
            setLoading(true);

            // Format items for Purchase Receipt
            const prItems: any[] = [];

            for (const item of receivedItems) {
                let bundleName = '';

                // For tracked items (ERPNext v15+ flow: Serial and Batch Bundle)
                if (item.has_serial_no || item.has_batch_no) {

                    for (const b of item.batches) {
                        // ---------------- Batch ----------------
                        if (item.has_batch_no && b.batch_no) {

                            const existingBatch = await getResource(
                                "Batch",
                                undefined,
                                {
                                    filters: JSON.stringify({
                                        batch_id: b.batch_no,
                                        item: item.item_code
                                    }),
                                    fields: '["name","batch_id"]',
                                    limit_page_length: 1
                                }
                            );

                            if (!existingBatch || existingBatch.length === 0) {

                                const batchPayload: any = {
                                    batch_id: b.batch_no,
                                    item: item.item_code,
                                    expiry_date: formatExpiryDate(b.expiry_date),
                                };

                                if (
                                    item.efficacyFieldToSend &&
                                    item.target_efficacy !== undefined
                                ) {
                                    batchPayload[item.efficacyFieldToSend] =
                                        item.target_efficacy;
                                }

                                //@ts-ignore
                                await postResource(
                                    "Batch",
                                    batchPayload,
                                    false
                                );
                            } else {
                                console.log(`Batch ${b.batch_no} already exists.`);
                            }
                        }

                        // ---------------- Serial ----------------
                        if (item.has_serial_no && b.serial_no) {

                            const existingSerial = await getResource(
                                "Serial No",
                                undefined,
                                {
                                    filters: JSON.stringify({
                                        serial_no: b.serial_no
                                    }),
                                    fields: '["name","serial_no"]',
                                    limit_page_length: 1
                                }
                            );

                            if (!existingSerial || existingSerial.length === 0) {

                                //@ts-ignore
                                await postResource(
                                    "Serial No",
                                    {
                                        serial_no: b.serial_no,
                                        item_code: item.item_code,
                                        batch_no: item.has_batch_no
                                            ? b.batch_no
                                            : undefined,
                                    },
                                    false
                                );

                            } else {
                                console.log(`Serial ${b.serial_no} already exists.`);
                            }
                        }
                    }

                    const bundleData = {
                        doctype: 'Serial and Batch Bundle',
                        item_code: item.item_code,
                        warehouse: item.warehouse || 'Stores',
                        company: poDetails.company,
                        type: 'Inward',
                        voucher_type: 'Purchase Receipt',
                        type_of_transaction: 'Inward', // Alternative field name for some versions
                        has_serial_no: item.has_serial_no ? 1 : 0,
                        has_batch_no: item.has_batch_no ? 1 : 0,
                        entries: item.batches.map((b: any) => ({
                            batch_no: item.has_batch_no ? b.batch_no : undefined,
                            serial_no: item.has_serial_no ? b.serial_no : undefined,
                            qty: b.qty
                        }))
                    };

                    console.log('bundle date---------------------------->', bundleData);

                    try {
                        //@ts-ignore
                        const bundle = await postResource('Serial and Batch Bundle', bundleData, false);
                        bundleName = bundle.name;
                        if (bundleName) createdBundles.push(bundleName);
                    } catch (err: any) {
                        console.error('SBB Creation Error:', err);
                        throw new Error(`Failed to create Bundle for ${item.item_name}: ${err.message}`);
                    }
                }

                const dynamicDimensions: any = {};
                inventoryDimention.forEach((dim: any) => {
                    const val =
                        item[dim.target_fieldname] ||
                        item.dimensionValues?.[dim.target_fieldname];
                    if (val) {
                        const targetKey = resolveFieldNameForDimension(dim, prItemFields);
                        dynamicDimensions[targetKey] = val;
                        console.log(`[GRN-Dim] ${item.item_code} | dim=${dim.dimension_name} | val=${val} -> key=${targetKey}`);
                    }
                    const rejVal =
                        item[`rejected_${dim.target_fieldname}`] ||
                        item.rejectedDimensionValues?.[dim.target_fieldname];
                    if (rejVal) {
                        const targetRejKey = resolveRejectedFieldNameForDimension(dim, prItemFields);
                        dynamicDimensions[targetRejKey] = rejVal;
                        console.log(`[GRN-Dim] ${item.item_code} | rejected dim=${dim.dimension_name} | val=${rejVal} -> key=${targetRejKey}`);
                    }
                });
                console.log(`[GRN-Dim] final payload for ${item.item_code}:`, JSON.stringify(dynamicDimensions));

                const prItemPayload: any = {
                    item_code: item.item_code,
                    qty: item.received_qty_input,
                    rate: item.rate, // Mandatory to match PO
                    purchase_order_rate: item.rate,
                    warehouse: item.is_fixed_asset ? undefined : item.warehouse,
                    asset_location: item.is_fixed_asset ? item.warehouse : undefined,
                    uom: item.uom,
                    // Fallback to PO-level cost_center if item doesn't have one
                    cost_center: item.cost_center || poDetails.cost_center || undefined,
                    project: item.project || poDetails.project || undefined,
                    ...dynamicDimensions,
                    department: item.department || poDetails.department || 'All Departments',
                    purchase_order: poDetails.name,
                    purchase_order_item: item.name, // Link to PO row
                    serial_and_batch_bundle: bundleName || undefined,
                    use_serial_batch_fields: 0,
                };
                prItems.push(prItemPayload);
            }


            // Create Quality Inspections first if required
            for (let i = 0; i < receivedItems.length; i++) {
                const item = receivedItems[i];
                try {
                    const itemMaster = await getResource('Item', item.item_code);
                    const reqInspection = itemMaster?.inspection_required_before_purchase === 1 || itemMaster?.inspection_required_before_purchase === true || itemMaster?.inspection_required === 1 || itemMaster?.inspection_required === true || itemMaster?.quality_inspection_required === 1 || itemMaster?.quality_inspection_required === true;
                    if (reqInspection) {
                        console.log(`[Inspection] Item ${item.item_code} requires Quality Inspection.`);

                        let readings: any[] = [];
                        if (itemMaster?.quality_inspection_template) {
                            try {
                                const template = await getResource('Quality Inspection Template', itemMaster.quality_inspection_template);
                                const params = template?.item_quality_inspection_parameter || template?.parameters || template?.specifications || [];
                                if (Array.isArray(params)) {
                                    readings = params.map((param: any) => ({
                                        specification: param.specification,
                                        parameter: param.parameter,
                                        status: 'Accepted',
                                        reading: param.min_value !== undefined ? String(param.min_value) : (param.acceptance_criteria || 'Passed')
                                    }));
                                }
                            } catch (tempErr) {
                                console.warn('[Inspection] Failed to load template readings:', tempErr);
                            }
                        }

                        const qiPayload: any = {
                            doctype: 'Quality Inspection',
                            inspection_type: 'Incoming',
                            reference_type: 'Purchase Order',
                            reference_name: poDetails.name,
                            item_code: item.item_code,
                            item_name: item.item_name,
                            qty: item.received_qty_input,
                            sample_size: item.received_qty_input,
                            status: 'Accepted',
                            docstatus: 0,
                            readings: readings
                        };

                        const qi = await postResource('Quality Inspection', qiPayload, false);
                        if (qi && qi.name) {
                            console.log(`[Inspection] Created Draft Quality Inspection: ${qi.name}. Submitting it...`);
                            await callMethod('frappe.client.submit', { doc: { doctype: 'Quality Inspection', name: qi.name } }, false, undefined, true);

                            // Link Quality Inspection to the corresponding item row in prItems
                            if (prItems[i]) {
                                prItems[i].quality_inspection = qi.name;
                            }
                        }
                    }
                } catch (qiErr: any) {
                    console.error('[Inspection] Quality Inspection failed:', qiErr);
                    throw new Error(`Failed to create Quality Inspection for item ${item.item_code}: ${qiErr.message || qiErr}`);
                }
            }

            const purchaseReceipt: any = {
                doctype: 'Purchase Receipt',
                supplier: poDetails.supplier,
                company: poDetails.company,
                currency: poDetails.currency || defaultCurrency,
                conversion_rate: poDetails.conversion_rate || 1,
                posting_date: new Date().toISOString().split('T')[0],
                cost_center: poDetails.cost_center || prItems[0]?.cost_center || undefined,
                department: poDetails.department || prItems[0]?.department || undefined,
                apply_putaway_rule: applyPutawayRule ? 1 : 0,
                items: prItems,
                docstatus: 0
            };


            let currentPRName = draftPRName;
            let savedDoc: any;

            if (currentPRName) {
                purchaseReceipt.name = currentPRName;
                //@ts-ignore
                savedDoc = await putResource('Purchase Receipt', currentPRName, purchaseReceipt, false, undefined, false);
            } else {

                savedDoc = await postResource('Purchase Receipt', purchaseReceipt, false, undefined, false);
                currentPRName = savedDoc?.name || '';
            }

            if (!currentPRName) {
                throw new Error('Failed to create or retrieve draft Purchase Receipt.');
            }


            //@ts-ignore
            const submittedDoc = await putResource('Purchase Receipt', currentPRName, { docstatus: 1 }, false, undefined, false);
            let returnedPRName = submittedDoc?.name || currentPRName;

            setAlertData({
                visible: true,
                title: 'GRN Created Successfully',
                message: `Purchase Receipt ${returnedPRName} has been successfully generated in the system.`,
                isError: false
            });
        } catch (error: any) {
            console.error('Submit GRN Error:', error);
            // Cleanup orphaned bundles
            //@ts-ignore
            if (createdBundles && createdBundles.length > 0) {
                console.log(`[Rollback] Cleaning up ${createdBundles.length} orphaned bundles...`);
                for (const bundleName of createdBundles) {
                    try {
                        //@ts-ignore
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

    async function fetchPODetails() {
        try {
            setLoading(true);
            const poId = Array.isArray(id) ? id[0] : id;
            const data = await getResource('Purchase Order', poId);

            if (data?.apply_putaway_rule === 1) {
                setApplyPutawayRule(true);
            }

            // Fetch suggested warehouses and optionally initialize a Draft Purchase Receipt
            let suggestedWarehouses: Record<string, string> = {};
            let fetchedDraftPRName: string | null = null;

            try {
                // Call standard ERPNext backend method to make purchase receipt
                const draftPR = await callMethod('erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_receipt', {
                    source_name: poId
                });

                if (draftPR) {
                    if (draftPR.items) {
                        if (draftPR.items.length > 0) {
                            const fields = Object.keys(draftPR.items[0]);
                            setPrItemFields(fields);
                            console.log('[Fields] Populated prItemFields from draftPR items keys:', fields);
                        }
                        draftPR.items.forEach((item: any) => {
                            if (item.purchase_order_item) {
                                suggestedWarehouses[item.purchase_order_item] = item.warehouse;
                            }
                        });
                    }

                    // Check if a draft Purchase Receipt for this PO already exists in database
                    const existingDrafts = await getResource('Purchase Receipt', undefined, {
                        filters: JSON.stringify([
                            ['docstatus', '=', 0],
                            ['company', '=', data.company],
                            ['supplier', '=', data.supplier]
                        ]),
                        fields: '["name"]',
                        limit_page_length: 5
                    });

                    let foundDraft = null;
                    if (Array.isArray(existingDrafts)) {
                        for (const draft of existingDrafts) {
                            const fullDraft = await getResource('Purchase Receipt', draft.name);
                            const hasMatchingPO = fullDraft?.items?.some((i: any) => i.purchase_order === poId);
                            if (hasMatchingPO) {
                                foundDraft = fullDraft;
                                break;
                            }
                        }
                    }

                    if (foundDraft) {
                        fetchedDraftPRName = foundDraft.name;
                        if (foundDraft.items && foundDraft.items.length > 0) {
                            const fields = Object.keys(foundDraft.items[0]);
                            setPrItemFields(fields);
                            console.log('[Fields] Populated prItemFields from foundDraft items keys:', fields);
                        }
                    }
                }
            } catch (err) {
                console.warn('Failed to initialize Draft Purchase Receipt:', err);
            }

            setDraftPRName(fetchedDraftPRName);

            // Enrich items with tracking info and barcodes from Item master
            if (data && data.items) {
                const enritchedItems = await Promise.all(data.items.map(async (item: any) => {
                    const backendSuggestedWH = suggestedWarehouses[item.name];
                    try {
                        const itemMaster = await getResource('Item', item.item_code);
                        const barcodes = (itemMaster?.barcodes || []).map((b: any) => b.barcode).filter(Boolean);
                        if (itemMaster?.barcode && !barcodes.includes(itemMaster.barcode)) {
                            barcodes.push(itemMaster.barcode);
                        }

                        let efficacyFieldToSend: string | null = null;
                        if (item && 'lot_potency' in item) {
                            efficacyFieldToSend = 'lot_potency';
                        } else if (item && 'custom_target_efficacy' in item) {
                            efficacyFieldToSend = 'custom_target_efficacy';
                        } else if (item && 'target_efficacy' in item) {
                            efficacyFieldToSend = 'target_efficacy';
                        } else if (item && 'efficacy' in item) {
                            efficacyFieldToSend = 'efficacy';
                        } else if (itemMaster && 'lot_potency' in itemMaster) {
                            efficacyFieldToSend = 'lot_potency';
                        } else if (itemMaster && 'custom_target_efficacy' in itemMaster) {
                            efficacyFieldToSend = 'custom_target_efficacy';
                        } else if (itemMaster && 'target_efficacy' in itemMaster) {
                            efficacyFieldToSend = 'target_efficacy';
                        } else if (itemMaster && 'efficacy' in itemMaster) {
                            efficacyFieldToSend = 'efficacy';
                        }

                        return {
                            ...item,
                            has_serial_no: itemMaster?.has_serial_no ?? item.has_serial_no,
                            has_batch_no: itemMaster?.has_batch_no ?? item.has_batch_no,
                            is_fixed_asset: itemMaster?.is_fixed_asset ?? item.is_fixed_asset,
                            barcodes: barcodes,
                            default_warehouse: backendSuggestedWH || itemMaster?.default_warehouse || item.warehouse || undefined,
                            default_asset_location: itemMaster?.default_asset_location || undefined,
                            target_efficacy: item.target_efficacy ?? itemMaster?.target_efficacy ?? item.custom_target_efficacy ?? itemMaster?.custom_target_efficacy ?? item.lot_potency ?? itemMaster?.lot_potency ?? item.efficacy ?? itemMaster?.efficacy ?? 100,
                            efficacyFieldToSend: efficacyFieldToSend
                        };
                    } catch (e) {
                        let efficacyFieldToSend: string | null = null;
                        if (item && 'lot_potency' in item) {
                            efficacyFieldToSend = 'lot_potency';
                        } else if (item && 'custom_target_efficacy' in item) {
                            efficacyFieldToSend = 'custom_target_efficacy';
                        } else if (item && 'target_efficacy' in item) {
                            efficacyFieldToSend = 'target_efficacy';
                        } else if (item && 'efficacy' in item) {
                            efficacyFieldToSend = 'efficacy';
                        }
                        return {
                            ...item,
                            default_warehouse: backendSuggestedWH || item.warehouse || undefined,
                            target_efficacy: item.target_efficacy ?? item.custom_target_efficacy ?? item.lot_potency ?? item.efficacy ?? 100,
                            efficacyFieldToSend: efficacyFieldToSend
                        };
                    }
                }));
                data.items = enritchedItems;
            }

            setPoDetails(data);
        } catch (error) {
            console.error('Error fetching PO details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleItemSelect = (item: any, scanned: boolean = false) => {
        setWasScanned(scanned);

        let efficacyField = item.efficacyFieldToSend;
        if (!efficacyField) {
            if (prItemFields.includes('lot_potency')) {
                efficacyField = 'lot_potency';
            } else if (prItemFields.includes('custom_target_efficacy')) {
                efficacyField = 'custom_target_efficacy';
            } else if (prItemFields.includes('target_efficacy')) {
                efficacyField = 'target_efficacy';
            } else if (prItemFields.includes('efficacy')) {
                efficacyField = 'efficacy';
            }
        }

        const targetEff = item.target_efficacy !== undefined ? item.target_efficacy : (item.custom_target_efficacy !== undefined ? item.custom_target_efficacy : (item.lot_potency !== undefined ? item.lot_potency : (item.efficacy !== undefined ? item.efficacy : 100)));

        // Target efficacy starts blank, user must select or type it
        setTargetEfficacy(null);

        const enrichedItem = {
            ...item,
            efficacyFieldToSend: efficacyField,
            target_efficacy: targetEff
        };

        setSelectedItem(enrichedItem);
        if (enrichedItem.has_batch_no) {
            getBatchList(enrichedItem.item_code)
        }

        setWarehouse(''); // Clear warehouse search text
        const pendingQty = item.qty - item.received_qty;
        setQty(pendingQty);

        const isSerial = item.has_serial_no === 1 || item.has_serial_no === true;
        if (isSerial) {
            setBatches([{ batch_no: '', serial_no: '', qty: 1, expiry_date: '' }]);
        } else {
            setBatches([{ batch_no: '', serial_no: '', qty: pendingQty, expiry_date: '' }]);
        }

        if (item.is_fixed_asset) {
            setSelectedWarehouse(null);
        } else {
            if (item.default_warehouse) {
                const wh = warehouses.find(w => w.name === item.default_warehouse || w.warehouse_name === item.default_warehouse);
                if (wh) {
                    // setSelectedWarehouse(wh);
                } else {
                    // setSelectedWarehouse({
                    //     name: item.default_warehouse,
                    //     warehouse_name: item.default_warehouse.split(' - ')[0],
                    //     company: poDetails?.company
                    // });
                }
            } else if (item.warehouse) {
                const wh = warehouses.find(w => w.name === item.warehouse || w.warehouse_name === item.warehouse);
                if (wh) {
                    // setSelectedWarehouse(wh);
                } else {
                    // setSelectedWarehouse({
                    //     name: item.warehouse,
                    //     warehouse_name: item.warehouse.split(' - ')[0],
                    //     company: poDetails?.company
                    // });
                }
            } else {
                setSelectedWarehouse(null);
            }
        }

        // If putaway is enabled, fetch suggestion
        if (applyPutawayRule) {
            fetchPutawaySuggestion(item.item_code, pendingQty).then(suggestion => {
                if (suggestion && suggestion.warehouse) {
                    const wh = warehouses.find(
                        w => w.name === suggestion.warehouse
                    );

                    if (wh && wh.is_group) {
                        setAlertData({
                            visible: true,
                            title: 'Invalid Warehouse Location',
                            message: `The Putaway Rule suggested "${wh.name}", which is a Group Node (folder) and cannot store inventory directly. Please check your Putaway Rules in ERPNext.`,
                            isError: true
                        });
                        return;
                    }

                    if (wh) {
                        // setSelectedWarehouse(wh);
                    } else {
                        // setSelectedWarehouse({
                        //     name: suggestion.warehouse,
                        //     warehouse_name: suggestion.warehouse.split(' - ')[0],
                        //     company: poDetails?.company
                        // });
                    }

                    // Auto-apply dimension values from the Putaway Rule automatically on item select
                    const newDimVals = { ...dimensionValues };
                    let dimUpdated = false;
                    for (const dim of inventoryDimention) {
                        const valFromRule = suggestion[dim.source_fieldname] || suggestion[dim.target_fieldname];
                        if (valFromRule) {
                            newDimVals[dim.target_fieldname] = valFromRule;
                            dimUpdated = true;
                        }
                    }
                    // Only update state if we found dimensions to prevent unnecessary re-renders
                    if (dimUpdated) {
                        setDimensionValues(newDimVals);
                    }

                    setPutawaySuggestions(prev => ({
                        ...prev,
                        [item.item_code]: suggestion
                    }));
                }
            });
        }

        // Dimensions are no longer auto-filled. The user must manually confirm them from the suggestion pills.
        setDimensionValues({});
        setRejectedDimensionValues({});
        setStep(2);
    };

    const handleAddToGRN = () => {
        if (qty <= 0) {
            setAlertData({ visible: true, title: 'Invalid Quantity', message: 'Please enter a quantity greater than zero.', isError: true });
            return;
        }

        const pendingQty = selectedItem?.qty - (selectedItem?.received_qty || 0);
        if (qty > pendingQty) {
            setAlertData({
                visible: true,
                title: 'Quantity Limit Exceeded',
                message: `Oops! You entered ${qty}, but there are only ${pendingQty} left to receive on this order.\n\nPlease lower the quantity to match what is pending.`,
                isError: true
            });
            return;
        }

        // Validate warehouse
        if (!selectedWarehouse) {
            setAlertData({ visible: true, title: 'Warehouse Required', message: 'Please select a warehouse.', isError: true });
            return;
        }

        // Validate batches if tracked
        if (selectedItem?.has_serial_no || selectedItem?.has_batch_no) {
            if (batches.length === 1 && !selectedItem?.has_serial_no) {
                // Auto-sync the batch quantity with the main UI quantity for pure batches
                batches[0].qty = qty;
            } else {
                const totalBatchQty = batches.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0);
                if (totalBatchQty !== qty) {
                    setAlertData({ visible: true, title: 'Quantity Mismatch', message: `The sum of your batch/serial quantities (${totalBatchQty}) must match the total receiving quantity (${qty}). Please review the batch list.`, isError: true });
                    return;
                }
            }

            const hasInvalidBatch = batches.some(b => {
                const batchInvalid = selectedItem.has_batch_no && !b.batch_no;
                const serialInvalid = selectedItem.has_serial_no && !b.serial_no;
                const qtyInvalid = b.qty <= 0;
                return batchInvalid || serialInvalid || qtyInvalid;
            });
            if (hasInvalidBatch) {
                setAlertData({ visible: true, title: 'Incomplete Details', message: 'Please provide all required batch/serial numbers and quantities.', isError: true });
                return;
            }
        }

        // Validate mandatory dimensions
        for (const dim of inventoryDimention) {
            if (dim.reqd && !dimensionValues[dim.target_fieldname]) {
                setAlertData({ visible: true, title: 'Dimension Required', message: `Please enter a value for Target ${dim.dimension_name}`, isError: true });
                return;
            }
            // Rejected dimension is no longer mandatory, skipping validation
        }

        if (selectedItem?.efficacyFieldToSend && targetEfficacy === null) {
            setAlertData({ visible: true, title: 'Efficacy Required', message: 'Please enter or select a Target Efficacy.', isError: true });
            return;
        }

        const newItem = {
            ...selectedItem,
            received_qty_input: qty,
            warehouse: selectedWarehouse.name,
            originalWarehouse: selectedWarehouse,
            batches: [...batches],
            dimensionValues: { ...dimensionValues },
            rejectedDimensionValues: { ...rejectedDimensionValues },
            ...dimensionValues,
            ...rejectedDimensionValues,
            originalItem: selectedItem,
            efficacyFieldToSend: selectedItem?.efficacyFieldToSend,
            target_efficacy: targetEfficacy !== null ? targetEfficacy : undefined
        };

        if (editingItemIndex !== null) {
            const updatedItems = [...receivedItems];
            updatedItems[editingItemIndex] = newItem;
            setReceivedItems(updatedItems);
            setStep(3); // Go to review screen directly on edit/correction
        } else {
            setReceivedItems(prev => [...prev, newItem]);
            setStep(1); // Go back to item list
        }

        setSelectedItem(null);
        setWarehouse(''); // Reset warehouse search
        setSelectedWarehouse(null); // Reset selected warehouse for next item
        setEditingItemIndex(null);
        setTargetEfficacy(null);
        setDimensionValues({});
        setRejectedDimensionValues({});
    };

    const handleEditItem = (index: number) => {
        const item = receivedItems[index];
        setSelectedItem(item.originalItem);
        setSelectedWarehouse(item.originalWarehouse);
        setWarehouse(item.originalWarehouse.name);
        const savedBatches = item.batches || [];
        const isSerial = item.originalItem?.has_serial_no === 1 || item.originalItem?.has_serial_no === true;
        // For serial items: only restore rows that have an actual serial number entered
        const filteredBatches = isSerial
            ? savedBatches.filter((b: any) => b.serial_no && b.serial_no.trim() !== '')
            : savedBatches;
        setBatches(filteredBatches.length > 0 ? filteredBatches : [{ batch_no: '', serial_no: '', qty: isSerial ? 1 : (item.received_qty_input || 0), expiry_date: '' }]);
        setQty(item.received_qty_input);
        setDimensionValues(item.dimensionValues || {});
        setRejectedDimensionValues(item.rejectedDimensionValues || {});
        // Start blank unless explicitly editing
        setTargetEfficacy(item.target_efficacy !== undefined ? item.target_efficacy : null);
        setEditingItemIndex(index);
        setStep(2);
    };

    const handleRemoveItem = (index: number) => {
        const updatedItems = [...receivedItems];
        updatedItems.splice(index, 1);
        setReceivedItems(updatedItems);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0f172a" />
            </View>
        );
    }
    return (
        <View style={styles.container}>
            <TopNavbar showBackButton={false} />

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 140 : 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
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
                            <Text style={styles.poIdText}>{poDetails?.name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {poDetails?.docstatus === 0 && (
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
                        <Text style={styles.supplierText} numberOfLines={1}>{poDetails?.supplier}</Text>
                    </View>

                    {poDetails?.docstatus === 0 && (
                        <View style={styles.draftWarningBoard}>
                            <Text style={styles.draftWarningText}>{t('this_purchase_order_', 'This Purchase Order is not yet submitted. You can prepare the receipt, but cannot submit until it\'s Submitted in ERPNext.')}</Text>
                        </View>
                    )}
                </LinearGradient>

                {step === 1 && (
                    <Animated.View entering={FadeIn} style={styles.stepContent}>
                        {/* Apply Putaway Rule Checkbox Card */}
                        <View style={styles.checkboxCard}>
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setApplyPutawayRule(!applyPutawayRule)}
                            >
                                <View style={[styles.checkbox, applyPutawayRule && styles.checkboxChecked]}>
                                    {applyPutawayRule && <Check size={14} color="#fff" />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.checkboxLabel}>Apply Putaway Rule</Text>
                                    <Text style={styles.checkboxSublabel}>Automatically suggest warehouse locations based on capacity and priority</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

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
                                <TouchableOpacity
                                    style={styles.scanBtn}
                                    onPress={() => setIsScanningItem(true)}
                                >
                                    <Scan size={18} color="#0f172a" />
                                    <Text style={styles.scanText}>{t('scan', 'Scan')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={styles.listTitle}>
                            Pending Items ({poDetails?.items?.filter((i: any) =>
                                (i.qty - i.received_qty) > 0 &&
                                (i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || i.item_code.toLowerCase().includes(itemSearch.toLowerCase()))
                            ).length || 0})
                        </Text>

                        {(poDetails?.items || [])
                            .filter((item: any) =>
                                (item.qty - item.received_qty) > 0 &&
                                (item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) || item.item_code.toLowerCase().includes(itemSearch.toLowerCase()))
                            )
                            .map((item: any, idx: number) => {
                                const isAlreadyAdded = receivedItems.some(ri => ri.name === item.name);
                                if (isAlreadyAdded) return null;

                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.itemCard}
                                        onPress={() => handleItemSelect(item, false)}
                                    >
                                        <View style={styles.itemInfo}>
                                            <View style={styles.itemNameRow}>
                                                <Text style={styles.itemName}>{item.item_name}</Text>
                                                {(item.has_serial_no === 1 || item.has_batch_no === 1 || item.has_serial_no === true || item.has_batch_no === true) && (
                                                    <View style={styles.tagBadge}>
                                                        <Text style={styles.tagText}>{item.has_serial_no ? 'Serial' : 'Batch'}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.itemCode}>{item.item_code}</Text>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                <Text style={styles.pendingQty}>Pending: {item.qty - item.received_qty} {item.uom}</Text>
                                                {!!(item.warehouse || item.default_warehouse) && (
                                                    <Text style={{ fontSize: 11, color: '#7634bc', fontWeight: '700' }}>
                                                        WH: {(item.warehouse || item.default_warehouse).split(' - ')[0]}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                        <ChevronRight size={20} color="#94a3b8" />
                                    </TouchableOpacity>
                                );
                            })}

                        {receivedItems.length > 0 && (
                            <>
                                <Text style={[styles.listTitle, { marginTop: 20 }]}>Added to GRN ({receivedItems.length})</Text>
                                {receivedItems.map((item, idx) => (
                                    <View key={idx} style={[styles.itemCard, { opacity: 0.8 }]}>
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemName}>{item.item_name}</Text>
                                            <Text style={styles.itemCode}>{item.item_code}</Text>
                                            <Text style={[styles.pendingQty, { color: '#10b981' }]}>Receiving: {item.received_qty_input} {item.uom}</Text>
                                        </View>
                                        <Check size={20} color="#10b981" />
                                    </View>
                                ))}
                            </>
                        )}
                    </Animated.View>
                )}

                {step === 2 && (
                    <Animated.View entering={FadeIn} style={styles.stepContent}>
                        {wasScanned && (
                            <Animated.View
                                entering={FadeIn}
                                style={styles.scannedSuccessBanner}
                            >
                                <View style={styles.scannedSuccessIconCircle}>
                                    <Check size={18} color="#10b981" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.scannedSuccessTitle}>{t('item_scanned_successfully', 'Item Scanned Successfully')}</Text>
                                </View>
                            </Animated.View>
                        )}

                        <View style={[
                            styles.selectedItemPreview,
                            wasScanned && styles.selectedItemPreviewScanned
                        ]}>
                            {wasScanned && (
                                <View style={styles.scannedLabelBadge}>
                                    <Scan size={10} color="#fff" />
                                    <Text style={styles.scannedLabelBadgeText}>{t('scanned', 'SCANNED')}</Text>
                                </View>
                            )}
                            <View style={styles.itemNameRow}>
                                <Text style={styles.selectedItemName}>{selectedItem?.item_name}</Text>
                                {(selectedItem?.has_serial_no === 1 || selectedItem?.has_batch_no === 1 || selectedItem?.has_serial_no === true || selectedItem?.has_batch_no === true) && (
                                    <View style={styles.selectedItemTag}>
                                        <Text style={styles.selectedItemTagText}>{selectedItem?.has_serial_no ? 'Serial' : 'Batch'} Tracked</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.selectedItemCode}>{selectedItem?.item_code}</Text>
                            <Text style={styles.selectedItemPending}>Pending: {selectedItem?.qty - selectedItem?.received_qty} {selectedItem?.uom}</Text>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>
                                {selectedItem?.is_fixed_asset ? 'Select Location' : t('select_warehouse', 'Select Warehouse')} <Text style={{ color: '#ef4444' }}>*</Text></Text>
                            <View style={styles.formInputWrapper}>
                                <TextInput
                                    placeholder={selectedItem?.is_fixed_asset ? "Search location..." : "Search or scan warehouse..."}
                                    style={[styles.formInput, { marginLeft: 0 }]}
                                    value={selectedWarehouse ? selectedWarehouse.name : warehouse}
                                    onChangeText={(txt) => {
                                        if (selectedWarehouse) {
                                            setSelectedWarehouse(null);
                                        }
                                        setWarehouse(txt);
                                        setShowWarehouseDropdown(true);
                                    }}
                                    onFocus={() => setShowWarehouseDropdown(true)}
                                    placeholderTextColor="#94a3b8"
                                />
                                {selectedWarehouse ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity onPress={() => { setSelectedWarehouse(null); setWarehouse(''); }} style={{ marginRight: 8, padding: 4 }}>
                                            <X size={18} color="#94a3b8" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setShowWarehouseDropdown(!showWarehouseDropdown)} style={{ marginRight: 8, padding: 4 }}>
                                            <ChevronDown size={20} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity onPress={handleOpenScanner} style={{ marginRight: 10, padding: 4 }}>
                                            <Scan size={18} color="#64748b" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setShowWarehouseDropdown(!showWarehouseDropdown)} style={{ marginRight: 8, padding: 4 }}>
                                            <ChevronDown size={20} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Warehouse Suggestions Below Input */}
                            {(() => {
                                const putawayWhName = applyPutawayRule && putawaySuggestions[selectedItem?.item_code]?.warehouse;
                                const defaultWhName = selectedItem?.default_warehouse;
                                const sugs: { type: string; name: string; badgeBg: string; badgeColor: string }[] = [];
                                if (putawayWhName) sugs.push({ type: 'Putaway', name: putawayWhName, badgeBg: '#dbeafe', badgeColor: '#1d4ed8' });
                                if (defaultWhName && defaultWhName !== putawayWhName) sugs.push({ type: 'Suggested', name: defaultWhName, badgeBg: '#f3e8ff', badgeColor: '#7c3aed' });
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
                                                        const whList = selectedItem?.is_fixed_asset ? locations : warehouses;
                                                        const wh = whList.find(w => w.name === sug.name || w.warehouse_name === sug.name);
                                                        setSelectedWarehouse(wh || { name: sug.name, warehouse_name: sug.name.split(' - ')[0], company: poDetails?.company });
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

                            {/* Warehouse Dropdown */}
                            {showWarehouseDropdown && (
                                <View style={styles.warehouseDropdown}>
                                    {(() => {
                                        const options = (selectedItem?.is_fixed_asset ? locations : warehouses)
                                            .filter(w => w.name.toLowerCase().includes(warehouse.toLowerCase()))
                                            .sort((a, b) => {
                                                const getScore = (w: any) => {
                                                    if (applyPutawayRule && putawaySuggestions[selectedItem?.item_code] && w.name === putawaySuggestions[selectedItem.item_code].warehouse) return 0;
                                                    if (w.name === selectedItem?.default_warehouse) return 1;
                                                    return 2;
                                                };
                                                return getScore(a) - getScore(b);
                                            });
                                        const pageOptions = options.slice(whDropPage * WH_PAGE_SIZE, (whDropPage + 1) * WH_PAGE_SIZE);
                                        const totalPages = Math.ceil(options.length / WH_PAGE_SIZE);
                                        return (
                                            <>
                                                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                    {pageOptions.map((w, idx) => (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            style={styles.warehouseItem}
                                                            onPress={() => {
                                                                setWarehouse(''); // Clear search
                                                                setSelectedWarehouse(w);
                                                                setShowWarehouseDropdown(false);
                                                            }}
                                                        >
                                                            <View style={{ marginRight: 8 }}>
                                                                {selectedWarehouse && selectedWarehouse.name === w.name ? (
                                                                    <View style={[styles.warehouseIconFrame, { backgroundColor: '#dcfce7' }]}>
                                                                        <Check size={14} color="#10b981" />
                                                                    </View>
                                                                ) : (
                                                                    <View style={styles.warehouseIconFrame}>
                                                                        <Package size={14} color="#64748b" />
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                                    <Text style={styles.warehouseName}>{w.name}</Text>
                                                                    {w.name === selectedItem?.default_warehouse && (
                                                                        <View style={styles.suggestedBadge}>
                                                                            <Sparkles size={8} color="#7c3aed" />
                                                                            <Text style={styles.suggestedBadgeText}>{t('suggested', 'Suggested')}</Text>
                                                                        </View>
                                                                    )}
                                                                    {applyPutawayRule && putawaySuggestions[selectedItem?.item_code] && w.name === putawaySuggestions[selectedItem.item_code].warehouse && (
                                                                        <View style={[styles.suggestedBadge, { backgroundColor: '#e0f2fe' }]}>
                                                                            <MapPin size={8} color="#0284c7" />
                                                                            <Text style={[styles.suggestedBadgeText, { color: '#0284c7' }]}>Putaway</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                {!selectedItem?.is_fixed_asset && <Text style={styles.warehouseCompany}>{w.company}</Text>}
                                                            </View>
                                                        </TouchableOpacity>
                                                    ))}
                                                    {options.length === 0 && (
                                                        <View style={styles.emptyWarehouse}>
                                                            <Text style={styles.emptyWarehouseText}>{selectedItem?.is_fixed_asset ? 'No locations found' : t('no_warehouses_found', 'No warehouses found')}</Text>
                                                        </View>
                                                    )}
                                                </ScrollView>
                                                {totalPages > 1 && (
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                                                        <TouchableOpacity onPress={() => setWhDropPage(Math.max(0, whDropPage - 1))} disabled={whDropPage === 0}>
                                                            <Text style={{ color: whDropPage === 0 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Previous</Text>
                                                        </TouchableOpacity>
                                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Page {whDropPage + 1} of {totalPages}</Text>
                                                        <TouchableOpacity onPress={() => setWhDropPage(Math.min(totalPages - 1, whDropPage + 1))} disabled={whDropPage >= totalPages - 1}>
                                                            <Text style={{ color: whDropPage >= totalPages - 1 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Next</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </>
                                        );
                                    })()}
                                </View>
                            )}
                        </View>

                        {inventoryDimention.map((dim: any) => (
                            <View key={dim.name} style={styles.formGroup}>
                                {/* Target Dimension */}
                                <Text style={styles.formLabel}>Target {dim.dimension_name} {dim.reqd === 1 && <Text style={{ color: '#ef4444' }}>*</Text>}</Text>

                                <View style={styles.formInputWrapper}>
                                    <TextInput
                                        placeholder={`Search Target ${dim.dimension_name}...`}
                                        style={[styles.formInput, { marginLeft: 0 }]}
                                        value={dimensionValues[dim.target_fieldname] ? dimensionValues[dim.target_fieldname] : (dimensionSearch[dim.target_fieldname] || '')}
                                        onChangeText={(txt) => {
                                            if (dimensionValues[dim.target_fieldname]) {
                                                const newVals = { ...dimensionValues };
                                                delete newVals[dim.target_fieldname];
                                                setDimensionValues(newVals);
                                            }
                                            handleDimensionSearch(dim.target_fieldname, dim.reference_document, txt);
                                        }}
                                        onFocus={() => {
                                            if (!dimensionOptions[dim.target_fieldname] || dimensionOptions[dim.target_fieldname].length === 0) {
                                                handleDimensionSearch(dim.target_fieldname, dim.reference_document, '');
                                            } else {
                                                setShowDimDropdown(dim.target_fieldname);
                                            }
                                        }}
                                        placeholderTextColor="#94a3b8"
                                    />
                                    {dimensionValues[dim.target_fieldname] ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const newVals = { ...dimensionValues };
                                                    delete newVals[dim.target_fieldname];
                                                    setDimensionValues(newVals);
                                                    setDimensionSearch(prev => ({ ...prev, [dim.target_fieldname]: '' }));
                                                }}
                                                style={{ marginRight: 8, padding: 4 }}
                                            >
                                                <X size={18} color="#94a3b8" />
                                            </TouchableOpacity>
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
                                    ) : (
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
                                    )}
                                </View>

                                {/* Target Dimension Suggestions Below Input */}
                                {(() => {
                                    const putawayVal = applyPutawayRule && putawaySuggestions[selectedItem?.item_code]
                                        ? (putawaySuggestions[selectedItem.item_code][dim.source_fieldname] || putawaySuggestions[selectedItem.item_code][dim.target_fieldname])
                                        : null;

                                    let defaultVal = null;
                                    if (poDetails?.doctype && dim.reference_document === poDetails.doctype) {
                                        defaultVal = poDetails.name;
                                    } else if (selectedItem?.[dim.target_fieldname]) {
                                        defaultVal = selectedItem[dim.target_fieldname];
                                    } else if (poDetails?.[dim.target_fieldname]) {
                                        defaultVal = poDetails[dim.target_fieldname];
                                    }

                                    const sugs: { type: string; name: string; badgeBg: string; badgeColor: string }[] = [];
                                    if (putawayVal) sugs.push({ type: 'Putaway', name: putawayVal, badgeBg: '#dbeafe', badgeColor: '#1d4ed8' });
                                    if (defaultVal && defaultVal !== putawayVal) sugs.push({ type: 'Suggested', name: defaultVal, badgeBg: '#f3e8ff', badgeColor: '#7c3aed' });

                                    if (sugs.length === 0) return null;

                                    return (
                                        <View style={{ marginTop: 8, gap: 4 }}>
                                            {sugs.map((sug, idx) => {
                                                const isSelected = dimensionValues[dim.target_fieldname] === sug.name;
                                                return (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: isSelected ? '#e0f2fe' : '#f8fafc', borderRadius: 8 }}
                                                        onPress={() => setDimensionValues(prev => ({ ...prev, [dim.target_fieldname]: sug.name }))}
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
                                {showDimDropdown === dim.target_fieldname && (
                                    <View style={styles.warehouseDropdown}>
                                        {(() => {
                                            const options = dimensionOptions[dim.target_fieldname] || [];
                                            const page = dimDropPage[dim.target_fieldname] || 0;
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
                                                                    setDimensionSearch(prev => ({ ...prev, [dim.target_fieldname]: '' }));
                                                                    setDimensionValues(prev => ({ ...prev, [dim.target_fieldname]: opt.name }));
                                                                    setShowDimDropdown(null);
                                                                }}
                                                            >
                                                                <View style={{ marginRight: 8 }}>
                                                                    {dimensionValues[dim.target_fieldname] === opt.name ? (
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
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                                        <Text style={styles.warehouseName}>{opt.name}</Text>
                                                                        {applyPutawayRule && putawaySuggestions[selectedItem?.item_code] && (
                                                                            opt.name === putawaySuggestions[selectedItem.item_code][dim.source_fieldname] ||
                                                                            opt.name === putawaySuggestions[selectedItem.item_code][dim.target_fieldname]
                                                                        ) && (
                                                                                <View style={[styles.suggestedBadge, { backgroundColor: '#e0f2fe' }]}>
                                                                                    <MapPin size={8} color="#0284c7" />
                                                                                    <Text style={[styles.suggestedBadgeText, { color: '#0284c7' }]}>Putaway</Text>
                                                                                </View>
                                                                            )}
                                                                    </View>
                                                                </View>
                                                            </TouchableOpacity>
                                                        ))}
                                                        {options.length === 0 && (
                                                            <View style={styles.emptyWarehouse}>
                                                                <Text style={styles.emptyWarehouseText}>No options found</Text>
                                                            </View>
                                                        )}
                                                    </ScrollView>
                                                    {totalPages > 1 && (
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                                                            <TouchableOpacity onPress={() => setDimDropPage(prev => ({ ...prev, [dim.target_fieldname]: Math.max(0, page - 1) }))} disabled={page === 0}>
                                                                <Text style={{ color: page === 0 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Previous</Text>
                                                            </TouchableOpacity>
                                                            <Text style={{ fontSize: 12, color: '#64748b' }}>Page {page + 1} of {totalPages}</Text>
                                                            <TouchableOpacity onPress={() => setDimDropPage(prev => ({ ...prev, [dim.target_fieldname]: Math.min(totalPages - 1, page + 1) }))} disabled={page >= totalPages - 1}>
                                                                <Text style={{ color: page >= totalPages - 1 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Next</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </View>
                                )}

                                {/* Rejected Dimension */}
                                <Text style={[styles.formLabel, { marginTop: 12 }]}>Rejected {dim.dimension_name}</Text>

                                <View style={styles.formInputWrapper}>
                                    <TextInput
                                        placeholder={`Search Rejected ${dim.dimension_name}...`}
                                        style={[styles.formInput, { marginLeft: 0 }]}
                                        value={rejectedDimensionValues[`rejected_${dim.target_fieldname}`] ? rejectedDimensionValues[`rejected_${dim.target_fieldname}`] : (rejectedDimensionSearch[dim.target_fieldname] || '')}
                                        onChangeText={(txt) => {
                                            if (rejectedDimensionValues[`rejected_${dim.target_fieldname}`]) {
                                                const newVals = { ...rejectedDimensionValues };
                                                delete newVals[`rejected_${dim.target_fieldname}`];
                                                setRejectedDimensionValues(newVals);
                                            }
                                            handleDimensionSearch(dim.target_fieldname, dim.reference_document, txt, true);
                                        }}
                                        onFocus={() => {
                                            if (!dimensionOptions[dim.target_fieldname] || dimensionOptions[dim.target_fieldname].length === 0) {
                                                handleDimensionSearch(dim.target_fieldname, dim.reference_document, '', true);
                                            } else {
                                                setShowRejectedDimDropdown(dim.target_fieldname);
                                            }
                                        }}
                                        placeholderTextColor="#94a3b8"
                                    />
                                    {rejectedDimensionValues[`rejected_${dim.target_fieldname}`] ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const newVals = { ...rejectedDimensionValues };
                                                    delete newVals[`rejected_${dim.target_fieldname}`];
                                                    setRejectedDimensionValues(newVals);
                                                    setRejectedDimensionSearch(prev => ({ ...prev, [dim.target_fieldname]: '' }));
                                                }}
                                                style={{ marginRight: 8, padding: 4 }}
                                            >
                                                <X size={18} color="#94a3b8" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (showRejectedDimDropdown === dim.target_fieldname) {
                                                        setShowRejectedDimDropdown(null);
                                                    } else {
                                                        if (!dimensionOptions[dim.target_fieldname] || dimensionOptions[dim.target_fieldname].length === 0) {
                                                            handleDimensionSearch(dim.target_fieldname, dim.reference_document, '', true);
                                                        } else {
                                                            setShowRejectedDimDropdown(dim.target_fieldname);
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
                                                if (showRejectedDimDropdown === dim.target_fieldname) {
                                                    setShowRejectedDimDropdown(null);
                                                } else {
                                                    if (!dimensionOptions[dim.target_fieldname] || dimensionOptions[dim.target_fieldname].length === 0) {
                                                        handleDimensionSearch(dim.target_fieldname, dim.reference_document, '', true);
                                                    } else {
                                                        setShowRejectedDimDropdown(dim.target_fieldname);
                                                    }
                                                }
                                            }}
                                            style={{ marginRight: 8, padding: 4 }}
                                        >
                                            <ChevronDown size={20} color="#64748b" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Rejected Dimension Suggestions */}
                                {(() => {
                                    const putawayVal = applyPutawayRule && putawaySuggestions[selectedItem?.item_code]
                                        ? (putawaySuggestions[selectedItem.item_code][`rejected_${dim.source_fieldname}`] || putawaySuggestions[selectedItem.item_code][`rejected_${dim.target_fieldname}`])
                                        : null;

                                    let defaultVal = null;
                                    if (poDetails?.doctype && dim.reference_document === poDetails.doctype) {
                                        defaultVal = poDetails.name;
                                    } else if (selectedItem?.[dim.target_fieldname]) {
                                        defaultVal = selectedItem[dim.target_fieldname];
                                    } else if (poDetails?.[dim.target_fieldname]) {
                                        defaultVal = poDetails[dim.target_fieldname];
                                    }

                                    const sugs: { type: string; name: string; badgeBg: string; badgeColor: string }[] = [];
                                    if (putawayVal) sugs.push({ type: 'Putaway', name: putawayVal, badgeBg: '#dbeafe', badgeColor: '#1d4ed8' });
                                    if (defaultVal && defaultVal !== putawayVal) sugs.push({ type: 'Suggested', name: defaultVal, badgeBg: '#f3e8ff', badgeColor: '#7c3aed' });

                                    if (sugs.length === 0) return null;

                                    return (
                                        <View style={{ marginTop: 8, gap: 4 }}>
                                            {sugs.map((sug, idx) => {
                                                const isSelected = rejectedDimensionValues[`rejected_${dim.target_fieldname}`] === sug.name;
                                                return (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: isSelected ? '#e0f2fe' : '#f8fafc', borderRadius: 8 }}
                                                        onPress={() => setRejectedDimensionValues(prev => ({ ...prev, [`rejected_${dim.target_fieldname}`]: sug.name }))}
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

                                {/* Rejected Dimension Dropdown */}
                                {showRejectedDimDropdown === dim.target_fieldname && (
                                    <View style={styles.warehouseDropdown}>
                                        {(() => {
                                            const options = dimensionOptions[dim.target_fieldname] || [];
                                            const page = dimDropPage[`rejected_${dim.target_fieldname}`] || 0;
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
                                                                    setRejectedDimensionSearch(prev => ({ ...prev, [dim.target_fieldname]: '' }));
                                                                    setRejectedDimensionValues(prev => ({ ...prev, [`rejected_${dim.target_fieldname}`]: opt.name }));
                                                                    setShowRejectedDimDropdown(null);
                                                                }}
                                                            >
                                                                <View style={{ marginRight: 8 }}>
                                                                    {rejectedDimensionValues[`rejected_${dim.target_fieldname}`] === opt.name ? (
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
                                                            <View style={styles.emptyWarehouse}>
                                                                <Text style={styles.emptyWarehouseText}>No options found</Text>
                                                            </View>
                                                        )}
                                                    </ScrollView>
                                                    {totalPages > 1 && (
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                                                            <TouchableOpacity onPress={() => setDimDropPage(prev => ({ ...prev, [`rejected_${dim.target_fieldname}`]: Math.max(0, page - 1) }))} disabled={page === 0}>
                                                                <Text style={{ color: page === 0 ? '#cbd5e1' : '#3b82f6', fontSize: 13, fontWeight: '600' }}>Previous</Text>
                                                            </TouchableOpacity>
                                                            <Text style={{ fontSize: 12, color: '#64748b' }}>Page {page + 1} of {totalPages}</Text>
                                                            <TouchableOpacity onPress={() => setDimDropPage(prev => ({ ...prev, [`rejected_${dim.target_fieldname}`]: Math.min(totalPages - 1, page + 1) }))} disabled={page >= totalPages - 1}>
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

                        {(selectedItem?.has_serial_no === 1 || selectedItem?.has_batch_no === 1 || selectedItem?.has_serial_no === true || selectedItem?.has_batch_no === true) && (
                            <View style={styles.trackingSection}>
                                <Text style={styles.formLabel}>{selectedItem?.has_serial_no ? 'Serial Numbers' : 'Batch Numbers'} <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                <TouchableOpacity
                                    style={styles.trackingCard}
                                    onPress={() => setShowBatchSlider(true)}
                                >
                                    <View style={styles.trackingInfo}>
                                        <View style={styles.addTrackingBtn}>
                                            <View style={styles.trackingCharBg}>
                                                <Text style={styles.addTrackingIcon}>#</Text>
                                            </View>
                                            <Text style={styles.addTrackingText}>
                                                {(() => {
                                                    const hasAddedEntries = selectedItem?.has_serial_no
                                                        ? batches.some(b => b.serial_no && b.serial_no.trim() !== '')
                                                        : batches.some(b => b.batch_no && b.batch_no.trim() !== '');
                                                    const addedCount = selectedItem?.has_serial_no
                                                        ? batches.filter(b => b.serial_no && b.serial_no.trim() !== '').length
                                                        : batches.filter(b => b.batch_no && b.batch_no.trim() !== '').length;
                                                    return hasAddedEntries
                                                        ? `${addedCount} ${selectedItem?.has_serial_no ? 'serial' : 'batch'} added`
                                                        : `Add ${selectedItem?.has_serial_no ? 'Serial' : 'Batch'} Numbers`;
                                                })()}
                                            </Text>
                                        </View>
                                        {qty === 0 && <Text style={styles.requiredHint}>* Required for {selectedItem?.has_serial_no ? 'serial' : 'batch'} tracked items</Text>}
                                    </View>
                                    <ChevronRight size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {selectedItem?.efficacyFieldToSend && (
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Target Efficacy <Text style={{ color: '#ef4444' }}>*</Text></Text>
                                <View style={styles.formInputWrapper}>
                                    <TextInput
                                        placeholder="Enter target efficacy (e.g. 100)"
                                        style={[styles.formInput, { marginLeft: 0 }]}
                                        value={targetEfficacy !== null ? targetEfficacy.toString() : ''}
                                        keyboardType="numeric"
                                        onChangeText={(val) => setTargetEfficacy(parseFloat(val) || 0)}
                                        placeholderTextColor="#94a3b8"
                                    />
                                    {targetEfficacy !== null ? (
                                        <TouchableOpacity
                                            onPress={() => setTargetEfficacy(null)}
                                            style={{ marginRight: 8, padding: 4 }}
                                        >
                                            <X size={18} color="#94a3b8" />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                                {(() => {
                                    const defaultEff = selectedItem?.target_efficacy !== undefined ? selectedItem.target_efficacy : (selectedItem?.custom_target_efficacy !== undefined ? selectedItem.custom_target_efficacy : (selectedItem?.lot_potency !== undefined ? selectedItem.lot_potency : (selectedItem?.efficacy !== undefined ? selectedItem.efficacy : 100)));
                                    const isSelected = targetEfficacy === defaultEff;
                                    return (
                                        <View style={{ marginTop: 8 }}>
                                            <TouchableOpacity
                                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: isSelected ? '#e0f2fe' : '#f8fafc', borderRadius: 8 }}
                                                onPress={() => setTargetEfficacy(defaultEff)}
                                            >
                                                <View style={{ backgroundColor: '#f3e8ff', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#7c3aed', letterSpacing: 0.3 }}>Suggested</Text>
                                                </View>
                                                <Text style={{ fontSize: 13, color: isSelected ? '#0369a1' : '#1e293b', flex: 1, fontWeight: isSelected ? '600' : '400' }} numberOfLines={1}>{defaultEff}</Text>
                                                {isSelected && <Check size={14} color="#0284c7" />}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })()}
                            </View>
                        )}

                        <View style={styles.qtyContainer}>
                            <Text style={styles.qtyLabel}>{t('quantity_to_receive', 'Quantity to Receive')}</Text>
                            <View style={styles.qtyRow}>
                                <TouchableOpacity
                                    style={styles.qtyBtn}
                                    onPress={() => setQty(Math.max(0, qty - 1))}
                                >
                                    <Minus size={20} color="#0f172a" />
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
                                    <Plus size={20} color="#0f172a" />
                                </TouchableOpacity>
                                <Text style={styles.uomText}>{selectedItem?.uom || 'Nos'}</Text>
                            </View>
                        </View>
                    </Animated.View>
                )}

                {step === 3 && !submitted && (
                    <Animated.View entering={FadeIn} style={styles.stepContent}>
                        <View style={styles.reviewHeader}>
                            <Text style={styles.listTitle}>{t('review_grn', 'Review GRN')}</Text>
                            <Text style={styles.reviewSubtitle}>{t('confirm_the_items_be', 'Confirm the items below before submitting')}</Text>
                        </View>

                        {receivedItems.map((item, idx) => (
                            <View key={idx} style={styles.receivedItemCard}>
                                <View style={styles.receivedItemTop}>
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                        <Text style={styles.receivedItemName}>{item.item_name}</Text>
                                        <Text style={styles.receivedItemCode}>{item.item_code}</Text>
                                    </View>
                                    <View style={styles.receivedItemQtySection}>
                                        <Text style={styles.receivedItemQty}>{item.received_qty_input} {item.uom}</Text>
                                        <Text style={styles.receivedItemWarehouse}>{item.warehouse}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                                    {!!(item.has_serial_no || item.has_batch_no) ? (
                                        <View style={styles.receivedItemTracking}>
                                            <ClipboardList size={14} color="#94a3b8" />
                                            <Text style={styles.receivedItemTrackingText}>
                                                {item.batches?.length || 0} batches added
                                            </Text>
                                        </View>
                                    ) : (
                                        <View />
                                    )}
                                    <View style={{ flexDirection: 'row', gap: 16 }}>
                                        <TouchableOpacity onPress={() => handleEditItem(idx)}>
                                            <Pencil size={18} color="#2e1065" />
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
                                <Text style={styles.summaryValue}>{receivedItems.length}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('total_quantity', 'Total Quantity')}</Text>
                                <Text style={styles.summaryValue}>
                                    {receivedItems.reduce((sum, item) => sum + item.received_qty_input, 0)} units
                                </Text>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </ScrollView>

            {/* Unified Bottom Footer Panel */}
            {showFooter && !submitted && (
                <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.unifiedFooter}>
                    <View style={styles.bottomActionsInner}>
                        {step === 1 ? (
                            <View style={styles.step1Buttons}>
                                <TouchableOpacity style={styles.cancelBtnView} onPress={() => router.back()}>
                                    <Text style={styles.cancelBtnText}>{t('cancel', 'Cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.reviewBtnView,
                                        receivedItems.length > 0 ? styles.reviewBtnViewActive : { opacity: 0.5 }
                                    ]}
                                    onPress={() => receivedItems.length > 0 && setStep(3)}
                                    disabled={receivedItems.length === 0}
                                >
                                    <Text style={styles.reviewBtnText}>Review ({receivedItems.length})</Text>
                                </TouchableOpacity>
                            </View>
                        ) : step === 2 ? (() => {
                            const isTracked = selectedItem?.has_serial_no === 1 || selectedItem?.has_batch_no === 1 || selectedItem?.has_serial_no === true || selectedItem?.has_batch_no === true;
                            const trackedQty = batches.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0);
                            const isTrackingMatched = !isTracked || trackedQty === qty;

                            const isDimensionsValid = inventoryDimention.every((dim: any) => {
                                if (dim.reqd) {
                                    return !!dimensionValues[dim.target_fieldname];
                                }
                                return true;
                            });

                            const canAddToGRN = selectedWarehouse && isTrackingMatched && isDimensionsValid && qty > 0;

                            return (
                                <View style={{ flex: 1 }}>
                                    {/* Warnings banner in footer if needed */}
                                    {/* {(!selectedWarehouse || !isTrackingMatched || !isDimensionsValid || qty <= 0) && (
                                        <View style={styles.footerWarningContainer}>
                                            <Text style={styles.footerWarningText}>
                                                {!selectedWarehouse
                                                    ? (selectedItem?.is_fixed_asset ? "Please select location" : "Please select warehouse")
                                                    : qty <= 0
                                                        ? "Quantity must be greater than 0"
                                                        : !isTrackingMatched
                                                            ? `Batch/serial mismatch: ${trackedQty} of ${qty} entered`
                                                            : "Please fill mandatory dimensions"
                                                }
                                            </Text>
                                        </View>
                                    )} */}
                                    <View style={styles.step2Buttons}>
                                        <TouchableOpacity style={styles.backBtnForm} onPress={() => {
                                            if (editingItemIndex !== null) {
                                                setStep(3); // Go back to Review if editing
                                            } else {
                                                setStep(1);
                                            }
                                        }}>
                                            <ArrowLeft size={16} color="#2e1065" />
                                            <Text style={styles.backBtnFormText}>{t('back', 'Back')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.addGrnBtn, !canAddToGRN && { opacity: 0.5 }]}
                                            onPress={handleAddToGRN}
                                            disabled={!canAddToGRN}
                                        >
                                            <Plus size={16} color="#fff" />
                                            <Text style={styles.addGrnBtnText}>{t('add_to_grn', 'Add to GRN')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })() : (
                            <View style={styles.step1Buttons}>
                                <TouchableOpacity
                                    style={styles.cancelBtnView}
                                    onPress={() => setStep(1)}
                                    disabled={loading}
                                >
                                    <Text style={styles.cancelBtnText}>{t('add_more', 'Add More')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.submitBtnView,
                                        styles.submitBtnViewActive,
                                        loading && { opacity: 0.7 }
                                    ]}
                                    onPress={handleSubmitGRN}
                                    disabled={loading || receivedItems.length === 0}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Check size={16} color="#fff" style={{ marginRight: 6 }} />
                                            <Text style={styles.submitBtnText}>{t('submit_grn', 'Submit GRN')}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Mode Toggler (Footer - always visible or hidden on success) */}
                    <View style={styles.pillNavbarContainer}>
                        <View style={styles.pillNavbar}>
                            <TouchableOpacity
                                style={styles.pillBackBtn}
                                onPress={() => router.back()}
                            >
                                <ArrowLeft size={20} color="#fff" />
                            </TouchableOpacity>

                            <View style={styles.pillDivider} />

                            <TouchableOpacity
                                style={styles.pillNavBtn}
                                onPress={() => router.replace('/inventory/receive')}
                            >
                                <Package size={18} color="#94a3b8" />
                                <Text style={styles.pillNavText}>{t('receive', 'RECEIVE')}</Text>
                            </TouchableOpacity>

                            <View style={[styles.pillNavBtn, styles.pillNavBtnActive]}>
                                <FileText size={18} color="#fff" />
                                <Text style={styles.pillNavTextActive}>{t('grn', 'GRN')}</Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* Item Scanner Modal */}
            <Modal
                visible={isScanningItem}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsScanningItem(false)}
            >
                <View style={styles.scannerWrapper}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={onItemScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr", "ean13", "code128"],
                        }}
                    />
                    <View style={styles.itemScannerOverlay}>
                        <View style={styles.scannerFrame} />
                        <Text style={styles.scannerText}>{t('align_item_barcode_w', 'Align item barcode within the frame')}</Text>
                        <TouchableOpacity
                            style={styles.closeScannerBtn}
                            onPress={() => setIsScanningItem(false)}
                        >
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Batch Scanner Modal */}
            <Modal
                visible={isScanningBatch}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsScanningBatch(false)}
            >
                <View style={styles.scannerWrapper}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={onBatchScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr", "ean13", "code128"],
                        }}
                    />
                    <View style={styles.itemScannerOverlay}>
                        <View style={styles.scannerFrame} />
                        <Text style={styles.scannerText}>Scan {selectedItem?.has_serial_no ? 'Serial' : 'Batch'} Number</Text>
                        <TouchableOpacity
                            style={styles.closeScannerBtn}
                            onPress={() => setIsScanningBatch(false)}
                        >
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Warehouse Scanner Modal */}
            <Modal
                visible={isScanningWarehouse}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsScanningWarehouse(false)}
            >
                <View style={styles.scannerContainer}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={isScanningWarehouse ? onWarehouseScanned : undefined}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr', 'code128', 'code39'],
                        }}
                    />
                    <View style={styles.warehouseScannerOverlay}>
                        <View style={styles.scannerHeader}>
                            <TouchableOpacity
                                onPress={() => setIsScanningWarehouse(false)}
                                style={styles.closeScanner}
                            >
                                <X size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.scannerTitle}>{t('scan_warehouse', 'Scan Warehouse')}</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={styles.scanTarget}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>
                        <Text style={styles.scanInstructions}>{t('scan_barcode_to_sele', 'Scan barcode to select warehouse')}</Text>
                    </View>
                </View>
            </Modal>

            {/* Batch Details Slider Modal */}
            <Modal
                visible={showBatchSlider}
                animationType="slide"
                transparent={true}
                statusBarTranslucent
                onRequestClose={() => setShowBatchSlider(false)}
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
                            <TouchableOpacity 
                                onPress={() => setShowBatchSlider(false)} 
                                style={styles.modalCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                accessibilityLabel="Close batch modal"
                            >
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
                                                <TouchableOpacity onPress={() => handleRemoveBatch(index)}>
                                                    <Trash2 size={16} color="#ef4444" />
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
                                onPress={() => setShowBatchSlider(false)}
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

            <ConfirmationModal
                visible={alertData.visible}
                title={alertData.title}
                message={alertData.message}
                confirmText="Okay"
                isAlert={true}
                iconType={alertData.isError ? "delete" : "submit"}
                isDestructive={alertData.isError}
                onCancel={() => {
                    setAlertData({ ...alertData, visible: false });
                    if (!alertData.isError) {
                        router.push('/inventory/receive');
                    }
                }}
            />

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Receive Goods"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_receive')) {
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
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
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
    poInfoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    idBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
    },
    poIdText: {
        fontSize: 15,
        fontWeight: '900',
        color: '#fff',
        fontFamily: Fonts.rounded,
    },
    supplierText: {
        fontSize: 14,
        color: '#e9d5ff',
        fontFamily: Fonts.sans,
        fontWeight: '500',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stepWrapper: {
        alignItems: 'center',
        zIndex: 2,
    },
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
    stepNum: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748b',
        fontFamily: Fonts.rounded,
    },
    stepNumActive: {
        color: '#fff',
    },
    stepLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
        fontFamily: Fonts.sans,
    },
    stepLabelActive: {
        color: '#2e1065',
        fontWeight: 'bold',
    },
    stepContent: {
        padding: 20,
    },
    searchBarWrapper: {
        marginBottom: 20,
    },
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
    scanText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#7634bc',
        fontFamily: Fonts.rounded,
    },
    listTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#2e1065',
        marginBottom: 15,
        fontFamily: Fonts.sans,
        letterSpacing: -0.2,
    },
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
    itemInfo: {
        flex: 1,
    },
    itemNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    itemName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    tagBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    tagText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#d97706',
    },
    itemCode: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
        fontFamily: Fonts.sans,
    },
    pendingQty: {
        fontSize: 13,
        color: '#f97316',
        fontWeight: '700',
        marginTop: 6,
        fontFamily: Fonts.sans,
    },
    selectedItemPreview: {
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
    },
    selectedItemName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    selectedItemTag: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    selectedItemTagText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#d97706',
    },
    selectedItemCode: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 12,
    },
    selectedItemPending: {
        fontSize: 15,
        color: '#f97316',
        fontWeight: 'bold',
        marginTop: 6,
    },
    formGroup: {
        marginBottom: 24,
    },
    formLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 10,
        fontFamily: Fonts.sans,
    },
    formInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        paddingLeft: 12,
        paddingRight: 4,
        height: 52,
        overflow: 'hidden',
    },
    formInput: {
        flex: 1,
        height: '100%',
        marginLeft: 12,
        fontSize: 15,
        color: '#0f172a',
        paddingVertical: 0,
    },
    trackingSection: {
        marginBottom: 24,
    },
    trackingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    trackingInfo: {
        flex: 1,
    },
    trackingLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 12,
    },
    addTrackingBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    trackingCharBg: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addTrackingIcon: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#64748b',
    },
    addTrackingText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    requiredHint: {
        fontSize: 12,
        color: '#f97316',
        fontStyle: 'italic',
        marginTop: 4,
    },
    qtyContainer: {
        marginBottom: 40,
    },
    qtyLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 18,
    },
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
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        zIndex: 1000,
    },
    bottomActionsInner: {
        marginBottom: 12,
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
    pillNavbarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
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

    // New Warehouse Dropdown Styles
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
    selectedWarehouseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 12,
    },
    clearWarehouseBtn: {
        padding: 4,
    },
    // Review GRN Styles
    reviewHeader: {
        marginBottom: 20,
    },
    reviewSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
    },
    receivedItemCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    receivedItemTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    receivedItemName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 2,
    },
    receivedItemCode: {
        fontSize: 12,
        color: '#64748b',
    },
    receivedItemQtySection: {
        alignItems: 'flex-end',
    },
    receivedItemQty: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    receivedItemWarehouse: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    receivedItemTracking: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    receivedItemTrackingText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    reviewSummary: {
        marginTop: 20,
        padding: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        gap: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    successOverlay: {
        backgroundColor: '#fff',
        zIndex: 5000,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    successContent: {
        alignItems: 'center',
    },
    successCheckBg: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 12,
    },
    successSubtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
    },
    successButton: {
        marginTop: 40,
        backgroundColor: '#0f172a',
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 14,
    },
    successButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyWarehouse: {
        padding: 20,
        alignItems: 'center',
    },
    emptyWarehouseText: {
        color: '#94a3b8',
        fontSize: 13,
    },

    // Scanner Styles
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    warehouseScannerOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'space-between',
        padding: 40,
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    closeScanner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    scanTarget: {
        width: width * 0.7,
        height: width * 0.7,
        alignSelf: 'center',
        borderWidth: 0,
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
        color: '#fff',
        textAlign: 'center',
        fontSize: 14,
        opacity: 0.8,
    },

    // Modal / Slider Styles
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
        width: 36,
        height: 36,
        borderRadius: 18,
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
        padding: 16,
        marginBottom: 16,
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
    draftBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    draftBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b',
    },
    draftWarningBoard: {
        backgroundColor: '#fffbeb',
        padding: 10,
        borderRadius: 8,
        marginTop: 15,
        borderWidth: 1,
        borderColor: '#fef3c7',
    },
    draftWarningText: {
        fontSize: 11,
        color: '#92400e',
        fontWeight: '500',
        textAlign: 'center',
    },
    // Scanner Styles
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
        width: width * 0.7,
        height: width * 0.7,
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
    },
    scannedSuccessBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        gap: 12,
    },
    scannedSuccessIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#dcfce7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannedSuccessTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#15803d',
        fontFamily: Fonts.sans,
    },
    scannedSuccessSubtitle: {
        fontSize: 12,
        color: '#166534',
        fontFamily: Fonts.sans,
        marginTop: 2,
    },
    selectedItemPreviewScanned: {
        borderColor: '#10b981',
        borderStyle: 'solid',
        backgroundColor: '#f0fdf4',
    },
    scannedLabelBadge: {
        position: 'absolute',
        top: -10,
        right: 16,
        backgroundColor: '#10b981',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    scannedLabelBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
    },
    suggestedBadge: {
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    suggestedBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#7c3aed',
    },
    suggestionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#faf5ff',
        borderWidth: 1,
        borderColor: '#e9d5ff',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
        gap: 8,
    },
    suggestionContentLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    suggestionLabel: {
        fontSize: 10,
        color: '#6b21a8',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    suggestionValue: {
        fontSize: 13,
        color: '#581c87',
        fontWeight: 'bold',
        marginTop: 1,
    },
    suggestionApplyBtn: {
        backgroundColor: '#7c3aed',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    suggestionApplyBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
    },
    checkboxCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    checkboxLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    checkboxSublabel: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Fonts.sans,
        marginTop: 2,
    },
    footerWarningContainer: {
        backgroundColor: '#fff1f2',
        borderWidth: 1,
        borderColor: '#fecdd3',
        borderRadius: 8,
        padding: 8,
        marginBottom: 12,
        alignItems: 'center',
    },
    footerWarningText: {
        fontSize: 12,
        color: '#e11d48',
        fontWeight: '600',
        fontFamily: Fonts.sans,
        textAlign: 'center',
    },
    serialInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        width: '100%',
    },
    checkCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    serialIndexText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
    },
    serialInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingLeft: 12,
        paddingRight: 4,
        height: 48,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    serialInput: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        height: '100%',
        paddingVertical: 0,
    },
    inputScanIcon: {
        padding: 8,
    },
    trashBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
