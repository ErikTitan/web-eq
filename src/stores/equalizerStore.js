import { defineStore } from 'pinia'

export const useEqualizerStore = defineStore('equalizer', {
  state: () => ({
    savedState: null,
    defaultFilters: [
      { type: 'lowshelf12', frequency: 80, gain: 0, Q: 1, bypass: false },
      { type: 'peaking12', frequency: 200, gain: 0, Q: 1, bypass: false },
      { type: 'peaking12', frequency: 500, gain: 0, Q: 1, bypass: false },
      { type: 'highshelf12', frequency: 1000, gain: 0, Q: 1, bypass: false },
    ],
  }),

  actions: {
    setupStateListener(weq8Instance) {
      if (!weq8Instance) return

      weq8Instance.on('filtersChanged', (state) => {
        console.log('Filter state changed:', state)
        this.savedState = state
      })
    },

    saveState() {
      try {
        if (this.savedState) {
          console.log('Saving state:', this.savedState)
          localStorage.setItem('equalizerState', JSON.stringify(this.savedState))
          return true
        }
        return false
      } catch (error) {
        console.error('Error saving equalizer state:', error)
        return false
      }
    },

    loadState() {
      try {
        const savedState = localStorage.getItem('equalizerState')
        if (savedState) {
          this.savedState = JSON.parse(savedState)
          console.log('Loaded state:', this.savedState)
          return this.savedState
        }
        return null
      } catch (error) {
        console.error('Error loading equalizer state:', error)
        return null
      }
    },

    getDefaultFilters() {
      return [...this.defaultFilters]
    },

    updateState(filters) {
      this.savedState = {
        filters: filters.map((f) => ({ ...f })),
      }
    },
  },
})
