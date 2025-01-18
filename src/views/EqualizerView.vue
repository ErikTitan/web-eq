<script>
import Card from 'primevue/card';
import Button from 'primevue/button';
import Select from 'primevue/select';

import { WEQ8Runtime } from 'weq8';
import { useEqualizerStore } from '@/stores/equalizerStore';

import GridCanvas from '@/components/GridCanvas.vue';
import AnalyzerCanvas from '@/components/AnalyzerCanvas.vue';
import ResponseCanvas from '@/components/ResponseCanvas.vue';
import FilterHandles from '@/components/FilterHandles.vue';
import BandControls from '@/components/BandControls.vue';
import EqControls from '@/components/EqControls.vue';

export default {
    name: 'Equalizer',
    components: {
        Select,
        Card,
        Button,
        GridCanvas,
        AnalyzerCanvas,
        ResponseCanvas,
        FilterHandles,
        BandControls,
        EqControls
    },
    data() {
        const equalizerStore = useEqualizerStore();
        return {
            equalizerStore,
            preset: {
                name: 'Equalizer',
                description: '',
            },
            uploadedFile: null,
            exportedSettings: '',
            importedSettings: '',
            analyserNode: null,
            audio: null,
            audioContext: null,
            source: null,
            weq8: null,
            filters: equalizerStore.getDefaultFilters(),
            filterTypes: [
                { label: 'LP', value: 'lowpass12' },
                { label: 'HP', value: 'highpass12' },
                { label: 'BP', value: 'bandpass12' },
                { label: 'LS', value: 'lowshelf12' },
                { label: 'HS', value: 'highshelf12' },
                { label: 'PK', value: 'peaking12' },
                { label: 'NO', value: 'notch12' },
                { label: 'OFF', value: 'noop' }
            ],
            selectedPoint: null,
            isDragging: false,
            devicePixelRatio: window.devicePixelRatio || 1,
            nyquist: 24000,
        }
    },
    methods: {
        // Audio initialization and setup
        initializeAudio() {
            return new Promise(async (resolve) => {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.nyquist = this.audioContext.sampleRate / 2;
                const audioPath = new URL('@/assets/audio/sample_audio.mp3', import.meta.url).href;
                this.audio = new Audio(audioPath);
                this.source = this.audioContext.createMediaElementSource(this.audio);
                this.weq8 = new WEQ8Runtime(this.audioContext);

                // Initialize analyzer node here
                this.analyserNode = this.audioContext.createAnalyser();
                this.analyserNode.fftSize = 8192;
                this.analyserNode.smoothingTimeConstant = 0.5;

                // Set up audio routing
                this.source.connect(this.weq8.input);
                this.weq8.connect(this.analyserNode);
                this.analyserNode.connect(this.audioContext.destination);

                // Try to load saved state
                const savedState = this.equalizerStore.loadFromLocalStorage();

                if (savedState && savedState.filters) {
                    this.initializeWithSavedState(savedState);
                } else {
                    this.initializeFilterPositions();
                }

                resolve();
            });
        },

        initializeWithSavedState(savedState) {
            this.filters = savedState.filters.map(filter => ({
                type: filter.type,
                frequency: filter.frequency,
                gain: filter.gain,
                Q: filter.Q || 1,
                bypass: filter.bypass
            }));

            this.filters.forEach((filter, index) => {
                this.weq8.setFilterType(index, filter.type);
                this.weq8.setFilterFrequency(index, filter.frequency);
                if (this.equalizerStore.filterHasGain(filter.type)) {
                    this.weq8.setFilterGain(index, filter.gain);
                }
                if (this.equalizerStore.filterHasQ(filter.type)) {
                    this.weq8.setFilterQ(index, filter.Q);
                }
                this.weq8.toggleBypass(index, filter.bypass);
            });
        },

        initializeFilterPositions() {
            const savedState = this.equalizerStore.loadFromLocalStorage();

            if (savedState && savedState.filters) {
                this.filters = savedState.filters.map(filter => ({
                    ...filter,
                    Q: filter.Q || 1,
                    bypass: filter.bypass || false
                }));
            } else {
                const defaultFilters = this.equalizerStore.getDefaultFilters();
                this.filters = this.equalizerStore.createSpacedFilters(defaultFilters);
            }
        },

        // Filter interaction methods
        startDragging(event, index) {
            this.equalizerStore.startDragging(event, index)
        },

        stopDragging(event) {
            this.equalizerStore.stopDragging(event, this.filters)
        },

        handleDrag(event) {
            this.equalizerStore.handleDrag(
                event,
                this.$refs.eqContainer,
                this.filters,
                this.weq8,
                this.nyquist
            )
        },

        handleFilterScroll(event, index) {
            this.equalizerStore.handleFilterScroll(event, index, this.filters, this.weq8)
        },

        updateFilter(index, property, value) {
            this.equalizerStore.updateFilter(
                index,
                property,
                value,
                this.filters,
                this.weq8
            )
        },

        // Audio control methods
        playAudio() {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.audio.play();
        },

        pauseAudio() {
            this.audio.pause();
        },

    },

    async mounted() {

        await this.initializeAudio();
    },

    beforeUnmount() {
        if (this.analyserNode) {
            this.analyserNode.disconnect();
        }
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}
</script>

<template>
    <div class="flex flex-col">
        <div class="flex-1 pt-24 px-6 lg:px-20">
            <div class="grid grid-cols-12 gap-6 h-full">
                <!-- Left Card -->
                <div class="col-span-12 lg:col-span-2">
                    <div class="col-span-12 lg:col-span-2">
                        <EqControls :weq8="weq8" :filters="filters" :audio-context="audioContext" :source="source"
                            :analyser-node="analyserNode" @update:filters="filters = $event"
                            @update-weq8="weq8 = $event" />
                    </div>
                </div>

                <!-- Middle Card -->
                <div class="col-span-12 lg:col-span-8">
                    <Card class="shadow-xl">
                        <template #title>
                            <div class="text-2xl font-semibold mb-2">{{ preset.name }}</div>
                        </template>
                        <template #content>
                            <div class="flex flex-col items-center justify-center">
                                <div ref="eqContainer"
                                    class="border w-full h-96 shadow-xl relative mb-6 bg-gray-900 rounded-lg overflow-hidden"
                                    style="background-color: var(--eq-background)">
                                    <GridCanvas :nyquist="nyquist" :device-pixel-ratio="devicePixelRatio" />
                                    <AnalyzerCanvas v-if="analyserNode" :analyser-node="analyserNode" :nyquist="nyquist"
                                        :device-pixel-ratio="devicePixelRatio" />
                                    <ResponseCanvas :weq8="weq8" :filters="filters" :nyquist="nyquist"
                                        :device-pixel-ratio="devicePixelRatio" @pointermove="handleDrag"
                                        @pointerup="stopDragging" @pointerleave="stopDragging" />
                                    <FilterHandles :filters="filters" :selected-point="selectedPoint" :nyquist="nyquist"
                                        @update:filters="filters = $event" @pointerdown="startDragging"
                                        @pointermove="handleDrag" @pointerup="stopDragging"
                                        @pointercancel="stopDragging" @wheel="handleFilterScroll" />
                                </div>
                                <div class="flex gap-4">
                                    <Button icon="pi pi-play" severity="success" @click="playAudio" />
                                    <Button icon="pi pi-pause" severity="secondary" @click="pauseAudio" />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- Right Card - Filter Controls -->
                <div class="col-span-12 lg:col-span-2">
                    <Card class="h-full shadow-xl">
                        <template #title>
                            <div class="text-xl font-semibold mb-4">Band Controls</div>
                        </template>
                        <template #content>
                            <BandControls :filters="filters" :filter-types="filterTypes" :nyquist="nyquist" :weq8="weq8"
                                @update-filter="updateFilter" />
                        </template>
                    </Card>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
canvas {
    image-rendering: pixelated;
    background: transparent;
}
</style>