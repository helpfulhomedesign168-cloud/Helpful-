import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("8萬資助開Invoice會建立正單A及可修改市政單B", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "開單員");
  await page.goto("/submissions");
  const row = page.locator("tbody tr").filter({ hasText: "王小虎" });
  await row.getByRole("button", { name: "已核對並開單", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "王小虎的單據", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "市政單", exact: true }).click();
  await expect(page.getByRole("heading", { name: "市政單", exact: true })).toBeVisible();
  const municipalRow = page.locator(".municipal-table tbody tr").first();
  const municipalNumber = (await municipalRow.locator("strong").first().innerText()).trim();
  const principalNumber = (await municipalRow.locator("td").nth(1).innerText()).trim();
  expect(municipalNumber).toMatch(/B$/);
  expect(principalNumber).toMatch(/A$/);
  await municipalRow.getByRole("link", { name: "查看／修改" }).click();
  await expect(page.getByRole("heading", { name: municipalNumber })).toBeVisible();

  await page.getByLabel("第1項名稱").fill("市政測試項目");
  await page.getByLabel("第1項金額").fill("1234");
  await page.getByRole("button", { name: "儲存市政單", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("第1項名稱")).toHaveValue("市政測試項目");
  await expect(page.getByLabel("第1項金額")).toHaveValue("1234");

  await page.goto("/handoff");
  await expect(
    page.locator("tbody tr").filter({ hasText: "市政測試項目" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("開單員可更正已提交報價的客戶聯絡，不改價錢", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "開單員");
  await page.goto("/submissions");
  const row = page.locator("tbody tr").filter({ hasText: "李好波" });
  const original = await row.innerText();
  await page.getByRole("button", { name: /更正QSHMM26100004客戶資料/ }).click();
  const dialog = page.getByRole("dialog", { name: "更正客戶聯絡資料" });
  await dialog.getByLabel("客戶姓名", { exact: false }).fill("李好波更正");
  await dialog.getByLabel("聯絡電話", { exact: false }).fill("90001111");
  await dialog.getByRole("button", { name: "儲存更正", exact: true }).click();
  await expect(page.locator("tbody tr").filter({ hasText: "李好波更正" })).toBeVisible();
  expect(original).toContain("HK$7,000.00");
});
