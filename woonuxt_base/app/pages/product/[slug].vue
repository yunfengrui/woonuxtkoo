<script lang="ts" setup>
import { StockStatusEnum, ProductTypesEnum, type AddToCartInput } from '#gql/default';
import type { ExternalProduct, ProductDetail, SimpleProduct, VariableProduct, Variation, VariationAttribute } from '#types/gql';
import { nextTick } from 'vue';

const route = useRoute();
const router = useRouter();
const { storeSettings } = useAppConfig();
const { addToCart, isUpdatingCart, isAddingToCart, isOptimisticCartMode } = useCart();
const { frontEndUrl } = useHelpers();
const { t } = useI18n();
const slug = route.params.slug as string;

const { data } = await useAsyncGql('getProduct', { slug, frontEndUrl });
if (!data.value?.product) {
  throw showError({ statusCode: 404, statusMessage: t('shop.productNotFound') });
}

const product = ref<ProductDetail>(data?.value?.product);
const quantity = ref<number>(1);
const activeVariation = ref<Variation | null>(null);
const variation = ref<VariationAttribute[]>([]);
const attrValues = ref();

const normalizeMatchToken = (value?: string | null): string =>
  (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s-_]+/g, '');

const stripPaPrefix = (value?: string | null): string => (value ?? '').toString().replace(/^pa[_-]/i, '');

const normalizeMatchKey = (value?: string | null): string => normalizeMatchToken(stripPaPrefix(value));
const normalizeMatchValue = (value?: string | null): string => normalizeMatchToken(value);

const toSelectionName = (name?: string | null): string => {
  if (!name) return '';
  return name.charAt(0).toLowerCase() + name.slice(1);
};

const normalizedVariations = computed(() => {
  const nodes = product.value?.variations?.nodes ?? [];
  return nodes.map((node: Variation) => {
    const attrs: Record<string, string> = {};
    node.attributes?.nodes?.forEach((attr) => {
      const key = normalizeMatchKey(attr.name);
      if (!key) return;
      attrs[key] = normalizeMatchValue(attr.value);
    });

    const specificity = Object.values(attrs).filter(Boolean).length;
    return { variation: node, attrs, specificity };
  });
});

const findMatchingVariation = (selected: VariationAttribute[]): Variation | null => {
  if (!selected?.length) return null;

  const selectedMap: Record<string, string> = {};
  selected.forEach((attr) => {
    const key = normalizeMatchKey(attr.name);
    if (!key) return;
    const value = normalizeMatchValue(attr.value);
    if (!value) return;
    selectedMap[key] = value;
  });

  if (Object.keys(selectedMap).length === 0) return null;

  let bestMatch: { variation: Variation; score: number } | null = null;

  for (const candidate of normalizedVariations.value) {
    let matches = true;
    let matchedSpecific = 0;

    for (const [key, value] of Object.entries(selectedMap)) {
      const candidateValue = candidate.attrs[key];
      if (!candidateValue) continue;
      if (candidateValue !== value) {
        matches = false;
        break;
      }
      matchedSpecific += 1;
    }

    if (!matches) continue;

    const score = matchedSpecific * 100 + candidate.specificity;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { variation: candidate.variation, score };
    }
  }

  return bestMatch?.variation ?? null;
};

// Pre-select variation based on URL query params BEFORE component mounts
const queryParams = route.query;

const findVariationById = (value?: string | number | null): Variation | null => {
  if (!value || !product.value?.variations?.nodes?.length) return null;
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!parsed || Number.isNaN(parsed)) return null;
  return product.value?.variations?.nodes?.find((node: Variation) => node.databaseId === parsed) ?? null;
};

const buildQuerySelections = (): VariationAttribute[] => {
  if (!product.value?.attributes?.nodes?.length) return [];

  const selections: VariationAttribute[] = [];
  for (const attr of product.value.attributes.nodes) {
    const key = toSelectionName(attr?.name);
    if (!key) continue;

    const rawQueryValue = queryParams[key];
    if (!rawQueryValue) continue;

    const value = Array.isArray(rawQueryValue) ? rawQueryValue[0] : rawQueryValue;
    const normalizedValue = normalizeMatchValue(value);
    if (!normalizedValue) continue;

    const isValidValue =
      attr.scope === 'LOCAL'
        ? (attr.options ?? []).some((option: string | null) => normalizeMatchValue(option ?? '') === normalizedValue)
        : 'terms' in attr && (attr.terms?.nodes ?? []).some((term) => normalizeMatchValue(term?.slug ?? '') === normalizedValue);

    if (!isValidValue) continue;

    selections.push({ name: key, value: String(value) });
  }

  return selections;
};

const queryVariationId = queryParams.variationId ?? queryParams.variation;
const variationFromQuery = findVariationById(Array.isArray(queryVariationId) ? queryVariationId[0] : queryVariationId);

if (variationFromQuery?.attributes?.nodes?.length) {
  variation.value = variationFromQuery.attributes.nodes.map((attr: VariationAttribute) => ({
    name: attr.name || '',
    value: attr.value || '',
  }));
  activeVariation.value = variationFromQuery;
} else {
  const initialSelections = buildQuerySelections();
  if (initialSelections.length > 0) {
    const matched = findMatchingVariation(initialSelections);
    if (matched?.attributes?.nodes?.length) {
      variation.value = matched.attributes.nodes.map((attr: VariationAttribute) => ({
        name: attr.name || '',
        value: attr.value || '',
      }));
      activeVariation.value = matched;
    } else {
      variation.value = initialSelections;
    }
  }
}

const defaultAttributes = computed<{ nodes: VariationAttribute[] } | null>(() => {
  if (variation.value.length > 0) {
    return { nodes: variation.value };
  }
  return product.value?.defaultAttributes ? { nodes: product.value.defaultAttributes.nodes ?? [] } : null;
});

const isSimpleProduct = computed<boolean>(() => product.value?.type === ProductTypesEnum.SIMPLE);
const isVariableProduct = computed<boolean>(() => product.value?.type === ProductTypesEnum.VARIABLE);
const isExternalProduct = computed<boolean>(() => product.value?.type === ProductTypesEnum.EXTERNAL);
const externalProduct = computed<ExternalProduct | null>(() => (isExternalProduct.value ? (product.value as ExternalProduct) : null));
const shouldSkipStockRefresh = computed<boolean>(() => isExternalProduct.value);

const displayProduct = computed(() => activeVariation.value || product.value);
const priceTarget = computed(() => activeVariation.value || product.value);
const productImage = computed(() => {
  const img = product.value?.image || null;
  if (img?.sourceUrl) return img;
  const external = (product.value as any)?.externalImageUrl as string | undefined;
  if (external) {
    return {
      sourceUrl: external,
      altText: product.value?.name || '',
      title: product.value?.name || '',
      databaseId: (product.value?.image as any)?.databaseId ?? product.value?.databaseId ?? 0,
    };
  }
  return img;
});
const productGallery = computed(() => {
  const nodes = product.value?.galleryImages?.nodes ?? [];
  if (nodes.length) return { nodes };
  const rawExternal = ((product.value as any)?.externalGalleryUrls ?? []) as (string | null)[];
  const flattened: string[] = [];
  rawExternal.forEach((entry) => {
    if (!entry) return;
    entry
      .split(',')
      .map((s) => s.trim())
      .forEach((url) => {
        if (url) flattened.push(url);
      });
  });
  const seen = new Set<string>();
  const extNodes = flattened
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((url, idx) => ({
      sourceUrl: url,
      altText: product.value?.name || '',
      title: product.value?.name || '',
      databaseId: -1000 - idx,
    }));
  return { nodes: extNodes };
});
const averageRating = computed(() => product.value?.averageRating ?? 0);
const reviewCount = computed(() => product.value?.reviewCount ?? 0);

const selectProductInput = computed<any>(() => ({ productId: displayProduct.value?.databaseId, quantity: quantity.value })) as ComputedRef<AddToCartInput>;

const handleAddToCart = (): void => {
  if (!product.value) return;
  void addToCart(selectProductInput.value, { product: product.value, variation: activeVariation.value });
};

const updateSelectedVariations = (variations: VariationAttribute[]): void => {
  if (!product.value?.variations) return;

  attrValues.value = variations.map((el) => ({ attributeName: el.name, attributeValue: el.value }));
  activeVariation.value = findMatchingVariation(variations);

  selectProductInput.value.variationId = activeVariation.value?.databaseId ?? null;
  selectProductInput.value.variation = activeVariation.value ? attrValues.value : null;
  variation.value = variations;

  // Update URL with current selections for persistence and sharing (client-side only)
  if (import.meta.client) {
    const query: Record<string, string> = {};
    variations.forEach((v) => {
      if (v.name && v.value) {
        query[v.name] = v.value;
      }
    });
    if (activeVariation.value?.databaseId) {
      query.variationId = String(activeVariation.value.databaseId);
    }

    // Build new URL with query params
    const url = new URL(window.location.href);
    url.search = new URLSearchParams(query).toString();

    // Use replaceState to update URL without triggering navigation/scroll
    window.history.replaceState({ ...window.history.state }, '', url.toString());
  }
};

const mergeLiveStockStatus = (payload: ProductDetail): void => {
  product.value.stockStatus = payload.stockStatus ?? product.value.stockStatus;

  payload.variations?.nodes?.forEach((variation: Variation, index: number) => {
    if (product.value?.variations?.nodes?.[index]) {
      product.value.variations.nodes[index].stockStatus = variation.stockStatus;
    }
  });
};

const refreshStockStatus = async (): Promise<void> => {
  try {
    const { product } = await GqlGetStockStatus({ slug });
    if (product) mergeLiveStockStatus(product as ProductDetail);
  } catch (error: any) {
    const errorMessage = error?.gqlErrors?.[0]?.message;
    if (errorMessage) console.error(errorMessage);
  }
};

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type IdleCallbackWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

let stockRefreshHandle: number | null = null;
let stockRefreshHandleType: 'idle' | 'timeout' | null = null;

const scheduleStockRefresh = (): void => {
  if (!import.meta.client || shouldSkipStockRefresh.value) return;

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;

  if (stockRefreshHandle !== null) return;

  const run = () => {
    stockRefreshHandle = null;
    stockRefreshHandleType = null;
    void refreshStockStatus();
  };

  const idleWindow = window as IdleCallbackWindow;
  if (idleWindow.requestIdleCallback) {
    stockRefreshHandleType = 'idle';
    stockRefreshHandle = idleWindow.requestIdleCallback(() => run(), { timeout: 2000 });
  } else {
    stockRefreshHandleType = 'timeout';
    stockRefreshHandle = window.setTimeout(run, 900);
  }
};

onMounted(scheduleStockRefresh);
onBeforeUnmount(() => {
  if (!import.meta.client || stockRefreshHandle === null) return;
  const idleWindow = window as IdleCallbackWindow;
  if (stockRefreshHandleType === 'idle' && idleWindow.cancelIdleCallback) {
    idleWindow.cancelIdleCallback(stockRefreshHandle);
  } else {
    clearTimeout(stockRefreshHandle);
  }
  stockRefreshHandle = null;
  stockRefreshHandleType = null;
});

const stockStatus = computed(() => {
  if (isVariableProduct.value) {
    return activeVariation.value?.stockStatus || (product.value as VariableProduct)?.stockStatus || StockStatusEnum.OUT_OF_STOCK;
  }
  return (product.value as SimpleProduct | VariableProduct)?.stockStatus || StockStatusEnum.OUT_OF_STOCK;
});

const disabledAddToCart = computed(() => {
  const isOutOfStock = stockStatus.value === StockStatusEnum.OUT_OF_STOCK;
  const isInvalidType = !displayProduct.value;
  const isCartUpdating = isOptimisticCartMode.value ? false : isUpdatingCart.value || isAddingToCart.value;
  const isValidActiveVariation = isVariableProduct.value ? !!activeVariation.value : true;
  return isInvalidType || isOutOfStock || isCartUpdating || !isValidActiveVariation;
});

const addToCartLoading = computed(() => (isOptimisticCartMode.value ? false : isUpdatingCart.value));

const runtimeConfig = useRuntimeConfig();
const currencyCode = runtimeConfig.public?.CURRENCY_CODE || 'USD';

const canonicalUrl = computed(() => {
  const path = route.path || '';
  if (!frontEndUrl) return path;
  return `${frontEndUrl}${path.startsWith('/') ? path : `/${path}`}`;
});

const makeAbsolute = (url?: string | null): string => {
  const value = (url || '').toString();
  if (!value) return '';
  if (value.startsWith('http')) return value;
  if (!frontEndUrl) return value;
  return `${frontEndUrl}${value.startsWith('/') ? value : `/${value}`}`;
};

const productImages = computed<string[]>(() => {
  const imgs: string[] = [];
  const main = productImage.value?.sourceUrl || '';
  if (main) imgs.push(makeAbsolute(main));
  (productGallery.value.nodes || []).forEach((img: any) => {
    if (img?.sourceUrl) imgs.push(makeAbsolute(img.sourceUrl));
  });
  return imgs.length ? imgs : [makeAbsolute('/images/placeholder.jpg')];
});

const availabilityMap: Record<StockStatusEnum, string> = {
  [StockStatusEnum.IN_STOCK]: 'https://schema.org/InStock',
  [StockStatusEnum.OUT_OF_STOCK]: 'https://schema.org/OutOfStock',
  [StockStatusEnum.ON_BACKORDER]: 'https://schema.org/BackOrder',
};

const toNumber = (value?: string | null): number | null => {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const selectedPrice = computed<number | null>(() => {
  const target: any = priceTarget.value || {};
  const sale = target.rawSalePrice ?? target.salePrice ?? null;
  const regular = target.rawRegularPrice ?? target.regularPrice ?? target.price ?? null;
  return toNumber(sale) ?? toNumber(regular);
});

const jsonLdOffers = computed<any | null>(() => {
  if (isVariableProduct.value && !activeVariation.value) {
    const offers = (product.value?.variations?.nodes || [])
      .map((v: any) => {
        const price =
          toNumber(v?.rawSalePrice) ??
          toNumber(v?.salePrice) ??
          toNumber(v?.rawRegularPrice) ??
          toNumber(v?.regularPrice) ??
          null;
        if (price == null) return null;
        return {
          '@type': 'Offer',
          priceCurrency: currencyCode,
          price,
          availability: availabilityMap[v?.stockStatus as StockStatusEnum] || 'https://schema.org/InStock',
          url: canonicalUrl.value,
        };
      })
      .filter(Boolean);
    if (offers.length) {
      const prices = offers.map((o: any) => o.price as number);
      return {
        '@type': 'AggregateOffer',
        priceCurrency: currencyCode,
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offers,
      };
    }
  }
  const price = selectedPrice.value;
  if (price != null) {
    return {
      '@type': 'Offer',
      priceCurrency: currencyCode,
      price,
      availability: availabilityMap[stockStatus.value as StockStatusEnum] || 'https://schema.org/InStock',
      url: canonicalUrl.value,
      itemCondition: 'https://schema.org/NewCondition',
    };
  }
  return null;
});

const jsonLdProduct = computed(() => {
  const description = (product.value?.shortDescription || product.value?.description || '').replace(/<[^>]+>/g, '').trim();
  const data: any = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.value?.name || '',
    sku: product.value?.sku || undefined,
    image: productImages.value,
    description,
    offers: jsonLdOffers.value || undefined,
    url: canonicalUrl.value,
  };
  if (averageRating.value && reviewCount.value) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: averageRating.value,
      reviewCount: reviewCount.value,
    };
  }
  return data;
});

const breadcrumbJsonLd = computed(() => {
  const items: any[] = [];
  items.push({ '@type': 'ListItem', position: 1, name: 'Home', item: frontEndUrl || '/' });
  const category = product.value?.productCategories?.nodes?.[0] || null;
  if (category) {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: category.name || '',
      item: `${frontEndUrl}/product-category/${decodeURIComponent(category?.slug || '')}`,
    });
  }
  items.push({
    '@type': 'ListItem',
    position: items.length + 1,
    name: product.value?.name || '',
    item: canonicalUrl.value,
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
});

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(jsonLdProduct.value),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(breadcrumbJsonLd.value),
    },
  ],
});

const formName = ref('');
const formEmail = ref('');
const formCountry = ref('');
const formLanguage = ref('');
const formMessage = ref('');
const submittingMessage = ref(false);
const submitMessageSuccess = ref(false);
const submitMessageError = ref('');
const turnstileContainer = ref<HTMLElement | null>(null);
const turnstileLoaded = ref(false);
const turnstileToken = ref<string>('');
const turnstileWidgetId = ref<any>(null);
const siteKey =
  ((runtimeConfig.public as any)?.TURNSTILE_SITE_KEY as string) ||
  ((runtimeConfig.public as any)?.NUXT_PUBLIC_TURNSTILE_SITE_KEY as string) ||
  ((runtimeConfig.public as any)?.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string) ||
  ((import.meta as any).env?.NUXT_PUBLIC_TURNSTILE_SITE_KEY as string) ||
  ((import.meta as any).env?.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string) ||
  '';

const renderTurnstile = (): void => {
  const w: any = window as any;
  if (!w.turnstile || !turnstileContainer.value || !siteKey) return;
  if (turnstileWidgetId.value) {
    try {
      w.turnstile.reset(turnstileWidgetId.value);
    } catch {}
    return;
  }
  turnstileWidgetId.value = w.turnstile.render(turnstileContainer.value, {
    sitekey: siteKey,
    callback: (token: string) => {
      turnstileToken.value = token;
    },
  });
};

const loadTurnstile = (): void => {
  if (!import.meta.client) return;
  const already = !!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
  if (already) {
    turnstileLoaded.value = true;
    renderTurnstile();
    return;
  }
  if (turnstileLoaded.value) return;
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  s.defer = true;
  s.onload = () => {
    turnstileLoaded.value = true;
    renderTurnstile();
  };
  document.head.appendChild(s);
};

const onMessageAreaActivate = async (): Promise<void> => {
  await nextTick();
  loadTurnstile();
  // If script is already present and widget not rendered yet, try render explicitly
  renderTurnstile();
};

const handleSubmitMessage = async (): Promise<void> => {
  try {
    submitMessageError.value = '';
    submitMessageSuccess.value = false;
    submittingMessage.value = true;
    if (!turnstileToken.value) {
      throw createError({ statusCode: 400, statusMessage: 'Missing Turnstile token' });
    }
    const body = {
      name: formName.value,
      email: formEmail.value,
      country: formCountry.value,
      language: formLanguage.value,
      message: formMessage.value,
      product_url: canonicalUrl.value,
      product_name: product.value?.name || '',
      token: turnstileToken.value,
    };
    const res = await $fetch('/api/messages', { method: 'POST', body });
    if (res) {
      submitMessageSuccess.value = true;
      formName.value = '';
      formEmail.value = '';
      formCountry.value = '';
      formLanguage.value = '';
      formMessage.value = '';
      turnstileToken.value = '';
    }
  } catch (e: any) {
    submitMessageError.value = e?.data?.message || 'Submission failed';
  } finally {
    submittingMessage.value = false;
  }
};
</script>

<template>
  <main class="container relative py-6 xl:max-w-7xl">
    <div v-if="product">
      <SEOHead :info="product" />
      <Breadcrumb :product class="mb-6" v-if="storeSettings.showBreadcrumbOnSingleProduct" />

      <div class="flex flex-col gap-10 md:flex-row md:justify-between lg:gap-24">
        <ProductImageGallery
          v-if="productImage"
          class="relative flex-1"
          :main-image="productImage"
          :gallery="productGallery"
          :node="displayProduct"
          :activeVariation="activeVariation || {}" />
        <NuxtImg v-else class="relative flex-1 skeleton" src="/images/placeholder.jpg" :alt="product?.name || 'Product'" />

        <div class="w-full lg:max-w-md xl:max-w-lg md:py-2">
          <div class="flex justify-between mb-4">
            <div class="flex-1">
              <h1 class="flex flex-wrap items-center gap-2 mb-2 text-2xl font-sesmibold dark:text-white">
                {{ displayProduct.name }}
                <LazyWPAdminLink :link="`/wp-admin/post.php?post=${product.databaseId}&action=edit`">Edit</LazyWPAdminLink>
              </h1>
              <StarRating :rating="averageRating" :count="reviewCount" v-if="storeSettings.showReviews" />
            </div>
            <ProductPrice class="text-xl" :sale-price="priceTarget?.salePrice" :regular-price="priceTarget?.regularPrice" />
          </div>

          <div class="grid gap-2 my-8 text-sm empty:hidden">
            <div v-if="!isExternalProduct" class="flex items-center gap-2">
              <span class="text-gray-400 dark:text-gray-500">{{ $t('shop.availability') }}: </span>
              <StockStatus :stockStatus @updated="mergeLiveStockStatus" />
            </div>
            <div class="flex items-center gap-2" v-if="storeSettings.showSKU && product?.sku">
              <span class="text-gray-400 dark:text-gray-500">{{ $t('shop.sku') }}: </span>
              <span class="dark:text-gray-300">{{ product?.sku || 'N/A' }}</span>
            </div>
          </div>

          <div class="mb-8 font-light prose dark:prose-invert" v-html="product.shortDescription || product.description" />

          <hr class="border-gray-300 dark:border-gray-600" />

          <form @submit.prevent="handleAddToCart">
            <AttributeSelections
              v-if="isVariableProduct && product?.attributes?.nodes?.length && product?.variations"
              class="mt-4 mb-8"
              :attributes="product.attributes.nodes"
              :defaultAttributes="defaultAttributes"
              :variations="product.variations.nodes"
              @attrs-changed="updateSelectedVariations" />
            <div
              v-if="isVariableProduct || isSimpleProduct"
              class="fixed bottom-0 left-0 z-10 flex items-center w-full gap-4 p-4 mt-12 shadow-lg bg-white/90 md:static md:bg-transparent md:p-0 md:shadow-none dark:shadow-gray-900">
              <input
                v-model="quantity"
                type="number"
                min="1"
                aria-label="Quantity"
                class="flex items-center justify-center w-20 gap-4 p-2 text-left bg-white border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:outline-hidden dark:text-white" />
              <Button class="flex-1 w-full" :disabled="disabledAddToCart" :loading="addToCartLoading" type="submit">
                {{ $t('shop.addToCart') }}
              </Button>
            </div>
            <a
              v-if="externalProduct?.externalUrl"
              :href="externalProduct.externalUrl"
              target="_blank"
              class="rounded-lg flex font-bold bg-gray-800 dark:bg-gray-700 text-white text-center min-w-37.5 p-2.5 gap-4 items-center justify-center focus:outline-hidden hover:bg-gray-700 dark:hover:bg-gray-600">
              {{ externalProduct?.buttonText || 'View product' }}
            </a>
          </form>

          <div v-if="storeSettings.showProductCategoriesOnSingleProduct && product.productCategories">
            <div class="grid gap-2 my-8 text-sm">
              <div class="flex items-center gap-2">
                <span class="text-gray-400 dark:text-gray-500">{{ $t('shop.category', 2) }}:</span>
                <div class="product-categories">
                  <NuxtLink
                    v-for="category in product.productCategories.nodes"
                    :key="category.databaseId"
                    :to="`/product-category/${decodeURIComponent(category?.slug || '')}`"
                    class="hover:text-primary dark:text-gray-300 dark:hover:text-primary"
                    :title="category.name || ''"
                    >{{ category.name }}<span class="comma">, </span>
                  </NuxtLink>
                </div>
              </div>
            </div>
            <hr class="border-gray-300 dark:border-gray-600" />
          </div>

          <div class="flex flex-wrap gap-4">
            <WishlistButton :product />
            <ShareButton :product />
          </div>

        </div>
      </div>
      <div v-if="product.description || product.reviews" class="my-32">
        <ProductTabs :product />
      </div>
      <div class="my-12">
        <div class="mb-4 text-xl font-semibold dark:text-white">Send a Message</div>
          <form class="grid gap-4 max-w-xl" @submit.prevent="handleSubmitMessage">
          <input v-model="formName" class="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" type="text" placeholder="Name" required />
          <input v-model="formEmail" class="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" type="email" placeholder="Email" required />
          <input v-model="formCountry" class="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" type="text" placeholder="Country" />
          <input v-model="formLanguage" class="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" type="text" placeholder="Language" />
          <textarea
            v-model="formMessage"
            class="p-2 border rounded-lg min-h-[120px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Message"
            required
            @focus="onMessageAreaActivate"
            @click="onMessageAreaActivate" />
          <input type="hidden" :value="product?.name || ''" />
          <input type="hidden" :value="canonicalUrl" />
          <ClientOnly>
            <div ref="turnstileContainer" class="mt-2"></div>
          </ClientOnly>
          <Button type="submit" :loading="submittingMessage" class="w-full">Submit</Button>
          <div v-if="submitMessageSuccess" class="text-green-600 dark:text-green-400">Submitted successfully</div>
          <div v-if="submitMessageError" class="text-red-600 dark:text-red-400">{{ submitMessageError }}</div>
        </form>
      </div>
      <div class="my-32" v-if="product.related && storeSettings.showRelatedProducts">
        <div class="mb-4 text-xl font-semibold dark:text-white">{{ $t('shop.youMayLike') }}</div>
        <LazyProductRow :products="product.related.nodes" class="grid-cols-2 md:grid-cols-4 lg:grid-cols-5" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.product-categories > a:last-child .comma {
  display: none;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  opacity: 1;
}

/* Dark mode uses color-scheme to style native controls */
.dark input[type='number'] {
  color-scheme: dark;
}
</style>
