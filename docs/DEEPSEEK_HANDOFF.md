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

## 2026-10-27 工程內容表格、開工／完工日期及額外工程（不得退化）

- 工程內容必須用緊湊表格式，不再每個項目一張高card。欄位：工程項目、執行師傅、開工時間、完工時間、備註、操作。
- 安排施工欄位為「開工日期」及「完工日期」，不是單一「預計施工日期」。Assignment有`date`及`endDate`；舊Assignment沒有endDate時以date補上。
- 「額外工程」度尺／送貨／搬運不是報價或Invoice line，不可加入quote.lines或invoice.lines；獨立存於`AppState.extraWorks`，每個WorkOrder每種kind最多一筆，可upsert。
- 額外工程安排同樣需要師傅、開工、完工、時段、備註；必須有domain權限（普通CS只可自己工程，主管／Admin全部）及audit。
- 額外工程及Assignment的日期range都會出現在calendar；Assignment有endDate時calendar覆蓋整個range。
- 舊LocalStorage遷移必須補`extraWorks`及`assignment.endDate`，不可reset。

## 2026-10-27 工程價目 catalog UI（不得退化）

- 工程價目頁只顯示 `published && !archived` 的active catalog；舊demo服務設為`archived`，不可硬刪，因舊Quote/Invoice/WorkOrder仍用itemSnapshot。
- 分類tag固定：全部、打拆項目、水喉項目、電力項目、泥水項目、油漆項目、傢俬項目、裝門項目、鋁窗項目、防滑項目、其他項目，最後有新增項目plus。
- 六項打拆demo item為：廚房／廁所／全屋／廳房／露台／花園牆身·地台清拆打鑿；價格HK$50／平方呎，低銷100平方呎，工程範圍對應。
- 新增／修改工程項目dialog欄位不得改成舊版：工程名稱、工程分類、怎樣計價、出街單價、最低計費量、執行方式、外判60%提示、Sales施工提示、其他規則（含工程範圍）。
- 舊LocalStorage遷移會archive舊services並補六項；已有六項則不重複。不可reset。
- 下一批user提供的分類項目會加入同一active catalog；不要重新加回舊demo服務。

## 2026-10-27 工程價目第二階段：詳細、連貫工程、計算方式鎖定、刪除（不得退化）

- `ServiceItem`新增`details`及`linkedServiceIds`；列表的工程名稱下面必須用細字顯示details。
- 新增／修改form按參考圖：工程名稱、工程分類、工程範圍、工程詳細、計算方式radio、零售價／低銷價／合併低銷價、連貫工程。不要加回舊的執行方式、60%提示、Sales提示或其他規則UI。
- 計算方式只可在新增時選；修改時radio disabled，domain `saveService`亦必須拒絕measure變更。
- 連貫工程picker只可顯示分類tag、工程名稱及details；不可顯示價錢、低銷或範圍。每個ServiceItem可以有0至多個linkedServiceIds。
- Sales報價加入有linkedServiceIds的項目時，必須顯示「需要加連貫工程？」；dialog只列被連貫項目，user可選加入或暫不加入；加入後以獨立QuoteLine加入。
- 列表必須有刪除按鈕；刪除用`deleteService`設archived，不可硬刪，因舊Quote/Invoice/WorkOrder snapshot要保留。
- 舊localStorage的六項demo catalog要補details及linkedServiceIds；不可重複加catalog。

## 2026-10-27 Dialog focus、工程分類tags新增／刪除（不得退化）

- `Dialog`的focus effect只可在mount執行；`onClose`用ref更新。不可用`[onClose]`作effect dependency，否則每次輸入re-render會把focus搶回dialog，造成打一個字後不能繼續輸入。
- 工程分類存於`AppState.serviceCategories`（不是hard-code在UI）；舊LocalStorage會補預設分類，已有分類不重加。
- Tag row最後是「編輯」button，不是「＋」。Top「新增項目」只新增工程項目。
- 「編輯」開分類editor：可新增分類；可勾選多個分類刪除。刪除前必須確認：「是否確定真的要刪除XXX工程項目？一旦刪除，工程項目入面的工程全部都會一齊刪除掉。」
- 刪除分類時，相關`ServiceItem`一律`archived=true`，不可硬刪；舊Quote/Invoice/WorkOrder snapshot保留。刪除後如active tag被移除，回到全部。
- 分類新增／刪除只限Super Admin。

## 2026-10-27 第二十四項catalog及demo工程重建（不得退化）

- Active catalog共30項：打拆6、水喉6、泥水6、油漆6、傢俬6。舊demo services仍archived。
- 水喉detail完整句子：「連工包料和清走舊有喉管 來水喉管 舊有鐵喉更換包膠銅喉 (用簪欖做法)」；水喉scope已修正為廚房／廁所／全屋正確配對，全部fixed price，低銷無。
- 泥水detail統一「連工包料」；油漆detail「連工包料用立邦五合一油漆」；油漆第6項是「廁所天花剷走鬆散底灰、批灰及髹油 (有傢俬和雜物)」，不是水喉。
- 傢俬6項：三項length/直呎低銷3，三項fixed/項低銷無。
- `AppState.demoEngineeringVersion` = 2。舊state沒有2時，refresh 30張demo單為每張12項、D260099為20項，全部lines取自active catalog；清空demo work orders的assignments，不改csOwnerId；已為2時不可每次reload重刷。
- Demo lines只更新WorkOrder snapshot；舊Invoice／Quote lines不應被反寫，避免破壞歷史。
- 新seed直接由active catalog產生demo lines；30張單仍是D2600200–D2600229，D260099 unassigned。

## 2026-10-28 Sales報價UX（不得退化）

- 完整地址由`composeCustomerAddress`統一組合，樓層／單位若未帶「樓」「室」會自動補上，例如樓層22、單位08 → 22樓 08室；引擎migration及CustomerForm都必須用同一helper，避免兩處格式不同。
- Sales加入工程後不再顯示「施工位置」及「尺寸單位」；新line的position用Service.scope，dimensionUnit固定呎。不要恢復成必填。
- `validEngineering`不可再要求line.position或line.notes；施工位置及現場備註是選填。
- 現場要求及注意事項用`<details>`收起，預設關閉；不要長期展開。
- 工程項目名稱下面要顯示ServiceItem.details細字；不要只顯示價錢。
- 當日主管／簽署主管：head角色可跨Team選擇（例如Don在Team B報價）；supervisor仍必須同Team。printPreparation及signature兩處validation都要一致，否則畫面可選但提交會失敗。
- 地址自動補樓／室後，舊Customer/Quote/Invoice/WorkOrder地址在migration時會重算；已有的「12樓」「A室」不可重複加。

## 2026-10-28 Sales picker／stepper／摘要簡化（不得退化）

- 新增工程picker每行只顯示工程名稱、分類／詳細、價錢；不可加回工程code badge或右邊＋。
- Quote stepper只可有3步：報價、客戶已簽、交Office；不可顯示首期足額或已轉工程。
- 報價摘要不可加回「即時計價」eyebrow、「收款計劃／開單員分類後確認」或底部「只會先保存並前往成交流程…」細字。
- 保留報價摘要標題、工程小計、全單折扣、成交金額及前往預覽按鈕。

## 2026-10-28 全系統列表pagination及提交報價（不得退化）

- 所有**記錄列表**每頁最多12項；使用共用`usePagination`／`Pagination`。套用頁面：提交報價、報價管理、單據管理、收款核對、工程單、工程管理rail、客戶、工程價目、我的業績。詳情內line-item表（quote lines／invoice lines／engineering table）不是記錄列表，不套pagination。
- 列表預設最新優先：Submissions用submission.createdAt、Quotes用updatedAt、Invoices/Finance用createdAt、Handoff/Orders用releasedAt或createdAt、Customers用profile/order時間、Performance用date。新filter/search/page時page重設1。
- 提交報價不可加回PageHead eyebrow/description、Q號下的「已簽版本／Team」、證明文件column、付款核對badge及第一期門檻細字。
- Submissions columns固定：報價單、日期、客戶／地區、Sales、成交額、首訂金額、分類、狀態（最右）。
- 狀態：有pending payment → 黑色「核對收款」；已核對且可開單 → 黑色「已核對並開單」；未分類／未收款 → disabled「待分類／待收款」。
- 付款證明不再在列表顯示；只可在核對收款popup內以圖片預覽（無證明顯示未上載）。

## 2026-10-28 CS工程單及calendar（不得退化）

- 工程單每行invoice只可顯示短式「INV {invoiceNumber}」；不可顯示quote number或「Q ...」。
- 工程單toolbar必須有月份、Sales、跟進同事filter；跟進同事包括「未安排」。Filter/search/page都要正確重置。
- 工程單列表仍按releasedAt最新優先；分頁12項。
- 多日Assignment／額外工程在calendar必須以跨欄event bar顯示：例如2號至5號要由2號格橫跨到5號格，不可逐日重複同一label。跨月event按週分段顯示；bar使用calendar week grid的gridColumn span。
- 工程管理detail最底部要有全寬「工程完成」button；現階段沒有onClick／流程，不可假裝已完成或彈假成功訊息。

## 2026-10-28 工程師傅主檔（不得退化）

- 工程師傅頁取代placeholder；資料存於現有`Resource`，新增`kind`(foreman/worker)、`specialty`、`mainWork`、`scope`、`details`、`feeMode`、`feeAmount`、`createdAt`。
- Tabs固定全部／工程判頭／師傅；12個demo師傅不可少。列表columns：師傅稱呼、聯絡電話、收費、工程範圍、編輯。
- 新增／修改form：師傅性質radio、名稱、電話、主項工程、工程詳細、收費方式radio、條件金額（日薪／固定價）；項目6成顯示6成說明。
- 收費方式只可在新增時選擇；修改時disabled，domain `saveContractor`亦必須拒絕feeMode變更。
- 普通CS只讀；CS主管／Super Admin可新增、修改、刪除。刪除用active=false，不可hard delete（Assignment歷史要保留）。
- 新增／修改只可改master fields；resource仍然要可供現有`listResources` assignment使用。
- 列表需最新createdAt優先及12項pagination（與全系統一致）。
- Assignment dialog必須列出所有已輸入、active的師傅／判頭（`type !== "service"`），不可再按工種或contractor/staff類型限制；CS要求每張單都可選全部師傅／判頭。Domain `assign`／`updateAssignment`亦不可再用trades或execution阻擋。
- 工程內容表必須有「師傅收費」column：選定資源的feeMode；project60要以該工程單所屬**報價版本**的lineAmounts×60%顯示金額（Engine `orderLineAmounts`，CS可讀但不暴露整張報價），再fallback Invoice line amounts；日薪／固定價顯示feeAmount（如有）。不可只靠Invoice line ID，否則demo／歷史單會顯示0.00或只有「項目6成」。

## 2026-10-29 Demo師傅收費固定值

- 12個demo工程師傅中，feeMode=`daily`一律feeAmount=1600；feeMode=`fixed`一律feeAmount=3000；project60維持0（按報價6成計）。
- Seed建立及舊localStorage migration都必須套用此規則；migration只可按12個`resource-master-*` IDs補回，不可覆蓋用戶自行新增的師傅或其收費。
- 工程內容「師傅收費」column對daily/fixed顯示feeAmount；project60顯示quote line amount×60%。

## 2026-10-29 工程成本總和及師傅選項label

- Assignment及額外工程資源dropdown label必須係`名稱（mainWork）`，例如`林仔（油漆）`、`黃日強 (Danny)（判頭）`。無mainWork的舊demo資源可只顯示名稱。
- 工程管理detail必須在「工程內容」card與「現場環境」card之間顯示成本總和card；不可放到page底或現場環境下面。
- 成本總和至少顯示：報價單總額（invoice.netTotal）、成本支出總和、成本比率、淨賺、未安排項數。
- 成本只計已安排師傅收費：project60=quote line amount×60%；daily=feeAmount×inclusive日數；fixed=feeAmount×項目數；額外工程同樣按daily/fixed計。未安排報價工程不可估成本，card必須註明。

## 2026-10-29 地址、成本一致性及額外工程收費

- `composeCustomerAddress`必須為block補「座」：輸入8→8座；已有「座」不可重複。
- Cost summary不可再按資源總fee或獨立公式計算；必須逐條Assignment用與工程內容row相同的lineCost計算：project60=quote line×60%、daily=feeAmount×inclusive日數、fixed=feeAmount；成本總和=所有已安排lineCost+額外工程price。
- 未安排報價line不可計成本；row顯示「—」。額外工程不可自動套用師傅feeMode；ExtraWork.price由CS自由輸入，0=不收費。
- ExtraWorkKind固定measure/delivery/transport/fabrication；buttons顯示度尺／送貨／搬運／造貨。造貨現階段disabled placeholder，等供應商流程。

## 2026-10-29 供應商主檔

- 供應商頁取代placeholder；`Supplier`獨立於Resource，欄位name/phone/contact/categories/supply/hasProductStyles/active/createdAt。
- Tabs固定13個SUPPLIER_CATEGORIES：生態板傢俬、木門、PD門、鋁窗、鋁材、戶外板、太陽能、浴屏、座廁、潔具、玻璃、石英石、雲石；篩選用categories，supply只作seed顯示文案。
- 列表columns：供應商、聯絡電話、聯絡人、主理供應、編輯；新增/修改/刪除CS主管或admin，普通CS只讀。
- 新增/修改form：供應商名稱、聯絡人、聯絡電話、工程詳細checkbox、產品款式有/沒有。儲存最少一個categories。
- `hasProductStyles`必須保存，供下一步產品款式module使用；現階段不要假裝已建product styles supplier records。
- 8個demo suppliers及舊localStorage migration都要有；不可覆蓋用戶新增/修改的supplier。
