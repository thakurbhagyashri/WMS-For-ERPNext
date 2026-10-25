import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, {
    Path,
    Circle,
    G,
    Text as SvgText,
    Line,
    Rect,
    Defs,
    LinearGradient as SvgGradient,
    Stop,
} from "react-native-svg";
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing,
} from "react-native-reanimated";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const AccuracyTrendChart = ({
    width: customWidth,
    data = [],
    title = "Accuracy Trend (7 Days)",
    containerStyle,
}: {
    width?: number;
    data?: { day?: string; label?: string; value: number }[];
    title?: string;
    containerStyle?: any;
}) => {
    // Determine responsive card width
    const containerWidth = customWidth || (Dimensions.get("window").width - 32);
    const svgWidth = containerWidth - 40; // Subtract card horizontal padding
    const svgHeight = 180;

    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 25;
    const paddingBottom = 30;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    // Dynamic min and max calculations
    const validValues = data.map((d) => d.value).filter((v) => typeof v === "number" && !isNaN(v));
    const minData = validValues.length > 0 ? Math.min(...validValues) : 90;
    const maxData = validValues.length > 0 ? Math.max(...validValues) : 100;

    let minVal = Math.max(0, Math.floor(minData - 1));
    let maxVal = Math.min(100, Math.ceil(maxData + 1));
    if (minVal === maxVal) {
        minVal = Math.max(0, minVal - 5);
        maxVal = Math.min(100, maxVal + 5);
    }

    const gridTicks = [
        minVal,
        Math.round(minVal + (maxVal - minVal) * 0.33),
        Math.round(minVal + (maxVal - minVal) * 0.66),
        maxVal,
    ];

    const progress = useSharedValue(0);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    useEffect(() => {
        progress.value = withTiming(1, {
            duration: 1200,
            easing: Easing.out(Easing.cubic),
        });
    }, [data]);

    const getX = (index: number) => {
        if (data.length <= 1) return paddingLeft + chartWidth / 2;
        return paddingLeft + (index * chartWidth) / (data.length - 1);
    };

    const getY = (value: number) => {
        const clampedVal = Math.max(minVal, Math.min(maxVal, value));
        return svgHeight - paddingBottom - ((clampedVal - minVal) / (maxVal - minVal)) * chartHeight;
    };

    const d = data.length > 0 ? data.reduce((acc, point, i) => {
        const x = getX(i);
        const y = getY(point.value);
        return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, "") : "";

    const firstX = getX(0);
    const lastX = getX(data.length - 1);
    const bottomY = svgHeight - paddingBottom;
    const areaD = d ? `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z` : '';

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: (1 - progress.value) * 1000,
    }));

    return (
        <View style={[styles.container, containerStyle]}>
            <Text style={styles.title}>{title}</Text>

            <View style={styles.chartWrapper}>
                {data.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No accuracy records available</Text>
                    </View>
                ) : (
                    <Svg width={svgWidth} height={svgHeight}>
                        <Defs>
                            <SvgGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor="#7634bc" stopOpacity="0.35" />
                                <Stop offset="1" stopColor="#7634bc" stopOpacity="0.02" />
                            </SvgGradient>
                        </Defs>

                        {/* Y-Axis Gridlines */}
                        {gridTicks.map((val, idx) => {
                            const y = getY(val);
                            return (
                                <G key={`grid-${idx}-${val}`}>
                                    <Line
                                        x1={paddingLeft}
                                        y1={y}
                                        x2={svgWidth - paddingRight}
                                        y2={y}
                                        stroke="#f1f5f9"
                                        strokeWidth="1"
                                        strokeDasharray="4 4"
                                    />
                                    <SvgText
                                        x={paddingLeft - 8}
                                        y={y + 4}
                                        fontSize="10"
                                        fill="#94a3b8"
                                        textAnchor="end"
                                        fontWeight="500"
                                    >
                                        {val}%
                                    </SvgText>
                                </G>
                            );
                        })}

                        {/* Gradient Fill Under Trend */}
                        {areaD ? (
                            <Path
                                d={areaD}
                                fill="url(#trendGradient)"
                            />
                        ) : null}

                        {/* Active Vertical Pointer Line */}
                        {activeIndex !== null && (
                            <Line
                                x1={getX(activeIndex)}
                                x2={getX(activeIndex)}
                                y1={paddingTop}
                                y2={svgHeight - paddingBottom}
                                stroke="#7634bc"
                                strokeWidth={1.5}
                                strokeDasharray="3 3"
                            />
                        )}

                        {/* Trend Path */}
                        <AnimatedPath
                            d={d}
                            fill="none"
                            stroke="#7634bc"
                            strokeWidth="3.5"
                            strokeDasharray="1000"
                            animatedProps={animatedProps}
                        />

                        {/* Points & Tooltips */}
                        {data.map((point: any, i: number) => {
                            const x = getX(i);
                            const y = getY(point.value);
                            const isActive = activeIndex === i;
                            const tooltipWidth = 110;
                            const tooltipX = x + tooltipWidth + 10 > svgWidth ? x - tooltipWidth - 10 : x + 10;
                            const tooltipY = Math.max(5, y - 40);

                            return (
                                <G 
                                    key={i} 
                                    onPressIn={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setActiveIndex(activeIndex === i ? null : i);
                                    }}
                                >
                                    <Rect
                                        x={x - 20}
                                        y={0}
                                        width={40}
                                        height={svgHeight}
                                        fill="transparent"
                                    />

                                    <Circle
                                        cx={x}
                                        cy={y}
                                        r={isActive ? 6 : 4}
                                        fill={isActive ? "#7634bc" : "#fff"}
                                        stroke="#7634bc"
                                        strokeWidth="2.5"
                                    />

                                    {/* Active Point Tooltip */}
                                    {isActive && (
                                        <G pointerEvents="none">
                                            <Rect
                                                x={tooltipX}
                                                y={tooltipY}
                                                width={tooltipWidth}
                                                height={44}
                                                rx={8}
                                                fill="#0f172a"
                                                opacity={0.92}
                                            />

                                            <SvgText
                                                x={tooltipX + 10}
                                                y={tooltipY + 18}
                                                fontSize="10"
                                                fill="#94a3b8"
                                                fontWeight="600"
                                            >
                                                {point.day || point.label || `Day ${i + 1}`}
                                            </SvgText>

                                            <SvgText
                                                x={tooltipX + 10}
                                                y={tooltipY + 34}
                                                fontSize="12"
                                                fontWeight="700"
                                                fill="#ffffff"
                                            >
                                                Accuracy: {point.value}%
                                            </SvgText>
                                        </G>
                                    )}

                                    {/* X-axis Day/Date Label */}
                                    <SvgText
                                        x={x}
                                        y={svgHeight - 8}
                                        fontSize="10"
                                        fill="#64748b"
                                        textAnchor="middle"
                                        fontWeight="500"
                                    >
                                        {point.day || point.label || `D${i + 1}`}
                                    </SvgText>
                                </G>
                            );
                        })}
                    </Svg>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#fff",
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    title: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0f172a",
        marginBottom: 10,
    },
    chartWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    emptyState: {
        paddingVertical: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
    },
});