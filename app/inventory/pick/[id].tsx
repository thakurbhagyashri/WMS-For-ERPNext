import { DotsLoader } from '@/components/DotsLoader';
import { TopNavbar } from '@/components/TopNavbar';
import { ConfirmationModal, PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { useCompanyContext } from '@/context/CompanyContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Check,
    CheckCircle2,
    ClipboardList,
    Hash,
    Layers,
    MapPin,
    Package,
    Scan,
    Search,
    SkipForward,
    X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dimensions,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const StepIndicator = ({ currentStep }: { currentStep: number }) => (
    <View style={[styles.stepperContainer, { paddingHorizontal: 24, paddingVertical: 16, marginBottom: 4, position: 'relative' }]}>
        <View style={styles.stepTrackLine} />
        <View style={[styles.stepActiveLine, {
            width: currentStep === 1 ? '0%' : currentStep === 2 ? '45%' : '82%'
        }]} />

        <View style={styles.stepWrapper}>
            <View style={[styles.stepCircle, currentStep >= 1 && styles.stepActive]}>
                {currentStep > 1 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, currentStep >= 1 && styles.stepNumActive]}>1</Text>}
            </View>
            <Text style={[styles.stepLabel, currentStep >= 1 && styles.stepLabelActive]}>View Items</Text>
        </View>
        <View style={styles.stepWrapper}>
            <View style={[styles.stepCircle, currentStep >= 2 && styles.stepActive]}>
                {currentStep > 2 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, currentStep >= 2 && styles.stepNumActive]}>2</Text>}
            </View>
            <Text style={[styles.stepLabel, currentStep >= 2 && styles.stepLabelActive]}>Verify & Pick</Text>
        </View>
        <View style={styles.stepWrapper}>
            <View style={[styles.stepCircle, currentStep >= 3 && styles.stepActive]}>
                <Text style={[styles.stepNum, currentStep >= 3 && styles.stepNumActive]}>3</Text>
            </View>
            <Text style={[styles.stepLabel, currentStep >= 3 && styles.stepLabelActive]}>Review & Submit</Text>
        </View>
    </View>
);

const ItemPickCard = ({ index, item_code, item_name, qty, uom, location, warehouse, has_serial, has_batch, batch_no, serial_no }: any) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(500)} style={[styles.itemCard, { padding: 0, overflow: 'hidden' }]}>
        <View style={{ padding: 16 }}>
            <View style={styles.itemHeader}>
                <View style={styles.itemIdentity}>
                    <View style={[styles.indexBadge, { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }]}>
                        <Text style={[styles.indexText, { color: '#7634bc' }]}>{index + 1}</Text>
                    </View>
                    <View style={styles.itemTextContainer}>
                        <Text style={[styles.itemCode, { fontSize: 15, color: '#1e1b4b' }]} numberOfLines={1}>{item_code}</Text>
                        <Text style={[styles.itemName, { fontSize: 12 }]} numberOfLines={2}>{item_name}</Text>
                    </View>
                </View>
                <View style={styles.qtyContainer}>
                    <Text style={[styles.qtyText, { color: '#7634bc', fontSize: 18 }]}>{qty} <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>{uom}</Text></Text>
                    {(has_serial || has_batch) && (
                        <View style={{ backgroundColor: has_serial ? '#eff6ff' : '#fff7ed', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: has_serial ? '#bfdbfe' : '#ffedd5' }}>
                            <Text style={[styles.trackingText, { color: has_serial ? '#3b82f6' : '#f97316', marginTop: 0, fontSize: 10, textTransform: 'uppercase' }]}>
                                {has_serial ? 'Serialized' : 'Batched'}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
            <View style={[styles.locationContainer, { borderTopColor: '#f1f5f9', marginTop: 4 }]}>
                <View style={styles.locationInfo}>
                    <MapPin size={14} color="#64748b" />
                    <Text style={styles.warehouseText} numberOfLines={1}>{warehouse}</Text>
                </View>
            </View>
        </View>

        {(batch_no || serial_no) && (
            <View style={{ backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {has_serial ? <Hash size={16} color="#7634bc" /> : <Layers size={16} color="#7634bc" />}
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                        Allocated {has_serial ? 'Serials' : 'Batch'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }} numberOfLines={2}>
                        {serial_no || batch_no}
                    </Text>
                </View>
            </View>
        )}
    </Animated.View>
);

export default function PickingScreen() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { getResource, putResource, postResource, callMethod } = useFrappe(APP_CONFIG);
    const { hasPermission } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);

    useEffect(() => {
        if (!hasPermission('can_pick')) {
            setDeniedModalVisible(true);
        }
    }, [hasPermission]);

    const [picklist, setPicklist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [step, setStep] = useState(1);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [scanText, setScanText] = useState('');
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
    const [pickingPhase, setPickingPhase] = useState<'item' | 'warehouse' | 'dimension' | 'tracking' | 'confirm_batch_qty' | 'confirm'>('item');
    const [confirmedQty, setConfirmedQty] = useState('');
    const [pickedTracking, setPickedTracking] = useState<string[]>([]);
    const [batchAllocations, setBatchAllocations] = useState<{ batch_no: string, qty: number, serial_nos?: string[] }[]>([]);
    const [currentBatch, setCurrentBatch] = useState<{ batch_no: string, available_qty: number, required_qty?: number, scanned_serials?: string[] } | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [alertData, setAlertData] = useState<{ visible: boolean; title: string; message: string; isError?: boolean }>({ visible: false, title: '', message: '', isError: true });

    // Queue of Inventory Dimensions still to be scanned for the item currently being picked
    const [pendingDimensions, setPendingDimensions] = useState<any[]>([]);
    const [currentDimIndex, setCurrentDimIndex] = useState(0);
    const [checkingStock, setCheckingStock] = useState(false);

    // Target Warehouse states for Material Transfer Stock Entry creation
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [warehouses, setWarehouses] = useState<any[]>([]);


    // Source Warehouse states for updating picklist warehouse
    const [showSourceWarehouseModal, setShowSourceWarehouseModal] = useState(false);
    const [availableSourceWarehouses, setAvailableSourceWarehouses] = useState<any[]>([]);
    const [loadingSourceWarehouses, setLoadingSourceWarehouses] = useState(false);

    const [inventoryDimention, setInventoryDimention] = useState<any[]>([]);
    const [dimensionValues, setDimensionValues] = useState<Record<string, string>>({});
    const [dimensionOptions, setDimensionOptions] = useState<Record<string, any[]>>({});
    const [dimensionSearch, setDimensionSearch] = useState<Record<string, string>>({});
    const [showDimDropdown, setShowDimDropdown] = useState<string | null>(null);
    const [dimDropPage, setDimDropPage] = useState<Record<string, number>>({});
    const { defaultCurrency } = useCompanyContext();
    const DIM_PAGE_SIZE = 10;

    useEffect(() => {
        if (picklist?.company) {
            const loadWh = async () => {
                try {
                    const data = await getResource('Warehouse', undefined, {
                        filters: JSON.stringify([
                            ['is_group', '=', 0],
                            ['disabled', '=', 0],
                            ['company', '=', picklist.company]
                        ]),
                        fields: '["name", "warehouse_name"]',
                        limit_page_length: 100
                    });
                    if (Array.isArray(data)) setWarehouses(data);
                } catch (e) {
                    console.error('Failed to load target warehouses:', e);
                }
            };
            loadWh();
        }
    }, [picklist?.company]);

    const [showFooter, setShowFooter] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPicklist();
        setRefreshing(false);
    };

    const handleScroll = (event: any) => {
        const currentOffset = event.nativeEvent.contentOffset.y;
        // Keep footer always visible, disable hide-on-scroll
        setLastScrollY(currentOffset);
    };

    const items = picklist?.locations || picklist?.items || [];
    const activeItem = items[currentItemIndex] || {};

    useEffect(() => {
        const loadAll = async () => {
            if (id) {
                await fetchInventoryDimention();
                await fetchPicklist();
            }
        };
        loadAll();
    }, [id]);

    // fetch inventory dimension fields
    async function fetchInventoryDimention() {
        try {
            const data = await getResource('Inventory Dimension', undefined, {
                filters: JSON.stringify({ apply_to_all_doctypes: 1 }),
                fields: '["*"]',
                limit_page_length: 1000
            });
            setInventoryDimention(data);
            console.log('Inventory dimention data------------->', data);

            const optionsMap: Record<string, any[]> = {};
            for (const dim of data) {
                optionsMap[dim.source_fieldname] = [];
            }
            setDimensionOptions(optionsMap);
        } catch (error) {
            console.log('Failed to fetch inventory dimensions:', error);
        }
    };


    const handleDimensionSearch = async (source_fieldname: string, refDoctype: string | null, text: string) => {
        setDimensionSearch(prev => ({ ...prev, [source_fieldname]: text }));
        setShowDimDropdown(source_fieldname);
        if (!refDoctype) return;  // free-text — no master list to query
        try {
            const docs = await getResource(refDoctype, undefined, {
                filters: JSON.stringify([['name', 'like', `%${text}%`]]),
                fields: '["name"]',
                limit_page_length: DIM_PAGE_SIZE
            });
            setDimensionOptions(prev => ({ ...prev, [source_fieldname]: docs || [] }));
        } catch (e) {
            console.warn(`Failed to search options for ${refDoctype}:`, e);
            setDimensionOptions(prev => ({ ...prev, [source_fieldname]: [] }));
        }
    };


    const requestScanner = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                setAlertData({ visible: true, title: 'Permission Required', message: 'Camera access is needed to scan barcodes.', isError: true });
                return;
            }
        }
        setIsScanning(true);
    };

    const handleBarCodeScanned = ({ data }: any) => {
        setIsScanning(false);
        setScanText(data);
        handleVerify(data);
    };

    const needsTrackingFor = (item: any) => (
        item.has_serial_no == 1 || item.has_serial_no == "1" ||
        item.has_batch_no == 1 || item.has_batch_no == "1" ||
        !!item.serial_no || !!item.batch_no
    );


    const checkStockAvailability = async (item: any) => {
        setCheckingStock(true);
        try {
            const data = await getResource('Bin', undefined, {
                filters: JSON.stringify([['item_code', '=', item.item_code], ['warehouse', '=', item.warehouse]]),
                fields: '["actual_qty"]',
                limit_page_length: 1
            });
            const actualQty = Array.isArray(data) && data[0] ? Number(data[0].actual_qty) || 0 : 0;
            if (actualQty < Number(item.qty)) {
                setAlertData({
                    visible: true,
                    title: 'Low Stock Warning',
                    message: `Only ${actualQty} ${item.uom || 'units'} of ${item.item_code} available in ${item.warehouse}, but ${item.qty} is required. Please double-check the physical location before confirming.`,
                    isError: true
                });
            }
        } catch (e) {
            console.warn('Stock availability check failed:', e);
        } finally {
            setCheckingStock(false);
        }
    };

    const enterConfirmPhase = (item: any) => {
        setPickingPhase('confirm');

        // Default to total quantity, but if serials were scanned, default to the count of scanned serials
        let defaultQty = item.qty.toString();
        if ((item.has_serial_no == 1 || item.has_serial_no == '1') && pickedTracking.length > 0) {
            defaultQty = pickedTracking.length.toString();
        }

        setConfirmedQty(defaultQty);
        setVerificationStatus('pending');
        setScanText('');
        checkStockAvailability(item);
    };

    const proceedPastDimensions = () => {
        if (needsTrackingFor(activeItem)) {
            setPickingPhase('tracking');
            setVerificationStatus('pending');
            setScanText('');
        } else {
            enterConfirmPhase(activeItem);
        }
    };

    const handleVerify = (scannedCode: string) => {
        const code = scannedCode.trim();
        if (!code) return;

        let cleanedScanData = code;
        if (cleanedScanData.includes('/')) {
            const parts = cleanedScanData.split('/');
            cleanedScanData = parts[parts.length - 1];
        }
        const lowerScanData = cleanedScanData.toLowerCase();

        if (pickingPhase === 'item') {
            const isMatch =
                (activeItem.item_code && activeItem.item_code.toLowerCase() === lowerScanData) ||
                (activeItem.item_name && activeItem.item_name.toLowerCase().includes(lowerScanData)) ||
                (activeItem.barcode && activeItem.barcode.toLowerCase() === lowerScanData) ||
                (activeItem.barcodes && activeItem.barcodes.some((b: string) => b.toLowerCase() === lowerScanData));

            if (isMatch) {
                setVerificationStatus('success');
                setTimeout(() => {
                    setVerificationStatus('pending');
                    setScanText('');
                    setPickingPhase('warehouse');
                }, 600);
            } else {
                setVerificationStatus('error');
                setTimeout(() => {
                    setVerificationStatus('pending');
                    setScanText('');
                }, 1000);
            }
        } else if (pickingPhase === 'warehouse') {
            const isMatch = code === activeItem.warehouse || code === activeItem.location;
            if (isMatch) {
                setVerificationStatus('success');
                setTimeout(() => {
                    if (inventoryDimention.length > 0) {

                        setPendingDimensions(inventoryDimention);
                        setCurrentDimIndex(0);
                        setPickingPhase('dimension');
                        setVerificationStatus('pending');
                        setScanText('');
                    } else {
                        proceedPastDimensions();
                    }
                }, 600);
            } else {
                setVerificationStatus('error');
                setTimeout(() => {
                    setVerificationStatus('pending');
                    setScanText('');
                }, 1000);
            }
        } else if (pickingPhase === 'dimension') {
            const dim = pendingDimensions[currentDimIndex];
            if (!dim) {
                proceedPastDimensions();
                return;
            }
            const verifyDimension = async () => {
                try {

                    const refDoctype = dim.document_type;
                    if (refDoctype) {
                        const exists = await getResource(refDoctype, code);
                        if (!exists) throw new Error('Not Found');
                    }

                    setVerificationStatus('success');

                    const fieldName = dim.source_fieldname;
                    setDimensionValues(prev => ({ ...prev, [fieldName]: code }));

                    const updatedLocations = [...(picklist?.locations || [])];
                    if (updatedLocations[currentItemIndex]) {
                        updatedLocations[currentItemIndex] = {
                            ...updatedLocations[currentItemIndex],
                            [fieldName]: code
                        };
                        setPicklist({ ...picklist, locations: updatedLocations });
                    }

                    setTimeout(() => {
                        setVerificationStatus('pending');
                        setScanText('');
                        setDimensionSearch(prev => { const n = { ...prev }; delete n[fieldName]; return n; });
                        setShowDimDropdown(null);
                        if (currentDimIndex + 1 < pendingDimensions.length) {
                            setCurrentDimIndex(prev => prev + 1);
                        } else {
                            proceedPastDimensions();
                        }
                    }, 600);
                } catch (e) {
                    setVerificationStatus('error');
                    setTimeout(() => {
                        setVerificationStatus('pending');
                        setScanText('');
                    }, 1000);
                }
            };
            verifyDimension();

        } else if (pickingPhase === 'tracking') {
            const verifyTracking = async () => {
                try {
                    const isSerial = activeItem.has_serial_no == 1 || activeItem.has_serial_no == "1";
                    const isBatch = activeItem.has_batch_no == 1 || activeItem.has_batch_no == "1";
                    const target = getTrackingTarget();

                    if (target === 'serial') {
                        if (pickedTracking.includes(code)) {
                            setAlertData({ visible: true, title: 'Already Scanned', message: 'This serial number has already been added to this picking operation.', isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }

                        if (pickedTracking.length >= Number(activeItem.qty)) {
                            setAlertData({ visible: true, title: 'Quantity Complete', message: `${activeItem.qty} of ${activeItem.qty} serial numbers have already been picked.`, isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }

                        const serialDoc = await getResource('Serial No', code);
                        if (!serialDoc) {
                            setAlertData({ visible: true, title: 'Invalid Serial', message: `Serial Number ${code} was not found.`, isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }
                        if (serialDoc.item_code !== activeItem.item_code) {
                            setAlertData({ visible: true, title: 'Invalid Serial', message: `Serial Number ${code} does not belong to item ${activeItem.item_code}.`, isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }
                        if (serialDoc.warehouse !== activeItem.warehouse) {
                            setAlertData({ visible: true, title: 'Invalid Serial', message: `Serial Number ${code} is not in warehouse ${activeItem.warehouse}.`, isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }
                        if (serialDoc.status !== 'Active') {
                            setAlertData({ visible: true, title: 'Invalid Serial', message: `Serial Number ${code} is not available for picking (Status: ${serialDoc.status}).`, isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }

                        if (isBatch) {
                            if (!serialDoc.batch_no) {
                                setAlertData({ visible: true, title: 'Missing Batch', message: `Serial Number ${code} is not linked to any batch in the system.`, isError: true });
                                setVerificationStatus('error');
                                setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                                return;
                            }

                            const newPickedTracking = [...pickedTracking, code];
                            setPickedTracking(newPickedTracking);

                            const newAllocations = [...batchAllocations];
                            const existingIdx = newAllocations.findIndex(b => b.batch_no === serialDoc.batch_no);
                            if (existingIdx >= 0) {
                                newAllocations[existingIdx].qty += 1;
                                if (!newAllocations[existingIdx].serial_nos) newAllocations[existingIdx].serial_nos = [];
                                newAllocations[existingIdx].serial_nos!.push(code);
                            } else {
                                newAllocations.push({ batch_no: serialDoc.batch_no, qty: 1, serial_nos: [code] });
                            }
                            setBatchAllocations(newAllocations);
                        } else {
                            setPickedTracking([...pickedTracking, code]);
                        }

                        setVerificationStatus('success');

                        // If all serials picked, they can click "Confirm Pick", or we can auto-complete.
                        // We will allow them to click the "Confirm Pick" button in the tracking screen for Serials.
                        setTimeout(() => {
                            setVerificationStatus('pending');
                            setScanText('');
                        }, 600);

                    } else if (target === 'batch') {
                        const batchDoc = await getResource('Batch', code);
                        if (!batchDoc) {
                            setAlertData({ visible: true, title: 'Invalid Batch', message: `Batch ${code} was not found.`, isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }
                        if (batchDoc.item !== activeItem.item_code) {
                            setAlertData({ visible: true, title: 'Invalid Batch', message: `Batch ${code} does not belong to item ${activeItem.item_code}.`, isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }

                        // Check stock available for this batch in this warehouse
                        try {
                            setCheckingStock(true);
                            const availableQtyStr = await callMethod(
                                'erpnext.stock.doctype.batch.batch.get_batch_qty',
                                { batch_no: code, warehouse: activeItem.warehouse }
                            );
                            const availableQty = Number(availableQtyStr) || 0;
                            setCheckingStock(false);

                            if (availableQty <= 0) {
                                setAlertData({ visible: true, title: 'Batch Unavailable', message: `${code} has no available stock in ${activeItem.warehouse} warehouse.`, isError: true });
                                setVerificationStatus('error');
                                setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                                return;
                            }

                            // Calculate remaining required
                            const alreadyPicked = batchAllocations.reduce((acc, b) => acc + b.qty, 0);
                            const remaining = Number(activeItem.qty) - alreadyPicked;

                            if (remaining <= 0) {
                                setAlertData({ visible: true, title: 'Quantity Complete', message: `Required quantity has already been picked.`, isError: true });
                                setVerificationStatus('error');
                                setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                                return;
                            }

                            setVerificationStatus('success');
                            setTimeout(() => {
                                setCurrentBatch({ batch_no: code, available_qty: availableQty });
                                setPickingPhase('confirm_batch_qty');
                                setConfirmedQty(Math.min(availableQty, remaining).toString());
                                setVerificationStatus('pending');
                                setScanText('');
                            }, 600);

                        } catch (stockErr) {
                            setCheckingStock(false);
                            console.warn('Could not check batch stock', stockErr);
                            setAlertData({ visible: true, title: 'Error', message: 'Failed to verify batch stock.', isError: true });
                            setVerificationStatus('error');
                            setTimeout(() => { setVerificationStatus('pending'); setScanText(''); }, 1000);
                            return;
                        }
                    }
                } catch (e) {
                    setVerificationStatus('error');
                    setTimeout(() => {
                        setVerificationStatus('pending');
                        setScanText('');
                    }, 1000);
                }
            };
            verifyTracking();
        }
    };

    const resetPickingState = () => {
        if (currentItemIndex < items.length - 1) {
            setCurrentItemIndex(prev => prev + 1);
            setPickingPhase('item');
            setPickedTracking([]);
            setBatchAllocations([]);
            setCurrentBatch(null);
            setConfirmedQty('');
            setPendingDimensions([]);
            setCurrentDimIndex(0);
            setDimensionValues({});
            setDimensionSearch({});
            setShowDimDropdown(null);
        } else {
            setStep(3);
        }
    };

    const handleConfirmPick = () => {
        const isSerial = activeItem.has_serial_no == 1 || activeItem.has_serial_no == "1";
        const isBatch = activeItem.has_batch_no == 1 || activeItem.has_batch_no == "1";

        let finalQty = 0;

        if (isSerial) {
            finalQty = pickedTracking.length;
            if (finalQty === 0) {
                setAlertData({ visible: true, title: 'No Serials Picked', message: 'Please scan at least one serial number.', isError: true });
                return;
            }
        } else if (isBatch) {
            finalQty = batchAllocations.reduce((sum, b) => sum + b.qty, 0);
            if (finalQty === 0) {
                setAlertData({ visible: true, title: 'No Batches Picked', message: 'Please pick at least one batch.', isError: true });
                return;
            }
        } else {
            if (!confirmedQty || isNaN(Number(confirmedQty))) return;
            finalQty = Number(confirmedQty);
        }

        const updatedLocations = [...(picklist?.locations || [])];
        if (updatedLocations[currentItemIndex]) {
            updatedLocations[currentItemIndex] = {
                ...updatedLocations[currentItemIndex],
                picked_qty: finalQty,
                is_picked: true,
                is_skipped: false,
                batchAllocations: isBatch ? batchAllocations : undefined,
                serial_no: isSerial ? pickedTracking.join('\n') : undefined,
                serial_and_batch_bundle: null
            };
            setPicklist({ ...picklist, locations: updatedLocations });
        }

        resetPickingState();
    };

    const handleConfirmBatchQty = () => {
        if (!confirmedQty || isNaN(Number(confirmedQty)) || Number(confirmedQty) <= 0) return;
        const qtyToPick = Number(confirmedQty);

        if (!currentBatch) return;

        // Check if pick qty exceeds available qty
        if (qtyToPick > currentBatch.available_qty) {
            setAlertData({ visible: true, title: 'Invalid Quantity', message: `Cannot pick more than available quantity (${currentBatch.available_qty}).`, isError: true });
            return;
        }

        const alreadyPicked = batchAllocations.reduce((acc, b) => acc + b.qty, 0);
        const remaining = Number(activeItem.qty) - alreadyPicked;

        if (qtyToPick > remaining) {
            setAlertData({ visible: true, title: 'Invalid Quantity', message: `Cannot pick more than remaining required quantity (${remaining}).`, isError: true });
            return;
        }

        const isSerial = activeItem.has_serial_no == 1 || activeItem.has_serial_no == "1";

        if (isSerial) {
            setCurrentBatch({ ...currentBatch, required_qty: qtyToPick, scanned_serials: [] });
            setPickingPhase('tracking');
            setVerificationStatus('pending');
            setScanText('');
            return;
        }

        // Add to batch allocations
        const newAllocations = [...batchAllocations];
        const existingIdx = newAllocations.findIndex(b => b.batch_no === currentBatch.batch_no);
        if (existingIdx >= 0) {
            newAllocations[existingIdx].qty += qtyToPick;
        } else {
            newAllocations.push({ batch_no: currentBatch.batch_no, qty: qtyToPick });
        }

        setBatchAllocations(newAllocations);
        setCurrentBatch(null);

        const newTotal = alreadyPicked + qtyToPick;
        if (newTotal >= Number(activeItem.qty)) {
            // All required qty is picked
            const updatedLocations = [...(picklist?.locations || [])];
            if (updatedLocations[currentItemIndex]) {
                updatedLocations[currentItemIndex] = {
                    ...updatedLocations[currentItemIndex],
                    picked_qty: newTotal,
                    is_picked: true,
                    is_skipped: false,
                    batchAllocations: newAllocations,
                    serial_and_batch_bundle: null
                };
                setPicklist({ ...picklist, locations: updatedLocations });
            }
            resetPickingState();
        } else {
            // Still need more batches
            setPickingPhase('tracking');
            setVerificationStatus('pending');
            setScanText('');
        }
    };


    // Pulls the scanned Inventory Dimension values (e.g. custom Rack/Tray/Bin fields) off a
    // picked location row so they carry through to the submitted Pick List / Delivery Note.
    const buildDimensionFields = (item: any) => {
        const fields: Record<string, any> = {};
        for (const dim of inventoryDimention) {
            if (dim.source_fieldname && item[dim.source_fieldname] !== undefined) {
                fields[dim.source_fieldname] = item[dim.source_fieldname];
            }
        }
        return fields;
    };

    const fetchAvailableWarehouses = async (itemCode: string) => {
        setLoadingSourceWarehouses(true);
        try {
            const bins = await getResource('Bin', undefined, {
                filters: JSON.stringify([
                    ['item_code', '=', itemCode],
                    ['actual_qty', '>', 0]
                ]),
                fields: '["warehouse", "actual_qty"]',
                limit_page_length: 100
            });
            if (Array.isArray(bins)) {
                setAvailableSourceWarehouses(bins);
            } else {
                setAvailableSourceWarehouses([]);
            }
        } catch (e) {
            console.error('Failed to fetch available source warehouses:', e);
            setAvailableSourceWarehouses([]);
        } finally {
            setLoadingSourceWarehouses(false);
        }
    };

    const selectSourceWarehouse = (whName: string) => {
        const updatedLocations = [...(picklist?.locations || [])];
        if (updatedLocations[currentItemIndex]) {
            updatedLocations[currentItemIndex] = {
                ...updatedLocations[currentItemIndex],
                warehouse: whName,
                location: whName
            };
            setPicklist({ ...picklist, locations: updatedLocations });
        }
        setShowSourceWarehouseModal(false);

        const updatedItem = updatedLocations[currentItemIndex] || activeItem;

        // Proceed to next phase automatically
        if (pendingDimensions.length > 0) {
            setPickingPhase('dimension');
        } else if (needsTrackingFor(updatedItem)) {
            setPickingPhase('tracking');
        } else {
            enterConfirmPhase(updatedItem);
        }
    };


    const getTrackingTarget = () => {
        if (!activeItem) return null;
        const isBatch = activeItem.has_batch_no == 1 || activeItem.has_batch_no == "1";
        const isSerial = activeItem.has_serial_no == 1 || activeItem.has_serial_no == "1";

        if (isBatch && isSerial) {
            return 'serial'; // Deduce batch from scanned serials directly
        }

        if (isBatch) return 'batch';
        if (isSerial) return 'serial';
        return null;
    };

    const fetchDimensionFallback = async (pickedItems: any[]): Promise<any[]> => {
        if (!inventoryDimention.length) return pickedItems;

        const hasMissing = pickedItems.some((item: any) =>
            inventoryDimention.some((dim: any) => !item[dim.source_fieldname] && item[dim.source_fieldname] !== 0)
        );
        if (!hasMissing) return pickedItems;

        const rawPurpose = (picklist?.purpose || '').toLowerCase();
        const srcDoctype = rawPurpose.includes('manufacture') ? 'Work Order'
            : rawPurpose.includes('material transfer') ? 'Material Request'
                : 'Sales Order';

        const picklistSo = picklist?.parent_sales_order || picklist?.sales_order;
        const picklistMr = picklist?.material_request;
        const picklistWo = picklist?.work_order;

        // Build a map: source-item-name -> source item object, keyed by the row name
        const srcItemMap: Record<string, any> = {};
        const srcDocNames = [...new Set([
            ...pickedItems.map((i: any) => i.sales_order || i.material_request || i.work_order),
            picklistSo, picklistMr, picklistWo
        ].filter(Boolean))] as string[];

        for (const srcName of srcDocNames) {
            try {
                const srcDoc = await getResource(srcDoctype, srcName);
                const srcItems = srcDoc?.items || srcDoc?.required_items || [];
                for (const si of srcItems) {
                    if (si.name) srcItemMap[si.name] = si;
                    // also index by item_code as a loose fallback
                    if (si.item_code) srcItemMap[`${srcName}_${si.item_code}`] = si;
                }
            } catch (e) {
                console.warn('fetchDimensionFallback: could not fetch source doc', srcName, e);
            }
        }

        return pickedItems.map((item: any) => {
            const enriched = { ...item };
            const srcItem = srcItemMap[item.so_detail]
                || srcItemMap[item.sales_order_item]
                || srcItemMap[item.material_request_item]
                || srcItemMap[item.work_order_item]
                || (item.sales_order
                    ? srcItemMap[`${item.sales_order}_${item.item_code}`]
                    : null)
                || (item.material_request
                    ? srcItemMap[`${item.material_request}_${item.item_code}`]
                    : null);

            for (const dim of inventoryDimention) {
                if ((!enriched[dim.source_fieldname] && enriched[dim.source_fieldname] !== 0) && srcItem?.[dim.source_fieldname]) {
                    enriched[dim.source_fieldname] = srcItem[dim.source_fieldname];
                    console.log(`fetchDimensionFallback: filled ${dim.source_fieldname} = ${srcItem[dim.source_fieldname]} for item ${item.item_code}`);
                }
            }
            return enriched;
        });
    };

    const handleCompleteOnly = async () => {
        try {
            setLoading(true);
            let pickedItems = items.filter((i: any) => i.picked_qty > 0);
            if (pickedItems.length === 0) {
                setLoading(false);
                setAlertData({ visible: true, title: 'Cannot Complete', message: 'No items have been picked to complete.', isError: true });
                return;
            }

            // Auto-fill missing dimension fields (e.g. segment) from the source document
            pickedItems = await fetchDimensionFallback(pickedItems);

            const finalLocations = pickedItems.flatMap((item: any) => {
                if (item.batchAllocations && item.batchAllocations.length > 0) {
                    return item.batchAllocations.map((alloc: any, idx: number) => ({
                        ...item,
                        name: idx === 0 ? item.name : undefined, // preserve first name for updating, others insert
                        item_code: item.item_code,
                        warehouse: item.warehouse,
                        qty: alloc.qty,
                        stock_qty: alloc.qty,
                        picked_qty: alloc.qty,
                        custom_qty_scanned: alloc.qty,
                        uom: item.uom,
                        batch_no: alloc.batch_no,
                        serial_no: alloc.serial_nos ? alloc.serial_nos.join('\n') : item.serial_no,
                        use_serial_batch_fields: 1,
                        ...buildDimensionFields(item)
                    }));
                }
                return [{
                    ...item, // Preserve original references like sales_order, name, etc.
                    name: item.name,
                    item_code: item.item_code,
                    warehouse: item.warehouse,
                    qty: item.picked_qty,
                    stock_qty: item.picked_qty,
                    picked_qty: item.picked_qty,
                    custom_qty_scanned: item.picked_qty,
                    uom: item.uom,
                    serial_no: item.serial_no,
                    batch_no: item.batch_no,
                    use_serial_batch_fields: 1,
                    ...buildDimensionFields(item)
                }];
            });

            console.log('final picklist data------------->', finalLocations);

            await putResource('Pick List', id as string, {
                locations: finalLocations,
                docstatus: 1
            }, false, undefined, true);
            setAlertData({ visible: true, title: 'Success', message: 'Pick List completed successfully', isError: false });
            await fetchPicklist();
        } catch (e: any) {
            console.error('Failed to complete picklist:', e);
            const errorMessage = e?.message || e?.info || 'An unknown error occurred while submitting.';
            setAlertData({ visible: true, title: 'Submission Failed', message: errorMessage, isError: true });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDownstream = async (targetWhOverride?: any) => {
        console.log('1. [Submit Button] handleCreateDownstream triggered! targetWhOverride:', targetWhOverride);
        try {
            setLoading(true);
            let pickedItems = items.filter((i: any) => i.picked_qty > 0);
            console.log('2. [Submit Button] pickedItems count:', pickedItems.length);

            if (pickedItems.length === 0) {
                console.log('2a. [Submit Button] Returning early because pickedItems.length === 0');
                setLoading(false);
                setAlertData({ visible: true, title: 'Cannot Create', message: 'No items have been picked. Please pick at least one item.', isError: true });
                return;
            }

            const rawPurpose = picklist?.purpose || '';
            const purpose = rawPurpose.toLowerCase().trim();
            const isMaterialTransfer = purpose === 'material transfer' || purpose === 'material transfer for manufacture';
            const targetWh = typeof targetWhOverride === 'string' ? targetWhOverride : picklist?.for_warehouse;

            console.log('3. [Submit Button] purpose:', purpose, 'isMaterialTransfer:', isMaterialTransfer, 'targetWh:', targetWh);

            // We no longer require the frontend to ask for a warehouse. 
            // Both Source and Target are automatically pulled from the Material Request.
            // If they are missing in the backend, the frappe API will return a 500 validation error toast.

            console.log('4. [Submit Button] Fetching dimension fallback...');
            // Auto-fill missing dimension fields (e.g. segment) from the source document
            pickedItems = await fetchDimensionFallback(pickedItems);
            console.log('5. [Submit Button] fetchDimensionFallback complete');

            const finalLocations = pickedItems.flatMap((item: any) => {
                if (item.batchAllocations && item.batchAllocations.length > 0) {
                    return item.batchAllocations.map((alloc: any, idx: number) => ({
                        ...item,
                        name: idx === 0 ? item.name : undefined,
                        item_code: item.item_code,
                        warehouse: item.warehouse,
                        qty: alloc.qty,
                        stock_qty: alloc.qty,
                        picked_qty: alloc.qty,
                        custom_qty_scanned: alloc.qty,
                        uom: item.uom,
                        batch_no: alloc.batch_no,
                        serial_no: alloc.serial_nos ? alloc.serial_nos.join('\n') : item.serial_no,
                        use_serial_batch_fields: 1,
                        ...buildDimensionFields(item)
                    }));
                }
                return [{
                    ...item, // Preserve original references
                    name: item.name,
                    item_code: item.item_code,
                    warehouse: item.warehouse,
                    qty: item.picked_qty,
                    stock_qty: item.picked_qty,
                    picked_qty: item.picked_qty,
                    custom_qty_scanned: item.picked_qty,
                    uom: item.uom,
                    serial_no: item.serial_no,
                    batch_no: item.batch_no,
                    use_serial_batch_fields: 1,
                    ...buildDimensionFields(item)
                }];
            });
            console.log('6. [Submit Button] final picklist data------------->', finalLocations);

            if (picklist?.docstatus < 1) {
                console.log('7. [Submit Button] docstatus is < 1, proceeding with putResource');
                const payload: any = {
                    locations: finalLocations,
                    docstatus: 1
                };

                if (targetWh) {
                    payload.for_warehouse = targetWh;
                }

                console.log('8. [Submit Button] Executing putResource to Save & Submit with payload:', payload);
                // Save and submit in one atomic transaction
                await putResource('Pick List', id as string, payload, false, undefined, false);
                console.log('9. [Submit Button] Pick List submitted successfully!');
                if (picklist?.purpose === 'Delivery') {
                    try {
                        let createdDNName = '';
                        try {
                            const existingDNs = await getResource('Delivery Note Item', undefined, {
                                filters: JSON.stringify([['against_pick_list', '=', id]]),
                                fields: '["parent", "docstatus"]',
                                limit_page_length: 1
                            }, false, undefined, true);

                            if (existingDNs && existingDNs.length > 0) {
                                createdDNName = existingDNs[0].parent;
                            }
                        } catch (checkErr) {
                            console.warn('Could not check for existing DN (likely Insufficient Permission). Proceeding to create one.');
                        }

                        if (!createdDNName) {
                            const dnResult = await callMethod(
                                'erpnext.stock.doctype.pick_list.pick_list.create_delivery_note',
                                { source_name: id as string },
                                false, undefined, true
                            );
                            const dnDoc = dnResult?.message || dnResult?.data || dnResult;
                            if (dnDoc && dnDoc.doctype) {
                                // If the backend python script ALREADY saved the Delivery Note, it will have a real name.
                                const isAlreadySaved = dnDoc.name && !dnDoc.name.startsWith('New');

                                if (isAlreadySaved) {
                                    createdDNName = dnDoc.name;
                                } else {
                                    dnDoc.currency = dnDoc.currency || defaultCurrency;
                                    dnDoc.conversion_rate = dnDoc.conversion_rate || 1;

                                    const savedDN = await postResource(dnDoc.doctype, dnDoc);
                                    createdDNName = savedDN.name || dnDoc.name || '';
                                }
                            }
                        }

                        if (createdDNName) {
                            setAlertData({ visible: true, title: 'Success', message: `Picklist submitted.\nDraft Delivery Note: ${createdDNName}`, isError: false });
                        } else {
                            setAlertData({ visible: true, title: 'Success', message: 'Picklist submitted successfully.', isError: false });
                        }
                    } catch (err) {
                        console.warn('Draft DN error:', err);
                        setAlertData({ visible: true, title: 'Success', message: 'Picklist submitted successfully (but Delivery Note creation failed).', isError: false });
                    }
                }
                // Creating Stock entry for material transfer:

                else if (picklist?.purpose === 'Material Transfer' || picklist?.purpose === 'Material Transfer for Manufacture') {
                    try {
                        console.log(`[MTFM] Submitting Pick List: ${id}`);
                        console.log(`[MTFM] Pick List Submitted: ${id}`);
                        console.log(`[MTFM] Fetching Latest Pick List: ${id}`);

                        setLoadingMessage('Creating Stock Entry...');
                        const updatedDoc = await getResource('Pick List', id as string);

                        console.log(`[MTFM] Creating Stock Entry for: ${id}`);
                        const seResult = await callMethod(
                            'erpnext.stock.doctype.pick_list.pick_list.create_stock_entry',
                            { pick_list: updatedDoc },
                            false, undefined, true
                        );
                        console.log('createdSEItems---------------->', seResult)
                        const seDoc = seResult?.message || seResult?.data || seResult;

                        if (seDoc && seDoc.doctype) {
                            const isAlreadySaved = seDoc.name && !seDoc.name.startsWith('New');
                            if (isAlreadySaved) {
                                console.log(`[MTFM] Stock Entry Created: ${seDoc.name}`);
                                setAlertData({ visible: true, title: 'Success', message: `Picklist submitted and Stock Entry ${seDoc.name} created.`, isError: false });
                            } else {
                                const savedSE = await postResource('Stock Entry', seDoc, false, undefined, true);
                                console.log(`[MTFM] Stock Entry Created: ${savedSE?.name || 'Unknown'}`);
                                setAlertData({ visible: true, title: 'Success', message: `Picklist submitted and Draft Stock Entry ${savedSE?.name || 'created'}.`, isError: false });
                            }
                        } else {
                            throw new Error('Failed to generate Stock Entry mapping from ERPNext.');
                        }
                    } catch (err: any) {
                        console.error('Error creating stock entry:', err);
                        setAlertData({ visible: true, title: 'Success', message: `Picklist submitted successfully (but Stock Entry creation failed: ${err.message || 'Unknown Error'}).`, isError: false });
                    }
                }
                else {
                    setAlertData({ visible: true, title: 'Success', message: 'Picklist submitted successfully.', isError: false });
                }
            } else {
                setAlertData({ visible: true, title: 'Notice', message: 'Picklist is already submitted.', isError: false });
            }
            await fetchPicklist();
        } catch (e: any) {
            console.error('Failed to create downstream document:', e);
            setAlertData({ visible: true, title: 'Error', message: e.message || 'Failed to create document', isError: true });
        } finally {
            setLoading(false);
        }
    };

    async function fetchPicklist() {
        try {
            const doc = await getResource('Pick List', id as string);
            if (doc) {
                if (doc.locations) {
                    const enrichedLocations = await Promise.all(doc.locations.map(async (loc: any) => {
                        try {
                            const itemMaster = await getResource('Item', loc.item_code);
                            const barcodes = (itemMaster?.barcodes || []).map((b: any) => b.barcode).filter(Boolean);
                            if (itemMaster?.barcode && !barcodes.includes(itemMaster.barcode)) {
                                barcodes.push(itemMaster.barcode);
                            }
                            return {
                                ...loc,
                                barcodes,
                                has_batch_no: loc.has_batch_no !== undefined ? loc.has_batch_no : itemMaster?.has_batch_no,
                                has_serial_no: loc.has_serial_no !== undefined ? loc.has_serial_no : itemMaster?.has_serial_no
                            };
                        } catch (e) {
                            return loc;
                        }
                    }));
                    doc.locations = enrichedLocations;
                }
                setPicklist(doc);
                if (doc.docstatus === 1) {
                    setStep(3);
                }
            }
        } catch (e) {
            console.warn('Failed to fetch picklist', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <DotsLoader size={16} color="#7634bc" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
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
                            <Text style={styles.scannerTitle}>{t('scan_item_barcode', 'Scan Item Barcode')}</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={styles.scanTarget}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>
                        <Text style={styles.scanInstructions}>{t('point_camera_at_the_', 'Point camera at the item barcode')}</Text>
                    </View>
                </View>
            ) : (
                <>
                    <TopNavbar title="" showBackButton />

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2e1065"]} />
                        }
                    >
                        <StepIndicator currentStep={step} />

                        {/* Header Info Card */}
                        <LinearGradient
                            colors={['#4c1d95', '#6b21a8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.poInfoCard}
                        >
                            <View style={styles.poInfoHeaderRow1}>
                                <View style={styles.idBadgeHeader}>
                                    <ClipboardList size={14} color="#e9d5ff" />
                                    <Text style={styles.poIdText} numberOfLines={1} ellipsizeMode="tail">
                                        {picklist?.name || id}
                                    </Text>
                                </View>
                                {picklist?.docstatus === 0 && (
                                    <View style={styles.draftBadgeHeader}>
                                        <Text style={styles.draftBadgeTextHeader}>{t('draft', 'DRAFT')}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.poInfoHeaderRow2}>
                                <Text style={styles.itemsCountHeader}>
                                    {items.length} {items.length === 1 ? 'Item' : 'Items'}
                                </Text>
                            </View>

                            <View style={styles.poInfoDivider} />

                            <View style={styles.poInfoMetaSection}>
                                <View style={styles.poInfoMetaBlock}>
                                    <Text style={styles.metaLabelText}>Document</Text>
                                    <Text style={styles.metaValueText} numberOfLines={1}>
                                        {picklist?.parent_sales_order || picklist?.work_order || picklist?.material_request || picklist?.purpose || 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.poInfoMetaBlock}>
                                    <Text style={styles.metaLabelText}>Company</Text>
                                    <Text style={styles.metaValueText} numberOfLines={1}>
                                        {picklist?.customer || picklist?.for_warehouse || picklist?.company || 'N/A'}
                                    </Text>
                                </View>
                            </View>
                        </LinearGradient>

                        {step === 1 ? (
                            // <View><Text>scan items</Text></View>
                            <View style={styles.pickingWorkflow}>

                                {/* --- Attractive Progress Bar --- */}
                                <View style={{ marginBottom: 24, paddingHorizontal: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>

                                        {/* Step 1: Item */}
                                        <View style={{ alignItems: 'center', flex: 1 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: pickingPhase === 'item' ? '#7634bc' : '#10b981', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                                                {pickingPhase === 'item' ? <Package size={16} color="#fff" /> : <Check size={16} color="#fff" />}
                                            </View>
                                            <Text style={{ fontSize: 10, color: pickingPhase === 'item' ? '#7634bc' : '#10b981', marginTop: 4, fontWeight: '600', textAlign: 'center' }}>Scan Item</Text>
                                        </View>

                                        <View style={{ flex: 1, height: 2, backgroundColor: pickingPhase === 'item' ? '#e2e8f0' : '#10b981', marginHorizontal: -15, marginTop: -15, zIndex: 1 }} />

                                        {/* Step 2: Warehouse */}
                                        <View style={{ alignItems: 'center', flex: 1 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: pickingPhase === 'item' ? '#e2e8f0' : pickingPhase === 'warehouse' ? '#7634bc' : '#10b981', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                                                {pickingPhase === 'item' ? <MapPin size={16} color="#94a3b8" /> : pickingPhase === 'warehouse' ? <MapPin size={16} color="#fff" /> : <Check size={16} color="#fff" />}
                                            </View>
                                            <Text style={{ fontSize: 10, color: pickingPhase === 'item' ? '#94a3b8' : pickingPhase === 'warehouse' ? '#7634bc' : '#10b981', marginTop: 4, fontWeight: '600', textAlign: 'center' }}>Warehouse</Text>
                                        </View>

                                        <View style={{ flex: 1, height: 2, backgroundColor: (pickingPhase === 'item' || pickingPhase === 'warehouse') ? '#e2e8f0' : '#10b981', marginHorizontal: -15, marginTop: -15, zIndex: 1 }} />

                                        {/* Step 3: Tracking (Batch/Serial) */}
                                        <View style={{ alignItems: 'center', flex: 1 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (pickingPhase === 'item' || pickingPhase === 'warehouse') ? '#e2e8f0' : (pickingPhase === 'tracking' || pickingPhase === 'dimension') ? '#7634bc' : '#10b981', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                                                {(pickingPhase === 'item' || pickingPhase === 'warehouse') ? <Hash size={16} color="#94a3b8" /> : (pickingPhase === 'tracking' || pickingPhase === 'dimension') ? <Hash size={16} color="#fff" /> : <Check size={16} color="#fff" />}
                                            </View>
                                            <Text style={{ fontSize: 10, color: (pickingPhase === 'item' || pickingPhase === 'warehouse') ? '#94a3b8' : (pickingPhase === 'tracking' || pickingPhase === 'dimension') ? '#7634bc' : '#10b981', marginTop: 4, fontWeight: '600', textAlign: 'center' }}>
                                                {activeItem?.has_serial_no ? 'Serial' : 'Batch'}
                                            </Text>
                                        </View>

                                        <View style={{ flex: 1, height: 2, backgroundColor: pickingPhase === 'confirm' ? '#10b981' : '#e2e8f0', marginHorizontal: -15, marginTop: -15, zIndex: 1 }} />

                                        {/* Step 4: Confirm */}
                                        <View style={{ alignItems: 'center', flex: 1 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: pickingPhase === 'confirm' ? '#7634bc' : '#e2e8f0', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                                                <Check size={16} color={pickingPhase === 'confirm' ? '#fff' : '#94a3b8'} />
                                            </View>
                                            <Text style={{ fontSize: 10, color: pickingPhase === 'confirm' ? '#7634bc' : '#94a3b8', marginTop: 4, fontWeight: '600', textAlign: 'center' }}>Confirm</Text>
                                        </View>

                                    </View>
                                </View>
                                {/* --------------------------------- */}
                                <View style={styles.stepTitleRow}>
                                    <View style={styles.stepTitleLeft}>
                                        {pickingPhase === 'item' ? (
                                            <Package size={20} color="#0f172a" />
                                        ) : pickingPhase === 'warehouse' ? (
                                            <MapPin size={20} color="#0f172a" />
                                        ) : activeItem.has_serial_no ? (
                                            <Hash size={20} color="#0f172a" />
                                        ) : (
                                            <Layers size={20} color="#0f172a" />
                                        )}
                                        <Text style={styles.stepTitleText}>
                                            {pickingPhase === 'item' && 'Scan Item'}
                                            {pickingPhase === 'warehouse' && 'Scan Warehouse'}
                                            {pickingPhase === 'tracking' && (getTrackingTarget() === 'serial' ? 'Scan Serial Numbers' : 'Scan Batch Number')}
                                            {pickingPhase === 'confirm' && 'Confirm Pick'}
                                        </Text>
                                    </View>
                                    <Text style={styles.stepProgressCounter}>
                                        Item {currentItemIndex + 1} / {items.length}
                                    </Text>
                                </View>

                                {/* Active Item Card */}
                                {items.length === 0 || !activeItem.item_code ? (
                                    <Animated.View entering={FadeInDown} style={[styles.emptyCardWrapper, { marginBottom: 24 }]}>
                                        <LinearGradient
                                            colors={['#f8fafc', '#f1f5f9']}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                                        />
                                        <View style={styles.emptyCardContent}>
                                            <Package size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
                                            <Text style={styles.emptyCardTitle}>{t('no_items_to_pick', 'No Items to Pick')}</Text>
                                            <Text style={styles.emptyCardDesc}>{t('this_picklist_does_n', 'This picklist does not contain any items to pick.')}</Text>
                                        </View>
                                    </Animated.View>
                                ) : (
                                    <LinearGradient
                                        colors={
                                            verificationStatus === 'success' ? ['#ecfdf5', '#d1fae5'] :
                                                verificationStatus === 'error' ? ['#fef2f2', '#fee2e2'] :
                                                    ['#ffffff', '#ffffff']
                                        }
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                        style={[styles.activePickCard, verificationStatus === 'pending' && { borderWidth: 1, borderColor: '#f1f5f9' }]}
                                    >
                                        <View style={styles.activeCardHeader}>
                                            <View style={styles.activeItemMain}>
                                                <Text style={styles.activeItemCode} numberOfLines={1} ellipsizeMode="tail">{activeItem.item_code}</Text>
                                                <Text style={styles.activeItemName} numberOfLines={2} ellipsizeMode="tail">{activeItem.item_name}</Text>
                                            </View>
                                            <View style={styles.activeQtyBox}>
                                                <Text style={styles.qtyLabel}>Qty</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                                    <Text style={styles.activeQtyText} numberOfLines={1}>{activeItem.qty}</Text>
                                                    <Text style={styles.activeQtyUom} numberOfLines={1}>{activeItem.uom || ''}</Text>
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.nestedLocationBox}>
                                            <MapPin size={16} color="#c2410c" style={{ marginRight: 8 }} />
                                            <View style={styles.nestedLocationTextWrapper}>
                                                <Text style={styles.nestedWarehouseText} numberOfLines={1} ellipsizeMode="tail">{activeItem.warehouse}</Text>
                                            </View>
                                        </View>

                                        {/* Success Indicators for Steps */}
                                        {(pickingPhase === 'tracking') && verificationStatus !== 'success' && (
                                            <View style={styles.phaseSuccessBox}>
                                                <Check size={16} color="#10b981" />
                                                <Text style={styles.phaseSuccessText}>Warehouse: {activeItem.warehouse}</Text>
                                            </View>
                                        )}

                                        {(pickedTracking.length > 0 || batchAllocations.length > 0) && (
                                            <View style={[styles.phaseSuccessBox, { flexDirection: 'column', alignItems: 'flex-start', padding: 16 }]}>
                                                <View style={[styles.trackingHeader, { marginBottom: 12 }]}>
                                                    <Check size={18} color="#10b981" />
                                                    <Text style={[styles.phaseSuccessText, { fontSize: 15 }]}>
                                                        {activeItem.has_serial_no == 1 || activeItem.has_serial_no == "1"
                                                            ? `Scanned Serials (${pickedTracking.length})`
                                                            : `Scanned Batches (${batchAllocations.reduce((sum, b) => sum + b.qty, 0)})`}
                                                    </Text>
                                                </View>
                                                <View style={{ width: '100%' }}>
                                                    {activeItem.has_batch_no == 1 || activeItem.has_batch_no == "1" ? (
                                                        batchAllocations.map((b, idx) => (
                                                            <View key={idx} style={{
                                                                backgroundColor: '#fff',
                                                                borderRadius: 10,
                                                                padding: 12,
                                                                marginBottom: 8,
                                                                borderWidth: 1,
                                                                borderColor: '#e2e8f0',
                                                                width: '100%'
                                                            }}>
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                        <Layers size={14} color="#64748b" style={{ marginRight: 6 }} />
                                                                        <Text style={{ fontSize: 14, color: '#334155', fontWeight: '700' }}>
                                                                            Batch: {b.batch_no}
                                                                        </Text>
                                                                    </View>
                                                                    <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '700' }}>Qty: {b.serial_nos?.length || b.qty}</Text>
                                                                    </View>
                                                                </View>

                                                                {(b.serial_nos || []).length > 0 && (
                                                                    <View style={styles.trackingChipsRow}>
                                                                        {b.serial_nos!.map((t, tidx) => (
                                                                            <View key={tidx} style={[styles.trackingChip, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }]}>
                                                                                <Text style={[styles.trackingChipText, { color: '#475569' }]}>{t}</Text>
                                                                            </View>
                                                                        ))}
                                                                    </View>
                                                                )}
                                                            </View>
                                                        ))
                                                    ) : activeItem.has_serial_no == 1 || activeItem.has_serial_no == "1" ? (
                                                        <View style={styles.trackingChipsRow}>
                                                            {pickedTracking.map((t, idx) => (
                                                                <View key={idx} style={[styles.trackingChip, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }]}>
                                                                    <Text style={styles.trackingChipText}>{t}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    ) : null}
                                                </View>
                                            </View>
                                        )}
                                    </LinearGradient>
                                )}

                                {/* Verification Section */}
                                {items.length > 0 && activeItem.item_code && (
                                    <View style={styles.verifySection}>
                                        <Text style={styles.verifyLabel}>
                                            {pickingPhase === 'item' && 'Scan item barcode to verify'}
                                            {pickingPhase === 'warehouse' && 'Scan warehouse/location barcode'}
                                            {pickingPhase === 'dimension' && `Scan ${pendingDimensions[currentDimIndex]?.dimension_name || pendingDimensions[currentDimIndex]?.source_fieldname || 'location'} (${currentDimIndex + 1}/${pendingDimensions.length})`}
                                            {pickingPhase === 'tracking' && (
                                                getTrackingTarget() === 'serial'
                                                    ? `Scan serial numbers (${currentBatch?.scanned_serials?.length || pickedTracking.length}/${currentBatch?.required_qty || activeItem.qty})`
                                                    : `Scan batch number`
                                            )}
                                            {pickingPhase === 'confirm' && `Confirm picked quantity (required: ${activeItem.qty})`}
                                            {pickingPhase === 'confirm_batch_qty' && `Confirm quantity for Batch ${currentBatch?.batch_no} (available: ${currentBatch?.available_qty})`}
                                        </Text>

                                        {pickingPhase !== 'confirm' && pickingPhase !== 'confirm_batch_qty' ? (
                                            <>
                                                <View style={[styles.scanInputWrapper, verificationStatus === 'success' && { borderColor: '#10b981' }, verificationStatus === 'error' && { borderColor: '#ef4444' }]}>
                                                    <Search size={20} color="#94a3b8" style={styles.searchIcon} />
                                                    <TextInput
                                                        placeholder={
                                                            pickingPhase === 'item' ? "Scan item barcode..." :
                                                                pickingPhase === 'warehouse' ? "Scan warehouse barcode..." :
                                                                    pickingPhase === 'dimension' ? `Type or scan ${pendingDimensions[currentDimIndex]?.dimension_name || 'dimension'} value...` :
                                                                        "Scan tracking number..."
                                                        }
                                                        style={styles.scanTextInput}
                                                        placeholderTextColor="#94a3b8"
                                                        value={pickingPhase === 'dimension' ? (dimensionSearch[pendingDimensions[currentDimIndex]?.source_fieldname] ?? scanText) : scanText}
                                                        onChangeText={(text) => {
                                                            if (pickingPhase === 'dimension') {
                                                                const dim = pendingDimensions[currentDimIndex];
                                                                if (dim) handleDimensionSearch(dim.source_fieldname, dim.document_type || null, text);
                                                                setScanText(text);
                                                            } else {
                                                                setScanText(text);
                                                            }
                                                        }}
                                                        onSubmitEditing={() => {
                                                            if (pickingPhase === 'dimension') {
                                                                const dim = pendingDimensions[currentDimIndex];
                                                                const val = (dim && dimensionSearch[dim.source_fieldname]) || scanText;
                                                                if (val.trim()) handleVerify(val.trim());
                                                            } else {
                                                                handleVerify(scanText);
                                                            }
                                                        }}
                                                        autoFocus
                                                    />
                                                    <TouchableOpacity style={styles.miniScanBtn} onPress={requestScanner}>
                                                        <Scan size={18} color="#0f172a" />
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Dimension dropdown suggestions */}
                                                {pickingPhase === 'dimension' && (() => {
                                                    const dim = pendingDimensions[currentDimIndex];
                                                    if (!dim) return null;
                                                    const opts = dimensionOptions[dim.source_fieldname] || [];
                                                    const isOpen = showDimDropdown === dim.source_fieldname;
                                                    if (!isOpen || opts.length === 0) return null;
                                                    return (
                                                        <View style={styles.dimDropdownBox}>
                                                            {opts.map((opt: any, oi: number) => (
                                                                <TouchableOpacity
                                                                    key={oi}
                                                                    style={styles.dimDropdownItem}
                                                                    onPress={() => {
                                                                        setDimensionSearch(prev => ({ ...prev, [dim.source_fieldname]: opt.name }));
                                                                        setScanText(opt.name);
                                                                        setShowDimDropdown(null);
                                                                        handleVerify(opt.name);
                                                                    }}
                                                                >
                                                                    <Text style={styles.dimDropdownText}>{opt.name}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    );
                                                })()}

                                                {pickingPhase === 'dimension' && !pendingDimensions[currentDimIndex]?.reqd && (
                                                    <TouchableOpacity
                                                        style={styles.proceedBtn}
                                                        onPress={() => {
                                                            if (currentDimIndex + 1 < pendingDimensions.length) {
                                                                setCurrentDimIndex(prev => prev + 1);
                                                            } else {
                                                                proceedPastDimensions();
                                                            }
                                                        }}
                                                    >
                                                        <Text style={styles.proceedBtnText}>Skip (not mandatory)</Text>
                                                    </TouchableOpacity>
                                                )}

                                                {pickingPhase === 'tracking' && (
                                                    <TouchableOpacity style={styles.proceedBtn} onPress={() => handleConfirmPick()}>
                                                        <Text style={styles.proceedBtnText}>
                                                            {activeItem.has_serial_no == 1 || activeItem.has_serial_no == "1"
                                                                ? `Confirm Pick (${pickedTracking.length}/${activeItem.qty} Serials)`
                                                                : `Confirm Pick (${batchAllocations.reduce((sum, b) => sum + b.qty, 0)}/${activeItem.qty} qty)`}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </>
                                        ) : (
                                            <View style={{ flex: 1 }}>
                                                <View style={styles.confirmQtyWrapper}>
                                                    <TextInput
                                                        style={styles.confirmQtyInput}
                                                        value={confirmedQty}
                                                        onChangeText={(text) => setConfirmedQty(text.replace(/[^0-9.]/g, ''))}
                                                        keyboardType="decimal-pad"
                                                        autoFocus
                                                        selectTextOnFocus
                                                    />
                                                </View>
                                                {checkingStock && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                                        <DotsLoader size={8} color="#7634bc" />
                                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Checking stock availability...</Text>
                                                    </View>
                                                )}
                                                {Number(confirmedQty) < Number(activeItem.qty) && Number(confirmedQty) > 0 && (
                                                    <Text style={styles.partialPickText}>
                                                        Partial pick: {Number(activeItem.qty) - Number(confirmedQty)} {activeItem.uom || ''} will remain
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        ) :
                            step === 2 ? (
                                <></>
                            ) : (
                                <View style={styles.summarySection}>
                                    <View style={styles.pickingCompleteHeader}>
                                        <View style={styles.successIconCircle}>
                                            <Check size={20} color="#10b981" />
                                        </View>
                                        <Text style={styles.pickingCompleteText}>{t('picking_complete', 'Picking Complete')}</Text>
                                    </View>

                                    <View style={styles.summaryCard}>
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>{t('summary', 'Summary')}</Text>
                                        </View>
                                        <View style={[styles.summaryRow, { marginTop: 12 }]}>
                                            <Text style={styles.summaryPlId}>{picklist?.name || id}</Text>
                                            <Text style={styles.summaryStatText}>
                                                <Text style={{ color: '#10b981' }}>{items.filter((i: any) => i.picked_qty > 0).length} / {items.length}</Text> picked
                                            </Text>
                                        </View>
                                        <View style={[styles.summaryRow, { marginTop: 16 }]}>
                                            <Text style={styles.summaryLabel}>{t('purpose', 'Purpose')}</Text>
                                            <Text style={styles.summaryValueText}>{picklist?.purpose || 'N/A'}</Text>
                                        </View>
                                        {items.filter((i: any) => i.picked_qty === 0).length > 0 && (
                                            <Text style={styles.summarySkippedText}>
                                                {items.filter((i: any) => i.picked_qty === 0).length} items skipped
                                            </Text>
                                        )}
                                    </View>

                                    <View style={styles.summaryItemsList}>
                                        {items.map((item: any, i: number) => (
                                            <View key={i} style={[styles.summaryItemCard, item.picked_qty === 0 && styles.summaryItemCardSkipped]}>
                                                <View style={styles.summaryItemIcon}>
                                                    {item.picked_qty > 0 ? (
                                                        <View style={styles.itemCheckCircle}>
                                                            <Check size={14} color="#10b981" />
                                                        </View>
                                                    ) : (
                                                        <SkipForward size={18} color="#f97316" />
                                                    )}
                                                </View>
                                                <View style={styles.summaryItemInfo}>
                                                    <Text style={styles.summaryItemCode}>{item.item_code}</Text>
                                                    <Text style={styles.summaryItemName} numberOfLines={1}>{item.item_name}</Text>
                                                </View>
                                                <View style={styles.summaryItemStatus}>
                                                    {item.picked_qty > 0 ? (
                                                        <>
                                                            <Text style={styles.summaryItemQty}>{item.picked_qty} {(item.uom || '').toUpperCase()}</Text>
                                                            <Text style={styles.summaryItemWarehouse} numberOfLines={2}>{item.warehouse}</Text>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Text style={styles.summaryItemSkippedTag}>{t('skipped', 'Skipped')}</Text>
                                                            <Text style={styles.summaryItemWarehouse} numberOfLines={2}>{item.location || item.warehouse}</Text>
                                                        </>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                    </ScrollView>
                    </KeyboardAvoidingView>

                    {/* Bottom Actions */}
                    {showFooter && (
                        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.actionFooterWrapper}>
                            {step === 1 && (
                                <View style={styles.secondaryProgressRow}>
                                    {(items.length > 0 ? items : [1, 2, 3]).map((_item: any, idx: number) => (
                                        <View
                                            key={idx}
                                            style={[
                                                styles.secondaryBar,
                                                idx <= currentItemIndex && styles.secondaryBarActive
                                            ]}
                                        />
                                    ))}
                                </View>
                            )}

                            <View style={styles.actionFooter}>
                                {step === 3 ? (
                                    <>
                                        <TouchableOpacity style={[styles.backBtnOutline, { flex: 1 }]} onPress={() => setStep(1)}>
                                            <Text style={styles.backBtnText}>{t('back', 'Back')}</Text>
                                        </TouchableOpacity>

                                        {picklist?.status !== 'Completed' && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.createDeliveryBtn,
                                                    { flex: 2 },
                                                    loading && { opacity: 0.7 }
                                                ]}
                                                onPress={handleCreateDownstream}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <DotsLoader size={8} color="#fff" />
                                                ) : (
                                                    <CheckCircle2 size={20} color="#fff" />
                                                )}
                                                <Text style={[styles.createDeliveryBtnText, { flexShrink: 1 }]} numberOfLines={2}>
                                                    {loading 
                                                        ? (loadingMessage || t('submitting', 'Submitting...'))
                                                        : picklist?.purpose === 'Delivery'
                                                            ? t('submit_and_create_dn', 'Submit & Create DN')
                                                            : t('submit_transfer_picklist', 'Submit Picklist')}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                ) : step === 1 ? (
                                    <>
                                        <TouchableOpacity style={styles.backBtnOutline} onPress={() => {
                                            if (pickingPhase === 'confirm') {
                                                setPickingPhase('tracking');
                                                setVerificationStatus('pending');
                                                setScanText('');
                                            } else if (pickingPhase === 'tracking') {
                                                if (pickedTracking.length > 0) {
                                                    setPickedTracking(prev => prev.slice(0, -1));
                                                } else {
                                                    setPickingPhase('warehouse');
                                                }
                                                setVerificationStatus('pending');
                                                setScanText('');
                                            } else if (pickingPhase === 'warehouse') {
                                                setPickingPhase('item');
                                                setVerificationStatus('pending');
                                                setScanText('');
                                            } else if (currentItemIndex > 0) {
                                                setCurrentItemIndex(prev => prev - 1);
                                                // Move back to either tracking or warehouse phase of previous item
                                                const prevItem = items[currentItemIndex - 1];
                                                if (prevItem?.has_serial_no || prevItem?.has_batch_no) {
                                                    setPickingPhase('tracking');
                                                } else {
                                                    setPickingPhase('warehouse');
                                                }
                                                setVerificationStatus('pending');
                                                setScanText('');
                                            } else {
                                                router.back();
                                            }
                                        }}>
                                            <Text style={styles.backBtnText}>{t('back', 'Back')}</Text>
                                        </TouchableOpacity>

                                        {pickingPhase !== 'confirm' && pickingPhase !== 'confirm_batch_qty' && (
                                            <TouchableOpacity style={styles.skipBtn} onPress={() => {
                                                // Mark as skipped in local picklist state
                                                const updatedLocations = [...(picklist?.locations || [])];
                                                if (updatedLocations[currentItemIndex]) {
                                                    updatedLocations[currentItemIndex] = {
                                                        ...updatedLocations[currentItemIndex],
                                                        is_skipped: true,
                                                        is_picked: false,
                                                        picked_qty: 0
                                                    };
                                                    setPicklist({ ...picklist, locations: updatedLocations });
                                                }

                                                if (currentItemIndex < items.length - 1) {
                                                    setCurrentItemIndex(prev => prev + 1);
                                                    setPickingPhase('item');
                                                    setPickedTracking([]);
                                                    setVerificationStatus('pending');
                                                    setScanText('');
                                                    setConfirmedQty('');
                                                    setPendingDimensions([]);
                                                    setCurrentDimIndex(0);
                                                    setDimensionValues({});
                                                    setDimensionSearch({});
                                                    setShowDimDropdown(null);
                                                } else {
                                                    setStep(3);
                                                }

                                            }}>
                                                <SkipForward size={18} color="#7634bc" />
                                                <Text style={styles.skipBtnText}>{t('skip_item', 'Skip Item')}</Text>
                                            </TouchableOpacity>
                                        )}

                                        {pickingPhase === 'confirm' && (
                                            <TouchableOpacity style={[styles.confirmPickBtn, { flex: 2 }]} onPress={handleConfirmPick}>
                                                <CheckCircle2 size={20} color="#fff" style={{ marginRight: 8 }} />
                                                <Text style={styles.confirmPickBtnText}>{t('confirm_pick', 'Confirm Pick')}</Text>
                                            </TouchableOpacity>
                                        )}
                                        {pickingPhase === 'confirm_batch_qty' && (
                                            <TouchableOpacity style={[styles.confirmPickBtn, { flex: 2 }]} onPress={handleConfirmBatchQty}>
                                                <CheckCircle2 size={20} color="#fff" style={{ marginRight: 8 }} />
                                                <Text style={styles.confirmPickBtnText}>Confirm Batch Qty</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                ) : null}
                            </View>
                        </Animated.View>
                    )}

                    {/* Floating Navigation Pill */}
                    {/* {!showFooter && (
                        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.floatingContainer, { bottom: Math.max(insets.bottom + 16, 0) }]}>
                            <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
                                <ArrowLeft size={20} color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.dividerPill} />
                            <View style={styles.infoPill}>
                                <ClipboardList size={20} color="rgba(255,255,255,0.5)" />
                                <Text style={[styles.pillText, { color: 'rgba(255,255,255,0.5)' }]}>{t('picklist', 'PICKLIST')}</Text>
                            </View>
                            <View style={styles.dividerPill} />
                            <View style={styles.activePillItem}>
                                <FileCheck size={20} color="#fff" />
                                <Text style={styles.pillText}>{t('pick', 'PICK')}</Text>
                            </View>
                        </Animated.View>
                    )} */}
                </>
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
                    if (!alertData.isError && (alertData.title === 'Success' || alertData.title === 'Notice')) {
                        router.replace('/inventory/picklist');
                    }
                }}
            />

            <Modal
                visible={showWarehouseModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowWarehouseModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.warehouseModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_target_warehouse', 'Select Target Warehouse')}</Text>
                            <TouchableOpacity onPress={() => setShowWarehouseModal(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#0f172a" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchBarWrapper}>
                            <Search size={18} color="#94a3b8" style={styles.searchBarIcon} />
                            <TextInput
                                placeholder={t('search_warehouse', 'Search warehouse...')}
                                style={styles.searchBarInput}
                                value={warehouseSearch}
                                onChangeText={setWarehouseSearch}
                            />
                        </View>

                        <ScrollView style={styles.warehouseList} keyboardShouldPersistTaps="handled">
                            {warehouses
                                .filter(w =>
                                    w.name.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
                                    (w.warehouse_name && w.warehouse_name.toLowerCase().includes(warehouseSearch.toLowerCase()))
                                )
                                .map((w, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.warehouseItem}
                                        onPress={() => {
                                            handleCreateDownstream(w.name);
                                        }}
                                    >
                                        <MapPin size={18} color="#7634bc" style={{ marginRight: 12 }} />
                                        <View>
                                            <Text style={styles.warehouseItemName}>{w.warehouse_name || w.name}</Text>
                                            {w.warehouse_name && <Text style={styles.warehouseItemCode}>{w.name}</Text>}
                                        </View>
                                    </TouchableOpacity>
                                ))
                            }
                            {warehouses.length === 0 && (
                                <Text style={styles.noWarehouseText}>{t('no_warehouses_found', 'No warehouses found')}</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showSourceWarehouseModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSourceWarehouseModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.warehouseModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Available Warehouses</Text>
                            <TouchableOpacity onPress={() => setShowSourceWarehouseModal(false)} style={styles.modalCloseBtn}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            {loadingSourceWarehouses ? (
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <DotsLoader size={16} color="#7634bc" />
                                    <Text style={{ marginTop: 12, color: '#64748b' }}>Checking stock...</Text>
                                </View>
                            ) : availableSourceWarehouses.length === 0 ? (
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <Text style={{ color: '#64748b' }}>No warehouses have available stock for this item.</Text>
                                </View>
                            ) : (
                                <ScrollView style={{ maxHeight: 300 }}>
                                    {availableSourceWarehouses.map((wh, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[styles.warehouseListItem, activeItem?.warehouse === wh.warehouse && { borderColor: '#7634bc', backgroundColor: '#f5f3ff' }]}
                                            onPress={() => selectSourceWarehouse(wh.warehouse)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.warehouseListName, activeItem?.warehouse === wh.warehouse && { color: '#7634bc', fontWeight: 'bold' }]}>
                                                    {wh.warehouse}
                                                </Text>
                                                <Text style={styles.warehouseListId}>
                                                    Available Qty: {wh.actual_qty}
                                                </Text>
                                            </View>
                                            {activeItem?.warehouse === wh.warehouse && (
                                                <Check size={18} color="#7634bc" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName="Pick Lists"
                onClose={() => {
                    setDeniedModalVisible(false);
                    if (!hasPermission('can_pick')) {
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 160,
    },
    stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepWrapper: { alignItems: 'center', zIndex: 2 },
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
    poInfoCard: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 20,
        shadowColor: '#2e1065',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    poInfoHeaderRow1: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    idBadgeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        marginRight: 12,
    },
    poIdText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
        fontFamily: Fonts.rounded,
        letterSpacing: 0.3,
        flexShrink: 1,
    },
    headerTopRight: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
    },
    draftBadgeHeader: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    draftBadgeTextHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
        fontFamily: Fonts.sans,
        letterSpacing: 0.5,
    },
    poInfoHeaderRow2: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingLeft: 20, // indent past icon
    },
    itemsCountHeader: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.85)',
        fontWeight: '500',
    },
    poInfoDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginBottom: 12,
        marginHorizontal: -4,
    },
    poInfoMetaSection: {
        gap: 12,
    },
    poInfoMetaBlock: {
        flexDirection: 'column',
    },
    metaLabelText: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500',
        marginBottom: 2,
    },
    metaValueText: {
        fontSize: 13,
        color: '#ffffff',
        fontWeight: '600',
        fontFamily: Fonts.sans,
    },
    itemsSection: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 12,
    },
    emptyCardWrapper: {
        borderRadius: 24,
        marginTop: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
    },
    emptyCardContent: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#475569',
        marginBottom: 8,
    },
    emptyCardDesc: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
    },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.4)',
        marginBottom: 16,
        shadowColor: '#2d4171',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 8,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    itemIdentity: {
        flexDirection: 'row',
        gap: 12,
        flex: 1,
    },
    indexBadge: {
        width: 38,
        height: 38,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    indexText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#94a3b8',
    },
    itemTextContainer: {
        flex: 1,
    },
    itemCode: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    itemName: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
        lineHeight: 18,
    },
    qtyContainer: {
        alignItems: 'flex-end',
        marginLeft: 12,
    },
    qtyText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
    },
    trackingText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#f97316',
        marginTop: 4,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    locationInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 6,
    },
    locationText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    locationSeparator: {
        fontSize: 12,
        color: '#cbd5e1',
    },
    warehouseText: {
        flex: 1,
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
        marginLeft: 6,
    },
    actionFooterWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    actionFooter: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 44 : 32,
        gap: 12,
    },
    actionFooterColumn: {
        flexDirection: 'column',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 44 : 32,
        gap: 12,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    startBtn: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#7634bc',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    startBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
        fontFamily: Fonts.sans,
    },
    pickingWorkflow: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    stepTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    stepTitleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepTitleText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
    },
    stepProgressCounter: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94a3b8',
    },
    progressBarsContainer: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 24,
    },
    progressBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#f1f5f9',
    },
    progressBarActive: {
        backgroundColor: '#7634bc',
    },
    progressBarCompleted: {
        backgroundColor: '#7634bc',
    },
    activePickCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#475569',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    activeCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    activeItemMain: {
        flex: 1,
        paddingRight: 16,
    },
    activeItemCode: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
        letterSpacing: -0.5,
    },
    activeItemName: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 6,
        fontWeight: '500',
        lineHeight: 18,
    },
    activeQtyBox: {
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    qtyLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    activeQtyText: {
        fontSize: 24,
        fontWeight: '900',
        color: '#7634bc',
        lineHeight: 28,
    },
    activeQtyUom: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '700',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    nestedLocationBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff7ed',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ffedd5',
    },
    locationIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#ffedd5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nestedLocationTextWrapper: {
        flex: 1,
    },
    nestedLocationText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    nestedWarehouseText: {
        fontSize: 14,
        color: '#c2410c',
        fontWeight: '600',
        marginTop: 2,
    },
    verifySection: {
        marginBottom: 8,
    },
    verifyLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 12,
    },
    scanInputWrapper: {
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
    searchIcon: {
        marginRight: 0,
    },
    scanTextInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#0f172a',
        fontWeight: '500',
        paddingVertical: 0,
    },
    miniScanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    miniScanText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    backBtnOutline: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    backBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    skipBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 52,
        borderRadius: 16,
        backgroundColor: '#f3e8ff',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    skipBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#7634bc',
        fontFamily: Fonts.sans,
    },
    secondaryProgressRow: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 16,
        marginBottom: -10,
        backgroundColor: '#fff',
        zIndex: 10,
    },
    secondaryBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#f1f5f9',
    },
    secondaryBarActive: {
        backgroundColor: '#f97316', // Orange
    },
    floatingContainer: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: '#2e1065',
        borderRadius: 28,
        height: 56,
        padding: 6,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 12,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerHeader: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    closeScanner: {
        width: 40,
        height: 40,
        borderRadius: 20,
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
        width: 280,
        height: 280,
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
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    scanInstructions: {
        position: 'absolute',
        bottom: 100,
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 40,
        fontWeight: '500',
    },
    phaseSuccessBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 12,
        gap: 8,
    },
    phaseSuccessText: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '700',
        marginLeft: 8,
    },
    trackingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trackingChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    trackingChip: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    trackingChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    proceedBtn: {
        backgroundColor: '#fff',
        height: 56,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    proceedBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
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
        gap: 12,
        paddingHorizontal: 16,
    },
    activePillItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingRight: 24,
        paddingLeft: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        height: 44,
        borderRadius: 22,
    },
    pillText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    confirmQtyWrapper: {
        marginTop: 12,
        marginBottom: 12,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#fbbf24',
        borderRadius: 16,
        backgroundColor: '#fffbeb',
    },
    confirmQtyInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        width: '100%',
        height: '100%',
        paddingVertical: 0,
    },
    partialPickText: {
        fontSize: 13,
        color: '#f97316',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
    },
    confirmDividerContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        justifyContent: 'center',
    },
    confirmDivider: {
        width: 12,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#e2e8f0',
    },
    confirmDividerActive: {
        backgroundColor: '#f97316',
    },
    summarySection: {
        paddingTop: 10,
    },
    pickingCompleteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    successIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickingCompleteText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 24,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        color: '#94a3b8',
    },
    summaryPlId: {
        fontSize: 18,
        fontWeight: '900',
        color: '#f97316',
        fontFamily: Fonts.rounded,
        flex: 1,
    },
    summaryStatText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    summaryValueText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    summarySkippedText: {
        fontSize: 14,
        color: '#f97316',
        fontWeight: '600',
        marginTop: 12,
    },
    summaryItemsList: {
        gap: 12,
    },
    summaryItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    summaryItemCardSkipped: {
        opacity: 0.6,
    },
    summaryItemIcon: {
        width: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemCheckCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryItemInfo: {
        flex: 1,
        marginLeft: 4,
    },
    summaryItemCode: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    summaryItemName: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    summaryItemStatus: {
        alignItems: 'flex-end',
        width: 120,
    },
    summaryItemQty: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'right',
    },
    summaryItemWarehouse: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
        textAlign: 'right',
        maxWidth: 110,
    },
    summaryItemSkippedTag: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#94a3b8',
    },
    confirmPickBtn: {
        flex: 1.5,
        flexDirection: 'row',
        height: 52,
        borderRadius: 16,
        backgroundColor: '#7634bc',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4c1d95',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    confirmPickBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
        fontFamily: Fonts.sans,
        letterSpacing: 0.5,
    },
    completeOnlyBtn: {
        flex: 1.2,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: '#d8b4fe',
        backgroundColor: '#f3e8ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    completeOnlyBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#7634bc',
        fontFamily: Fonts.sans,
    },
    createDeliveryBtn: {
        height: 52,
        borderRadius: 16,
        backgroundColor: '#10b981',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#047857',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
        paddingHorizontal: 8,
    },
    createDeliveryBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
        fontFamily: Fonts.sans,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    warehouseModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
        minHeight: '40%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.rounded,
    },
    modalCloseBtn: {
        padding: 4,
    },
    searchBarWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 16,
    },
    searchBarIcon: {
        marginRight: 8,
    },
    searchBarInput: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        fontFamily: Fonts.sans,
        padding: 0,
    },
    warehouseList: {
        marginBottom: 20,
    },
    modalBody: {
        paddingVertical: 16,
    },
    warehouseListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    warehouseListName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 4,
    },
    warehouseListId: {
        fontSize: 13,
        color: '#64748b',
    },
    warehouseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    warehouseItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    warehouseItemCode: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Fonts.sans,
        marginTop: 2,
    },
    noWarehouseText: {
        textAlign: 'center',
        color: '#64748b',
        marginTop: 40,
        fontFamily: Fonts.sans,
    },
    dimDropdownBox: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 6,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
        maxHeight: 200,
    },
    dimDropdownItem: {
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dimDropdownText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
});