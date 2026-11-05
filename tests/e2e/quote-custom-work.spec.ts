import { expect, test } from "@playwright/test";

test("Sales新增工程popup顯示自訂工程及發給工程部報價UI", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "文文B MM" }).first().click();
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "新增工程", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "新增工程項目" })).toBeVisible();
  const input = page.getByLabel("自訂工程內容");
  await expect(input).toBeVisible();
  await expect(
    page.getByText(
      "本項目需要工程部提供實質價錢後，才可以再報給客人",
      { exact: true },
    ),
  ).toBeVisible();
  const submit = page.getByRole("button", {
    name: "發給工程部報價",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await input.fill("訂造特色電視櫃");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(
    page.getByText("此功能將於下一步接駁工程部報價流程。", {
      exact: true,
    }),
  ).toBeVisible();
});
