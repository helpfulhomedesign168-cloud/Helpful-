# 好幫手住宅裝修內部管理系統 PRD v1.0

## Direct Invoice Edition｜現行營運流程更新版

**版本：** v1.0（以 production `e54d5b9` 為基準）  
**日期：** 2026-11-25  
**狀態：** 現行原型／營運規格；不是 production-ready 後端系統  
**取代範圍：** v0.13 的「Sales 報價 → 簽署 → Office → Invoice」主鏈及角色安排  
**保留參考：** v0.13 仍適用於尚未重啟的 Sales、佣金、採購等 dormant modules

> **文件定位：** 本版不是把 v0.13 全部重寫，而是把現時真正運作中的 direct invoice 模式、角色、收款、CS 接手、8萬資助及單據規則整理成新的單一營運基準。未改動的深層財務、佣金、採購規格，仍以 v0.13 為參考，但不可假設已全部實作。

## 0. 版本與閱讀方式

### 0.1 狀態標籤

- ✅ 現行 production 已具備
- 🟡 部分具備／只覆蓋 main flow
- ⏸ 暫時隱藏或 dormant，資料保留
- 🔜 尚未實作／future
- ❗ 需要公司決策或後端支援

### 0.2 一句總結

> 公司暫時不用 Sales；由「直接開單員」直接建立 Invoice，收款達 50% 後才建立工程單，交阿花／CS主管分配，CS同事跟進工程至完成，最後由開單／會計處理尾數及收據。

## 1. 與 v0.13 的差異（先看這頁）

| 範疇 | PRD v0.13 | 現時 v1.0 | 差異程度 |
|---|---|---|---|
| 主流程 | Sales 報價 → 客戶簽署 → Office 交接 → 開單員轉 Invoice | 直接開單員建立 Invoice → 收款 → 50% 出工程單 | **大** |
| Sales 角色 | 核心使用者，負責報價、選款、簽署、跟客 | 暫時隱藏；資料及 route 保留 | **大** |
| 舊開單員 | 處理已簽報價、轉 Invoice、正式收據 | 暫時隱藏；由新的直接開單員接手 | **大** |
| Invoice | 由已簽報價轉換，不可任意改 | 可直接建立、可直接修改；修改會同步 Invoice／來源版本／工程單 | **大** |
| 報價／簽署 | 必要前置 | 正常流程不使用；legacy quote UI 只作保留／查閱 | **大** |
| 收款 | 會計核對、開單員轉單 | 直接開單員可一個 dialog 上載證明並確認；亦可交會計覆核 | **中** |
| CS 接手 | Office 交接後安排 | 收款 50% 後入「工程單」待阿花分配，分配後才入「工程管理」 | **中** |
| 8萬資助 | Sales／報價層處理申請資料 | 直接開單員填申請編號／批核金額；工程單一律 D number；另建市政單 B | **中** |
| 佣金／業績／排班 | Sales 核心 module | ⏸ 暫時 dormant；資料保留 | **中** |
| 財務、退款、通知、客戶、供應商、師傅 | 已規劃 | 大部分保留；按新角色可用 | **小至中** |
| 後端／認證／中央設定 | 規劃中 | 仍然係前端 prototype（localStorage／IndexedDB） | ❗ 未變 |

### 1.1 差異結論

- **不是全系統重寫**：客戶、工程目錄、收款、CS 工程、財務、退款、單據及大部分 domain engine 仍然沿用。
- **但營運主鏈已改變**：Sales quote／簽署不再是主流程，Invoice 成為第一份正式單。
- **角色及交接點已改變**：直接開單員 → 會計（可選）→ CS主管 → CS同事 → 開單／會計收尾。
- v0.13 的 Sales／佣金／採購細則不可直接當成「現時已運作」；只可作日後重啟或後端化的參考。

## 2. 現時目標與範圍

### 2.1 目標

1. 取消 Sales 報價前置，讓開單員一次過完成客戶、工程項目及 Invoice。
2. 收款、Invoice、工程單及 CS 分配有清楚狀態，不靠 WhatsApp／Excel 對數。
3. 收款達 50% 才把工程交 CS，避免未收訂金先施工。
4. 8萬資助單保留申請編號、批核金額、工程單及市政單的對應。
5. Invoice 可以修正，但所有修改要同步相關版本及工程單。
6. 文件、Excel、通知及角色權限集中同一個系統。

### 2.2 現時 in scope

- 直接建立／修改 Invoice
- 客戶主檔及客戶儲存
- 工程項目、尺寸、價錢、折扣（按現有欄位）
- 付款登記、核實、待核對、收據
- 工程單、CS 分配、工程管理、師傅／供應商、工程完成
- 8萬資助及市政單
- Invoice／Municipal／Receipt 列印及 Excel 匯出
- 通知、角色、用戶管理
- 退款個案及會計 Dashboard（按權限）

### 2.3 現時 out of scope／dormant

- Sales 報價、報價版本、客戶簽署、Office submission
- Sales 排班、Sales 業績、佣金 Bonus 的日常操作
- Sales 電子 Catalog／產品款式銷售流程
- 完整採購 PO、收貨、Supplier Bill 流程（只保留部分 supplier／contractor 資料）
- 政府 8萬申請自動提交或資格判定
- 銀行 API 自動收款
- 正式後端、登入安全、中央 feature flag（見第 8 節）

## 3. 角色與權限

### 3.1 Production 可見角色

| 角色 | 主要入口 | 主要工作 | 主要限制 |
|---|---|---|---|
| 直接開單員 `invoice_clerk` | 建立發票、單據管理、客戶、市政單 | 建立／修改 Invoice、客戶儲存、收款確認、8萬資料、Excel／列印 | 不處理退款、不分配 CS 工程、不改價目表 |
| 會計 `finance` | 收款核對、已開單據、退款 | 核對待核對付款、查看單據、處理退款 | 不改 Invoice 工程內容、不派工程 |
| 會計主管 `finance_supervisor` | 儀表板、營業單、單據、退款、市政單 | 會計覆核、營業單、退款、報表 | 不代 CS 分配工程 |
| CS `cs` | 工程單、工程管理、工程師傅、供應商、客戶、工程價目 | 只處理已分配工程、安排施工、師傅收費、材料扣減、相片、完成工程 | 不可改 Invoice／報價；只看自己跟進工程 |
| CS主管 `cs_supervisor` | 自訂工程請示、工程單、工程管理、工程師傅、供應商、客戶、工程價目 | 接工程單、預覽 Invoice、分配 CS、查看 8萬批核、處理自訂工程請示 | 不可改 Invoice 價錢 |
| Super Admin `admin` | 全部 module | 用戶／角色、全部資料、設定、營運替補 | 不應無痕改歷史或硬刪已付款單 |
| Admin Staff `admin_staff` | 大部分營運 module | 協助營運 | 不用戶管理；按 grants 限制 |

### 3.2 暫時隱藏角色

- ⏸ Sales
- ⏸ Sales主管
- ⏸ Sales阿頭
- ⏸ 舊開單員 `clerk`

**處理方式：** 角色、actor、舊 quotes／invoices／orders 及歷史資料保留，只從 production 角色選單及日常入口隱藏。  
**重啟方式：** 目前用 browser localStorage flag；正式應改為中央 Admin 開關（❗ 見第 8 節）。

### 3.3 權限原則

- CS 不可修改 Invoice 金額或工程項目。
- 會計不可修改售價／工程內容，只可核對收款及退款。
- 直接開單員可修改已開 Invoice，但改動必須同步來源版本及工程單。
- 所有角色只看到自己被授權的單據／工程。
- 已付款、已發工程或已退訂的單，修改政策要另行確認（❗）。

## 4. 由上單到完成的營運流程

### 4.1 標準 Direct Invoice 流程

```text
客人資料／工程資料
→ 直接開單員建立 Invoice（Step 1 客戶＋發票資料）
→ Step 2 工程項目（compact line cards）
→ Step 3 確認發票／列印／匯出
→ Invoice issued
→ 收款（可一-step 確認，或交會計覆核）
→ 有效收款達 50%
→ 系統建立 D2600xxx 工程單
→ 工程單（阿花／CS主管）待分配
→ 分配 CS 同事
→ 工程管理（施工、師傅、收費、相片）
→ CS 標記工程完成
→ 開單／會計跟進尾數及收據
→ 單據完成
```

### 4.2 Invoice 建立

1. **Step 1 發票資料**
   - 發票日期（預設今日）
   - 銷售員
   - Sales主管
   - 單種（可多選）：團購／8萬資助／自費
   - 8萬時顯示：申請編號、批核金額
   - 客戶資料
   - 可 `儲存到客戶模組`
2. **Step 2 工程項目**
   - 新增工程
   - 填尺寸／數量／單位
   - 顯示換算、最低收費、每項金額
   - direct invoice 不顯示 Sales 的藍色分類 bar、現場備註、分類小計
3. **Step 3 確認發票**
   - 顯示 Invoice template 預覽
   - `列印`
   - `修改` 返回 Step 2
   - `匯出` Excel
   - `確定建立發票`
4. 建立後顯示 `發票DINV…已建立`，跳回單據管理

### 4.3 收款及 50% 工程單

- Invoice detail 每期可 `登記第 N 期`
- 同一個 dialog 可：
  - 填金額、日期、付款方式、交易參考
  - 上載付款證明
  - 備註
  - 勾選「我已核實公司銀行收到這筆款項」
  - `確認收款`
- 亦可按 `儲存待核對期款` 交會計覆核
- 有效收款累計達成交額 **50%**：
  - 自動建立工程單
  - 工程單狀態為未安排
  - 通知 CS
- 未達 50%：不建立工程單

### 4.4 CS 接手及分配

1. 工程單先入阿花／CS主管的 **工程單** 列表
2. 每行顯示：
   - 工程單號 `D2600xxx`
   - `INV-…` Invoice number
   - 客戶、電話、Sales、類別、跟進同事
   - `預覽 Invoice`
   - `安排工程`
3. 未分配前：
   - 不出現在 CS 同事的工程管理
   - 只在工程單列表
4. 阿花按 `安排工程`：
   - 選擇 CS 同事
   - 分配後才入工程管理
5. CS 同事在工程管理：
   - 安排施工日期
   - 分配師傅
   - 修改師傅收費／材料扣減
   - 上載工程相片
   - 完成工程

### 4.5 工程完成及收尾

- CS 按 `工程完成`
- 系統通知開單／會計跟進尾數
- 開單員確認尾數
- 可發收據
- Invoice 狀態變為工程完成／收款完成
- 如退款：會計建立退款個案、Credit Note 及退款流程

### 4.6 Invoice 修改流程

```text
單據管理
→ 最右操作欄鉛筆 icon
→ 修改單 Step 2 工程項目
→ 可直接改尺寸／項目／價錢
→ 上一步可改 Step 1 發票資料／客戶
→ 儲存修改
→ 同步 Invoice、quote version、工程單（如有）
→ 返回單據管理
```

- 修改單 Step 1 不顯示「選擇現有客戶／儲存到客戶模組」
- 修改後發票日期、銷售員、主管、單種、客戶、項目及金額可更新
- 若 Invoice 已有付款／工程，修改影響範圍需公司確認（❗）

### 4.7 8萬資助及市政單

```text
8萬資助 Invoice
→ 填申請編號＋批核金額
→ 收款達 50%
→ 建立 D2600xxx 正單工程單
→ 建立市政單 B（Invoice base + B）
→ 工程單交 CS 分配
→ CS 工程單顯示 8萬批核卡
→ 市政單只在市政單 module 修改
```

- 工程單一律用 `D2600xxx`
- Invoice number 在工程單下面顯示 `INV-…`
- 市政單 B 不影響正單／Invoice／會計
- 市政單可獨立修改項目、數量、單價、金額

## 5. 功能需求

### FR-01 客戶及發票建立

- 客戶姓名、電話、WhatsApp、地址為必要資料
- 可儲存客戶到客戶 module；同電話更新，不重複建立
- 可選現有客戶；修改單不顯示這兩個客戶 action
- Invoice 需要至少一項工程
- 單種可多選，最少一個
- 8萬時可填申請編號及批核金額
- 8萬批核金額為數值，不清空其他單種資料

### FR-02 單據管理

- 列表顯示 Invoice number、日期、客戶、Sales、收款進度、分類、狀態、操作
- 整行可 click 入 Invoice detail
- 最右 `操作` column 用鉛筆 icon 入修改單
- 鉛筆 click 不應觸發 row click
- 分類 tags 須橫向顯示，不可重疊
- 排序：最新至最舊／最舊至最新
- 篩選：狀態、單類、Team、Sales
- 新單應排最前
- 直接開單員可見所需單據；CS／會計按權限

### FR-03 Invoice detail

- 顯示發票、客戶、工程、付款進度、期款、收據
- 可預覽／列印 Invoice
- 可登記期款
- 可查看付款證明
- 可開收據（按權限）
- 可建立退款個案（按權限）

### FR-04 收款

- 每期顯示應收、已核、待核對
- 一-step：
  - 金額、日期、方式、交易參考、付款證明、備註
  - 核實 checkbox
  - `確認收款`
- 兩-step（會計覆核）：
  - `儲存待核對期款`
  - 會計在收款核對頁確認或退回
- 有效收款累計達 50% 自動發工程單
- 收款不得超過本期可收金額
- 支票／銀行付款必須核實

### FR-05 CS 工程單及工程管理

- 工程單列表只顯示已 released 工程
- 未分配工程不出現在工程管理
- 分配後才開 CS 同事可見
- CS 只可讀自己工程；CS主管可讀全部 released
- 工程管理可更新施工日期、師傅、收費、扣料、相片
- CS 完成工程後通知開單／會計

### FR-06 8萬資助及市政單

- 申請編號、批核金額需在建立或修改 Invoice 時可輸入
- CS 工程單顯示批核卡
- 市政單自動建立
- 市政單可獨立編輯，不影響 Invoice／會計
- 市政單列印使用市政單 template

### FR-07 客戶 module

- 客戶列表、詳情、搜尋
- 客戶資料修改
- 客戶附件／地址
- 電話重複提示
- 不可默默建立重複客戶

### FR-08 文件及匯出

- Invoice 文件
- 市政單文件
- 正式收據
- Invoice Excel 匯出（.xlsx）
- 列印／另存 PDF
- 文件編號及日期按規則
- 舊版本文件不被新資料反改

### FR-09 通知

- 每角色有訊息通知
- unread count
- 點擊通知到相關單據／工程
- 可標記已讀／全部已讀
- 工程完成通知開單／會計收尾數

### FR-10 角色／用戶／Admin

- Admin 可建立／停用用戶
- 角色對應 module 權限
- 隱藏 Sales／舊 clerk 的資料保留
- 未來提供 Admin 中央角色開關
- 不可硬刪歷史

### FR-11 Legacy 模組

- Quotes／quote versions／signature／submission：保留，不作日常主流程
- Sales 排班／業績／佣金：保留，暫時隱藏
- 舊 clerk 流程：保留，暫時隱藏
- 不可讓新流程誤用舊 quote 作為 Invoice 前置

## 6. 編號、狀態及資料規則

### 6.1 編號

| 文件／實體 | 格式 | 備註 |
|---|---|---|
| Invoice | `DINV` + YYMM + 流水 | 以系統實際產生為準；不可重用 |
| 工程單 | `D` + YY + 5 位流水（例：`D2600002`） | 所有工程單，包括 8萬正單 |
| 市政單 B | Invoice base + `B` | 只作市政申請，不作會計 |
| 收據 | 現有 R-YYMM-流水 | 按現有規則 |
| 客戶 | 永久 customer ID | 電話作搜尋／防重 |

### 6.2 狀態

- Invoice：待收足訂金 → 已發工程部 → 已完成工程 → 已退訂
- 工程單：待分配 → 已分配 → 施工中／待完成 → 已完成
- 付款：待核對 → 有效／已退回
- 市政單：獨立建立／可修改／不作會計

### 6.3 資料保留

- 舊 Sales、舊 clerk、舊 quote、舊 invoice、舊工程單全部保留
- 隱藏角色不等於刪除資料
- 已付款／已簽署文件不可被新版本覆寫
- Invoice 修改要建立版本紀錄及 audit（現時已同步，正式後端需完整 version／audit）
- 8萬申請編號／批核金額要保留歷史值

## 7. 模組對照 v0.13

| v0.13 Module | 現時狀態 | 說明 |
|---|---|---|
| 01 客戶及報價基礎 | 🟡 | 客戶 module 保留；報價／簽署 dormant |
| 02 工程目錄、計價及成本 | ✅／🟡 | 工程目錄及計價仍用；Sales 選款流程隱藏 |
| 03 Invoice、期款及收據 | ✅ | 改為直接 Invoice；一-step 收款；收據保留 |
| 04 工程進度及 Assignment | ✅ | 工程單／分配／工程管理／完成 |
| 05 工程變更及後加／後減 | 🟡 | Invoice 可直接修改；正式 change order / variation 流程未完整 |
| 06 業績、佣金及 Bonus | ⏸ | Sales 隱藏；資料保留，未營運 |
| 07 供應商、產品／物料及 Catalog | 🟡 | 供應商／師傅資料保留；Sales Catalog 隱藏 |
| 08 採購、收貨及埋單 | 🟡／⏸ | 部分 supplier／cost 資料；完整 PO／收貨流程未在 main flow |
| 09 工作台、待辦及通知 | ✅ | 通知 module 保留 |
| 10 精簡工程財務及結算 | ✅／🟡 | 會計 Dashboard、退款、收款核對 |
| 11 判頭／師傅名冊及排工 | ✅ | 工程師傅及 assignment 仍用 |
| 12 帳號、角色及公司設定 | ✅／🟡 | 用戶／角色保留；中央 feature flag 未做 |
| 13 文件樣板及編號 | ✅／🟡 | Invoice／Municipal／Receipt 已有；Quote 文件 dormant |
| 14 資料契約／API／安全 | ❗ | 仍是前端 prototype，未 production-ready |

## 8. 非功能需求、限制及待決

### 8.1 現時技術限制

- 前端 prototype：React／Vite
- 資料存 localStorage；附件存 IndexedDB
- 無正式登入／密碼／server-side authorization
- 無中央 database／backup／concurrency control
- 無正式 API key／AI integration
- 角色隱藏用 feature flag + browser localStorage
- Excel 在 browser 產生
- 文件列印依 browser

### 8.2 待決事項

| # | 問題 | 影響 |
|---|---|---|
| D1 | Admin 角色／功能開關要中央還是 localStorage | 全公司 rollout |
| D2 | Sales 日後如何重啟、如何與 direct invoice 並存 | 角色／quote flow |
| D3 | Invoice 已收款／已發工程後可否修改 | 會計／工程／audit |
| D4 | 8萬市政單 B 編號是否維持 Invoice base + B | 文件／報表 |
| D5 | 佣金、Sales 業績是否日後重啟 | dormant modules |
| D6 | 正式價目、成本、批核金額來源 | 計價正確性 |
| D7 | 後端、認證、備份、RPO/RTO | production readiness |
| D8 | Invoice 修改的審批人及 audit 要求 | 財務控制 |
| D9 | 退款／Credit Note 與 Invoice 修改的分界 | 財務流程 |
| D10 | 舊 quote 資料是否只讀、是否需要 export | 資料保留 |

## 9. 驗收與測試

### 9.1 現時自動測試

- Unit：30 tests
- E2E：67 tests
- 主要覆蓋：
  - Direct invoice 建立
  - Customer save
  - Invoice edit / row navigation
  - Payment one-step
  - 50% release
  - CS handoff / assignment
  - 8萬 fields / municipal
  - Excel export
  - 權限及 notification

### 9.2 Definition of Done（現時 release）

- 直接開單員可由零建立 Invoice
- 收款可一個 dialog 確認或交會計覆核
- 50% 才出 D 工程單，先入工程單待分配
- CS 分配後才入工程管理
- Invoice 修改同步相關資料
- 8萬申請資料可見於 CS
- 所有文件可列印／Excel
- 舊 Sales／clerk 資料不刪除

## 10. Rollout 及後續

1. 完成 Admin 中央 feature flag
2. 決定 Invoice 修改權限及 audit
3. 將 localStorage prototype 移至正式 backend
4. 加 authentication／role enforcement
5. 加 server-side numbering／transaction
6. 加 backup／retention
7. 決定 Sales／佣金／採購是否重啟
8. 真實價目、成本及批核資料上線

## 附錄 A：Production 角色入口

| 角色 | 入口 |
|---|---|
| 直接開單員 | 建立發票、單據管理、客戶、市政單、通知 |
| 會計 | 收款核對、已開單據、退款、通知 |
| 會計主管 | 儀表板、營業單、單據、退款、市政單、通知 |
| CS | 工程單、工程管理、工程師傅、供應商、客戶、工程價目、通知 |
| CS主管 | 自訂工程請示、工程單、工程管理、工程師傅、供應商、客戶、工程價目、通知 |
| Super Admin | 全部 module、用戶管理 |
| Admin Staff | 營運 module（不用戶管理） |

## 附錄 B：一句話記法

> **直接開單 → 收款 → 50% 出 D 工程單 → 阿花分配 → CS 施工 → 完成 → 收尾數**

## 附錄 C：與 v0.13 的使用方式

- 本文件：現時 production 營運的真實 source of truth
- v0.13：保留 module 詳細規格、future／dormant 功能、佣金／採購／Sales 細則
- 任何 v0.13 與本文件衝突的地方，以本文件為現時營運依據；未提及的 dormant module，不得假設已上線
