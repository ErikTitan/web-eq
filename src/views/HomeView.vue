<script>
import Button from 'primevue/button';
import NavBar from '@/components/NavBar.vue';
export default {
  name: 'home',
  components: {
    Button,
    NavBar,
  },
};
</script>

<template>
  <NavBar />
  <div class="flex flex-col pt-24 px-6 lg:px-20 overflow-hidden" style="background: linear-gradient(0deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2)), radial-gradient(77.36% 256.97% at 77.36% 57.52%, 
    var(--p-primary-200) 10%, var(--p-fuchsia-300) 100%); clip-path: ellipse(133% 75% at 93% 13%)">
    <div class="mx-6 md:mx-20 mt-0 md:mt-6">
      <h1 class="text-6xl font-bold text-gray-900 leading-tight">
        <span class="font-light block">Eu sem integer</span>eget magna fermentum
      </h1>
      <p class="font-normal text-2xl leading-normal md:mt-4 text-gray-700">
        Sed blandit libero volutpat sed cras. Fames ac turpis egestas integer. Placerat in egestas erat...
      </p>
      <Button label="Get Started" as="router-link" to="/" rounded class="!text-xl mt-8 !px-4"></Button>
    </div>
    <div class="flex justify-center md:justify-end bg-scroll relative top-12">
      <img src="../assets/images/Peace_image3.png" class="md:w-[700px]" />
    </div>
  </div>

  <div class="py-6 px-6 lg:px-20 mx-0 my-12 lg:mx-20">
    <div class="text-center">
      <div class=" font-normal mb-2 text-4xl">Powerful Everywhere</div>
      <span class="text-muted-color text-2xl">Amet consectetur adipiscing elit...</span>
    </div>

    <div class="grid grid-cols-12 gap-4 mt-20 pb-2 md:pb-20">
      <div class="flex justify-center col-span-12 lg:col-span-6 bg-purple-100 p-0 order-1 lg:order-none"
        style="border-radius: 8px">
        <img src="../assets/images/Peace_image3.png" class="w-11/12" alt="mockup mobile" />
      </div>

      <div class="col-span-12 lg:col-span-6 my-auto flex flex-col lg:items-end text-center lg:text-right gap-4">
        <div class="flex items-center justify-center bg-purple-200 self-center lg:self-end"
          style="width: 4.2rem; height: 4.2rem; border-radius: 10px">
          <i class="pi pi-fw pi-mobile !text-4xl text-purple-700"></i>
        </div>
        <div class="leading-none text-surface-900 dark:text-surface-0 text-3xl font-normal">Congue Quisque Egestas</div>
        <span class="text-surface-700 dark:text-surface-100 text-2xl leading-normal ml-0 md:ml-2"
          style="max-width: 650px">Lectus arcu bibendum at varius vel pharetra vel turpis nunc. Eget aliquet nibh
          praesent tristique magna sit amet purus gravida. Sit amet mattis vulputate enim nulla aliquet.</span>
      </div>
    </div>

    <div class="grid grid-cols-12 gap-4 my-20 pt-2 md:pt-20">
      <div class="col-span-12 lg:col-span-6 my-auto flex flex-col text-center lg:text-left lg:items-start gap-4">
        <div class="flex items-center justify-center bg-yellow-200 self-center lg:self-start"
          style="width: 4.2rem; height: 4.2rem; border-radius: 10px">
          <i class="pi pi-fw pi-desktop !text-3xl text-yellow-700"></i>
        </div>
        <div class="leading-none text-surface-900 dark:text-surface-0 text-3xl font-normal">Celerisque Eu Ultrices</div>
        <span class="text-surface-700 dark:text-surface-100 text-2xl leading-normal mr-0 md:mr-2"
          style="max-width: 650px">Adipiscing commodo elit at imperdiet dui. Viverra nibh cras pulvinar mattis nunc sed
          blandit libero. Suspendisse in est ante in. Mauris pharetra et ultrices neque ornare aenean euismod elementum
          nisi.</span>
      </div>

      <div class="flex justify-end order-1 sm:order-2 col-span-12 lg:col-span-6 bg-yellow-100 p-0"
        style="border-radius: 8px">
        <img src="../assets/images/Peace_image3.png" class="w-11/12" alt="mockup" />
      </div>
    </div>
  </div>
</template>
