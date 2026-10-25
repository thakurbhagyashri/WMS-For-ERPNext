import { TopNavbar } from '@/components/TopNavbar';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useCompanyContext } from '@/context/CompanyContext';
import { useFrappe } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRightLeft,
    Check,
    FileText,
    MapPin,
    RotateCcw,
    Search,
    Settings,
    Trash2,
    Truck,
    User,
    X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function NewPicklistScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { getResource, callMethod, postResource, company } = useFrappe(APP_CONFIG);
    const { activeCompany } = useCompanyContext();
    const { showToast, showError } = useToast();

    const [createStep, setCreateStep] = useState(1);
    const [purpose, setPurpose] = useState<'Delivery' | 'Material Transfer' | 'Material Transfer for Manufacture'>('Delivery');
    const [selectedSources, setSelectedSources] = useState<any[]>([]);
    const [fetchedItems, setFetchedItems] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [sourceSearch, setSourceSearch] = useState('');
    const [sourceResults, setSourceResults] = useState<any[]>([]);
    const [isFetchingSources, setIsFetchingSources] = useState(false);
    const [sourceCompany, setSourceCompany] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdDocName, setCreatedDocName] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [isFetchingMore, setIsFetchingMore] = useState<boolean>();

    // Edit item state
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [editingItemQty, setEditingItemQty] = useState('');
    const [editingItemWarehouse, setEditingItemWarehouse] = useState('');
    const [editingItemActualQty, setEditingItemActualQty] = useState(0);

    const [warehouseList, setWarehouseList] = useState<any[]>([]);
    const [isFetchingWarehouses, setIsFetchingWarehouses] = useState(false);

    // Batch/Serial state for Edit Modal
    const [availableBatches, setAvailableBatches] = useState<any[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<{ batch_no: string, qty: number }[]>([]);
    const [availableSerials, setAvailableSerials] = useState<any[]>([]);
    const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
    const [isFetchingTracking, setIsFetchingTracking] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (createStep === 2 && sourceSearch.length >= 2) {
                fetchSources(sourceSearch, 1);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [sourceSearch, createStep]);

    useEffect(() => {
        if (createStep === 2) {
            if (purpose === "Delivery" && !selectedCustomer) {
                fetchSources('', 1);
            } else if (purpose !== "Delivery") {
                fetchSources('', 1);
            }
        }
    }, [createStep, purpose]);

    useEffect(() => {
        if (createStep === 2 && purpose === 'Delivery' && selectedCustomer && !sourceSearch) {
            fetchSources('', 1);
        }
    }, [selectedCustomer, createStep]);

    async function fetchSources(q: string, page = 1) {
        //handeling pegination functionallity
        if (page == 1) {
            setIsFetchingSources(true);

        }
        else {
            setIsFetchingMore(true)
        }

        try {
            let doctype = 'Sales Order';
            const filters: any[] = [];

            if (purpose === 'Delivery') {
                if (!selectedCustomer) {
                    doctype = 'Customer';
                } else {
                    doctype = 'Sales Order';
                    filters.push(['docstatus', '=', 1], ['customer', '=', selectedCustomer.name], ['per_delivered', '<', 100], ['per_picked', '<', 100], ['status', 'in', ['To Deliver', 'To Deliver and Bill']]);
                    if (activeCompany || company) filters.push(['company', '=', activeCompany || company]);
                }
            } else if (purpose === 'Material Transfer') {
                doctype = 'Material Request';
                filters.push(['docstatus', '=', 1], ['per_ordered', '<', 100]);
                if (activeCompany || company) filters.push(['company', '=', activeCompany || company]);
            } else if (purpose === 'Material Transfer for Manufacture') {
                doctype = 'Work Order';
                filters.push(['docstatus', '=', 1], ['status', 'not in', ['Completed', 'Stopped', 'Closed']]);
                if (activeCompany || company) filters.push(['company', '=', activeCompany || company]);
            }

            if (q) filters.push(['name', 'like', `%${q}%`]);

            let fields = '["name"]';
            if (doctype === 'Customer') {
                fields = '["name", "customer_name"]';
            } else if (doctype === 'Sales Order') {
                fields = '["name", "customer", "transaction_date", "customer_name"]';
            } else if (doctype === 'Material Request') {
                fields = '["name", "transaction_date", "status", "set_warehouse", "set_from_warehouse"]';
            } else if (doctype === 'Work Order') {
                fields = '["name", "production_item", "status", "wip_warehouse","qty","bom_no","fg_warehouse","required_items","additional_transferred_qty"]';
            }
            const limit = 20
            const data = await getResource(doctype, undefined, {
                filters: JSON.stringify(filters),
                fields: fields,
                limit_page_length: limit,
                limit_start: (page - 1) * limit,
                order_by: 'creation desc'
            });

            if (purpose === 'Delivery' && selectedCustomer && (!data || data.length === 0)) {
                showToast(`No pending Sales Orders found for ${selectedCustomer.customer_name || selectedCustomer.name}`, 'error');
            }

            // setSourceResults(data || []);
            const newData = data || [];
            if (page == 1) { setSourceResults(newData) }
            else { setSourceResults(prev => [...prev, ...newData]) }
            setHasMore(newData.length === limit);
            setCurrentPage(page);
        } catch (e: any) {
            console.error('Fetch sources error', e);
            showError(e.message || 'Failed to search documents');
        } finally {
            setIsFetchingSources(false);
            setIsFetchingMore(false)
        }
    };

    const fetchItemsFromSources = async () => {
        if (selectedSources.length === 0) return;
        setIsFetchingSources(true);
        try {
            const itemResults: any[] = [];
            const doctype = purpose === 'Delivery' ? 'Sales Order' : (purpose === 'Material Transfer' ? 'Material Request' : 'Work Order');

            for (const source of selectedSources) {
                const doc = await getResource(doctype, source.name);
                if (doc) {
                    if (doc.company) setSourceCompany(doc.company);
                    if (doc.items || doc.required_items) {
                        const items = doc.items || doc.required_items;
                        items.forEach((item: any) => {
                            let totalQty = item.qty || 0;
                            let fulfilledQty = 0;

                            if (purpose === 'Delivery') {
                                totalQty = item.qty || 0;
                                fulfilledQty = Math.max(item.delivered_qty || 0, item.picked_qty || 0);
                            } else if (purpose === 'Material Transfer for Manufacture') {
                                totalQty = item.required_qty || 0;
                                fulfilledQty = (item.transferred_qty || 0) - (item.returned_qty || 0);
                                console.log(`[MTFM] Required Items processing: ${item.item_code} | Req: ${totalQty} | Transferred: ${item.transferred_qty} | Returned: ${item.returned_qty}`);
                            } else if (purpose === 'Material Transfer') {
                                totalQty = item.qty || 0;
                                fulfilledQty = item.ordered_qty || 0;
                            }

                            const pendingQty = totalQty - fulfilledQty;
                            if (purpose === 'Material Transfer for Manufacture') {
                                console.log(`[MTFM] Remaining Qty for ${item.item_code}: ${pendingQty}`);
                            }

                            if (pendingQty > 0) {
                                // Spread the full item row first so any custom/dimension fields
                                // (e.g. `segment`) are carried forward, then override with known fields.
                                itemResults.push({
                                    ...item,
                                    item_code: item.item_code,
                                    warehouse: (purpose === 'Material Transfer' ? (item.from_warehouse || doc.set_from_warehouse) : item.warehouse) || item.source_warehouse || item.target_warehouse || item.warehouse,
                                    qty: pendingQty,
                                    uom: item.uom,
                                    [purpose === 'Delivery' ? 'sales_order' : (purpose === 'Material Transfer' ? 'material_request' : 'work_order')]: source.name,
                                    [purpose === 'Delivery' ? 'sales_order_item' : (purpose === 'Material Transfer' ? 'material_request_item' : 'work_order_item')]: item.name,
                                    customer: doc.customer || doc.customer_name,
                                    item_name: item.item_name,
                                    description: item.description,
                                    ordered_qty: totalQty,
                                    delivered_qty_display: fulfilledQty,
                                });
                            }
                        });
                    }
                }
            }

            if (itemResults.length > 0) {
                // Fetch real-time actual_qty and item tracking info for all items concurrently
                const itemsWithLiveStock = await Promise.all(itemResults.map(async (item, idx) => {
                    try {
                        const binDataPromise = getResource('Bin', undefined, {
                            filters: JSON.stringify([
                                ['item_code', '=', item.item_code],
                                ['warehouse', '=', item.warehouse]
                            ]),
                            fields: '["actual_qty"]',
                            limit_page_length: 1
                        });

                        const itemDataPromise = getResource('Item', item.item_code);

                        const [binData, itemData] = await Promise.all([binDataPromise, itemDataPromise]);

                        return {
                            ...item,
                            actual_qty: (binData && binData.length > 0) ? binData[0].actual_qty : 0,
                            has_batch_no: itemData?.has_batch_no || 0,
                            has_serial_no: itemData?.has_serial_no || 0,
                            picked_qty: 0,
                            deleted: false,
                            key: idx
                        };
                    } catch (e) {
                        return {
                            ...item,
                            actual_qty: 0,
                            has_batch_no: 0,
                            has_serial_no: 0,
                            picked_qty: 0,
                            deleted: false,
                            key: idx
                        };
                    }
                }));

                setFetchedItems(itemsWithLiveStock);

                // Call createPicklist here as a draft
                await createPicklist(false, itemsWithLiveStock, true);
            } else {
                showError('No pending items found in the selected documents.');
            }
        } catch (e: any) {
            console.error('Fetch items error', e);
            showError(e.message || 'Failed to fetch items from sources');
        } finally {
            setIsFetchingSources(false);
        }
    };

    const createPicklist = async (submit = false, itemsToProcess = fetchedItems, isDraftOnFetch = false) => {
        setIsFetchingSources(true);
        try {
            // Fields that must NOT be blindly forwarded from the source document row
            const EXCLUDED_SOURCE_FIELDS = new Set([
                'name', 'doctype', 'parent', 'parentfield', 'parenttype', 'idx',
                'creation', 'modified', 'modified_by', 'owner', 'docstatus',
                'delivered_qty', 'ordered_qty', 'transferred_qty',
                'amount', 'net_amount', 'base_amount', 'base_net_amount',
                'rate', 'net_rate', 'base_rate', 'base_net_rate',
                'picked_qty', 'returned_qty', 'billed_qty'
            ]);

            const items = itemsToProcess.filter((i: any) => !i.deleted).flatMap((i: any) => {

                // Base item template
                const baseItemRow: any = {
                    item_code: i.item_code,
                    item: i.item_code,
                    item_name: i.item_name,
                    description: i.description || i.item_name,
                    warehouse: i.warehouse,
                    picked_qty: 0,
                    uom: i.uom,
                    stock_uom: i.uom,
                    conversion_factor: 1,
                    customer: i.customer || selectedCustomer?.name,
                    use_serial_batch_fields: 1
                };

                for (const key of Object.keys(i)) {
                    if (!EXCLUDED_SOURCE_FIELDS.has(key) && !(key in baseItemRow) && i[key] != null && i[key] !== '') {
                        baseItemRow[key] = i[key];
                    }
                }

                if (i.sales_order) {
                    baseItemRow.sales_order = i.sales_order;
                    baseItemRow.sales_order_item = i.sales_order_item;
                    baseItemRow.so_detail = i.sales_order_item;
                }
                if (i.material_request) {
                    baseItemRow.material_request = i.material_request;
                    baseItemRow.material_request_item = i.material_request_item;
                }
                // Note: work_order and work_order_item do not exist on the Pick List Item row level.
                // We only link Work Order at the header level (doc.work_order).

                const rows: any[] = [];

                if (i.has_serial_no && i.serials && i.serials.length > 0) {
                    // One row with all serials
                    const row = { ...baseItemRow };
                    row.qty = i.serials.length;
                    row.stock_qty = i.serials.length;
                    row.serial_no = i.serials.join('\n');
                    rows.push(row);
                } else if (i.has_batch_no && i.batches && i.batches.length > 0) {
                    // One row per batch
                    for (const b of i.batches) {
                        const row = { ...baseItemRow };
                        row.qty = b.qty;
                        row.stock_qty = b.qty;
                        row.batch_no = b.batch_no;
                        rows.push(row);
                    }
                } else {
                    // Normal item
                    const row = { ...baseItemRow };
                    row.qty = parseFloat(i.qty || '0');
                    row.stock_qty = parseFloat(i.qty || '0');
                    rows.push(row);
                }
                return rows;
            });

            if (items.length === 0) {
                showError('Review Items List is Empty. Cannot create Picklist.');
                setIsFetchingSources(false);
                return;
            }

            const doc: any = {
                doctype: 'Pick List',
                purpose: purpose,
                company: sourceCompany || activeCompany || company,
                customer: selectedCustomer?.name || (purpose === 'Delivery' && selectedSources.length > 0 ? selectedSources[0].customer : null),
                locations: items,
                docstatus: submit ? 1 : 0,
                item_locations_set: 1
            };
            console.log("documnets :", doc);

            // Set target warehouse automatically
            if (purpose === 'Material Transfer' && selectedSources.length > 0 && selectedSources[0].set_warehouse) {
                doc.for_warehouse = selectedSources[0].set_warehouse;
            } else if (purpose === 'Material Transfer for Manufacture' && selectedSources.length > 0 && selectedSources[0].wip_warehouse) {
                doc.for_warehouse = selectedSources[0].wip_warehouse;
            }

            // Link source docs to header if applicable
            if (selectedSources.length === 1) {
                const srcDoc = selectedSources[0];
                if (purpose === 'Delivery') doc.parent_sales_order = srcDoc.name;
                else if (purpose === 'Material Transfer') doc.material_request = srcDoc.name;
                else if (purpose === 'Material Transfer for Manufacture') {
                    console.log(`[MTFM] Work Order selected: ${srcDoc.name}`);
                    console.log(`[MTFM] Work Order Qty: ${srcDoc.qty}`);
                    
                    const forQty = Number(srcDoc.qty);
                    if (!forQty || forQty <= 0) {
                        showError("Qty to Manufacture must be greater than 0");
                        setIsFetchingSources(false);
                        return;
                    }
                    
                    doc.work_order = srcDoc.name;
                    doc.for_qty = forQty;
                    console.log(`[MTFM] for_qty: ${doc.for_qty}`);
                    
                    // Check if any source warehouse matches WIP warehouse
                    const hasSameWarehouse = items.some((i: any) => i.warehouse === srcDoc.wip_warehouse);
                    if (hasSameWarehouse) {
                        showToast('Warning: Source warehouse and WIP warehouse are the same. Please verify the Work Order warehouse configuration.', 'error');
                    }
                }
            }


            // Sanitize doc to ensure no incompatible fields like 'location' are passed
            if (doc.locations && Array.isArray(doc.locations)) {
                doc.locations = doc.locations.map((loc: any) => {
                    const { location, locations, ...validFields } = loc;
                    return validFields;
                });
            }
            if (doc.items && Array.isArray(doc.items)) {
                doc.items = doc.items.map((item: any) => {
                    const { location, locations, ...validFields } = item;
                    return validFields;
                });
            }
            // Use callMethod insert for more robust handling of child tables
            const res: any = await callMethod('frappe.client.insert', { doc });

            if (res && res.name) {
                setCreatedDocName(res.name);
                if (isDraftOnFetch) {
                    setCreateStep(3);
                } else {
                    // Instantly navigate to the Start Picking screen
                    router.replace(`/inventory/pick/${res.name}`);
                }
            }
        } catch (e: any) {
            console.error('Create picklist error', e);
            let errorMsg = e.message || 'Failed to create picklist';

            // Clean up standard Frappe wrapper text
            errorMsg = errorMsg.replace(/\[Error: (.*?)\]/g, '$1').replace(/^Error: /g, '').trim();

            // Provide simple, user-friendly translations for common backend errors
            if (errorMsg.includes('Total Picked Quantity') && errorMsg.includes('more than ordered qty')) {
                errorMsg = 'These items are already assigned to another active Picklist. Please complete or cancel the existing Picklist first.';
            } else if (errorMsg.includes('Row') && errorMsg.includes('not found')) {
                errorMsg = 'One or more selected items are no longer available in the source document.';
            }

            showError(errorMsg);
        } finally {
            setIsFetchingSources(false);
        }
    };
    // const toggleEditItem = (idx: number) => {
    //     setEditingItemIndex(idx);
    //     const item = fetchedItems[idx];
    //     setEditingItemQty(item.qty.toString());
    //     setEditingItemWarehouse(item.warehouse);
    //     setEditingItemActualQty(item.actual_qty || 0);
    //     setSelectedBatches(item.batches || []);
    //     setSelectedSerials(item.serials || []);
    //     setAvailableBatches([]);
    //     setAvailableSerials([]);
    //     fetchItemWarehouses(item.item_code);

    //     if (item.warehouse && (item.has_batch_no || item.has_serial_no)) {
    //         fetchTrackingData(item.item_code, item.warehouse, item.has_batch_no, item.has_serial_no);
    //     }
    // };

    const fetchTrackingData = async (itemCode: string, warehouse: string, hasBatch: number, hasSerial: number) => {
        setIsFetchingTracking(true);
        setAvailableBatches([]);
        setAvailableSerials([]);
        try {
            if (hasSerial) {
                const serials = await getResource('Serial No', undefined, {
                    filters: JSON.stringify([['item_code', '=', itemCode], ['status', '=', 'Active'], ['warehouse', '=', warehouse]]),
                    fields: '["name"]',
                    limit_page_length: 500
                });
                setAvailableSerials(serials || []);
            } else if (hasBatch) {
                const batchesData = await getResource('Batch', undefined, {
                    filters: JSON.stringify([['item', '=', itemCode]]),
                    fields: '["name", "expiry_date"]',
                    limit_page_length: 100
                });

                if (batchesData && batchesData.length > 0) {
                    const batchStockPromises = batchesData.map(async (b: any) => {
                        const binData = await getResource('Bin', undefined, {
                            filters: JSON.stringify([['item_code', '=', itemCode], ['warehouse', '=', warehouse], ['batch_no', '=', b.name]]),
                            fields: '["actual_qty"]',
                            limit_page_length: 1
                        });
                        return {
                            ...b,
                            actual_qty: (binData && binData.length > 0) ? binData[0].actual_qty : 0
                        };
                    });
                    const batchesWithStock = await Promise.all(batchStockPromises);
                    setAvailableBatches(batchesWithStock.filter(b => b.actual_qty > 0));
                }
            }
        } catch (err) {
            console.warn('Fetch tracking error:', err);
        } finally {
            setIsFetchingTracking(false);
        }
    };

    const saveEditItem = () => {
        if (editingItemIndex === null) return;
        const item = fetchedItems[editingItemIndex];
        const newQty = parseFloat(editingItemQty);

        if (isNaN(newQty) || newQty <= 0) {
            showError('Please enter a valid quantity greater than 0');
            return;
        }

        if (newQty > editingItemActualQty) {
            showError(`Cannot allocate ${newQty}. Only ${editingItemActualQty} available in ${editingItemWarehouse}.`);
            return;
        }

        // Validate Serials
        if (item.has_serial_no) {
            if (selectedSerials.length !== newQty) {
                showError(`Please select exactly ${newQty} serial numbers.`);
                return;
            }
        }

        // Validate Batches
        if (item.has_batch_no && !item.has_serial_no) {
            const totalBatchQty = selectedBatches.reduce((acc, curr) => acc + (parseFloat(curr.qty as any) || 0), 0);
            if (totalBatchQty !== newQty) {
                showError(`Total batch quantity (${totalBatchQty}) must equal Pick Quantity (${newQty}).`);
                return;
            }
            // Check if any batch exceeds available stock
            for (const b of selectedBatches) {
                const available = availableBatches.find(ab => ab.name === b.batch_no)?.actual_qty || 0;
                if (b.qty > available) {
                    showError(`Quantity for Batch ${b.batch_no} exceeds available stock (${available}).`);
                    return;
                }
            }
        }

        setFetchedItems(prev => prev.map((it, i) =>
            i === editingItemIndex ? {
                ...it,
                qty: newQty,
                warehouse: editingItemWarehouse,
                actual_qty: editingItemActualQty,
                batches: selectedBatches,
                serials: selectedSerials
            } : it
        ));
        setEditingItemIndex(null);
    };

    const handleEditBatchChange = (index: number, field: string, value: any) => {
        const newBatches = [...selectedBatches];
        (newBatches[index] as any)[field] = field === 'qty' ? parseFloat(value || '0') : value;
        setSelectedBatches(newBatches);
    };

    const handleAddEditBatch = () => {
        setSelectedBatches([...selectedBatches, { batch_no: '', qty: 0 }]);
    };

    const handleRemoveEditBatch = (index: number) => {
        const newBatches = [...selectedBatches];
        newBatches.splice(index, 1);
        setSelectedBatches(newBatches);
    };

    const toggleSerialSelection = (serialNo: string) => {
        if (selectedSerials.includes(serialNo)) {
            setSelectedSerials(selectedSerials.filter(s => s !== serialNo));
        } else {
            const currentItem = fetchedItems[editingItemIndex!];
            const toPick = parseFloat(editingItemQty) || 0;
            if (selectedSerials.length >= toPick) {
                showToast(`You can only select ${toPick} serial numbers.`, 'error');
                return;
            }
            setSelectedSerials([...selectedSerials, serialNo]);
        }
    };

    const toggleDeleteItem = (idx: number) => {
        setFetchedItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, deleted: !item.deleted } : item
        ));
    };

    const fetchItemWarehouses = async (itemCode: string) => {
        setIsFetchingWarehouses(true);
        try {
            const data = await getResource('Bin', undefined, {
                filters: JSON.stringify([
                    ['item_code', '=', itemCode],
                    ['actual_qty', '>', 0]
                ]),
                fields: '["warehouse", "actual_qty"]',
                limit_page_length: 50,
                order_by: 'actual_qty desc'
            });
            setWarehouseList(data || []);
        } catch (e: any) {
            console.error('Fetch warehouses error', e);
            showError(e.message || 'Failed to fetch warehouses');
        } finally {
            setIsFetchingWarehouses(false);
        }
    };

    const selectWarehouse = (warehouseName: string, actualQty: number) => {
        if (editingItemWarehouse === warehouseName) return; // No change
        setEditingItemWarehouse(warehouseName);
        setEditingItemActualQty(actualQty);

        // Clear tracking data per instructions: Item -> Warehouse -> Batch/Serial
        setSelectedBatches([]);
        setSelectedSerials([]);
        setEditingItemQty('');

        if (editingItemIndex !== null) {
            const item = fetchedItems[editingItemIndex];
            if (item.has_batch_no || item.has_serial_no) {
                fetchTrackingData(item.item_code, warehouseName, item.has_batch_no, item.has_serial_no);
            }
        }
    };

    const toggleSourceSelection = (source: any) => {
        if (purpose === 'Delivery' && !selectedCustomer) {
            setSelectedCustomer(source);
            setSourceSearch('');
            setSourceResults([]);
            return;
        }

        if (selectedSources.find(ss => ss.name === source.name)) {
            setSelectedSources(selectedSources.filter(ss => ss.name !== source.name));
        } else {
            if (purpose === 'Delivery') {
                setSelectedSources([...selectedSources, source]);
            } else {
                setSelectedSources([source]);
            }
        }
    };

    return (
        <View style={styles.container}>
            <TopNavbar title="New Picklist" showBackButton />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
                    {/* Modern Numbered Stepper */}
                    {/* Modern Stepper */}
                    <View style={[styles.stepperContainer, { paddingHorizontal: 24, paddingVertical: 16, marginBottom: 8, position: 'relative' }]}>
                        <View style={styles.stepTrackLine} />
                        <View style={[styles.stepActiveLine, { width: createStep === 1 ? '0%' : createStep === 2 ? '45%' : '82%' }]} />
                        <View style={styles.stepWrapper}>
                            <View style={[styles.stepCircle, createStep >= 1 && styles.stepActive]}>
                                {createStep > 1 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, createStep >= 1 && styles.stepNumActive]}>1</Text>}
                            </View>
                            <Text style={[styles.stepLabel, createStep >= 1 && styles.stepLabelActive]}>Purpose</Text>
                        </View>
                        <View style={styles.stepWrapper}>
                            <View style={[styles.stepCircle, createStep >= 2 && styles.stepActive]}>
                                {createStep > 2 ? <Check size={14} color="#fff" /> : <Text style={[styles.stepNum, createStep >= 2 && styles.stepNumActive]}>2</Text>}
                            </View>
                            <Text style={[styles.stepLabel, createStep >= 2 && styles.stepLabelActive]}>Link Docs</Text>
                        </View>
                        <View style={styles.stepWrapper}>
                            <View style={[styles.stepCircle, createStep >= 3 && styles.stepActive]}>
                                <Text style={[styles.stepNum, createStep >= 3 && styles.stepNumActive]}>3</Text>
                            </View>
                            <Text style={[styles.stepLabel, createStep >= 3 && styles.stepLabelActive]}>Review Items</Text>
                        </View>
                    </View>

                    {createStep === 1 && (
                        <Animated.View entering={FadeInUp} style={styles.stepBox}>
                            <View style={styles.stepHeader}>
                                <Text style={styles.modernStepTitle}>{t('selection_purpose', 'Selection Purpose')}</Text>
                                <Text style={styles.modernStepSubtitle}>{t('what_are_you_picking', 'What are you picking items for?')}</Text>
                            </View>

                            <View style={styles.purposeGrid}>
                                {(['Delivery', 'Material Transfer', 'Material Transfer for Manufacture'] as const).map(p => (
                                    <TouchableOpacity
                                        key={p}
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            setPurpose(p);
                                            setSelectedSources([]);
                                            setSelectedCustomer(null);
                                            setSourceSearch('');
                                            setSourceResults([]);
                                            setFetchedItems([]);
                                        }}
                                        style={styles.purposeCardWrapper}
                                    >
                                        <View style={[styles.purposeCard, purpose === p && styles.purposeCardActive]}>
                                            {purpose === p && (
                                                <LinearGradient
                                                    colors={['rgba(46, 16, 101, 0.05)', 'rgba(118, 52, 188, 0.05)']}
                                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                                    style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                                                />
                                            )}
                                            <View style={[styles.purposeIconContainer, purpose === p ? { backgroundColor: 'transparent' } : { backgroundColor: '#f1f5f9' }]}>
                                                {purpose === p && (
                                                    <LinearGradient
                                                        colors={['#2e1065', '#7634bc']}
                                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                                        style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                                                    />
                                                )}
                                                {p === 'Delivery' ? <Truck size={24} color={purpose === p ? '#fff' : '#64748b'} /> :
                                                    p === 'Material Transfer' ? <ArrowRightLeft size={24} color={purpose === p ? '#fff' : '#64748b'} /> :
                                                        <Settings size={24} color={purpose === p ? '#fff' : '#64748b'} />}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.purposeTitle, purpose === p && styles.purposeTextActive]}>{p}</Text>
                                                <Text style={styles.purposeDesc}>
                                                    {p === 'Delivery' ? 'Pick for Sales Orders' :
                                                        p === 'Material Transfer' ? 'Stock move for MR' : 'Pick for Work Order'}
                                                </Text>
                                            </View>
                                            {purpose === p && (
                                                <View style={styles.activeIndicator}>
                                                    <Check size={16} color="#7634bc" />
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity activeOpacity={0.7} onPress={() => setCreateStep(2)} style={styles.primaryLinkWrapper}>
                                <Text style={styles.primaryLinkText}>{t('continue_to_step_2', 'Continue to Step 2 →')}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {createStep === 2 && (
                        <Animated.View entering={FadeInDown} style={styles.stepBox}>
                            <View style={styles.stepHeaderWithBack}>
                                <TouchableOpacity onPress={() => {
                                    setCreateStep(1);
                                    setSourceSearch('');
                                    setSourceResults([]);
                                }} style={styles.backBtnSmall}>
                                    <ArrowLeft size={20} color="#7634bc" />
                                </TouchableOpacity>
                                <View>
                                    <Text style={styles.modernStepTitle}>{t('link_documents', 'Link Documents')}</Text>
                                    <Text style={styles.modernStepSubtitle}>
                                        {purpose === 'Delivery'
                                            ? (!selectedCustomer ? 'Select a Customer first' : 'Select Sales Orders')
                                            : `Select ONE ${purpose === 'Material Transfer' ? 'Material Request' : 'Work Order'}`}
                                    </Text>
                                </View>
                            </View>

                            {purpose === 'Delivery' && selectedCustomer && (
                                <View style={styles.customerChip}>
                                    <LinearGradient
                                        colors={['#2e1065', '#7634bc']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                        style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                                    />
                                    <View style={styles.customerChipLeft}>
                                        <View style={styles.customerAvatar}>
                                            <User size={16} color="#7634bc" />
                                        </View>
                                        <Text style={styles.customerChipText}>{selectedCustomer.name}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => {
                                        setSelectedCustomer(null);
                                        setSelectedSources([]);
                                        setSourceResults([]);
                                    }} style={styles.customerChipClose}>
                                        <X size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.sourceSearchWrapper}>
                                <Search size={20} color="#94a3b8" />
                                <TextInput
                                    placeholder={purpose === 'Delivery'
                                        ? (!selectedCustomer ? 'Search Customer...' : 'Search Sales Orders...')
                                        : (purpose === 'Material Transfer' ? 'Search Material Request...' : 'Search Work Order...')
                                    }
                                    placeholderTextColor="#94a3b8"
                                    style={styles.sourceInput}
                                    value={sourceSearch}
                                    onChangeText={setSourceSearch}
                                    onFocus={() => fetchSources(sourceSearch, 1)}
                                />
                                {isFetchingSources && <ActivityIndicator size="small" color="#7634bc" />}
                            </View>

                            {sourceResults.length > 0 && (
                                <View style={styles.sourceResultsBox}>
                                    <Text style={styles.resultsLabel}>
                                        {purpose === 'Delivery' && !selectedCustomer ? 'SUGGESTED CUSTOMERS' : 'SEARCH RESULTS'}
                                    </Text>
                                    <ScrollView
                                        style={{ maxHeight: 320 }}
                                        nestedScrollEnabled={true}
                                        showsVerticalScrollIndicator={false}
                                        scrollEventThrottle={400}
                                        onScroll={({ nativeEvent }) => {
                                            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                                            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
                                            if (isCloseToBottom && hasMore && !isFetchingSources && !isFetchingMore) {
                                                fetchSources(sourceSearch, currentPage + 1);
                                            }
                                        }}
                                    >
                                        {sourceResults.map((s, index) => {
                                            const isSelected = selectedSources.find(ss => ss.name === s.name);
                                            return (
                                                <TouchableOpacity
                                                    key={s.name || index.toString()}
                                                    style={styles.resultItemWrapper}
                                                    activeOpacity={0.7}
                                                    onPress={() => toggleSourceSelection(s)}
                                                >
                                                    <View style={[styles.resultItem, isSelected && styles.resultItemActive]}>
                                                        {isSelected && (
                                                            <LinearGradient
                                                                colors={['#2e1065', '#7634bc']}
                                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                                                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                                                            />
                                                        )}
                                                        <View style={styles.resultItemLeft}>
                                                            <View style={[styles.resultIconBox, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                                                {purpose === 'Delivery' && selectedCustomer ? (
                                                                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                                                        {isSelected && <Check size={12} color="#fff" />}
                                                                    </View>
                                                                ) : <FileText size={18} color={isSelected ? '#fff' : '#64748b'} />}
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={[styles.resultItemTitle, isSelected && { color: '#fff' }]}>{s.name}</Text>
                                                                {s.customer_name && <Text style={[styles.resultItemSubtitle, isSelected && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>{s.customer_name}</Text>}
                                                                {s.production_item && <Text style={[styles.resultItemSubtitle, isSelected && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>{s.production_item}</Text>}
                                                                {s.transaction_date && <Text style={[styles.resultItemSubtitle, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>{s.transaction_date}</Text>}
                                                                {s.status && <Text style={[styles.resultItemSubtitle, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>{s.status}</Text>}
                                                            </View>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        {isFetchingMore && (
                                            <ActivityIndicator size="small" color="#7634bc" style={{ marginVertical: 10 }} />
                                        )}
                                    </ScrollView>
                                </View>
                            )}

                            {selectedSources.length > 0 && (
                                <View style={styles.selectedSourcesList}>
                                    <Text style={styles.resultsLabel}>{t('selected_documents', 'SELECTED DOCUMENTS')}</Text>
                                    <View style={styles.selectedCardsGrid}>
                                        {selectedSources.map((s, i) => (
                                            <View key={i} style={styles.selectedRow}>
                                                <View style={styles.selectedRowLeft}>
                                                    <View style={styles.selectedRowIcon}>
                                                        <Check size={14} color="#7634bc" />
                                                    </View>
                                                    <Text style={styles.selectedRowText}>{s.name}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => setSelectedSources(selectedSources.filter(ss => ss.name !== s.name))} style={styles.removeSourceBtn}>
                                                    <X size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.primaryBtnWrapper}
                                activeOpacity={0.8}
                                onPress={fetchItemsFromSources}
                                disabled={selectedSources.length === 0 || isFetchingSources}
                            >
                                <View style={[styles.primaryBtn, { backgroundColor: selectedSources.length === 0 ? '#e2e8f0' : '#7634bc' }, selectedSources.length === 0 && { elevation: 0 }]}>
                                    {isFetchingSources ? <ActivityIndicator size="small" color={selectedSources.length === 0 ? '#64748b' : '#fff'} /> : (
                                        <>
                                            <Text style={[styles.primaryBtnText, selectedSources.length === 0 && { color: '#64748b' }]}>{t('fetch_items', 'Fetch Items')}</Text>
                                            <ArrowRightLeft size={20} color={selectedSources.length === 0 ? '#64748b' : '#fff'} />
                                        </>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {createStep === 3 && (
                        <Animated.View entering={FadeInUp} style={styles.stepBox}>
                            <View style={styles.stepHeaderWithBack}>
                                <TouchableOpacity onPress={() => setCreateStep(2)} style={styles.backBtnSmall}>
                                    <ArrowLeft size={20} color="#0f172a" />
                                </TouchableOpacity>
                                <View>
                                    <Text style={styles.modernStepTitle}>{t('review_items', 'Review Items')}</Text>
                                    <Text style={styles.modernStepSubtitle}>{t('verify_quantities_be', 'Verify quantities before creating')}</Text>
                                </View>
                            </View>

                            <View style={styles.itemsStatsHeader}>
                                <LinearGradient
                                    colors={['rgba(46, 16, 101, 0.03)', 'rgba(118, 52, 188, 0.05)']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                                />
                                <View style={styles.statBox}>
                                    <Text style={styles.statValue}>{fetchedItems.filter(i => !i.deleted).length}</Text>
                                    <Text style={styles.statLabel}>{t('total_items', 'Total Items')}</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statBox}>
                                    <View style={styles.purposeBadge}>
                                        <Text style={styles.purposeBadgeText}>{purpose}</Text>
                                    </View>
                                    <Text style={styles.statLabel}>{t('purpose', 'Purpose')}</Text>
                                </View>
                            </View>

                            <View style={styles.itemsListContainer}>
                                {fetchedItems.map((item, i) => !item.deleted && (
                                    <View key={i} style={[styles.itemReviewCard, item.qty > (item.actual_qty || 0) && { borderColor: '#fca5a5', borderWidth: 1 }]}>

                                        {/* Header Row: Code, Tags, Actions */}
                                        <View style={styles.itemReviewHeader}>
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={styles.itemReviewCode} numberOfLines={1}>{item.item_code}</Text>
                                                {(item.has_serial_no == 1 || item.has_batch_no == 1) && (
                                                    <View style={styles.trackingBadge}>
                                                        <Text style={styles.trackingBadgeText}>
                                                            {item.has_serial_no == 1 && item.has_batch_no == 1 ? 'Batch+Serial' : (item.has_serial_no == 1 ? 'Serial' : 'Batch')}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {/* <TouchableOpacity onPress={() => toggleEditItem(i)} style={styles.actionIconButton}>
                                                    <Edit size={16} color="#3b82f6" />
                                                </TouchableOpacity> */}
                                                <TouchableOpacity onPress={() => toggleDeleteItem(i)} style={[styles.actionIconButton, { backgroundColor: '#fee2e2' }]}>
                                                    <Trash2 size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Name and Warehouse */}
                                        <Text style={styles.itemReviewName} numberOfLines={1}>{item.item_name}</Text>
                                        <View style={styles.warehouseRow}>
                                            <MapPin size={14} color="#64748b" />
                                            <Text style={styles.itemReviewWarehouse} numberOfLines={1}>{item.warehouse}</Text>
                                        </View>

                                        {/* Stats Grid */}
                                        <View style={styles.statsGrid}>
                                            <View style={styles.statCol}>
                                                <Text style={styles.statColLabel}>Ordered</Text>
                                                <Text style={styles.statColValue}>{item.ordered_qty || 0}</Text>
                                            </View>
                                            <View style={styles.statCol}>
                                                <Text style={styles.statColLabel}>Picked/Del.</Text>
                                                <Text style={styles.statColValue}>{item.delivered_qty_display || 0}</Text>
                                            </View>
                                            <View style={styles.statCol}>
                                                <Text style={styles.statColLabel}>Available</Text>
                                                <Text style={[styles.statColValue, { color: '#059669' }]}>{item.actual_qty || 0}</Text>
                                            </View>
                                            <View style={[styles.statCol, { backgroundColor: '#f3f4f6', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 4 }]}>
                                                <Text style={styles.statColLabel}>To Pick</Text>
                                                <Text style={[styles.statColValue, { color: '#7634bc', fontSize: 16 }]}>{item.qty} {item.uom}</Text>
                                            </View>
                                        </View>

                                        {/* Warning Banner */}
                                        {item.qty > (item.actual_qty || 0) && (
                                            <View style={styles.stockWarningBanner}>
                                                <AlertCircle size={14} color="#ef4444" />
                                                <Text style={styles.stockWarningText}>Insufficient stock in warehouse</Text>
                                            </View>
                                        )}
                                    </View>
                                ))}

                                {fetchedItems.some(item => item.deleted) && (
                                    <View style={styles.deletedItemsSection}>
                                        <Text style={styles.deletedItemsTitle}>{t('excluded_items', 'EXCLUDED ITEMS')}</Text>
                                        {fetchedItems.map((item, i) => item.deleted && (
                                            <View key={`del-${i}`} style={styles.deletedCard}>
                                                <Text style={styles.deletedCardCode} numberOfLines={1}>{item.item_code}</Text>
                                                <TouchableOpacity onPress={() => toggleDeleteItem(i)} style={styles.restoreBtn}>
                                                    <RotateCcw size={16} color="#7634bc" />
                                                    <Text style={styles.restoreBtnText}>{t('restore', 'Restore')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={[styles.finalActions, { gap: 12, flexDirection: 'row' }]}>

                                {/* Cancel Button */}
                                <TouchableOpacity activeOpacity={0.8} onPress={() => setCreateStep(1)} style={{ flex: 1 }} disabled={isFetchingSources}>

                                    <View style={[styles.saveDraftBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }, isFetchingSources && { opacity: 0.7 }]}>
                                        <View style={styles.footerPillIcon}>
                                            <ArrowLeft size={18} color="#64748b" />
                                        </View>
                                        <Text style={[styles.saveDraftBtnText, { color: '#334155' }]}>{t('cancel', 'Cancel')}</Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Start Picking Button */}
                                <TouchableOpacity activeOpacity={0.8} onPress={async () => {
                                    if (createdDocName) {
                                        // Update the draft picklist with any modifications (e.g., deleted items)
                                        setIsFetchingSources(true);
                                        try {
                                            const activeItems = fetchedItems.filter(i => !i.deleted);

                                            // Format items for update
                                            const EXCLUDED_SOURCE_FIELDS = new Set([
                                                'name', 'doctype', 'parent', 'parentfield', 'parenttype', 'idx',
                                                'creation', 'modified', 'modified_by', 'owner', 'docstatus',
                                                'delivered_qty', 'ordered_qty', 'transferred_qty',
                                                'amount', 'net_amount', 'base_amount', 'base_net_amount',
                                                'rate', 'net_rate', 'base_rate', 'base_net_rate',
                                                'picked_qty', 'returned_qty', 'billed_qty'
                                            ]);

                                            const formattedLocations = activeItems.flatMap((i: any) => {
                                                const baseItemRow: any = {
                                                    item_code: i.item_code,
                                                    item: i.item_code,
                                                    item_name: i.item_name,
                                                    description: i.description || i.item_name,
                                                    warehouse: i.warehouse,
                                                    picked_qty: 0,
                                                    uom: i.uom,
                                                    stock_uom: i.uom,
                                                    conversion_factor: 1,
                                                    customer: i.customer || selectedCustomer?.name,
                                                    use_serial_batch_fields: 1
                                                };

                                                for (const key of Object.keys(i)) {
                                                    if (!EXCLUDED_SOURCE_FIELDS.has(key) && !(key in baseItemRow) && i[key] != null && i[key] !== '') {
                                                        baseItemRow[key] = i[key];
                                                    }
                                                }

                                                if (i.sales_order) {
                                                    baseItemRow.sales_order = i.sales_order;
                                                    baseItemRow.sales_order_item = i.sales_order_item;
                                                    baseItemRow.so_detail = i.sales_order_item;
                                                }
                                                if (i.material_request) {
                                                    baseItemRow.material_request = i.material_request;
                                                    baseItemRow.material_request_item = i.material_request_item;
                                                }
                                                if (i.work_order) {
                                                    baseItemRow.work_order = i.work_order;
                                                    baseItemRow.work_order_item = i.work_order_item;
                                                }

                                                const rows: any[] = [];

                                                if (i.has_serial_no && i.serials && i.serials.length > 0) {
                                                    const row = { ...baseItemRow };
                                                    row.qty = i.serials.length;
                                                    row.stock_qty = i.serials.length;
                                                    row.serial_no = i.serials.join('\n');
                                                    rows.push(row);
                                                } else if (i.has_batch_no && i.batches && i.batches.length > 0) {
                                                    for (const b of i.batches) {
                                                        const row = { ...baseItemRow };
                                                        row.qty = b.qty;
                                                        row.stock_qty = b.qty;
                                                        row.batch_no = b.batch_no;
                                                        rows.push(row);
                                                    }
                                                } else {
                                                    const row = { ...baseItemRow };
                                                    row.qty = parseFloat(i.qty || '0');
                                                    row.stock_qty = parseFloat(i.qty || '0');
                                                    rows.push(row);
                                                }
                                                return rows;
                                            });

                                            await callMethod('frappe.client.set_value', {
                                                doctype: 'Pick List',
                                                name: createdDocName,
                                                fieldname: 'locations',
                                                value: formattedLocations
                                            });
                                            router.replace(`/inventory/pick/${createdDocName}`);
                                        } catch (e: any) {
                                            console.error('Update picklist error', e);
                                            showError(e.message || 'Failed to update picklist before starting');
                                            // Fallback to just navigating
                                            router.replace(`/inventory/pick/${createdDocName}`);
                                        } finally {
                                            setIsFetchingSources(false);
                                        }
                                    } else {
                                        createPicklist(false);
                                    }
                                }} style={{ flex: 1 }} disabled={isFetchingSources}>
                                    <View style={[styles.saveDraftBtn, { backgroundColor: '#0c0d0cff', borderWidth: 1, borderColor: '#cbd5e1' }, isFetchingSources && { opacity: 0.7 }]}>
                                        <Text style={[styles.saveDraftBtnText, { color: '#fcfeffff' }]}>{t('start_picking', 'Start Picking')}</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>



            {editingItemIndex !== null && (
                <Modal visible animationType="slide" statusBarTranslucent onRequestClose={() => setEditingItemIndex(null)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>Allocation Details</Text>
                                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }} numberOfLines={1}>{fetchedItems[editingItemIndex]?.item_name || fetchedItems[editingItemIndex]?.item_code}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setEditingItemIndex(null)} style={{ padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20, marginLeft: 12 }}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: '600' }}>To Pick Quantity</Text>
                            <TextInput
                                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16, color: '#0f172a', fontWeight: '500', marginBottom: 24 }}
                                value={editingItemQty}
                                onChangeText={(text) => setEditingItemQty(text.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                            />

                            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: '600' }}>Source Warehouse</Text>
                            {isFetchingWarehouses ? (
                                <ActivityIndicator size="small" color="#7634bc" style={{ marginVertical: 20 }} />
                            ) : warehouseList.length === 0 ? (
                                <View style={{ padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, alignItems: 'center', marginBottom: 24 }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>No warehouse data found.</Text>
                                </View>
                            ) : (
                                <View style={{ marginBottom: 24 }}>
                                    {warehouseList.map((w, index) => {
                                        const isSelected = w.warehouse === editingItemWarehouse;
                                        return (
                                            <TouchableOpacity
                                                key={w.warehouse || index}
                                                style={{
                                                    padding: 14,
                                                    borderWidth: 1.5,
                                                    borderColor: isSelected ? '#7634bc' : '#e2e8f0',
                                                    backgroundColor: isSelected ? '#f5f3ff' : '#fff',
                                                    borderRadius: 12,
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: 8
                                                }}
                                                onPress={() => selectWarehouse(w.warehouse, w.actual_qty)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                                    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: isSelected ? '#7634bc' : '#cbd5e1', alignItems: 'center', justifyContent: 'center' }}>
                                                        {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7634bc' }} />}
                                                    </View>
                                                    <Text style={{ fontSize: 14, color: isSelected ? '#4c1d95' : '#334155', fontWeight: isSelected ? '600' : '500', flex: 1 }}>{w.warehouse}</Text>
                                                </View>
                                                <View style={{ backgroundColor: isSelected ? '#ede9fe' : '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                    <Text style={{ fontSize: 12, color: isSelected ? '#6d28d9' : '#64748b', fontWeight: '600' }}>{w.actual_qty} in stock</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            {/* BATCH SELECTION */}
                            {fetchedItems[editingItemIndex]?.has_batch_no === 1 && !fetchedItems[editingItemIndex]?.has_serial_no && (
                                <View style={{ marginBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: '700' }}>Batch Allocation</Text>
                                        <TouchableOpacity onPress={handleAddEditBatch} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }}>
                                            <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>+ Add Batch</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {isFetchingTracking ? (
                                        <ActivityIndicator size="small" color="#7634bc" style={{ marginVertical: 20 }} />
                                    ) : availableBatches.length === 0 ? (
                                        <View style={{ padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, alignItems: 'center' }}>
                                            <Text style={{ color: '#ef4444', fontSize: 13 }}>No batches available in this warehouse.</Text>
                                        </View>
                                    ) : (
                                        selectedBatches.map((b, bIdx) => (
                                            <View key={bIdx} style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                                <View style={{ flex: 2 }}>
                                                    <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: '600' }}>Batch No</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                                        {availableBatches.map((ab, abIdx) => (
                                                            <TouchableOpacity
                                                                key={abIdx}
                                                                style={{
                                                                    paddingHorizontal: 12,
                                                                    paddingVertical: 10,
                                                                    backgroundColor: b.batch_no === ab.name ? '#f5f3ff' : '#fff',
                                                                    borderWidth: 1,
                                                                    borderColor: b.batch_no === ab.name ? '#7634bc' : '#e2e8f0',
                                                                    borderRadius: 8,
                                                                    marginRight: 8
                                                                }}
                                                                onPress={() => handleEditBatchChange(bIdx, 'batch_no', ab.name)}
                                                            >
                                                                <Text style={{ fontSize: 13, color: b.batch_no === ab.name ? '#4c1d95' : '#334155', fontWeight: b.batch_no === ab.name ? '600' : '400' }}>{ab.name}</Text>
                                                                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Avail: {ab.actual_qty}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: '600' }}>Qty</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <TextInput
                                                            style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#0f172a' }}
                                                            value={b.qty.toString()}
                                                            onChangeText={(text) => handleEditBatchChange(bIdx, 'qty', text.replace(/[^0-9.]/g, ''))}
                                                            keyboardType="decimal-pad"
                                                            selectTextOnFocus
                                                        />
                                                        <TouchableOpacity onPress={() => handleRemoveEditBatch(bIdx)} style={{ padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 }}>
                                                            <Trash2 size={16} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}

                            {/* SERIAL SELECTION */}
                            {fetchedItems[editingItemIndex]?.has_serial_no === 1 && (
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: '700', marginBottom: 12 }}>Serial Number Allocation</Text>

                                    {isFetchingTracking ? (
                                        <ActivityIndicator size="small" color="#7634bc" style={{ marginVertical: 20 }} />
                                    ) : availableSerials.length === 0 ? (
                                        <View style={{ padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, alignItems: 'center' }}>
                                            <Text style={{ color: '#ef4444', fontSize: 13 }}>No serials available in this warehouse.</Text>
                                        </View>
                                    ) : (
                                        <View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>Select {editingItemQty || 0} serial(s)</Text>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: selectedSerials.length === parseFloat(editingItemQty || '0') ? '#059669' : '#f59e0b' }}>{selectedSerials.length} / {editingItemQty || 0} Selected</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                {availableSerials.map((s, sIdx) => {
                                                    const isSelected = selectedSerials.includes(s.name);
                                                    return (
                                                        <TouchableOpacity
                                                            key={sIdx}
                                                            style={{
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 10,
                                                                backgroundColor: isSelected ? '#f5f3ff' : '#fff',
                                                                borderWidth: 1,
                                                                borderColor: isSelected ? '#7634bc' : '#e2e8f0',
                                                                borderRadius: 8,
                                                            }}
                                                            onPress={() => toggleSerialSelection(s.name)}
                                                        >
                                                            <Text style={{ fontSize: 13, color: isSelected ? '#4c1d95' : '#334155', fontWeight: isSelected ? '600' : '400' }}>{s.name}</Text>
                                                        </TouchableOpacity>
                                                    )
                                                })}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}
                        </ScrollView>

                        <View style={{ padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                            <TouchableOpacity activeOpacity={0.8} onPress={saveEditItem} style={{ backgroundColor: '#7634bc', paddingVertical: 16, borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save Allocation</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            )}
            <Modal visible={showSuccessModal} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeInUp} style={styles.successModalContent}>
                        <View style={styles.successIconBox}>
                            <Check size={40} color="#10b981" />
                        </View>
                        <Text style={styles.successTitle}>
                            {isSubmitted ? 'Picklist Submitted!' : 'Picklist Saved as Draft'}
                        </Text>
                        <Text style={styles.successMessage}>
                            {isSubmitted
                                ? `Your picklist ${createdDocName} has been submitted successfully.`
                                : `Your picklist ${createdDocName} has been saved as a draft. You can now start picking.`}
                        </Text>
                        <View style={styles.successModalActions}>
                            <TouchableOpacity
                                style={styles.successPrimaryBtn}
                                onPress={() => {
                                    setShowSuccessModal(false);
                                    router.replace('/inventory/picklist');
                                }}
                            >
                                <Text style={styles.successPrimaryBtnText}>
                                    {t('view_picklists', 'View Picklists')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollPadding: {
        paddingHorizontal: 16,
        paddingBottom: 120,
        paddingTop: 10,
    },
    stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
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
    stepBox: {
        flex: 1,
    },
    stepHeader: {
        marginBottom: 20,
    },
    stepHeaderWithBack: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 20,
    },
    backBtnSmall: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    modernStepTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        fontFamily: Fonts.sans,
        letterSpacing: -0.5,
    },
    modernStepSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 6,
        fontWeight: '500',
    },
    purposeGrid: {
        gap: 12,
        marginBottom: 20,
    },
    purposeCardWrapper: {
        shadowColor: '#2d4171',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
    },
    purposeCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderWidth: 1.5,
        borderColor: 'rgba(226, 232, 240, 0.4)',
        overflow: 'hidden',
    },
    purposeCardActive: {
        borderColor: '#7634bc',
        backgroundColor: '#f8fafc',
    },
    purposeIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    purposeTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    purposeTextActive: {
        color: '#7634bc',
    },
    purposeDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
        fontWeight: '500',
    },
    activeIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(118, 52, 188, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryLinkWrapper: {
        marginTop: 16,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ecfdf5',
        borderRadius: 26,
    },
    primaryLinkText: {
        color: '#10b981',
        fontSize: 15,
        fontWeight: '800',
        fontFamily: Fonts.sans,
    },
    primaryBtnWrapper: {
        marginTop: 10,
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 8,
    },
    primaryBtn: {
        height: 52,
        borderRadius: 26,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    customerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 20,
        marginBottom: 16,
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 5,
        overflow: 'hidden',
    },
    customerChipLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        zIndex: 1,
    },
    customerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    customerChipText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    customerChipClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    sourceSearchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    sourceInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginLeft: 12,
    },
    sourceResultsBox: {
        marginBottom: 20,
    },
    resultsLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '800',
        marginBottom: 12,
        letterSpacing: 1,
    },
    resultItemWrapper: {
        marginBottom: 8,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 1,
    },
    resultItem: {
        padding: 14,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
    },
    resultItemActive: {
        borderColor: 'transparent',
        borderWidth: 0,
    },
    resultItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        zIndex: 1,
    },
    resultIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultItemTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
    },
    resultItemSubtitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    checkboxActive: {
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: '#7634bc',
    },
    selectedSourcesList: {
        marginBottom: 20,
    },
    selectedCardsGrid: {
        gap: 10,
    },
    selectedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    selectedRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    selectedRowIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    selectedRowText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    removeSourceBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemsStatsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
    },
    statBox: {
        flex: 1,
        alignItems: 'flex-start',
        zIndex: 1,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(15, 23, 42, 0.1)',
        marginHorizontal: 20,
        zIndex: 1,
    },
    statValue: {
        fontSize: 30,
        fontWeight: '900',
        color: '#2e1065',
        letterSpacing: -1,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 4,
    },
    purposeBadge: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        marginBottom: 4,
    },
    purposeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#7634bc',
    },
    itemsListContainer: {
        gap: 10,
        marginBottom: 24,
    },
    itemReviewCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.4)',
        shadowColor: '#2d4171',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 8,
        marginBottom: 16,
    },
    itemReviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemReviewCode: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    trackingBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    trackingBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#475569',
        textTransform: 'uppercase',
    },
    actionIconButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemReviewName: {
        fontSize: 14,
        color: '#475569',
        marginBottom: 8,
        fontWeight: '500',
    },
    warehouseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
    },
    itemReviewWarehouse: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    statCol: {
        alignItems: 'center',
        flex: 1,
    },
    statColLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    statColValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#334155',
    },
    stockWarningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        padding: 8,
        borderRadius: 8,
        marginTop: 12,
        gap: 8,
    },
    stockWarningText: {
        fontSize: 12,
        color: '#ef4444',
        fontWeight: '600',
    },
    deletedItemsSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        borderStyle: 'dashed',
    },
    deletedItemsTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94a3b8',
        marginBottom: 12,
        letterSpacing: 1,
    },
    deletedCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
    },
    deletedCardCode: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94a3b8',
        flex: 1,
        textDecorationLine: 'line-through',
    },
    restoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    restoreBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7634bc',
    },
    finalActions: {
        marginTop: -15,
    },
    saveDraftBtn: {
        height: 52,
        borderRadius: 26,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    saveDraftBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    floatingFooter: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    footerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        paddingLeft: 8,
        borderRadius: 30,
        gap: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    footerPillIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerPillText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '800',
        paddingRight: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    successModalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 32,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    successIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 12,
        textAlign: 'center',
    },
    successMessage: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    successModalActions: {
        width: '100%',
    },
    successPrimaryBtn: {
        backgroundColor: '#7634bc',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    successPrimaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    editModalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    editModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    editModalSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 20,
        textAlign: 'center',
    },
    editModalInput: {
        width: '100%',
        height: 56,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 24,
    },
    editModalActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    editModalCancelBtn: {
        flex: 1,
        height: 50,
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editModalCancelText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#64748b',
    },
    editModalSaveBtn: {
        flex: 1,
        height: 50,
        backgroundColor: '#7634bc',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editModalSaveText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    }
});
