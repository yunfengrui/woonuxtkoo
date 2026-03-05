<script setup lang="ts">
import type { ProductAttribute, ProductVariationFragment, VariationAttribute } from '#types/gql';

interface Props {
  attributes: ProductAttribute[];
  defaultAttributes?: { nodes: VariationAttribute[] } | null;
  variations?: ProductVariationFragment[] | null;
}

const { attributes, defaultAttributes, variations } = defineProps<Props>();
const emit = defineEmits(['attrs-changed']);

const selections = ref<Record<string, string>>({});

const primaryAttribute = computed(() => {
  if (!attributes?.length) return null;
  return attributes.find((attr) => ['pa_color', 'color'].includes(attr?.name || '')) ?? attributes[0];
});

const primarySelection = computed(() => {
  const primary = primaryAttribute.value;
  const name = primary?.name || '';
  if (!name) return '';
  return selections.value[name] ?? '';
});

const normalizeMatchToken = (name?: string | null): string =>
  (name ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s-_]+/g, '');

const stripPaPrefix = (name?: string | null): string =>
  (name ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^pa[_-]/, '');

const normalizeMatchKey = (name?: string | null): string => normalizeMatchToken(stripPaPrefix(name));

const normalizeMatchValue = (value?: string | null): string => normalizeMatchToken(value);

const toSelectionName = (name?: string | null): string => {
  if (!name) return '';
  return name.charAt(0).toLowerCase() + name.slice(1);
};

const toHintLabel = (label?: string | null): string => (label ?? '').toString().trim().toLowerCase();

const getSelectionHint = (attr: ProductAttribute): string => {
  const primary = primaryAttribute.value;
  if (!primary || primary === attr) return '';
  if (primarySelection.value) return '';

  const primaryLabel = toHintLabel(primary.label ?? primary.name);
  const attrLabel = toHintLabel(attr.label ?? attr.name);
  if (!primaryLabel || !attrLabel) return '';

  return `Select ${primaryLabel} to see available ${attrLabel}`;
};

const getSelectedName = (attr: ProductAttribute, value?: string) => {
  if (!value) return '';
  if ('terms' in attr && attr?.terms?.nodes?.length) {
    return attr.terms.nodes.find((node: { slug?: string | null; name?: string | null }) => node?.slug === value)?.name ?? value;
  }

  return value;
};

const emitSelection = () => {
  const selectedVariations = attributes.map(
    (row): VariationAttribute => ({
      name: toSelectionName(row?.name),
      value: selections.value[row?.name ?? ''] ?? '',
    }),
  );

  emit('attrs-changed', selectedVariations);
};

const buildSelectionMap = (source: Record<string, string>, excludeName?: string): Record<string, string> => {
  const map: Record<string, string> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (excludeName && key === excludeName) return;
    const normalizedKey = normalizeMatchKey(key);
    const normalizedValue = normalizeMatchValue(value);
    if (!normalizedKey || !normalizedValue) return;
    map[normalizedKey] = normalizedValue;
  });
  return map;
};

const normalizedVariations = computed(() => {
  if (!variations?.length) return [];
  return variations.map((variation) => {
    const attrs: Record<string, string> = {};
    variation?.attributes?.nodes?.forEach((attr: VariationAttribute) => {
      const key = normalizeMatchKey(attr.name);
      if (!key) return;
      attrs[key] = normalizeMatchValue(attr.value);
    });
    const specificity = Object.values(attrs).filter(Boolean).length;
    return { variation, attrs, specificity };
  });
});

const isOptionEnabled = (attrName: string, optionValue: string, source: Record<string, string> = selections.value): boolean => {
  if (!variations?.length) return true;
  const attrKey = normalizeMatchKey(attrName);
  const optionKey = normalizeMatchValue(optionValue);
  if (!attrKey || !optionKey) return true;

  const selectedMap = buildSelectionMap(source, attrName);

  return normalizedVariations.value.some((candidate) => {
    for (const [key, value] of Object.entries(selectedMap)) {
      const candidateValue = candidate.attrs[key];
      if (!candidateValue) continue;
      if (candidateValue !== value) return false;
    }

    const candidateAttrValue = candidate.attrs[attrKey];
    if (!candidateAttrValue) return true;
    return candidateAttrValue === optionKey;
  });
};

const matchesSelection = (candidateAttrs: Record<string, string>, source: Record<string, string>): boolean => {
  const selectedMap = buildSelectionMap(source);
  if (Object.keys(selectedMap).length === 0) return true;

  for (const [key, value] of Object.entries(selectedMap)) {
    const candidateValue = candidateAttrs[key];
    if (!candidateValue) continue;
    if (candidateValue !== value) return false;
  }

  return true;
};

const hasValidCombination = (source: Record<string, string>): boolean => {
  if (!variations?.length) return true;
  return normalizedVariations.value.some((candidate) => matchesSelection(candidate.attrs, source));
};

const findBestVariationForSelection = (source: Record<string, string>, requiredKey?: string): ProductVariationFragment | null => {
  if (!variations?.length) return null;
  const selectedMap = buildSelectionMap(source);
  if (requiredKey && !selectedMap[requiredKey]) return null;

  let best: { variation: ProductVariationFragment; score: number } | null = null;

  for (const candidate of normalizedVariations.value) {
    if (requiredKey) {
      const requiredValue = selectedMap[requiredKey];
      const candidateValue = candidate.attrs[requiredKey];
      if (candidateValue && candidateValue !== requiredValue) continue;
    }

    let matches = true;
    let matchedSpecific = 0;
    let mismatchedSpecific = 0;

    for (const [key, value] of Object.entries(selectedMap)) {
      const candidateValue = candidate.attrs[key];
      if (!candidateValue) continue;
      if (candidateValue !== value) {
        if (!requiredKey || key === requiredKey) {
          matches = false;
          break;
        }
        mismatchedSpecific += 1;
        continue;
      }
      if (candidateValue === value) matchedSpecific += 1;
    }

    if (!matches) continue;

    const score = matchedSpecific * 100 + candidate.specificity - mismatchedSpecific * 10;
    if (!best || score > best.score) {
      best = { variation: candidate.variation, score };
    }
  }

  return best?.variation ?? null;
};

const applyVariationSelections = (variation: ProductVariationFragment, source: Record<string, string>): Record<string, string> => {
  if (!variation?.attributes?.nodes) return source;

  const next = { ...source };
  const attrNodes = variation.attributes?.nodes;
  if (!attrNodes) return next;
  attributes.forEach((attr) => {
    const key = attr?.name ?? '';
    if (!key) return;

    const matchKey = normalizeMatchKey(key);
    const matchingAttr = attrNodes.find((variationAttr: VariationAttribute) => normalizeMatchKey(variationAttr.name) === matchKey);
    if (!matchingAttr) return;

    next[key] = matchingAttr.value ?? '';
  });

  return next;
};

const resolveInvalidSelections = (source: Record<string, string>, options: { allowEmpty?: boolean; preferClear?: boolean } = {}): Record<string, string> => {
  const allowEmpty = options.allowEmpty ?? true;
  const preferClear = options.preferClear ?? true;
  let next = { ...source };
  let changed = true;
  let guard = 0;

  while (changed && guard < 5) {
    guard += 1;
    changed = false;

    attributes.forEach((attr) => {
      const key = attr?.name ?? '';
      if (!key) return;

      const currentValue = next[key];
      if (currentValue && isOptionEnabled(key, currentValue, next)) return;
      if (!currentValue && allowEmpty) return;

      const options =
        attr.scope === 'LOCAL'
          ? (attr.options ?? []).filter((option): option is string => !!option)
          : ('terms' in attr ? (attr.terms?.nodes ?? []) : []).map((term) => term?.slug).filter((slug): slug is string => !!slug);

      const fallback = options.find((option) => isOptionEnabled(key, option, next)) ?? '';
      const nextValue = preferClear && currentValue ? '' : fallback;
      if (nextValue !== currentValue) {
        next = { ...next, [key]: nextValue };
        changed = true;
      }
    });
  }

  return next;
};

const handleSelectionChange = (changedKey?: string) => {
  if (!variations?.length) {
    emitSelection();
    return;
  }

  if (hasValidCombination(selections.value)) {
    emitSelection();
    return;
  }

  const requiredKey = changedKey ? normalizeMatchKey(changedKey) : undefined;
  const best = findBestVariationForSelection(selections.value, requiredKey);
  if (best) {
    selections.value = applyVariationSelections(best, selections.value);
    emitSelection();
    return;
  }

  const resolved = resolveInvalidSelections(selections.value, { allowEmpty: true, preferClear: true });
  const resolvedKeys = Object.keys(resolved);
  const currentKeys = Object.keys(selections.value);
  const hasChanges = resolvedKeys.length !== currentKeys.length || resolvedKeys.some((key) => selections.value[key] !== resolved[key]);

  if (hasChanges) {
    selections.value = resolved;
  }

  emitSelection();
};

const setInitialSelections = () => {
  const defaults = new Map<string, string>();
  defaultAttributes?.nodes?.forEach((attr: VariationAttribute) => {
    const key = normalizeMatchKey(attr.name);
    if (key) defaults.set(key, attr.value ?? '');
  });

  const nextSelections: Record<string, string> = { ...selections.value };
  attributes.forEach((attr) => {
    const key = attr?.name ?? '';
    if (!key) return;

    const matchKey = normalizeMatchKey(key);
    const defaultValue = defaults.get(matchKey);
    if (defaultValue !== undefined) {
      nextSelections[key] = defaultValue ?? '';
      return;
    }
  });

  const resolved = resolveInvalidSelections(nextSelections, { allowEmpty: true, preferClear: true });
  const currentKeys = Object.keys(selections.value);
  const resolvedKeys = Object.keys(resolved);
  const hasChanges = currentKeys.length !== resolvedKeys.length || resolvedKeys.some((key) => selections.value[key] !== resolved[key]);

  if (!hasChanges) return;

  selections.value = resolved;
  emitSelection();
};

const className = (name: string) => (name ? `name-${name.toLowerCase().split(' ').join('-')}` : '');

const COLOR_HEX: Record<string, string> = {
  gold: '#D4AF37',
  'champagnegold': '#E4C27A',
  'champagne-gold': '#E4C27A',
  silver: '#C0C0C0',
  'rose-gold': '#B76E79',
  spacegray: '#4B4B4B',
  graphite: '#3A3A3A',
  charcoal: '#36454F',
  white: '#FFFFFF',
  offwhite: '#F8F8F8',
  ivory: '#FFFFF0',
  beige: '#F5F5DC',
  cream: '#FFFDD0',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
  lightgray: '#D3D3D3',
  darkgray: '#4B4B4B',
  blue: '#3B82F6',
  navy: '#001F3F',
  cobalt: '#0047AB',
  skyblue: '#87CEEB',
  indigo: '#4B0082',
  cyan: '#00BCD4',
  turquoise: '#40E0D0',
  aqua: '#00FFFF',
  green: '#22C55E',
  forestgreen: '#228B22',
  emerald: '#50C878',
  lime: '#A3E635',
  yellow: '#EAB308',
  mustard: '#FFDB58',
  orange: '#F97316',
  peach: '#FFDAB9',
  coral: '#FF7F50',
  red: '#EF4444',
  crimson: '#DC143C',
  maroon: '#800000',
  burgundy: '#800020',
  wine: '#722F37',
  magenta: '#FF00FF',
  pink: '#FFC0CB',
  'hot-pink': '#FF69B4',
  purple: '#A855F7',
  lavender: '#E6E6FA',
  violet: '#8F00FF',
  teal: '#008080',
  mint: '#3EB489',
  olive: '#808000',
  khaki: '#C3B091',
  brown: '#8B4513',
  tan: '#D2B48C',
  camel: '#C19A6B',
};

const resolveColorHex = (slug?: string | null): string | null => {
  const v = normalizeMatchValue(slug);
  if (!v) return null;
  if (COLOR_HEX[v]) return COLOR_HEX[v];
  if (v.includes('gold')) return COLOR_HEX['gold'];
  if (v.includes('silver')) return COLOR_HEX['silver'];
  if (v.includes('rose') && v.includes('gold')) return COLOR_HEX['rose-gold'];
  if (v.includes('champagne') && v.includes('gold')) return COLOR_HEX['champagnegold'];
  if (v.includes('space') && v.includes('gray')) return COLOR_HEX['spacegray'];
  if (v.includes('graphite')) return COLOR_HEX['graphite'];
  if (v.includes('charcoal')) return COLOR_HEX['charcoal'];
  if (v.includes('white')) return COLOR_HEX['white'];
  if (v.includes('off') && v.includes('white')) return COLOR_HEX['offwhite'];
  if (v.includes('ivory')) return COLOR_HEX['ivory'];
  if (v.includes('beige')) return COLOR_HEX['beige'];
  if (v.includes('cream')) return COLOR_HEX['cream'];
  if (v.includes('black')) return COLOR_HEX['black'];
  if (v.includes('grey') || v.includes('gray')) return COLOR_HEX['gray'];
  if (v.includes('navy')) return COLOR_HEX['navy'];
  if (v.includes('cobalt')) return COLOR_HEX['cobalt'];
  if (v.includes('sky') && v.includes('blue')) return COLOR_HEX['skyblue'];
  if (v.includes('indigo')) return COLOR_HEX['indigo'];
  if (v.includes('cyan')) return COLOR_HEX['cyan'];
  if (v.includes('turquoise')) return COLOR_HEX['turquoise'];
  if (v.includes('aqua')) return COLOR_HEX['aqua'];
  if (v.includes('forest') && v.includes('green')) return COLOR_HEX['forestgreen'];
  if (v.includes('emerald')) return COLOR_HEX['emerald'];
  if (v.includes('lime')) return COLOR_HEX['lime'];
  if (v.includes('mustard')) return COLOR_HEX['mustard'];
  if (v.includes('peach')) return COLOR_HEX['peach'];
  if (v.includes('coral')) return COLOR_HEX['coral'];
  if (v.includes('crimson')) return COLOR_HEX['crimson'];
  if (v.includes('maroon')) return COLOR_HEX['maroon'];
  if (v.includes('burgundy')) return COLOR_HEX['burgundy'];
  if (v.includes('wine')) return COLOR_HEX['wine'];
  if (v.includes('magenta')) return COLOR_HEX['magenta'];
  if (v.includes('hot') && v.includes('pink')) return COLOR_HEX['hot-pink'];
  if (v.includes('lavender')) return COLOR_HEX['lavender'];
  if (v.includes('violet')) return COLOR_HEX['violet'];
  if (v.includes('teal')) return COLOR_HEX['teal'];
  if (v.includes('mint')) return COLOR_HEX['mint'];
  if (v.includes('olive')) return COLOR_HEX['olive'];
  if (v.includes('khaki')) return COLOR_HEX['khaki'];
  if (v.includes('brown')) return COLOR_HEX['brown'];
  if (v.includes('tan')) return COLOR_HEX['tan'];
  if (v.includes('camel')) return COLOR_HEX['camel'];
  return null;
};

const getColorStyle = (slug?: string | null): Record<string, string> => {
  const hex = resolveColorHex(slug);
  return hex ? { backgroundColor: hex } : {};
};

watch(
  () => [attributes, defaultAttributes, variations],
  () => setInitialSelections(),
  { deep: true, immediate: true },
);
</script>

<template>
  <div class="flex flex-col justify-between gap-1" v-if="attributes">
    <div v-for="(attr, i) in attributes" :key="i" class="relative flex flex-wrap justify-between py-2">
      <!-- LOCAL -->
      <div v-if="attr.scope == 'LOCAL'" class="grid gap-2">
        <div class="text-sm dark:text-gray-300">
          {{ attr.label || attr.name }}
          <span v-if="selections[attr.name || '']" class="text-gray-400 dark:text-gray-500">: {{ getSelectedName(attr, selections[attr.name || '']) }}</span>
        </div>
        <div v-if="getSelectionHint(attr)" class="text-xs text-gray-400 dark:text-gray-500">
          {{ getSelectionHint(attr) }}
        </div>
        <div class="flex gap-2">
          <span v-for="(option, index) in (attr.options || []).filter((option): option is string => !!option)" :key="index">
            <label :for="`${option}_${index}`">
              <input
                :id="`${option}_${index}`"
                class="hidden"
                type="radio"
                :class="className(attr.name || '')"
                :name="attr.name || ''"
                :value="option"
                v-model="selections[attr.name || '']"
                :aria-disabled="!isOptionEnabled(attr.name || '', option)"
                @change="handleSelectionChange(attr.name || '')" />
              <span
                class="radio-button"
                :class="[`picker-${option}`, { 'is-disabled': !isOptionEnabled(attr.name || '', option) }]"
                :title="`${attr.label || attr.name}: ${option}`"
                >{{ option }}</span
              >
            </label>
          </span>
        </div>
      </div>

      <!-- COLOR SWATCHES -->
      <div v-else-if="attr.name == 'pa_color' || attr.name == 'color'" class="grid gap-2">
        <div class="text-sm">
          {{ $t('general.color') }}
          <span v-if="selections[attr.name || '']" class="text-gray-400">{{ getSelectedName(attr, selections[attr.name || '']) }}</span>
        </div>
        <div v-if="getSelectionHint(attr)" class="text-xs text-gray-400 dark:text-gray-500">
          {{ getSelectionHint(attr) }}
        </div>
        <div class="flex gap-2">
          <span
            v-for="(term, termIndex) in 'terms' in attr && attr.terms?.nodes ? attr.terms.nodes.filter((term) => term?.slug) : []"
            :key="term.slug || termIndex">
            <Tooltip :text="term.name || ''">
              <label :for="`${term.slug || ''}_${termIndex}`">
                <input
                  :id="`${term.slug || ''}_${termIndex}`"
                  class="hidden"
                  type="radio"
                  :class="className(attr.name || '')"
                  :name="attr.name || ''"
                  :value="term.slug || ''"
                  v-model="selections[attr.name || '']"
                  :aria-disabled="!isOptionEnabled(attr.name || '', term.slug || '')"
                  @change="handleSelectionChange(attr.name || '')" />
                <span
                  class="color-button"
                  :class="[`color-${term.slug}`, { 'is-disabled': !isOptionEnabled(attr.name || '', term.slug || '') }]"
                  :style="getColorStyle(term.slug || '')"
                  :title="`${attr.label || attr.name}: ${term.name || term.slug}`"></span>
              </label>
            </Tooltip>
          </span>
        </div>
      </div>

      <!-- DROPDOWN -->
      <div v-else-if="'terms' in attr && (attr.terms?.nodes?.length || 0) > 8" class="grid gap-2">
        <div class="text-sm dark:text-gray-300">
          {{ attr.label || attr.name }}
          <span v-if="selections[attr.name || '']" class="text-gray-400 dark:text-gray-500">{{ getSelectedName(attr, selections[attr.name || '']) }}</span>
        </div>
        <div v-if="getSelectionHint(attr)" class="text-xs text-gray-400 dark:text-gray-500">
          {{ getSelectionHint(attr) }}
        </div>
        <select
          :id="attr.name || ''"
          :name="attr.name || ''"
          required
          class="border-white shadow-xs select dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          v-model="selections[attr.name || '']"
          @change="handleSelectionChange(attr.name || '')">
          <option disabled hidden>{{ $t('general.choose') }} {{ decodeURIComponent(attr.label || attr.name || '') }}</option>
          <option
            v-for="(term, dropdownIndex) in 'terms' in attr && attr.terms?.nodes ? attr.terms.nodes.filter((term) => term?.slug) : []"
            :key="term.slug || dropdownIndex"
            :value="term.slug || ''"
            :aria-disabled="!isOptionEnabled(attr.name || '', term.slug || '')"
            v-html="term.name" />
        </select>
      </div>

      <!-- CHECKBOXES -->
      <div v-else class="grid gap-2">
        <div class="text-sm dark:text-gray-300">
          {{ attr.label || attr.name }}
          <span v-if="selections[attr.name || '']" class="text-gray-400 dark:text-gray-500">: {{ getSelectedName(attr, selections[attr.name || '']) }}</span>
        </div>
        <div v-if="getSelectionHint(attr)" class="text-xs text-gray-400 dark:text-gray-500">
          {{ getSelectionHint(attr) }}
        </div>
        <div class="flex gap-2">
          <span v-for="(term, index) in 'terms' in attr && attr.terms?.nodes ? attr.terms.nodes.filter((term) => term?.slug) : []" :key="term.slug || index">
            <label :for="`${term.slug}_${index}`">
              <input
                :id="`${term.slug}_${index}`"
                class="hidden"
                type="radio"
                :class="className(attr.name || '')"
                :name="attr.name || ''"
                :value="term.slug || ''"
                v-model="selections[attr.name || '']"
                :aria-disabled="!isOptionEnabled(attr.name || '', term.slug || '')"
                @change="handleSelectionChange(attr.name || '')" />
              <span
                class="radio-button"
                :class="[`picker-${term.slug}`, { 'is-disabled': !isOptionEnabled(attr.name || '', term.slug || '') }]"
                :title="`${attr.label || attr.name}: ${term.slug}`"
                >{{ term.name }}</span
              >
            </label>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@reference "#tailwind";

.radio-button {
  @apply border-white dark:border-gray-700 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 border-2 text-sm text-center outline-2 outline-gray-100 dark:outline-gray-600 py-1.5 px-3 transition-all text-gray-800 dark:text-gray-200 inline-block hover:outline-gray-500;
}

.radio-button.is-disabled {
  @apply opacity-40 hover:outline-gray-100 dark:hover:outline-gray-600;
}

.color-button {
  @apply border-white dark:border-gray-700 cursor-pointer bg-gray-50 border-2 rounded-2xl text-sm text-center outline-2 outline-gray-100 dark:outline-gray-600 transition-all text-gray-800 inline-block hover:outline-gray-500;
  width: 2rem;
  height: 2rem;
}

.color-button.is-disabled {
  @apply opacity-40 hover:outline-gray-100 dark:hover:outline-gray-600;
}

.color-green {
  @apply bg-green-500;
}

.color-blue {
  @apply bg-blue-500;
}

.color-red {
  @apply bg-red-500;
}

.color-yellow {
  @apply bg-yellow-500;
}

.color-orange {
  @apply bg-orange-500;
}

.color-purple {
  @apply bg-purple-500;
}

.color-black {
  @apply bg-black;
}

input[type='radio']:checked ~ span {
  @apply outline-2 outline-gray-500 dark:outline-gray-300;
}
</style>
