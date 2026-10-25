import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
    runOnJS,
    cancelAnimation
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Warehouse, Package } from 'lucide-react-native';
import * as SplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('window');

interface Props {
    onAnimationComplete: () => void;
}

export default function AnimatedSplashScreen({ onAnimationComplete }: Props) {
    const opacity = useSharedValue(1);
    const scale = useSharedValue(0.5);
    const boxTranslateY = useSharedValue(-50);
    const boxOpacity = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(20);

    useEffect(() => {
        // Hide the native splash screen as soon as our custom one mounts
        SplashScreen.hideAsync().catch(() => { });

        // Main Warehouse Icon Scale Up
        scale.value = withSpring(1, { damping: 12, stiffness: 90 });

        // Box drops into the warehouse
        boxTranslateY.value = withDelay(
            400,
            withSpring(0, { damping: 12, stiffness: 100 })
        );
        boxOpacity.value = withDelay(
            400,
            withTiming(1, { duration: 500 })
        );

        // Text Fades In
        textOpacity.value = withDelay(
            800,
            withTiming(1, { duration: 800 })
        );
        textTranslateY.value = withDelay(
            800,
            withSpring(0, { damping: 12, stiffness: 100 })
        );

        // Fade out whole screen and call onAnimationComplete
        opacity.value = withDelay(
            2500,
            withTiming(0, { duration: 500 }, (finished) => {
                if (finished) {
                    runOnJS(onAnimationComplete)();
                }
            })
        );

        // Cleanup function to cancel animations if unmounted
        return () => {
            cancelAnimation(scale);
            cancelAnimation(boxTranslateY);
            cancelAnimation(boxOpacity);
            cancelAnimation(textOpacity);
            cancelAnimation(textTranslateY);
            cancelAnimation(opacity);
        };
    }, []);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const boxStyle = useAnimatedStyle(() => ({
        opacity: boxOpacity.value,
        transform: [{ translateY: boxTranslateY.value }],
        position: 'absolute',
        top: 25,
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textTranslateY.value }],
    }));

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            <LinearGradient
                colors={['#0f172a', '#1e1b4b', '#4f2735']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.content}>
                <Animated.View style={[styles.iconContainer, iconStyle]}>
                    <Warehouse size={100} color="rgba(255,255,255,0.9)" strokeWidth={1.5} />
                    <Animated.View style={boxStyle}>
                        <Package size={40} color="#38bdf8" strokeWidth={2} fill="rgba(56, 189, 248, 0.2)" />
                    </Animated.View>
                </Animated.View>

                <Animated.View style={[styles.textContainer, textStyle]}>
                    <Text style={styles.title}>WMS for ERPNext</Text>
                    <Text style={styles.subtitle}>Intelligent Warehouse Management</Text>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFill,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 160,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 42,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -1,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
        letterSpacing: 0.5,
    }
});
