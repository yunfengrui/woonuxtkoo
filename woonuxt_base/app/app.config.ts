/**
 * App configuration.
 * This file is used to configure the app settings.
 * Below are the default values.
 */
export default defineAppConfig({
  siteName: 'Koopower',
  shortDescription: 'Koopower — Innovative decorative lighting for cozy homes.',
  description: 'Koopower offers innovative, eco-friendly decorative lights to illuminate your home. Shipping to USA, UK, and Germany. For support, email support@koopower.com.',
  baseUrl: 'https://www.koopower.com',
  siteImage: 'https://user-images.githubusercontent.com/5116925/218879668-f4c1f9fd-bef4-44b0-bc7f-e87d994aa3a1.png',
  stripePaymentMethod: 'payment', // 'card' or 'payment'
  // Stripe Payment Method Options:
  // - 'card': Traditional single card input field (legacy but still supported)
  // - 'payment': Modern Payment Element with tabs for multiple payment methods (recommended)
  storeSettings: {
    autoOpenCart: false,
    // cartMode: 'optimistic' updates UI immediately; 'safe' waits for the server response.
    cartMode: 'optimistic',
    showReviews: true,
    showFilters: true,
    showOrderByDropdown: true,
    showSKU: true,
    showRelatedProducts: true,
    showProductCategoriesOnSingleProduct: true,
    showBreadcrumbOnSingleProduct: true,
    showMoveToWishlist: true,
    hideBillingAddressForVirtualProducts: false,
    initStoreOnUserActionToReduceServerLoad: true,
    saleBadge: 'percent', // 'percent', 'onSale' or 'hidden'
    socialLoginsDisplay: 'buttons', // 'buttons' or 'icons'
  },
});
