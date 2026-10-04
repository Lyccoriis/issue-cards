import { create } from 'zustand';

export type PictureKind = 'avatar' | 'banner';

interface UiStore {
  issueFormOpen: boolean;
  editingId: string | null;
  openIssueForm: (cardId: string | null) => void;
  closeIssueForm: () => void;
  sheetImportOpen: boolean;
  openSheetImport: () => void;
  closeSheetImport: () => void;
  testFormOpen: boolean;
  editingFeatureId: string | null;
  openTestForm: (featureId: string | null) => void;
  closeTestForm: () => void;
  fixCardId: string | null;
  rejectCardId: string | null;
  askFix: (cardId: string) => void;
  askReject: (cardId: string) => void;
  closeStatusAsk: () => void;
  pictureOpen: boolean;
  pictureKind: PictureKind;
  openPicture: (kind?: PictureKind) => void;
  closePicture: () => void;
  profileUserId: string | null;
  openUserProfile: (userId: string) => void;
  closeUserProfile: () => void;
  trayOpen: boolean;
  setTrayOpen: (open: boolean) => void;
}

export const useUiStore = create<UiStore>(set => ({
  issueFormOpen: false,
  editingId: null,
  openIssueForm: cardId => set({ issueFormOpen: true, editingId: cardId }),
  closeIssueForm: () => set({ issueFormOpen: false, editingId: null }),
  sheetImportOpen: false,
  openSheetImport: () => set({ sheetImportOpen: true }),
  closeSheetImport: () => set({ sheetImportOpen: false }),
  testFormOpen: false,
  editingFeatureId: null,
  openTestForm: featureId => set({ testFormOpen: true, editingFeatureId: featureId }),
  closeTestForm: () => set({ testFormOpen: false, editingFeatureId: null }),
  fixCardId: null,
  rejectCardId: null,
  askFix: cardId => set({ fixCardId: cardId, rejectCardId: null }),
  askReject: cardId => set({ rejectCardId: cardId, fixCardId: null }),
  closeStatusAsk: () => set({ fixCardId: null, rejectCardId: null }),
  pictureOpen: false,
  pictureKind: 'avatar',
  openPicture: (kind = 'avatar') => set({ pictureOpen: true, pictureKind: kind }),
  closePicture: () => set({ pictureOpen: false }),
  profileUserId: null,
  openUserProfile: userId => set({ profileUserId: userId }),
  closeUserProfile: () => set({ profileUserId: null }),
  trayOpen: false,
  setTrayOpen: open => set({ trayOpen: open }),
}));

export function openUserProfile(userId: string): void {
  useUiStore.getState().openUserProfile(userId);
}
