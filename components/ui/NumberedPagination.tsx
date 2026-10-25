import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface NumberedPaginationProps {
    currentPageIndex: number;
    hasMore: boolean;
    onNext: () => void;
    onPrev: () => void;
    style?: ViewStyle;
}

export const NumberedPagination: React.FC<NumberedPaginationProps> = ({
    currentPageIndex,
    hasMore,
    onNext,
    onPrev,
    style
}) => {
    return (
        <View style={[styles.container, style]}>
            <TouchableOpacity 
                disabled={currentPageIndex === 0}
                onPress={onPrev}
                style={styles.button}
            >
                <ChevronLeft size={18} color={currentPageIndex === 0 ? '#cbd5e1' : '#4f46e5'} />
                <Text style={[styles.buttonText, { color: currentPageIndex === 0 ? '#cbd5e1' : '#4f46e5' }]}>Previous</Text>
            </TouchableOpacity>

            <Text style={styles.pageText}>Page {currentPageIndex + 1}</Text>

            <TouchableOpacity 
                disabled={!hasMore}
                onPress={onNext}
                style={styles.button}
            >
                <Text style={[styles.buttonText, { color: !hasMore ? '#cbd5e1' : '#4f46e5' }]}>Next</Text>
                <ChevronRight size={18} color={!hasMore ? '#cbd5e1' : '#4f46e5'} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingTop: 16, 
        borderTopWidth: 1, 
        borderTopColor: '#f1f5f9'
    },
    button: {
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 4, 
        paddingVertical: 8, 
        paddingHorizontal: 4 
    },
    buttonText: {
        fontWeight: '600', 
        fontSize: 15
    },
    pageText: {
        fontSize: 14, 
        fontWeight: '500', 
        color: '#64748b'
    }
});
