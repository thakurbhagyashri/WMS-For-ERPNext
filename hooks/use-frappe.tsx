import { MASTER_SITE_CONFIG } from '@/constants/config';
import {
    getCachedItem,
    storage
} from '@/utils/storage';
import { useCallback, useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';

export interface FrappeResponse<T = any> {
    data?: T;
    error?: string;
    loading: boolean;
}

export interface FrappeConfig {
    baseUrl: string;
    apiKey?: string;
    apiSecret?: string;
    company?: string;
}


import { useToast } from './use-toast';

export const useFrappe = (config: FrappeConfig | string = MASTER_SITE_CONFIG, useDynamicConfig = true) => {
    const [loading, setLoading] = useState(false);
    const { showError, showSuccess } = useToast();

    const [activeConfig, setActiveConfig] = useState<FrappeConfig>(() => {
        const cachedUrl = getCachedItem('dynamic_base_url');
        const cachedKey = getCachedItem('dynamic_api_key');
        const cachedSecret = getCachedItem('dynamic_api_secret');
        const cachedCompany = getCachedItem('dynamic_company');
        if (useDynamicConfig && cachedUrl && cachedKey && cachedSecret) {
            return {
                baseUrl: cachedUrl,
                apiKey: cachedKey,
                apiSecret: cachedSecret,
                company: cachedCompany || (typeof config === 'string' ? undefined : config.company),
            };
        }

        return {
            baseUrl: typeof config === 'string' ? config : config.baseUrl,
            apiKey: typeof config === 'string' ? undefined : config.apiKey,
            apiSecret: typeof config === 'string' ? undefined : config.apiSecret,
            company: typeof config === 'string' ? undefined : config.company,
        };
    });

    useEffect(() => {
        if (useDynamicConfig) {
            const loadAsync = async () => {
                const savedUrl = await storage.getItem('dynamic_base_url');
                const savedKey = await storage.getItem('dynamic_api_key');
                const savedSecret = await storage.getItem('dynamic_api_secret');
                const savedCompany = await storage.getItem('dynamic_company');

                if (savedUrl && savedKey && savedSecret) {
                    if (
                        savedUrl !== activeConfig.baseUrl ||
                        savedKey !== activeConfig.apiKey ||
                        savedSecret !== activeConfig.apiSecret ||
                        savedCompany !== activeConfig.company
                    ) {
                        setActiveConfig({
                            baseUrl: savedUrl,
                            apiKey: savedKey,
                            apiSecret: savedSecret,
                            company: savedCompany || undefined
                        });
                    }
                } else {
                    const defaultBaseUrl = typeof config === 'string' ? config : config.baseUrl;
                    if (activeConfig.baseUrl !== defaultBaseUrl) {
                        setActiveConfig({
                            baseUrl: defaultBaseUrl,
                            apiKey: typeof config === 'string' ? undefined : config.apiKey,
                            apiSecret: typeof config === 'string' ? undefined : config.apiSecret,
                            company: typeof config === 'string' ? undefined : config.company,
                        });
                    }
                }
            };
            loadAsync();

            const sub = DeviceEventEmitter.addListener('storage_changed', (key) => {
                if (
                    key === 'dynamic_base_url' ||
                    key === 'dynamic_api_key' ||
                    key === 'dynamic_api_secret' ||
                    key === 'dynamic_company'
                ) {
                    loadAsync();
                }
            });

            const clearSub = DeviceEventEmitter.addListener('storage_cleared', () => {
                setActiveConfig({
                    baseUrl: MASTER_SITE_CONFIG.baseUrl,
                    apiKey: MASTER_SITE_CONFIG.apiKey,
                    apiSecret: MASTER_SITE_CONFIG.apiSecret,
                    company: MASTER_SITE_CONFIG.company
                });
            });

            return () => {
                sub.remove();
                clearSub.remove();
            };
        }
    }, [useDynamicConfig, activeConfig.baseUrl, activeConfig.apiKey, activeConfig.apiSecret, activeConfig.company]);


    const { baseUrl, apiKey, apiSecret, company } = activeConfig;

    const request = useCallback(async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, body?: any, showSuccessToast = false, successMessage?: string, hideErrorToast = false) => {
        setLoading(true);
        try {
            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const url = `${cleanBase}${cleanEndpoint}`;
            console.log("== FRACTION API REQUEST TO:", url, "==");
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            };

            if (apiKey && apiSecret) {
                headers['Authorization'] = `token ${apiKey}:${apiSecret}`;
            }
            const options: RequestInit = {
                method,
                headers,
                mode: 'cors',
                credentials: 'omit',
            };

            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);

            let result: any = null;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                const text = await response.text();
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText} - The server did not return valid JSON.`);
                }
                result = text;
            }

            if (!response.ok) {
                let errorMsg = `API Error (${response.status})`;
                if (result && result._server_messages) {
                    try {
                        const parsed = JSON.parse(result._server_messages);
                        errorMsg = parsed.map((m: any) => {
                            try {
                                return JSON.parse(m).message;
                            } catch (e) {
                                return m;
                            }
                        }).join(', ');
                    } catch (e) {
                        errorMsg = String(result._server_messages);
                    }
                } else if (result.message) {
                    errorMsg = typeof result.message === 'string' ? result.message : JSON.stringify(result.message);
                } else if (result.exc) {
                    errorMsg = typeof result.exc === 'string' ? result.exc : 'Server Exception';
                }

                // Clean up HTML tags (e.g. <strong>User</strong> -> User)
                errorMsg = errorMsg.replace(/<[^>]*>?/gm, '').trim();

                // Format Python AuthenticationError or Traceback cleanly
                if (errorMsg.includes('AuthenticationError')) {
                    errorMsg = 'Authentication failed. Please verify your credentials or server settings.';
                }

                // Strip redundant "Error: " prefixes often returned by Frappe
                errorMsg = errorMsg.replace(/^(Error:\s*)+/g, '');

                throw new Error(errorMsg);
            }

            const data = ('data' in result) ? result.data : (('message' in result) ? result.message : result);

            if (showSuccessToast) {
                showSuccess(successMessage || 'Operation successful');
            }

            return data;
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            const appNotInstalledMatch = errorMsg.match(/App ([\w_]+) is not installed/i);

            if (appNotInstalledMatch) {
                const appName = appNotInstalledMatch[1].toUpperCase();
                Alert.alert(
                    "App Installation Required",
                    `The app "${appName}" needs to be installed on your backend server to use this feature.`,
                    [{ text: "OK" }]
                );
                console.log(`Frappe API (app not installed) [${method} ${endpoint}]:`, errorMsg);
            } else if (hideErrorToast) {
                // Silent call — caller handles the error; just warn, don't pollute the error log
                console.log(`Frappe API (silent fail) [${method} ${endpoint}]:`, errorMsg);
            } else {
                console.log(`Frappe API Error [${method} ${endpoint}]:`, errorMsg);
                showError(errorMsg || 'API Error');
            }
            throw error;
        } finally {
            setLoading(false);
        }
    }, [baseUrl, apiKey, apiSecret, showError, showSuccess]);

    const getResource = useCallback((doctype: string, name?: string, params?: Record<string, any>, showSuccessToast = false, successMessage?: string, hideErrorToast = false) => {
        let endpoint = `/api/resource/${doctype}`;
        if (name) {
            endpoint += `/${name}`;
        }
        if (params) {
            const query = new URLSearchParams(params).toString();
            endpoint += `?${query}`;
        }
        return request('GET', endpoint, undefined, showSuccessToast, successMessage, hideErrorToast);
    }, [request]);

    const postResource = useCallback((doctype: string, data: any, showSuccessToast = true, successMessage?: string, hideErrorToast = false) => {
        return request('POST', `/api/resource/${doctype}`, data, showSuccessToast, successMessage || `${doctype} created successfully`, hideErrorToast);
    }, [request]);

    const putResource = useCallback((doctype: string, name: string, data: any, showSuccessToast = true, successMessage?: string, hideErrorToast = false) => {
        return request('PUT', `/api/resource/${doctype}/${name}`, data, showSuccessToast, successMessage || `${doctype} updated successfully`, hideErrorToast);
    }, [request]);

    const deleteResource = useCallback((doctype: string, name: string, showSuccessToast = true, successMessage?: string, hideErrorToast = false) => {
        return request('DELETE', `/api/resource/${doctype}/${name}`, undefined, showSuccessToast, successMessage || `${doctype} deleted successfully`, hideErrorToast);
    }, [request]);

    const callMethod = useCallback((methodName: string, data?: any, showSuccessToast = false, successMessage?: string, hideErrorToast = false) => {
        return request('POST', `/api/method/${methodName}`, data, showSuccessToast, successMessage, hideErrorToast);
    }, [request]);

    const login = useCallback(async (usr: string, pwd: string) => {
        try {
            const wmsRes = await request('POST', '/api/method/wms_api.wms_api.api.login_user', { email: usr, password: pwd }, true, 'Login successful');
            await storage.setItem('frappe_user_email', usr);
            return wmsRes;
        } catch {
            const result = await request('POST', '/api/method/login', { usr, pwd }, true, 'Login successful');
            await storage.setItem('frappe_user_email', usr);
            return result;
        }
    }, [request]);

    const getCurrentUserEmail = useCallback(async () => {
        return await storage.getItem('frappe_user_email');
    }, []);

    const logout = useCallback(async () => {
        try {
            await request('POST', '/api/method/logout');
        } catch (error) {
            console.error('Server logout failed:', error);
        } finally {
            // Clear everything together
            await storage.clear();

            // Reset hook state immediately
            setActiveConfig({
                baseUrl:
                    MASTER_SITE_CONFIG.baseUrl,
                apiKey:
                    MASTER_SITE_CONFIG.apiKey,
                apiSecret:
                    MASTER_SITE_CONFIG.apiSecret,
                company:
                    MASTER_SITE_CONFIG.company
            });

            // Small wait for Android
            await new Promise(resolve =>
                setTimeout(resolve, 200)
            );
        }
    }, [request]);


    const resolveAndSyncConfig = useCallback(async (email: string) => {
        if (!email) return null;

        try {
            // Always use Master Site credentials to find the tenant config
            const masterHeaders = {
                'Authorization': `token ${MASTER_SITE_CONFIG.apiKey}:${MASTER_SITE_CONFIG.apiSecret}`,
                'Content-Type': 'application/json'
            };
            const masterUrl = MASTER_SITE_CONFIG.baseUrl.endsWith('/') ? MASTER_SITE_CONFIG.baseUrl.slice(0, -1) : MASTER_SITE_CONFIG.baseUrl;


            const fetchFromMaster = async (endpoint: string) => {
                const url = `${masterUrl}${endpoint}`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `token ${MASTER_SITE_CONFIG.apiKey}:${MASTER_SITE_CONFIG.apiSecret}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    credentials: 'omit', // IMPORTANT FIX
                });

                const result = await response.json();
                return result.data || result.message || result;
            };

            let validSites: any[] = [];

            // 1. Direct WMS User Account -> WMS Company Account lookup on Master Site
            try {
                let wmsUsers = await fetchFromMaster(`/api/resource/WMS User Account?filters=${encodeURIComponent(JSON.stringify([['email', '=', email]]))}&fields=${encodeURIComponent(JSON.stringify(["name", "full_name", "role", "wms_company_account", "wms_subscription"]))}`);
                if (wmsUsers && Array.isArray(wmsUsers) && wmsUsers.length > 0) {
                    const userAcc = wmsUsers[0];
                    if (userAcc.wms_company_account) {
                        const compAcc = await fetchFromMaster(`/api/resource/WMS Company Account/${encodeURIComponent(userAcc.wms_company_account)}`);
                        if (compAcc && compAcc.company_url && compAcc.api_key && compAcc.api_secret) {
                            validSites.push({
                                name: compAcc.company_name || compAcc.name,
                                customer_name: compAcc.company_name || compAcc.name,
                                custom_erpnext_url: compAcc.company_url,
                                custom_api: compAcc.api_key,
                                custom_api_secret: compAcc.api_secret
                            });
                        }
                    }
                }
            } catch (err) {
                console.log('[useFrappe] Direct WMS User Account lookup fallback error:', err);
            }

            // 2. Customer record lookup
            if (validSites.length === 0) {
                let customers = await fetchFromMaster(`/api/resource/Customer?filters=${encodeURIComponent(JSON.stringify([['email_id', '=', email]]))}&fields=${encodeURIComponent(JSON.stringify(["name", "customer_name", "custom_erpnext_url", "custom_api", "custom_api_secret"]))}`);
                if (customers && Array.isArray(customers) && customers.length > 0) {
                    validSites = customers.filter(s => s.custom_erpnext_url && s.custom_api && s.custom_api_secret);
                }
            }

            // 3. Contact record lookup
            if (validSites.length === 0) {
                let contacts = await fetchFromMaster(`/api/resource/Contact?filters=${encodeURIComponent(JSON.stringify([['email_id', '=', email]]))}&fields=${encodeURIComponent(JSON.stringify(["name"]))}`);
                if (!contacts || contacts.length === 0) {
                    contacts = await fetchFromMaster(`/api/resource/Contact?filters=${encodeURIComponent(JSON.stringify([['user', '=', email]]))}&fields=${encodeURIComponent(JSON.stringify(["name"]))}`);
                }

                if (contacts && contacts.length > 0) {
                    for (const contactInfo of contacts) {
                        const fullContact = await fetchFromMaster(`/api/resource/Contact/${contactInfo.name}`);
                        const customerLinks = (fullContact.links || []).filter((l: any) => l.link_doctype === 'Customer');

                        for (const customerLink of customerLinks) {
                            const linkedCustomer = await fetchFromMaster(`/api/resource/Customer/${customerLink.link_name}?fields=${encodeURIComponent(JSON.stringify(["name", "customer_name", "custom_erpnext_url", "custom_api", "custom_api_secret"]))}`);

                            if (linkedCustomer && linkedCustomer.custom_erpnext_url && linkedCustomer.custom_api && linkedCustomer.custom_api_secret) {
                                // Prevent duplicate additions
                                if (!validSites.some(s => s.custom_erpnext_url === linkedCustomer.custom_erpnext_url)) {
                                    validSites.push(linkedCustomer);
                                }
                            }
                        }
                    }
                }
            }

            if (validSites.length > 0) {
                await storage.setItem('user_available_sites', JSON.stringify(validSites));

                // Use saved selection if already set, otherwise default to first site
                const savedUrl = await storage.getItem('dynamic_base_url');
                let site = validSites.find(s => s.custom_erpnext_url === savedUrl) || validSites[0];

                await storage.setItem('dynamic_base_url', site.custom_erpnext_url);
                await storage.setItem('dynamic_api_key', site.custom_api);
                await storage.setItem('dynamic_api_secret', site.custom_api_secret);
                if (site.customer_name) {
                    await storage.setItem('dynamic_company', site.customer_name);
                } else if (site.name) {
                    await storage.setItem('dynamic_company', site.name);
                }

                setActiveConfig({
                    baseUrl: site.custom_erpnext_url,
                    apiKey: site.custom_api,
                    apiSecret: site.custom_api_secret,
                    company: site.customer_name || site.name
                });
                return { site, availableSites: validSites };
            }
            return null;
        } catch (err) {
            console.error('[useFrappe] Failed to resolve dynamic config:', err);
            return null;
        }
    }, [getResource]);

    return {
        baseUrl,
        company,
        loading,
        getResource,
        postResource,
        putResource,
        deleteResource,
        callMethod,
        login,
        logout,
        getCurrentUserEmail,
        resolveAndSyncConfig,
    };
};

export interface UserPermissions {
    can_access_portal?: boolean;
    can_receive?: boolean;
    can_put_away?: boolean;
    can_pick?: boolean;
    can_pack?: boolean;
    can_ship?: boolean;
    can_cycle_count?: boolean;
    can_stock_transfer?: boolean;
    can_stock_lookup?: boolean;
    can_manage_users?: boolean;
}

export const usePermissions = () => {
    const [role, setRole] = useState<string>(() => {
        return getCachedItem('user_role') || 'Operator';
    });
    const [permissions, setPermissions] = useState<UserPermissions>(() => {
        const cached = getCachedItem('user_permissions');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch {}
        }
        return {};
    });
    const [loading, setLoading] = useState(false);

    const loadPermissions = useCallback(async (fetchRemote = true) => {
        try {
            const savedRole = await storage.getItem('user_role');
            const savedPerms = await storage.getItem('user_permissions');
            const userEmail = await storage.getItem('frappe_user_email');
            
            if (savedRole) {
                setRole(savedRole);
            }

            if (savedPerms) {
                try {
                    const parsed = JSON.parse(savedPerms);
                    if (parsed && typeof parsed === 'object') {
                        setPermissions(parsed);
                    }
                } catch {}
            }

            // Sync latest permissions dynamically from WMS Master backend
            if (fetchRemote && userEmail && userEmail !== 'Guest') {
                try {
                    const cleanMaster = (MASTER_SITE_CONFIG.baseUrl || '')
                        .replace(/\/desk\/?$/, '')
                        .replace(/\/app\/?$/, '')
                        .replace(/\/+$/, '');
                    const res = await fetch(`${cleanMaster}/api/method/wms_api.wms_api.api.get_user_permissions_api?email=${encodeURIComponent(userEmail)}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                        }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        const payload = json.data || json.message?.data || json.message;
                        if (payload && payload.permissions) {
                            setPermissions(payload.permissions);
                            await storage.setItem('user_permissions', JSON.stringify(payload.permissions));
                            if (payload.role) {
                                setRole(payload.role);
                                await storage.setItem('user_role', payload.role);
                            }
                        }
                    }
                } catch (remoteErr) {
                    console.log('[usePermissions] Remote sync deferred:', remoteErr);
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPermissions(true);
        const sub = DeviceEventEmitter.addListener('storage_changed', (key) => {
            if (key === 'user_permissions' || key === 'user_role' || key === 'user_info' || key === 'frappe_user_email') {
                loadPermissions(false);
            }
        });
        const clearSub = DeviceEventEmitter.addListener('storage_cleared', () => {
            setPermissions({});
            setRole('Operator');
        });
        return () => {
            sub.remove();
            clearSub.remove();
        };
    }, [loadPermissions]);

    const hasPermission = useCallback((permissionKey: keyof UserPermissions): boolean => {
        if (role === 'Admin') return true;
        return Boolean(permissions[permissionKey]);
    }, [role, permissions]);

    return {
        role,
        permissions,
        hasPermission,
        isAdmin: role === 'Admin',
        isSupervisor: role === 'Supervisor',
        isViewer: role === 'Viewer',
        isOperator: role === 'Operator',
        loading,
        refreshPermissions: () => loadPermissions(true),
    };
};
