import { defineStore } from 'pinia';

const WORD_ANNOTATIONS_KEY = 'ritual.showWordAnnotations';
const SIDEBAR_KEY = 'ritual.sidebarCollapsed';

export const usePrefsStore = defineStore('prefs', {
  state: () => ({
    showWordAnnotations: localStorage.getItem(WORD_ANNOTATIONS_KEY) === 'true',
    sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === 'true',
  }),
  actions: {
    setShowWordAnnotations(value: boolean) {
      this.showWordAnnotations = value;
      localStorage.setItem(WORD_ANNOTATIONS_KEY, String(value));
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      localStorage.setItem(SIDEBAR_KEY, String(this.sidebarCollapsed));
    },
  },
});
