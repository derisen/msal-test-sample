import * as puppeteer from "puppeteer";

export type tokenMap = {
    idTokens: string[],
    accessTokens: string[],
    refreshTokens: string[]
};

export class BrowserCacheUtils {
    private page: puppeteer.Page;
    private storageType: string;

    constructor(page: puppeteer.Page, storageType: string) {
        this.page = page;
        this.storageType = storageType;
    }

    getWindowStorage(): Promise<Storage> {
        if (this.storageType === "localStorage") {
            return this.page.evaluate(() =>  Object.assign({}, window.localStorage));
        } else {
            return this.page.evaluate(() => Object.assign({}, window.sessionStorage));
        }
    }

    async getTokens(): Promise<tokenMap> {
        const storage = await this.getWindowStorage();

        const tokenKeys: tokenMap = {
            idTokens: [],
            accessTokens: [],
            refreshTokens: []
        };

        Object.keys(storage).forEach(async key => {
            if (key.includes("idtoken") && BrowserCacheUtils.validateToken(storage[key], "IdToken")) {
                tokenKeys.idTokens.push(key);
            } else if (key.includes("accesstoken") && (BrowserCacheUtils.validateToken(storage[key], "AccessToken") || BrowserCacheUtils.validateToken(storage[key], "AccessToken_With_AuthScheme"))) {
                tokenKeys.accessTokens.push(key);
            } else if (key.includes("refreshtoken") && BrowserCacheUtils.validateToken(storage[key], "RefreshToken")) {
                tokenKeys.refreshTokens.push(key);
            }
        });

        return tokenKeys;
    }

    static validateToken(rawTokenVal: string, tokenType: String): boolean {
        const tokenVal = JSON.parse(rawTokenVal);

        if (
            !BrowserCacheUtils.validateStringField(tokenVal.clientId) ||
            !BrowserCacheUtils.validateStringField(tokenVal.credentialType) ||
            !BrowserCacheUtils.validateStringField(tokenVal.environment) ||
            !BrowserCacheUtils.validateStringField(tokenVal.homeAccountId) ||
            !BrowserCacheUtils.validateStringField(tokenVal.secret) ||
            tokenVal.credentialType !== tokenType
        ) {
            return false;
        }

        if (tokenType === "IdToken" && typeof(tokenVal.realm) !== "string") {
            return false;
        } else if (tokenType === "AccessToken") {
            if (
                !BrowserCacheUtils.validateStringField(tokenVal.cachedAt) ||
                    !BrowserCacheUtils.validateStringField(tokenVal.expiresOn) ||
                    !BrowserCacheUtils.validateStringField(tokenVal.extendedExpiresOn) ||
                    !BrowserCacheUtils.validateStringField(tokenVal.target)
            ) {
                return false;
            }
        } else if (tokenType === "AccessToken_With_AuthScheme") {
            if (
                !BrowserCacheUtils.validateStringField(tokenVal.keyId) ||
                !BrowserCacheUtils.validateStringField(tokenVal.tokenType)
            ) {
                return false;
            }
        }

        return true;
    }

    static validateStringField(field: any): boolean {
        return typeof(field) === "string" && field.length > 0;
    }

    async accessTokenForScopesExists(accessTokenKeys: Array<string>, scopes: Array<String>): Promise<boolean> {
        const storage = await this.getWindowStorage();

        return accessTokenKeys.some((key) => {
            const tokenVal = JSON.parse(storage[key]);
            const tokenScopes = tokenVal.target.toLowerCase().split(" ");

            return scopes.every((scope) => {
                return tokenScopes.includes(scope.toLowerCase());
            });
        });
    }

    async expireAccessTokens(accessTokenKeys: Array<string>): Promise<void> {
      const storage = await this.getWindowStorage();

      accessTokenKeys.some((key) => {
          const tokenVal = JSON.parse(storage[key]);
          console.log(tokenVal);
      });

      // tokenKeys.forEach((atKey: string) => {
      //   deserializedCache.accessTokens[atKey].expiresOn = "0";
      //   deserializedCache.accessTokens[atKey].extendedExpiresOn = "0";
      // }});
    }


    async removeTokens(tokens: Array<string>): Promise<void> {
        if (this.storageType === "localStorage") {
            await Promise.all(tokens.map(async (tokenKey) => {
                await this.page.evaluate((key) => window.localStorage.removeItem(key), tokenKey);
            }));
        } else {
            await Promise.all(tokens.map(async (tokenKey) => {
                await this.page.evaluate((key) => window.sessionStorage.removeItem(key), tokenKey);
            }));
        }
    }

    async getAccountFromCache(idTokenKey: string): Promise<Object|null> {
        const storage = await this.getWindowStorage();
        const tokenVal = JSON.parse(storage[idTokenKey]);
        const accountKey = tokenVal.homeAccountId + "-" + tokenVal.environment + "-" + tokenVal.realm;

        if (Object.keys(storage).includes(accountKey)) {
            return JSON.parse(storage[accountKey]);
        }
        return null;
    }
}
