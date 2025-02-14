/**
 * Adds an element to the document body.
 *
 * @param {Object} element - The element configuration object.
 * @param {string} element.tag - The tag name of the element to create.
 * @param {Object} element.parent - The parent element to append the new element to (optional).
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

    if (element.parent) {
        element.parent.appendChild(el);
    } else {
        document.body.appendChild(el);
    }

    return el;
}