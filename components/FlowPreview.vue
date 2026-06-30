<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { joinURL } from "ufo";
import {
  normalizeGraphData,
  normalizeGraphForPreview,
  resolveGraphBounds,
  type GraphData,
} from "~/utils/flow-preview";
import {
  collectFlowAssetIssues,
  rewriteFlowAssetUrls,
  type AssetRenderPolicy,
} from "~/utils/flow-assets";
import { getTeamCodeCopyItems } from "~/utils/team-code-copy";

type FlowCapabilityLevel = "render-only" | "interactive";
type FlowPreviewType = "file" | "block";
type FlowEmbedLocale = "zh" | "ja" | "en";

const props = withDefaults(
  defineProps<{
    type?: FlowPreviewType;
    data?: Record<string, any> | null;
    src?: string;
    height?: number | string;
    autoScale?: boolean;
    debugLayout?: boolean;
    showMiniMap?: boolean;
    capability?: FlowCapabilityLevel;
    assetPolicy?: AssetRenderPolicy;
  }>(),
  {
    type: "file",
    data: () => ({ nodes: [], edges: [] }),
    src: "",
    height: "auto",
    autoScale: true,
    debugLayout: false,
    showMiniMap: false,
    assetPolicy: "degrade",
  },
);

const MIN_CANVAS_WIDTH = 360;
const MIN_CANVAS_HEIGHT = 220;
const GRAPH_PADDING = 120;
const GRAPH_SAFE_PADDING = 48;
const GRAPH_PREVIEW_ORIGIN_PADDING = 16;
const PREVIEW_CONTENT_TOP_GAP = 16;
const FITVIEW_VERTICAL_OFFSET = 18;
const FITVIEW_HORIZONTAL_OFFSET = 96;
const FITVIEW_RETRY_LIMIT = 6;
const FITVIEW_RETRY_DELAY_MS = 30;

const flowData = ref<GraphData>({ nodes: [], edges: [] });
const loading = ref(false);
const errorMessage = ref("");
const assetIssueMessage = ref("");
const canvasViewportRef = ref<HTMLElement | null>(null);
const viewportWidth = ref(0);
const flowActionMenuOpen = ref(false);
const copyFeedbackActive = ref(false);
const flowPreviewComponent = shallowRef<any>(null);
const runtimeConfig = useRuntimeConfig();
let viewportResizeObserver: ResizeObserver | null = null;
let previewFitVerifyTimer: ReturnType<typeof setTimeout> | null = null;
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
const route = useRoute();

const loadFlowPreviewComponent = async () => {
  if (!import.meta.client || flowPreviewComponent.value) {
    return;
  }
  const [{ YysEditorPreview }] = await Promise.all([
    import("@rookie4show/onmyoji-flow"),
    import("@rookie4show/onmyoji-flow/style.css"),
  ]);
  flowPreviewComponent.value = YysEditorPreview;
};

const resolveFlowEmbedLocale = (value: unknown): FlowEmbedLocale => {
  if (typeof value !== "string") {
    return "zh";
  }
  const normalized = value.trim().toLowerCase().split("-")[0];
  if (normalized === "ja") {
    return "ja";
  }
  if (normalized === "en") {
    return "en";
  }
  return "zh";
};

const baseURL = computed(() => runtimeConfig.app.baseURL || "/");
const resolvedCapability = computed<FlowCapabilityLevel>(() => {
  return props.capability || "render-only";
});
const resolvedType = computed<FlowPreviewType>(() => {
  if (props.type === "block") {
    return "block";
  }
  return "file";
});
const flowEmbedLocale = computed<FlowEmbedLocale>(() =>
  resolveFlowEmbedLocale(route.params.locale),
);
const flowEmbedConfig = computed(() => ({
  locale: flowEmbedLocale.value,
  teamCodeCopy: {
    enabled: false,
    visibility: "hidden",
  },
}));
const teamCodeCopyItems = computed(() => getTeamCodeCopyItems(flowData.value));
const primaryTeamCodeCopyItem = computed(
  () => teamCodeCopyItems.value[0] || null,
);
const canCopyTeamCode = computed(() => !!primaryTeamCodeCopyItem.value);
const copyButtonTitle = computed(() => {
  if (copyFeedbackActive.value) {
    return "已复制";
  }
  return canCopyTeamCode.value
    ? primaryTeamCodeCopyItem.value?.label || "复制阵容码"
    : "暂无可复制阵容码";
});

const resolveSrcUrl = (src: string) => {
  if (!src) {
    return "";
  }
  if (/^https?:\/\//i.test(src) || src.startsWith("//")) {
    return src;
  }
  if (src.startsWith("/")) {
    return joinURL(baseURL.value, src.slice(1));
  }
  return src;
};

const applyData = (data: any) => {
  errorMessage.value = "";
  const normalized = normalizeGraphData(data);
  const issues = collectFlowAssetIssues(normalized, baseURL.value);
  if (issues.length > 0) {
    assetIssueMessage.value = issues[0]?.message || "检测到资产路径兼容问题。";
    if (props.assetPolicy === "strict") {
      errorMessage.value = assetIssueMessage.value;
      flowData.value = { nodes: [], edges: [] };
      return;
    }
  } else {
    assetIssueMessage.value = "";
  }

  flowData.value = rewriteFlowAssetUrls(
    normalizeGraphForPreview(normalized, GRAPH_PREVIEW_ORIGIN_PADDING),
    baseURL.value,
    props.assetPolicy,
  );
  nextTick(() => {
    updateViewportWidth();
  });
};

const loadFromSrc = async (src: string) => {
  if (import.meta.server) {
    return;
  }
  if (!src) {
    errorMessage.value = "";
    applyData(props.data);
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const response = await fetch(resolveSrcUrl(src));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    applyData(payload);
  } catch (error) {
    console.error("Failed to load flow data:", error);
    errorMessage.value = "流程图加载失败，请检查数据地址或格式。";
    applyData(props.data);
  } finally {
    loading.value = false;
  }
};

if (import.meta.client) {
  watch(
    [() => props.type, () => props.src],
    () => {
      if (resolvedType.value === "block") {
        loading.value = false;
        errorMessage.value = "";
        applyData(props.data);
        return;
      }
      void loadFromSrc(props.src);
    },
    { immediate: true },
  );
}

watch(
  () => props.data,
  (newData) => {
    if (resolvedType.value === "block" || !props.src) {
      applyData(newData);
    }
  },
  { deep: true },
);

const normalizeHeightMode = (input: unknown): "auto" | number => {
  if (typeof input === "number" && Number.isFinite(input) && input > 0) {
    return input;
  }
  if (typeof input === "string") {
    const trimmed = input.trim().toLowerCase();
    if (trimmed === "auto") {
      return "auto";
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return "auto";
};

const resolvedHeightMode = computed(() => normalizeHeightMode(props.height));
const isAutoHeight = computed(() => resolvedHeightMode.value === "auto");
const fallbackHeight = computed(() =>
  typeof resolvedHeightMode.value === "number" ? resolvedHeightMode.value : 400,
);

const graphBounds = computed(() => resolveGraphBounds(flowData.value));
const estimatedCanvasWidth = computed(() => {
  const bounds = graphBounds.value;
  if (!bounds) {
    return MIN_CANVAS_WIDTH;
  }
  const boundsBasedWidth = bounds.width + GRAPH_PADDING + GRAPH_SAFE_PADDING;
  const originBasedWidth = bounds.maxX + GRAPH_PADDING + GRAPH_SAFE_PADDING;
  return Math.max(
    MIN_CANVAS_WIDTH,
    Math.ceil(Math.max(boundsBasedWidth, originBasedWidth)),
  );
});
const estimatedCanvasHeight = computed(() => {
  const bounds = graphBounds.value;
  if (!bounds) {
    return MIN_CANVAS_HEIGHT;
  }
  const boundsBasedHeight = bounds.height + GRAPH_PADDING + GRAPH_SAFE_PADDING;
  const originBasedHeight = bounds.maxY + GRAPH_PADDING + GRAPH_SAFE_PADDING;
  return Math.max(
    MIN_CANVAS_HEIGHT,
    Math.ceil(Math.max(boundsBasedHeight, originBasedHeight)),
  );
});

const resolvedCanvasWidth = computed(() => {
  const hostWidth = Math.max(1, viewportWidth.value || MIN_CANVAS_WIDTH);
  return hostWidth;
});

const resolvedCanvasHeight = computed(() => {
  const manualHeight = fallbackHeight.value;
  const targetHeight = isAutoHeight.value
    ? estimatedCanvasHeight.value
    : Math.max(manualHeight, estimatedCanvasHeight.value);
  return Math.max(MIN_CANVAS_HEIGHT, Math.ceil(targetHeight));
});

const estimatedWidthScale = computed(() => {
  if (!props.autoScale) {
    return 1;
  }
  const hostWidth = Math.max(1, viewportWidth.value || MIN_CANVAS_WIDTH);
  if (estimatedCanvasWidth.value <= hostWidth) {
    return 1;
  }
  const safeHostWidth = Math.max(1, hostWidth - 2);
  return safeHostWidth / estimatedCanvasWidth.value;
});

const previewViewportHeight = computed(() => {
  const scaledHeight = resolvedCanvasHeight.value * estimatedWidthScale.value;
  if (isAutoHeight.value) {
    return Math.ceil(scaledHeight);
  }
  return Math.ceil(Math.max(fallbackHeight.value, scaledHeight));
});

const previewHeight = computed(() => `${previewViewportHeight.value}px`);
const resolvedPreviewCanvasHeight = computed(() =>
  Math.max(MIN_CANVAS_HEIGHT, previewViewportHeight.value),
);
const previewReady = computed(
  () => viewportWidth.value > 0 && resolvedPreviewCanvasHeight.value > 0,
);
const previewRenderKey = computed(() => {
  const nodes = Array.isArray(flowData.value?.nodes)
    ? flowData.value.nodes.length
    : 0;
  const edges = Array.isArray(flowData.value?.edges)
    ? flowData.value.edges.length
    : 0;
  return [
    resolvedType.value,
    resolvedCanvasWidth.value,
    resolvedPreviewCanvasHeight.value,
    nodes,
    edges,
  ].join(":");
});

const debugLayoutEnabled = computed(() => {
  if (props.debugLayout) {
    return true;
  }
  const raw = route.query.flowDebug ?? route.query.flow_debug;
  const first = Array.isArray(raw) ? raw[0] : raw;
  const value = String(first || "")
    .trim()
    .toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
});

const updateViewportWidth = () => {
  if (!canvasViewportRef.value) {
    viewportWidth.value = 0;
    return;
  }
  viewportWidth.value = Math.max(0, canvasViewportRef.value.clientWidth);
};

const setupViewportResizeObserver = () => {
  viewportResizeObserver?.disconnect();
  viewportResizeObserver = null;

  if (typeof ResizeObserver === "undefined" || !canvasViewportRef.value) {
    return;
  }
  viewportResizeObserver = new ResizeObserver(() => {
    updateViewportWidth();
  });
  viewportResizeObserver.observe(canvasViewportRef.value);
  updateViewportWidth();
};

const clearPreviewFitVerifyTimer = () => {
  if (previewFitVerifyTimer) {
    clearTimeout(previewFitVerifyTimer);
    previewFitVerifyTimer = null;
  }
};

const clearCopyFeedbackTimer = () => {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
};

const previewRef = ref<any>();

const alignPreviewContentTop = (preview: any): boolean => {
  if (!canvasViewportRef.value || typeof preview?.translate !== "function") {
    return false;
  }
  const viewportRect = canvasViewportRef.value.getBoundingClientRect();
  const nodeRects = Array.from(
    canvasViewportRef.value.querySelectorAll("foreignObject"),
  )
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!nodeRects.length) {
    return false;
  }
  const currentTopGap =
    Math.min(...nodeRects.map((rect) => rect.top)) - viewportRect.top;
  const deltaY = PREVIEW_CONTENT_TOP_GAP - currentTopGap;
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 1) {
    return false;
  }
  return preview.translate(0, deltaY);
};

const applyPreviewFitView = (attempt = 0) => {
  if (
    !import.meta.client ||
    !previewReady.value ||
    !props.autoScale ||
    loading.value ||
    !!errorMessage.value
  ) {
    clearPreviewFitVerifyTimer();
    return;
  }
  const preview = previewRef.value as any;
  const fitViewAvailable = !!(preview && typeof preview.fitView === "function");
  const translateCenterAvailable = !!(
    preview && typeof preview.translateCenter === "function"
  );
  const getTransformAvailable = !!(
    preview && typeof preview.getTransform === "function"
  );
  if (!preview || (!fitViewAvailable && !translateCenterAvailable)) {
    if (attempt < FITVIEW_RETRY_LIMIT) {
      setTimeout(
        () => applyPreviewFitView(attempt + 1),
        FITVIEW_RETRY_DELAY_MS,
      );
    }
    return;
  }
  requestAnimationFrame(() => {
    const graphData =
      typeof preview.getGraphData === "function"
        ? preview.getGraphData()
        : null;
    const graphNodeCount = Array.isArray(graphData?.nodes)
      ? graphData.nodes.length
      : -1;
    if (graphNodeCount === 0) {
      if (attempt < FITVIEW_RETRY_LIMIT) {
        setTimeout(
          () => applyPreviewFitView(attempt + 1),
          FITVIEW_RETRY_DELAY_MS,
        );
      }
      return;
    }

    if (typeof preview.resizeCanvas === "function") {
      preview.resizeCanvas();
    }
    if (typeof preview.resetZoom === "function") {
      preview.resetZoom();
    }
    if (typeof preview.resetTranslate === "function") {
      preview.resetTranslate();
    }

    let applied = false;
    if (fitViewAvailable) {
      applied = preview.fitView(
        FITVIEW_VERTICAL_OFFSET,
        FITVIEW_HORIZONTAL_OFFSET,
      );
    }
    if (!applied && translateCenterAvailable) {
      applied = preview.translateCenter();
    }
    if (applied) {
      requestAnimationFrame(() => {
        const aligned = alignPreviewContentTop(preview);
        if (debugLayoutEnabled.value) {
          console.info("[FlowPreview][layout-align-top]", { aligned });
        }
      });
    }

    let transformSnapshot = getTransformAvailable
      ? preview.getTransform()
      : null;
    let transformScale = Number(transformSnapshot?.SCALE_X ?? NaN);

    clearPreviewFitVerifyTimer();
    if (applied && getTransformAvailable) {
      previewFitVerifyTimer = setTimeout(() => {
        const currentPreview = previewRef.value as any;
        if (
          !currentPreview ||
          typeof currentPreview.getTransform !== "function"
        ) {
          clearPreviewFitVerifyTimer();
          return;
        }
        const currentTransform = currentPreview.getTransform();
        const currentScale = Number(currentTransform?.SCALE_X ?? NaN);
        if (debugLayoutEnabled.value) {
          console.info("[FlowPreview][layout-fit-verify]", {
            appliedScale: Number.isFinite(transformScale)
              ? transformScale
              : null,
            currentScale: Number.isFinite(currentScale) ? currentScale : null,
            currentTransform,
          });
        }
        if (!Number.isFinite(currentScale) && attempt < FITVIEW_RETRY_LIMIT) {
          applyPreviewFitView(0);
        }
        clearPreviewFitVerifyTimer();
      }, 180);
    }

    if (!applied && attempt < FITVIEW_RETRY_LIMIT) {
      setTimeout(
        () => applyPreviewFitView(attempt + 1),
        FITVIEW_RETRY_DELAY_MS,
      );
    }
  });
};

onMounted(() => {
  void loadFlowPreviewComponent();
  nextTick(() => {
    setupViewportResizeObserver();
    applyPreviewFitView();
  });
});

watch([loading, errorMessage], () => {
  nextTick(() => {
    setupViewportResizeObserver();
    applyPreviewFitView();
  });
});

watch(
  [
    () => props.autoScale,
    viewportWidth,
    resolvedCanvasWidth,
    resolvedPreviewCanvasHeight,
    () => flowData.value,
  ],
  () => {
    nextTick(() => {
      applyPreviewFitView();
    });
  },
  { deep: true },
);

watch(
  [
    debugLayoutEnabled,
    resolvedType,
    resolvedHeightMode,
    () => props.autoScale,
    viewportWidth,
    estimatedCanvasWidth,
    estimatedCanvasHeight,
    resolvedCanvasWidth,
    resolvedCanvasHeight,
    resolvedPreviewCanvasHeight,
    estimatedWidthScale,
    previewViewportHeight,
  ],
  () => {
    if (!import.meta.client || !debugLayoutEnabled.value) {
      return;
    }
    console.info("[FlowPreview][layout-debug]", {
      type: resolvedType.value,
      heightMode: resolvedHeightMode.value,
      autoScale: props.autoScale,
      viewportWidth: viewportWidth.value,
      estimatedCanvasWidth: estimatedCanvasWidth.value,
      estimatedCanvasHeight: estimatedCanvasHeight.value,
      resolvedCanvasWidth: resolvedCanvasWidth.value,
      resolvedCanvasHeight: resolvedCanvasHeight.value,
      resolvedPreviewCanvasHeight: resolvedPreviewCanvasHeight.value,
      estimatedWidthScale: Number(estimatedWidthScale.value.toFixed(4)),
      resizeCanvasAvailable: !!(
        previewRef.value &&
        typeof (previewRef.value as any).resizeCanvas === "function"
      ),
      fitViewAvailable: !!(
        previewRef.value &&
        typeof (previewRef.value as any).fitView === "function"
      ),
      resetZoomAvailable: !!(
        previewRef.value &&
        typeof (previewRef.value as any).resetZoom === "function"
      ),
      resetTranslateAvailable: !!(
        previewRef.value &&
        typeof (previewRef.value as any).resetTranslate === "function"
      ),
      translateCenterAvailable: !!(
        previewRef.value &&
        typeof (previewRef.value as any).translateCenter === "function"
      ),
      transformSnapshot: !!(
        previewRef.value &&
        typeof (previewRef.value as any).getTransform === "function"
      )
        ? (previewRef.value as any).getTransform()
        : null,
      graphNodeCount: (() => {
        const preview = previewRef.value as any;
        if (!preview || typeof preview.getGraphData !== "function") {
          return -1;
        }
        const graphData = preview.getGraphData();
        return Array.isArray(graphData?.nodes) ? graphData.nodes.length : -1;
      })(),
      previewViewportHeight: previewViewportHeight.value,
    });
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  viewportResizeObserver?.disconnect();
  viewportResizeObserver = null;
  clearPreviewFitVerifyTimer();
  clearCopyFeedbackTimer();
});

// 导出数据
const exportData = () => {
  flowActionMenuOpen.value = false;
  if (previewRef.value) {
    const data = previewRef.value.getGraphData();
    if (!data) {
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flow-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }
};

const copyPrimaryTeamCode = async () => {
  const item = primaryTeamCodeCopyItem.value;
  if (!item || !import.meta.client) {
    return;
  }
  try {
    await navigator.clipboard.writeText(item.code);
    copyFeedbackActive.value = true;
    clearCopyFeedbackTimer();
    copyFeedbackTimer = setTimeout(() => {
      copyFeedbackActive.value = false;
      copyFeedbackTimer = null;
    }, 1400);
  } catch (error) {
    console.error("Failed to copy team code:", error);
  }
};

const toggleFlowActionMenu = () => {
  flowActionMenuOpen.value = !flowActionMenuOpen.value;
};
</script>

<template>
  <ClientOnly>
    <div class="flow-preview-wrapper">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="errorMessage" class="error">{{ errorMessage }}</div>
      <div v-else-if="assetIssueMessage" class="asset-warning">
        {{ assetIssueMessage }}（已采用兼容渲染）
      </div>
      <div
        v-if="!loading && !errorMessage"
        ref="canvasViewportRef"
        class="flow-canvas-viewport"
        :style="{ height: previewHeight }"
      >
        <component
          :is="flowPreviewComponent"
          v-if="previewReady && flowPreviewComponent"
          :key="previewRenderKey"
          ref="previewRef"
          mode="preview"
          :capability="resolvedCapability"
          :config="flowEmbedConfig"
          :data="flowData"
          :width="resolvedCanvasWidth"
          :height="resolvedPreviewCanvasHeight"
          :show-mini-map="showMiniMap"
        />
      </div>
      <div
        v-if="!loading && !errorMessage"
        class="flow-actions"
        @mouseleave="flowActionMenuOpen = false"
      >
        <button
          type="button"
          class="flow-action-btn"
          :class="{ 'is-feedback': copyFeedbackActive }"
          :disabled="!canCopyTeamCode"
          :title="copyButtonTitle"
          :aria-label="copyButtonTitle"
          @click="copyPrimaryTeamCode"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" class="flow-action-icon">
            <rect x="9" y="9" width="10" height="10" rx="2" />
            <path d="M5 15V7a2 2 0 0 1 2-2h8" />
          </svg>
        </button>
        <div class="flow-menu-wrap">
          <button
            type="button"
            class="flow-action-btn"
            title="更多操作"
            aria-label="更多操作"
            :aria-expanded="flowActionMenuOpen"
            @click="toggleFlowActionMenu"
          >
            <span aria-hidden="true" class="flow-more-icon">⋮</span>
          </button>
          <div v-if="flowActionMenuOpen" class="flow-action-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              class="flow-action-menu-item"
              @click="exportData"
            >
              导出
            </button>
          </div>
        </div>
      </div>
    </div>
    <template #fallback>
      <div class="flow-preview-placeholder" :style="{ height: previewHeight }">
        <p>加载流程图组件中...</p>
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
.flow-preview-wrapper {
  position: relative;
  margin: 20px 0;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-surface, transparent);
}

.flow-canvas-viewport {
  width: 100%;
  overflow: hidden;
  background: transparent;
}

.flow-preview-wrapper :deep(.text-node),
.flow-preview-wrapper :deep(.text-content),
.flow-preview-wrapper :deep(.text-content *) {
  color: revert;
  font-family: revert;
}

.flow-preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px 0;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #f9f9f9;
  color: #666;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #999;
}

.error {
  padding: 40px;
  text-align: center;
  color: #c62828;
}

.asset-warning {
  padding: 10px 12px;
  background: #fff7ed;
  color: #9a3412;
  border-bottom: 1px solid #fed7aa;
}

.flow-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
  display: flex;
  gap: 6px;
  opacity: 0;
  transform: translateY(-2px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.flow-preview-wrapper:hover .flow-actions,
.flow-preview-wrapper:focus-within .flow-actions {
  opacity: 1;
  transform: translateY(0);
}

.flow-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: #374151;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(209, 213, 219, 0.95);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  cursor: pointer;
}

.flow-action-btn:hover,
.flow-action-btn:focus-visible,
.flow-action-btn.is-feedback {
  color: #111827;
  background: #fff;
  border-color: #9ca3af;
  outline: none;
}

.flow-action-btn:disabled {
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.72;
}

.flow-action-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.flow-menu-wrap {
  position: relative;
}

.flow-more-icon {
  font-size: 19px;
  line-height: 1;
}

.flow-action-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 96px;
  padding: 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
}

.flow-action-menu-item {
  width: 100%;
  padding: 7px 10px;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.2;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}

.flow-action-menu-item:hover,
.flow-action-menu-item:focus-visible {
  background: #f3f4f6;
  outline: none;
}

@media (hover: none) {
  .flow-actions {
    opacity: 1;
    transform: none;
  }
}
</style>
