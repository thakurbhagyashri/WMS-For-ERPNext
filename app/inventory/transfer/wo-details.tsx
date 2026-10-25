import { APP_CONFIG } from '@/constants/config';
import { useFrappe } from '@/hooks/use-frappe';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    Check,
    Factory
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = ['Work Order', 'Materials', 'Review', 'Stock Entry'];
    return (
        <View style={styles.stepperContainer}>
            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isActive = index === currentStep;
                return (
                    <View key={index} style={styles.stepWrapper}>
                        <View style={[styles.stepCircle, isCompleted ? styles.stepCompleted : isActive ? styles.stepActive : styles.stepInactive]}>
                            {isCompleted ? <Check size={12} color="#fff" /> : <Text style={[styles.stepNumber, isActive ? { color: '#fff' } : { color: '#64748b' }]}>{index + 1}</Text>}
                        </View>
                        <Text style={[styles.stepLabel, isActive ? styles.stepLabelActive : {}]}>{step}</Text>
                        {index < steps.length - 1 && (
                            <View style={[styles.stepLine, isCompleted ? styles.stepLineCompleted : {}]} />
                        )}
                    </View>
                );
            })}
        </View>
    );
};

export default function WorkOrderDetailsScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const woId = params.id as string;

    const { getResource, postResource } = useFrappe(APP_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [workOrder, setWorkOrder] = useState<any>(null);

    useEffect(() => {
        const fetchWorkOrder = async () => {
            setIsLoading(true);
            try {
                const doc = await getResource('Work Order', woId);
                setWorkOrder(doc);
            } catch (err) {
                console.error(err);
                Alert.alert("Error", "Failed to load Work Order details.");
            } finally {
                setIsLoading(false);
            }
        };
        if (woId) fetchWorkOrder();
    }, [woId]);

    const handleCreatePickList = async () => {
        if (!workOrder) return;
        setIsSubmitting(true);
        try {
            console.log(`[MTFM] Creating Draft Pick List for Work Order: ${woId}`);
            
            // Map Work Order required items to Pick List locations
            const locations = workOrder.required_items.map((item: any) => {
                const pendingQty = item.required_qty - (item.transferred_qty || 0);
                return {
                    item_code: item.item_code,
                    qty: pendingQty,
                    stock_qty: pendingQty,
                    uom: item.stock_uom || item.uom,
                    stock_uom: item.stock_uom || item.uom,
                    conversion_factor: 1,
                    warehouse: item.source_warehouse || workOrder.source_warehouse,
                };
            }).filter((loc: any) => loc.qty > 0);

            if (locations.length === 0) {
                Alert.alert("Notice", "All materials have already been transferred for this Work Order.");
                setIsSubmitting(false);
                return;
            }

            const pickListPayload = {
                company: workOrder.company,
                purpose: 'Material Transfer for Manufacture',
                work_order: workOrder.name,
                for_qty: workOrder.qty,
                for_warehouse: workOrder.wip_warehouse,
                locations: locations,
                item_locations_set: 1,
                docstatus: 0 // Draft
            };

            const savedPickList = await postResource('Pick List', pickListPayload, false, undefined, true);
            
            console.log(`[MTFM] Pick List created: ${savedPickList.name}`);
            
            // Navigate to existing pick list review UI
            router.replace({
                pathname: '/inventory/pick/[id]',
                params: { id: savedPickList.name }
            });
            
        } catch (err: any) {
            console.error('[MTFM] Error creating Pick List', err);
            Alert.alert("Error", `Failed to create Pick List: ${err.message || 'Unknown Error'}`);
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Review Materials</Text>
            </View>

            <Stepper currentStep={1} />

            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#7634bc" />
                </View>
            ) : workOrder ? (
                <>
                    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                        
                        <Animated.View entering={FadeInDown.delay(100)} style={styles.woCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                                <Factory size={20} color="#7634bc" />
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a' }}>{workOrder.name}</Text>
                            </View>
                            <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 12 }}>
                                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>PRODUCTION ITEM</Text>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 4 }}>{workOrder.production_item}</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                                    <View>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Qty to Manufacture</Text>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#10b981', marginTop: 2 }}>{workOrder.qty} {workOrder.stock_uom}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Target (WIP) Warehouse</Text>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{workOrder.wip_warehouse || 'Not Set'}</Text>
                                    </View>
                                </View>
                            </View>
                        </Animated.View>

                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: 1, marginBottom: 12, marginLeft: 8, marginTop: 16 }}>MATERIALS REQUIRED</Text>
                        
                        {workOrder.required_items?.map((item: any, idx: number) => {
                            const remaining = item.required_qty - (item.transferred_qty || 0);
                            return (
                                <Animated.View key={idx} entering={FadeInDown.delay(200 + (idx * 50))} style={styles.itemCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{item.item_code}</Text>
                                            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{item.item_name}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                                            <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>REMAINING</Text>
                                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#10b981', marginTop: 2 }}>{remaining > 0 ? remaining : 0} {item.stock_uom || item.uom}</Text>
                                        </View>
                                    </View>
                                    
                                    <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, marginTop: 8 }}>
                                        <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>SOURCE WAREHOUSE</Text>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 2 }}>{item.source_warehouse || workOrder.source_warehouse || 'Not configured in Work Order'}</Text>
                                    </View>
                                </Animated.View>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.bottomCTA}>
                        <TouchableOpacity
                            style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
                            onPress={handleCreatePickList}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitBtnText}>Create Draft Pick List</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#64748b' }}>Work Order not found.</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 24,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 32,
        paddingVertical: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    stepWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    stepCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    stepCompleted: {
        backgroundColor: '#10b981',
    },
    stepActive: {
        backgroundColor: '#7634bc',
    },
    stepInactive: {
        backgroundColor: '#e2e8f0',
    },
    stepNumber: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    stepLabel: {
        position: 'absolute',
        top: 30,
        left: -15,
        width: 60,
        textAlign: 'center',
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '600',
    },
    stepLabelActive: {
        color: '#7634bc',
        fontWeight: 'bold',
    },
    stepLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 8,
    },
    stepLineCompleted: {
        backgroundColor: '#10b981',
    },
    woCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
    },
    bottomCTA: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    submitBtn: {
        height: 56,
        backgroundColor: '#7634bc',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
