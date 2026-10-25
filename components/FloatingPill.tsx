import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export type FloatingPillProps = {
    onBackPress: () => void;
    backIcon: React.ReactNode;
    leftLabel?: string;
    leftIcon?: React.ReactNode;
    rightLabel?: string;
    rightIcon?: React.ReactNode;
    disabled?: boolean;
    style?: any;
}

export const FloatingPill: React.FC<FloatingPillProps> = ({
    onBackPress,
    backIcon,
    leftLabel,
    leftIcon,
    rightLabel,
    rightIcon,
    disabled,
    style
}) => {

    return (
        <Animated.View
            entering={SlideInDown.springify()}
            style={[styles.floatingContainer, style]}
        >
            <LinearGradient
                colors={['#4c4a75', '#1e1b4b']}
                style={styles.gradientContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Back Button */}
                <TouchableOpacity style={styles.backPill} onPress={onBackPress}>
                    {backIcon}
                </TouchableOpacity>

                <View style={styles.dividerPill} />

                {/* Left Section */}
                {leftLabel && (
                    <View style={rightLabel ? styles.infoPill : styles.activePillItem}>
                        {leftIcon}
                        <Text style={[
                            styles.pillText,
                            rightLabel && { color: '#94a3b8' },
                            disabled && { color: 'rgba(255,255,255,0.5)' }
                        ]}>
                            {leftLabel}
                        </Text>
                    </View>
                )}

                {/* Right Section (Active) */}
                {rightLabel && (
                    <View style={styles.activePillItem}>
                        {rightIcon}
                        <Text style={styles.pillText}>
                            {rightLabel}
                        </Text>
                    </View>
                )}
            </LinearGradient>
        </Animated.View>
    );
}


const styles = StyleSheet.create({

    floatingContainer: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.45,
        shadowRadius: 15,
        elevation: 12,
    },

    gradientContainer: {
        flexDirection: 'row',
        borderRadius: 30,
        padding: 6,
        alignItems: 'center',
    },

    backPill: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },

    dividerPill: {
        width: 1.5,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginHorizontal: 4,
    },

    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
    },

    activePillItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(255,255,255,0.18)',
        height: 38,
        borderRadius: 22,
    },

    pillText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
    },
});