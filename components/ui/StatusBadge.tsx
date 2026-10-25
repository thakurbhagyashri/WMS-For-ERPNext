import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface StatusBadgeProps {
    status: string | number;
    style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, style }) => {
    let displayStatus = String(status || '').trim();
    
    if (status === 0 || status === '0') displayStatus = 'Draft';
    if (status === 1 || status === '1') displayStatus = 'Submitted';
    if (status === 2 || status === '2') displayStatus = 'Cancelled';
    
    if (!displayStatus) return null;

    const normalizedStatus = displayStatus.toLowerCase();
    
    let bgColor = '#f8fafc';
    let textColor = '#64748b';
    let borderColor = '#e2e8f0';

    if (normalizedStatus.includes('draft') || normalizedStatus.includes('hold') || normalizedStatus.includes('pending')) {
        bgColor = '#fffbeb';
        textColor = '#b45309';
        borderColor = '#fde68a';
    } else if (normalizedStatus === 'submitted' || normalizedStatus === 'completed' || normalizedStatus === 'delivered' || normalizedStatus === 'received') {
        bgColor = '#ecfdf5';
        textColor = '#10b981';
        borderColor = '#a7f3d0';
    } else if (normalizedStatus.includes('to deliver') || normalizedStatus.includes('to bill') || normalizedStatus.includes('to receive') || normalizedStatus.includes('in progress')) {
        bgColor = '#eff6ff';
        textColor = '#3b82f6';
        borderColor = '#bfdbfe';
    } else if (normalizedStatus.includes('cancel') || normalizedStatus.includes('close')) {
        bgColor = '#fef2f2';
        textColor = '#ef4444';
        borderColor = '#fecaca';
    }

    return (
        <View style={[styles.badge, { backgroundColor: bgColor, borderColor }, style]}>
            <Text style={[styles.text, { color: textColor }]}>{displayStatus.toUpperCase()}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 10,
        fontWeight: '900',
    }
});
