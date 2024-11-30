import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import EqualizerView from '../views/EqualizerView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/equalizer',
      name: 'equalizer',
      component: EqualizerView,
    },
  ],
})

export default router
