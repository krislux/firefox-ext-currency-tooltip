browser.runtime.onMessage.addListener(async (message) => {
    try {
        const response = await fetch(message.url);
        console.log({response});
        const data = await response.json();
        return Promise.resolve(data);
    } catch (error) {
        return Promise.reject(error);
    }
});