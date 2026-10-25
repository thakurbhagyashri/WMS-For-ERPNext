import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TouchableWithoutFeedback, Platform } from 'react-native';
import { Copy, CheckCircle2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

interface OrderIdPopupProps {
    visible: boolean;
    orderId: string | null;
    onClose: () => void;
}

export const OrderIdPopup: React.FC<OrderIdPopupProps> = ({ visible, orderId, onClose }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        if (orderId) {
            await Clipboard.setStringAsync(orderId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!orderId) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.card}>
                            <Text style={styles.title}>Document ID</Text>
                            
                            <TouchableOpacity 
                                activeOpacity={0.7} 
                                onPress={handleCopy}
                                style={styles.idContainer}
                            >
                                <Text style={styles.orderId} selectable={true}>{orderId}</Text>
                                {copied ? (
                                    <CheckCircle2 size={20} color="#10b981" />
                                ) : (
                                    <Copy size={20} color="#64748b" />
                                )}
                            </TouchableOpacity>

                            {copied && (
                                <Text style={styles.copiedText}>Copied to clipboard</Text>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 32,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    idContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 12,
    },
    orderId: {
        fontSize: Platform.OS === 'ios' ? 18 : 17,
        fontWeight: '900',
        color: '#0f172a',
    },
    copiedText: {
        marginTop: 12,
        fontSize: 13,
        color: '#10b981',
        fontWeight: '500',
    }
});
