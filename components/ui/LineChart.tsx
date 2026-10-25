import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Path, Circle, Line, G } from "react-native-svg";
import { Fonts } from "../../constants/theme";

export type LineChartSeries = {
    name: string;
    color: string;
    dataKey: string;
};

export type LineChartProps = {
    data: any[];
    series: LineChartSeries[];
    title?: string;
};

export const LineChart = ({ data, series, title }: LineChartProps) => {
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

    if (!data || data.length === 0) return null;

    // We assume X values are equally distributed and Y scale is 0-100.
    const getY = (val: number) => 160 - (val / 100) * 160;
    const xStep = 300 / (data.length - 1 || 1);
    const hitBoxWidth = 100 / (data.length || 1);

    return (
        <View style={styles.chartContainer}>
            {!!title ? <Text style={styles.chartTitle}>{title}</Text> : null}
            <View style={styles.lineChartWrapper}>
                <View style={styles.lineChartYAxis}>
                    {['100', '75', '50', '25', '0'].map((l) => (
                        <Text key={l} style={styles.lineChartYAxisText}>{l}</Text>
                    ))}
                </View>
                <View style={styles.lineChartMain}>
                    <Svg viewBox="0 0 300 160" width="100%" height={160} style={{ overflow: 'visible' }}>
                        {/* Horizontal Grid Lines */}
                        {[0, 40, 80, 120, 160].map((y) => (
                            <Line key={`grid-${y}`} x1="0" y1={y} x2="300" y2={y} stroke="#f1f5f9" strokeWidth="1.5" strokeDasharray="4 4" />
                        ))}
                        
                        {/* Vertical Grid Lines */}
                        {data.map((_, i) => {
                            const x = i * xStep;
                            return (
                                <Line key={`vgrid-${i}`} x1={x} y1="0" x2={x} y2="160" stroke="#f1f5f9" strokeWidth="1.5" strokeDasharray="4 4" />
                            )
                        })}
                        
                        <G>
                            {/* Lines */}
                            {series.map((s, idx) => (
                                <Path 
                                    key={`path-${idx}`}
                                    d={`M ${data.map((d, i) => `${(i * xStep)} ${getY(d[s.dataKey])}`).join(' L ')}`} 
                                    fill="none" 
                                    stroke={s.color} 
                                    strokeWidth="2.5" 
                                />
                            ))}
                            
                            {/* Data Points */}
                            {data.map((d, i) => (
                                <React.Fragment key={`points-${i}`}>
                                    {series.map((s, sIdx) => (
                                        <Circle 
                                            key={`point-${i}-${sIdx}`}
                                            cx={i * xStep} 
                                            cy={getY(d[s.dataKey])} 
                                            r="4.5" 
                                            fill="#fff" 
                                            stroke={s.color} 
                                            strokeWidth="2.5" 
                                        />
                                    ))}
                                </React.Fragment>
                            ))}
                        </G>
                    </Svg>

                    {/* Touch Overlay Hitboxes */}
                    <View style={StyleSheet.absoluteFill}>
                        {data.map((_, i) => (
                            <TouchableOpacity
                                key={`hitbox-${i}`}
                                style={{
                                    position: "absolute",
                                    left: `${i * hitBoxWidth}%`,
                                    top: 0,
                                    bottom: 0,
                                    width: `${hitBoxWidth}%`,
                                    zIndex: 10,
                                }}
                                onPress={() => setSelectedPoint(selectedPoint === i ? null : i)}
                            />
                        ))}
                    </View>

                    {/* Tooltip */}
                    {selectedPoint !== null && data[selectedPoint] && (() => {
                        const d = data[selectedPoint];
                        const isLast = selectedPoint === data.length - 1;
                        return (
                            <View 
                                style={[
                                    styles.tooltipBox, 
                                    isLast ? { right: 0 } : { left: `${selectedPoint * hitBoxWidth}%`, marginLeft: 15 }
                                ]}
                            >
                                <Text style={styles.tooltipTitle}>{d.label}</Text>
                                {series.map((s, idx) => (
                                    <Text key={`tt-${idx}`} style={[styles.tooltipText, { color: s.color, marginBottom: idx === series.length - 1 ? 0 : 4 }]}>
                                        {s.name} : {d[s.dataKey]}
                                    </Text>
                                ))}
                            </View>
                        );
                    })()}
                    
                    {/* X-Axis Labels */}
                    <View style={styles.lineChartXAxis}>
                        {data.map((d, i) => (
                            <View key={`xlabel-${i}`} style={[styles.lineChartXAxisLabel, { left: `${(i / (data.length - 1 || 1)) * 100}%` }]}>
                                <Text style={[styles.lineChartXAxisText, selectedPoint === i && { fontWeight: 'bold', color: '#0f172a' }]}>
                                    {d.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
            
            {/* Legend */}
            <View style={styles.lineChartLegend}>
                {series.map((s, idx) => (
                    <View key={`legend-${idx}`} style={styles.lineChartLegendItem}>
                        <View style={styles.legendIconWrapper}>
                            <View style={[styles.legendIconLine, { backgroundColor: s.color }]} />
                            <View style={[styles.legendIconCircle, { borderColor: s.color }]} />
                        </View>
                        <Text style={[styles.lineChartLegendText, { color: s.color }]}>{s.name}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    chartContainer: {
        width: '100%',
        backgroundColor: 'transparent',
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#0f172a",
        marginBottom: 15,
        fontFamily: Fonts.sans,
    },
    lineChartWrapper: {
        flexDirection: "row",
        height: 180,
        marginTop: 10,
        marginBottom: 20,
    },
    lineChartYAxis: {
        width: 25,
        height: 160,
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingRight: 6,
    },
    lineChartYAxisText: {
        fontSize: 9,
        color: "#94a3b8",
        fontFamily: Fonts.sans,
    },
    lineChartMain: {
        flex: 1,
        height: 160,
        position: "relative",
    },
    lineChartXAxis: {
        position: "absolute",
        bottom: -20,
        left: 0,
        right: 0,
        height: 20,
    },
    lineChartXAxisLabel: {
        position: "absolute",
        transform: [{ translateX: "-50%" }],
        alignItems: "center",
    },
    lineChartXAxisText: {
        fontSize: 9,
        color: "#94a3b8",
        fontFamily: Fonts.sans,
    },
    lineChartLegend: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 15,
        gap: 20,
    },
    lineChartLegendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    legendIconWrapper: {
        width: 20,
        height: 10,
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
    },
    legendIconLine: {
        position: "absolute",
        left: 0,
        right: 0,
        height: 2,
    },
    legendIconCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        backgroundColor: "#fff",
        zIndex: 1,
    },
    lineChartLegendText: {
        fontSize: 11,
        fontWeight: "bold",
        fontFamily: Fonts.sans,
    },
    tooltipBox: {
        position: "absolute",
        top: 20,
        backgroundColor: "#fff",
        padding: 10,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 100,
        borderWidth: 1,
        borderColor: "#f1f5f9",
    },
    tooltipTitle: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#0f172a",
        marginBottom: 6,
        fontFamily: Fonts.sans,
    },
    tooltipText: {
        fontSize: 11,
        fontWeight: "600",
        fontFamily: Fonts.sans,
    },
});
