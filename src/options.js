document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('options-form').addEventListener('submit', async event => {
        event.preventDefault();
        const apiKey = document.getElementById('apiKey').value;
        await browser.storage.local.set({ apiKey });
        alert('Saved');
    });

    const result = await browser.storage.local.get('apiKey');
    if (result.apiKey) {
        document.getElementById('apiKey').value = result.apiKey;
    }
});
