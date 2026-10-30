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
  const invoiceNumber = (
    await page.locator(".page-head .eyebrow").innerText()
  )
    .split(" · ")[0]
    .trim();
  expect(invoiceNumber).toMatch(/A$/);

  await page.getByRole("link", { name: "市政單", exact: true }).click();
  await expect(page.getByRole("heading", { name: "市政單", exact: true })).toBeVisible();
  const municipalRow = page.locator(".municipal-table tbody tr").first();
  const municipalNumber = (await municipalRow.locator("strong").first().innerText()).trim();
  const principalNumber = (await municipalRow.locator("td").nth(1).innerText()).trim();
  expect(principalNumber).toBe(invoiceNumber);
  expect(principalNumber).toMatch(/A$/);
  expect(municipalNumber).toBe(invoiceNumber.replace(/A$/, "B"));
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

test("開單員可開啟完整報價編輯器並建立更正版本", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "開單員");
  await page.goto("/submissions");
  await page.getByRole("button", { name: /編輯QSHMM26100004報價單/ }).click();
  await expect(page).toHaveURL(/\/quotes\/quote-pending-office\/edit$/);
  await expect(
    page.getByText("開單員更正模式", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("客戶姓名", { exact: false }).fill("李好波更正");
  const line = page.locator(".line-card").first();
  const length = line.getByLabel("長度", { exact: false });
  if (await length.count()) await length.fill("9");
  await page
    .getByLabel("修改原因", { exact: false })
    .fill("開單員更正測試");
  await page.getByRole("button", { name: "儲存更正", exact: true }).first().click();
  await expect(page).toHaveURL(/\/submissions$/);
  await expect(
    page.locator(".submission-table tbody tr").filter({ hasText: "李好波更正" }),
  ).toBeVisible();
});
