import { APP_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useCompanyContext } from '@/context/CompanyContext';
import { useFrappe } from '@/hooks/use-frappe';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    ChevronRight,
    Factory,
    X
} from 'lucide-react-native';
import { GlobalSearchInput } from '@/components/ui/GlobalSearchInput';
import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { OrderIdPopup } from '@/components/ui/OrderIdPopup';
import { StatusBadge } from '@/components/ui/StatusBadge';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Modal
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

const { width } = Dimensions.get('window');

const WOCard = ({ id, status, item_code, qty, uom, date, index, onPress, onLongPress }: any) => {
    const [isHeld, setIsHeld] = React.useState(false);

    return (
        <TouchableOpacity 
            onPress={() => onPress?.(id)}
            onLongPress={() => onLongPress?.(id)}
            onPressIn={() => setIsHeld(true)}
            onPressOut={() => setIsHeld(false)}
            delayLongPress={200}
            activeOpacity={0.7}
        >
            <Animated.View
                entering={FadeInDown.delay(100 + (index * 50)).duration(600)}
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
                        <Factory size={20} color="#7634bc" />
                    </LinearGradient>
                </View>
                <View style={styles.activityContent}>
                    <View style={[styles.activityTitleRow, { flexWrap: isHeld ? 'wrap' : 'nowrap' }]}>
                        <Text style={[styles.activityTitle, { flexShrink: isHeld ? 0 : 1 }]} numberOfLines={isHeld ? undefined : 1}>{id}</Text>
                    </View>
                    {item_code && (
                        <View style={styles.activityTitleRow}>
                            <Text style={{fontSize: 13, color: '#0f172a', fontWeight: 'bold', marginBottom: 4}}>{item_code}</Text>
                        </View>
                    )}
                    <View style={styles.activitySubRow}>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>
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

export default function WorkOrderListScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { getResource, callMethod } = useFrappe(APP_CONFIG);
    const { activeCompany } = useCompanyContext();

    const [permission, requestPermission] = useCameraPermissions();
    const [search, setSearch] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [searchPage, setSearchPage] = useState(1);
    const [searchHasMore, setSearchHasMore] = useState(true);
    const [showOrderIdPopup, setShowOrderIdPopup] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    const PAGE_SIZE = 20;

    const fetchWorkOrders = async (pageIndex = 1) => {
        if (!activeCompany) return;
        setIsLoading(true);
        try {
            const data = await getResource('Work Order', undefined, {
                filters: JSON.stringify([
                    ['company', '=', activeCompany],
                    ['docstatus', '=', 1],
                    ['status', '!=', 'Completed']
                ]),
                fields: '["name", "status", "production_item", "qty", "stock_uom", "creation"]',
                order_by: 'creation desc',
                limit_start: (pageIndex - 1) * PAGE_SIZE,
                limit_page_length: PAGE_SIZE
            });
            if (data && data.length > 0) {
                setWorkOrders(data);
                setHasMore(data.length === PAGE_SIZE);
            } else {
                if (pageIndex === 1) setWorkOrders([]);
                setHasMore(false);
            }
            setCurrentPage(pageIndex);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchWorkOrders();
        setRefreshing(false);
    };

    const handleSearch = async (pageIndex = 1) => {
        if (!search.trim()) return;
        if (pageIndex === 1) setIsSearching(true);
        try {
            const data = await getResource('Work Order', undefined, {
                filters: JSON.stringify([
                    ['company', '=', activeCompany],
                    ['docstatus', '=', 1],
                    ['status', '!=', 'Completed'],
                    ['name', 'like', `%${search}%`]
                ]),
                fields: '["name", "status", "production_item", "qty", "stock_uom", "creation"]',
                order_by: 'creation desc',
                limit_start: (pageIndex - 1) * PAGE_SIZE,
                limit_page_length: PAGE_SIZE
            });
            
            let finalData = data;
            if (!data || data.length === 0) {
                // Try searching by production item
                const itemData = await getResource('Work Order', undefined, {
                    filters: JSON.stringify([
                        ['company', '=', activeCompany],
                        ['docstatus', '=', 1],
                        ['status', '!=', 'Completed'],
                        ['production_item', 'like', `%${search}%`]
                    ]),
                    fields: '["name", "status", "production_item", "qty", "stock_uom", "creation"]',
                    order_by: 'creation desc',
                    limit_start: (pageIndex - 1) * PAGE_SIZE,
                    limit_page_length: PAGE_SIZE
                });
                finalData = itemData || [];
            }

            setSearchResults(finalData);
            setSearchPage(pageIndex);
            setSearchHasMore(finalData.length === PAGE_SIZE);
        } catch (e) {
            console.warn(e);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCompany]);

    useEffect(() => {
        if (!search.trim()) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSearchResults([]);
            return;
        }
        
        const delayDebounceFn = setTimeout(() => {
            handleSearch(1);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, activeCompany]);

    const handleSelectWorkOrder = (id: string) => {
        router.push({
            pathname: '/inventory/transfer/wo-details',
            params: { id }
        });
    };

    const handleScan = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert(t('permission_required', 'Permission Required'), t('camera_permission_msg', 'We need camera permission to scan barcodes.'));
                return;
            }
        }
        setIsScanning(true);
    };

    const onBarcodeScanned = ({ data }: { data: string }) => {
        setIsScanning(false);
        setSearch(data);
    };

    const displayList = search.trim() ? searchResults : workOrders;

    return (
        <View style={styles.container}>
            {/* Header Background */}
            <View style={styles.svgHeaderContainer}>
                <Svg height="100%" width="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <Defs>
                        <SvgGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#3b0764" stopOpacity="1" />
                            <Stop offset="1" stopColor="#7634bc" stopOpacity="1" />
                        </SvgGradient>
                    </Defs>
                    <Rect width="1440" height="320" fill="url(#skyGrad)" />
                    <Path
                        fill="rgba(255,255,255,0.05)"
                        d="M0 220 C 500 160, 900 320, 1440 200 L 1440 320 L 0 320 Z"
                    />
                    <Path
                        fill="rgba(255,255,255,0.1)"
                        d="M0 320 L 0 280 C 400 230, 1000 320, 1440 260 L 1440 320 Z"
                    />
                </Svg>
            </View>

            {/* Header Navigation */}
            <View style={styles.headerTopBar}>
                <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
                    <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerActions}>
                    <View style={styles.infoPill}>
                        <Factory size={16} color='#fff' />
                        <Text style={styles.pillText}>{t('mfg', 'MFG')}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.greetingContainer}>
                <Text style={styles.greetingText}>Work Orders</Text>
                <Text style={styles.subGreetingText}>Select a Work Order for material transfer</Text>
            </View>

            {/* Search Bar */}
            <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
                <GlobalSearchInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t('search_work_order', 'Search Work Order...')}
                    onScan={handleScan}
                    isSearching={isSearching}
                />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollPadding, { paddingTop: 10 }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
            >
                {isLoading || isSearching ? (
                    <View style={{ marginTop: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#7634bc" />
                    </View>
                ) : displayList.length > 0 ? (
                    <View style={{ paddingBottom: 20 }}>
                        {displayList.map((wo, i) => (
                            <WOCard 
                                key={i}
                                index={i}
                                id={wo.name}
                                status={wo.status}
                                item_code={wo.production_item}
                                qty={wo.qty}
                                uom={wo.stock_uom}
                                date={wo.creation?.split(' ')[0]}
                                onPress={handleSelectWorkOrder}
                                onLongPress={(id: string) => {
                                    setSelectedOrderId(id);
                                    setShowOrderIdPopup(true);
                                }}
                            />
                        ))}
                        {(currentPage > 1 || hasMore || searchPage > 1 || searchHasMore) && (
                            <NumberedPagination
                                currentPageIndex={search.trim() ? searchPage : currentPage}
                                hasMore={search.trim() ? searchHasMore : hasMore}
                                onNext={() => {
                                    if (search.trim()) {
                                        handleSearch(searchPage + 1);
                                    } else {
                                        fetchWorkOrders(currentPage + 1);
                                    }
                                }}
                                onPrev={() => {
                                    if (search.trim()) {
                                        handleSearch(searchPage - 1);
                                    } else {
                                        fetchWorkOrders(currentPage - 1);
                                    }
                                }}
                            />
                        )}
                    </View>
                ) : (
                    <View style={{ marginTop: 40, alignItems: 'center' }}>
                        <Factory size={48} color="#e2e8f0" style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyText}>No Active Work Orders Found</Text>
                    </View>
                )}
            </ScrollView>

            <Modal visible={isScanning} animationType="slide" statusBarTranslucent onRequestClose={() => setIsScanning(false)}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={onBarcodeScanned}
                    />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 60, right: 30, backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 25 }}
                        onPress={() => setIsScanning(false)}
                    >
                        <X size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Scan Work Order ID</Text>
                    </View>
                </View>
            </Modal>

            <OrderIdPopup
                visible={showOrderIdPopup}
                orderId={selectedOrderId}
                onClose={() => setShowOrderIdPopup(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    svgHeaderContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280,
        overflow: 'hidden',
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
        zIndex: 0,
    },
    headerTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
    },
    backPill: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 18,
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    pillText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
        fontFamily: Fonts.rounded,
    },
    greetingContainer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    greetingText: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        fontFamily: Fonts.sans,
    },
    subGreetingText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
        fontFamily: Fonts.sans,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        height: 56,
        paddingLeft: 16,
        paddingRight: 6,
        gap: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#0f172a',
        height: '100%',
        paddingVertical: 0,
        fontFamily: Fonts.sans,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    scanBtn: {
        backgroundColor: '#f1f5f9',
        padding: 10,
        borderRadius: 12,
    },
    scrollPadding: {
        paddingHorizontal: 24,
        paddingBottom: 100,
    },
    activityItem: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    activityIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        overflow: 'hidden',
        marginRight: 16,
    },
    activityIconBg: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityContent: {
        flex: 1,
    },
    activityTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    activitySubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
    },
    statusText: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: 'bold',
    },
    activityTime: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    activityArrow: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    emptyText: {
        fontSize: 16,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
        fontWeight: '600',
    },
});
