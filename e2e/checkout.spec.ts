import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Checkout golden-path E2E.
 *
 * Walks a guest user through home → PDP → cart → checkout, fills the
 * shipping address, selects a delivery rate, pays with a Stripe test card,
 * and confirms the order-placed page renders.
 *
 * Backend: e2e-backend/docker-compose.yml (Spree 5.4.3.1 with sample data).
 * Payments: real Stripe test mode (pk_test_...) — card 4242 4242 4242 4242.
 *
 * Run with: npm run e2e:up && npm run test:e2e
 */

const TEST_CARD = "4242424242424242";
const TEST_EMAIL = "e2e-buyer@example.com";

test("guest can complete a checkout with a Stripe test card", async ({
  page,
}) => {
  // 1. Land on the home page (default market: us/en).
  await page.goto("/us/en");
  await expect(page).toHaveTitle(/.+/);

  // 2. Navigate to the products listing and pick the first available product.
  await page.goto("/us/en/products");
  const firstProduct = page.locator('a[href*="/products/"]').first();
  await expect(firstProduct).toBeVisible({ timeout: 15_000 });
  await firstProduct.click();
  await page.waitForURL(/\/products\/[^/]+/);

  // 3. Add to cart from the PDP. The cart drawer opens automatically after
  // the server action resolves and the cart cookie is set — wait for the
  // drawer's Checkout link rather than racing the navigation by going
  // straight to /cart (which would race the cookie write).
  const addToCart = page.getByRole("button", { name: /add to cart/i });
  await expect(addToCart).toBeEnabled({ timeout: 10_000 });
  await addToCart.click();

  const drawerCheckout = page
    .getByRole("dialog")
    .getByRole("link", { name: /^checkout$/i });
  await expect(drawerCheckout).toBeVisible({ timeout: 15_000 });
  await drawerCheckout.click();
  await page.waitForURL(/\/checkout\//);

  // 4. Fill contact + shipping address.
  await page.getByLabel(/email address/i).fill(TEST_EMAIL);
  await fillAddress(page);

  await page.getByRole("button", { name: /continue to delivery/i }).click();

  // 5. Pick the first available shipping rate. Spree sample data ships
  //    with at least one rate for US destinations.
  const firstRate = page.getByRole("radio").first();
  await expect(firstRate).toBeVisible({ timeout: 15_000 });
  await firstRate.check();

  // 6. Pay with a Stripe test card. The Payment Element renders inside a
  //    Stripe-controlled iframe, so we drive it via frameLocator.
  const stripeFrame = page
    .frameLocator('iframe[name^="__privateStripeFrame"]')
    .first();
  await stripeFrame
    .getByPlaceholder("1234 1234 1234 1234")
    .fill(TEST_CARD, { timeout: 30_000 });
  await stripeFrame.getByPlaceholder("MM / YY").fill("12 / 30");
  await stripeFrame.getByPlaceholder("CVC").fill("123");

  // 7. Submit. Pay Now → order-placed page.
  await page.getByRole("button", { name: /pay now|place order/i }).click();
  await page.waitForURL(/\/order-placed\//, { timeout: 60_000 });

  // 8. Confirm the order summary rendered.
  await expect(page.getByText(/order #/i)).toBeVisible();
});

async function fillAddress(page: Page) {
  await safeFill(page.getByLabel(/first name/i), "Test");
  await safeFill(page.getByLabel(/last name/i), "Buyer");
  await safeFill(page.getByLabel(/^address$/i).first(), "123 Test St");
  await safeFill(page.getByLabel(/city/i), "New York");
  await safeFill(page.getByLabel(/zip|postal code/i), "10001");
  await safeFill(page.getByLabel(/phone/i), "5555550100");

  // State/province renders in one of three shapes depending on country +
  // load state in AddressFormFields:
  //   1. enabled  <select> — country has states, list is loaded
  //   2. disabled <select> — country has states, list still loading
  //   3. text     <input>  — country has no states
  // Wait for it to leave the "loading" state, then dispatch by tag.
  const stateField = page.getByLabel(/state|province/i).first();
  if (!(await stateField.isVisible().catch(() => false))) return;

  // Wait out the loading state so we don't try to select on a disabled <select>.
  await stateField
    .evaluate(
      (el) =>
        new Promise<void>((resolve) => {
          const settled = () =>
            !(el as HTMLSelectElement | HTMLInputElement).disabled;
          if (settled()) return resolve();
          const observer = new MutationObserver(() => {
            if (settled()) {
              observer.disconnect();
              resolve();
            }
          });
          observer.observe(el, {
            attributes: true,
            attributeFilter: ["disabled"],
          });
          setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 5_000);
        }),
    )
    .catch(() => undefined);

  const tagName = await stateField.evaluate((el) => el.tagName);
  if (tagName === "SELECT") {
    await stateField.selectOption({ index: 1 });
  } else {
    await stateField.fill("NY");
  }
}

async function safeFill(locator: Locator, value: string) {
  const target = locator.first();
  await expect(target).toBeVisible({ timeout: 10_000 });
  await target.fill(value);
}
