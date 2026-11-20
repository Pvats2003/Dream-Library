import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, phone: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.locator("#phone").fill(phone);
  await page.getByRole("button", { name: "कोड भेजें" }).click();
  await page.locator("#code").fill("123456");
  await expect(page).toHaveURL(/\/today$/, { timeout: 20_000 });
}

test("logged-out visitors land on the welcome screen", async ({ page }) => {
  await page.goto("/fees");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("button", { name: /हिंदी/ })).toBeVisible();
});

test("a wrong number is caught before sending", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#phone").fill("12345");
  await expect(page.getByRole("button", { name: "कोड भेजें" })).toBeDisabled();
});

test("a wrong code shows a clear message", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await page.locator("#phone").fill("9999900009");
  await page.getByRole("button", { name: "कोड भेजें" }).click();
  await page.locator("#code").fill("000000");
  await expect(page.locator("#login-error")).toContainText("कोड गलत है");
});

test("owner logs in with OTP and sees money on Today", async ({ page }) => {
  await login(page, "9999900001");
  await expect(page.getByText("आज की कमाई")).toBeVisible();
  await expect(page.getByText(/₹[\d,]+/).first()).toBeVisible();
  for (const tab of ["सीट", "स्टूडेंट", "फीस", "और"]) {
    await page.getByRole("link", { name: tab, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("desk staff never see rupee totals on Today", async ({ page }) => {
  await login(page, "9999900003");
  await expect(page.getByText("आज के पेमेंट")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("₹");
});

test("logging out returns to welcome", async ({ page }) => {
  await login(page, "9999900002");
  await page.goto("/more");
  await page.getByRole("button", { name: "लॉग आउट" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
});
