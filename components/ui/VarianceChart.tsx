import React, { useState } from "react";
import {
    View,
    Text,
    Dimensions,
    StyleSheet,
    Pressable,
} from "react-native";
import Animated, { FadeInLeft, FadeInRight, FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get("window");

export const VarianceChart = ({
    data = [],
    width: customWidth,
    title = "Variance by Warehouse",
    containerStyle,
}: {
    data?: any[];
    width?: number;
    title?: string;
    containerStyle?: any;
}) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const chartWidth = customWidth || Dimensions.get("window").width;

    const maxVal = Math.max(
        ...data.map(d =>
            Math.max(
                Math.abs(d.value?.positive || 0),
                Math.abs(d.value?.negative || 0)
            )
        ),
        1
    );

    const trackWidth = (chartWidth - 120) / 2;

    return (
        <View style={[styles.card, containerStyle]}>
            <Text style={styles.title}>{title}</Text>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                {data.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No warehouse variance recorded</Text>
                    </View>
                ) : (
                    <View style={[styles.wrapper, { width: '100%' }]}>
                        <View style={styles.horizontalLine} />

                        <View style={styles.verticalLine} />
                        {data.map((item, i) => {

                            const positive = item.value?.positive || 0;
                            const negative = item.value?.negative || 0;

                            const posWidth = (positive / maxVal) * trackWidth;
                            const negWidth = (negative / maxVal) * trackWidth;

                            return (
                                <Pressable
                                    key={i}
                                    style={styles.row}
                                    onPressIn={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setActiveIndex(i);
                                    }}
                                    onPressOut={() => setActiveIndex(null)}
                                >
                                    <Text style={styles.label}>{item.label}</Text>
                                    <View style={styles.chartArea}>

                                        <View style={styles.leftHalf}>
                                            <Animated.View
                                                entering={FadeInRight.duration(200)}
                                                style={[
                                                    styles.bar,
                                                    styles.negBar,
                                                    { width: negWidth }
                                                ]}
                                            />
                                        </View>
                                        <View style={styles.rightHalf}>
                                            <Animated.View
                                                entering={FadeInLeft.duration(200)}
                                                style={[
                                                    styles.bar,
                                                    styles.posBar,
                                                    { width: posWidth }
                                                ]}
                                            />
                                        </View>

                                    </View>

                                </Pressable>
                            );
                        })}

                        {/* Tooltip Overlay */}
                        {activeIndex !== null && (
                            <Animated.View
                                entering={FadeIn.duration(150)}
                                exiting={FadeOut.duration(150)}
                                style={[
                                    styles.tooltip,
                                    {
                                        top: activeIndex * 28 + 20,
                                        left: 100
                                    }
                                ]}
                            >
                                <Text style={styles.tooltipTitle}>{data[activeIndex].label}</Text>
                                <Text style={styles.tooltipPos}>
                                    positive : {data[activeIndex].value.positive}
                                </Text>
                                <Text style={styles.tooltipNeg}>
                                    negative : -{Math.abs(data[activeIndex].value.negative)}
                                </Text>
                            </Animated.View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#fff",
        borderRadius: 24,
        padding: 24,
        margin: 16,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },

    title: {
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 14,
        color: "#111827",
    },

    wrapper: {
        position: "relative",
    },
    horizontalLine: {

    },
    verticalLine: {
        position: "absolute",
        left: 80,   // align with label width
        top: 0,
        bottom: 0,
        width: 1,
        borderStyle: "solid",
        backgroundColor: "#e0e0e0"
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
    },

    label: {
        width: 80,
        fontSize: 12,
        color: "#6b7280",
    },

    chartArea: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },

    leftHalf: {
        flex: 1,
        alignItems: "flex-end",
        paddingRight: 2,
        marginTop: 20,
    },

    rightHalf: {
        flex: 1,
        alignItems: "flex-start",
        paddingLeft: 2,
    },

    bar: {
        height: 14,
        borderRadius: 7,
        minWidth: 6,
    },

    posBar: {
        backgroundColor: "#10b981",
    },

    negBar: {
        backgroundColor: "#f43f5e",
    },
    tooltip: {
        position: "absolute",
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
        minWidth: 110,
        zIndex: 10,
    },
    tooltipTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#0f172a",
        marginBottom: 8,
    },
    tooltipPos: {
        fontSize: 13,
        fontWeight: "500",
        color: "#10b981",
        marginBottom: 4,
    },
    tooltipNeg: {
        fontSize: 13,
        fontWeight: "500",
        color: "#ef4444",
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
    },
});