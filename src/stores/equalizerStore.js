import { defineStore } from 'pinia'

export const useEqualizerStore = defineStore('equalizer', {
  state: () => ({
    filters: [
      { type: 'lowshelf12', frequency: 80, gain: 0, Q: 1, bypass: false, position: { x: 0, y: 0 } },
      { type: 'peaking12', frequency: 200, gain: 0, Q: 1, bypass: false, position: { x: 0, y: 0 } },
      { type: 'peaking12', frequency: 500, gain: 0, Q: 1, bypass: false, position: { x: 0, y: 0 } },
      {
        type: 'highshelf12',
        frequency: 1000,
        gain: 0,
        Q: 1,
        bypass: false,
        position: { x: 0, y: 0 },
      },
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
      if (!this.weq8State) {
        this.weq8State = { filters: [], filterPositions: [] }
      }

      // Update the filter's position in the store
      this.filters[index].position = position

      // Create updated positions array
      const filterPositions = this.filters.map((f) => f.position)

      // Update weq8State with new positions while preserving other state
      const updatedState = {
        ...this.weq8State,
        filterPositions,
      }

      this.updateWEQ8State(updatedState)
    },

    updateWEQ8State(state) {
      this.weq8State = {
        filters: state.filters || [],
        filterPositions: state.filterPositions || [],
        ...state,
      }
      localStorage.setItem('weq8State', JSON.stringify(this.weq8State))
    },

    loadSavedState() {
      const savedState = localStorage.getItem('weq8State')
      if (savedState) {
        const state = JSON.parse(savedState)
        this.weq8State = state

        // Update filters with saved positions
        if (state.filterPositions) {
          this.filters = this.filters.map((filter, index) => ({
            ...filter,
            position: state.filterPositions[index] || { x: 0, y: 0 },
          }))
        }
      }
      return this.weq8State
    },
  },
})
