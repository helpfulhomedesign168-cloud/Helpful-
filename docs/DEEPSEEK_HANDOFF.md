# DeepSeek接手這份Prototype的指令

## 2026-10-26 Sales客戶表單簡化（不得退化）

- Sales客戶表單只要求：客戶姓名、主要電話、WhatsApp電話、地區、屋苑／大廈、樓層、單位。
- 街道、座數、身份證號碼、是否長者、客戶來源、緊急聯絡人及緊急聯絡電話為選填，不顯示必填星號。
- 不再顯示或要求「身份證明姓名」及「業主姓名」。Customer舊欄位只保留作既有quote／Invoice snapshot兼容，不重新要求輸入；不要為此清空LocalStorage。
- 完整地址仍由地區、街道、屋苑／大廈、座數、樓層及單位自動組合，不得改回自由手填。
- 客戶表單不再以「客戶補充資料」收合；所有欄位直接顯示。歷史已存在的客戶資料不重寫。

## 2026-10-22 報價前成交流程補充（不得退化）

- 客戶工程地址由「地區、街道、屋苑／大廈、座數、樓層、單位」自動組合；完整地址不可另行手填。
- 報價折扣保存三個資料：折扣模式、Sales輸入值及最後計價係數。模式為原價、自訂折扣或自訂扣減；自訂扣減必須在Quote、Invoice快照及文件上保留港幣扣減意義，不可只轉寫成難讀的折數。
- 「儲存草稿」只儲存並留於編輯；「前往預覽及成交」儲存後進入報價詳情，絕不等於交Office。
- 在客戶簽署確認前，付款登記與提交Office必須是清楚鎖定的不可操作控制，而不是容許按下後才拋出錯誤。
- 正式報價流程是：準備列印時選日期及當日主管 → 生成唯一 `Q + 主管碼 + Sales碼 + 年月 + 四位月流水` → 預覽／列印 → 客人紙本簽署 → 上載同一紙本 → 確認簽署。一次版本只能有一個正式Q號；想改日期／主管必須修改報價建立新版本，不能覆寫既有Q號或舊紙本。
- Invoice號使用獨立全公司月流水，且只可在已簽、已交Office及會計核足適用首期後由開單員產生。
- 「現場特別注意事項」、「Sales備註」及「客戶附件」是選填，不得阻擋列印、簽署或提交Office；其他PRD指定的客戶、地址及工程資料仍維持驗證。
- 客戶是共用主檔，不是只藏在Quote snapshot：Sales可獨立新增客戶及住宅資料，之後報價的「選擇現有客戶」讀取同一主檔；電話公司內唯一。Sales只看自己的客戶；B Team主管按既有範圍，阿頭／Admin按既有廣泛範圍。Quote、Invoice、WorkOrder仍必須保留當時客戶快照。
- 主檔更新一律先用永久`customerId`定位，再檢查改後電話不可撞另一主檔；不可只憑電話建立／合併。遮罩身份證號只是只讀投影，絕不可寫回主檔。Sales可讀取及編輯自己客戶的完整資料；非擁有人只可讀遮罩資料，且其投影不可直接作回寫DTO。
- 只有未交Office、未登記付款且未出Invoice的來源可封存；封存需要原因，移入封存tab，且不可再修改、上載、簽署、記款、交Office或開Invoice。已交接／付款／出單的取消必須走日後正式的人工或變更流程。
- 正式客戶版報價必須有公司標誌、文件類型、正式Q號、版本／日期、客戶與工程地址、工程明細／實際範圍／出街單價／金額、折扣、成交額、適用首期、確認條款與簽署欄；不得出現成本、佣金、判頭資料或未設定的真實銀行資料。

請先運行這份程式，不要重新生成一套逐頁Demo。PRD v0.13是業務依據；這份程式已實作首條串連主鏈及新UI方向，但不是所有Module已完成。

理解`src/domain/types.ts`的永久IDs及QuoteVersion／Submission／Payment／Invoice／WorkOrder／Assignment關係。`src/domain/engine.ts`是一份共享業務來源，所有角色的頁面都由同一來源取得投影。`src/context.tsx`目前的browser-local存取只是Prototype替身，不能作生產安全邊界。

首要保留：上載簽檔與指定版簽署明確分開但同頁可完成；Sales只記款，Finance／開單員才核有效；付款計劃不再按成交額自動決定。開單員先將已交Office來源分類為團購（100%）、8萬資助（30%／20%／50%）或自費（30%／20%／30%／20%）；未分類或沒有任何已核對有效收款，不能開Invoice。分類後只要已有一筆有效首訂即可開Invoice；若第一期未足，開單員在Invoice詳情補登第一期餘額，首訂及其證明仍歸入第一期並可開啟。Invoice必須凍結分類及付款計劃快照。每筆有效付款可發一張唯一Receipt（綁Payment ID、期數、金額）；不是將所有付款合併成一張首期收據。累計有效收款達成交額50%才唯一建立工程單／Group、留audit並通知CS。CS交接只安全摘要，原Q、付款明細、證明及收據仍不可讀。Invoice為SHMM2610xxxx等四位當月流水，不額外加I。

保留大字體黑白灰UI、48px主要操作、stable shell及統一間距；PRD是規則，不是每頁必須展示的説明文案。所有必填／前置必須有可發現的UI滿足途徑，error不可藏在modal背後。

## 後端化

## 2026-10-23 開單員／會計流程補充（已由下列最新規則覆蓋；不得退化）

- 開單員側欄只可有「提交報價、單據管理、客戶」。不可再將待核款、待開單及已開Invoice塞在同一頁，亦不可保留「工程查閱」入口。
- 「提交報價」列出所有目前已交Office、未開Invoice的來源，並可按Team A／B及Sales篩選。每行可看Sales登記付款、付款證明、有效核對狀態及分類；未選分類或沒有有效收款時「已核對並開單」必須disabled，分類後有有效首訂即可操作，不能透過預設分類或直接action繞過。
- 最新分類key為`group-buy`（團購）、`grant-80k`（8萬資助）、`self-pay`（自費）。分類、各期百分比及按分位計算的期款金額必須保存到Invoice快照，日後政策改動不能改歷史Invoice。
- Invoice後的付款必須帶`invoiceId`及`installment`。開單員可在Invoice詳情新增第一期餘額或下一個合法期款、上載選填圖片證明；保存後是pending，Finance／開單員核實後才valid。第一期原有首訂付款的證明須在第一期付款列保留並可開啟。支票未兌現、FPS／轉帳未核實、rejected或其他Invoice／Version的款項一律不可計入門檻。
- 收據必須以`paymentId`冪等：每筆valid付款最多一張`R-YYYYMM-SSSS`，金額等於該筆付款、保留期數／標籤／百分比，重按返回同一張。不可再只以Invoice發「唯一首期收據」。
- 開Invoice時不再要求30%已收足；分類後有一筆valid付款即可建立Invoice，第一期30%是付款計劃門檻而不是開Invoice門檻。團購核足100%可即時符合50%門檻。累計valid付款恰好或超過Invoice成交額50%時才由冪等release動作建立唯一WorkOrder、audit及CS通知。CS的handoff、list／get order及assign都要拒絕未release工程。
- 本輪仍未把完整公司收入／支出、MYOB／ABSS連接、付款分配／多筆超額付款、完成摘要及正式後端transaction宣稱為已完成。

可以更換repository，不可以讓每個角色擁有獨立seed或每頁私有資料。新增正式API及transaction，用Customer／Property／Quote／Version／Payment Allocation／Invoice／WorkOrder Group等真正表。避免把當前Quote內customer snapshot當完整主檔已完成。簽版鎖價、四位流水、冪等鍵及支付核對都由server正式驗證；敏感資料不用前端getState當ACL。角色切換要換成真正員工ID登入及session／role grants，按PRD實作。

每輪先保留並運行domain測試及`tests/e2e/golden-path.spec.ts`，後者必須真點UI，用同一新Q由Sales走到會計、開單及CS。不要直接插Invoice／已簽flag令測試看似通過。PRD其餘Module逐條垂直加功能及可達操作，不用靜態頁或大量測試數字宣稱全部完成。

## 原型尚未完成

完整Catalog與圖片資料／SEL、Template／分享、變更主補Group、採購／供應商帳單／扣料、超額／拆分付款分配、工程進度與完成證據、結算／日工、名冊管理、帳號設定及可配置Grant、天書匯入、真API／Auth／存儲／備份。以PRD待決及Phase1排除規則為準，不自行猜政策。

在報告中分開：實跑同一UI主鏈、domain測試、未做功能、已知Prototype限制。不承諾零bug或對應94項需求全已驗證。

## 2026-10-26 開單員客戶列表及收據按鈕（不得退化）

- 開單員客戶列表顯示每張客戶主檔的Sales（CustomerProfile.ownerId對應的Actor名稱），並可按Sales篩選；不要用客戶姓名或電話猜歸屬。
- Sales／主管／阿頭仍只見自己範圍客戶；CS仍只經已釋放工程投影看客戶；不要因新增Sales欄而擴大Sales或CS讀取範圍。
- Invoice詳情內每期付款的「開收據」／「查看收據」按鈕固定靠右，與該期「可發收據」標籤同一右邊界；付款證明按鈕可在其左，不得改動收據或付款狀態規則。
- Demo客戶名稱只屬seed資料，不代表正式客戶；改名稱不可改永久customerId或歷史quote／Invoice／WorkOrder快照。

## 2026-10-26 CS接單跟進及工程單編號（不得退化）

- WorkOrder號碼與Invoice號碼分開：`D + YY + 5位年度流水`，例如`D2600001`；不再用`Invoice號 + D`。已存在WorkOrder號碼不重寫；新增WorkOrder才取新流水。
- 接單跟進只列已累計有效收款達50%並釋放到CS的工程；不要再顯示「可安排工程／已發工程部」tabs或該狀態badge。
- 列表欄：工程單、客戶、聯絡電話、Sales、類別、跟進同事、操作。工程單顯示WorkOrder號，Invoice及原Q只作小字參考。
- 跟進同事是WorkOrder上的CS owner，與判頭／公司師傅Assignment分開；不要以Assignment或CS姓名猜測。
- 只有CS主管可以安排及更改跟進同事；普通CS只讀，不顯示操作按鈕。CS主管可選全部CS同事，包括CS主管本人。
- CS主管Role為`cs_supervisor`；CS帳戶包括現有工程CS、Joe、Nicole、Fandy及阿花。舊LocalStorage只補缺失actors及sequences，不重置。

## 2026-10-26 CS／Super Admin工程部選單（不得退化）

- CS menu固定順序：工程單、工程管理、工程師傅、供應商、客戶、產品款式、工程價目。
- 「工程單」是原本接單跟進；「工程價目」是原本工程目錄，不要另建重複頁。
- 工程管理及工程價目保留現有功能，不要因新增menu而變成空白或刪除。
- 工程師傅、供應商、產品款式本輪只預留空白入口；沒有假資料、假功能或猜測欄位。
- 工程師傅、供應商、產品款式及工程價目須加入Super Admin menu；Super Admin有相應編輯權限，但placeholder未建立前不顯示假編輯按鈕。
- CS主管及Super Admin可安排／更改工程單的CS跟進同事；普通CS只讀。工程師傅及供應商未建立編輯功能，但角色權限方向為CS主管／Super Admin可編輯、普通CS只讀。

## 2026-10-26 工程管理工作台（不得退化）

- 普通CS在工程管理只可讀取 `WorkOrder.csOwnerId === 自己` 的已釋放工程；CS主管及Super Admin可讀全部已釋放工程，並可按CS同事篩選。不要把「所有CS都可看全部」寫回。
- 工程管理版面：左邊工程單列表按 `csReleasedAt` 月份filter；右邊顯示選中工程detail。CS主管／Admin可篩選CS同事。
- 工程單detail標題用WorkOrder號（如D2600001），不再用「客戶名的工程」。地址card不顯示安排狀態；預計開工／完工放右邊。
- 下方calendar顯示該WorkOrder的startDate至endDate及Assignment施工日期；可前後月瀏覽。
- 工程內容逐項安排：每次只安排一個line；已安排項目不可重複。安排後calendar必須顯示該項施工日期／時段。
- 現場環境圖片存於 `WorkOrder.sitePhotos`，屬整張工程，換師傅仍保留，支援多張；圖片binary仍在IndexedDB，大圖只作預覽，不是正式檔案庫。
- 以上普通CS／主管／Admin權限必須由domain `listOrders`、`getOrder`、`listAssignments`、`assign`、`updateDates`、`addSitePhotos`共同執行，不可以只在UI隱藏。

## 2026-10-27 工程管理UI簡化及更改安排（不得退化）

- 移除工程管理相關的無謂細字：topbar「同一來源・接力處理」、施工接力eyebrow、rail的日期／客戶／跟進狀態、地址卡的客戶電話、calendar的「工程期 …至…」及legend。
- 工程管理頁面必須有頂部「工程管理」標題；左邊rail只保留「工程單」、月份picker、主管／Admin的同事filter，以及每行工程單號＋`INV:`；右邊detail以工程單號為標題。
- 安排施工表單放Dialog，不要長期佔用右邊column；工程內容card應為full width，現場環境card放其下。
- 已安排工程項目必須有「更改安排」；修改師傅／日期／時段／備註透過`updateAssignment`，需保留原Assignment及audit，不可刪除重建。
- `updateAssignment`同樣受CS擁有權、主管／Admin全權及WorkOrder released狀態限制。

## 2026-10-27 Topbar、badge及demo dataset（不得退化）

- 移除topbar tagline時不可再令notification／用戶靠左；`.topbar-actions`必須維持右邊（margin-left:auto）。
- 工程內容的「已安排」badge及「更改安排」必須組成一組靠右，不可把badge放在flex中間。
- Demo dataset是刻意加入：工程CS（actor id `cs`）有30張已分派工程，每張12項；阿花有一張未分派`D260099`，20項。阿花分派給工程CS後，工程CS會變31張。
- Demo work order必須有獨立quote／invoice／lines，不可共用同一quote或invoice；否則`listHandoffs`會因quote dedupe而少咗D260099。
- 舊LocalStorage如未有D260099，`readStorage`會補入demo；已有則不重複。不要用reset去解決，否則會清走用戶資料。
