# 全站純圖示操作按鈕標準

更新日期：2026-10-09。

## 尺寸與排版

- 桌面按鈕 36 × 36px，圖示 24 × 24px，水平與垂直置中、padding 0、圓角 8px。圖示優先清晰顯示，不以小圖示搭配大面積留白。
- 觸控或混合輸入裝置（`any-pointer: coarse`）點擊區改為 44 × 44px，圖示維持 24px。
- 同一操作群組保持一致尺寸；相鄰控制保留間距，避免誤觸。文字按鈕、開關、選單箭頭、展開控制及大型照片導覽入口不套用。
- 保留所在主題的底色、邊框、危險操作色、hover、焦點與 disabled 提示。不得因統一外觀取消權限、確認或停用狀態。
- 純圖示按鈕必須有明確 `aria-label`；適用時提供 title／tooltip。SVG 純裝飾時使用 `aria-hidden`。選取、播放等狀態不只靠顏色判斷。

## 唯一樣式來源

[styles/shared/icon-actions.css](../styles/shared/icon-actions.css) 定義 `--icon-action-size`、`--icon-action-glyph-size` 與 `--icon-action-radius`，由 public、admin、ordering 樣式入口最後匯入。

新增純圖示控制使用 `className="iconActionButton"`，搭配既有按鈕色彩與行為。不要逐頁重寫尺寸，SVG 的 size 屬性不可另作較小的設計基準。若控制具有可見文字，不可套用此 class。

本次已接入通知音效、試聽／停止、音效刪除、規則排序、既有圖示操作、點餐碼複製、照片縮放及購物車移除。既有 class 保留，相容 selector 接入同一規則，避免修改 API 或操作事件。

大型燈箱上一張／下一張、拖曳把手、浮動返回頁首與主題切換等不同用途控制維持原設計，不透過 `button:has(svg)` 無差別縮小。

## 驗證

依 [本機預覽流程](local-ui-preview.md) 檢查 CSS 與字型、明暗主題、觸控大小、長清單列、焦點、disabled、播放與刪除確認。無法取得瀏覽器渲染時，HTTP／建置不等同實際視覺通過，須明確標示。
