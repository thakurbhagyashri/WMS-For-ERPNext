import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNotifications } from '@/hooks/useNotifications';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    withRepeat,
    Easing
} from 'react-native-reanimated';

interface NotificationBellProps {
    color?: string;
    size?: number;
    showBackground?: boolean;
    style?: ViewStyle;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const NotificationBell = ({
    color = '#eab308',
    size = 22,
    showBackground = true,
    style,
}: NotificationBellProps) => {
    const router = useRouter();
    const { unreadCount } = useNotifications();

    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.6);

    useEffect(() => {
        // Continuous subtle ambient sway animation (gentle ring with natural pauses)
        rotation.value = withRepeat(
            withSequence(
                withTiming(-7, { duration: 250, easing: Easing.inOut(Easing.ease) }),
                withTiming(7, { duration: 250, easing: Easing.inOut(Easing.ease) }),
                withTiming(-5, { duration: 200, easing: Easing.inOut(Easing.ease) }),
                withTiming(5, { duration: 200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2200 })
            ),
            -1,
            false
        );

        if (unreadCount > 0) {
            pulseScale.value = withRepeat(
                withTiming(1.6, { duration: 1200 }),
                -1,
                false
            );
            pulseOpacity.value = withRepeat(
                withTiming(0, { duration: 1200 }),
                -1,
                false
            );
        }
    }, [unreadCount]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        scale.value = withSequence(
            withSpring(0.88, { damping: 10, stiffness: 300 }),
            withSpring(1, { damping: 12, stiffness: 200 })
        );

        // eslint-disable-next-line react-hooks/immutability
        rotation.value = withSequence(
            withTiming(-18, { duration: 80 }),
            withTiming(18, { duration: 80 }),
            withTiming(-12, { duration: 70 }),
            withTiming(12, { duration: 70 }),
            withTiming(-5, { duration: 60 }),
            withTiming(0, { duration: 60 })
        );

        router.push('/notifications');
    };

    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const animatedBellStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const animatedPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    return (
        <AnimatedTouchableOpacity
            style={[
                styles.container,
                showBackground && styles.backgroundStyle,
                style,
                animatedContainerStyle
            ]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            {showBackground && <View style={styles.glowRing} />}

            <Animated.View style={animatedBellStyle}>
                <Bell size={size} color={color} />
            </Animated.View>

            {unreadCount > 0 && (
                <View style={styles.badgeWrapper}>
                    <Animated.View style={[styles.pulseRing, animatedPulseStyle]} />
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                    </View>
                </View>
            )}
        </AnimatedTouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    backgroundStyle: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    glowRing: {
        ...StyleSheet.absoluteFill,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    badgeWrapper: {
        position: 'absolute',
        top: -2,
        right: -2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#ef4444',
    },
    badge: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#ffffff',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
        paddingHorizontal: 3,
    }
});

