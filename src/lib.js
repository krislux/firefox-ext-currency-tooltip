/**
 * Adds an element to the document body.
 *
 * @param {Object} element - The element configuration object.
 * @param {string} element.tag - The tag name of the element to create.
 * @param {string} [element.text] - The text content of the element (optional).
 * @param {Object} [element.css] - An object with CSS properties and values to apply to the element (optional).
 */
function addElement(element) {
    let el = document.createElement(element.tag);

    if (element.text) {
        el.textContent = element.text;
    }

    if (element.css) {
        for (let [property, value] of Object.entries(element.css)) {
            el.style[property] = value;
        }
    }

    document.body.appendChild(el);

    return el;
}