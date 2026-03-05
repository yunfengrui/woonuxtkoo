<script lang="ts" setup>
import { ProductsOrderByEnum } from '#gql/default';
const { siteName, description, shortDescription, siteImage } = useAppConfig();

const { data } = await useAsyncGql('getProductCategories', { first: 6 });
const productCategories = data.value?.productCategories?.nodes || [];

const { data: productData } = await useAsyncGql('getProducts', { first: 5, orderby: ProductsOrderByEnum.POPULARITY });
const popularProducts = productData.value?.products?.nodes || [];

useSeoMeta({
  title: `Home`,
  ogTitle: siteName,
  description: description,
  ogDescription: shortDescription,
  ogImage: siteImage,
  twitterCard: `summary_large_image`,
});
</script>

<template>
  <main>
    <HeroBanner />

    <div class="container flex flex-wrap items-center justify-center my-16 text-center gap-x-8 gap-y-4 brand lg:justify-between">
      <img src="/images/joyberg.svg" alt="Joyberg - Gifts for Reading Lovers and Writers" width="100" height="40" />
      <img src="/images/DSTELIN.svg" alt="DSTELIN" width="100" height="40" />
      <img src="/images/Kaistyle.svg" alt="KAISTYLE - Gifts for Tech Geeks" width="100" height="40" />
      <img src="/images/Furkicks.svg" alt="Furkicks - Gifts for Dogs and Cats" width="100" height="40" />
      <img src="/images/allreli.svg" alt="allreli" width="100" height="40" />
    </div>

    <section class="container my-16">
      <div class="flex items-end justify-between">
        <h2 class="text-lg font-semibold md:text-2xl dark:text-white">{{ $t('shop.shopByCategory') }}</h2>
        <NuxtLink class="text-primary dark:text-primary" to="/categories">{{ $t('general.viewAll') }}</NuxtLink>
      </div>
      <div class="grid justify-center grid-cols-2 gap-4 mt-8 md:grid-cols-3 lg:grid-cols-6">
        <CategoryCard v-for="(category, i) in productCategories" :key="i" class="w-full" :node="category" />
      </div>
    </section>

    <section class="container grid gap-4 my-24 md:grid-cols-2 lg:grid-cols-4">
      <div class="flex items-center gap-8 p-8 bg-white dark:bg-gray-800 rounded-lg">
        <img src="/icons/box.svg" width="60" height="60" alt="Free Shipping" loading="lazy" />
        <div>
          <h3 class="text-xl font-semibold dark:text-white">Free Delivery</h3>
          <p class="text-sm dark:text-gray-300">Free UK Delivery</p>
        </div>
      </div>
      <div class="flex items-center gap-8 p-8 bg-white dark:bg-gray-800 rounded-lg">
        <img src="/icons/moneyback.svg" width="60" height="60" alt="Money Back" loading="lazy" />
        <div>
          <h3 class="text-xl font-semibold dark:text-white">Peace of Mind</h3>
          <p class="text-sm dark:text-gray-300">30 days money back guarantee</p>
        </div>
      </div>
      <div class="flex items-center gap-8 p-8 bg-white dark:bg-gray-800 rounded-lg">
        <img src="/icons/secure.svg" width="60" height="60" alt="Secure Payment" loading="lazy" />
        <div>
          <h3 class="text-xl font-semibold dark:text-white">100% Secure</h3>
          <p class="text-sm dark:text-gray-300">Your payment are safe with us.</p>
        </div>
      </div>
      <div class="flex items-center gap-8 p-8 bg-white dark:bg-gray-800 rounded-lg">
        <img src="/icons/support.svg" width="60" height="60" alt="Support 24/7" loading="lazy" />
        <div>
          <h3 class="text-xl font-semibold dark:text-white">Support 24/7</h3>
          <p class="text-sm dark:text-gray-300">24/7 Online support</p>
        </div>
      </div>
    </section>

    <section class="container my-16" v-if="popularProducts">
      <div class="flex items-end justify-between">
        <h2 class="text-lg font-semibold md:text-2xl dark:text-white">{{ $t('shop.popularProducts') }}</h2>
        <NuxtLink class="text-primary dark:text-primary" to="/products">{{ $t('general.viewAll') }}</NuxtLink>
      </div>
      <ProductRow :products="popularProducts" class="grid-cols-2 md:grid-cols-4 lg:grid-cols-5 mt-8" />
    </section>
  </main>
</template>

<style scoped>
.brand img {
  max-height: min(8vw, 120px);
  object-fit: contain;
  object-position: center;
}
</style>
