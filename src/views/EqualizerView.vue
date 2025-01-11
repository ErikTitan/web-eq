<script>
import Card from 'primevue/card';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
import FloatLabel from 'primevue/floatlabel';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';

import { WEQ8Runtime } from 'weq8'

export default {
    name: 'Equalizer',
    components: {
        Checkbox,
        Select,
        FloatLabel,
        Card,
        Button,
        InputNumber,
        Slider,
    },
    data() {
        return {
            preset: {
                name: 'Equalizer',
                description: '',
            },
            analyserNode: null,
            animationFrame: null,
            audio: null,
            audioContext: null,
            source: null,
            weq8: null,
            filters: [
                { type: 'lowshelf12', frequency: 80, gain: 0, Q: 1, bypass: false },
                { type: 'peaking12', frequency: 200, gain: 0, Q: 1, bypass: false },
                { type: 'peaking12', frequency: 500, gain: 0, Q: 1, bypass: false },
                { type: 'highshelf12', frequency: 1000, gain: 0, Q: 1, bypass: false },
            ],
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
            resizeObserver: null,
            frequencies: null,
            analysisData: null,
            analysisXs: [],
            devicePixelRatio: window.devicePixelRatio || 1,
            nyquist: 24000,
        }
    },
    methods: {
        // Audio initialization and setup
        initializeAudio() {
            return new Promise(resolve => {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.nyquist = this.audioContext.sampleRate / 2;
                const audioPath = new URL('@/assets/audio/sample_audio.mp3', import.meta.url).href;
                this.audio = new Audio(audioPath);
                this.source = this.audioContext.createMediaElementSource(this.audio);
                this.weq8 = new WEQ8Runtime(this.audioContext);
                this.initializeAnalyzer();
                this.initializeFilterPositions();
                resolve();
            });
        },

        initializeFilterPositions() {
            return new Promise(resolve => {
                const canvas = this.$refs.responseCanvas;
                if (!canvas) return resolve();

                // Initialize filters with logarithmically spaced frequencies
                const minF = Math.log10(20);
                const maxF = Math.log10(this.nyquist);
                const step = (maxF - minF) / (this.filters.length - 1);

                this.filters = this.filters.map((filter, index) => {
                    const frequency = Math.pow(10, minF + step * index);
                    return {
                        ...filter,
                        frequency,
                        gain: 0,
                        Q: filter.Q || 1,
                        bypass: false
                    };
                });

                this.drawFrequencyResponse();
                resolve();
            });
        },

        initializeAnalyzer() {
            // Set up analyzer node
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 8192;
            this.analyserNode.smoothingTimeConstant = 0.5;

            // Connect to audio chain
            this.source.connect(this.weq8.input);
            this.weq8.connect(this.analyserNode);
            this.analyserNode.connect(this.audioContext.destination);

            // Initialize analysis data
            this.analysisData = new Uint8Array(this.analyserNode.frequencyBinCount);

            // Calculate initial positions
            this.updateAnalysisPositions();

            // Set up resize observer
            this.resizeObserver = new ResizeObserver(() => {
                this.updateAnalysisPositions();
            });

            if (this.$refs.analyserCanvas) {
                this.resizeObserver.observe(this.$refs.analyserCanvas);
            }
        },
        // Analyzer methods
        updateAnalysisPositions() {
            const canvas = this.$refs.analyserCanvas;
            const nyquist = this.nyquist;
            if (!canvas) return;

            // Update canvas dimensions with device pixel ratio
            canvas.width = canvas.offsetWidth * this.devicePixelRatio;
            canvas.height = canvas.offsetHeight * this.devicePixelRatio;

            // Calculate frequency to x-position mapping
            const maxLog = Math.log10(nyquist) - 1;

            this.analysisXs = Array.from(this.analysisData).map((_, i) => {
                const freq = (i / this.analysisData.length) * nyquist;
                return Math.floor(((Math.log10(freq) - 1) / maxLog) * canvas.width);
            });
        },

        drawAnalyzer() {
            if (this.disposed) return;

            const canvas = this.$refs.analyserCanvas;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Get latest frequency data
            this.analyserNode.getByteFrequencyData(this.analysisData);

            const w = canvas.width;
            const h = canvas.height;
            const yScale = h / 255;

            ctx.clearRect(0, 0, w, h);

            // Create path for analyzer visualization
            let path = new Path2D();
            path.moveTo(0, h);

            // Draw using pre-calculated x positions
            for (let i = 0; i < this.analysisData.length; i++) {
                // Smoothing
                const rawY = this.analysisData[i];
                const smoothedY = Math.floor(h - rawY * yScale);
                path.lineTo(this.analysisXs[i], smoothedY);
            }

            path.lineTo(w, h);

            // Fill 
            ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
            ctx.fill(path);

            // Stroke
            ctx.shadowBlur = 2;
            ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)';
            ctx.lineWidth = 1;
            ctx.stroke(path);
            ctx.shadowBlur = 0;

            // Request next frame
            this.animationFrame = requestAnimationFrame(() => this.drawAnalyzer());
        },
        // Frequency grid methods
        calculateGridLines() {
            const nyquist = this.nyquist;
            const xLevelsOfScale = Math.floor(Math.log10(nyquist));
            const gridXs = [];

            // Calculate frequency grid lines
            for (let los = 0; los < xLevelsOfScale; los++) {
                let step = Math.pow(10, los + 1);
                for (let i = 1; i < 10; i++) {
                    let freq = step * i;
                    if (freq > nyquist) break;
                    gridXs.push(((Math.log10(freq) - 1) / (Math.log10(nyquist) - 1)) * 100);
                }
            }

            return gridXs;
        },

        drawGrid() {
            const ctx = this.$refs.responseCanvas.getContext('2d');
            const width = this.$refs.responseCanvas.width;
            const height = this.$refs.responseCanvas.height;

            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;

            // Draw vertical frequency lines
            const gridXs = this.calculateGridLines();
            gridXs.forEach(x => {
                const xPos = (x / 100) * width;
                ctx.beginPath();
                ctx.moveTo(xPos, 0);
                ctx.lineTo(xPos, height);
                ctx.stroke();
            });

            // Draw horizontal dB lines
            [-12, -6, 0, 6, 12].forEach(db => {
                const y = height - ((db + 15) / 30) * height;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            });
        },
        // Frequency Response methods
        drawFrequencyResponse() {
            const canvas = this.$refs.responseCanvas;
            const ctx = canvas.getContext('2d');

            // Clear canvas and draw grid
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.drawGrid();

            // Calculate frequency response
            const frequencies = new Float32Array(canvas.width);
            const magResponse = new Float32Array(canvas.width);
            const phaseResponse = new Float32Array(canvas.width);
            const nyquist = this.nyquist;

            // Generate logarithmically spaced frequencies
            for (let i = 0; i < frequencies.length; i++) {
                const logScale = i / canvas.width;
                frequencies[i] = Math.pow(10, Math.log10(20) + logScale * (Math.log10(nyquist) - Math.log10(20)));
            }

            // Calculate combined response of all filters
            let combinedResponse = new Float32Array(frequencies.length).fill(1);

            this.filters.forEach((filter, index) => {
                if (!filter.bypass && filter.type !== 'noop') {
                    // Get individual filter response
                    this.weq8.getFrequencyResponse(
                        index,
                        0,
                        frequencies,
                        magResponse,
                        phaseResponse
                    );

                    // Combine responses
                    for (let i = 0; i < frequencies.length; i++) {
                        combinedResponse[i] *= magResponse[i];
                    }
                }
            });

            // Draw response curve
            ctx.beginPath();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;

            for (let i = 0; i < frequencies.length; i++) {
                const gain = combinedResponse[i];
                const db = 20 * Math.log10(gain);
                const x = i;
                const y = canvas.height - ((db + 15) / 30) * canvas.height;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();
        },

        smoothTransition(startValue, endValue, duration = 50) {
            return new Promise(resolve => {
                const startTime = performance.now();

                const animate = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    // Smooth easing function
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
        // Filter methods
        getFilterPosition(filter) {
            if (!this.$refs.responseCanvas) return { transform: 'translate(0px, 0px)' };

            const canvas = this.$refs.responseCanvas;
            const rect = canvas.getBoundingClientRect();

            // Convert frequency to x position (logarithmic scale)
            const minF = Math.log10(20);
            const maxF = Math.log10(this.nyquist);
            const logPos = (Math.log10(filter.frequency) - minF) / (maxF - minF);
            const x = logPos * rect.width;

            // Convert gain to y position (linear scale)
            const y = rect.height - ((filter.gain + 15) / 30) * rect.height;

            return {
                transform: `translate(${x}px, ${y}px)`
            };
        },

        getFilterLabel(filter) {
            return `${this.formatFrequency(filter.frequency)} ${this.formatFrequencyUnit(filter.frequency)}`;
        },

        async updateFilter(index, property, value) {
            const filter = this.filters[index];
            const startValue = filter[property];

            if (property === 'frequency' || property === 'gain' || property === 'Q') {
                // skip the transition animation for slider
                if (property === 'gain') {
                    filter[property] = value;
                } else {
                    // smooth transition for other properties
                    const transitionedValue = await this.smoothTransition(startValue, value);
                    filter[property] = transitionedValue;
                }
            } else {
                filter[property] = value;
            }

            // Update WEQ8 runtime
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

            this.drawFrequencyResponse();
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

        // Filter handle methods
        startDragging(event, index) {
            event.preventDefault();
            event.stopPropagation();

            // Capture the pointer
            const handle = event.target;
            handle.setPointerCapture(event.pointerId);

            this.selectedPoint = index;
            this.isDragging = true;
        },

        stopDragging(event) {
            if (this.selectedPoint !== null) {
                const handle = event.target;
                handle.releasePointerCapture(event.pointerId);
            }
            this.isDragging = false;
            this.selectedPoint = null;
        },

        handleDrag(event) {
            if (!this.isDragging || this.selectedPoint === null) return;

            const canvas = this.$refs.responseCanvas;
            const rect = canvas.getBoundingClientRect();

            // Get mouse position relative to canvas
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Convert x position to frequency (logarithmic)
            const width = rect.width;
            const minF = Math.log10(20);
            const maxF = Math.log10(this.nyquist);
            const logX = (x / width) * (maxF - minF) + minF;
            const newFreq = Math.pow(10, logX);

            // Convert y position to gain (-15dB to +15dB)
            const height = rect.height;
            const newGain = 15 - ((y / height) * 30);

            // Update filter values
            const filter = this.filters[this.selectedPoint];
            if (this.filterHasGain(filter.type)) {
                this.updateFilter(this.selectedPoint, 'gain', Math.max(-15, Math.min(15, newGain)));
            }

            // Update frequency
            const clampedFreq = Math.max(20, Math.min(this.nyquist, newFreq));
            this.updateFilter(this.selectedPoint, 'frequency', clampedFreq);
        },

        handleFilterScroll(event, index) {
            // Prevent page scrolling
            event.preventDefault();

            const filter = this.filters[index];
            if (!this.filterHasQ(filter.type)) return;

            //scroll direction
            const delta = Math.sign(event.deltaY) * -1; // -1 scroll down, 1 scroll up

            // Calculate new Q value
            const step = 0.1;
            const newQ = Math.max(0.1, Math.min(10, filter.Q + (delta * step)));

            // Update the filter Q value
            this.updateFilter(index, 'Q', newQ);
        },
        // Helper methods
        formatFrequency(freq, keepHz = false) {
            if (freq >= 1000 && !keepHz) {
                return (freq / 1000).toFixed(2);
            }
            return freq.toFixed(0);
        },

        formatFrequencyUnit(freq, keepHz = false) {
            if (freq >= 1000 && !keepHz) {
                return "kHz";
            }
            return "Hz";
        },

        playAudio() {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.audio.play();
        },

        pauseAudio() {
            this.audio.pause();
        },
        //placeholder methods
        savePreset() {
            console.log('Save preset');
        },

        loadPreset() {
            console.log('Load preset');
        },

        async resetEQ() {
            await this.initializeFilterPositions();

            this.filters.forEach((filter, index) => {
                this.weq8.setFilterFrequency(index, filter.frequency);
                this.weq8.setFilterGain(index, 0);
                this.weq8.toggleBypass(index, false);
            });

            this.drawFrequencyResponse();
        },
    },

    async mounted() {
        await this.initializeAudio();

        const setupCanvas = (canvas) => {
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * this.devicePixelRatio;
                canvas.height = rect.height * this.devicePixelRatio;
                const ctx = canvas.getContext('2d');
                ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
            }
        };

        setupCanvas(this.$refs.analyserCanvas);
        setupCanvas(this.$refs.responseCanvas);
        setupCanvas(this.$refs.gridCanvas);

        await this.initializeFilterPositions();
        this.drawFrequencyResponse();

        if (this.$refs.analyserCanvas) {
            this.updateAnalysisPositions();
            this.drawAnalyzer();
        }
    },

    computed: {

    },

    beforeUnmount() {
        if (this.analyserNode) {
            this.analyserNode.disconnect();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    },

    watch: {
        filters: {
            deep: true,
            handler() {
                this.drawFrequencyResponse();
            }
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
                    <Card class="h-full">
                        <template #title>
                            <div class="text-xl font-semibold mb-2">Controls</div>
                        </template>
                        <template #content>
                            <div class="flex flex-col gap-2">
                                <Button label="Save" severity="primary" rounded @click="savePreset" />
                                <Button label="Load" outlined rounded @click="loadPreset" />
                                <Button label="Reset" severity="secondary" outlined rounded @click="resetEQ" />
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- Middle Card -->
                <div class="col-span-12 lg:col-span-8">
                    <Card class="h-full">
                        <template #title>
                            <div class="text-2xl font-semibold mb-2">{{ preset.name }}</div>
                        </template>
                        <template #content>
                            <div class="flex flex-col items-center justify-center">
                                <div class="border w-full h-96 relative mb-6 bg-gray-900 rounded-lg overflow-hidden">
                                    <!-- Grid Canvas (bottom layer) -->
                                    <canvas ref="gridCanvas" class="absolute top-0 left-0 w-full h-full z-10"></canvas>

                                    <!-- Analyzer Canvas (middle layer) -->
                                    <canvas ref="analyserCanvas"
                                        class="absolute top-0 left-0 w-full h-full z-20"></canvas>

                                    <!-- Response Canvas (top layer) -->
                                    <canvas ref="responseCanvas" class="absolute inset-0 w-full h-full z-30"
                                        @pointermove="handleDrag" @pointerup="stopDragging"
                                        @pointerleave="stopDragging"></canvas>

                                    <!-- Filter Handles -->
                                    <div v-for="(filter, index) in filters" :key="index"
                                        class="filter-handle absolute z-40" :class="{
                                            'selected': selectedPoint === index,
                                            'bypassed': filter.bypass,
                                            'has-gain': filterHasGain(filter.type),
                                            'has-q': filterHasQ(filter.type)
                                        }" :style="getFilterPosition(filter)"
                                        @pointerdown="startDragging($event, index)" @pointermove="handleDrag"
                                        @pointerup="stopDragging" @pointercancel="stopDragging"
                                        @wheel.prevent="handleFilterScroll($event, index)">
                                        <span class="filter-number">{{ index + 1 }}</span>
                                        <span class="filter-freq">{{ getFilterLabel(filter) }}</span>
                                        <span v-if="filterHasQ(filter.type)" class="filter-q">Q: {{ filter.Q.toFixed(1)
                                            }}</span>
                                    </div>
                                </div>
                                <div class="flex gap-4">
                                    <Button icon="pi pi-play" severity="success" @click="playAudio" />
                                    <Button icon="pi pi-pause" severity="secondary" @click="pauseAudio" />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- Right Card -->
                <div class="col-span-12 lg:col-span-2">
                    <Card class="h-full">
                        <template #title>
                            <div class="text-xl font-semibold mb-4">
                                Band Controls
                            </div>
                        </template>
                        <template #content>
                            <div class="space-y-3">
                                <div v-for="(filter, index) in filters" :key="index"
                                    class="p-4 rounded-lg border border-gray-700 ">
                                    <div class="font-semibold mb-4">
                                        Band {{ index + 1 }}
                                    </div>

                                    <!-- Filter Type Selection -->
                                    <div class="mb-4">
                                        <FloatLabel variant="on" class="w-full">
                                            <Select class="w-32 min-w-full" v-model="filter.type"
                                                @change="updateFilter(index, 'type', $event.value)"
                                                :options="filterTypes" optionLabel="label" optionValue="value" />
                                            <label>Type:</label>
                                        </FloatLabel>
                                    </div>

                                    <!-- Frequency Input -->
                                    <div class="mb-4">
                                        <FloatLabel variant="on" class="w-full">
                                            <InputNumber class="w-full" v-model="filter.frequency"
                                                @update:modelValue="updateFilter(index, 'frequency', $event)" :min="20"
                                                :max="20000" :step="1" mode="decimal" fluid />
                                            <label>Frequency:</label>
                                        </FloatLabel>
                                    </div>

                                    <!-- Gain Slider -->
                                    <div class="mb-4">
                                        <div class="flex items-center justify-between mb-2">
                                            <label>Gain:</label>
                                            <span class="text-sm text-gray-500">{{ filter.gain }}dB</span>
                                        </div>
                                        <Slider class="w-full" v-model="filter.gain"
                                            @update:modelValue="updateFilter(index, 'gain', $event)" :min="-15"
                                            :max="15" :step="0.1" fluid />
                                    </div>

                                    <!-- Bypass Checkbox -->
                                    <div class="flex items-center gap-2">
                                        <label>Bypass:</label>
                                        <Checkbox v-model="filter.bypass"
                                            @update:modelValue="updateFilter(index, 'bypass', $event)" :binary="true"
                                            class="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>
            </div>
        </div>
    </div>
</template>



<style scoped>
.filter-handle {
    position: absolute;
    width: 24px;
    height: 24px;
    margin: -12px 0 0 -12px;
    background: rgba(79, 70, 229, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    cursor: grab;
    z-index: 40;
    user-select: none;
    will-change: transform;
    touch-action: none;
    backdrop-filter: blur(4px);
    box-shadow:
        inset 0 2px 4px rgba(255, 255, 255, 0.3),
        0 4px 8px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
}

.filter-handle .filter-number {
    color: white;
    font-size: 14px;
    font-weight: 500;
}

.filter-handle.selected {
    background: rgba(255, 204, 0, 0.8);
    transform: scale(1.1);
    box-shadow:
        inset 0 2px 4px rgba(255, 255, 255, 0.4),
        0 6px 12px rgba(255, 204, 0, 0.3);
}

.filter-handle.bypassed {
    background: rgba(125, 125, 125, 0.6);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: none;
}

.filter-handle:active {
    cursor: grabbing;
}

.filter-q {
    position: absolute;
    bottom: -24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    padding: 1px 4px;
    border-radius: 6px;
    color: white;
    font-size: 0.75rem;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.filter-handle:hover .filter-q {
    opacity: 1;
}

.filter-freq {
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    padding: 1px 4px;
    border-radius: 6px;
    color: white;
    font-size: 0.75rem;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.filter-handle:hover .filter-freq,
.filter-handle.selected .filter-freq {
    opacity: 1;
}

canvas {
    image-rendering: pixelated;
    background: transparent;
}
</style>