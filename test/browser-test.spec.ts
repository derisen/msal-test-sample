import "expect-puppeteer";
import * as msal from "@azure/msal-node";
import { BrowserCacheUtils } from './BrowserCacheTestUtils'

require('dotenv').config();

// Credentials
const [username, password] = [process.env.AAD_TEST_USER_USERNAME, process.env.AAD_TEST_USER_PASSWORD]; // Implement an API to get your credentials

const config = {
  auth: {
    clientId: "ffeb3030-cdd7-4c95-8146-f9aa9fb1244a", // Add same ClientId here as in app/authConfig.js
    authority: "https://login.microsoftonline.com/cbaf2168-de14-4c72-9d88-f5f05366dbef/" // Add same tenanted authority here as in app/authConfig.js
  }
};

// Defining the timeout for the test
const timeout = 8000;
let tokenCache: msal.CacheKVStore;
let browserCache: BrowserCacheUtils;

async function setSessionStorage(tokens: msal.CacheKVStore) {
  const cacheKeys = Object.keys(tokenCache);

  for (let key of cacheKeys) {
    const value = JSON.stringify(tokenCache[key]);
    await page.evaluate((key, value) => {
      sessionStorage.setItem(key, value);
    }, key, value);
  };
  await page.reload();
}

beforeAll(async () => {
  const pca = new msal.PublicClientApplication(config);

  const usernamePasswordRequest = {
    scopes: ["user.read"],
    username: username,
    password: password
  };

  await pca.acquireTokenByUsernamePassword(usernamePasswordRequest);
  tokenCache = pca.getTokenCache().getKVStore();

  browserCache = new BrowserCacheUtils(page, 'sessionStorage');

  await page.goto('http://localhost:30662');
});

describe('Tests', () => {
  //   beforeEach(async () => {
  //     let context = await browser.createIncognitoBrowserContext();
  //     let page = await context.newPage();
  //     let BrowserCache = new BrowserCacheUtils(page, 'sessionStorage');
  //     await page.goto('http://localhost:30662');
  // });

  // afterEach(async () => {
  //     await page.evaluate(() =>  Object.assign({}, window.sessionStorage.clear()));
  //     await page.evaluate(() =>  Object.assign({}, window.localStorage.clear()));
  //     await page.close();
  // });

  test('Tests sign-out button is displayed when user is signed-in', async () => {
    let signInButton = await page.$x("//button[contains(., 'Sign In')]");
    let signOutButton = await page.$x("//button[contains(., 'Sign Out')]");
    expect(signInButton.length).toBeGreaterThan(0);
    expect(signOutButton.length).toEqual(0);

    await setSessionStorage(tokenCache);

    signInButton = await page.$x("//button[contains(., 'Sign In')]");
    signOutButton = await page.$x("//button[contains(., 'Sign Out')]");
    expect(signOutButton.length).toBeGreaterThan(0);
    expect(signInButton.length).toEqual(0);

    const tokenStoreBefore = await browserCache.getTokens();
    await browserCache.removeTokens(tokenStoreBefore.refreshTokens);
    await browserCache.removeTokens(tokenStoreBefore.accessTokens);
    const tokenStoreAfter = await browserCache.getTokens();
    expect(tokenStoreAfter.accessTokens.length).toEqual(0);
    expect(tokenStoreAfter.refreshTokens.length).toEqual(0);

    await page.click("#seeProfile");
    await page.waitForSelector("#title-field");

    const tokenStore2 = await browserCache.getTokens();
    expect(tokenStore2.accessTokens.length).toEqual(1);
    expect(tokenStore2.refreshTokens.length).toEqual(1);
  }, timeout);
});
