<script>
import Card from 'primevue/card';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Toast from 'primevue/toast';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';
import FileUpload from 'primevue/fileupload';

import { WEQ8Runtime } from 'weq8';
import { useEqualizerStore } from '@/stores/equalizerStore';

import GridCanvas from '@/components/GridCanvas.vue';
import AnalyzerCanvas from '@/components/AnalyzerCanvas.vue';
import ResponseCanvas from '@/components/ResponseCanvas.vue';
import FilterHandles from '@/components/FilterHandles.vue';
import BandControls from '@/components/BandControls.vue';

export default {
    name: 'Equalizer',
    components: {
        FileUpload,
        Toast,
        Select,
        Card,
        Button,
        Dialog,
        Textarea,
        GridCanvas,
        AnalyzerCanvas,
        ResponseCanvas,
        FilterHandles,
        BandControls,
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
            showExportDialog: false,
            showImportDialog: false,
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
                if (this.filterHasGain(filter.type)) {
                    this.weq8.setFilterGain(index, filter.gain);
                }
                if (this.filterHasQ(filter.type)) {
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
                this.filters = this.createSpacedFilters(defaultFilters);
            }
        },

        createSpacedFilters(defaultFilters) {
            const minF = Math.log10(80);
            const maxF = Math.log10(this.nyquist * 0.75);
            const step = (maxF - minF) / (defaultFilters.length - 1);

            return defaultFilters.map((defaultFilter, index) => {
                const frequency = Math.pow(10, minF + step * index);
                return {
                    ...defaultFilter,
                    frequency,
                    gain: 0,
                    Q: defaultFilter.Q || 1,
                    bypass: false
                };
            });
        },

        // Filter interaction methods
        startDragging(event, index) {
            event.preventDefault();
            event.stopPropagation();

            const handle = event.target;
            handle.setPointerCapture(event.pointerId);

            this.selectedPoint = index;
            this.isDragging = true;
        },

        stopDragging(event) {
            if (this.selectedPoint !== null) {
                const handle = event.target;
                handle.releasePointerCapture(event.pointerId);

                const completeState = {
                    filters: this.filters.map(filter => ({
                        type: filter.type,
                        frequency: filter.frequency,
                        gain: filter.gain,
                        Q: filter.Q,
                        bypass: filter.bypass
                    }))
                };

                this.equalizerStore.savedState = completeState;
                this.equalizerStore.saveToLocalStorage();
            }
            this.isDragging = false;
            this.selectedPoint = null;
        },

        handleDrag(event) {
            if (!this.isDragging || this.selectedPoint === null) return;

            const canvas = this.$refs.eqContainer;
            const rect = canvas.getBoundingClientRect();

            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const width = rect.width;
            const minF = Math.log10(20);
            const maxF = Math.log10(this.nyquist);
            const logX = (x / width) * (maxF - minF) + minF;
            const newFreq = Math.pow(10, logX);

            const height = rect.height;
            const newGain = 15 - ((y / height) * 30);

            const filter = this.filters[this.selectedPoint];
            if (this.filterHasGain(filter.type)) {
                this.updateFilter(this.selectedPoint, 'gain', Math.max(-15, Math.min(15, newGain)));
            }

            const clampedFreq = Math.max(20, Math.min(this.nyquist, newFreq));
            this.updateFilter(this.selectedPoint, 'frequency', clampedFreq);
        },

        handleFilterScroll(event, index) {
            event.preventDefault();
            const filter = this.filters[index];
            if (!this.filterHasQ(filter.type)) return;

            const delta = Math.sign(event.deltaY) * -1;
            const step = 0.1;
            const newQ = Math.max(0.1, Math.min(10, filter.Q + (delta * step)));

            this.updateFilter(index, 'Q', newQ);
        },

        // Filter update methods
        async updateFilter(index, property, value) {
            const filter = this.filters[index];
            const startValue = filter[property];

            if (property === 'frequency' || property === 'gain' || property === 'Q') {
                if (property === 'gain') {
                    filter[property] = value;
                } else {
                    const transitionedValue = await this.smoothTransition(startValue, value);
                    filter[property] = transitionedValue;
                }
            } else {
                filter[property] = value;
            }

            if (!this.weq8) return;

            switch (property) {
                case 'type':
                    this.weq8.setFilterType(index, value);
                    break;
                case 'frequency':
                    this.weq8.setFilterFrequency(index, value);
                    break;
                case 'gain':
                    if (this.filterHasGain(filter.type)) {
                        this.weq8.setFilterGain(index, value);
                    }
                    break;
                case 'Q':
                    if (this.filterHasQ(filter.type)) {
                        this.weq8.setFilterQ(index, value);
                    }
                    break;
                case 'bypass':
                    this.weq8.toggleBypass(index, value);
                    break;
            }
        },

        // Helper methods
        smoothTransition(startValue, endValue, duration = 50) {
            return new Promise(resolve => {
                const startTime = performance.now();

                const animate = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    const eased = progress < 0.5
                        ? 4 * progress * progress * progress
                        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                    const currentValue = startValue + (endValue - startValue) * eased;

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        resolve(endValue);
                    }

                    return currentValue;
                };

                requestAnimationFrame(animate);
            });
        },

        filterHasGain(type) {
            return [
                'lowshelf12', 'lowshelf24',
                'highshelf12', 'highshelf24',
                'peaking12', 'peaking24'
            ].includes(type);
        },

        filterHasQ(type) {
            return [
                'lowpass12', 'lowpass24',
                'highpass12', 'highpass24',
                'bandpass12', 'bandpass24',
                'peaking12', 'peaking24',
                'notch12', 'notch24'
            ].includes(type);
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

        // Preset and settings methods
        resetEQ() {
            const defaultFilters = this.equalizerStore.getDefaultFilters();
            this.filters = this.createSpacedFilters(defaultFilters);

            this.filters.forEach((filter, index) => {
                this.weq8.setFilterType(index, defaultFilters[index].type);
                this.weq8.setFilterFrequency(index, filter.frequency);
                this.weq8.setFilterGain(index, 0);
                this.weq8.toggleBypass(index, false);
                this.updateFilter(index, 'Q', 1);
            });

            this.$toast.add({ severity: 'secondary', summary: 'Reset', detail: 'EQ settings have been reset to default', life: 3000 });
        },

        exportSettings() {
            const exportData = {
                name: this.preset.name,
                description: this.preset.description,
                filters: this.filters.map(filter => ({
                    type: filter.type,
                    frequency: filter.frequency,
                    gain: filter.gain,
                    Q: filter.Q,
                    bypass: filter.bypass
                })),
                metadata: {
                    createdAt: new Date().toISOString(),
                    version: "1.0.0",
                    application: "PULSE-EQ"
                }
            };

            this.exportedSettings = JSON.stringify(exportData, null, 2);
            this.showExportDialog = true;
        },

        downloadPreset() {
            try {
                const exportData = JSON.parse(this.exportedSettings);
                const fileName = `${this.preset.name.toLowerCase().replace(/\s+/g, '-')}-preset.json`;

                const blob = new Blob([this.exportedSettings], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                this.$toast.add({
                    severity: 'success',
                    summary: 'Downloaded!',
                    detail: 'Preset file downloaded successfully',
                    life: 3000
                });
                this.showExportDialog = false;
            } catch (err) {
                this.$toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to download preset file',
                    life: 3000
                });
            }
        },

        async copyToClipboard() {
            try {
                await navigator.clipboard.writeText(this.exportedSettings);
                this.$toast.add({
                    severity: 'success',
                    summary: 'Copied!',
                    detail: 'Settings copied to clipboard',
                    life: 3000
                });
            } catch (err) {
                this.$toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to copy settings',
                    life: 3000
                });
            }
        },

        handleFileImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    this.importedSettings = JSON.stringify(importData, null, 2);
                } catch (err) {
                    this.$toast.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Invalid preset file format',
                        life: 3000
                    });
                }
            };
            reader.readAsText(file);
        },

        confirmImport() {
            try {
                const importData = JSON.parse(this.importedSettings);

                if (!importData.filters || !Array.isArray(importData.filters)) {
                    throw new Error('Invalid filter settings format');
                }

                importData.filters.forEach(filter => {
                    if (!filter.type || !filter.frequency || typeof filter.gain !== 'number') {
                        throw new Error('Invalid filter configuration');
                    }
                });

                this.applyImportedSettings(importData);

                this.$toast.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'Filter settings imported successfully',
                    life: 3000
                });

                this.showImportDialog = false;
                this.importedSettings = '';
            } catch (err) {
                this.$toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Invalid filter settings format',
                    life: 3000
                });
            }
        },

        cancelImport() {
            this.clearUpload();
            this.showImportDialog = false;
        },

        applyImportedSettings(importData) {
            this.source.disconnect();
            this.weq8.disconnect();

            this.weq8 = new WEQ8Runtime(this.audioContext);
            this.filters = importData.filters.map(filter => ({
                ...filter,
                Q: filter.Q || 1,
                bypass: filter.bypass || false
            }));

            this.filters.forEach((filter, index) => {
                this.weq8.setFilterType(index, filter.type);
                this.weq8.setFilterFrequency(index, filter.frequency);
                if (this.filterHasGain(filter.type)) {
                    this.weq8.setFilterGain(index, filter.gain);
                }
                if (this.filterHasQ(filter.type)) {
                    this.weq8.setFilterQ(index, filter.Q);
                }
                this.weq8.toggleBypass(index, filter.bypass);
            });

            this.source.connect(this.weq8.input);
            this.weq8.connect(this.analyserNode);
        },

        onFileSelect(event) {
            const file = event.files[0];

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    this.importedSettings = JSON.stringify(importData, null, 2);
                    this.uploadedFile = file;
                } catch (err) {
                    this.$toast.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Invalid preset file format',
                        life: 3000
                    });
                }
            };
            reader.readAsText(file);
        },

        formatSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        clearUpload() {
            this.uploadedFile = null;
            this.importedSettings = '';
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
                    <Card class="h-full shadow-xl">
                        <template #title>
                            <div class="text-xl font-semibold mb-2">Controls</div>
                        </template>
                        <template #content>
                            <Toast />
                            <div class="flex flex-col gap-2">
                                <Button label="Export Preset" severity="primary" rounded @click="exportSettings" />
                                <Button label="Import Preset" outlined rounded @click="showImportDialog = true" />
                                <Button label="Reset" severity="secondary" outlined rounded @click="resetEQ" />
                            </div>

                            <!-- Export Dialog -->
                            <Dialog v-model:visible="showExportDialog" header="Export Filter Settings" modal
                                style="width: 50vw">
                                <div class="flex flex-col gap-4">
                                    <div class="text-sm">Your filter settings:</div>
                                    <Textarea v-model="exportedSettings" size="small" autoResize readonly />
                                    <div class="flex justify-between gap-4">
                                        <Button label="Copy to Clipboard" severity="secondary"
                                            @click="copyToClipboard" />
                                        <Button label="Download File" severity="primary" @click="downloadPreset" />
                                    </div>
                                </div>
                            </Dialog>

                            <!-- Import Dialog -->
                            <Dialog v-model:visible="showImportDialog" header="Import Preset" modal style="width: 60vw"
                                @hide="cancelImport">
                                <div class="flex flex-col gap-6">
                                    <div class="text-sm text-gray-600 mb-2">
                                        Import a PULSE-EQ preset file or paste settings directly:
                                    </div>

                                    <FileUpload mode="basic" name="preset" accept=".json" :maxFileSize="1000000"
                                        :auto="true" chooseLabel="Choose Preset File" class="mb-4"
                                        @select="onFileSelect" :customUpload="true">
                                    </FileUpload>

                                    <div class="flex flex-col gap-2">
                                        <label class="text-sm text-gray-600">Or Paste Settings:</label>
                                        <Textarea v-model="importedSettings" size="small" autoResize
                                            placeholder="Paste PULSE-EQ preset JSON here..." />
                                    </div>

                                    <div class="flex justify-end gap-3 mt-4">
                                        <Button label="Cancel" severity="secondary" text @click="cancelImport" />
                                        <Button label="Import Preset" severity="primary" :disabled="!importedSettings"
                                            @click="confirmImport" />
                                    </div>
                                </div>
                            </Dialog>
                        </template>
                    </Card>
                </div>

                <!-- Middle Card -->
                <div class="col-span-12 lg:col-span-8">
                    <Card class="h-full shadow-xl">
                        <template #title>
                            <div class="text-2xl font-semibold mb-2">{{ preset.name }}</div>
                        </template>
                        <template #content>
                            <div class="flex flex-col items-center justify-center">
                                <div ref="eqContainer"
                                    class="border w-full h-96 relative mb-6 bg-gray-900 rounded-lg overflow-hidden"
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