import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '@/utils/storage';
import { useFrappe } from '@/hooks/use-frappe';
import { useCompanyContext } from './CompanyContext';

import { MASTER_SITE_CONFIG } from '@/constants/config';

type WarehouseContextType = {
    activeWarehouse: string | null;
    warehouses: any[];
    setActiveWarehouse: (warehouse: string) => void;
};

const warehouseContext = createContext<WarehouseContextType>({
    activeWarehouse: null,
    warehouses: [],
    setActiveWarehouse: () => { }
});

export const WarehouseProvider = ({ children }: { children: React.ReactNode }) => {
    const { getResource, baseUrl } = useFrappe();
    const { activeCompany } = useCompanyContext();

    const [activeWarehouse, setActiveWarehouse] = useState<string | null>(null);
    const [warehouses, setWarehouses] = useState<any[]>([]);

    useEffect(() => {
        const fetchWarehouses = async () => {
            const savedUrl = await storage.getItem('dynamic_base_url');
            if (baseUrl === MASTER_SITE_CONFIG.baseUrl && !savedUrl) {
                setWarehouses([]);
                setActiveWarehouse(null);
                return;
            }

            if (!activeCompany) {
                setWarehouses([]);
                setActiveWarehouse(null);
                return;
            }

            try {
                const safeCompanyKey = activeCompany.replace(/[^a-zA-Z0-9_-]/g, '_');
                const storageKey = `dynamic_warehouse_${safeCompanyKey}`;
                const savedWarehouse = await storage.getItem(storageKey);

                // Fetch ALL warehouses for the selected company, ordered by nested set left value
                const res = await getResource('Warehouse', undefined, {
                    filters: JSON.stringify([
                        ["company", "=", activeCompany]
                    ]),
                    limit_page_length: 500,
                    order_by: 'lft asc',
                    fields: '["name", "warehouse_name", "is_group", "parent_warehouse", "lft", "rgt"]'
                });

                if (Array.isArray(res) && res.length > 0) {
                    // Compute depth using Nested Set lft/rgt logic
                    let rightStack: number[] = [];
                    const flatTree = res.map(w => {
                        while (rightStack.length > 0 && w.lft > rightStack[rightStack.length - 1]) {
                            rightStack.pop();
                        }
                        const currentDepth = rightStack.length;
                        rightStack.push(w.rgt);
                        return { ...w, depth: currentDepth };
                    });

                    setWarehouses(flatTree);
                    if (savedWarehouse && flatTree.find(w => w.name === savedWarehouse)) {
                        setActiveWarehouse(savedWarehouse);
                    } else {
                        // Default to the first non-group warehouse if possible, else the first one
                        const defaultW = flatTree.find(w => w.is_group === 0) || flatTree[0];
                        setActiveWarehouse(defaultW.name);

                        const safeCompanyKey = activeCompany.replace(/[^a-zA-Z0-9_-]/g, '_');
                        await storage.setItem(`dynamic_warehouse_${safeCompanyKey}`, defaultW.name);
                    }
                } else {
                    setWarehouses([]);
                    setActiveWarehouse(null);
                }
            } catch (err) {
                console.log('Error while fetching warehouses', err);
            }
        };

        fetchWarehouses();
    }, [activeCompany, baseUrl]); // Re-run whenever the company or baseUrl changes!

    const handleSelectWarehouse = async (warehouseName: string) => {
        if (activeCompany) {
            const safeCompanyKey = activeCompany.replace(/[^a-zA-Z0-9_-]/g, '_');
            await storage.setItem(`dynamic_warehouse_${safeCompanyKey}`, warehouseName);
        }
        setActiveWarehouse(warehouseName);
    };

    return (
        <warehouseContext.Provider value={{ activeWarehouse, warehouses, setActiveWarehouse: handleSelectWarehouse }}>
            {children}
        </warehouseContext.Provider>
    );
};

export const useWarehouseContext = () => useContext(warehouseContext);
