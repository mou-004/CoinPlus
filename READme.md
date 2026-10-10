# CoinPulse

A responsive cryptocurrency market dashboard built with vanilla HTML, CSS, and JavaScript. CoinPulse fetches live market data from CoinGecko and presents prices, daily movement, and coin history in a searchable interface.

## Features

- Live prices, market capitalization, and 24-hour volume
- Search by coin name or ticker symbol
- Sort by market cap, price, and 24-hour change
- Currency selection: USD, EUR, GBP, and BDT
- Seven-day trend sparklines and coin detail charts
- Loading, empty, and friendly error states with retry
- Responsive layout for desktop and mobile

## Built with

- HTML
- CSS
- JavaScript (no framework or build step)
- [CoinGecko API](https://docs.coingecko.com/docs/keyless-public-api)


## API and errors

CoinPulse uses CoinGecko's keyless public API for market listings and historical charts. Keyless requests share rate limits, so the API may occasionally return an error or be temporarily unavailable. The app shows a loading state while requesting data and a retry option if the request fails.

## Data attribution

Market data is provided by [CoinGecko](https://www.coingecko.com/). Prices may be delayed or unavailable. CoinPulse is for informational purposes only and is not financial advice.


Live link: https://mou-004.github.io/CoinPlus/
