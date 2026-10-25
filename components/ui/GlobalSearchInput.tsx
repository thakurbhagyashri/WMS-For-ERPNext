import React, { useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { Search, X, ScanBarcode } from 'lucide-react-native';
import { DotsLoader } from '../DotsLoader';

interface GlobalSearchInputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onScan?: () => void;
    containerStyle?: StyleProp<ViewStyle>;
    autoFocus?: boolean;
    onSubmitEditing?: () => void;
    isSearching?: boolean;
    editable?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
}

export const GlobalSearchInput: React.FC<GlobalSearchInputProps> = ({
    value,
    onChangeText,
    placeholder = "Search...",
    onScan,
    containerStyle,
    autoFocus,
    onSubmitEditing,
    isSearching,
    editable = true,
    onFocus,
    onBlur
}) => {
    const inputRef = useRef<TextInput>(null);
    const [focused, setFocused] = React.useState(false);

    return (
        <View style={[
            styles.container,
            focused && styles.containerFocused,
            containerStyle,
            !editable && { opacity: 0.6 }
        ]}>
            <Search size={20} color={focused ? "#7634bc" : "#64748b"} style={styles.searchIcon} />
            
            <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor="#64748b"
                value={value}
                onChangeText={onChangeText}
                autoFocus={autoFocus}
                returnKeyType="search"
                onSubmitEditing={onSubmitEditing}
                editable={editable}
                onFocus={() => {
                    setFocused(true);
                    onFocus?.();
                }}
                onBlur={() => {
                    setFocused(false);
                    onBlur?.();
                }}
            />
            
            {isSearching && (
                <View style={{ marginRight: 10 }}>
                    <DotsLoader color="#0f172a" />
                </View>
            )}
            
            {value.length > 0 && (
                <TouchableOpacity 
                    style={styles.iconButton} 
                    onPress={() => onChangeText('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Clear search text"
                >
                    <View style={styles.clearBadge}>
                        <X size={14} color="#fff" />
                    </View>
                </TouchableOpacity>
            )}

            {onScan && (
                <>
                    <View style={styles.divider} />
                    <TouchableOpacity 
                        style={styles.iconButton} 
                        onPress={onScan}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Scan barcode"
                    >
                        <ScanBarcode size={22} color="#7634bc" />
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 12,
        height: 52,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    containerFocused: {
        borderColor: '#7634bc',
        borderWidth: 1.5,
        shadowColor: '#7634bc',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    searchIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        color: '#0f172a',
        fontWeight: Platform.OS === 'ios' ? '500' : 'normal',
    },
    iconButton: {
        padding: 6,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 36,
        minHeight: 36,
    },
    clearBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#64748b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 8,
    }
});
