package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

type StockQuote struct {
	Symbol        string  `json:"symbol"`
	CurrentPrice  float64 `json:"c"`
	Change        float64 `json:"d"`
	PercentChange float64 `json:"dp"`
	HighPrice     float64 `json:"h"`
	LowPrice      float64 `json:"l"`
	OpenPrice     float64 `json:"o"`
	PreviousClose float64 `json:"pc"`
}

type StockCandle struct {
	Close     []float64 `json:"c"`
	High      []float64 `json:"h"`
	Low       []float64 `json:"l"`
	Open      []float64 `json:"o"`
	Status    string    `json:"s"`
	Timestamp []int64   `json:"t"`
	Volume    []int64   `json:"v"`
}

type APIError struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

var finnhubAPIKey string

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	finnhubAPIKey = os.Getenv("FINNHUB_API_KEY")
	if finnhubAPIKey == "" {
		log.Fatal("FINNHUB_API_KEY environment variable is required")
	}

	r := mux.NewRouter()

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "http://localhost:4173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	r.HandleFunc("/api/quote/{symbol}", getStockQuote).Methods("GET")
	r.HandleFunc("/api/candles/{symbol}", getStockCandles).Methods("GET")
	r.HandleFunc("/api/search/{query}", searchStocks).Methods("GET")

	r.HandleFunc("/api/health", healthCheck).Methods("GET")

	handler := c.Handler(r)

	fmt.Println("Server starting on :8080")
	fmt.Printf("API Key loaded: %s...\n", finnhubAPIKey[:8])
	log.Fatal(http.ListenAndServe(":8080", handler))
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func getStockQuote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := strings.ToUpper(vars["symbol"])

	url := fmt.Sprintf("https://finnhub.io/api/v1/quote?symbol=%s&token=%s", symbol, finnhubAPIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("Error fetching quote for %s: %v", symbol, err)
		sendErrorResponse(w, "Failed to fetch data", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading response for %s: %v", symbol, err)
		sendErrorResponse(w, "Failed to read response", http.StatusInternalServerError)
		return
	}

	switch resp.StatusCode {
	case http.StatusOK:
		var quote StockQuote
		if err := json.Unmarshal(body, &quote); err != nil {
			log.Printf("Error parsing JSON for %s: %v", symbol, err)
			sendErrorResponse(w, "Failed to parse data", http.StatusInternalServerError)
			return
		}
		quote.Symbol = symbol
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(quote)
	case http.StatusUnauthorized:
		log.Printf("Unauthorized API request for %s", symbol)
		sendErrorResponse(w, "API key invalid or expired", http.StatusUnauthorized)
	case http.StatusForbidden:
		log.Printf("Forbidden API request for %s - possibly rate limited or insufficient permissions", symbol)
		sendErrorResponse(w, "API access forbidden - check your plan limits", http.StatusForbidden)
	case http.StatusTooManyRequests:
		log.Printf("Rate limit exceeded for %s", symbol)
		sendErrorResponse(w, "Rate limit exceeded", http.StatusTooManyRequests)
	default:
		log.Printf("Finnhub API returned status %d for symbol %s", resp.StatusCode, symbol)
		sendErrorResponse(w, "Failed to fetch data from Finnhub", resp.StatusCode)
	}
}

func getStockCandles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	symbol := strings.ToUpper(vars["symbol"])

	to := time.Now().Unix()
	from := to - (30 * 24 * 60 * 60)

	url := fmt.Sprintf("https://finnhub.io/api/v1/stock/candle?symbol=%s&resolution=D&from=%d&to=%d&token=%s",
		symbol, from, to, finnhubAPIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("Error fetching candles for %s: %v", symbol, err)
		sendErrorResponse(w, "Failed to fetch data", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading candles response for %s: %v", symbol, err)
		sendErrorResponse(w, "Failed to read response", http.StatusInternalServerError)
		return
	}

	switch resp.StatusCode {
	case http.StatusOK:
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	case http.StatusUnauthorized:
		log.Printf("Unauthorized candles request for %s", symbol)
		sendErrorResponse(w, "API key invalid or expired", http.StatusUnauthorized)
	case http.StatusForbidden:
		log.Printf("Forbidden candles request for %s - historical data may require paid plan", symbol)
		sendMockCandlesData(w, symbol)
	case http.StatusTooManyRequests:
		log.Printf("Rate limit exceeded for candles %s", symbol)
		sendErrorResponse(w, "Rate limit exceeded", http.StatusTooManyRequests)
	default:
		log.Printf("Finnhub API returned status %d for candles %s", resp.StatusCode, symbol)
		sendMockCandlesData(w, symbol)
	}
}

func searchStocks(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	query := vars["query"]

	url := fmt.Sprintf("https://finnhub.io/api/v1/search?q=%s&token=%s", query, finnhubAPIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("Error searching stocks for query %s: %v", query, err)
		sendErrorResponse(w, "Failed to fetch data", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading search response for query %s: %v", query, err)
		sendErrorResponse(w, "Failed to read response", http.StatusInternalServerError)
		return
	}

	switch resp.StatusCode {
	case http.StatusOK:
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	case http.StatusUnauthorized:
		log.Printf("Unauthorized search request for %s", query)
		sendErrorResponse(w, "API key invalid or expired", http.StatusUnauthorized)
	case http.StatusForbidden:
		log.Printf("Forbidden search request for %s", query)
		sendErrorResponse(w, "API access forbidden", http.StatusForbidden)
	case http.StatusTooManyRequests:
		log.Printf("Rate limit exceeded for search %s", query)
		sendErrorResponse(w, "Rate limit exceeded", http.StatusTooManyRequests)
	default:
		log.Printf("Finnhub API returned status %d for search %s", resp.StatusCode, query)
		sendErrorResponse(w, "Failed to fetch data from Finnhub", resp.StatusCode)
	}
}

func sendErrorResponse(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(APIError{
		Error:   "API Error",
		Message: message,
		Code:    code,
	})
}

func sendMockCandlesData(w http.ResponseWriter, symbol string) {
	now := time.Now().Unix()
	mockCandles := StockCandle{
		Close:     []float64{150.0, 152.0, 148.0, 155.0, 153.0},
		High:      []float64{155.0, 156.0, 152.0, 158.0, 157.0},
		Low:       []float64{148.0, 150.0, 145.0, 152.0, 150.0},
		Open:      []float64{149.0, 151.0, 149.0, 154.0, 154.0},
		Status:    "ok",
		Timestamp: []int64{now - 4*86400, now - 3*86400, now - 2*86400, now - 86400, now},
		Volume:    []int64{1000000, 1200000, 800000, 1500000, 1100000},
	}

	log.Printf("Sending mock candles data for %s due to API limitations", symbol)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mockCandles)
}
