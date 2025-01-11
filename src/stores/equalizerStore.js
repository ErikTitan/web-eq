import { defineStore } from 'pinia'

export const useEqualizerStore = defineStore('equalizer', {
  state: () => ({
    filters: [
      { type: 'lowshelf12', frequency: 80, gain: 0, Q: 1, bypass: false },
      { type: 'peaking12', frequency: 200, gain: 0, Q: 1, bypass: false },
      { type: 'peaking12', frequency: 500, gain: 0, Q: 1, bypass: false },
      { type: 'highshelf12', frequency: 1000, gain: 0, Q: 1, bypass: false },
    ],
    weq8State: null,
  }),

  actions: {
    updateFilters(filters) {
      this.filters = filters.map((filter) => ({
        ...filter,
        position: filter.position || { x: 0, y: 0 },
      }))
    },

    updateFilterPosition(index, position) {
      this.filters[index].position = position
      this.updateWEQ8State({
        ...this.weq8State,
        filterPositions: this.filters.map((f) => f.position),
      })
    },

    updateWEQ8State(state) {
      this.weq8State = state
      localStorage.setItem('weq8State', JSON.stringify(state))
    },

    loadSavedState() {
      const savedState = localStorage.getItem('weq8State')
      if (savedState) {
        this.weq8State = JSON.parse(savedState)
      }
      return this.weq8State
    },
  },
})
