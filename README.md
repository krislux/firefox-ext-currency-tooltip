# Currency Tooltip Extension

Simple Firefox extension that converts prices in $, € or £ on any website to DKK.
Made for personal use, and is not currently very configurable. Changing the target currency requires changing the code.

Currently hard locked to exchangerate-api.com for currency rates.

Prices denoted with `$` will be assumed to be USD. Does not currently respond to e.g. AUD or CAD suffixes.

## Usage

Get a free API key from [ExchangeRate-API](https://www.exchangerate-api.com/).
Paste the API key in the options page of the extension.
Go to any website with prices in $, € or £.

## Benchmarks

Quick benchmarks:

Steampowered.com front page: ~300 ms without cached currency rates, ~20 ms cached.

Amazon.com front page: ~350 ms without cached currency rates, ~5 ms cached.

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