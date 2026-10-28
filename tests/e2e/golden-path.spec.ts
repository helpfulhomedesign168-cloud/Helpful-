import { test, expect, Page, Locator } from "@playwright/test";
async function role(page: Page, id: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: id }).first().click();
}
async function file(
  page: Page | Locator,
  label: string,
  name = "測試文件.svg",
) {
  await page.getByLabel(label, { exact: true }).setInputFiles({
    name,
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="20" y="70">DEMO TEST ONLY</text></svg>',
    ),
  });
}
test("全新來源經Sales→Finance→開單員→CS；部分款及未簽不會出工程", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await role(page, "SuperAdmin");
  await page.getByRole("button", { name: "新增工程項目", exact: true }).click();
  const item = page.getByRole("dialog");
  await item.getByLabel("工程名稱", { exact: false }).fill("UI貫穿測試工程");
  await item.getByLabel("工程分類", { exact: false }).selectOption("打拆");
  await item.getByRole("radio", { name: "面積(長X闊)", exact: true }).check();
  await item.getByLabel(/零售價/, { exact: false }).fill("1000");
  await item.getByRole("button", { name: "儲存工程項目", exact: true }).click();
  await expect(item).toBeHidden();
  await role(page, "文文B MM");
  await page.getByRole("button", { name: "建立報價", exact: true }).click();
  await page.getByRole("button", { name: "選擇現有客戶", exact: true }).click();
  await page
    .locator(".customer-option")
    .filter({ hasText: "陳小強" })
    .first()
    .click();
  // Customer fields are always visible now; no expand button.
  await page.getByLabel("客戶姓名", { exact: false }).fill("UI測試新客戶");
  await page.getByLabel(/^聯絡電話/).fill("91238800");
  await page.getByLabel("WhatsApp電話", { exact: false }).fill("91238800");
  await page.getByLabel("工程地區", { exact: false }).selectOption("黃大仙");
  await page.getByRole("button", { name: "新增工程", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByPlaceholder("搜尋工程名稱")
    .fill("UI貫穿測試工程");
  await page
    .locator(".service-option")
    .filter({ hasText: "UI貫穿測試工程" })
    .click();
  const line = page.locator(".line-card");
  await expect(line.getByLabel("施工位置", { exact: false })).toHaveCount(0);
  await expect(line.getByLabel("尺寸單位", { exact: false })).toHaveCount(0);
  await line.getByLabel("長度", { exact: false }).fill("100");
  await line.getByLabel("闊度", { exact: false }).fill("1");
  await page
    .getByRole("button", { name: "前往預覽及成交", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "UI測試新客戶的報價", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "封存報價", exact: true }),
  ).toBeVisible();
  await page
    .locator(".page-head")
    .getByRole("button", { name: "準備列印報價單", exact: true })
    .click();
  const printDialog = page.getByRole("dialog", { name: "準備列印正式報價單" });
  const supervisorSelect = printDialog.getByRole("combobox", {
    name: "當日主管",
    exact: true,
  });
  await expect(
    supervisorSelect.getByRole("option", { name: /Don/ }),
  ).toHaveCount(1);
  await supervisorSelect.selectOption({ label: "Don A DN（測試碼）" });
  await printDialog
    .getByRole("button", { name: "確認並開啟報價單", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "工程報價單", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "UI測試新客戶的報價", exact: true }),
  ).toBeVisible();
  const qNumber = (await page.locator(".page-head .eyebrow").innerText()).split(
    " · ",
  )[0];
  let row: Locator;
  await expect(qNumber).toMatch(/^QDNMM2610\d{4}$/);
  await expect(
    page.getByRole("button", { name: "登記付款", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "提交Office", exact: true }),
  ).toBeDisabled();
  await file(page, "上載已簽文件");
  await expect(page.getByText("測試文件.svg", { exact: true })).toBeVisible();
  await page
    .getByLabel("我確認客戶已簽署上述正式報價版本", { exact: true })
    .check();
  await page.getByRole("button", { name: "確認客戶已簽", exact: true }).click();
  await expect(page.getByText("客戶已簽版本 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "登記付款", exact: true }).click();
  let pay = page.getByRole("dialog");
  await pay.getByLabel("付款金額", { exact: false }).fill("1500");
  await file(pay, "上載付款證明", "首訂證明.svg");
  await pay.getByRole("button", { name: "儲存付款記錄", exact: true }).click();
  await expect(pay).toBeHidden();
  await page.getByRole("button", { name: "提交Office", exact: true }).click();
  await expect(page.getByText("已提交Office", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "封存報價", exact: true }),
  ).toHaveCount(0);
  await role(page, "工程CS");
  await expect(
    page.getByRole("heading", { name: "工程單", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("tbody tr").filter({ hasText: qNumber }),
  ).toHaveCount(0);

  await role(page, "開單員");
  row = page.locator("tbody tr").filter({ hasText: qNumber });
  await row.getByRole("button", { name: "核對收款", exact: true }).click();
  const review = page.getByRole("dialog");
  const proofThumb = review.getByRole("button", {
    name: "開啟 首訂證明.svg",
    exact: true,
  });
  await expect(proofThumb).toBeVisible();
  await expect(proofThumb.locator("img")).toBeVisible();
  const [proofPage] = await Promise.all([
    page.waitForEvent("popup"),
    proofThumb.click(),
  ]);
  await expect(proofPage).toHaveURL(/^blob:/);
  await proofPage.close();
  await review
    .getByRole("button", { name: "確認有效收款", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    row.getByRole("button", { name: "待分類", exact: true }),
  ).toBeDisabled();
  await row
    .getByRole("combobox", { name: `${qNumber} 分類` })
    .selectOption("self-pay");
  await expect(
    row.getByRole("button", { name: /已核對並開單/ }),
  ).toBeEnabled();
  await expect(row).toContainText("HK$30,000.00");
  await row.getByRole("button", { name: /已核對並開單/ }).click();
  await expect(
    page.getByRole("heading", { name: "UI測試新客戶的單據", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "首訂證明", exact: true }),
  ).toBeVisible();
  const invoiceUrl = page.url();

  await role(page, "開單員");
  await page.goto(invoiceUrl);
  await page
    .getByRole("button", { name: "登記第1期 · 第一期訂金", exact: true })
    .click();
  const firstBalance = page.getByRole("dialog", { name: "登記第1期款" });
  await expect(firstBalance.getByLabel("本次收款金額")).toHaveValue("28500");
  await file(firstBalance, "上載付款證明", "銀行首期餘額.svg");
  await firstBalance
    .getByRole("button", { name: "儲存待核對期款", exact: true })
    .click();
  await expect(firstBalance).toBeHidden();
  await page.getByRole("button", { name: "核對收款", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("我已核實公司銀行收到這筆款項", { exact: true })
    .check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "確認有效收款", exact: true })
    .click();

  await role(page, "工程CS");
  await expect(
    page.locator("tbody tr").filter({ hasText: qNumber }),
  ).toHaveCount(0);

  await role(page, "開單員");
  await page.goto(invoiceUrl);
  await page
    .getByRole("button", { name: "登記第2期 · 第二期訂金", exact: true })
    .click();
  const secondPayment = page.getByRole("dialog", { name: "登記第2期款" });
  await expect(secondPayment.getByLabel("本次收款金額")).toHaveValue("20000");
  await file(secondPayment, "上載付款證明", "第二期證明.svg");
  await secondPayment
    .getByRole("button", { name: "儲存待核對期款", exact: true })
    .click();
  await expect(secondPayment).toBeHidden();
  await page.getByRole("button", { name: "核對收款", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("我已核實公司銀行收到這筆款項", { exact: true })
    .check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "確認有效收款", exact: true })
    .click();

  await role(page, "阿花");
  row = page.locator("tbody tr").filter({ hasText: qNumber });
  await expect(row).toBeVisible();
  // CS supervisor can see all engineering orders; contractor Assignment is separate.
  const workOrderNumber = (
    await row.locator("td").first().innerText()
  ).split("\n")[0].trim();
  await page.getByRole("link", { name: "工程管理", exact: true }).click();
  await page
    .locator(".order-rail-row")
    .filter({ hasText: workOrderNumber })
    .click();
  await expect(page.locator(".workorder-head h1")).toHaveText(/^D26\d{5}$/);
  await page.getByRole("button", { name: "安排", exact: true }).first().click();
  await page
    .getByLabel("執行師傅", { exact: false })
    .selectOption("resource-contractor");
  await page.getByRole("button", { name: "儲存安排", exact: true }).click();
  const lineRow = page
    .locator(".engineering-table tbody tr")
    .filter({ hasText: "UI貫穿測試工程" });
  await expect(lineRow).toContainText("Demo 判頭");
  await page.reload();
  await expect(
    page
      .locator(".engineering-table tbody tr")
      .filter({ hasText: "UI貫穿測試工程" }),
  ).toContainText("Demo 判頭");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("homeflow-state-v1")!),
  );
  const quote = stored.quotes.find((q: any) => q.number === qNumber);
  const invoices = stored.invoices.filter((i: any) => i.quoteId === quote.id);
  expect(invoices).toHaveLength(1);
  expect(invoices[0].number).toMatch(/^DNMM2610\d{4}$/);
  expect(invoices[0].category).toBe("self-pay");
  expect(stored.orders.filter((o: any) => o.quoteId === quote.id)).toHaveLength(
    1,
  );
  expect(errors).toEqual([]);
});
test("兩Sales範圍隔離與Pad／手機入口不溢出", async ({ page }) => {
  await page.goto("/");
  await role(page, "嘉嘉B KK");
  await page.goto("/quotes/quote-pending-office");
  await expect(
    page.getByRole("heading", { name: "沒有這張報價的查看權限" }),
  ).toBeVisible();
  await page.goto("/customers");
  await expect(
    page.getByRole("button", { name: "新增客戶", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新增客戶", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "新增客戶" })).toBeVisible();
  await page.getByRole("button", { name: "關閉對話框", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/quotes/new");
  await expect(
    page.getByRole("heading", { name: "建立報價", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "儲存草稿", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
