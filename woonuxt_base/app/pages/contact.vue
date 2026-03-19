<script lang="ts" setup>
import { nextTick } from 'vue';

const route = useRoute();
const { frontEndUrl } = useHelpers();
const { locale } = useI18n();

const formName = ref('');
const formEmail = ref('');
const formCountry = ref('');
const formLanguage = ref('');
const formMessage = ref('');
const submittingMessage = ref(false);
const submitMessageSuccess = ref(false);
const submitMessageError = ref('');
const showTurnstile = ref(false);
const turnstileToken = ref<string>('');
const submitRecord = ref<any | null>(null);
const submissionSuccessRef = ref<HTMLElement | null>(null);

const canonicalUrl = computed(() => {
  const path = route.path || '';
  if (!frontEndUrl) return path;
  return `${frontEndUrl}${path.startsWith('/') ? path : `/${path}`}`;
});

const browserLanguage = computed<string>(() => {
  if (import.meta.client) {
    const v = navigator.language || (navigator.languages && navigator.languages[0]) || '';
    if (v) return v;
  }
  return (locale as any)?.value || 'en';
});

const onMessageAreaActivate = async (): Promise<void> => {
  await nextTick();
  showTurnstile.value = true;
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
      language: formLanguage.value || browserLanguage.value,
      message: formMessage.value,
      product_url: canonicalUrl.value,
      product_name: '',
      token: turnstileToken.value,
    };
    const res = await $fetch('/api/messages', { method: 'POST', body });
    if (res) {
      submitRecord.value = res as any;
      submitMessageSuccess.value = true;
      formName.value = '';
      formEmail.value = '';
      formCountry.value = '';
      formLanguage.value = '';
      formMessage.value = '';
      turnstileToken.value = '';
      await nextTick();
      submissionSuccessRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (e: any) {
    submitMessageError.value = e?.data?.message || 'Submission failed';
  } finally {
    submittingMessage.value = false;
  }
};
</script>

<template>
  <div class="container my-8">
    <h1 class="mb-8 text-3xl font-semibold text-primary">Contact Us</h1>
    <div class="my-12">
      <div class="grid gap-8 md:grid-cols-2 items-start">
        <div class="order-first md:order-none">
          <div class="p-4 rounded border border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
            <div class="mb-2 text-lg font-semibold dark:text-white">Form Information</div>
            <p class="text-sm text-gray-700 dark:text-gray-300">
              After you submit the form, a confirmation message with your reference number will appear on this page. Please keep it for your records.
            </p>
            <p class="mt-3 text-sm text-gray-700 dark:text-gray-300">
              You can also contact us via email: 
              <a href="mailto:support@koopower.com" class="font-medium text-primary hover:underline">support@koopower.com</a>
            </p>
          </div>
          <div
            v-if="submitMessageSuccess"
            ref="submissionSuccessRef"
            class="mt-4 p-4 rounded border border-green-400 bg-green-50 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-100">
            <div class="mb-1 text-lg font-semibold">Submission Successful</div>
            <div class="text-sm" v-if="submitRecord?.id">Reference number: <span class="font-semibold">{{ submitRecord.id }}</span></div>
            <div class="text-sm">Use it to track your inquiry. We typically reply within 12–24 hours.</div>
          </div>
          <div class="mt-4 p-4 rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
            <ul class="space-y-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <li class="flex items-center">
                <span class="mr-2 text-green-500">✔</span> Fast response within 24h
              </li>
              <li class="flex items-center">
                <span class="mr-2 text-green-500">✔</span> Free sample available
              </li>
              <li class="flex items-center">
                <span class="mr-2 text-green-500">✔</span> OEM & custom support
              </li>
            </ul>
          </div>
        </div>
        <div>
          <div class="mb-4 text-xl font-semibold dark:text-white">Send a Message</div>
          <form class="grid gap-4 max-w-xl" @submit.prevent="handleSubmitMessage">
            <input v-model="formName" class="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" type="text" placeholder="Name" required />
            <input v-model="formEmail" class="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" type="email" placeholder="Email" required />
            <input v-model="formCountry" class="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" type="text" placeholder="Country" />
            <input type="hidden" :value="(formLanguage = browserLanguage)" />
            <textarea
              v-model="formMessage"
              class="p-2 border rounded-lg min-h-[120px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Message"
              required
              @focus="onMessageAreaActivate"
              @click="onMessageAreaActivate" />
            <input type="hidden" :value="canonicalUrl" />
            <ClientOnly>
              <NuxtTurnstile v-if="showTurnstile" v-model="turnstileToken" class="mt-2" />
            </ClientOnly>
            <Button type="submit" :loading="submittingMessage" class="w-full">Submit</Button>
            <div v-if="submitMessageError" class="text-red-600 dark:text-red-400">{{ submitMessageError }}</div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
