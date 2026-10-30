import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("報價尺寸可切換呎／寸並即時換算", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "文文B MM");
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "新增工程", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "新增工程項目" });
  await picker.getByPlaceholder("搜尋工程名稱").fill("廚房牆身/地台 清拆打鑿");
  await page
    .locator(".service-option")
    .filter({ hasText: "廚房牆身/地台 清拆打鑿" })
    .first()
    .click();

  const line = page.locator(".line-card");
  const unit = line.getByLabel("單位", { exact: false });
  await expect(unit).toHaveValue("呎");
  await line.getByLabel("長度", { exact: false }).fill("8");
  await line.getByLabel("闊度", { exact: false }).fill("1");
  await unit.selectOption("寸");
  await expect(line.getByLabel("長度", { exact: false })).toHaveValue("96");
  await expect(line.getByLabel("闊度", { exact: false })).toHaveValue("12");
  await expect(line.locator(".measurement-conversion")).toContainText("8 × 1");
  await unit.selectOption("呎");
  await expect(line.getByLabel("長度", { exact: false })).toHaveValue("8");
  await expect(line.getByLabel("闊度", { exact: false })).toHaveValue("1");

  await line.getByRole("button", { name: "選擇產品款式", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "選擇產品款式" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
