import { Fonts } from '@/constants/theme';
import { AlertCircle, CheckCircle, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View , Modal } from 'react-native';


export type ToastType = 'success' | 'error';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

export const formatToastMessage = (msg: string) => {
    if (!msg) return '';

    let processed = msg;
    if (msg.startsWith('[') && msg.endsWith(']')) {
        try {
            const parsed = JSON.parse(msg);
            if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                processed = parsed[0];
            }
        } catch (e) {
        }
    }

    let cleaned = processed.replace(/<[^>]*>?/gm, '');

    if (cleaned.includes("Traceback (most recent call last)")) {
        const lines = cleaned.split('\n');
        const errorLines = lines
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('File "') && !l.includes('^^^') && !l.includes('Traceback'));

        if (errorLines.length > 0) {
            processed = errorLines.slice(-1)[0] || cleaned;
        }
    }

    if (processed.includes("Unknown column") && (processed.includes("item_code") || processed.includes("warehouse"))) {
        return null;
    }

    if (processed.includes("OperationalError") || processed.includes("pymysql")) {
        const sqlMatch = processed.match(/"([^"]+)"/);
        if (sqlMatch) return sqlMatch[1];
    }

    const final = processed.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ').trim();
    return final || null;
};

export const Toast = ({ message, type, onClose, duration = 4000 }: ToastProps) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [translateY] = useState(new Animated.Value(-100));

    const hide = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -20,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start(() => onClose());
    };

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            })
        ]).start();

        const timer = setTimeout(() => {
            hide();
        }, duration);

        return () => clearTimeout(timer);
    }, []);

    const formattedMessage = formatToastMessage(message);

    if (!formattedMessage) {
        return null;
    }

    return (
        <Modal
            transparent={true}
            visible={true}
            animationType="none"
            pointerEvents="box-none"
        >
            <View style={styles.modalOverlay} pointerEvents="box-none">
                <Animated.View
                    style={[
                        styles.container,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY }]
                        },
                        type === 'success' ? styles.success : styles.error
                    ]}
                >
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            {type === 'success' ? (
                                <CheckCircle size={20} color="#fff" />
                            ) : (
                                <AlertCircle size={20} color="#fff" />
                            )}
                        </View>
                        <Text style={styles.message}>{formattedMessage}</Text>
                    </View>
                    <TouchableOpacity onPress={hide} style={styles.closeBtn}>
                        <X size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 110 : 90,
        left: 20,
        right: 20,
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    success: {
        backgroundColor: '#10b981',
    },
    error: {
        backgroundColor: '#ef4444',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
        fontFamily: Fonts.sans || 'System',
        letterSpacing: 0.2,
    },
    closeBtn: {
        marginLeft: 12,
        padding: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    }
});
