import { create } from "zustand";

export const useProfileModalStore = create((set) => ({
  open: false,
  openModal: () => set({ open: true }),
  closeModal: () => set({ open: false }),
}));
