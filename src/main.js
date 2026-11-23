const debugging = /@temporary-addon$/.test(browser.runtime.id);

// Local Test Mode (avoids API calls, works completely offline)
const localTestMode = false;

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
    let cachedBase = await getConfig('cachedBase');

    if (localTestMode === true) {
        log('Using fixed debug conversion rates');
        return {
            DKK: 1,
            EUR: 1/7.5,
            USD: 1/6.5,
            GBP: 1/8.5,
        };
    }

    // Rates are relative to the selected currency, so the cache is only valid for the same base
    if (currencyData && cachedBase === selectedCurrency
        && cachedTime && Date.now() - cachedTime < 1000 * 60 * cacheMinutes) {
        log('Using cached conversion rates');
        return currencyData;
    }

    log('Loading conversion rates from web');

    try {
        const apiKey = await getConfig('apiKey');
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
            apiKey,
            base: selectedCurrency
        });

        // Don't cache failed responses (invalid key, quota exceeded etc.)
        if (response?.result !== 'success' || !response.conversion_rates) {
            throw new Error('Currency extension: API error: ' + (response?.['error-type'] || 'unknown'));
        }

        currencyData = response.conversion_rates;

        browser.storage.local.set({
            cachedCurrencyData: currencyData,
            cachedBase: selectedCurrency,
            cachedTime: Date.now()
        });

        return currencyData;
    } catch (error) {
        console.error(error);
        return {};
    }
}

// Attribute marking elements created or already handled by this extension
const MARKER = 'data-currency-tooltip';

// Number with optional thousands/decimal separators, plus "19,--" / "19,-" style whole prices
const NUMBER_PATTERN = String.raw`\d+(?:[.,]\d+)*(?:[.,]-{1,2})?`;
const SYMBOL_PATTERN = String.raw`[$€£]`;

// Every price needs a symbol on one side. Groups: 1 = symbol before, 2 = value, 3 = value, 4 = symbol after
const PRICE_SOURCE = `(${SYMBOL_PATTERN})\\s?(${NUMBER_PATTERN})|(${NUMBER_PATTERN})\\s?(${SYMBOL_PATTERN})`;
const priceRegex = new RegExp(PRICE_SOURCE, 'g');
const hasPriceRegex = new RegExp(PRICE_SOURCE);
const exactPriceRegex = new RegExp(`^\\s*(?:${PRICE_SOURCE})\\s*$`);
const symbolOnlyRegex = new RegExp(`^\\s*${SYMBOL_PATTERN}\\s*$`);

// Text inside these is never touched
const SKIP_SELECTOR = `script, style, noscript, textarea, template, [contenteditable], [${MARKER}]`;

// How many ancestors to check when a price is split across elements, e.g. <span>$</span><span>19.99</span>
const splitPriceMaxDepth = 3;

/**
 * Find and convert currencies in a subtree.
 *
 * @param {Node} root - Element or text node to search.
 * @param {Object} currencyTable - The conversion rates from loadConversions().
 * @return {void}
 */
function findCurrencies(root, currencyTable) {
    const textNodes = [];

    const accept = node => {
        const text = node.nodeValue;
        if (!hasPriceRegex.test(text) && !symbolOnlyRegex.test(text)) {
            return NodeFilter.FILTER_SKIP;
        }
        // Only checked for nodes that look like prices, so the closest() lookup stays cheap
        if (!node.parentElement || node.parentElement.closest(SKIP_SELECTOR)) {
            return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
    };

    if (root.nodeType === Node.TEXT_NODE) {
        if (accept(root) === NodeFilter.FILTER_ACCEPT) {
            textNodes.push(root);
        }
    } else {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: accept});
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
    }

    // Modify the tree only after walking it
    for (const node of textNodes) {
        if (symbolOnlyRegex.test(node.nodeValue)) {
            handleSplitPrice(node, currencyTable);
        } else {
            wrapPricesInTextNode(node, currencyTable);
        }
    }
}

/**
 * Convert a regex match from priceRegex/exactPriceRegex to a tooltip text, or null if unsupported.
 */
function convertMatch(match, currencyTable) {
    const symbol = match[1] || match[4];
    const value = match[2] || match[3];
    const conversionRate = currencyTable[symbolTable[symbol]];

    if (!conversionRate) {
        return null;
    }

    const parsedValue = parseValue(value);
    if (!isFinite(parsedValue)) {
        return null;
    }

    return '≈ ' + formatCurrency(parsedValue / conversionRate);
}

/**
 * Wrap every price in a text node in its own span with a tooltip.
 */
function wrapPricesInTextNode(node, currencyTable) {
    const text = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let found = false;

    for (const match of text.matchAll(priceRegex)) {
        const tooltip = convertMatch(match, currencyTable);
        if (!tooltip) continue;

        found = true;
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

        const span = document.createElement('span');
        span.textContent = match[0];
        fragment.appendChild(span);
        attachTooltip(span, tooltip);

        lastIndex = match.index + match[0].length;
    }

    if (!found) return;

    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode.replaceChild(fragment, node);
}

/**
 * A text node containing only a currency symbol may be part of a price split across elements,
 * e.g. Amazon's <span>$</span><span>19<span>.</span></span><span>99</span>.
 * Look a few ancestors up for an element whose full text is exactly one price.
 */
function handleSplitPrice(node, currencyTable) {
    let element = node.parentElement;

    for (let depth = 0; element && depth < splitPriceMaxDepth; depth++, element = element.parentElement) {
        if (element === document.body || element.closest(SKIP_SELECTOR)) return;

        const match = element.textContent.replace(/\s+/g, ' ').match(exactPriceRegex);
        if (match) {
            const tooltip = convertMatch(match, currencyTable);
            if (tooltip) {
                attachTooltip(element, tooltip);
            }
            return;
        }
    }
}

/**
 * Mark an element as a found price and show the converted value on hover.
 */
function attachTooltip(element, tooltip) {
    element.setAttribute(MARKER, '');

    if (decorateFound) {
        element.style.textDecoration = 'underline dotted #f00c';
    }

    // Only reposition elements that aren't already positioned, to avoid breaking site layouts
    if (element.isConnected ? getComputedStyle(element).position === 'static' : !element.style.position) {
        element.style.position = 'relative';
    }

    // Transparent overlay with a high z-index, so the tooltip still works if the site covers the price
    const mouseCatcher = addElement({
        parent: element,
        tag: 'span',
        css: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9998,
            pointerEvents: 'auto',
        }
    });
    mouseCatcher.setAttribute(MARKER, '');
    mouseCatcher.addEventListener('mouseover', event => {
        showPopup(event, tooltip);
    });
    mouseCatcher.addEventListener('mouseout', () => {
        if (popup) popup.style.display = 'none';
    });
}

/**
 * Parse a price string in either US (1,299.00) or European (1.299,00) format.
 * A final separator followed by 1-2 digits is the decimal point; all other separators are thousands separators.
 */
function parseValue(stringValue) {
    const value = stringValue.replace(/[.,]-{1,2}$/, '');
    const lastSeparator = Math.max(value.lastIndexOf('.'), value.lastIndexOf(','));

    if (lastSeparator !== -1 && value.length - lastSeparator - 1 <= 2) {
        const whole = value.slice(0, lastSeparator).replace(/[.,]/g, '');
        return parseFloat(whole + '.' + value.slice(lastSeparator + 1));
    }

    return parseFloat(value.replace(/[.,]/g, ''));
}

/**
 * Format an amount in the selected currency using the browser's locale, e.g. "148,05 kr." for Danish.
 */
function formatCurrency(amount) {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: selectedCurrency}).format(amount);
    } catch (error) {
        // Unknown currency code
        return `${amount.toFixed(2)} ${selectedCurrency}`;
    }
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
        // Popup text can itself look like a price (e.g. "≈ €19.99"), so mark it to be skipped
        popup.setAttribute(MARKER, '');
    }

    popup.textContent = text;
    popup.style.top = (event.clientY + 10) + 'px';
    popup.style.left = (event.clientX + 10) + 'px';
    popup.style.display = 'block';
}

/**
 * Watch for content added after the initial scan (infinite scroll, carousels, tab switches etc.).
 * Only the added/changed nodes are scanned, in batches.
 */
function observeChanges(currencyTable) {
    const pending = new Set();
    let scheduled = false;

    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
                pending.add(mutation.target);
            } else {
                mutation.addedNodes.forEach(node => pending.add(node));
            }
        }

        if (pending.size && !scheduled) {
            scheduled = true;
            requestIdleCallback(flush, {timeout: 500});
        }
    });

    const options = {childList: true, subtree: true, characterData: true};

    function flush() {
        scheduled = false;
        const nodes = [...pending];
        pending.clear();

        for (const node of nodes) {
            if (node.isConnected && (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE)) {
                findCurrencies(node, currencyTable);
            }
        }

        // Discard the mutations caused by our own changes. This runs synchronously, so no site changes are lost.
        observer.takeRecords();
    }

    observer.observe(document.body, options);
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

    const whitelist = ((await getConfig('whitelist')) || []).map(item => item.trim().toLowerCase()).filter(Boolean);

    if (whitelist.length === 0) return true;

    const domain = window.location.hostname.toLowerCase().replace(/^www\./, '');
    // Match the domain itself and all subdomains
    return whitelist.some(item => domain === item || domain.endsWith('.' + item));
}

async function init() {
    const inWhitelist = await inDomainWhitelist();
    log('In whitelist: ' + inWhitelist);
    if (!inWhitelist) return;

    selectedCurrency = (await getConfig('currency')) || selectedCurrency;
    decorateFound = (await getConfig('decorate')) !== false;

    log('Selected currency: ' + selectedCurrency);

    const t1 = performance.now();

    const currencyTable = await loadConversions();

    if (!currencyTable || Object.keys(currencyTable).length === 0) {
        console.error('Currency extension: No conversion rates found. Check API key and internet connection.');
        return;
    }

    findCurrencies(document.body, currencyTable);
    observeChanges(currencyTable);

    log('Took: ' + Math.round(performance.now() - t1) + ' ms');
}

// Content script runs at document_end, so the DOM is ready. No need to wait for images etc. to load,
// as content added later is picked up by the MutationObserver.
init();
