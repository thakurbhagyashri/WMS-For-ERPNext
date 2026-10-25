import { useTranslation } from 'react-i18next';
import { Redirect } from 'expo-router';

export default function Index() {
    const { t } = useTranslation();
    // Logic to check if user is logged in
    const isLoggedIn = false; // Placeholder

    if (isLoggedIn) {
        return <Redirect href="/(tabs)" />;
    }

    return <Redirect href="/(auth)/login" />;
}
