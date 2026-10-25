import React, { useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, Platform } from 'react-native';

export interface AppTextInputProps extends TextInputProps {
    error?: boolean;
}

export function AppTextInput({ style, error, onFocus, onBlur, ...props }: AppTextInputProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <TextInput
            style={[
                style,
                isFocused && styles.focused,
                error && styles.error
            ]}
            onFocus={(e) => {
                setIsFocused(true);
                onFocus?.(e);
            }}
            onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
            }}
            selectionColor="#7634bc"
            {...props}
        />
    );
}

const styles = StyleSheet.create({
    focused: {
        borderColor: '#7634bc',
        borderWidth: 1.5,
        backgroundColor: '#fff',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
                boxShadow: '0 0 0 2px rgba(118, 52, 188, 0.2)',
            } as any,
        }),
    },
    error: {
        borderColor: '#ef4444',
        borderWidth: 1.5,
        backgroundColor: '#fef2f2',
    }
});
