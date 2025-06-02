# Stock Price Tracker

A real-time stock price tracking application built with Svelte and Go, using the Finnhub API.

## Features
- Real-time stock price tracking
- Interactive chart visualization
- Customizable stock watchlist
- No user authentication required

## Project Structure
```
.
├── frontend/          # Svelte frontend application
├── backend/          # Go backend server
└── README.md
```

## Setup Instructions

### Backend Setup
1. Navigate to the backend directory
2. Create a `.env` file with your Finnhub API key:
   ```
   FINNHUB_API_KEY=your_api_key_here
   ```
3. Run the Go server:
   ```bash
   go run main.go
   ```

### Frontend Setup
1. Navigate to the frontend directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Technologies Used
- Frontend: Svelte, Chart.js
- Backend: Go
- API: Finnhub
- Real-time WebSocket communication 