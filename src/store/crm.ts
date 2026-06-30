import { create } from 'zustand';

interface CRMStore {
  selectedContactId: string | null;
  selectedDealId: string | null;
  selectedCompanyId: string | null;
  filters: {
    contactStatus: string | null;
    dealStage: string | null;
  };
  
  setSelectedContact: (id: string | null) => void;
  setSelectedDeal: (id: string | null) => void;
  setSelectedCompany: (id: string | null) => void;
  setContactFilter: (status: string | null) => void;
  setDealFilter: (stage: string | null) => void;
  resetFilters: () => void;
}

export const useCRMStore = create<CRMStore>((set) => ({
  selectedContactId: null,
  selectedDealId: null,
  selectedCompanyId: null,
  filters: {
    contactStatus: null,
    dealStage: null,
  },
  
  setSelectedContact: (id) => set({ selectedContactId: id }),
  setSelectedDeal: (id) => set({ selectedDealId: id }),
  setSelectedCompany: (id) => set({ selectedCompanyId: id }),
  setContactFilter: (status) =>
    set((state) => ({
      filters: { ...state.filters, contactStatus: status },
    })),
  setDealFilter: (stage) =>
    set((state) => ({
      filters: { ...state.filters, dealStage: stage },
    })),
  resetFilters: () =>
    set({
      filters: { contactStatus: null, dealStage: null },
    }),
}));
