import React from "react";
import { View, Dimensions, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { TrendingUp } from "lucide-react-native";
const { width } = Dimensions.get("window");

export type StatCardProps = {
    title: string;
    value: string;
    change?: number;
    isPositive?: boolean;
    Icon: React.ComponentType<any>;
    color: string;
    index: number;
    containerStyle?: any;
    subtitle?: string;
};

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    change,
    isPositive = true,
    Icon,
    color,
    index,
    containerStyle,
    subtitle = "vs last month"
}) => {
    return (
        <Animated.View
            entering={FadeInDown.delay(index * 100).duration(800)}
            style={[styles.statCard, containerStyle]}
        >
            <View style={styles.statHeader}>
                <Text style={styles.statTitle}>{title}</Text>
                <View style={[styles.statIconContainer, color ? { backgroundColor: color + '15' } : undefined]}>
                    <Icon size={18} color={color || "#64748b"} />
                </View>
            </View>

            <Text style={styles.statValue}>{value}</Text>

            {change !== undefined && (
                <View style={styles.statFooter}>
                    <View style={[styles.statBadge, isPositive ? styles.statBadgePositive : styles.statBadgeNegative]}>
                        <TrendingUp
                            size={10}
                            color={isPositive ? "#10b981" : "#ef4444"}
                            style={{ transform: [{ rotate: isPositive ? '0deg' : '180deg' }] }}
                        />
                        <Text style={[styles.statBadgeText, isPositive ? styles.statBadgeTextPositive : styles.statBadgeTextNegative]}>
                            {change}%
                        </Text>
                    </View>
                    {subtitle ? (
                        <Text style={styles.statFooterText} numberOfLines={1}>{subtitle}</Text>
                    ) : null}
                </View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    statCard: {
        width: (width - 52) / 2,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 6,
        borderWidth: 0,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    statTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#94a3b8',
        letterSpacing: 0.5,
        flex: 1,
        textTransform: 'uppercase',
        marginRight: 8,
    },
    statIconContainer: {
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 15,
    },
    statFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 4,
    },
    statBadgePositive: {
        backgroundColor: '#f0fdf4',
    },
    statBadgeNegative: {
        backgroundColor: '#fef2f2',
    },
    statBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    statBadgeTextPositive: {
        color: '#16a34a',
    },
    statBadgeTextNegative: {
        color: '#dc2626',
    },
    statFooterText: {
        fontSize: 9,
        color: '#94a3b8',
        flexShrink: 1,
    },
});