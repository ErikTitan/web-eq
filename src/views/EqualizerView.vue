<script>
import Card from 'primevue/card';
import Button from 'primevue/button';
import { WEQ8Runtime } from 'weq8'

export default {
    name: 'Equalizer',
    components: {
        Card,
        Button,
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
                { type: 'peaking12', frequency: 1000, gain: 0, Q: 1, bypass: false },
                { type: 'peaking12', frequency: 2500, gain: 0, Q: 1, bypass: false },
                { type: 'peaking12', frequency: 5000, gain: 0, Q: 1, bypass: false },
                { type: 'peaking12', frequency: 10000, gain: 0, Q: 1, bypass: false },
                { type: 'highshelf12', frequency: 12000, gain: 0, Q: 1, bypass: false }
            ],
            selectedPoint: null,
            isDragging: false,
            resizeObserver: null,
            frequencies: null,
            filterMagResponse: null,
            filterPhaseResponse: null,
            frequencyResponse: null,
            analysisData: null,
            analysisXs: [],
            devicePixelRatio: window.devicePixelRatio || 1,
        }
    },
    methods: {
        // Audio initialization and setup
        initializeAudio() {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioPath = new URL('@/assets/audio/sample_audio.mp3', import.meta.url).href;
            this.audio = new Audio(audioPath);
            this.source = this.audioContext.createMediaElementSource(this.audio);
            this.weq8 = new WEQ8Runtime(this.audioContext);
            this.initializeAnalyzer();
            this.initializeFrequencyResponse();
            this.initializeFilterPositions();
        },

        initializeFrequencyResponse() {
            const canvas = this.$refs.responseCanvas;
            this.frequencies = this.calculateFrequencies();
            this.filterMagResponse = new Float32Array(this.frequencies.length);
            this.filterPhaseResponse = new Float32Array(this.frequencies.length);
            this.frequencyResponse = new Float32Array(this.frequencies.length);
        },

        setupVisualizers() {
            const analyserCanvas = this.$refs.analyserCanvas;
            const responseCanvas = this.$refs.responseCanvas;

            if (analyserCanvas && responseCanvas) {
                // Set canvas dimensions
                analyserCanvas.width = analyserCanvas.offsetWidth * window.devicePixelRatio;
                analyserCanvas.height = analyserCanvas.offsetHeight * window.devicePixelRatio;
                responseCanvas.width = responseCanvas.offsetWidth * window.devicePixelRatio;
                responseCanvas.height = responseCanvas.offsetHeight * window.devicePixelRatio;

                // Update filter positions
                this.initializeFilterPositions();

                // Start visualizations
                this.drawAnalyzer();
                this.drawFrequencyResponse();

            }
        },

        initializeFilterPositions() {
            this.$nextTick(() => {
                const canvas = this.$refs.responseCanvas;
                if (!canvas) return;

                const devicePixelRatio = window.devicePixelRatio || 1;
                const canvasWidth = canvas.width / devicePixelRatio;
                const canvasHeight = canvas.height / devicePixelRatio;

                this.filters = this.filters.map((filter, index) => {
                    const minF = Math.log10(20);
                    const maxF = Math.log10(20000);
                    const step = (maxF - minF) / (this.filters.length - 1);
                    const frequency = Math.pow(10, minF + step * index);

                    const normalizedX = (Math.log10(frequency) - minF) / (maxF - minF);
                    const normalizedY = 0.5; // Center Y for initial positions

                    return {
                        ...filter,
                        frequency,
                        gain: 0,
                        x: normalizedX * canvasWidth,
                        y: normalizedY * canvasHeight
                    };
                });

                this.drawFrequencyResponse();
            });
        },
        // Analyzer methods
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
                this.handleCanvasResize();
            });

            if (this.$refs.analyserCanvas) {
                this.resizeObserver.observe(this.$refs.analyserCanvas);
            }
        },

        updateAnalysisPositions() {
            const canvas = this.$refs.analyserCanvas;
            if (!canvas) return;

            // Update canvas dimensions with device pixel ratio
            canvas.width = canvas.offsetWidth * this.devicePixelRatio;
            canvas.height = canvas.offsetHeight * this.devicePixelRatio;

            // Calculate frequency to x-position mapping
            const maxLog = Math.log10(this.audioContext.sampleRate / 2) - 1;

            this.analysisXs = Array.from(this.analysisData).map((_, i) => {
                const freq = (i / this.analysisData.length) * (this.audioContext.sampleRate / 2);
                return Math.floor(((Math.log10(freq) - 1) / maxLog) * canvas.width);
            });
        },

        handleCanvasResize() {
            const canvas = this.$refs.analyserCanvas;
            if (!canvas) return;

            canvas.width = canvas.offsetWidth * this.devicePixelRatio;
            canvas.height = canvas.offsetHeight * this.devicePixelRatio;

            this.updateAnalysisPositions();
        },

        drawAnalyzer() {
            if (this.disposed) return;

            const canvas = this.$refs.analyserCanvas;
            const ctx = canvas.getContext('2d');

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
                const y = Math.floor(h - this.analysisData[i] * yScale);
                path.lineTo(this.analysisXs[i], y);
            }

            path.lineTo(w, h);

            // Fill with semi-transparent color
            ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
            ctx.fill(path);

            // Add stroke for definition
            ctx.strokeStyle = 'rgb(236, 72, 153)';
            ctx.stroke(path);

            // Request next frame
            this.animationFrame = requestAnimationFrame(() => this.drawAnalyzer());
        },

        calculateFrequencies() {
            const canvas = this.$refs.responseCanvas;
            const frequencies = new Float32Array(canvas.width);
            const nyquist = this.audioContext.sampleRate / 2;
            const minLog = 1;
            const maxLog = Math.log10(nyquist);

            for (let x = 0; x < canvas.width; x++) {
                const log = minLog + (x / canvas.width) * (maxLog - minLog);
                frequencies[x] = Math.pow(10, log);
            }
            return frequencies;
        },

        calculateGridLines() {
            const nyquist = this.audioContext.sampleRate / 2;
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
            const nyquist = this.audioContext.sampleRate / 2;

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

        getFilterPosition(filter) {
            if (!this.$refs.responseCanvas) return { x: 0, y: 0 };

            const width = this.$refs.responseCanvas.offsetWidth;
            const height = this.$refs.responseCanvas.offsetHeight;
            const nyquist = this.audioContext.sampleRate / 2;

            const x = this.toLog10(filter.frequency, 10, nyquist) * width;
            let y;

            if (this.filterHasGain(filter.type)) {
                y = height - ((filter.gain + 15) / 30) * height;
            } else {
                y = height - this.toLog10(filter.Q, 0.1, 18) * height;
            }

            return {
                x: Math.max(0, Math.min(x, width)),
                y: Math.max(0, Math.min(y, height))
            };
        },

        getFilterLabel(filter) {
            return `${this.formatFrequency(filter.frequency)} ${this.formatFrequencyUnit(filter.frequency)}`;
        },

        async updateFilter(index, property, value) {
            const filter = this.filters[index];
            const startValue = filter[property];

            if (property === 'frequency' || property === 'gain' || property === 'Q') {
                // Smoothly transition the value
                const transitionedValue = await this.smoothTransition(startValue, value);
                filter[property] = transitionedValue;
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

        frequencyToX(freq) {
            const canvas = this.$refs.responseCanvas;
            return this.toLog10(freq, 20, this.audioContext.sampleRate / 2) * canvas.width;
        },

        gainToY(gain) {
            if (!this.$refs.responseCanvas) return 0;
            const canvas = this.$refs.responseCanvas;
            return canvas.height / 2 - (gain * canvas.height / 30);
        },

        xToFrequency(x) {
            const canvas = this.$refs.responseCanvas;
            return this.toLin(x / canvas.width, 20, this.audioContext.sampleRate / 2);
        },

        yToGain(y) {
            if (!this.$refs.responseCanvas) return 0;
            const canvas = this.$refs.responseCanvas;
            return -((y - canvas.height / 2) * 30) / canvas.height;
        },

        startDragging(event, index) {
            // Prevent default to stop text selection
            event.preventDefault();

            // Use pointer capture to track drag even if mouse moves outside element
            event.target.setPointerCapture(event.pointerId);

            this.selectedPoint = index;
            this.isDragging = true;

            // Initial drag handling
            this.handleDrag(event);
        },

        handleDrag(event) {
            if (!this.isDragging || this.selectedPoint === null) return;

            const canvas = this.$refs.responseCanvas;
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const nyquist = this.audioContext.sampleRate / 2;
            const frequency = this.toLin(x / canvas.width, 10, nyquist);

            const filter = this.filters[this.selectedPoint];
            if (this.filterHasGain(filter.type)) {
                const gain = ((1 - y / canvas.height) * 30) - 15;
                this.updateFilter(this.selectedPoint, 'gain', Math.max(-15, Math.min(15, gain)));
            } else {
                const Q = this.toLin(1 - y / canvas.height, 0.1, 18);
                this.updateFilter(this.selectedPoint, 'Q', Q);
            }

            this.updateFilter(this.selectedPoint, 'frequency', frequency);
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

        toLog10(lin, minLin, maxLin) {
            const minLog = Math.log10(minLin);
            const maxLog = Math.log10(maxLin);
            return (Math.log10(Math.min(Math.max(lin, minLin, maxLin))) - minLog) / (maxLog - minLog);
        },

        toLin(log, minLin, maxLin) {
            const minLog = Math.log10(minLin);
            const maxLog = Math.log10(maxLin);
            return Math.min(Math.max(Math.pow(10, log * (maxLog - minLog) + minLog), minLin, maxLin));
        },

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

        stopDragging(event) {
            if (this.selectedPoint !== null) {
                event.target.releasePointerCapture(event.pointerId);
            }
            this.isDragging = false;
            this.selectedPoint = null;
        },

        onResize() {
            const canvas = this.$refs.responseCanvas;
            const canvasBounds = canvas.getBoundingClientRect();

            this.filters.forEach(filter => {
                filter.x = this.frequencyToX(filter.frequency);
                filter.y = this.gainToY(filter.gain);
            });

            this.drawFrequencyResponse();
        },

        playAudio() {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.audio.play();
        },

        pauseAudio() {
            this.audio.pause();
        }
    },

    //placeholder methods
    savePreset() {
        // Implement preset saving logic
        console.log('Save preset');
    },

    loadPreset() {
        // Implement preset loading logic
        console.log('Load preset');
    },

    resetEQ() {
        this.filters = this.filters.map(filter => ({
            ...filter,
            gain: 0,
            bypass: false
        }));
    },

    mounted() {
        this.initializeAudio();
        this.$nextTick(() => {
            // Initialize canvases with proper dimensions
            const canvases = ['analyserCanvas', 'responseCanvas'];
            canvases.forEach(canvasRef => {
                const canvas = this.$refs[canvasRef];
                if (canvas) {
                    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
                    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
                }
            });

            // Ensure analyzer is started
            if (this.$refs.analyserCanvas) {
                this.updateAnalysisPositions();
                this.drawAnalyzer(); // Start the animation loop
            }
        });
        this.$nextTick(() => {
            const responseCanvas = this.$refs.responseCanvas;

            if (responseCanvas) {
                this.initializeFrequencyResponse();

                this.resizeObserver = new ResizeObserver(() => {
                    responseCanvas.width = responseCanvas.offsetWidth * window.devicePixelRatio;
                    responseCanvas.height = responseCanvas.offsetHeight * window.devicePixelRatio;

                    this.frequencies = this.calculateFrequencies();
                    this.filterMagResponse = new Float32Array(this.frequencies.length);
                    this.filterPhaseResponse = new Float32Array(this.frequencies.length);
                    this.frequencyResponse = new Float32Array(this.frequencies.length);

                    this.drawFrequencyResponse();
                });

                this.resizeObserver.observe(responseCanvas);
                this.drawFrequencyResponse();
            }
        });
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
            <div class="grid grid-cols-12 gap-6">
                <!-- Left Card -->
                <div class="col-span-12 lg:col-span-3">
                    <Card class="h-full">
                        <template #title>
                            <div class="text-2xl font-semibold mb-4">Preset Controls</div>
                        </template>
                        <template #content>
                            <div class="flex flex-col gap-4">
                                <Button label="Save Preset" severity="primary" rounded @click="savePreset" />
                                <Button label="Load Preset" outlined rounded @click="loadPreset" />
                                <Button label="Reset" severity="secondary" outlined rounded @click="resetEQ" />
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- Middle Card -->
                <div class="col-span-12 lg:col-span-6">
                    <Card class="h-full">
                        <template #title>
                            <div class="text-2xl font-semibold mb-4">{{ preset.name }}</div>
                        </template>
                        <template #content>
                            <div class="flex flex-col items-center justify-center">
                                <div
                                    class="visualization-container w-full h-64 relative mb-4 bg-gray-900 rounded-lg overflow-hidden">
                                    <!-- Grid Canvas (bottom layer) -->
                                    <canvas ref="gridCanvas" class="absolute top-0 left-0 w-full h-full z-10"></canvas>

                                    <!-- Analyzer Canvas (middle layer) -->
                                    <canvas ref="analyserCanvas"
                                        class="absolute top-0 left-0 w-full h-full z-20"></canvas>

                                    <!-- Response Canvas (top layer) -->
                                    <canvas ref="responseCanvas" class="absolute top-0 left-0 w-full h-full z-30"
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
                                        @mousedown="startDragging($event, index)">
                                        <span class="filter-number">{{ index + 1 }}</span>
                                        <span class="filter-freq">{{ getFilterLabel(filter) }}</span>
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
                <div class="col-span-12 lg:col-span-3">
                    <Card class="h-full">
                        <template #title>
                            <div class="text-2xl font-semibold mb-4">Band Controls</div>
                        </template>
                        <template #content>
                            <div class="filters-container">
                                <div class="filter-control" v-for="(filter, index) in filters" :key="index">
                                    <div>Band {{ index + 1 }}</div>
                                    <div class="flex items-center gap-2">
                                        <label>Frequency:</label>
                                        <input type="number" v-model.number="filter.frequency"
                                            @change="updateFilter(index, 'frequency', filter.frequency)" min="20"
                                            max="20000" />
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <label>Gain:</label>
                                        <input type="range" v-model.number="filter.gain"
                                            @input="updateFilter(index, 'gain', filter.gain)" min="-15" max="15"
                                            step="0.1" />
                                        <span>{{ filter.gain.toFixed(1) }} dB</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <label>Bypass:</label>
                                        <input type="checkbox" v-model="filter.bypass"
                                            @change="updateFilter(index, 'bypass', filter.bypass)" />
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
    width: 24px;
    height: 24px;
    background: var(--primary-color);
    border: 2px solid #fff;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    color: #000;
    font-weight: bold;
    transition: all 0.2s ease;
    user-select: none;
    pointer-events: auto;
}

.filter-handle.selected {
    background: #ffcc00;
    transform: translate(-50%, -50%) scale(1.2);
    z-index: 50;
}

.filter-handle.bypassed {
    background: #7d7d7d;
    opacity: 0.7;
}

.filter-handle:active {
    cursor: grabbing;
}

.filter-freq {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    padding: 2px 6px;
    border-radius: 4px;
    color: white;
    font-size: 0.75rem;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;
}

.filter-handle:hover .filter-freq,
.filter-handle.selected .filter-freq {
    opacity: 1;
}

.visualization-container {
    border: 1px solid #475569;
    background: rgba(17, 24, 39, 0.95);
}

canvas {
    image-rendering: pixelated;
    background: transparent;
}

.filter-control {
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid #333;
    border-radius: 5px;
}
</style>
