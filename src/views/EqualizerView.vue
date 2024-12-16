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
        }
    },
    methods: {
        initializeAudio() {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioPath = new URL('@/assets/audio/sample_audio.mp3', import.meta.url).href;
            this.audio = new Audio(audioPath);
            this.source = this.audioContext.createMediaElementSource(this.audio);
            this.weq8 = new WEQ8Runtime(this.audioContext);

            // Configure analyzer
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 8192;
            this.analyserNode.smoothingTimeConstant = 0.5;

            // Connect audio chain
            this.source.connect(this.weq8.input);
            this.weq8.connect(this.analyserNode);
            this.analyserNode.connect(this.audioContext.destination);
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
        }
        ,

        drawAnalyzer() {
            const canvas = this.$refs.analyserCanvas;
            const ctx = canvas.getContext('2d');
            const data = new Uint8Array(this.analyserNode.frequencyBinCount);

            const draw = () => {
                this.animationFrame = requestAnimationFrame(draw);
                this.analyserNode.getByteFrequencyData(data);
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                let path = new Path2D();
                path.moveTo(0, canvas.height);

                for (let i = 0; i < data.length; i++) {
                    const x = (i / data.length) * canvas.width;
                    const y = canvas.height - (data[i] / 255) * canvas.height;
                    path.lineTo(x, y);
                }

                path.lineTo(canvas.width, canvas.height);

                ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
                ctx.fill(path);

                ctx.strokeStyle = 'rgb(236, 72, 153)';
                ctx.stroke(path);
            };

            draw();
        },

        drawFrequencyResponse() {
            const canvas = this.$refs.responseCanvas;
            if (!canvas || !this.weq8) return;

            const ctx = canvas.getContext('2d');

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Add glow effect for better visuals
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ff40';
            ctx.strokeStyle = '#00ff40';
            ctx.lineWidth = 3;

            // Generate logarithmic frequency points
            const frequencies = new Float32Array(200); // More points = smoother line
            for (let i = 0; i < frequencies.length; i++) {
                frequencies[i] = 20 * Math.pow(10, i / frequencies.length * 3);
            }

            const magResponse = new Float32Array(frequencies.length);
            const phaseResponse = new Float32Array(frequencies.length);

            // Prepare the path
            ctx.beginPath();

            // Loop over the frequency range
            for (let i = 0; i < frequencies.length; i++) {
                const freq = frequencies[i];

                let totalGain = 0;

                // Sum responses for all active filters
                this.filters.forEach((filter, index) => {
                    if (!filter.bypass) {
                        const freqArray = new Float32Array([freq]);
                        const magArray = new Float32Array(1);
                        const phaseArray = new Float32Array(1);

                        try {
                            // Get filter response for current frequency
                            this.weq8.getFrequencyResponse(index, 0, freqArray, magArray, phaseArray);
                            totalGain += 20 * Math.log10(magArray[0]);
                        } catch (error) {
                            console.error(`Error getting frequency response for filter ${index}:`, error);
                        }
                    }
                });

                // Convert frequency and gain to canvas coordinates
                const x = this.frequencyToX(freq);
                const y = this.gainToY(totalGain);

                if (i === 0) {
                    ctx.moveTo(x, y); // Start at the first point
                } else {
                    ctx.lineTo(x, y); // Draw to subsequent points
                }
            }

            ctx.stroke();
        },


        getFilterPosition(filter) {
            if (!this.$refs.responseCanvas) return '';
            return `transform: translate(${filter.x}px, ${filter.y}px)`;
        },

        updateFilter(index, property, value) {
            const filter = this.filters[index];
            filter[property] = value;

            if (!this.weq8) return;

            switch (property) {
                case 'type':
                    this.weq8.setFilterType(index, value);
                    break;
                case 'frequency':
                    this.weq8.setFilterFrequency(index, value);
                    break;
                case 'gain':
                    this.weq8.setFilterGain(index, value);
                    break;
                case 'Q':
                    this.weq8.setFilterQ(index, value);
                    break;
                case 'bypass':
                    this.weq8.toggleBypass(index, value);
                    break;
            }

            // Update visualization whenever filter changes
            this.drawFrequencyResponse();
        },

        frequencyToX(freq) {
            if (!this.$refs.responseCanvas) return 0;
            const minF = Math.log10(20);
            const maxF = Math.log10(20000);
            const canvas = this.$refs.responseCanvas;
            return ((Math.log10(freq) - minF) / (maxF - minF)) * canvas.width;
        },

        gainToY(gain) {
            if (!this.$refs.responseCanvas) return 0;
            const canvas = this.$refs.responseCanvas;
            return canvas.height / 2 - (gain * canvas.height / 30);
        },

        xToFrequency(x) {
            if (!this.$refs.responseCanvas) return 20;
            const minF = Math.log10(20);
            const maxF = Math.log10(20000);
            const canvas = this.$refs.responseCanvas;
            return Math.pow(10, minF + (x / canvas.width) * (maxF - minF));
        },

        yToGain(y) {
            if (!this.$refs.responseCanvas) return 0;
            const canvas = this.$refs.responseCanvas;
            return -((y - canvas.height / 2) * 30) / canvas.height;
        },

        startDragging(event, index) {
            // Prevent default to stop text selection etc.
            event.preventDefault();

            // Use pointer capture to track drag even if mouse moves outside element
            event.target.setPointerCapture(event.pointerId);

            this.selectedPoint = index;
            this.isDragging = true;

            // Initial drag handling
            this.handleDrag(event);
        },

        handleDrag(event) {
            if (!this.isDragging) return;

            const canvas = this.$refs.responseCanvas;
            const canvasBounds = canvas.getBoundingClientRect();

            const pointerX = event.clientX - canvasBounds.left;
            const pointerY = event.clientY - canvasBounds.top;

            const frequency = this.xToFrequency(pointerX);
            const gain = this.yToGain(pointerY);

            const clampedFrequency = Math.max(20, Math.min(20000, frequency));
            const clampedGain = Math.max(-15, Math.min(15, gain));

            this.updateFilterSmooth(this.selectedPoint, "frequency", clampedFrequency);
            this.updateFilterSmooth(this.selectedPoint, "gain", clampedGain);

            // Update filter position for UI
            const filter = this.filters[this.selectedPoint];
            filter.x = pointerX;
            filter.y = pointerY;
        },

        updateFilterSmooth(index, property, targetValue, smoothingFactor = 0.1) {
            const filter = this.filters[index];
            const currentValue = filter[property];

            // Interpolate the value smoothly
            const smoothedValue = currentValue + (targetValue - currentValue) * smoothingFactor;

            // Update the filter state
            this.filters[index][property] = smoothedValue;

            // Debounce runtime updates for performance
            clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => {
                this.updateFilter(index, property, smoothedValue);
            }, 50); // Update runtime every 50ms
        }
        ,
        updateFilterVisualization() {
            // Centralized method to update visualizations
            this.$nextTick(() => {
                if (this.weq8) {
                    this.drawFrequencyResponse();
                }
            });
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
            const analyserCanvas = this.$refs.analyserCanvas;
            const responseCanvas = this.$refs.responseCanvas;

            if (analyserCanvas && responseCanvas) {
                // Set canvas dimensions
                analyserCanvas.width = analyserCanvas.offsetWidth * window.devicePixelRatio;
                analyserCanvas.height = analyserCanvas.offsetHeight * window.devicePixelRatio;
                responseCanvas.width = responseCanvas.offsetWidth * window.devicePixelRatio;
                responseCanvas.height = responseCanvas.offsetHeight * window.devicePixelRatio;

                // Initialize filter positions
                this.initializeFilterPositions();

                // Start visualizations
                this.drawAnalyzer();
                this.drawFrequencyResponse();
            }

            // Observe canvas resizing
            this.resizeObserver = new ResizeObserver(() => {
                this.onResize();
            });
            this.resizeObserver.observe(responseCanvas);
        });
    },

    beforeUnmount() {
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
                                <div class="visualization-container w-full h-64 relative mb-4">
                                    <canvas ref="analyserCanvas"
                                        class="absolute top-0 left-0 w-full h-full z-20"></canvas>
                                    <canvas ref="responseCanvas" class="absolute top-0 left-0 w-full h-full z-30"
                                        @pointermove="handleDrag" @pointerup="stopDragging"
                                        @pointerleave="stopDragging">
                                    </canvas>
                                    <!-- Filter handles -->
                                    <div v-for="(filter, index) in filters" :key="index"
                                        class="filter-handle absolute z-40"
                                        :class="{ 'selected': selectedPoint === index, 'bypassed': filter.bypass }"
                                        :style="getFilterPosition(filter)" @pointerdown="startDragging($event, index)"
                                        tabindex="0">
                                        {{ index + 1 }}
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
    width: 20px;
    height: 20px;
    background-color: #fff;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    justify-content: center;
    align-items: center;
    user-select: none;
    cursor: grab;
    transition: background-color 0.15s ease;
    color: black;
    font-weight: bold;
}

.filter-handle.selected {
    background: #ffcc00;
}

.filter-handle.bypassed {
    background: #7d7d7d;
}

.visualization-container {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #475569;
}

canvas {
    background: transparent;
}

.filter-control {
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid #333;
    border-radius: 5px;
}
</style>
