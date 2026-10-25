import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '@/utils/storage';
import { useFrappe } from '@/hooks/use-frappe';

import { MASTER_SITE_CONFIG } from '@/constants/config';

// what data our context provide to the app ?
type CompanyContextType = {
    activeCompany: string | null;
    companies: any[];
    defaultCurrency: string;
    setActiveCompany: (company: string) => void;

};

const companyContext = createContext<CompanyContextType>(
    {
        activeCompany: null,
        companies: [],
        defaultCurrency: 'USD',
        setActiveCompany: () => { }
    }
);
export const useCompanyContext = () =>
    useContext(companyContext);

export const CompanyProvider = ({
    children }: { children: React.ReactNode }) => {
    const { getResource, baseUrl, company: currentCompany } = useFrappe();
    // need to create state inside components.
    const [activeCompany, setActiveCompany] = useState<string | null>(null);
    const [companies, setCompanies] = useState<any[]>([]);
    const [defaultCurrency, setDefaultCurrency] = useState<string>('USD');

    useEffect(() => {
        const fetchCompanies = async () => {
            const savedUrl = await storage.getItem('dynamic_base_url');
            if (baseUrl === MASTER_SITE_CONFIG.baseUrl && !savedUrl) {
                setCompanies([]);
                return;
            }

            // Clear existing companies to avoid showing stale Master Site data if this fails
            setCompanies([]);

            //1.if the user previously selected the company
            const savedCompany = await storage.getItem('dynamic_company');
            //2. fetch the allowed companies from frappe
            try {
                const res = await getResource('Company', undefined, {
                    limit_page_length: 50,
                    fields: '["name", "company_name", "default_currency"]'
                });
                if (Array.isArray(res) && res.length > 0) {
                    setCompanies(res);
                    if (savedCompany && res.some(c => c.name === savedCompany)) {
                        setActiveCompany(savedCompany);
                        const matched = res.find(c => c.name === savedCompany);
                        setDefaultCurrency(matched?.default_currency || 'USD');
                    }
                    else {
                        setActiveCompany(res[0].name);
                        setDefaultCurrency(res[0].default_currency || 'USD');
                        await storage.setItem('dynamic_company', res[0].name);
                    }
                }
            } catch (err) {
                console.log('Error while fetching allowed companies', err);
            }
        };

        // Don't fetch if baseUrl is still pointing to the master site while trying to fetch tenant data
        fetchCompanies();

    }, [baseUrl, currentCompany]);

    const handleSelectCompany = async (companyName: string) => {
        await storage.setItem('dynamic_company', companyName);
        setActiveCompany(companyName);
        
        const matched = companies.find(c => c.name === companyName);
        setDefaultCurrency(matched?.default_currency || 'USD');
    };

    return (
        <companyContext.Provider value={{ activeCompany, companies, defaultCurrency, setActiveCompany: handleSelectCompany }}>
            {children}
        </companyContext.Provider>
    );
};
