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

    document.getElementById('currency-form').addEventListener('submit', async event => {
        event.preventDefault();
        browser.storage.local.set({currency: event.target.value});

        notify('Currency saved');
    });

    const result = await browser.storage.local.get('apiKey');
    if (result.apiKey) {
        document.getElementById('apiKey').value = result.apiKey;

        updateCurrencyList(result.apiKey);
    }
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