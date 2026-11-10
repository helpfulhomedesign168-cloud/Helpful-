import { expect, test } from "@playwright/test";

test("全站新外殼：topbar logo、橙色active nav、mobile drawer", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "SuperAdmin" }).first().click();
  await page.waitForTimeout(200);
  await expect(page.locator(".app-brand img")).toBeVisible();
  await expect(page.locator(".app-topbar")).toBeVisible();
  await expect(page.locator(".nav-item.active")).toHaveCSS(
    "background-color",
    "rgb(255, 102, 0)",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/users");
  await expect(page.locator(".app-brand")).toBeHidden();
  const menu = page.getByRole("button", { name: "開啟選單" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.locator("#app-sidebar")).toHaveClass(/sidebar-open/);
  await expect(page.locator(".sidebar-scrim")).toBeVisible();
  await page.locator(".sidebar-close").click();
  await expect(page.locator("#app-sidebar")).not.toHaveClass(/sidebar-open/);
});
