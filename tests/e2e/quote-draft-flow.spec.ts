import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

async function addKitchenDemolition(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "新增工程", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "新增工程項目" });
  await picker.getByPlaceholder("搜尋工程名稱").fill("廚房牆身/地台 清拆打鑿");
  await page
    .locator(".service-option")
    .filter({ hasText: "廚房牆身/地台 清拆打鑿" })
    .first()
    .click();
  const line = page.locator(".line-card").first();
  await line.getByLabel("闊度", { exact: false }).fill("10");
  await line.getByLabel("高度", { exact: false }).fill("2");
}

test("草稿會按Step 1／2／3／4重開並進入正確列表", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "文文B MM");
  await page.goto("/quotes/new");
  await page.getByLabel("客戶姓名", { exact: false }).fill("草稿流程客戶");
  await page.getByLabel(/^聯絡電話/).fill("91234567");
  await page.getByLabel(/^WhatsApp電話/).fill("91234567");
  await page.getByLabel("工程地區", { exact: false }).selectOption("黃大仙");
  await page.getByLabel(/^屋苑／大廈/).fill("草稿苑");
  await page.getByLabel(/^樓層/).fill("8");
  await page.getByLabel(/^單位/).fill("A");

  // Step 1 return offers save draft.
  await page.getByRole("button", { name: "返回", exact: true }).click();
  const exit = page.getByRole("dialog", { name: "儲存草稿？" });
  await expect(exit).toBeVisible();
  await exit.getByRole("button", { name: "儲存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\?tab=draft/);
  const draftRow = page
    .locator("tbody tr")
    .filter({ hasText: "草稿流程客戶" });
  await expect(draftRow).toBeVisible();
  await draftRow.locator("a.source-link").click();
  await expect(page).toHaveURL(/\/quotes\/.+\/edit\?step=1/);
  await expect(page.getByLabel("客戶姓名", { exact: false })).toHaveValue(
    "草稿流程客戶",
  );

  // Step 2 save draft resumes Step 2.
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await addKitchenDemolition(page);
  await page.getByRole("button", { name: "儲存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\?tab=draft/);
  await page
    .locator("tbody tr")
    .filter({ hasText: "草稿流程客戶" })
    .locator("a.source-link")
    .click();
  await expect(page).toHaveURL(/\/quotes\/.+\/edit\?step=2/);
  await expect(
    page.getByRole("button", { name: "新增工程", exact: true }),
  ).toBeVisible();

  // Step 3 save draft resets print selections, no preview.
  await page.getByRole("button", { name: /下一步：列印簽署/ }).click();
  await expect(
    page.getByRole("heading", { name: "3. 列印簽署", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "報價詳情", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "儲為草稿", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/quotes\?tab=draft/);
  await page
    .locator("tbody tr")
    .filter({ hasText: "草稿流程客戶" })
    .locator("a.source-link")
    .click();
  await expect(page).toHaveURL(/\/quotes\/.+\/handoff$/);
  await expect(
    page.getByRole("heading", { name: "3. 列印簽署", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "預覽報價單", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("當日主管", { exact: false })).toHaveValue("");

  // Step 4 marks the quote as pending submission and resumes Step 4.
  await page.getByLabel("當日主管", { exact: false }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "自費", exact: true }).click();
  await page.getByRole("button", { name: "預覽報價單", exact: true }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "4. 遞交office", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "待提交", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\?tab=pending/);
  const pendingRow = page
    .locator("tbody tr")
    .filter({ hasText: "草稿流程客戶" });
  await expect(pendingRow).toBeVisible();
  await pendingRow.locator("a.source-link").click();
  await expect(page).toHaveURL(/\/quotes\/.+\/handoff\?step=4/);
  await expect(
    page.getByRole("heading", { name: "4. 遞交office", exact: true }),
  ).toBeVisible();
});
