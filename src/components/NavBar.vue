<script>
import Menubar from 'primevue/menubar';
import InputText from 'primevue/inputtext';
import Avatar from 'primevue/avatar';
import Badge from 'primevue/badge';
import Button from 'primevue/button';

export default {
    components: {
        Menubar,
        InputText,
        Avatar,
        Badge,
        Button
    },
    data() {
        return {
            items: [
                { label: 'Home' },
                { label: 'About' },
                {
                    label: 'Menu',
                    icon: 'pi pi-fw pi-bars',
                    items: [
                        { label: 'Option 1', icon: 'pi pi-fw pi-check' },
                        { label: 'Option 2', icon: 'pi pi-fw pi-times' },
                    ],
                },
                { label: 'Contact', icon: 'pi pi-fw pi-envelope' },
            ],
            isDarkMode: false,
            isScrolled: false
        };
    },
    methods: {
        toggleDarkMode() {
            document.documentElement.classList.toggle('my-app-dark');
            this.isDarkMode = !this.isDarkMode;
            localStorage.setItem('darkMode', this.isDarkMode.toString());
        },
        handleScroll() {
            this.isScrolled = window.scrollY > 100;
        }
    },
    mounted() {
        const savedDarkMode = localStorage.getItem('darkMode') === 'true';
        this.isDarkMode = savedDarkMode;
        if (savedDarkMode) {
            document.documentElement.classList.add('my-app-dark');
        }

        // Add scroll listener
        window.addEventListener('scroll', this.handleScroll);
    },
    beforeUnmount() {
        // Remove scroll listener
        window.removeEventListener('scroll', this.handleScroll);
    }
}
</script>

<template>
    <div class="fixed w-full z-50 transition-all duration-400 ease-in-out" :class="{
        'lg:top-3': isScrolled,
        'top-0': !isScrolled
    }">
        <Menubar :model="items" class="transition-all duration-400 ease-in-out mx-auto" :class="{
            'container shadow-lg rounded-lg': isScrolled,
            'w-full max-w-full rounded-none': !isScrolled
        }">
            <template #start>
                <a href="#">
                    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 25 25" fill="none">
                        <path
                            d="M18,1.25H6A4.756,4.756,0,0,0,1.25,6V18A4.756,4.756,0,0,0,6,22.75H18A4.756,4.756,0,0,0,22.75,18V6A4.756,4.756,0,0,0,18,1.25ZM21.25,18A3.254,3.254,0,0,1,18,21.25H6A3.254,3.254,0,0,1,2.75,18V6A3.254,3.254,0,0,1,6,2.75H18A3.254,3.254,0,0,1,21.25,6ZM15,8.75a.75.75,0,0,0-.75.75v5a.75.75,0,0,0,1.5,0v-5A.75.75,0,0,0,15,8.75ZM18,6.75a.75.75,0,0,0-.75.75v9a.75.75,0,0,0,1.5,0v-9A.75.75,0,0,0,18,6.75ZM6,9.25a.75.75,0,0,0-.75.75v4a.75.75,0,0,0,1.5,0V10A.75.75,0,0,0,6,9.25ZM9,7.25A.75.75,0,0,0,8.25,8v8a.75.75,0,0,0,1.5,0V8A.75.75,0,0,0,9,7.25ZM12,4.25a.75.75,0,0,0-.75.75V19a.75.75,0,0,0,1.5,0V5A.75.75,0,0,0,12,4.25Z"
                            fill="var(--p-primary-400)" />
                    </svg>
                </a>
            </template>
            <template #item="{ item, props, hasSubmenu, root }">
                <a v-ripple class="flex items-center" v-bind="props.action">
                    <span>{{ item.label }}</span>
                    <Badge v-if="item.badge" :class="{ 'ml-auto': !root, 'ml-2': root }" :value="item.badge" />
                    <span v-if="item.shortcut"
                        class="ml-auto border rounded bg-emphasis text-muted-color text-xs p-1">{{ item.shortcut
                        }}</span>
                    <i v-if="hasSubmenu"
                        :class="['pi pi-angle-down ml-auto', { 'pi-angle-down': root, 'pi-angle-right': !root }]"></i>
                </a>
            </template>
            <template #end>
                <div class="flex items-center gap-2">
                    <Button class="transition-all duration-400 ease-in-out" @click="toggleDarkMode"
                        :icon="isDarkMode ? 'pi pi-moon' : 'pi pi-sun'" :rounded="isScrolled" />
                    <InputText placeholder="Search" type="text" class="w-32 sm:w-auto" />
                    <Avatar icon="pi pi-user" class="mr-2" shape="circle" />
                </div>
            </template>
        </Menubar>
    </div>
</template>

<style scoped></style>