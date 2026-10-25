import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { MASTER_SITE_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useCompanyContext } from '@/context/CompanyContext';
import { useWarehouseContext } from '@/context/WarehouseContext';
import { useFrappe } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { changeLanguage } from '@/utils/i18n';
import { storage } from '@/utils/storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    Building2,
    Camera,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Folder,
    Globe,
    Lock,
    LogOut,
    Mail,
    MapPin,
    Phone,
    Save,
    Settings as SettingsIcon,
    Trash2,
    User
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const SettingItem = ({ icon: Icon, label, value, onPress, showChevron = true, danger = false, highlighted = false }: any) => (
    <TouchableOpacity
        style={[
            styles.settingItem,
            highlighted && { backgroundColor: '#faf5ff', marginHorizontal: 4, marginVertical: 2, borderRadius: 12, paddingHorizontal: 12 }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[
            styles.settingIconBg,
            danger ? styles.dangerIconBg : (highlighted ? { backgroundColor: '#f3e8ff' } : { backgroundColor: '#1e1b4b10' })
        ]}>
            <Icon size={20} color={danger ? "#ef4444" : (highlighted ? "#7634bcff" : "#1e1b4b")} />
        </View>
        <View style={styles.settingContent}>
            <Text style={[
                styles.settingLabel,
                danger ? styles.dangerText : undefined,
                highlighted && { color: '#7634bcff', fontWeight: '700' }
            ]}>{label}</Text>
            {!!value ? <Text style={[
                styles.settingValue,
                highlighted && { color: '#4c4a75' }
            ]}>{value}</Text> : null}
        </View>
        {!!showChevron ? <ChevronRight size={18} color={highlighted ? "#7634bcff" : "#94a3b8"} /> : null}
    </TouchableOpacity>
);

const LANGUAGE_OPTIONS = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'mr', name: 'मराठी' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ' },
    { code: 'bn', name: 'বাংলা' },
    { code: 'gu', name: 'ગુજરાતી' },
    { code: 'fr', name: 'French' }
];

export default function SettingsScreen() {

    const router = useRouter();
    // Master site hook (useDynamicConfig=false) — always hits qalogistic for profile data
    const { getResource: getMasterResource, putResource: putMasterResource, getCurrentUserEmail, callMethod: callMasterMethod } = useFrappe(MASTER_SITE_CONFIG, false);
    const { logout, loading, baseUrl, company } = useFrappe(MASTER_SITE_CONFIG, true);
    const { showSuccess, showError } = useToast();

    const { activeCompany, companies, setActiveCompany } = useCompanyContext();
    const { activeWarehouse, warehouses, setActiveWarehouse } = useWarehouseContext();
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { t, i18n } = useTranslation();

    const pulseAnim = useSharedValue(1);

    useEffect(() => {
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const animatedPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
        opacity: 1.5 - pulseAnim.value,
    }));

    const [userData, setUserData] = useState<any>(null);
    const [editedData, setEditedData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        mobile_no: '',
        new_password: '',
    });
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isDynamicSync, setIsDynamicSync] = useState(false);
    const [displayUrl, setDisplayUrl] = useState('');
    const [availableSites, setAvailableSites] = useState<any[]>([]);
    const [showSiteModal, setShowSiteModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSwitchingSite, setIsSwitchingSite] = useState(false);
    const [switchingSiteUrl, setSwitchingSiteUrl] = useState('');
    const [mainScrollEnabled, setMainScrollEnabled] = useState(true);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchUserDetails();
        setRefreshing(false);
    };

    useEffect(() => {
        const loadConfig = async () => {
            const savedUrl = await storage.getItem('dynamic_base_url');
            const savedSites = await storage.getItem('user_available_sites');
            if (savedSites) {
                try {
                    setAvailableSites(JSON.parse(savedSites));
                } catch (e) { }
            }
            setDisplayUrl(savedUrl || MASTER_SITE_CONFIG.baseUrl);
            setIsDynamicSync(!!savedUrl && savedUrl !== MASTER_SITE_CONFIG.baseUrl);
        };
        loadConfig();
    }, [baseUrl]);

    const handleSwitchSite = async (site: any) => {
        if (!site.custom_erpnext_url || !site.custom_api || !site.custom_api_secret) return;
        setShowSiteModal(false);
        setIsSwitchingSite(true);
        setSwitchingSiteUrl(site.custom_erpnext_url);

        // Add a slight delay to show the beautiful switching UI
        setTimeout(async () => {
            try {
                // Verify credentials before applying the switch
                const url = site.custom_erpnext_url.endsWith('/') ? site.custom_erpnext_url.slice(0, -1) : site.custom_erpnext_url;
                const response = await fetch(`${url}/api/method/frappe.auth.get_logged_user`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `token ${site.custom_api}:${site.custom_api_secret}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Authentication failed');
                }

                await storage.setItem('dynamic_base_url', site.custom_erpnext_url);
                await storage.setItem('dynamic_api_key', site.custom_api);
                await storage.setItem('dynamic_api_secret', site.custom_api_secret);
                if (site.customer_name) {
                    await storage.setItem('dynamic_company', site.customer_name);
                } else if (site.name) {
                    await storage.setItem('dynamic_company', site.name);
                }
                setIsSwitchingSite(false);
                showSuccess(t('server_url_updated', 'Server URL updated successfully'));
                fetchUserDetails();
            } catch (error) {
                setIsSwitchingSite(false);
                Alert.alert(
                    "Access Denied",
                    "You no longer have access to this site. Please contact your administrator.",
                    [{ text: "OK", style: "default" }]
                );
            }
        }, 1500);
    };

    const fetchUserDetails = useCallback(async () => {
        try {
            const email = await getCurrentUserEmail();
            const savedUserInfo = await storage.getItem('user_info');
            const savedRole = await storage.getItem('user_role');

            let parsedUserInfo: any = null;
            if (savedUserInfo) {
                try {
                    parsedUserInfo = JSON.parse(savedUserInfo);
                    if (savedRole && !parsedUserInfo.role) {
                        parsedUserInfo.role = savedRole;
                    }
                    setUserData(parsedUserInfo);
                    setEditedData({
                        first_name: parsedUserInfo.first_name || parsedUserInfo.full_name || '',
                        last_name: parsedUserInfo.last_name || '',
                        email: parsedUserInfo.email || email || '',
                        mobile_no: parsedUserInfo.mobile_no || '',
                        new_password: '',
                    });
                } catch (e) { }
            }

            if (email && email !== 'Guest') {
                try {
                    const user = await getMasterResource('User', email, undefined, false, undefined, true);
                    if (user) {
                        setUserData((prev: any) => ({ ...prev, ...user, role: user.role || prev?.role || savedRole }));
                        setEditedData((prev) => ({
                            ...prev,
                            first_name: user.first_name || prev.first_name || '',
                            last_name: user.last_name || prev.last_name || '',
                            email: user.email || prev.email || '',
                            mobile_no: user.mobile_no || prev.mobile_no || '',
                        }));
                    }
                } catch (apiErr) {
                    if (!parsedUserInfo) {
                        setEditedData((prev) => ({
                            ...prev,
                            email: email,
                            first_name: email.split('@')[0],
                        }));
                    }
                }
            }
        } catch (error) {
            console.error('Error in fetchUserDetails:', error);
        }
    }, [getMasterResource, getCurrentUserEmail]);

    useEffect(() => {
        fetchUserDetails();
    }, [fetchUserDetails]);

    const performLogout = async () => {
        setShowLogoutModal(false);
        setIsLoggingOut(true);
        try {
            await logout();
            router.replace('/(auth)/login');
        } catch (err) {
            console.error('[Settings] Logout error:', err);
            router.replace('/(auth)/login');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleLogout = () => {
        setShowLogoutModal(true);
    };

    const toggleCompanyModal = () => {
        setShowWarehouseModal(false);
        setShowSiteModal(false);
        setShowLanguageModal(false);
        setShowCompanyModal(prev => !prev);
    };
    const toggleWarehouseModal = () => {
        setShowCompanyModal(false);
        setShowSiteModal(false);
        setShowLanguageModal(false);
        setShowWarehouseModal(prev => !prev);
    };
    const toggleSiteModal = () => {
        setShowCompanyModal(false);
        setShowWarehouseModal(false);
        setShowLanguageModal(false);
        setShowSiteModal(prev => !prev);
    };
    const toggleLanguageModal = () => {
        setShowCompanyModal(false);
        setShowWarehouseModal(false);
        setShowSiteModal(false);
        setShowLanguageModal(prev => !prev);
    };

    const handleSave = async () => {
        const targetEmail = userData?.email || editedData.email;
        if (!targetEmail) return;
        setSaving(true);
        try {
            const updatePayload: any = {
                first_name: editedData.first_name,
                last_name: editedData.last_name,
                email: editedData.email,
                mobile_no: editedData.mobile_no,
            };
            if (editedData.new_password) {
                updatePayload.new_password = editedData.new_password;
            }
            await putMasterResource('User', targetEmail, updatePayload);
            showSuccess(t('profile_updated_successfully', 'Profile updated successfully'));
            fetchUserDetails();
        } catch (error: any) {
            showError(error.message || t('failed_to_update_profile', 'Failed to update profile'));
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async () => {
        const targetEmail = userData?.email || editedData.email;
        if (!targetEmail) return;

        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showError(t('permission_denied', 'Permission to access gallery is required'));
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];

                setSaving(true);
                showSuccess(t('uploading', 'Uploading image...'));

                const formData = new FormData();
                const filename = asset.uri.split('/').pop() || 'avatar.jpg';

                formData.append('file', {
                    uri: asset.uri,
                    name: filename,
                    type: 'image/jpeg'
                } as any);
                formData.append('is_private', '0');
                formData.append('folder', 'Home/Attachments');
                formData.append('doctype', 'User');
                formData.append('docname', targetEmail);

                const baseUrlToUse = MASTER_SITE_CONFIG.baseUrl.endsWith('/')
                    ? MASTER_SITE_CONFIG.baseUrl.slice(0, -1)
                    : MASTER_SITE_CONFIG.baseUrl;

                const url = `${baseUrlToUse}/api/method/upload_file`;

                const headers: any = {
                    'Accept': 'application/json',
                    'Authorization': `token ${MASTER_SITE_CONFIG.apiKey}:${MASTER_SITE_CONFIG.apiSecret}`
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: formData,
                });

                const responseData = await response.json();

                if (!response.ok) {
                    throw new Error(responseData.message || 'Image upload failed');
                }

                const fileUrl = responseData.message?.file_url || responseData.data?.file_url || responseData.file_url;

                if (!fileUrl) {
                    throw new Error('Failed to retrieve file URL');
                }

                await putMasterResource('User', targetEmail, {
                    user_image: fileUrl
                });

                showSuccess(t('profile_updated_successfully', 'Profile picture updated!'));
                fetchUserDetails();
            }
        } catch (error: any) {
            console.error('Image upload error:', error);
            showError(error.message || t('failed_to_update_profile', 'Failed to upload image'));
        } finally {
            setSaving(false);
        }
    };

    if (loading && !userData && !syncing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4c4a75" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Modal visible={isLoggingOut} transparent={true} statusBarTranslucent={true} animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.95)', justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#4c4a75" />
                    <Text style={{ marginTop: 16, color: '#4c4a75', fontSize: 18, fontWeight: '600', fontFamily: Fonts.sans }}>
                        {t('logging_out', 'Securely signing out...')}
                    </Text>
                </View>
            </Modal>

            <Modal visible={isSwitchingSite} transparent={true} statusBarTranslucent={true} animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
                    <View style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 28,
                        paddingVertical: 32,
                        paddingHorizontal: 24,
                        alignItems: 'center',
                        width: '100%',
                        maxWidth: 340,
                        shadowColor: '#7634bc',
                        shadowOffset: { width: 0, height: 12 },
                        shadowOpacity: 0.25,
                        shadowRadius: 24,
                        elevation: 12,
                    }}>
                        <View style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: '#f5f3ff',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 20,
                            borderWidth: 1,
                            borderColor: '#ddd6fe',
                        }}>
                            <ActivityIndicator size="large" color="#7634bc" />
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a', fontFamily: Fonts.sans, marginBottom: 8, textAlign: 'center' }}>
                            {t('switching_tenant', 'Switching Server...')}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#64748b', fontFamily: Fonts.sans, textAlign: 'center', lineHeight: 20 }}>
                            {t('switching_message', 'Reconfiguring app connection to ')}
                            <Text style={{ fontWeight: '700', color: '#7634bc' }}>{switchingSiteUrl}</Text>
                        </Text>
                    </View>
                </View>
            </Modal>

            <StatusBar barStyle="light-content" />

            {/* Dashboard Parity Beautiful Sky/Wave Header */}
            <View style={styles.svgHeaderContainer}>
                <Svg height="100%" width="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <Defs>
                        <SvgGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#150247ff" stopOpacity="1" />
                            <Stop offset="1" stopColor="#f6b3eaff" stopOpacity="1" />
                        </SvgGradient>
                    </Defs>
                    {/* Sky */}
                    <Rect width="1440" height="320" fill="url(#skyGrad)" />
                    {/* Back Layer: Smooth Wave */}
                    <Path
                        fill="#8b7ca6"
                        d="M0 220 C 500 160, 900 320, 1440 200 L 1440 320 L 0 320 Z"
                        opacity="0.9"
                    />
                    {/* Front Layer: Smooth Wave */}
                    <Path
                        fill="#4c4a75"
                        d="M0 320 L 0 280 C 400 230, 1000 320, 1440 260 L 1440 320 Z"
                    />
                </Svg>
            </View>

            {/* Top Navigation */}
            <View style={styles.headerTopBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('profile', 'My Profile')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                scrollEnabled={mainScrollEnabled}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7634bc"]} />
                }
            >
                {/* Floating Avatar Section */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <Animated.View style={[styles.pulseRing, animatedPulseStyle]} />
                        <View style={styles.avatarRing}>
                            {userData?.user_image ? (
                                <Image
                                    source={{ uri: `${MASTER_SITE_CONFIG.baseUrl}${userData.user_image}` }}
                                    style={styles.avatar}
                                />
                            ) : (
                                <LinearGradient
                                    colors={['#735cadff', '#150247ff']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.placeholderAvatar}
                                >
                                    <Text style={styles.avatarInitial}>
                                        {userData?.first_name?.charAt(0) || 'U'}
                                    </Text>
                                </LinearGradient>
                            )}
                        </View>
                        <TouchableOpacity style={styles.editAvatarPill} onPress={handleAvatarUpload}>
                            <Camera size={14} color="#0f172a" style={{ marginRight: 4 }} />
                            <Text style={styles.editAvatarText}>{t('edit', 'Edit')}</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.userName}>
                        {userData?.full_name || (userData?.first_name ? `${userData.first_name} ${userData.last_name || ''}`.trim() : '') || editedData.first_name || editedData.email?.split('@')[0] || t('user', 'User')}
                    </Text>
                    <Text style={styles.userRole}>
                        {userData?.role || userData?.roles?.[0]?.role || t('warehouse_staff', 'Warehouse Staff')}
                    </Text>
                </View>

                {/* Proficient Bottom Sheet Layout */}
                <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.bottomSheet}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>{t('personal_info', 'Personal Information')}</Text>
                            <View style={styles.card}>
                                <View style={styles.inputGroup}>
                                    <View style={styles.inputWrapper}>
                                        <User size={18} color="#64748b" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder={t('first_name', 'First Name')}
                                            value={editedData.first_name}
                                            onChangeText={(text) => setEditedData(prev => ({ ...prev, first_name: text }))}
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <View style={styles.inputWrapper}>
                                        <User size={18} color="#64748b" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder={t('last_name', 'Last Name')}
                                            value={editedData.last_name}
                                            onChangeText={(text) => setEditedData(prev => ({ ...prev, last_name: text }))}
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>
                                </View>

                                <View style={[styles.inputGroup, { backgroundColor: '#f8fafc' }]}>
                                    <View style={styles.inputWrapper}>
                                        <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
                                        <TextInput
                                            style={[styles.input, { color: '#64748b' }]}
                                            placeholder={t('email_address', 'Email Address')}
                                            value={editedData.email}
                                            editable={false}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            placeholderTextColor="#94a3b8"
                                        />
                                        <Lock size={14} color="#94a3b8" style={{ marginLeft: 8 }} />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <View style={styles.inputWrapper}>
                                        <Phone size={18} color="#64748b" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder={t('mobile_number', 'Mobile Number')}
                                            value={editedData.mobile_no}
                                            keyboardType="phone-pad"
                                            onChangeText={(text) => setEditedData(prev => ({ ...prev, mobile_no: text }))}
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>
                                </View>

                                <View style={[styles.inputGroup, { borderBottomWidth: 0 }]}>
                                    <View style={styles.inputWrapper}>
                                        <Lock size={18} color="#64748b" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder={t('new_password_optional', 'New Password (Optional)')}
                                            value={editedData.new_password}
                                            secureTextEntry={!showPassword}
                                            onChangeText={(text) => setEditedData(prev => ({ ...prev, new_password: text }))}
                                            placeholderTextColor="#94a3b8"
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                            {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, (saving || loading) ? styles.saveButtonDisabled : undefined]}
                            onPress={handleSave}
                            disabled={saving || loading}
                            activeOpacity={0.8}
                        >
                            {saving ? (
                                <View style={styles.saveLoadingRow}>
                                    <ActivityIndicator color="#7634bc" size="small" style={{ marginRight: 10 }} />
                                    <Text style={styles.saveButtonText}>{t('saving', 'Saving Changes...')}</Text>
                                </View>
                            ) : (
                                <View style={styles.saveButtonContent}>
                                    <View style={styles.saveLeftGroup}>
                                        <View style={styles.saveIconBox}>
                                            <Save size={18} color="#7634bc" />
                                        </View>
                                        <Text style={styles.saveButtonText}>{t('save_changes', 'Save Changes')}</Text>
                                    </View>
                                    <LinearGradient
                                        colors={['#7634bc', '#a855f7']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.saveRightBadge}
                                    >
                                        <Check size={14} color="#fff" />
                                    </LinearGradient>
                                </View>
                            )}
                        </TouchableOpacity>
                    </KeyboardAvoidingView>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('system_config', 'System Configuration')}</Text>
                        <View style={styles.card}>
                            <SettingItem
                                icon={Globe}
                                label={t('connected_tenant', 'Connected Tenant')}
                                value={activeCompany || t('loading', 'Loading...')}
                                showChevron={companies && companies.length > 1}
                                highlighted={companies && companies.length > 1}
                                onPress={companies && companies.length > 1 ? toggleCompanyModal : undefined}
                            />
                            {showCompanyModal && (
                                <Animated.View entering={FadeInDown.duration(300)} style={styles.inlineCompanyList}>
                                    <ScrollView
                                        nestedScrollEnabled={true}
                                        showsVerticalScrollIndicator={false}
                                        onTouchStart={() => setMainScrollEnabled(false)}
                                        onTouchEnd={() => setMainScrollEnabled(true)}
                                        onMomentumScrollEnd={() => setMainScrollEnabled(true)}
                                    >
                                        {companies.map((c, idx) => {
                                            const isSelected = c.name === activeCompany;
                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[
                                                        styles.inlineCompanyBtn,
                                                        isSelected && styles.inlineCompanyBtnActive
                                                    ]}
                                                    onPress={() => {
                                                        setActiveCompany(c.name);
                                                        setShowCompanyModal(false);
                                                        setMainScrollEnabled(true);
                                                    }}
                                                    activeOpacity={0.75}
                                                >
                                                    <View style={styles.inlineCompanyInfo}>
                                                        <View style={[styles.inlineCompanyIconBg, isSelected && styles.inlineCompanyIconBgActive]}>
                                                            <Building2 size={16} color={isSelected ? "#ffffff" : "#64748b"} />
                                                        </View>
                                                        <Text style={[styles.inlineCompanyText, isSelected && styles.inlineCompanyTextActive]}>
                                                            {c.company_name || c.name}
                                                        </Text>
                                                    </View>
                                                    {isSelected && (
                                                        <View style={styles.selectedCheckBadge}>
                                                            <CheckCircle2 size={18} color="#7634bc" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </Animated.View>
                            )}

                            {/* Warehouse Selection */}
                            <SettingItem
                                icon={MapPin}
                                label={t('active_warehouse', 'Active Warehouse')}
                                value={activeWarehouse || (warehouses.length === 0 ? t('none_available', 'None Available') : t('loading', 'Loading...'))}
                                showChevron={true}
                                highlighted={true}
                                onPress={toggleWarehouseModal}
                            />
                            {showWarehouseModal && (
                                <Animated.View entering={FadeInDown.duration(300)} style={styles.inlineCompanyList}>
                                    <ScrollView
                                        nestedScrollEnabled={true}
                                        showsVerticalScrollIndicator={false}
                                        onTouchStart={() => setMainScrollEnabled(false)}
                                        onTouchEnd={() => setMainScrollEnabled(true)}
                                        onMomentumScrollEnd={() => setMainScrollEnabled(true)}
                                    >
                                        {warehouses.map((w, idx) => {
                                            const isSelected = w.name === activeWarehouse;
                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[
                                                        styles.inlineCompanyBtn,
                                                        isSelected && styles.inlineCompanyBtnActive,
                                                        { paddingLeft: 12 + (w.depth || 0) * 16 }
                                                    ]}
                                                    onPress={() => {
                                                        setActiveWarehouse(w.name);
                                                        setShowWarehouseModal(false);
                                                        setMainScrollEnabled(true);
                                                    }}
                                                    activeOpacity={0.75}
                                                >
                                                    <View style={styles.inlineCompanyInfo}>
                                                        <View style={[
                                                            styles.inlineCompanyIconBg,
                                                            isSelected && styles.inlineCompanyIconBgActive,
                                                            w.is_group === 1 && { backgroundColor: 'transparent', borderWidth: 0, width: 24, marginRight: 6 }
                                                        ]}>
                                                            {w.is_group === 1 ? (
                                                                <Folder size={18} color={isSelected ? "#7634bc" : "#94a3b8"} strokeWidth={isSelected ? 2.5 : 2} />
                                                            ) : (
                                                                <MapPin size={16} color={isSelected ? "#ffffff" : "#64748b"} />
                                                            )}
                                                        </View>
                                                        <Text style={[
                                                            styles.inlineCompanyText,
                                                            isSelected && styles.inlineCompanyTextActive,
                                                            w.is_group === 1 && { fontWeight: '700', color: isSelected ? "#7634bc" : '#334155' }
                                                        ]}>
                                                            {w.warehouse_name || w.name}
                                                        </Text>
                                                    </View>
                                                    {isSelected && (
                                                        <View style={styles.selectedCheckBadge}>
                                                            <CheckCircle2 size={18} color="#7634bc" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </Animated.View>
                            )}

                            <SettingItem
                                icon={SettingsIcon}
                                label={t('erp_server', 'ERP Server')}
                                value={displayUrl}
                                showChevron={availableSites.length > 1}
                                onPress={() => {
                                    if (availableSites.length > 1) {
                                        toggleSiteModal();
                                    }
                                }}
                            />
                            {showSiteModal && availableSites.length > 1 && (
                                <Animated.View entering={FadeInDown.duration(300)} style={styles.inlineCompanyList}>
                                    <ScrollView
                                        nestedScrollEnabled={true}
                                        showsVerticalScrollIndicator={false}
                                        onTouchStart={() => setMainScrollEnabled(false)}
                                        onTouchEnd={() => setMainScrollEnabled(true)}
                                        onMomentumScrollEnd={() => setMainScrollEnabled(true)}
                                    >
                                        {availableSites.map((site, idx) => {
                                            const isSelected = site.custom_erpnext_url === baseUrl;
                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[
                                                        styles.inlineCompanyBtn,
                                                        isSelected && styles.inlineCompanyBtnActive
                                                    ]}
                                                    onPress={() => {
                                                        handleSwitchSite(site);
                                                        setMainScrollEnabled(true);
                                                    }}
                                                    activeOpacity={0.75}
                                                >
                                                    <View style={styles.inlineCompanyInfo}>
                                                        <View style={[styles.inlineCompanyIconBg, isSelected && styles.inlineCompanyIconBgActive]}>
                                                            <Building2 size={16} color={isSelected ? "#ffffff" : "#64748b"} />
                                                        </View>
                                                        <View style={{ marginLeft: 10, flex: 1 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <Text style={[styles.inlineCompanyText, isSelected && styles.inlineCompanyTextActive]}>
                                                                    {site.customer_name || site.name}
                                                                </Text>
                                                                {isSelected && (
                                                                    <View style={styles.activePill}>
                                                                        <Text style={styles.activePillText}>ACTIVE</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <Text style={{ fontSize: 11, color: isSelected ? '#7634bc' : '#64748b', marginTop: 2, fontFamily: Fonts.sans }}>
                                                                {site.custom_erpnext_url}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    {isSelected && (
                                                        <View style={styles.selectedCheckBadge}>
                                                            <CheckCircle2 size={18} color="#7634bc" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </Animated.View>
                            )}
                            <View style={styles.siteStatus}>
                                <View style={[styles.onlineDot, !isDynamicSync ? { backgroundColor: '#94a3b8' } : undefined]} />
                                <Text style={styles.siteStatusText}>
                                    {isDynamicSync ? t('dynamic_tenant_synced', 'Currently synced with dynamic tenant') : t('master_site_connected', 'Connected to Master Site')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('preferences', 'Preferences')}</Text>
                        <View style={styles.card}>
                            <SettingItem
                                icon={Globe}
                                label={t('display_language', 'Display Language')}
                                value={LANGUAGE_OPTIONS.find(l => l.code === i18n.language)?.name || 'English'}
                                showChevron={true}
                                highlighted={true}
                                onPress={toggleLanguageModal}
                            />
                            {showLanguageModal && (
                                <Animated.View entering={FadeInDown.duration(300)} style={styles.inlineCompanyList}>
                                    <ScrollView
                                        nestedScrollEnabled={true}
                                        showsVerticalScrollIndicator={false}
                                        onTouchStart={() => setMainScrollEnabled(false)}
                                        onTouchEnd={() => setMainScrollEnabled(true)}
                                        onMomentumScrollEnd={() => setMainScrollEnabled(true)}
                                    >
                                        {LANGUAGE_OPTIONS.map((lang, idx) => {
                                            const isSelected = i18n.language === lang.code;
                                            return (
                                                <TouchableOpacity
                                                    key={lang.code}
                                                    style={[
                                                        styles.inlineCompanyBtn,
                                                        isSelected && styles.inlineCompanyBtnActive
                                                    ]}
                                                    onPress={() => {
                                                        changeLanguage(lang.code);
                                                        setShowLanguageModal(false);
                                                        setMainScrollEnabled(true);
                                                    }}
                                                    activeOpacity={0.75}
                                                >
                                                    <View style={styles.inlineCompanyInfo}>
                                                        <View style={[styles.inlineCompanyIconBg, isSelected && styles.inlineCompanyIconBgActive]}>
                                                            <Globe size={16} color={isSelected ? "#ffffff" : "#64748b"} />
                                                        </View>
                                                        <Text style={[styles.inlineCompanyText, isSelected && styles.inlineCompanyTextActive]}>
                                                            {lang.name}
                                                        </Text>
                                                    </View>
                                                    {isSelected && (
                                                        <View style={styles.selectedCheckBadge}>
                                                            <CheckCircle2 size={18} color="#7634bc" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </Animated.View>
                            )}
                        </View>
                    </View>

                    <View style={[styles.section, { marginBottom: 20 }]}>
                        <View style={styles.card}>
                            <SettingItem icon={LogOut} label={t('secure_sign_out', 'Secure Sign Out')} onPress={handleLogout} danger />
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>

            <ConfirmationModal
                visible={showLogoutModal}
                title={t('sign_out', 'Sign Out')}
                message={t('sign_out_message', 'Are you sure you want to securely sign out of your account?')}
                confirmText={t('sign_out', 'Sign Out')}
                isDestructive={true}
                iconType="logout"
                onConfirm={performLogout}
                onCancel={() => setShowLogoutModal(false)}
            />


        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    svgHeaderContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280,
        overflow: 'hidden',
        zIndex: 0,
    },
    headerTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 50 : 32,
        paddingBottom: 12,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
    profileHeader: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 16,
    },
    avatarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginBottom: 12,
    },
    pulseRing: {
        position: 'absolute',
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: 'rgba(246, 179, 234, 0.5)',
    },
    avatarRing: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 3,
        shadowColor: '#4c4a75',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 45,
    },
    placeholderAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        color: '#fff',
        fontSize: 34,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    editAvatarPill: {
        position: 'absolute',
        bottom: -6,
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },
    editAvatarText: {
        color: '#0f172a',
        fontSize: 11,
        fontWeight: '600',
        fontFamily: Fonts.sans,
    },
    userName: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    userRole: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        marginTop: 2,
        fontFamily: Fonts.sans,
        letterSpacing: 0.5,
    },
    bottomSheet: {
        backgroundColor: '#f8fafc',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 8,
    },
    section: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94a3b8',
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontFamily: Fonts.sans,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingVertical: 4,
        shadowColor: '#4c4a75',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    settingIconBg: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    dangerIconBg: {
        backgroundColor: '#fef2f2',
    },
    settingContent: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        fontFamily: Fonts.sans,
    },
    settingValue: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
        fontFamily: Fonts.sans,
    },
    dangerText: {
        color: '#ef4444',
    },
    inputGroup: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    inputIcon: {
        marginRight: 14,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#0f172a',
        fontFamily: Fonts.sans,
        paddingVertical: 0,
    },
    saveButton: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        marginTop: 16,
        marginBottom: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1.5,
        borderColor: '#ede9fe',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 5,
    },
    saveLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
    },
    saveButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    saveLeftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    saveIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    saveRightBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#150247',
        fontSize: 15,
        fontWeight: '700',
        fontFamily: Fonts.sans,
        letterSpacing: 0.3,
    },
    siteStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        marginTop: -4,
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
        marginRight: 8,
    },
    siteStatusText: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Fonts.sans,
        fontStyle: 'italic',
    },
    inlineCompanyList: {
        backgroundColor: '#fbf9fe',
        borderColor: '#ede9fe',
        borderWidth: 1,
        marginTop: 6,
        marginBottom: 14,
        borderRadius: 20,
        padding: 8,
        marginHorizontal: 12,
        maxHeight: 270,
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    inlineCompanyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 14,
        marginBottom: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    inlineCompanyBtnActive: {
        backgroundColor: '#f3e8ff',
        borderColor: '#c084fc',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
    },
    inlineCompanyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    activePill: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    activePillText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#15803d',
        fontFamily: Fonts.sans,
    },
    inlineCompanyIconBg: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    inlineCompanyIconBgActive: {
        backgroundColor: '#7634bc',
        borderColor: '#6b21a8',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    selectedCheckBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    inlineCompanyText: {
        fontSize: 14,
        color: '#475569',
        fontFamily: Fonts.sans,
        fontWeight: '500',
    },
    inlineCompanyTextActive: {
        color: '#6b21a8',
        fontWeight: '700',
    }
});
