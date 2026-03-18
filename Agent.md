# WOONUXT 调试手册（404 与 Hydration mismatch）

本文档用于快速定位和修复当前项目中出现的两类问题：两条 404（_payload.json）与一条 Hydration mismatch。包含症状、根因、证据、修复步骤与验证方法，作为本仓库的常驻排障指南。

## 1. 症状总结

- 浏览器控制台出现 Hydration mismatch 提示：`Hydration completed but contains mismatches`
- Network 面板可见两条 404：
  - `GET https://www.koopower.com/product/_payload.json?{uuid} 404 (Not Found)`（重复出现）
- 页面功能与展示基本正常，但上述警告/404 持续存在

## 2. 快速结论

- Hydration mismatch 根因（高概率）：组件在 SSR 与客户端渲染阶段使用了时间/浏览器环境数据导致非确定性渲染
  - 典型来源 1：相对时间/当前时间计算（如 `Date.now()`）
    - 示例：[AccountActivity.vue](file:///d:/CODES/woonuxtKOO/woonuxt_base/app/components/AccountActivity.vue#L5-L16) 在 setup 阶段构造“相对现在”的时间戳，首屏 SSR 与客户端水合之间会产生细微差异，从而提示 mismatch
  - 典型来源 2：未充分用 `import.meta.client` / `onMounted` 包裹的浏览器 API（window、document、navigator 等）
    - 当前项目多数已做防护；需确保任何影响首屏 HTML 的内容在 SSR 与客户端一致

## 3. 项目与配置要点

- 顶层配置：[nuxt.config.ts](file:///d:/CODES/woonuxtKOO/nuxt.config.ts)
  - 继承主题：[woonuxt_base](file:///d:/CODES/woonuxtKOO/woonuxt_base/nuxt.config.ts)
  - Nitro 预渲染并发、间隔、failOnError 已设置
- 主题路由与 ISR：
  - 扩展页面路由（分页、分类等）见 [woonuxt_base/nuxt.config.ts](file:///d:/CODES/woonuxtKOO/woonuxt_base/nuxt.config.ts#L61-L73)
  - ISR 配置覆盖 `/product/**`、`/product-category/**`、`/products/**`，见同文件 [L75-L90](file:///d:/CODES/woonuxtKOO/woonuxt_base/nuxt.config.ts#L75-L90)
- 列表与详情页：
  - 列表页：[/app/pages/products.vue](file:///d:/CODES/woonuxtKOO/woonuxt_base/app/pages/products.vue)
  - 详情页：[/app/pages/product/[slug].vue](file:///d:/CODES/woonuxtKOO/woonuxt_base/app/pages/product/%5Bslug%5D.vue)

## 4. 根因与证据
为使用持久化数据或近似静态的时间戳

## 6. 实施步骤（建议）

1) 部署重写修正
   - 编辑并移除 [vercel.json](file:///d:/CODES/woonuxtKOO/vercel.json#L38-L46) 的 `/products -> /product` 与 `/products/:path* -> /product/:path*`
   - 若使用其它平台（如 NG、CDN），同步清查等价重写/重定向规则
2) 组件去不确定性
   - 为相对时间显示添加 `<client-only>` 或在 `onMounted` 计算并注入到状态中
   - 排查 setup 阶段对 `Date.now()` 的直接使用并迁移到客户端逻辑
3) 预取策略（可选优化）
   - 若短期无法调整重写，可为指向 `/products` 的链接禁用 `prefetch`：`<NuxtLink :prefetch="false" to="/products">`
   - 或在 `app.config.ts` 中调整全局预取策略

## 7. 回归验证

- 本地
  - 启动：`npm run dev`，打开产品列表与详情、账户相关页面
  - Network：确认无对 `/product/_payload.json` 的 404 请求
  - Console：确认无 `Hydration mismatch` 警告
- 构建
  - 生成：`npm run build` 或 `npm run generate`
  - 预览：`npm run preview`，重复上述检查
- 类型检查
  - `npm run typecheck` 确认无类型错误

## 8. 常见触发点检查清单

- 路由/重定向
  - 是否存在把有效路由改写到无效目标的规则（如 `/products` -> `/product`）
  - 部署侧（Vercel、NG、CDN）与应用侧（Nitro `routeRules`、i18n `strategy`）需一致
- 非确定性渲染
  - 任何基于“当前时间/随机数”的模板输出，若在 SSR 阶段参与渲染，需要调整为客户端计算
  - 使用 `import.meta.client` / `onMounted` / `<client-only>` 包裹浏览器相关逻辑
- 国际化/时区
  - 日期格式化与语言环境一致性（服务端与客户端 `locale`、`timeZone`）
  - 建议将纯格式化逻辑移至客户端，或使用固定时区输出

## 9. 关键文件索引

- 顶层配置：[nuxt.config.ts](file:///d:/CODES/woonuxtKOO/nuxt.config.ts)
- 主题配置与路由/ISR：[woonuxt_base/nuxt.config.ts](file:///d:/CODES/woonuxtKOO/woonuxt_base/nuxt.config.ts)
- 列表页：[products.vue](file:///d:/CODES/woonuxtKOO/woonuxt_base/app/pages/products.vue)
- 商品详情页：[[slug].vue](file:///d:/CODES/woonuxtKOO/woonuxt_base/app/pages/product/%5Bslug%5D.vue)
- 部署重写：[vercel.json](file:///d:/CODES/woonuxtKOO/vercel.json)
- 文档当前文件：[Agent.md](file:///d:/CODES/woonuxtKOO/Agent.md)

---

若需要，我可以直接提交对应的配置与组件调整（含 `<client-only>` 包裹或移动到 `onMounted`），并在本地跑通验证后附上变更清单与验证截图。欢迎在此文档底部继续记录后续排查与结论。

