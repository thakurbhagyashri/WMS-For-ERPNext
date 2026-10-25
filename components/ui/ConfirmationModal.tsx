import { Fonts } from '@/constants/theme';
import { AlertCircle, CheckCircle2, Lock, LogOut } from 'lucide-react-native';
import React from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface ConfirmationModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    isAlert?: boolean;
    iconType?: 'logout' | 'delete' | 'submit' | 'alert' | 'lock';
    onConfirm?: () => void;
    onCancel: () => void;
}

export const ConfirmationModal = ({
    visible,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDestructive = false,
    isAlert = false,
    iconType = 'alert',
    onConfirm,
    onCancel
}: ConfirmationModalProps) => {
    if (!visible) return null;

    const renderIcon = () => {
        if (iconType === 'lock') return <Lock size={28} color="#d97706" />;
        const color = isDestructive ? '#ef4444' : '#10b981';
        switch (iconType) {
            case 'logout': return <LogOut size={28} color={color} />;
            case 'submit': return <CheckCircle2 size={28} color={color} />;
            case 'delete': return <AlertCircle size={28} color={color} />;
            default: return <AlertCircle size={28} color={color} />;
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable style={styles.overlay} onPress={onCancel}>
                <Pressable onPress={(e) => e.stopPropagation()}>
                    <Animated.View
                        entering={FadeInUp.duration(300).springify()}
                        exiting={FadeOutDown.duration(200)}
                        style={styles.modalCard}
                    >
                        <View style={[
                            styles.iconBox,
                            {
                                backgroundColor: iconType === 'lock' 
                                    ? '#fef3c7' 
                                    : (isDestructive ? '#fef2f2' : '#f0fdf4')
                            }
                        ]}>
                            {renderIcon()}
                        </View>
                        
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>

                        <View style={styles.buttonRow}>
                            {!isAlert && (
                                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                                    <Text style={styles.cancelBtnText}>{cancelText}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                style={[
                                    styles.confirmBtn, 
                                    { 
                                        backgroundColor: iconType === 'lock'
                                            ? '#1e1b4b'
                                            : (isDestructive ? '#ef4444' : '#0f172a') 
                                    }
                                ]} 
                                onPress={onConfirm || onCancel}
                            >
                                <Text style={styles.confirmBtnText}>{confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        width: width - 48,
        backgroundColor: '#ffffff',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        fontFamily: Fonts.sans,
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: '#64748b',
        fontFamily: Fonts.sans,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 50,
        backgroundColor: '#f1f5f9',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#475569',
        fontSize: 15,
        fontWeight: '600',
        fontFamily: Fonts.sans,
    },
    confirmBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
});

export interface PermissionDeniedModalProps {
    visible: boolean;
    featureName?: string;
    message?: string;
    onClose: () => void;
}

export const PermissionDeniedModal = ({
    visible,
    featureName,
    message,
    onClose
}: PermissionDeniedModalProps) => {
    return (
        <ConfirmationModal
            visible={visible}
            title="Access Restricted"
            message={message || `You do not have permission to access ${featureName || 'this module'}. Please contact your warehouse administrator to get access.`}
            confirmText="Got It"
            isAlert={true}
            iconType="lock"
            onCancel={onClose}
            onConfirm={onClose}
        />
    );
};
