let selectedCurrency = 'DKK';

const symbolTable = {
    '€': 'EUR',
    '$': 'USD',
    '£': 'GBP',
};

async function loadConversions() {
    console.info('Currency extension: Loading conversion rates from web');

    try {
        const apiKey = await browser.storage.local.get('apiKey');
        const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey.apiKey}/latest/${selectedCurrency}`;

        if (! apiKey.apiKey) {
            const msg = 'Currency extension: API key not found. Set in extension options before use.';

            addElement({
                tag: 'div',
                text: msg,
                css: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    background: '#c00',
                    color: '#fff',
                    padding: '10px',
                    textAlign: 'center',
                    zIndex: 1000
                }
            });

            throw new Error(msg);
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

        for (let key in symbolTable) {
            if (symbol === key) {
                symbol = symbolTable[key];
                break;
            }
        }

        value = parseFloat(value.replace(',', '.'));

        const conversionRate = currencyTable[symbol];

        if (conversionRate) {
            const convertedValue = (value / conversionRate).toFixed(2);
            node.parentElement.setAttribute('title', `≈ ${convertedValue} ${selectedCurrency}`);

            node.parentElement.style.textDecoration = 'underline dotted #f00c';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    selectedCurrency = (await browser.storage.local.get('currency')).currency;
    console.info('Currency extension. Selected currency: ' + selectedCurrency);

    const t1 = (new Date).getTime();
    console.info('Currency extension. Loaded');

    let currencyTable;
    const currencyNotChanged = sessionStorage.getItem('storedCurrency') === selectedCurrency

    if (currencyNotChanged) {
        currencyTable = JSON.parse(sessionStorage.getItem('currencyTable'));
    } else {
        currencyTable = await loadConversions();
    }

    if (! currencyTable) {
        throw new Error('Currency extension: No conversion rates found. Check API key and internet connection.');
    }

    sessionStorage.setItem('currencyTable', JSON.stringify(currencyTable));
    sessionStorage.setItem('storedCurrency', selectedCurrency);

    findCurrencies(currencyTable);
    const t2 = (new Date).getTime();
    console.info('Currency extension. Took: ' + (t2 - t1) + ' ms');
});