import { IconSymbol } from '@/components/ui/icon-symbol';
import { MASTER_SITE_CONFIG } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { useFrappe } from '@/hooks/use-frappe';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/utils/storage';
import { Validators } from '@/utils/validation';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { Eye, EyeOff } from 'lucide-react-native';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { showError } = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localLoading, setLocalLoading] = useState(false);

    const {
        login,
        resolveAndSyncConfig,
        loading
    } = useFrappe(
        MASTER_SITE_CONFIG.baseUrl,
        true
    );
    const handleLogin = async () => {
        const cleanEmail = email.trim().toLowerCase();
        const cleanPassword = password.trim();

        if (!cleanEmail || !cleanPassword) {
            showError('Please enter Email address and Password');
            return;
        }

        if (!Validators.isValidEmail(cleanEmail)) {
            showError('Please enter a valid email address');
            return;
        }

        if (!Validators.isStrongPassword(cleanPassword)) {
            showError('Password must be at least 8 characters long');
            return;
        }

        // Sync state visually for user
        setEmail(cleanEmail);

        try {
            setLocalLoading(true);
            console.log(
                '[Login] Starting fresh login...'
            );

            //  Clearing  old tenant config first
            await storage.clear();

            // Small wait for Android SecureStore
            await new Promise(resolve =>
                setTimeout(resolve, 300)
            );

            // Authenticate with WMS User Account directory
            console.log('[Login] Authenticating user with WMS master directory...');
            let loginSuccess = false;
            let userData: any = null;
            let companyData: any = null;

            const cleanMasterBase = (MASTER_SITE_CONFIG.baseUrl || '')
                .replace(/\/desk\/?$/, '')
                .replace(/\/app\/?$/, '')
                .replace(/\/+$/, '');

            try {
                const wmsLoginResponse = await fetch(
                    `${cleanMasterBase}/api/method/wms_api.wms_api.api.login_user`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            email: cleanEmail,
                            password: cleanPassword
                        }),
                    }
                );

                const wmsLoginText = await wmsLoginResponse.text();
                let wmsResult;
                try {
                    wmsResult = JSON.parse(wmsLoginText);
                } catch {
                    wmsResult = null;
                }

                if (wmsLoginResponse.ok && wmsResult && (wmsResult.status === 200 || wmsResult.success || wmsResult.message?.status === 200 || wmsResult.message?.success || wmsResult.data?.user || wmsResult.message?.data?.user)) {
                    loginSuccess = true;
                    const payload = wmsResult.data || wmsResult.message?.data || wmsResult.message || {};
                    userData = payload.user || null;
                    companyData = payload.company || null;
                } else if (wmsResult) {
                    const respMsg = wmsResult.message?.message || wmsResult.message || (wmsResult._server_messages ? JSON.parse(wmsResult._server_messages).map((m: any) => JSON.parse(m).message).join(', ') : null);
                    if (wmsResult.status === 401 || wmsResult.status === 403 || wmsResult.message?.status === 401 || wmsResult.message?.status === 403) {
                        throw new Error(typeof respMsg === 'string' ? respMsg : 'Invalid email or password credentials');
                    }
                }
            } catch (err: any) {
                if (err?.message && !err.message.includes('maintenance') && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
                    throw err;
                }
            }

            if (!loginSuccess) {
                // Fallback to standard Frappe /api/method/login
                console.log('[Login] Trying standard Frappe login fallback...');
                const loginResponse = await fetch(
                    `${cleanMasterBase}/api/method/login`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            usr: cleanEmail,
                            pwd: cleanPassword
                        }),
                    }
                );

                const loginText = await loginResponse.text();
                let loginResult;
                try {
                    loginResult = JSON.parse(loginText);
                } catch (parseError) {
                    throw new Error('The server or site is currently undergoing maintenance. Please try again later.');
                }

                if (!loginResponse.ok) {
                    const errorMsg =
                        loginResult?._server_messages
                            ? JSON.parse(loginResult._server_messages)
                                .map((m: any) => JSON.parse(m).message)
                                .join(', ')
                            : loginResult.message || 'Invalid email or password credentials';

                    throw new Error(errorMsg);
                }
            }

            console.log('[Login] Master login success');
            await storage.setItem('frappe_user_email', cleanEmail);

            if (userData) {
                await storage.setItem('user_info', JSON.stringify(userData));
                if (userData.role) {
                    await storage.setItem('user_role', userData.role);
                }
                if (userData.permissions) {
                    await storage.setItem('user_permissions', JSON.stringify(userData.permissions));
                }
            }

            // If company credentials returned directly from login, store them
            if (companyData && companyData.company_url && companyData.api_key && companyData.api_secret) {
                console.log(`[Login] Setting tenant credentials directly: ${companyData.company_url}`);
                await storage.setItem('dynamic_base_url', companyData.company_url);
                await storage.setItem('dynamic_api_key', companyData.api_key);
                await storage.setItem('dynamic_api_secret', companyData.api_secret);
                if (companyData.company_name) {
                    await storage.setItem('dynamic_company', companyData.company_name);
                }
                const validSites = [{
                    name: companyData.company_name || 'Tenant ERP',
                    customer_name: companyData.company_name || 'Tenant ERP',
                    custom_erpnext_url: companyData.company_url,
                    custom_api: companyData.api_key,
                    custom_api_secret: companyData.api_secret
                }];
                console.log("Details:",validSites)
                await storage.setItem('user_available_sites', JSON.stringify(validSites));
            } else {
                // Resolve dynamic site configuration for this user
                console.log('[Login] Resolving site configurations for user:', cleanEmail);
                const siteInfo = await resolveAndSyncConfig(cleanEmail);

                if (siteInfo && siteInfo.availableSites && siteInfo.availableSites.length > 0) {
                    console.log(`[Login] Dynamically pivoting to matched site: ${siteInfo.site.custom_erpnext_url}`);
                } else {
                    console.log(`[Login] No specific company site found, using Master Site`);
                    await storage.setItem('dynamic_base_url', MASTER_SITE_CONFIG.baseUrl);
                    await storage.setItem('dynamic_api_key', MASTER_SITE_CONFIG.apiKey);
                    await storage.setItem('dynamic_api_secret', MASTER_SITE_CONFIG.apiSecret);
                    await storage.setItem('dynamic_company', MASTER_SITE_CONFIG.company);
                }
            }

            // Wait for storage sync
            await new Promise(resolve => setTimeout(resolve, 300));

            // Verify stored active URL
            const savedUrl = await storage.getItem('dynamic_base_url');
            console.log('[Login] Active App Base URL set to:', savedUrl);

            // Navigate to Dashboard
            router.replace('/(tabs)');

        } catch (error: any) {
            showError(
                error?.message ||
                'Something went wrong'
            );
        } finally {
            setLocalLoading(false);
        }
    };
    return (
        <View style={styles.container}>
            {/* Background SVG Wave Header to match Dashboard */}
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
                    />
                    {/* Front Layer: Smooth Wave */}
                    <Path
                        fill="#4c4a75"
                        d="M0 320 L 0 280 C 400 230, 1000 320, 1440 260 L 1440 320 Z"
                    />
                </Svg>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <Animated.View
                    entering={FadeInUp.delay(200).duration(1000)}
                    style={styles.logoContainer}
                >
                    <View style={styles.logoBox}>
                        <Text style={styles.logoText}>{t('cron', 'CRON')}</Text>
                        <View style={styles.logoBadge}>
                            <Text style={styles.logoBadgeText}>{t('wms', 'WMS')}</Text>
                        </View>
                    </View>
                    <Text style={styles.welcomeText}>{t('welcome_back', 'Welcome Back')}</Text>
                    <Text style={styles.subtitleText}>{t('sign_in_to_manage_yo', 'Sign in to manage your inventory')}</Text>
                </Animated.View>

                <Animated.View
                    entering={FadeInDown.delay(400).duration(800)}
                    layout={Layout.springify()}
                    style={styles.card}
                >

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('email_address', 'Email Address')}</Text>
                        <View style={styles.inputWrapper}>
                            <IconSymbol name="paperplane.fill" size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="john@company.com"
                                placeholderTextColor="#64748b"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>
                    </View>

                    <View style={[styles.inputGroup, { marginBottom: 24 }]}>
                        <Text style={styles.label}>{t('password', 'Password')}</Text>
                        <View style={styles.inputWrapper}>
                            <IconSymbol name="chevron.right" size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password"
                                placeholderTextColor="#64748b"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeIcon}
                            >
                                {showPassword ? (
                                    <EyeOff size={20} color="#94a3b8" />
                                ) : (
                                    <Eye size={20} color="#94a3b8" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>


                    <TouchableOpacity style={styles.forgotBtn}>
                        <Text style={styles.forgotText}>{t('forgot_password', 'Forgot Password?')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.loginBtn, (loading || localLoading) && styles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading || localLoading}
                    >
                        {loading || localLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.loginBtnContent}>
                                <Text style={styles.loginBtnText}>{t('sign_in', 'Sign In')}</Text>
                                <IconSymbol name="chevron.right" size={20} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.contactAdminContainer}>
                        <Text style={styles.contactAdminText}>
                            {t('need_an_account', "Don't have an account?")}
                        </Text>
                        <Text style={styles.contactAdminSubtext}>
                            {t('contact_admin', 'Contact your system administrator to get access.')}
                        </Text>
                    </View>

                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    svgHeaderContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 380,
        overflow: 'hidden',
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
        zIndex: 0,
    },
    keyboardView: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 10,
    },
    logoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    logoText: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 2,
        color: '#2e1065',
        fontFamily: Fonts.sans,
    },
    logoBadge: {
        backgroundColor: '#7634bc',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
    },
    logoBadgeText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        fontFamily: Fonts.sans,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#f8fafc',
        marginTop: 20,
        fontFamily: Fonts.sans,
    },
    subtitleText: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        fontFamily: Fonts.sans,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8,
        marginLeft: 4,
        fontFamily: Fonts.sans,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
        height: 52,
    },
    inputIcon: {
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        color: '#0f172a',
        paddingRight: 12,
        paddingVertical: 0,
        fontFamily: Fonts.sans,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    eyeIcon: {
        paddingHorizontal: 12,
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '500',
        fontFamily: Fonts.sans,
    },
    loginBtn: {
        backgroundColor: '#7634bc',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7634bc',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 5,
    },
    loginBtnDisabled: {
        opacity: 0.7,
    },
    loginBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loginBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 8,
        fontFamily: Fonts.sans,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    dividerText: {
        marginHorizontal: 12,
        color: '#94a3b8',
        fontSize: 14,
        fontFamily: Fonts.sans,
    },
    serverToggle: {
        alignSelf: 'flex-end',
        marginBottom: 10,
    },
    serverToggleText: {
        color: '#38bdf8',
        fontSize: 12,
        fontWeight: '500',
        fontFamily: Fonts.sans,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        color: '#64748b',
        fontSize: 14,
        fontFamily: Fonts.sans,
    },
    footerLink: {
        color: '#7634bc',
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: Fonts.sans,
    },
    contactAdminContainer: {
        marginTop: 32,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    contactAdminText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 4,
    },
    contactAdminSubtext: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 18,
    }
});
