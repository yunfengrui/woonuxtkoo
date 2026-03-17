export default defineNuxtConfig({
  // Get all the pages, components, composables and plugins from the parent theme
  extends: ["./woonuxt_base"],

  components: [{ path: "./components", pathPrefix: false }],

  modules: ["@nuxtjs/turnstile"],

  image: {
    provider: 'ipx',
  },

  runtimeConfig: {
    public: {
      TURNSTILE_SITE_KEY:
        process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY ||
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
        '',
    },
    turnstile: {
      secretKey:
        process.env.TURNSTILE_SECRET_KEY ||
        process.env.NUXT_TURNSTILE_SECRET_KEY ||
        '',
    },
  },

  turnstile: {
    siteKey:
      process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY ||
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      '',
  },

  /**
   * Depending on your servers capabilities, you may need to adjust the following settings.
   * It will affect the build time but also increase the reliability of the build process.
   * If you have a server with a lot of memory and CPU, you can remove the following settings.
   * @property {number} concurrency - How many pages to prerender at once
   * @property {number} interval - How long to wait between prerendering pages
   * @property {boolean} failOnError - This stops the build from failing but the page will not be statically generated
   */
  nitro: {
    prerender: {
      concurrency: 10,
      interval: 1000,
      failOnError: false,
    },
    routeRules: {
      '/products/:splat*': { redirect: { to: '/product/:splat*', statusCode: 301 } },
      '/collections/:splat*': { redirect: { to: '/product-category/:splat*', statusCode: 301 } },
    },
  },
});
