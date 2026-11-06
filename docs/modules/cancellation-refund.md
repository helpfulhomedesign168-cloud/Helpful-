# 退訂／退款（Cancellation & Refund）— 分析與建議

**狀態：** Discovery / 未實作  
**日期：** 2026-11-06  
**範圍：** 客人下訂後退訂、退款、Credit Note、工程停止、佣金/Bonus 調整

---

## 1. 先分清三個概念

1. **退訂（Cancellation）**
   - 取消交易／工程
   - 不等於一定全額退款

2. **退款（Refund）**
   - 實際把錢退回客人
   - 可以全額或部分
   - 可能先扣施工費、材料費、行政費

3. **Credit Note／紅字單**
   - 會計憑證
   - 用來沖銷原本 Invoice
   - 不是直接修改原 Invoice

**不要直接把 Invoice 改成「已退單」或刪除付款。**  
原 Invoice、付款、收據必須保留，退款用新紀錄沖銷。

---

## 2. 建議的流程擁有權

### Sales
- 發現客人想退訂
- 建立退訂申請
- 填原因、客人要求、相關對話／證明
- 看進度
- **不可自己批准退款**

### 開單員（Clerk）
- 核對 Invoice、付款、收據
- 建立／整理退訂個案
- 計算初步退款建議
- 發送給會計審批
- **不可獨自把錢退給客人**

### 會計（Finance）
- 核對實際收款
- 計退款、扣減、已發生成本
- 執行退款
- 建立 Credit Note / 退款紀錄
- **退款執行者**

### 會計主管（Finance Supervisor）
- 審批退款
- 審批 Credit Note
- 處理超過門檻或特殊個案
- **流程最終負責人**

### CS主管
- 確認工程是否已開始
- 停止新工作
- 確認已完成工作、已訂材料、師傅成本
- 回覆工程扣費建議
- **不處理退款**

### Super Admin / Admin
- 設定權限及審批門檻
- 特殊 override
- 不應作為日常退訂操作人

---

## 3. 為什麼不應該只由開單員做？

退款是現金流出，需要制衡：

```text
開單員：準備文件及計算
會計：核對及執行
會計主管：批准
```

如果開單員可以自行批准及退款：

- 沒有 financial control
- 容易出錯或舞弊
- 退款與 Invoice 無法對帳
- 佣金及 Dashboard 會計數會混亂

## 為什麼不應該只由 Sales 做？

Sales 是客戶關係擁有者，但：

- 不應控制公司退款
- 不應單方面免除工程費
- 不應改 Invoice 或付款紀錄
- 會有 conflict of interest

Sales 應該**發起**，不是**批准**。

---

## 4. 建議由哪裡開始？

### 不建議
- 在 Invoice 列表直接加「退單」按鈕
- 直接改 Invoice status
- 直接刪除 Payment / Receipt
- 直接刪除 Work Order

### 建議
建立獨立 module：

```text
退訂／退款
Cancellation & Refund
```

入口：

- Invoice detail：開單員／會計可建立個案
- 將來 Sales quote detail：Sales 可發起申請

### Prototype 第一版
建議先由 **開單員建立個案**，因為：

- 開單員已有 Invoice 權限
- 開單員負責文件及付款核對
- Sales 暫時沒有 Invoice 權限
- 可先驗證退款流程，不需要一次過改 Sales 的訂單視角

第二版再加：

```text
Sales 在 quote detail 發起退訂申請
→ 開單員接手
```

---

## 5. 建議狀態

```text
requested
→ under_review
→ work_stopped
→ refund_pending
→ approved
→ refunded
→ closed
```

例外：

```text
rejected
cancelled
```

也需要区分：

- 未出 Invoice
- 已出 Invoice 未開工
- 已開工
- 已完工（通常不是退訂，而是售後／投訴）

---

## 6. 退款計算

```text
退款金額 =
已收有效付款
− 已發生工程成本
− 已訂材料／供應商取消費
− 合約訂明不可退訂金
− 行政費／其他扣減
```

需要獨立欄位，不可以只存一個 final refund number：

- 原 Invoice 總額
- 已收款
- 未收款
- 已發生成本
- 扣減項目
- 退款金額
- 退款方式
- 退款日期
- 退款證明

---

## 7. 不同階段的分別

| 階段 | 處理 |
|---|---|
| 未簽未付款 | 取消 quote，不需要退款 |
| 已收訂金、未出 Invoice | 取消 quote；退款或保留訂金 |
| 已出 Invoice、未開工 | Credit Note；退款；取消 Work Order |
| 已開工 | 停止工程；計算已完成工作及成本；部分退款 |
| 已完工 | 不應走退訂；應走售後／投訴／保養 |

---

## 8. 對其他 module 的影響

### Invoice
- 原 Invoice 保留
- 加 Credit Note
- 不退單直接改狀態

### Payment
- 原 Payment 保留
- 新增 Refund record
- 不可刪除原付款

### Receipt
- 已發收據保留
- 需要 Credit Note／收據沖銷紀錄

### Work Order
- 不刪除
- 加 `cancelled` status
- 保留 assignments、成本、現場紀錄

### Commission / Bonus
- 退款後需要 reversal
- 已計算佣金可能要下一期扣回
- Bonus turnover 需要扣減
- 需要避免 Dashboard 與 MYOB 不一致

### Dashboard
- 分開顯示：
  - Gross turnover
  - Refunds
  - Net turnover

### MYOB
- Credit Note
- Refund journal
- 不可只改 turnover number

---

## 9. 建議審批門檻

需要業務決定，例如：

- 全額退款 / 退款超過 HK$X：會計主管批准
- 超過 HK$Y：Admin／老闆批准
- 扣減超過某金額：Sales阿頭＋會計主管
- 已開工個案：CS主管必須確認成本

---

## 10. 建議第一版 MVP

1. Invoice detail 加「建立退訂個案」（開單員／會計）
2. 建立 CancellationRequest
3. CS主管確認工程狀態及成本
4. 會計計算退款
5. 會計主管批准
6. 記錄退款
7. 原 Invoice／Payment／Receipt 保留
8. 加 audit 及 notification
9. Dashboard 分開 gross / refund
10. 暫不做 MYOB 即時 sync，只預留 mapping

---

## 11. 需要確認

1. 第一版由開單員建立個案，還是 Sales 也可建立？
2. 退款由誰執行？會計還是會計主管？
3. 訂金是否一律不可退？還是有合約條款？
4. 退款審批門檻？
5. 已開工如何計算已完成工程及材料費？
6. 佣金／Bonus 退款後如何扣回？
7. 已發收據是否需要客戶簽收 Credit Note？
8. 退款方式：現金／FPS／轉帳／支票？

---

# 12. 已確認規則（2026-11-06）

1. **第一版由開單員建立退訂個案**
   - Sales 不直接操作退款
2. **退款由會計執行**
   - 不需要會計主管／老闆審批
3. **訂金退款依合約條款**
   - 合約條款尚未定立
   - 第一版退款金額由會計按個案輸入，不自動計算
4. **付款達 50% 或工程已開始，不可退款**
   - 以累計有效付款 ≥ Invoice 成交額 50% 為 cutoff
   - 已開始工程 = 不退
5. **佣金扣回**
   - 扣回該 Invoice 已計的佣金
6. **退款方式：銀行轉帳**
7. **客戶需簽 Credit Note**
   - 未上載已簽 Credit Note，不可執行退款

---

# 13. 簡化後流程

```text
開單員核對 Invoice / 付款
→ 確認累計有效付款 < 50%
→ 建立退訂個案
→ 會計核對合約及退款金額
→ 建立 Credit Note
→ 客戶簽署 Credit Note（上載）
→ 會計銀行轉帳退款
→ 上載轉帳證明
→ 個案完成
→ 扣回該單佣金
→ 通知 Sales
```

---

# 14. 系統必須做的硬性檢查

## 建立個案時
- Invoice 存在
- 累計有效付款 < Invoice 成交額 50%
- 沒有 Work Order 已 release／已開始
- 沒有 assignments 已安排
- 未有其他 active refund case

## 執行退款前
- 再次檢查累計有效付款仍然 < 50%
- 沒有新 Work Order 或 assignment
- 已上載客戶簽署 Credit Note
- 已輸入退款銀行資料
- 退款金額不可大於已收有效付款（除非有特殊調整）

## 退款後
- 原 Invoice 保留
- 新增 Credit Note / Refund record
- 原 Payment / Receipt 保留
- Invoice 顯示「已退訂／已退款」
- 佣金 reversal
- Dashboard 顯示 gross turnover、refund、net turnover
- 通知 Sales 及 CS

---

# 15. 仍然要定義的 5 個執行細節

## A. 未出 Invoice、但已收訂金
現時系統可以在 Invoice 前登記付款。若客人此時退訂：
- 沒有 Invoice，怎樣建立 Credit Note？
- 是否要先出 Invoice 再退？
- 還是走「取消報價 + 退款」而不是 Credit Note？

**建議第一版只處理已出 Invoice 個案；未出 Invoice 的退款另開簡單流程。**

## B. 50% 的定義
需要確認：
- 50% = 累計有效付款 ÷ Invoice 成交額？
- 計分類後的付款計劃，還是實際付款？
- 如果退款處理期間付款達到 50%，是否立即自動拒絕？

**建議：以 Invoice.netTotal 及累積 valid payments 計；達到 50% 即自動 block。**

## C. 合約訂金條款
因為未定立，系統不能自動計算退款。
第一版應：
- 由會計輸入退款金額
- 必填扣減原因
- 不可自動假設全額退
- 保留合約附件／客戶確認

## D. 佣金扣回范围
「扣回該單佣金」需要確認：
- 只扣 Sales 本人佣金？
- 還是包括 Sales主管／阿頭管理佣金？
- 已發放還是未發放？
- Bonus turnover 是否也要扣？

**建議：該 Invoice 產生的所有佣金 components 全部 reversal；Bonus 另外顯示調整。**

## E. Credit Note 簽署次序
需要確認：
- 會計先準備 Credit Note
- 客戶簽
- 才轉帳
- 還是先轉帳後補簽？

**建議：必須先上載已簽 Credit Note，才可按「執行退款」。**

---

# 16. 第一版建議 UI

## 開單員
Invoice detail：
```text
建立退訂個案
```
只會在付款 < 50% 時出現。

## 會計
新 module：
```text
退訂／退款
```
- 待處理
- 待客戶簽 Credit Note
- 待轉帳
- 已完成
- 已拒絕

## 個案 detail
- Invoice / 客戶
- 已收金額 / 50% 門檻
- 退款原因
- 合約扣減
- 退款金額
- 銀行資料
- Credit Note 上載
- 客戶已簽 Credit Note 上載
- 轉帳證明上載
- 佣金 reversal 預覽
- Audit

---

# 17. 風險提示

- 不設主管審批，會計將有直接退款權限；需要嚴格 role control、audit 及轉帳證明。
- 50% cutoff 會造成「49.9% 可退、50% 不可退」的懸崖效應，必須在 UI 清楚顯示。
- 已收據不能刪除；必須用 Credit Note 沖銷。
- 如果 Invoice 已開但付款未達 50%，退款後可能影響 Sales 佣金、Bonus、Dashboard 及 MYOB。

---

# 18. Prototype v0.1 已實作（2026-11-06）

## 已做
- 開單員在 Invoice detail 建立退訂個案
- 只限已出 Invoice、累計 valid payments < 50%、未 release 工程
- 開單員不能執行退款
- 會計 module「退訂／退款」
- 會計填退款金額、扣減、銀行資料
- 上載 Credit Note、客人已簽 Credit Note、銀行轉帳證明
- 未齊文件不可完成退款
- 退款完成後：
  - Invoice 標記為已退訂
  - 原 Invoice / Payment / Receipt 保留
  - 扣回該單全部佣金（Sales、主管、阿頭）
  - 通知 Sales
  - Dashboard / Business Orders 排除已退訂 Invoice
- Invoice 列表新增「已退訂」狀態

## 尚未做
- 50% / 工程已開始的獨立 E2E
- Credit Note 未簽時不可退款的 E2E
- Sales notification click
- 未出 Invoice 的訂金退訂流程
- 退款部分金額與扣減的自動對帳
- MYOB Credit Note / Refund journal
- 取消工程單／Assignment 的獨立流程
