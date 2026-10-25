import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface PaginationProps {
    currentPage: number;
    hasMore: boolean;
    onPageChange: (newPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, hasMore, onPageChange }) => {
    return (
        <View style={styles.container}>
            <TouchableOpacity 
                style={[styles.btn, currentPage === 1 && styles.disabledBtn]} 
                disabled={currentPage === 1}
                onPress={() => onPageChange(currentPage - 1)}
                activeOpacity={0.7}
            >
                <ChevronLeft size={20} color={currentPage === 1 ? '#94a3b8' : '#334155'} />
            </TouchableOpacity>
            
            <View style={styles.pageInfo}>
                <Text style={styles.pageText}>Page {currentPage}</Text>
            </View>

            <TouchableOpacity 
                style={[styles.btn, !hasMore && styles.disabledBtn]} 
                disabled={!hasMore}
                onPress={() => onPageChange(currentPage + 1)}
                activeOpacity={0.7}
            >
                <ChevronRight size={20} color={!hasMore ? '#94a3b8' : '#334155'} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        width: '100%',
    },
    btn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        marginHorizontal: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    disabledBtn: {
        backgroundColor: '#f8fafc',
        borderColor: '#f1f5f9',
    },
    pageInfo: {
        minWidth: 80,
        alignItems: 'center',
    },
    pageText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#475569',
    }
});
