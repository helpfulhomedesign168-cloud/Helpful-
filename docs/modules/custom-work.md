# 自訂工程（Custom Work Request）— 流程分析與待確認事項

**狀態：** Discovery / 未實作  
**日期：** 2026-11-05  
**範圍：** Sales 自訂工程、工程部報價、開單員補價、Invoice V1、通知

---

## 1. 已理解的使用者流程

1. Sales 在報價時遇到工程價目表沒有的項目。
2. Sales 新增「自訂工程」，只填工程內容，不能自定價錢。
3. Sales 按「發給工程部報價」。
4. 自訂工程可以與工程價目表的其他項目一齊存在。
5. 如果報價單只有一項自訂工程，不能成立／不能發出。
6. 如果報價單有其他工程價目表項目，即使自訂工程仍待報價，報價單仍可成立、可出單、可收客人錢。
7. 開單員照常收到報價，可核對頭訂金，並看到自訂工程為「待報價」。
8. 工程部主管在新增的 module 收到自訂工程請示。
9. 主管線下找師傅了解及取得價格。
10. 主管在 module 回覆該自訂工程的價錢。
11. 開單員收到通知，打開 Sales 報價，輸入自訂工程價錢，然後建立 Invoice（V1）。
12. Sales 收到通知，知道正確價錢及該單總數。
13. Sales 線下重新列印報價給客人確認。

---

## 2. 現時 prototype 與新流程的衝突

### 2.1 現時錯誤地封鎖所有待報價項目
現時只要 quote line `pricePending = true`：
- 「前往預覽及成交」disabled
- 準備列印被 engine 阻止

新規則應改為：
- 只有「全部項目都是待報價自訂工程」才不可出單
- 只要最少有一項已定價的工程價目表項目，就可以出報價及收錢

### 2.2 現時沒有「自訂工程請示」entity
現時只有一條 quote line，沒有：
- request id
- 工程部主管
- 回覆價錢
- request 狀態
- 通知記錄

### 2.3 現時 Invoice 建立後不可修改
新流程需要先確認「Invoice（V1）」究竟是什麼：
- 是第一次建立 Invoice，之前未出過 Invoice？
- 還是 Invoice 已存在，之後再加價，建立 V2 修訂版？

這兩種做法的 accounting、payment、receipt、CS release 影響完全不同。

### 2.4 現時 quote 簽署／付款／Invoice 次序
現時原則是：
```text
Sales 準備列印
→ 客人簽署
→ 登記首期付款
→ 提交 Office
→ 開單員分類
→ 開 Invoice
```
新流程需要確認：
- 待報價 quote 是否可以給客人簽？
- 客人是否只就已知項目付訂？
- 補價後是否要重新簽署，才可以出 Invoice？

---

## 3. 關鍵漏洞與需要定義的規則

### A. 「Invoice（V1）」的定義
必須先確認這是：
1. 第一次 Invoice（之前未出過），或
2. Invoice amendment（之前已出 Invoice，現在加價）

如果是 2：
- 舊 Invoice 是否保留？
- 新 Invoice V1 還是 V2？
- 付款、收據、CS 50% release、佣金、Dashboard 如何處理？
- 客人已簽的舊報價是否仍有效？

### B. 待報價報價單的客戶簽署
如果報價單有「待報價」項目：
- 客戶簽的是什麼總額？
- 待報價項目是否明確寫「不包括在現時總額」？
- 補價後是否必須重新簽一份新版本？
- 沒有重新簽，是否可以出 Invoice？

### C. 訂金及付款計劃
如果 pending item 未計入總額：
- 訂金是按「已知項目總額」還是「最終總額」計？
- 補價後總額增加，原訂金是否仍有效？
- 付款計劃 30%／50% 應否重算？
- 客人需要補付首期差額嗎？
- 收據何時發？

### D. 只有自訂工程的報價
規則需要更具體：
- 一開始只有自訂工程：不可出單。
- 如果之後工程部報了價，仍然只有自訂工程，是否可以出單？
- 如果 Sales 之後加入一項工程價目表項目，是否立即可以出單？
- 「其他項目」是否必須是已發布、價錢大於 0 的目錄項目？

### E. 工程部回覆的是什麼價
需要定義：
- 單位價還是總價？
- 是否包括數量／單位？
- 是否包括成本（internal cost）？
- 是否受全單折扣影響？
- 是否影響 Sales 佣金、Bonus、公司毛利？
- 工程部主管可否回覆「做不到」／「不報價」？

### F. Sales 更改自訂工程
如果 Sales 在 request 發出後修改：
- 工程內容
- 數量
- 位置
- 刪除項目

應該：
- 自動更新 request？
- 建立新 request version？
- 取消舊 request？
- 鎖定已送出的 request？

### G. 多項自訂工程
- 一張 quote 多過一項自訂工程時：
  - 每個 line 一個 request？
  - 還是整個 quote 一個 request？
- 部分已回價、部分未回價時：
  - 可否先出單？
  - 還是要等全部回價？

### H. 工程部主管權限
- 所有 CS 主管都看到同一個 pool？
- 還是指定一位主管？
- 主管可以轉交／指派給另一位主管？
- 普通 CS 可否查看？
- 回價後可否修改？
- 是否需要上載供應商 quote／圖片？

### I. 開單員補價權限
- 只有開單員可輸入價錢？
- 工程部主管回價後，開單員可否修改？
- 開單員輸入價錢時，是否可以同時修改數量？
- 補價後是否需要新 quote version？
- 補價後是否需要 Sales 重新簽署？

### J. 通知
- 工程部主管：全部還是指定？
- 開單員：收到邊個 notification？
- Sales：收到「價錢已更新」還是「Invoice 已出」？
- 如果負責同事停用，通知去哪裡？
- 是否需要 reminder／SLA？

---

## 4. 建議的狀態模型（待確認）

### CustomWorkRequest
```text
requested
→ acknowledged（可選）
→ priced
→ applied（已套用到報價）
→ closed
```

或：
```text
pending
→ answered
→ applied
→ cancelled
```

### QuoteLine
```text
pricePending = true
→ pricePending = false（已有工程部價錢）
→ 建立新 quote version
```

### Quote
```text
draft
→ pending_custom_price
→ ready_for_resign
→ signed
→ submitted
→ invoiced
```

### Invoice
如果真的需要 amendment：
```text
Invoice V1
→ Price Variation V2
→ ...
```

---

## 5. 我建議的簡化順序（需要你確認）

如果「Invoice（V1）」是指第一次 Invoice，建議：

1. Sales 新增自訂工程及最少一項目錄工程。
2. 報價單可印、可簽、可收訂，但清楚標示「待報價，不計入現時總額」。
3. 開單員收到報價，核對訂金，但暫時不發 final Invoice。
4. 工程部主管在 request module 回價。
5. 開單員收到通知，輸入價錢。
6. 系統建立新的 quote version。
7. Sales 重新列印及客人重新簽署。
8. 開單員按最終總額建立 Invoice V1。
9. Sales 收到最終價錢及總數通知。

這個順序的好處：
- 不需要修改已發 Invoice
- 不需要處理 Invoice V2
- 付款計劃按最終總額重新計算
- 保留客戶重新確認

但如果你的意思係「Invoice 已經出咗，之後補價」，就需要另一套 Invoice amendment 設計。

---

## 6. 需要你確認的問題

1. 「Invoice（V1）」是第一次 Invoice，還是已出 Invoice 的修訂版？
2. 待報價報價單可否給客人簽？總額如何顯示？
3. 補價後是否一定要客人重新簽署，才可以出 Invoice？
4. 只有自訂工程的報價，工程部報價後可否出單？
5. 工程部回覆的是單位價、總價，還是成本價？
6. 一張 quote 多過一項自訂工程，應否逐項 request？
7. 已送出的 request，Sales 還可否修改該項目？
8. 補價後，訂金及付款計劃如何重算？
9. 自訂工程是否計入 Sales 佣金、Bonus、公司毛利？
10. 工程部主管看到全部 request，還是指定負責？

---

# 7. 修訂版流程 v2（2026-11-05）— 取代舊 Invoice V1 流程

## 7.1 已簡化為

1. Sales 加入自訂工程後，報價只能儲存為草稿，不能提交給開單員。
2. 自訂工程照樣可以發送給工程部主管問價。
3. 工程部主管回答的是 **出街價**（selling price），不需要分成本價／出街價。
4. 主管回價後：
   - Sales 收到 notification，知道價錢。
   - Sales 在草稿報價填上該價錢。
   - 報價成為完整報價後，才可以提交給開單員。
5. 開單員不會接觸「待報價」報價，因此：
   - 不需要處理 pending 訂金
   - 不需要 Invoice V1 amendment
   - 照原本流程收完整報價、核對付款、出 Invoice

## 7.2 這個方案的優點

- 不影響 Invoice 已出不可改的規則
- 不需要處理 pending 付款計劃
- 不需要 Clerk 補價
- 不需要 Sales 重新簽 pending 報價
- 工程部 request module 與 Sales 草稿完全獨立
- 現有 quote → signature → submit → invoice 流程保持不變

## 7.3 仍需確認的規則

### A. Sales 可否改主管報價？
建議：
- 主管回價自動填入 quote line
- Sales 只可查看及提交，不可改價
- 如要改價，需由主管重新回價

如果讓 Sales 手動輸入，系統應驗證必須等於主管批准價，否則會出現「主管批 HK$8,000，Sales 報 HK$12,000」。

### B. 只有自訂工程的報價，補價後可否提交？
上一版規則是「只有自訂工程不能成立」。
需要確認是否仍然保留：
- 保留：即使已報價，仍要有最少一項目錄工程才可提交。
- 放寬：補價後自訂工程已是有價項目，可以單獨提交。

### C. 多項自訂工程
建議：
- 每個自訂 line 一個 request
- 所有 pending request 都 priced 後，quote 才可提交
- 任何一項仍 pending，整個 quote 保持 draft

### D. Sales 在 request 發出後修改自訂工程
建議：
- 已送出的 request，描述及數量鎖定
- Sales 要改，先取消 request，再建立新 request
- 避免工程部主管報價後，Sales 改了內容但系統仍套用舊價

### E. 主管報價的單位
需要確認主管輸入：
- 單位價（unit price），或
- 整項總價（line total）

如果有數量，建議用單位價，系統自動計 line total。

### F. 主管不能報價 / 拒絕
需要狀態：
- `cancelled`
- `declined`
- 不能只有 pending / answered 兩種

### G. 通知
- 工程部主管：新 request
- Sales：已回價
- 開單員：不需要 pending 通知
- Sales 提交完整報價後，才按原本流程通知開單員

## 7.4 建議狀態

```text
Quote: draft
  └─ custom line: pricePending
       └─ request: requested
            → answered
            → applied
            → cancelled/declined

Quote: draft（全部 pending 已 resolved）
  → submit
  → signed
  → invoice（正常流程）
```

## 7.5 仍待確認

1. 主管價自動填入並鎖定，還是 Sales 可手動輸入？
2. 只有自訂工程、已補價後，可否提交？
3. 多項自訂工程是否必須全部有價才可提交？
4. 主管回價是單位價還是總價？
5. 已送出 request 後，Sales 可否修改內容？
6. 主管拒絕／無法報價時，quote 怎樣處理？

---

# 8. 已確認規則（2026-11-06）

以下 4 點已由使用者確認：

1. **主管價自動填入並鎖定**
   - 工程部主管回覆出街價後，系統自動套用到自訂工程 line
   - Sales 不可自行改價
2. **只有自訂工程，補價後仍不可提交**
   - 報價單必須最少有一項工程價目表項目
3. **多項自訂工程全部有價才可提交**
   - 任何一項仍 pending，整張 quote 保持 draft
4. **Request 送出後內容鎖定**
   - 自訂工程描述及數量不可再改
   - 要改需先取消舊 request（取消流程下一步再補）

---

# 9. Prototype v0.1 已實作（2026-11-06）

- Sales 新增自訂工程 → 自動儲存草稿及建立 request
- 報價進入 quote detail，自訂工程顯示「待報價」
- 待報價 quote 不可準備列印／提交
- CS 主管 menu 新增「自訂工程請示」
- CS 主管可輸入出街價及回覆
- 回覆後自動更新 quote line 價錢、清除 pricePending
- Sales 收到 notification
- 自訂工程數量及刪除在 request 期間鎖定
- 只有自訂工程仍然不可列印／提交
- Clerk 不會收到 pending quote

## 尚未實作
- Request 取消／拒絕狀態
- Request 修改後重新送審
- 多個 request 的批次處理／指派
- 完整 notification 點擊測試
- 新增一項目錄工程後解鎖提交的 E2E
