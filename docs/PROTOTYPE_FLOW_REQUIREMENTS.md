# DeepSeek原型開發方法重整｜由逐頁Demo改為單一來源、跨角色貫穿系統原型

**日期：**2026-10-22  
**依據：**PRD v0.13、現有Demo行為、你對`QDNMM26100005`提交失敗的根因說明，以及先前已交的CS／Office交接規格。  
**用途：**這不是新Module，也不是叫你再畫一批新HTML頁面；是要求你校正整個Prototype的實作及驗收方法。

---

## 給產品方的判斷

你今次終於正確指出核心問題：你一直按「頁面」分段做，沒有把**同一個來源**穿過Sales、會計、開單員與CS角色操作。因此各個頁面雖然存在，卻不構成可試用的系統。

但要明確：這不是本PRD沒有說明，也不是使用者每次必須補問的新需求。PRD v0.13已明確要求「同一資料來源、角色切換後看到新狀態」及「由新客戶開始完成端到端Demo」。現在需要改的是你的開發方法、資料關聯方式和交付驗收方式。

---

## PROMPT開始

停止以「逐個頁面完成」或「看到一個bug才補一個button」作為本系統Prototype的開發方法。

你要保留現有可用程式、現有路由與已完成的handoff工作；但由現在起，**任何功能是否完成，唯一主標準是：同一張新建立的單，能否由合法角色以真實UI操作，跨角色連續走到下一步，而不依賴手動改storage、重seed、換另一張預設假單或直接寫入status。**

這是一個可操作、可保存、可切換角色測流程的**系統Prototype**，不是多個互不相關的HTML／React頁面集合。

# A. 先承認及修正目前真正問題

我接受你對QDNMM26100005的根因分析：

- `submitToOffice()`要求`sign_version_id`；
- 現有「上載已簽文件」只保存檔案，沒有建立簽署事實；
- `recordSignature()`藏於使用者不可發現或不能由目前頁面走到的流程；
- 結果是UI表面容許上載，但永遠不可能滿足提交條件。

這是設計及實作斷裂，並非我漏提供需求。

**但禁止用錯誤捷徑修正：**

1. 不可因任何附件存在就自動把報價當作「客戶已簽」。檔案可能是未簽版本、付款證明或錯檔。
2. 不可在測試中直接改`sign_version_id`、`submitted`、`validated`、`invoice_id`或工程旗標來扮流程成功。
3. 不可為了通過Demo，令Sales可直接把付款核成有效、把Q轉Invoice或替CS派工。
4. 不可另造一組「只給CS／Finance看的假資料」；同一來源必須沿同一永久ID流動。

# B. 立即修好Sales簽署、附件、付款記錄及交Office的可發現流程

先修`QDNMM26100005`及所有相同狀態的合法出路；這是主流程第一段，不能只修一張seed單。

## B1. 報價詳情的主操作區

Sales打開本人可操作報價詳情時，畫面要有清楚的「成交／交Office」操作區；不要將關鍵動作分散於列表、無標籤上載按鈕或隱藏抽屜。

按正確順序呈現以下可執行動作及狀態清單：

1. **確認客戶已簽署指定版本**
   - 顯示目前可簽的版本號、版本日期及客戶版預覽入口。
   - Sales明確選定已簽版本，輸入／確認簽署日期，以及PRD既定的簽署日主管／歸屬資料（如已有設定就讀取，不重造另一套來源）。
   - 儲存一個可追溯的Signature Record，寫入`quotation_id`、`quotation_version_id`、簽署日期、經手Sales、相關主管／Team資料及時間。
   - 已簽後改任何報價內容必須新增版本；舊簽版不可被覆寫，當前有效版改變時必須重新簽。

2. **上載已簽報價文件**
   - 明確標示這是已簽版本的證據，並綁定同一`quotation_version_id`。
   - 若`QDNMM26100005`先前已上載檔案，讓Sales在新流程選取該現有檔案並確認「此為已簽版本」後建立Signature Record，**不應迫使用者重覆上載**。
   - 檔案預覽／名稱／上載時間需在詳情可見；原型可用Mock檔案，但不可按上載後只顯Toast而不保存關聯。

3. **登記首筆客戶付款／誠意金或付款證明**
   - 這只是Sales登記Payment Record／證據，並非Finance核款、Invoice或Receipt。
   - 方式、金額、實際收款日期、保管人／收款人、交易參考及附件按既定規則填寫；現金／Sales保管誠意金可以先登記，不強迫不存在的銀行截圖。
   - 顯示「Sales已登記／待會計核對」，不能顯示成「已收足首期」或「正式收據」。

4. **提交Office跟進**
   - 在同一成交區顯示Checklist：指定版已簽、已簽檔已綁定、至少一筆付款已登記。
   - 條件未滿時，按鈕可停用或可點後顯示**具體缺項與直接前往操作**；不能只有失敗Toast或模糊「不可提交」。
   - 三項齊全才可呼叫`submitToOffice()`。
   - 成功後寫一個唯一`office_submission`事件，帶`source_id`、`signed_version_id`、提交Sales、時間及首筆付款參照；建立Office交接／待核款來源，但**不核款、不開Invoice、不生成可安排工程**。
   - 重按必須冪等，不重複建立交接、付款、Invoice或工程。

## B2. Sales列表的狀態語義

Sales報價管理現有頂層Tab可保留「待提交／已提交／草稿／封存」，但必須去除歧義：

- **草稿**：可繼續編輯，尚未進入成交交接。
- **待提交**：尚未完成Office交接；在詳情顯示缺「客簽／已簽檔／首筆付款」哪一項，而不是把未簽稱為已提交。
- **已提交**：只代表成功提交Office跟進，即有效指定版已簽＋已簽檔＋至少一筆Sales付款記錄已登記。這不是已核足首期、不是已出Invoice、不是已開工。
- **封存**：非流程捷徑，不可當作重置已簽／已交Office來源。

在「已提交」詳情顯示精簡且真實的交接進度：`待會計核款`、`首期尚欠`、`可待開單`、`已轉Invoice／工程`等。這些是**同一個已提交來源的後續子狀態**，不能用另一張假報價替代。

# C. 重整資料模型：一個來源、一條鏈、不同角色不同投影

不要再以每個頁面各自的array、各自的status enum或各自seed資料作為真相。

至少有一套中央domain service／repository／持久化資料層。若現時是IndexedDB／local storage Demo，可繼續，但需以同一repository讀寫；將來才可換真API。每個頁面只查詢及投影同一來源資料，不可自行製造另一份資料。

對一張主報價，鏈至少如下：

```text
Customer + Property
→ Quotation + QuotationVersion + Line
→ SignatureRecord + SignedDocument
→ PaymentRecord（Sales登記）
→ OfficeSubmission
→ FinanceValidation / PaymentAllocation
→ Invoice（唯一）
→ WorkOrder（唯一） + WorkOrderGroup
→ Assignment
```

所有關聯使用永久ID，例如：

```text
customer_id
quotation_id
quotation_version_id
payment_id
office_submission_id
finance_validation_id
invoice_id
work_order_id
work_order_group_id
assignment_id
```

展示用Q號、Invoice號、工程號只供人看與搜尋，**不得靠拆字串或客戶姓名／地址來猜關聯。**

每個業務事件至少記：發生角色／員工、時間、來源ID、版本ID、前後狀態、原因／備註。原型可以簡化Audit UI，但不能完全沒有來源及經手人。

## C1. 狀態不要由頁面任意改

- Sales提交、Finance核款、開單、CS安排是不同Action；每個Action在domain service檢查自身角色權限、來源版本及業務資格。
- 顯示的Status／待辦／卡片／列表都是由中央資料及資格計算派生，不能由某個component按「有沒有按過按鈕」私自改。
- `hasValidatedPayment`不等於首期足額。折後C≤100000收50%；C>100000收30%；支票未兌現不有效；Sales登記不等Finance有效。
- Finance核足適用首期、指定簽版有效、主管／Team／代號齊，開單員才可轉Invoice及生成工程。
- 出Invoice不是CS Action；生成WorkOrder不是Sales Action；保存Assignment不等於全工程已施工。
- CS只讀安全交接摘要／Invoice與施工投影，不得讀原報價編輯頁、原簽報價PDF、證件、銀行證據、成本／毛利或佣金。

# D. 不再先補新頁；先完成「Golden Path」垂直切片

由現在起，交付單位不是「完成Sales頁」、「完成CS頁」或「完成一個Menu」，而是**一條可由頭到尾操作的Vertical Slice**。

本輪只聚焦以下最小可用主鏈，不要分心重畫Dashboard、採購、佣金或其他未接通頁面：

```text
Sales建立／續開同一張報價
→ 儲存有效草稿
→ 確認指定版本已簽＋綁定已簽文件
→ Sales登記一筆付款
→ 提交Office
→ CS在「接單跟進」看到同一Q號的安全摘要，但不可派工
→ Finance核該來源付款（不足時阻止開單）
→ 開單員在「單據管理 → 待開單」核對並轉同一來源
→ 生成唯一Invoice＋唯一主WorkOrder／主Group
→ CS在「工程管理」看到同一工程，保存一次合法判頭或公司自營安排
```

這條鏈做通後，才再做採購／SEL／Bill／結算等下一段垂直切片。不可因為已有很多Menu就宣稱系統已可試流程。

## D1. 四個角色不可互相越權

| 階段                                           | 唯一可執行角色              | 禁止捷徑                                    |
| ---------------------------------------------- | --------------------------- | ------------------------------------------- |
| 建報價、簽署事實、上載簽檔、付款登記、交Office | Sales                       | Sales核銀行、出Invoice、生成工程、派工      |
| 核Payment及首期資格                            | 會計／有明確Finance Grant者 | CS／開單員／普通Admin代核；「上載即有效」   |
| 轉Invoice及WorkOrder                           | 開單員／有明確開單Grant者   | CS／Sales按鈕轉換；開單員手改已簽金額       |
| Assignment                                     | CS／合法替補                | 首期不足／未Invoice即派工；外判覆蓋公司自營 |

角色切換不能重置資料。切換或刷新後，下一角色必須可看到上一步同一來源的合法結果。

# E. 建立真正的貫穿測試，不再只測單頁／service碎片

你自己提出要做一條貫穿測試，我同意；但要求如下：

1. 用測試本身建立一張**新的來源資料**，不可挑一張預seed的「剛好已完成」假單。
2. 用UI操作或清楚分層的正式Action呼叫完成每步；不可直接覆寫storage／repository裡的`status`、`signed_version_id`、`validated`、`invoice_id`或`work_order_id`。
3. 每一步Assert同一永久ID仍存在，且下一角色可見的是同一來源。
4. 最少涵蓋刷新／角色切換後資料仍在，及重按提交／開單沒有重複結果。
5. 不可只測「CS看到一行列表」；必須走到Finance核款、開單員出單及CS成功保存Assignment。

必須有以下自動化或明確可重現的E2E驗收：

| ID   | 場景與操作                                              | 必須結果                                                                        |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| GP01 | Sales建立一張新報價並保存                               | 取得新的`quotation_id`及指定Version；刷新仍在                                   |
| GP02 | Sales綁定已簽文件但未確認簽署                           | 不能提交；介面指向「確認客戶已簽署」                                            |
| GP03 | Sales確認指定版簽署、使用已上載或新上載簽檔、登記$1,500 | Signature／Document／Payment正確綁同一版本；仍不是Finance有效                   |
| GP04 | Sales提交Office及重按                                   | 建一個OfficeSubmission；重按不重複建；CS只見安全摘要                            |
| GP05 | 會計只核$1,500，成交額設為$100,000                      | 首期應收$50,000，開單員不可轉Invoice，CS不可安排                                |
| GP06 | 同來源再登記並由會計核銀行$48,500                       | $1,500保管＋$48,500有效銀行達首期；兩筆來源、方式及金額不混成一筆$50,000銀行款  |
| GP07 | 開單員轉同一來源                                        | 只生成一張主Invoice、唯一主WorkOrder及主Group；項目／折扣取已簽版本快照         |
| GP08 | 開單員重按／模擬重試                                    | 不新增Invoice、工程、展示號或Group                                              |
| GP09 | CS進入同一工程並安排外判或公司自營明細                  | 保存真Assignment，刷新後仍在；不等於已施工                                      |
| GP10 | CS嘗試讀原Q／簽PDF／核Payment／出Invoice，Sales嘗試安排 | 被拒絕；但各自合法摘要／工程投影可讀                                            |
| GP11 | 成交額$120,000及支票未兌現                              | 首期應收$36,000；未兌現支票不算Finance有效                                      |
| GP12 | 現有QDNMM26100005                                       | 無須重建該單；Sales能在詳情補做可見簽署確認並重用已上載簽檔，之後依法提交Office |

若你目前環境只能做前端Demo，請如實寫明這只是前端持久化及投影測試，**不能聲稱已完成真後端ACL、銀行核實、私有檔案安全或多人併發交易保護。**但這不免除你在Prototype做到正確共享來源與角色資格。

# F. 先做一次全系統「斷點審計」，再落手修

開始改之前，請先用短表列出下列項目的唯一實體、唯一service／action、唯一資料來源及使用頁面：

1. Quotation Version／指定簽版；
2. Signature Record；
3. Signed Document；
4. Payment Record及Finance Validation；
5. Office Submission／開單WorkItem；
6. Invoice與全公司流水；
7. WorkOrder／Group；
8. Assignment；
9. 目前各角色頁面從哪個repository／state讀取。

目的是找出重複欄位、互相獨立的array、隱藏Action、舊seed與新schema不兼容位置。**不是要求你停留在分析。**表列完即開始修主鏈；不需要等我逐項批准。

如發現舊Demo資料因schema變更失效，提供合法migration／repair或清楚「需要重置Demo」選項；不可靜默清掉使用者資料、把壞資料藏起或聲稱已修其實只換一張seed單。`QDNMM26100005`屬這輪必驗來源。

# G. 本輪交付格式：用證據交付，不用口頭保證

完成本輪時，請交付以下內容：

1. **斷點審計表**：指出本次發現的重複狀態／資料斷點及已如何合併或保留。
2. **實作變更表**：路由、component、domain service、repository／migration、測試檔案的實際路徑及作用。
3. **Golden Path Walkthrough**：逐步列出GP01–GP12每一步的角色、入口、使用的同一來源Q／永久ID、畫面結果及下一步。
4. **實際測試報告**：執行命令、pass／fail、失敗原因及已修狀態；unit、UI與E2E分開寫。未跑不可說「通過」。
5. **截圖或短操作證據**：最少Sales成交／提交區、CS接單摘要、Finance核款、開單員待開單、生成後CS工程安排五個畫面；每張都可看出同一來源號。
6. **未完成清單**：採購、SEL、完整工程五區、真正後端ACL等如未做，直接列`未實作`，不要將靜態頁／Toast寫成已完成。

在上述GP01–GP12未全部成功或誠實列出失敗以前：

- 不要開始新的漂亮Dashboard；
- 不要再把十二Module逐頁算作完成；
- 不要要求我幫你逐頁試出斷點；
- 不要將「build成功／總測試數增加」當作系統流程可用。

我需要的是：先讓我用一個新來源，切換Sales、會計、開單員、CS四個帳號，真正走完一張單的核心交接。這是本系統Prototype最低可信度要求。

現在請先完成斷點審計，再直接開始修復及跑GP01–GP12；不要停在一份計畫等我再次批准。

## PROMPT結束
