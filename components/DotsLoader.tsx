import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

interface DotsLoaderProps {
    color?: string;
    size?: number;
    style?: ViewStyle;
}

export const DotsLoader: React.FC<DotsLoaderProps> = ({
    color = '#7634bc', // Default to app theme color
    size = 12,
    style
}) => {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
        const animateDot = (dot: any, delay: number) => {
            dot.value = withDelay(
                delay,
                withRepeat(
                    withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
                    -1,
                    true
                )
            );
        };

        animateDot(dot1, 0);
        animateDot(dot2, 150);
        animateDot(dot3, 300);
    }, []);

    const style1 = useAnimatedStyle(() => ({
        transform: [{ translateY: dot1.value * -8 }, { scale: 0.8 + (dot1.value * 0.4) }],
        opacity: 0.3 + (dot1.value * 0.7),
    }));

    const style2 = useAnimatedStyle(() => ({
        transform: [{ translateY: dot2.value * -8 }, { scale: 0.8 + (dot2.value * 0.4) }],
        opacity: 0.3 + (dot2.value * 0.7),
    }));

    const style3 = useAnimatedStyle(() => ({
        transform: [{ translateY: dot3.value * -8 }, { scale: 0.8 + (dot3.value * 0.4) }],
        opacity: 0.3 + (dot3.value * 0.7),
    }));

    const dotStyle = {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
    };

    return (
        <View style={[styles.container, style]}>
            <Animated.View style={[dotStyle, style1]} />
            <Animated.View style={[dotStyle, style2, styles.middleDot]} />
            <Animated.View style={[dotStyle, style3]} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
    },
    middleDot: {
        marginHorizontal: 8,
    },
});
