## Stock Tracker

Stock Tracker is a web application that tracks stock prices and allows users to buy and sell stocks.

### Built with

- Svelte
- Vue.js
- Golang
- Finnhub API
- Vite

### Install

1. Navigate to the backend directory
   `cd stock-tracker`
2. Create a .env file with your Finnhub API key
   `echo FINNHUB_API_KEY=your_api_key_here > .env`
3. Install Go dependencies and run the server
   `go mod tidy`
   `go run main.go`
4. Open a new terminal and navigate to the frontend directory
   `cd stock-tracker-frontend`
5. Install NPM packages
   `npm install`
6. Start application
   `npm run dev`

### Features

The user can choose up to 5 stocks to track by searching and selecting from existing options. They start with a balance of $10000.00 in their trading account, and the option to buy or sell different quantities of shares. Current Holdings and Transaction History are kept track of when a user buys or sells a share. Options for viewing by chart include line, candlestick, area, and volume, with timeframes of 5min up to 1 day. Each stock display card has stock name, price, open, high and low. Non-US stocks are filtered out because this is using the free tier of Finnhub API.

### Some Terms To Know

- Open - The price of the stock when the market opens for the day.
- High - The highest price the stock reached during the day.
- Low - The lowest price the stock reached during the day.
- Candlestick chart - shows open, close, high, and low for each time period.
