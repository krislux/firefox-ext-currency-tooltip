# Currency Converter Tooltip

Simple Firefox extension that converts prices in $, € or £ on any website to a currency of your choice.

Currently uses ExchangeRate-API.com to get the latest currency rates. No particular reason for this choice, other than they have a free tier that should be enough for everyone.

**Note**: Prices denoted with `$` will be assumed to be USD. Does not currently respond to e.g. AUD or CAD suffixes.

## Usage

Get a free API key from [ExchangeRate-API](https://www.exchangerate-api.com/).

Go to the extension options: Click menu, then Add-ons and Themes, then the three dots next to the extension, then Options.

Enter your API key and the currency you want to convert to.

Go to any website with prices in $, € or £.

## Performance

Quick benchmarks:

Steampowered.com front page: ~300 ms without cached currency rates, ~30 ms cached.

Amazon.com front page: ~350 ms without cached currency rates, ~5 ms cached.

Wikipedia.org front page (a page with no prices), 5 ms cached.

Obviously depends on computer power and website complexity, but it is quite fast and should not be noticeable.

## Installation

1. Clone the repository
2. Open Firefox
3. Go to `about:debugging`
4. Click `This Firefox`
5. Click `Load Temporary Add-on...`
6. Select the `manifest.json` file in the repository

## Authors

* **Kris Lux** - [krislux]

## License

MIT