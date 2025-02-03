async function loadConversions() {
    console.info('Currency extension: Loading conversion rates from web');

    try {
        const apiKey = await browser.storage.local.get('apiKey');
        const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey.apiKey}/latest/DKK`;

        if (!apiKey) {
            throw new Error('Currency extension: API key not found. Set in extension options before use.');
        }

        const response = await browser.runtime.sendMessage({
            url: apiUrl
        });
        return response.conversion_rates;
    } catch (error) {
        console.error(error);
        return [];
    }
}

async function findCurrencies(currencyTable) {
    const currencyRegex = /(\$|€)\s?\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s?(\$|€)/g;

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                return node.nodeValue.match(currencyRegex)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            }
        },
        false
    );

    let node;
    while (node = walker.nextNode()) {
        const match = node.textContent.match(/(\$|€)?\s*(\d+(?:[.,]\d{1,2})?)\s*(\$|€)?/);
        if (!match) continue;

        let [, symbolBefore, value, symbolAfter] = match;
        let symbol = symbolBefore || symbolAfter;

        if (!value || !symbol) continue;

        if (symbol === '€') symbol = 'EUR';
        if (symbol === '$') symbol = 'USD';

        value = parseFloat(value.replace(',', '.'));

        const conversionRate = currencyTable[symbol];

        if (conversionRate) {
            const convertedValue = (value / conversionRate).toFixed(2);
            node.parentElement.setAttribute('title', '≈ ' + convertedValue + ' DKK');

            node.parentElement.style.textDecoration = 'underline dotted #f00c';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const t1 = (new Date).getTime();
    console.info('Currency extension. Loaded');

    const currencyTable = JSON.parse(sessionStorage.getItem('currencyTable')) || await loadConversions();
    sessionStorage.setItem('currencyTable', JSON.stringify(currencyTable));

    findCurrencies(currencyTable);
    const t2 = (new Date).getTime();
    console.info('Currency extension. Took: ' + (t2 - t1) + ' ms');
});