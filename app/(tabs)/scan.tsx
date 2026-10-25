import { NotificationBell } from '@/components/NotificationBell';
import { PermissionDeniedModal } from '@/components/ui/ConfirmationModal';
import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe, usePermissions } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    ChevronRight,
    ListCheck,
    MapPin,
    NotepadText,
    PackagePlus,
    Scan,
    Search,
    ShoppingBag, ShoppingCart,
    TriangleAlert,
    Truck,
    X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface ActionType {
    id: string;
    label: string;
    description: string;
    Icon: any;
    color: any
}

interface WarehouseStock {
    name: string;
    batch: string;
    stock: number;
    unit: string;
    shelfLife: string;
    status: 'good' | 'warning' | 'critical';
}

const QuickActionCard = ({ label, Icon, index, color, isActive, onPress }: { Icon: any, label: string, index: number, color: any, isActive: boolean, onPress?: () => void }) => {
    return (
        <Animated.View
            entering={FadeInRight.delay(index * 50).springify()}
            style={[styles.actionCardWrapper]}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.actionCard, isActive ? styles.actionCardActive : styles.actionCardInactive]}>
                <Icon size={16} color={isActive ? "#fff" : "#64748b"} strokeWidth={isActive ? 2.5 : 2} />
                <Text style={[styles.actionLabel, isActive ? styles.actionLabelActive : styles.actionLabelInactive]}>{label}</Text>
            </TouchableOpacity>
        </Animated.View>
    )
}

const DocResultItem = ({ doc, currentTab, router, idx, t }: any) => {
    const [isHeld, setIsHeld] = React.useState(false);
    return (
        <Animated.View entering={FadeInRight.delay(idx * 50)} key={idx} style={styles.ageingCard}>
            <TouchableOpacity
                onPress={() => {
                    const routeMap = { purchase_order: '/inventory/', sales_order: '/inventory/dispatch/', picklist: '/inventory/pick/' };
                    const prefix = routeMap[currentTab as keyof typeof routeMap];
                    router.push(`${prefix}${encodeURIComponent(doc.value)}` as any);
                }}
                onLongPress={() => Alert.alert('Full ID / Number', doc.value)}
                onPressIn={() => setIsHeld(true)}
                onPressOut={() => setIsHeld(false)}
                delayLongPress={200}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center' }}
            >
                <View style={[styles.docIcon, { backgroundColor: '#f3e8ff' }]}>
                    {currentTab === 'purchase_order' ? <ShoppingBag size={18} color="#7634bc" /> : currentTab === 'sales_order' ? <ShoppingCart size={18} color="#7634bc" /> : <ListCheck size={18} color="#7634bc" />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.docId, { flexWrap: isHeld ? 'wrap' : 'nowrap' }]} numberOfLines={isHeld ? undefined : 1}>{doc.value}</Text>
                    <Text style={styles.docMeta}>{doc.description || t('no_description', 'No details available')}</Text>
                </View>
                <ChevronRight size={20} color="#94a3b8" />
            </TouchableOpacity>
        </Animated.View>
    );
};

const DocCardItem = ({ icon: Icon, docId, meta, date, index, onPress }: any) => {
    const [isHeld, setIsHeld] = React.useState(false);
    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={() => Alert.alert('Full ID / Number', docId)}
            onPressIn={() => setIsHeld(true)}
            onPressOut={() => setIsHeld(false)}
            delayLongPress={200}
            activeOpacity={0.7}
        >
            <Animated.View entering={FadeInRight.delay(index * 100)} key={index} style={styles.docCard}>
                <View style={[styles.docIcon, { backgroundColor: '#f3e8ff' }]}>
                    <Icon size={18} color="#7634bc" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.docId, { flexWrap: isHeld ? 'wrap' : 'nowrap' }]} numberOfLines={isHeld ? undefined : 1}>{docId}</Text>
                    <Text style={styles.docMeta}>{meta}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.docDate}>{date}</Text>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function ScanScreen() {
    const { t } = useTranslation();
    const { hasPermission, refreshPermissions } = usePermissions();
    const [deniedModalVisible, setDeniedModalVisible] = useState(false);
    const [deniedFeatureName, setDeniedFeatureName] = useState('');
    const [currentTab, setCurrentTab] = useState<string | null>(() => {
        return 'item';
    });
    const [search, setSearch] = useState<string>('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [Itemfound, setItemFound] = useState<boolean>(true);

    const quickActions: ActionType[] = [
        { id: 'item', Icon: PackagePlus, label: t('item', 'Item'), description: t('item_scan_desc', 'View stock across warehouses'), color: "#7634bc" },
        { id: 'warehouse', Icon: MapPin, label: t('warehouse', 'Warehouse'), description: t('warehouse_scan_desc', 'View specific warehouse stock'), color: "#7634bc" },
        { id: 'purchase_order', Icon: NotepadText, label: t('purchase_order', 'Purchase Order'), description: t('po_scan_desc', 'Start receiving items'), color: "#7634bc" },
        { id: 'sales_order', Icon: Truck, label: t('sales_order', 'Sales Order'), description: t('so_scan_desc', 'Start picking items'), color: "#7634bc" },
        { id: 'picklist', Icon: ListCheck, label: t('picklist', 'Picklist'), description: t('picklist_scan_desc', 'Start picking items'), color: "#7634bc" }
    ];

    const router = useRouter();
    const { getResource, callMethod, company, baseUrl, getCurrentUserEmail } = useFrappe(APP_CONFIG);
    const { showError } = useToast();
    const [isFetching, setIsFetching] = useState(false);
    const [userInitials, setUserInitials] = useState('JD');
    const [result, setResult] = useState<any>(null);
    const [warehouseData, setWarehouseData] = useState<any[]>([]);
    const [warehouseOffset, setWarehouseOffset] = useState(0);
    const [hasMoreWarehouseData, setHasMoreWarehouseData] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [salesOrders, setSalesOrders] = useState<any[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

    const [permission, requestPermission] = useCameraPermissions();
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [docResults, setDocResults] = useState<any[]>([]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshPermissions();
        if (search) {
            await performScan(search);
        }
        setRefreshing(false);
    };

    useEffect(() => {
        setResult(null);
        setWarehouseData([]);
        setWarehouseOffset(0);
        setHasMoreWarehouseData(true);
        setItemFound(true);
        setSearch('');
        setSalesOrders([]);
        setPurchaseOrders([]);
        setDocResults([]);
    }, [currentTab]);

    useEffect(() => {
        if (search.length >= 3 && search !== result?.id) {
            const timer = setTimeout(() => {
                performScan(search);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [search]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const email = await getCurrentUserEmail();
                if (email && email !== 'Guest') {
                    const nameParts = email.split('@')[0].split('.');
                    const initials = nameParts.length > 1
                        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                        : nameParts[0].substring(0, 2).toUpperCase();
                    setUserInitials(initials);
                }
            } catch (e) { }
        };
        fetchUser();
    }, []);

    const handleSearch = (q: string) => {
        setSearch(q);
        if (!q.trim()) {
            setResult(null);
            setItemFound(true);
            setSalesOrders([]);
            setPurchaseOrders([]);
            setDocResults([]);
        }
    };

    async function performScan(code: string, isLoadMore = false, isCameraScan = false) {
        if (!code) return;

        const currentOffset = isLoadMore ? warehouseOffset : 0;
        const PAGE_SIZE = 200;

        if (isLoadMore) setIsLoadingMore(true);
        else setIsFetching(true);

        try {
            if (['purchase_order', 'sales_order', 'picklist'].includes(currentTab || '')) {
                const doctypeMap = {
                    purchase_order: 'Purchase Order',
                    sales_order: 'Sales Order',
                    picklist: 'Pick List'
                };
                const routeMap = {
                    purchase_order: '/inventory/',
                    sales_order: '/inventory/dispatch/',
                    picklist: '/inventory/pick/'
                };
                const doctype = doctypeMap[currentTab as keyof typeof doctypeMap];
                const routePrefix = routeMap[currentTab as keyof typeof routeMap];

                if (isCameraScan) {
                    let docName = code;
                    const searchDoc = await callMethod('frappe.desk.search.search_link', {
                        txt: code,
                        doctype: doctype
                    });
                    if (searchDoc && searchDoc.length > 0) {
                        docName = searchDoc[0].value;
                    }

                    router.push(`${routePrefix}${encodeURIComponent(docName)}` as any);
                    setIsScannerVisible(false);
                    setIsFetching(false);
                    return;
                } else {
                    const searchDoc = await callMethod('frappe.desk.search.search_link', {
                        txt: code,
                        doctype: doctype
                    });

                    if (searchDoc && searchDoc.length > 0) {
                        try {
                            const docNames = searchDoc.map((d: any) => d.value);
                            let fields = ['name', 'status'];
                            if (doctype === 'Pick List') fields.push('purpose');
                            if (doctype === 'Sales Order') fields.push('customer_name');
                            if (doctype === 'Purchase Order') fields.push('supplier_name');

                            const details = await callMethod('frappe.client.get_list', {
                                doctype: doctype,
                                filters: [['name', 'in', docNames]],
                                fields: fields,
                                limit_page_length: docNames.length
                            });

                            if (details && details.length > 0) {
                                const detailsMap = details.reduce((acc: any, d: any) => {
                                    acc[d.name] = d;
                                    return acc;
                                }, {});

                                searchDoc.forEach((d: any) => {
                                    const detail = detailsMap[d.value];
                                    if (detail && (!d.description || d.description.trim() === '')) {
                                        if (doctype === 'Pick List') d.description = `${detail.purpose || ''} • ${detail.status || ''}`;
                                        else if (doctype === 'Sales Order') d.description = `${detail.customer_name || ''} • ${detail.status || ''}`;
                                        else if (doctype === 'Purchase Order') d.description = `${detail.supplier_name || ''} • ${detail.status || ''}`;
                                    }
                                });
                            }
                        } catch (e) {
                            console.log("Failed to fetch extra details", e);
                        }
                    }

                    const exactMatch = searchDoc?.find((d: any) => d.value.trim().toLowerCase() === code.trim().toLowerCase()) || (searchDoc?.length === 1 ? searchDoc[0] : null);

                    if (exactMatch) {
                        router.push(`${routePrefix}${encodeURIComponent(exactMatch.value)}` as any);
                        setIsFetching(false);
                        return;
                    }

                    setDocResults(searchDoc || []);
                    setItemFound(searchDoc && searchDoc.length > 0);
                    setIsFetching(false);
                    return;
                }
            }

            if (currentTab === 'warehouse') {
                let whName = null;
                try {
                    const searchWh = await callMethod('frappe.desk.search.search_link', {
                        txt: code,
                        doctype: 'Warehouse'
                    });

                    if (searchWh && searchWh.length > 0) {
                        whName = searchWh[0].value;
                    } else {
                        const directWh = await getResource('Warehouse', code);
                        if (directWh) whName = code;
                    }
                } catch (e) {
                    // console.error('Warehouse verification failed', e);
                    console.log('warehouse search error', e);
                    console.log(e);

                }

                if (!whName) {
                    console.error(`[WarehouseScan] Could not resolve warehouse for code: ${code}`);
                    setWarehouseData([]);
                    setItemFound(false);
                    setIsScannerVisible(false);
                    return;
                }
                let reportCompany = company;
                if (!reportCompany || reportCompany.length < 15) {
                    try {
                        const defaults = await getResource('Global Defaults', 'Global Defaults');
                        if (defaults && defaults.default_company) {
                            reportCompany = defaults.default_company;
                        }
                    } catch (e) {
                        console.error('Failed to fetch Global Defaults', e);
                    }
                }

                const today = new Date().toISOString().split('T')[0];

                try {
                    const reportFilters = {
                        warehouse: whName,
                        company: reportCompany,
                        to_date: today,
                        include_zero_stock: 1,
                        show_warehouse_wise_stock: 0,
                        range: "30, 60, 90"
                    };

                    const report = await callMethod('frappe.desk.query_report.run', {
                        report_name: 'Stock Ageing',
                        filters: JSON.stringify(reportFilters),
                        start: currentOffset,
                        page_length: PAGE_SIZE
                    });

                    let filtered = [];
                    if (report && report.result && report.result.length > 0) {
                        console.log("=== STOCK AGEING COLUMNS ===", JSON.stringify(report.columns));
                        console.log("=== STOCK AGEING ROW 0 ===", JSON.stringify(report.result[0]));

                        filtered = report.result.filter((row: any) => {
                            const itemCode = Array.isArray(row) ? row[0] : row.item_code;
                            return itemCode && itemCode !== 'Item Code' && itemCode !== 'Total';
                        }).map((row: any) => {
                            if (Array.isArray(row)) {
                                const rowObj: any = {};
                                if (report.columns && Array.isArray(report.columns)) {
                                    report.columns.forEach((col: any, index: number) => {
                                        const key = col.fieldname || col.label || `col_${index}`;
                                        rowObj[key] = row[index];
                                    });
                                }

                                return {
                                    ...rowObj,
                                    item_code: rowObj.item_code ?? row[0],
                                    item_name: rowObj.item_name ?? row[1],
                                    qty: rowObj.bal_qty ?? rowObj.qty ?? row[5] ?? 0,
                                    uom: rowObj.stock_uom ?? rowObj.uom ?? row[4],
                                    range_1: rowObj.range1_qty ?? rowObj['Age (0 - 30)'] ?? (report.columns ? 0 : (row[6] || row[7] || 0)),
                                    range_2: rowObj.range2_qty ?? rowObj['Age (31 - 60)'] ?? (report.columns ? 0 : (row[7] || row[9] || 0)),
                                    range_3: rowObj.range3_qty ?? rowObj['Age (61 - 90)'] ?? (report.columns ? 0 : (row[8] || row[11] || 0)),
                                    range_4: rowObj.range4_qty ?? rowObj['Age (91 & Above)'] ?? rowObj['Age (91 - Above)'] ?? (report.columns ? 0 : (row[9] || row[13] || 0)),
                                };
                            }
                            return row;
                        });
                    }

                    if (filtered.length === 0 && currentOffset === 0) {
                        const bins = await callMethod('frappe.client.get_list', {
                            doctype: 'Bin',
                            filters: [['warehouse', '=', whName], ['actual_qty', '>', 0]],
                            fields: ['item_code', 'actual_qty', 'stock_uom'],
                            limit_page_length: PAGE_SIZE,
                            limit_start: currentOffset
                        });

                        if (bins && bins.length > 0) {
                            const itemCodes = bins.map((b: any) => b.item_code);
                            const items = await callMethod('frappe.client.get_list', {
                                doctype: 'Item',
                                filters: [['name', 'in', itemCodes]],
                                fields: ['name', 'item_name']
                            });
                            const itemMap = Object.fromEntries((items || []).map((i: any) => [i.name, i.item_name]));

                            filtered = bins.map((bin: any) => ({
                                item_code: bin.item_code,
                                item_name: itemMap[bin.item_code] || bin.item_code,
                                qty: bin.actual_qty,
                                uom: bin.stock_uom,
                                range_1: bin.actual_qty,
                                range_2: 0,
                                range_3: 0,
                                range_4: 0,
                                is_live: true
                            }));
                        }
                    }

                    if (isLoadMore) {
                        setWarehouseData(prev => [...prev, ...filtered]);
                    } else {
                        setWarehouseData(filtered);
                    }

                    setWarehouseOffset(currentOffset + filtered.length);
                    setHasMoreWarehouseData(filtered.length === PAGE_SIZE);
                    setItemFound(filtered.length > 0 || currentOffset > 0);
                    setIsScannerVisible(false);
                    return;
                } catch (reportErr: any) {
                    console.error('Warehouse fetch failed', reportErr);
                    showError(`Data Error: ${reportErr.message || 'Check connection'}`);
                    setItemFound(false);
                } finally {
                    setIsLoadingMore(false);
                    console.log("hello calling Ageing report here")
                }
                return;
            }

            if (currentTab === 'item') {
                let itemCode = code;

                const barcodeResults = await callMethod('frappe.client.get_list', {
                    doctype: 'Item',
                    filters: [['Item Barcode', 'barcode', '=', code]],
                    fields: ['name'],
                    limit: 1
                });

                if (barcodeResults && barcodeResults.length > 0) {
                    itemCode = barcodeResults[0].name;
                } else {
                    const searchResults = await callMethod('frappe.desk.search.search_link', {
                        txt: code,
                        doctype: 'Item'
                    });

                    if (searchResults && searchResults.length > 0) {
                        itemCode = searchResults[0].value;
                    }
                }

                const itemData = await getResource('Item', itemCode, {
                    fields: '["name", "item_name", "stock_uom", "image", "item_group", "description"]'
                });

                if (!itemData) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    setItemFound(false);
                    setResult(null);
                    return;
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                const bins = await callMethod('frappe.client.get_list', {
                    doctype: 'Bin',
                    filters: [['item_code', '=', itemData.name], ['actual_qty', '>', 0]],
                    fields: ['warehouse', 'actual_qty', 'stock_uom']
                });

                const soParents = await callMethod('frappe.client.get_list', {
                    doctype: 'Sales Order',
                    filters: [['Sales Order Item', 'item_code', '=', itemData.name], ['docstatus', '=', 1]],
                    fields: ['name', 'creation'],
                    order_by: 'creation desc',
                    limit_page_length: 10
                });

                const soItems = await Promise.all((soParents || []).map(async (so: any) => {
                    const fullSo = await getResource('Sales Order', so.name);
                    const itemRow = (fullSo.items || []).find((i: any) => i.item_code === itemData.name);
                    return {
                        parent: so.name,
                        qty: itemRow?.qty || 0,
                        delivered_qty: itemRow?.delivered_qty || 0,
                        base_amount: itemRow?.base_amount || 0,
                        creation: so.creation
                    };
                }));

                const poParents = await callMethod('frappe.client.get_list', {
                    doctype: 'Purchase Order',
                    filters: [['Purchase Order Item', 'item_code', '=', itemData.name], ['docstatus', '=', 1]],
                    fields: ['name', 'creation'],
                    order_by: 'creation desc',
                    limit_page_length: 10
                });

                const poItems = await Promise.all((poParents || []).map(async (po: any) => {
                    const fullPo = await getResource('Purchase Order', po.name);
                    const itemRow = (fullPo.items || []).find((i: any) => i.item_code === itemData.name);
                    return {
                        parent: po.name,
                        qty: itemRow?.qty || 0,
                        received_qty: itemRow?.received_qty || 0,
                        base_amount: itemRow?.base_amount || 0,
                        creation: po.creation
                    };
                }));

                setResult({
                    id: itemData.name,
                    name: itemData.item_name,
                    image: itemData.image,
                    item_group: itemData.item_group,
                    description: itemData.description,
                    totalStock: bins.reduce((acc: number, b: any) => acc + (parseFloat(b.actual_qty) || 0), 0).toFixed(2),
                    uom: itemData.stock_uom,
                    warehouses: bins.map((b: any) => ({
                        name: b.warehouse,
                        stock: b.actual_qty,
                        unit: b.stock_uom
                    }))
                });

                setSalesOrders(soItems || []);
                setPurchaseOrders(poItems || []);
                setItemFound(true);
                setIsScannerVisible(false);
                return;
            }

            // Default fallback
            setItemFound(false);
            setResult(null);

        } catch (err) {
            console.error('Scan error:', err);
            setItemFound(false);
            setResult(null);
        } finally {
            setIsFetching(false);
            setIsLoadingMore(false);
        }
    };

    const handleCameraScan = ({ data }: { data: string }) => {
        if (!isFetching && data !== search) {
            setSearch(data);
            performScan(data, false, true);
        }
    };

    const openScanner = async () => {
        if (!permission?.granted) {
            const res = await requestPermission();
            if (!res.granted) {
                Alert.alert("Permission Required", "Camera access is needed to scan barcodes.");
                return;
            }
        }
        setIsScannerVisible(true);
    };

    const clearsearch = () => {
        setSearch('');
        setItemFound(true);
        setResult(null);
        setSalesOrders([]);
        setPurchaseOrders([]);
        setDocResults([]);
    };

    const activeAction = quickActions.find((action) => action.id === currentTab);
    const activeActionColor = activeAction?.color || "#0f172a";
    return (
        <View style={styles.container}>
            <View style={styles.svgHeaderContainer}>
                <Svg height="100%" width="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <Defs>
                        <SvgGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#150247ff" stopOpacity="1" />
                            <Stop offset="1" stopColor="#f6b3eaff" stopOpacity="1" />
                        </SvgGradient>
                    </Defs>
                    {/* Sky */}
                    <Rect width="1440" height="320" fill="url(#skyGrad)" />
                    {/* Back Layer: Smooth Wave */}
                    <Path
                        fill="#8b7ca6"
                        d="M0 220 C 500 160, 900 320, 1440 200 L 1440 320 L 0 320 Z"
                        opacity="0.9"
                    />
                    {/* Front Layer: Overlapping Wave */}
                    <Path
                        fill="#f8fafc"
                        d="M0 320 L 0 260 C 400 340, 800 240, 1440 300 L 1440 320 Z"
                        opacity="1"
                    />
                </Svg>
            </View>

            <View style={[styles.headerTopBar, { justifyContent: 'space-between' }]}>
                <View style={styles.logoBox}>
                    <Scan size={24} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.logoText}>{t('scan_module', 'SCAN MODULE')}</Text>
                </View>
                <View style={styles.headerActions}>
                    <NotificationBell color="#eab308" style={{ marginRight: 10 }} />
                    <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/settings')}>
                        <Text style={styles.profileInitial}>{userInitials}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[activeActionColor]} />
                }
            >
                {currentTab === null ? (
                    <>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.h1}>{t('what_are_you_scanning', 'What are you scanning?')}</Text>
                            <Text style={styles.subtitleText}>{t('select_module_to_scan', 'Select a module below to start scanning.')}</Text>
                        </View>
                    </>
                ) : (
                    <Animated.View entering={FadeInRight} >
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.h1}>{t('what_are_you_scanning', 'What are you scanning?')}</Text>
                            <Text style={styles.subtitleText}>{t('select_module_to_scan', 'Select a module below to start scanning.')}</Text>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.scrollGridContent}
                            style={styles.scrollGrid}
                        >
                            {quickActions.map((action, i) => (
                                <QuickActionCard
                                    key={i}
                                    {...action}
                                    color={action.color}
                                    index={i}
                                    isActive={currentTab === action.id}
                                    onPress={() => {
                                        if (action.id === 'item' || action.id === 'warehouse') {
                                            if (!hasPermission('can_stock_lookup')) {
                                                setDeniedFeatureName(t('stock_lookup', 'Stock Lookup'));
                                                setDeniedModalVisible(true);
                                                return;
                                            }
                                        } else if (action.id === 'purchase_order') {
                                            if (!hasPermission('can_receive')) {
                                                setDeniedFeatureName(t('receive_goods', 'Receive Goods'));
                                                setDeniedModalVisible(true);
                                                return;
                                            }
                                        } else if (action.id === 'sales_order') {
                                            if (!hasPermission('can_ship') && !hasPermission('can_pick')) {
                                                setDeniedFeatureName(t('dispatch_goods', 'Sales Order Picking/Shipping'));
                                                setDeniedModalVisible(true);
                                                return;
                                            }
                                        } else if (action.id === 'picklist') {
                                            if (!hasPermission('can_pick')) {
                                                setDeniedFeatureName(t('picklist', 'Picklists'));
                                                setDeniedModalVisible(true);
                                                return;
                                            }
                                        }
                                        setCurrentTab(action.id);
                                    }}
                                />
                            ))}
                        </ScrollView>

                        <View
                            style={[
                                styles.searchSection,
                                { zIndex: showSearchDropdown ? 1000 : 1 },
                            ]}
                        >
                            <View style={[styles.searchBarContainer, { borderColor: activeActionColor }]}>
                                <Search size={22} color={activeActionColor} />

                                <TextInput
                                    placeholder={
                                        currentTab === 'item' ? t('search_item', 'Search Item...') :
                                            currentTab === 'warehouse' ? t('search_warehouse', 'Search Warehouse...') :
                                                currentTab === 'purchase_order' ? t('search_purchase_order', 'Search Purchase Order...') :
                                                    currentTab === 'sales_order' ? t('search_sales_order', 'Search Sales Order...') :
                                                        t('search_picklist', 'Search Picklist...')
                                    }
                                    style={styles.searchInput}
                                    value={search}
                                    onChangeText={handleSearch}
                                    onSubmitEditing={() => {
                                        if (search.trim()) {
                                            performScan(search, false, true);
                                        }
                                    }}
                                    placeholderTextColor="#94a3b8"
                                />

                                {isFetching && <ActivityIndicator size="small" color={activeActionColor} />}
                                {search.length > 0 && !isFetching && (<TouchableOpacity onPress={clearsearch} style={[styles.clearBtn, { backgroundColor: activeActionColor }]}>
                                    <X size={16} color="#fff" />
                                </TouchableOpacity>)}
                            </View>

                            <TouchableOpacity onPress={openScanner} activeOpacity={0.85} style={[styles.hugeScannerBtn, { backgroundColor: activeActionColor }]}>
                                <Scan size={24} color="#fff" />
                                <Text style={styles.hugeScannerText}>{t('open_camera', 'Open Camera')}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.resultsContainer}>
                            {/* warehouse results */}
                            {currentTab === 'warehouse' ? (
                                warehouseData.length > 0 ? (
                                    <View style={styles.warehouseListSection}>
                                        <View style={styles.reportHeader}>
                                            <Text style={styles.reportTitle}>{t('warehouse_stock_ageing', 'Warehouse Stock & Ageing')}</Text>
                                            <View style={styles.badge}><Text style={styles.badgeText}>{warehouseData.length} {t('items', 'Items')}</Text></View>
                                        </View>
                                        {warehouseData.map((item, idx) => (
                                            <Animated.View entering={FadeInRight.delay(idx * 50)} key={idx} style={styles.ageingCard}>
                                                <View style={styles.ageingMain}>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                            {item.is_live && (
                                                                <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>{t('live', 'LIVE')}</Text></View>
                                                            )}
                                                            <Text style={styles.ageingItemName} numberOfLines={1}>{item.item_name}</Text>
                                                        </View>
                                                        <Text style={styles.ageingItemCode}>{item.item_code}</Text>
                                                    </View>
                                                    <View style={styles.ageingQtyContainer}>
                                                        <Text style={styles.ageingQty}>{item.qty}</Text>
                                                        <Text style={styles.ageingUom}>{item.uom || 'Nos'}</Text>
                                                    </View>
                                                </View>

                                                <View style={styles.divider} />

                                                <View style={styles.ageingGrid}>
                                                    <View style={styles.ageingCell}>
                                                        <Text style={styles.ageingLabel}>{t('0_30d', '0-30d')}</Text>
                                                        <Text style={[styles.ageingVal, { color: '#10b981' }]}>{item.range_1 || item.range1 || item.range1_qty || item['Age (0 - 30)'] || 0}</Text>
                                                    </View>
                                                    <View style={styles.ageingCell}>
                                                        <Text style={styles.ageingLabel}>{t('30_60d', '31-60d')}</Text>
                                                        <Text style={[styles.ageingVal, { color: '#f59e0b' }]}>{item.range_2 || item.range2 || item.range2_qty || item['Age (31 - 60)'] || 0}</Text>
                                                    </View>
                                                    <View style={styles.ageingCell}>
                                                        <Text style={styles.ageingLabel}>{t('60_90d', '61-90d')}</Text>
                                                        <Text style={[styles.ageingVal, { color: '#ef4444' }]}>{item.range_3 || item.range3 || item.range3_qty || item['Age (61 - 90)'] || 0}</Text>
                                                    </View>
                                                    <View style={styles.ageingCell}>
                                                        <Text style={styles.ageingLabel}>{t('91d_plus', '91d+')}</Text>
                                                        <Text style={[styles.ageingVal, { color: '#7f1d1d', fontWeight: '900' }]}>{item.range_4 || item.range4 || item.range4_qty || item['Age (91 & Above)'] || item['Age (91 - Above)'] || 0}</Text>
                                                    </View>
                                                </View>
                                            </Animated.View>
                                        ))}

                                        {hasMoreWarehouseData && (
                                            <TouchableOpacity
                                                onPress={() => performScan(search, true)}
                                                style={styles.loadMoreBtn}
                                                disabled={isLoadingMore}
                                            >
                                                {isLoadingMore ? (
                                                    <ActivityIndicator color="#64748b" />
                                                ) : (
                                                    <Text style={styles.loadMoreText}>{t('load_more_items', 'Load More Items')}</Text>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : Itemfound ? (
                                    <View style={styles.emptyState}>
                                        <MapPin size={48} color="#cbd5e1" />
                                        <Text style={styles.emptyStateText}>{t('warehouse_empty_or_not_scanned', 'Warehouse is empty or not yet scanned')}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.errorContainer}>
                                        <TriangleAlert size={40} color="#ef4444" />
                                        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#7f1d1d' }}>{t('warehouse_not_found', 'Warehouse not found')}</Text>
                                    </View>
                                )
                            ) : ['purchase_order', 'sales_order', 'picklist'].includes(currentTab || '') ? (
                                docResults.length > 0 ? (
                                    <View style={styles.warehouseListSection}>
                                        <View style={styles.reportHeader}>
                                            <Text style={styles.reportTitle}>{t('search_results', 'Search Results')}</Text>
                                            <View style={styles.badge}><Text style={styles.badgeText}>{docResults.length} {t('docs', 'Documents')}</Text></View>
                                        </View>
                                        {docResults.map((doc, idx) => (
                                            <DocResultItem
                                                key={idx}
                                                doc={doc}
                                                currentTab={currentTab}
                                                router={router}
                                                idx={idx}
                                                t={t}
                                            />
                                        ))}
                                    </View>
                                ) : Itemfound ? (
                                    <View style={styles.emptyState}>
                                        <NotepadText size={48} color="#cbd5e1" />
                                        <Text style={styles.emptyStateText}>{t('ready_to_scan', 'Ready to scan barcode...')}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.errorContainer}>
                                        <TriangleAlert size={40} color="#ef4444" />
                                        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#7f1d1d' }}>{t('doc_not_found', 'Document not found')}</Text>
                                    </View>
                                )
                            ) : (
                                result ? (
                                    <View style={styles.resultView}>
                                        <Animated.View entering={FadeInUp.duration(600)} style={styles.resultHeaderCard}>
                                            <View style={styles.itemImageContainer}>
                                                {result.image ? (
                                                    <Image source={{ uri: (baseUrl || APP_CONFIG.baseUrl) + result.image }} style={styles.itemImage} />
                                                ) : (
                                                    <View style={styles.placeholderIcon}>
                                                        <PackagePlus size={30} color="#3b82f6" />
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.resultInfo}>
                                                <View style={styles.groupBadge}>
                                                    <Text style={styles.groupBadgeText}>{result.item_group}</Text>
                                                </View>
                                                <Text style={styles.resultName} numberOfLines={2}>{result.name}</Text>
                                                <Text style={styles.resultId}>{result.id}</Text>
                                            </View>
                                            <View style={styles.stockSummaryContainer}>
                                                <LinearGradient
                                                    colors={['#f8fafc', '#f1f5f9']}
                                                    style={styles.stockGradient}
                                                >
                                                    <Text style={styles.totalStockValue}>{result.totalStock ?? 0}</Text>
                                                    <Text style={styles.totalStockLabel}>{result.uom || 'Nos'}</Text>
                                                </LinearGradient>
                                            </View>
                                        </Animated.View>

                                        {/* Physical Stock Section */}
                                        <View style={styles.sectionContainer}>
                                            <View style={styles.sectionHeader}>
                                                <Text style={styles.stockSectionTitle}>{t('physical_stock', 'Physical Stock')}</Text>
                                                <View style={styles.badge}><Text style={styles.badgeText}>{result.warehouses?.length || 0} {t('locs', 'Locs')}</Text></View>
                                            </View>
                                            {result.warehouses?.length > 0 ? result.warehouses.map((wh: any, index: number) => (
                                                <Animated.View entering={FadeInRight.delay(index * 100)} key={index} style={styles.warehouseCard}>
                                                    <View style={styles.whIconContainer}><MapPin size={18} color="#64748b" /></View>
                                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                                        <Text style={styles.whName}>{wh.name}</Text>
                                                        <Text style={styles.whBatch}>{t('general_stock', 'General Stock')}</Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <Text style={styles.whStock}>{wh.stock} <Text style={styles.whUnit}>{wh.unit}</Text></Text>
                                                    </View>
                                                </Animated.View>
                                            )) : (
                                                <View style={styles.emptyCard}><Text style={styles.emptyText}>{t('out_of_stock', 'Out of stock')}</Text></View>
                                            )}
                                        </View>

                                        {/* Sales Order Section */}
                                        <View style={styles.sectionContainer}>
                                            <Text style={styles.stockSectionTitle}>{t('demand_open_orders', 'Demand (Open Orders)')}</Text>
                                            {salesOrders.length > 0 ? salesOrders.map((so: any, index: number) => (
                                                <DocCardItem
                                                    key={index}
                                                    icon={ShoppingCart}
                                                    docId={so.parent}
                                                    meta={`${t('ordered', 'Ordered')}: ${so.qty} • ${t('pending', 'Pending')}: ${so.qty - (so.delivered_qty || 0)}`}
                                                    date={new Date(so.creation).toLocaleDateString()}
                                                    index={index}
                                                    onPress={() => router.push(`/inventory/dispatch/${encodeURIComponent(so.parent)}` as any)}
                                                />
                                            )) : (
                                                <View style={styles.emptyCard}><Text style={styles.emptyText}>{t('no_active_sales_demand', 'No active sales demand')}</Text></View>
                                            )}
                                        </View>

                                        {/* Purchase Order Section */}
                                        <View style={styles.sectionContainer}>
                                            <Text style={styles.stockSectionTitle}>{t('supply_inbound', 'Supply (Inbound)')}</Text>
                                            {purchaseOrders.length > 0 ? purchaseOrders.map((po: any, index: number) => (
                                                <DocCardItem
                                                    key={index}
                                                    icon={ShoppingBag}
                                                    docId={po.parent}
                                                    meta={`${t('ordered', 'Ordered')}: ${po.qty} • ${t('rec', 'Rec')}: ${po.received_qty}`}
                                                    date={new Date(po.creation).toLocaleDateString()}
                                                    index={index}
                                                    onPress={() => router.push(`/inventory/${encodeURIComponent(po.parent)}` as any)}
                                                />
                                            )) : (
                                                <View style={styles.emptyCard}><Text style={styles.emptyText}>{t('no_incoming_stock_expected', 'No incoming stock expected')}</Text></View>
                                            )}
                                        </View>

                                        <TouchableOpacity onPress={clearsearch} style={styles.scanAnotherBtn}>
                                            <Text style={styles.scanAnotherBtnText}>{t('scan_another_item', 'Scan Another Item')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : Itemfound ? (
                                    <View style={styles.emptyState}>
                                        <Scan size={48} color="#cbd5e1" />
                                        <Text style={styles.emptyStateText}>{t('ready_to_scan', 'Ready to scan barcode...')}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.errorContainer}>
                                        <TriangleAlert size={40} color="#ef4444" />
                                        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#7f1d1d' }}>{t('item_not_tracked', 'Item not tracked in system')}</Text>
                                    </View>
                                )
                            )}
                        </View>


                    </Animated.View>
                )}
            </ScrollView>

            {/* Camera Overlay */}
            <Modal visible={isScannerVisible} animationType="fade" statusBarTranslucent onRequestClose={() => setIsScannerVisible(false)}>
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={handleCameraScan}
                        barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13"] }}
                    />
                    <View style={styles.overlay}>
                        <View style={styles.scanFrame} />
                        <Text style={styles.scanText}>{t('position_barcode', 'Position barcode within frame')}</Text>
                        <TouchableOpacity style={styles.closeCamera} onPress={() => setIsScannerVisible(false)}>
                            <X size={30} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <PermissionDeniedModal
                visible={deniedModalVisible}
                featureName={deniedFeatureName}
                onClose={() => setDeniedModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    content: {
        flexDirection: 'row',
        marginTop: 10,
        // backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        marginHorizontal: 20
    },
    secondorySection: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        marginHorizontal: 20
    },
    scrollGrid: {
        marginBottom: 10,
    },
    svgHeaderContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 220,
        zIndex: 0,
    },
    headerTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 20,
    },
    logoBox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoText: {
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 1,
        color: '#fff',
        fontFamily: Fonts.sans,
    },
    scrollGridContent: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    headerTitleContainer: {
        paddingHorizontal: 24,
        paddingTop: 11,
        paddingBottom: 16,
    },
    h1: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        fontFamily: Fonts.rounded,
    },
    subtitleText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontFamily: Fonts.sans,
        marginTop: 6,
    },
    actionCardWrapper: {
        marginRight: 10,
    },
    actionCard: {
        flexDirection: 'row',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
    },
    actionCardActive: {
        backgroundColor: '#7634bc',
        borderColor: '#7634bc',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    actionCardInactive: {
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    actionLabelActive: {
        color: '#fff',
    },
    actionLabelInactive: {
        color: '#64748b',
    },
    searchBarContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 24,
        height: 60,
        paddingHorizontal: 16,
        gap: 12,
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        fontWeight: '500',
        color: '#0f172a',
        paddingVertical: 0,
        fontFamily: Fonts.sans,
        ...Platform.select({
            web: { outlineStyle: 'none' } as any,
        }),
    },
    clearBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#94a3b8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    hugeScannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        borderRadius: 24,
        marginTop: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    hugeScannerText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: Fonts.rounded,
    },
    logoBadgeText: {
        color: '#4c1d95',
        fontSize: 12,
        fontWeight: '900',
        fontFamily: Fonts.sans,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1e1b4b15',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    profileInitial: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },

    searchSection: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    plCardWrapper: {
        width: (width - 50) / 2,
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        marginBottom: 12,
    },
    QuickSampleText: {
        fontSize: 14,
        color: "#737373",
        paddingHorizontal: 20,
        fontWeight: 500,

    },
    cardContainer: {
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        backgroundColor: '#fef2f2',
        borderRadius: 24,
        marginVertical: 20,
        width: '100%',
        borderWidth: 2,
        borderColor: '#fecaca',
        borderStyle: 'dashed',
    },
    // New Styles for Scan Results
    resultsContainer: {
        marginTop: 4,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    resultView: {
        width: '100%',
    },
    resultHeaderCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        gap: 12,
    },
    itemImageContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        overflow: 'hidden'
    },
    placeholderIcon: {
        width: '100%',
        height: '100%',
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    resultInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    groupBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginBottom: 4,
    },
    groupBadgeText: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    resultId: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
        fontFamily: Fonts.sans,
        marginTop: 2,
    },
    resultName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
        lineHeight: 20,
    },
    stockSummaryContainer: {
        marginLeft: 8,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    stockGradient: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 70,
    },
    totalStockValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
    },
    totalStockLabel: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    stockSectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#475569',
        marginBottom: 12,
        marginTop: 8,
    },
    warehouseCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    whIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    whName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    whBatch: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    whStock: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    whUnit: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: 'normal',
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    timeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    scanAnotherBtn: {
        width: '100%',
        height: 54,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    scanAnotherBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    sectionContainer: {
        marginBottom: 24,
    },
    docCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    docIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    docId: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    docMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    docPrice: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    emptyText: {
        fontSize: 13,
        color: '#94a3b8',
        fontStyle: 'italic',
        marginLeft: 4
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        gap: 16,
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        marginTop: 20,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '600',
        fontFamily: Fonts.sans,
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000'
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    scanText: {
        color: '#fff',
        marginTop: 32,
        fontSize: 16,
        fontWeight: 'bold'
    },
    closeCamera: {
        position: 'absolute',
        top: 60,
        right: 30,
        padding: 10
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#f1f5f9',
        borderRadius: 10
    },
    badgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#64748b'
    },
    emptyCard: {
        padding: 24,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 20,
        alignItems: 'center'
    },
    docDate: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 4
    },
    // Warehouse Ageing Styles
    warehouseListSection: {
        width: '100%',
        paddingBottom: 20
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4
    },
    reportTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#475569',
    },
    ageingCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    ageingMain: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ageingItemName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    ageingItemCode: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2
    },
    ageingQtyContainer: {
        alignItems: 'flex-end',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    ageingQty: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    ageingUom: {
        fontSize: 9,
        color: '#94a3b8',
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 12,
    },
    ageingGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    ageingCell: {
        alignItems: 'center',
        flex: 1,
    },
    ageingLabel: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: 'bold',
        marginBottom: 4
    },
    ageingVal: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    liveBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 6,
    },
    liveBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
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
        fontSize: 14,
        fontWeight: '700',
        color: '#7634bc'
    }
});
