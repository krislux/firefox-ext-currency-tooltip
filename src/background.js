// Temporary add-ons loaded via about:debugging have installType "development". Stored so content scripts
// can read it; the old "@temporary-addon" ID check stops working once the manifest has a fixed add-on ID.
browser.management.getSelf().then(({installType}) => {
    browser.storage.local.set({debugging: installType === 'development'});
});

// Fetches conversion rates for content scripts. The URL is built here rather than accepted from the
// message, so this can't be used as a general-purpose fetch proxy.
browser.runtime.onMessage.addListener(async ({apiKey, base}) => {
    if (typeof apiKey !== 'string' || !/^[A-Z]{3}$/.test(base)) {
        throw new Error('Currency extension: invalid rate request');
    }

    const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/${base}`;
    const response = await fetch(url);
    return response.json();
});
