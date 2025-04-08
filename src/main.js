const debugging = /@temporary-addon$/.test(browser.runtime.id);

// Local Test Mode (avoids API calls, works completely offline)
const localTestMode = debugging;

const logging = debugging;

// Cache currency table for 24 hours
const cacheMinutes = 60 * 24;

let selectedCurrency = 'DKK';
let decorateFound = true;

const symbolTable = {
    '€': 'EUR',
    '$': 'USD',
    '£': 'GBP',
};

let popup = null;

/**
 * Load conversion rates from external API.
 *
 * @return {Promise<Object>} - The conversion rates.
 */
async function loadConversions() {
    let currencyData = await getConfig('cachedCurrencyData');
    let cachedTime = await getConfig('cachedTime');

    if (localTestMode === true) {
        log('Using fixed debug conversion rates');
        return {
            DKK: 1,
            EUR: 1/7.5,
            USD: 1/6.5,
            GBP: 1/8.5,
        };
    }

    if (cachedTime && Date.now() - cachedTime < 1000 * 60 * cacheMinutes) {
        log('Using cached conversion rates');
        return currencyData;
    }

    log('Loading conversion rates from web');

    try {
        const apiKey = await getConfig('apiKey');
        const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${selectedCurrency}`;

        if (! apiKey) {
            const msg = 'Currency extension: API key not found. Set in extension options before use.';

            // Show error message on page
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

        currencyData = response.conversion_rates;

        browser.storage.local.set({
            cachedCurrencyData: currencyData,
            cachedTime: Date.now()
        });

        return currencyData;
    } catch (error) {
        console.error(error);
        return {};
    }
}

/**
 * Find and convert currencies in the document.
 *
 * @param {Object} currencyTable - The conversion rates from loadConversions().
 * @return {void}
 */
async function findCurrencies(currencyTable) {
    const currencyRegex = /(\$|€|£)\s{0,1}?\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s{0,1}?(\$|€|£)/g;

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
    let elementQueue = [];
    while (node = walker.nextNode()) {
        const match = node.textContent.match(/(\$|€|£)?\s?(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?)\s?(\$|€|£)?/);
        if (! match) {
            continue;
        }

        const [, symbolBefore, value, symbolAfter] = match;
        let symbol = symbolBefore || symbolAfter;

        if (!value || !symbol) {
            continue;
        }

        for (let key in symbolTable) {
            if (symbol === key) {
                symbol = symbolTable[key];
                break;
            }
        }

        const parsedValue = parseValue(value);

        const conversionRate = currencyTable[symbol];

        if (conversionRate) {
            const convertedValue = (parsedValue / conversionRate).toFixed(2);

            // Add the node to a queue to avoid changing the tree while iterating
            elementQueue.push({node, match, convertedValue});
        }
    }

    // Iterate over the queue and replace the text nodes with new elements
    elementQueue.forEach(addTooltipToElement);
}

function addTooltipToElement({node, match, convertedValue}) {
    const parent = node.parentElement;
    // Create a new span element to wrap the matched text
    const span = document.createElement('span');
    span.textContent = match[0];
    if (decorateFound) {
        span.style.textDecoration = 'underline dotted #f00c';
    }
    span.style.position = 'relative';

    // Replace the matched text with the new span element
    const beforeText = document.createTextNode(node.nodeValue.slice(0, match.index));
    const afterText = document.createTextNode(node.nodeValue.slice(match.index + match[0].length));
    parent.insertBefore(beforeText, node);
    parent.insertBefore(span, node);
    parent.insertBefore(afterText, node);
    parent.removeChild(node);

    const mouseCatcher = addElement({
        parent: span,
        tag: 'div',
        css: {
            position: 'absolute',
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 9998,
            pointerEvents: 'auto',
        }
    });
    mouseCatcher.addEventListener('mouseover', event => {
        showPopup(event, `≈ ${convertedValue} ${selectedCurrency}`);
    });
    mouseCatcher.addEventListener('mouseout', () => {
        popup.style.display = 'none';
    });
}

function parseValue(stringValue) {
    const valueParts = stringValue.split(',');
    let parsedValue = stringValue;

    if (valueParts.length === 2 && valueParts[1].length < 3) {
        parsedValue = stringValue.replace(',', '.');
    }

    parsedValue = parseFloat(parsedValue.replaceAll(',', ''));

    return parsedValue;
}

function showPopup(event, text) {
    if (!popup) {
        popup = addElement({
            tag: 'div',
            css: {
                position: 'fixed',
                top: 0,
                left: 0,
                background: '#333',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '5px',
                zIndex: 9999,
                pointerEvents: 'none',
                font: '14px sans-serif'
            }
        });
    }

    popup.textContent = text;
    popup.style.top = (event.clientY + 10) + 'px';
    popup.style.left = (event.clientX + 10) + 'px';
    popup.style.display = 'block';
}

async function getConfig(key) {
    return (await browser.storage.local.get(key))[key];
}

function log(text) {
    if (logging) {
        console.info('Currency extension: ', text);
    }
}

async function inDomainWhitelist() {
    // local file
    if (debugging && window.location.hostname === '') return true;

    const whitelist = (await getConfig('whitelist')) || [];
    const domain = window.location.hostname.replace(/^(www\.)/, '');
    return whitelist.some(item => new RegExp(`(^|://|\\.)${item.replace('.', '\\.')}$`).test(domain));
}

window.addEventListener('load', async () => {
    const inWhitelist = await inDomainWhitelist();
    log('In whitelist: ' + inWhitelist);
    if (!inWhitelist) return;

    selectedCurrency = (await getConfig('currency')) || selectedCurrency;
    decorateFound = !!await getConfig('decorate');

    log('Selected currency: ' + selectedCurrency);

    const t1 = (new Date).getTime();

    let currencyTable;
    currencyTable = await loadConversions();

    if (! currencyTable) {
        throw new Error('Currency extension: No conversion rates found. Check API key and internet connection.');
    }

    findCurrencies(currencyTable);

    const t2 = (new Date).getTime();
    log('Took: ' + (t2 - t1) + ' ms');
});
