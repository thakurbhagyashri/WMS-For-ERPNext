import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
} from "react-native-reanimated";
import { Fonts } from "@/constants/theme";

import * as Haptics from 'expo-haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const VIBRANT_CHART_COLORS = [
    '#8b5cf6', // Electric Purple
    '#3b82f6', // Ocean Blue
    '#10b981', // Emerald Green
    '#ec4899', // Hot Pink
    '#f59e0b', // Amber Gold
    '#06b6d4', // Cyan
    '#f97316', // Coral Orange
];

export type DonutDataItem = {
    label: string;
    value: number;
    color: string;
};

type Props = {
    data: DonutDataItem[];
    size?: number;
    strokeWidth?: number;
};

export function DonutSlice({
    item,
    total,
    circumference,
    progress,
    radius,
    size,
    strokeWidth,
    rotate,
    isSelected,
    onPress
}: any) {
    const percentage = total > 0 ? item.value / total : 0;
    const strokeDasharray = circumference;

    const animatedProps = useAnimatedProps(() => {
        return {
            strokeDashoffset:
                circumference -
                progress.value * (circumference * percentage),
        };
    });

    const activeWidth = isSelected ? strokeWidth + 5 : strokeWidth;

    return (
        <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={item.value > 0 ? item.color : "transparent"}
            strokeWidth={activeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            animatedProps={animatedProps}
            transform={`rotate(${rotate}, ${size / 2}, ${size / 2})`}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
        />
    );
};

export const DonutChart = ({
    data,
    size = 120,
    strokeWidth = 20,
}: Props) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Apply vibrant fallback colors if color is generic or missing
    const colorfulData = data.map((d, idx) => ({
        ...d,
        color: d.color && d.color !== '#000000' && d.color !== '#ffffff'
            ? d.color
            : VIBRANT_CHART_COLORS[idx % VIBRANT_CHART_COLORS.length]
    }));

    const total = colorfulData.reduce((sum, d) => sum + d.value, 0);

    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withTiming(1, { duration: 1200 });
    }, [data, progress]);

    const selectedItem = selectedIndex !== null ? colorfulData[selectedIndex] : null;
    const selectedPercent = selectedItem && total > 0 ? Math.round((selectedItem.value / total) * 100) : 0;

    return (
        <View style={styles.container}>
            {/* Left Column: Donut Chart SVG with Center Hole */}
            <View style={styles.leftChartSection}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (colorfulData.length === 0) return;
                        if (selectedIndex === null) setSelectedIndex(0);
                        else if (selectedIndex < colorfulData.length - 1) setSelectedIndex(selectedIndex + 1);
                        else setSelectedIndex(null);
                    }}
                    style={[styles.chartWrapper, { width: size, height: size }]}
                >
                    <Svg width={size} height={size} style={{ overflow: 'visible' }}>
                        <G transform={`translate(${size / 2}, ${size / 2}) scale(1, -1) rotate(-90) translate(-${size / 2}, -${size / 2})`}>
                            <Circle
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                stroke="#f1f5f9"
                                strokeWidth={strokeWidth}
                                fill="none"
                            />
                            {colorfulData.map((item, index) => {
                                const currentCumulative = colorfulData.slice(0, index).reduce((acc, curr) => acc + curr.value, 0);
                                const rotate = total > 0 ? (currentCumulative / total) * 360 : 0;
                                const isSelected = selectedIndex === index;

                                return (
                                    <DonutSlice
                                        key={index}
                                        item={item}
                                        total={total}
                                        circumference={circumference}
                                        progress={progress}
                                        radius={radius}
                                        size={size}
                                        strokeWidth={strokeWidth}
                                        rotate={rotate}
                                        isSelected={isSelected}
                                        onPress={() => setSelectedIndex(isSelected ? null : index)}
                                    />
                                );
                            })}
                        </G>
                    </Svg>

                    <View style={styles.centerHole} pointerEvents="none" />
                </TouchableOpacity>
            </View>

            {/* Right Column: Legend List & Note */}
            <View style={styles.rightLegendWrapper}>
                <View style={styles.instructionNoteBadge}>
                    <Text style={styles.instructionNoteText} numberOfLines={2}>
                        {selectedItem ? `Section: ${selectedItem.label} (${selectedPercent}%)` : '💡 Click on chart section to see full information'}
                    </Text>
                </View>

                <ScrollView
                    style={styles.legendScroll}
                    contentContainerStyle={styles.legendContainer}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                >
                    {colorfulData.map((item, index) => {
                        const isSelected = selectedIndex === index;
                        const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
                        return (
                            <TouchableOpacity
                                key={index}
                                activeOpacity={0.7}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setSelectedIndex(isSelected ? null : index);
                                }}
                                style={[styles.legendItem, isSelected && styles.legendItemSelected]}
                            >
                                <View style={styles.legendLeft}>
                                    <View
                                        style={[
                                            styles.colorDot,
                                            { backgroundColor: item.color },
                                            isSelected && styles.colorDotSelected,
                                        ]}
                                    />
                                    <Text style={[styles.legendLabel, isSelected && styles.legendLabelSelected]} numberOfLines={1}>
                                        {item.label}
                                    </Text>
                                </View>
                                <Text style={[styles.legendValue, isSelected && styles.legendValueSelected]}>
                                    {percent}%
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        paddingHorizontal: 4,
        width: '100%',
        overflow: 'hidden',
    },
    chartWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    centerHole: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
    },
    centerValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    centerLabel: {
        fontSize: 10,
        color: '#64748b',
        fontFamily: Fonts.sans,
        textAlign: 'center',
        maxWidth: 65,
    },
    centerSubtext: {
        fontSize: 9,
        fontWeight: '600',
        color: '#7634bc',
        fontFamily: Fonts.sans,
        textAlign: 'center',
    },
    centerHintText: {
        fontSize: 8,
        color: '#94a3b8',
        fontFamily: Fonts.sans,
        fontStyle: 'italic',
        marginTop: 1,
    },
    leftChartSection: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    rightLegendWrapper: {
        flex: 1,
        marginLeft: 10,
        height: 140,
        justifyContent: 'flex-start',
    },
    instructionNoteBadge: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginBottom: 6,
    },
    instructionNoteText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
        fontFamily: Fonts.sans,
    },
    legendScroll: {
        flex: 1,
        width: '100%',
    },
    legendContainer: {
        gap: 6,
        paddingRight: 4,
    },
    legendItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: '100%',
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: 6,
    },
    legendItemSelected: {
        backgroundColor: '#f1f5f9',
    },
    legendLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        paddingRight: 6,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    colorDotSelected: {
        transform: [{ scale: 1.3 }],
    },
    legendLabel: {
        fontSize: 12,
        color: "#64748b",
        fontWeight: "500",
        fontFamily: Fonts.sans,
        flexShrink: 1,
    },
    legendLabelSelected: {
        color: '#0f172a',
        fontWeight: '700',
    },
    legendValue: {
        fontSize: 12,
        color: "#1e293b",
        fontWeight: "700",
        fontFamily: Fonts.sans,
    },
    legendValueSelected: {
        color: '#7634bc',
    },
});