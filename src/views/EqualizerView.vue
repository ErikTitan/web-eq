<script>
import Card from 'primevue/card';
import Button from 'primevue/button';

export default {
    name: 'equalizer',
    components: {
        Card,
        Button,
    },
    data() {
        return {
            preset: {
                name: 'Untitled Preset',
                description: '',
                bands: []
            }
        }
    }
}
</script>

<template>
    <div class="flex flex-col min-h-screen">
        <div class="flex-1 pt-24 px-6 lg:px-20">
            <div class="grid grid-cols-12 gap-6">

                <div class="col-span-12 lg:col-span-3">
                    <Card class="h-full">
                        <template #title>
                            <div class="text-2xl font-semibold mb-4">Preset Controls</div>
                        </template>
                        <template #content>
                            <div class="flex flex-col gap-4">
                                <Button label="Save Preset" severity="primary" rounded />
                                <Button label="Load Preset" outlined rounded />
                                <Button label="Reset" severity="secondary" outlined rounded />
                            </div>
                        </template>
                    </Card>
                </div>
                <div class="col-span-12 lg:col-span-6">
                    <Card class="h-full">
                        <template #title>
                            <div class="text-2xl font-semibold mb-4">{{ preset.name }}</div>
                        </template>
                        <template #content>
                            <div class="flex items-center justify-center h-[400px]">
                                <div class="text-xl text-center text-gray-500">
                                    Equalizer Graph Placeholder
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <div class="col-span-12 lg:col-span-3">
                    <Card class="h-full">
                        <template #title>
                            <div class="text-2xl font-semibold mb-4">Band Controls</div>
                        </template>
                        <template #content>
                            <div class="flex flex-col gap-4">
                                <Button label="Add Band" severity="primary" rounded icon="pi pi-plus" />
                            </div>
                        </template>
                    </Card>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.p-card {
    background: var(--p-surface-card);
    border: 1px solid var(--p-surface-border);
    border-radius: var(--border-radius-lg);
}
</style>
