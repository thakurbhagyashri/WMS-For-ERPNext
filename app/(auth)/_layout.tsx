import { useTranslation } from 'react-i18next';
import { Stack } from 'expo-router';

export default function AuthLayout() {
    const { t } = useTranslation();
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ title: 'Login' }} />
        </Stack>
    );
}
