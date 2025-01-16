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

    updateState(filters) {
      // Save complete filter state including all properties
      const completeState = {
        filters: filters.map((filter) => ({
          type: filter.type,
          frequency: filter.frequency,
          gain: filter.gain,
          Q: filter.Q,
          bypass: filter.bypass,
        })),
      }

      this.savedState = completeState
      this.saveToLocalStorage()
    },

    saveToLocalStorage() {
      try {
        if (this.savedState) {
          console.log('Saving complete state:', this.savedState)
          localStorage.setItem('equalizerState', JSON.stringify(this.savedState))
          return true
        }
        return false
      } catch (error) {
        console.error('Error saving equalizer state:', error)
        return false
      }
    },

    loadFromLocalStorage() {
      try {
        const savedState = localStorage.getItem('equalizerState')
        if (savedState) {
          const parsedState = JSON.parse(savedState)
          // Validate that we have all required properties
          if (parsedState.filters && parsedState.filters.length > 0) {
            this.savedState = parsedState
            console.log('Loaded complete state:', this.savedState)
            return this.savedState
          }
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
  },
})
