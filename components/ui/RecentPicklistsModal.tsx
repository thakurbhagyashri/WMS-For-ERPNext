import { NumberedPagination } from '@/components/ui/NumberedPagination';
import { Fonts } from '@/constants/theme';
import { Box, CheckCircle2, ChevronRight, Inbox, X } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export interface PicklistItem {
    name: string;
    owner?: string;
    status: string;
    time: string;
}

interface RecentPicklistsModalProps {
    visible: boolean;
    onClose: () => void;
    picklists: PicklistItem[];
    isLoading: boolean;
    currentPageIndex: number;
    hasMore: boolean;
    onNextPage: () => void;
    onPrevPage: () => void;
    onItemPress: (id: string) => void;
}

export const RecentPicklistsModal: React.FC<RecentPicklistsModalProps> = ({
    visible,
    onClose,
    picklists,
    isLoading,
    currentPageIndex,
    hasMore,
    onNextPage,
    onPrevPage,
    onItemPress,
}) => {
    const { t } = useTranslation();

    const renderItem = (pl: PicklistItem, i: number) => {
        const safeStatus = pl.status || 'Draft';
        const isDraft = safeStatus.toLowerCase() === 'draft';
        const IconC = isDraft ? Box : CheckCircle2;
        const iconColor = isDraft ? '#d97706' : '#059669';
        const iconBg = isDraft ? '#fef3c7' : '#d1fae5';

        return (
            <Animated.View key={pl.name} entering={FadeInDown.delay(i * 50).duration(300)}>
                <TouchableOpacity
                    style={styles.activityItem}
                    onPress={() => onItemPress(pl.name)}
                    activeOpacity={0.7}
                >
                    <View style={styles.activityIconContainer}>
                        <View style={[styles.activityIconBg, { backgroundColor: iconBg }]}>
                            <IconC size={22} color={iconColor} strokeWidth={2} />
                        </View>
                    </View>
                    <View style={styles.activityContent}>
                        <View style={styles.activityTitleRow}>
                            <Text style={styles.activityTitle}>{pl.name}</Text>
                        </View>
                        <View style={styles.activitySubRow}>
                            <View style={[styles.statusBadge, isDraft ? styles.statusBadgeDraft : styles.statusBadgeDefault]}>
                                <Text style={[styles.statusText, isDraft ? styles.statusTextDraft : styles.statusTextDefault]}>
                                    {t(safeStatus.toLowerCase(), safeStatus)}
                                </Text>
                            </View>
                            <Text style={styles.activityTime}>{pl.time || 'Unknown time'}</Text>
                        </View>
                        {pl.owner && (
                            <Text style={styles.activitySubText}>{`Created by ${pl.owner}`}</Text>
                        )}
                    </View>
                    <View style={styles.activityArrow}>
                        <ChevronRight size={18} color="#94a3b8" />
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable onPress={(e) => e.stopPropagation()} style={styles.filterCardWrapper}>
                    <Animated.View entering={FadeInUp.duration(400)} style={styles.filterCard}>
                        {/* Decorative top handle */}
                        <View style={{ alignItems: 'center', marginBottom: 18 }}>
                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' }} />
                        </View>

                        {/* Header */}
                        <View style={styles.modalHeaderLight}>
                            <View>
                                <Text style={styles.modalTitleLight}>{t('recent_picklists', 'Recent Picklists')}</Text>
                                <Text style={styles.modalSubtitle}>{t('recent_picklists_desc', 'View and manage recent picklist orders')}</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtnLight} onPress={onClose}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Divider */}
                        <View style={styles.divider} />

                        {/* Content */}
                        <View style={styles.listContainer}>
                            {isLoading ? (
                                <View style={styles.emptyStateContainer}>
                                    <ActivityIndicator size="large" color="#7634bc" />
                                    <Text style={styles.emptyStateText}>{t('loading_picklists', 'Loading picklists...')}</Text>
                                </View>
                            ) : picklists.length === 0 ? (
                                <View style={styles.emptyStateContainer}>
                                    <View style={styles.emptyStateIconCircle}>
                                        <Inbox size={32} color="#7634bc" />
                                    </View>
                                    <Text style={styles.emptyStateTitle}>{t('no_picklists_found', 'No Picklists Found')}</Text>
                                    <Text style={styles.emptyStateText}>{t('no_recent_picklists', 'There are no recent picklists available.')}</Text>
                                </View>
                            ) : (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                                    {picklists.map((pl, i) => renderItem(pl, i))}
                                </ScrollView>
                            )}
                        </View>

                        {/* Pagination */}
                        {!isLoading && picklists.length > 0 && (
                            <NumberedPagination
                                currentPageIndex={currentPageIndex}
                                hasMore={hasMore}
                                onNext={onNextPage}
                                onPrev={onPrevPage}
                                style={{ marginTop: 10, paddingBottom: 20 }}
                            />
                        )}
                    </Animated.View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },

    filterCardWrapper: {
        width: '100%',
        maxHeight: '90%',
    },
    filterCard: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingTop: 16,
        paddingBottom: 20,
        height: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
    },
    modalHeaderLight: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    modalTitleLight: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        fontFamily: Fonts.sans,
        letterSpacing: -0.5,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#64748b',
        fontFamily: Fonts.sans,
        marginTop: 4,
    },
    modalCloseBtnLight: {
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginBottom: 16,
    },
    listContainer: {
        flex: 1,
        minHeight: 200,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    activityIconContainer: {
        marginRight: 16,
    },
    activityIconBg: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityContent: {
        flex: 1,
        justifyContent: 'center',
    },
    activityTitleRow: {
        marginBottom: 4,
    },
    activityTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        fontFamily: Fonts.sans,
        letterSpacing: -0.3,
    },
    activitySubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    activitySubText: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
    },
    statusBadgeDraft: {
        backgroundColor: '#fef3c7',
    },
    statusBadgeDefault: {
        backgroundColor: '#f1f5f9',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
        fontFamily: Fonts.sans,
        textTransform: 'uppercase',
    },
    statusTextDraft: {
        color: '#d97706',
    },
    statusTextDefault: {
        color: '#64748b',
    },
    activityTime: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
        fontFamily: Fonts.sans,
    },
    activityArrow: {
        marginLeft: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f3e8ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
        fontFamily: Fonts.sans,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        fontFamily: Fonts.sans,
        paddingHorizontal: 32,
        marginTop: 12,
    },
});
