# 好幫手 Homeflow 初階Prototype實作方案

## 已確認範圍

用戶已在2026-10-22 14:05授權依PRD v0.13動工，並明確拒絕沿用DeepSeek UI。沿已商定初階交付：先完整做通同一來源的Sales報價→指定版簽署／簽檔→付款登記→Office交接→Finance核足首期→開單員轉Invoice／唯一工程→CS安排；其餘Module後續深化，不用空頁宣稱十二Module已完成。

## 技術與資料

空的Manus-managed flexible Web專案，React + TypeScript + Vite，純Demo，不啟用真銀行／正式登入／外部API。統一domain/types、engine及BrowserRepository；業務數據保存同一瀏覽器localStorage，文件Blob保存IndexedDB。不是正式後端安全或跨裝置多人同步。角色切換保留同一資料。金額Decimal／分位，低消先折扣後，成本包含基本佣金；簽版快照不可反寫，Invoice四位月流水及工程D後綴以永遠ID關聯，動作檢查Actor／Grant／scope／版本及首期資格。文件為可列印Demo，不冒稱正式單據。

## 結構

- docs：完整PRD、交接要求、模型／流程／實作限制及DeepSeek交接。
- src/domain/types.ts：實體與公開資料契約。
- src/domain/engine.ts：唯一計價／簽署／交接／核款／開單／安排／投影與repository。
- src/components：AppShell、按鈕、Badge、Dialog、FormField、資料表及SourceProgress。
- src/pages：報價管理／單頁編輯／成交、核款、待開單、CS交接／工程、客戶、簡化目錄與本人的業績。
- tests：domain負面條件及同一來源Golden Path；UI貫穿流程。
- public：原公司Logo、route manifest、示例安全資源。

## 設計：清晰營運工具／瑞士資訊排版

- 核心：18px主字、真實下一步、黑白灰高對比、所有頁面穩定尺寸。不是報告型Dashboard。
- 顏色：紙白、霧灰與墨黑；同一tokens支持日後替換design system，不濫用品牌藍或彩色卡。
- Layout：左側固定工作導航＋同起點的內容軌，重要操作在標题旁；Sales編輯沿客戶、工程、成交的直向資訊順序，桌面右側固定價額摘要。手機改單欄與可點大操作。
- Signature：黑色主CTA、粗字頁面標題、細分隔線、編號／金額tabular figures、少量輪廓status。
- 字體：system-ui + Noto Sans TC/PingFang TC/Microsoft JhengHei；正文18px，label16–18px，標題30–34px，主要數額28px；不將技術細字放滿頁。
- Interaction：主要按鈕至少48px；form控制至少48px；error顯可採取下一步，空白狀態有入口；對話框固定寬度、page gutter一致、不因Tab或loading換尺寸。
- Animation：只120–160ms opacity／color；無Layout位移與頁面飛入；尊重prefers-reduced-motion。
- Brand essence：讓住宅裝修同事用同一張單順暢接力；清楚、穩定、利落。
- Voice：「建立報價」、「確認已簽並交Office」；只說當下要做甚麼，不抄PRD。
- Wordmark：側欄用簡潔「好幫手／工程營運」字標及方形線框H；公司原Logo作文件抬頭及平台圖標，不重畫商標。

## 實作順序

先完成共享模型與計價、簽署、核款、出單、安排的service；同步建全新Shell及Sales頁，再接四角色同來源投影。保存Demo附件與文件預覽，補簡單可編輯目錄／客戶／本人業績及來源通知，建立測試與可交接文檔。最後核對已實作部分、診斷及build，記錄Checkpoint。未實作的採購／SEL／結算等如實列為後續，不造靜態可用頁。
