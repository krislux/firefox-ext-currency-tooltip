let selectedCurrency = 'DKK';

document.addEventListener('DOMContentLoaded', async () => {
    selectedCurrency = (await browser.storage.local.get('currency')).currency;

    document.getElementById('apikey-form').addEventListener('submit', async event => {
        event.preventDefault();
        const apiKey = document.getElementById('apiKey').value;
        await browser.storage.local.set({ apiKey });
        updateCurrencyList(apiKey);

        notify('API key saved');
    });

    document.getElementById('options-form').addEventListener('submit', async event => {
        event.preventDefault();
        browser.storage.local.set({currency: document.getElementById('currency-list').value});
        browser.storage.local.set({decorate: document.getElementById('decorate-found').checked});

        let whitelist = [];
        document.getElementById('domain-whitelist').value.split(/[\r\n]+/g).forEach(domain => {
            // Add domain to whitelist, trimming whitespace and http(s):// and www.
            if (domain.trim().length === 0) return;
            domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
            domain = domain.replace(/\/$/, '');
            whitelist.push(domain.trim());
        });
        browser.storage.local.set({whitelist});

        notify('Options saved');
    });

    const apiKey = await browser.storage.local.get('apiKey');
    if (apiKey.apiKey) {
        document.getElementById('apiKey').value = apiKey.apiKey;
        updateCurrencyList(apiKey.apiKey);
    }

    const decorateValue = await browser.storage.local.get('decorate');
    // !== false because undefined should count as true (default true)
    document.getElementById('decorate-found').checked = decorateValue.decorate !== false;

    document.getElementById('domain-whitelist').value = (await browser.storage.local.get('whitelist')).whitelist.join('\n');
});

function updateCurrencyList(apiKey) {
    fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`).then(async response => {
        if (response.ok) {
            const result = await response.json();
            const rates = Object.keys(result.conversion_rates);

            const list = document.getElementById('currency-list');
            list.innerHTML = '';

            rates.forEach(rate => {
                const item = document.createElement('option');
                item.toggleAttribute('selected', rate === selectedCurrency);
                list.appendChild(item).textContent = rate;
            });
        }
    });
}

// TODO: improve
function notify(message) {
    alert(message);
}