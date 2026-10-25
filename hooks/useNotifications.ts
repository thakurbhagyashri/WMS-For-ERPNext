import { useState, useEffect, useCallback } from 'react';
import { useFrappe } from './use-frappe';
import { APP_CONFIG } from '@/constants/config';

export interface NotificationLog {
    name: string;
    subject: string;
    document_type: string;
    document_name: string;
    read: number;
    creation: string;
    from_user: string;
    open_reference_document: string;
}

export const useNotifications = () => {
    const { callMethod, getCurrentUserEmail } = useFrappe(APP_CONFIG);
    const [notifications, setNotifications] = useState<NotificationLog[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            const currentUser = await getCurrentUserEmail();
            if (!currentUser || currentUser === 'Guest') {
                return; // Do not fetch notifications if not logged in
            }

            setLoading(true);
            const result = await callMethod('frappe.client.get_list', {
                doctype: 'Notification Log',
                filters: { for_user: currentUser },
                fields: ['name', 'subject', 'document_type', 'document_name', 'read', 'creation', 'from_user', 'open_reference_document'],
                order_by: 'creation desc',
                limit_page_length: 50
            }, false, '', true);

            if (result && Array.isArray(result)) {
                // Strip HTML tags from the subject to make it readable in React Native
                const cleanedNotifications = result.map((n: NotificationLog) => ({
                    ...n,
                    subject: n.subject ? n.subject.replace(/<[^>]+>/g, '') : ''
                }));
                setNotifications(cleanedNotifications);
                setUnreadCount(cleanedNotifications.filter((n: NotificationLog) => n.read === 0).length);
            }
        } catch (error: any) {
            // Silently ignore authentication errors during background polling
            if (!error?.message?.includes('Authentication failed')) {
                console.warn('Failed to fetch notifications:', error);
            }
        } finally {
            setLoading(false);
        }
    }, [callMethod, getCurrentUserEmail]);

    const markAsRead = async (name: string) => {
        try {
            await callMethod('frappe.desk.doctype.notification_log.notification_log.mark_as_read', {
                docname: name
            });
            setNotifications(prev => prev.map(n => n.name === name ? { ...n, read: 1 } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    // const markAllAsRead = async () => {
    //     try {
    //         await callMethod('frappe.desk.notifications.mark_all_as_read');
    //         fetchNotifications();
    //     } catch (error) {
    //         console.error('Failed to mark all as read:', error);
    //     }
    // };

    useEffect(() => {
        fetchNotifications();
        const intervalId = setInterval(fetchNotifications, 30000);
        return () => clearInterval(intervalId);
    }, [fetchNotifications]);

    return {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,

    };
};
