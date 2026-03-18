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

    <section class="container my-16">
      <div>
        <h2 class="text-lg font-semibold md:text-2xl dark:text-white">Our Story</h2>
        <p class="mt-4 text-sm md:text-base dark:text-gray-300">
          Since 2011, Koopower has specialized in warm white decorative lighting, helping
          <span class="font-semibold text-primary">3,000,000+</span>
          customers across Europe and North America create cozy, memorable moments. Our fairy lights have been Amazon UK Lighting Best Sellers for five consecutive Christmas seasons, and our LED Christmas Tree Candles have ranked Best Seller in category on Amazon DE for seven years in a row.
        </p>
      </div>

      <div class="mt-12">
        <h2 class="text-lg font-semibold md:text-2xl dark:text-white">Media Mentions</h2>
        <div class="grid gap-6 mt-6 md:grid-cols-2">
          <div class="flex items-start gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg brand">
            <img
              src="https://img.eslife.com/file/koopower/1773828129181_realhomes.png"
              width="300"
              height="120"
              alt="Realhomes"
              loading="lazy"
            />
            <p class="text-sm dark:text-gray-300">
              Realhomes: "Koopower lights are the best choice for creating a magical outdoor atmosphere. They are easy to use, battery-operated, and feature both a timer and multiple lighting modes."
            </p>
          </div>
          <div class="flex items-start gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg brand">
            <img
              src="https://img.eslife.com/file/koopower/1773828129031_thespruce.png"
              width="300"
              height="120"
              alt="The Spruce"
              loading="lazy"
            />
            <p class="text-sm dark:text-gray-300">
              The Spruce: Koopower Fairy Lights were selected by The Spruce as the best lights for both bedrooms and outdoor spaces! With a timer and 8 lighting modes, they create a warm and cozy ambiance.
            </p>
          </div>
        </div>
      </div>

      <div class="mt-12">
        <h2 class="text-lg font-semibold md:text-2xl dark:text-white">Why Choose Koopower</h2>
        <div class="mt-4 p-6 bg-white dark:bg-gray-800 rounded-lg space-y-3">
          
          <div class="grid gap-4 md:grid-cols-2">
            <a
              class="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
              href="https://www.trustpilot.com/review/koopower.com"
              target="_blank"
              rel="noopener"
            >
              <span class="text-sm md:text-base dark:text-gray-200">Trustpilot Rating</span>
              <span class="text-sm md:text-base text-white bg-green-600 px-2 py-1 rounded font-semibold">4.8/5</span>
            </a>
            <div class="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <span class="text-sm md:text-base dark:text-gray-200">Amazon positive reviews</span>
              <span class="text-sm md:text-base text-white bg-amber-600 px-2 py-1 rounded font-semibold">50,000+</span>
            </div>
          </div>

          <p class="text-sm md:text-base dark:text-gray-300">
            We are looking for distributors in Brazil and Argentina. Contact us at
            <a class="text-primary dark:text-primary" href="mailto:admin@koopower.com">admin@koopower.com</a>.
          </p>
        </div>
      </div>
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
