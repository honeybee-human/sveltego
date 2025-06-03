<script lang="ts">
    import { onMount } from 'svelte';
    import { tradingStore } from '../stores/tradingStore';
    import { stocks } from '../stores/stockStore';
    import { formatPrice, formatPercent, calculateGainLoss } from '../utils/stockUtils';

    let selectedSymbol = '';
    let quantity = 1;
    let error = '';
    let searchQuery = '';
    let searchResults: any[] = [];
    let loading = false;

    onMount(async () => {
        // Fetch initial stock data for any stocks in the store
        for (const symbol of Object.keys($stocks)) {
            try {
                await stocks.fetchStockData(symbol);
            } catch (e) {
                console.error(`Failed to fetch initial data for ${symbol}:`, e);
            }
        }
    });

    async function handleSearch() {
        if (!searchQuery.trim()) {
            searchResults = [];
            return;
        }

        loading = true;
        try {
            searchResults = await stocks.searchStocks(searchQuery);
        } catch (e) {
            error = 'Search failed. Please try again.';
            searchResults = [];
        }
        loading = false;
    }

    async function handleAddStock(symbol: string) {
        try {
            await stocks.fetchStockData(symbol);
            selectedSymbol = symbol;
            searchQuery = '';
            searchResults = [];
        } catch (e) {
            error = `Failed to add ${symbol}. Please try again.`;
        }
    }

    function handleBuy() {
        try {
            const stock = $stocks[selectedSymbol];
            if (!stock) {
                throw new Error('Stock not found');
            }
            tradingStore.buy(selectedSymbol, quantity, stock.quote.c);
            error = '';
        } catch (e) {
            error = e.message;
        }
    }

    function handleSell() {
        try {
            const stock = $stocks[selectedSymbol];
            if (!stock) {
                throw new Error('Stock not found');
            }
            tradingStore.sell(selectedSymbol, quantity, stock.quote.c);
            error = '';
        } catch (e) {
            error = e.message;
        }
    }
</script>

<div class="trading-panel">
    <div class="account-summary">
        <h2>Trading Account</h2>
        <div class="balance">
            <span>Balance:</span>
            <span class="amount">${formatPrice($tradingStore.balance)}</span>
        </div>
    </div>

    <div class="trading-form">
        <h3>Place Trade</h3>
        <div class="form-group">
            <label for="search">Search Stocks:</label>
            <div class="search-container">
                <input
                    type="text"
                    id="search"
                    bind:value={searchQuery}
                    on:input={handleSearch}
                    placeholder="Search stocks (e.g., AAPL, GOOGL, AMD)"
                />
                {#if loading}
                    <span class="loading">Searching...</span>
                {/if}
                {#if searchResults.length > 0}
                    <div class="search-results">
                        {#each searchResults.slice(0, 5) as result}
                            <div class="search-result" on:click={() => handleAddStock(result.symbol)}>
                                <span class="symbol"><strong>{result.symbol}</strong></span>
                                <span class="description">{result.description}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <div class="form-group">
            <label for="quantity">Quantity:</label>
            <input 
                type="number" 
                id="quantity" 
                bind:value={quantity} 
                min="1" 
                step="1"
            />
        </div>

        {#if selectedSymbol && $stocks[selectedSymbol]}
            <div class="trade-preview">
                <p>Current Price: ${formatPrice($stocks[selectedSymbol].quote.c)}</p>
                <p>Total: ${formatPrice($stocks[selectedSymbol].quote.c * quantity)}</p>
            </div>
        {/if}

        <div class="trade-buttons">
            <button class="buy-btn" on:click={handleBuy}>Buy</button>
            <button class="sell-btn" on:click={handleSell}>Sell</button>
        </div>

        {#if error}
            <div class="error">{error}</div>
        {/if}
    </div>

    <div class="holdings">
        <h3>Current Holdings</h3>
        {#if Object.keys($tradingStore.holdings).length === 0}
            <p class="no-holdings">No holdings yet</p>
        {:else}
            <div class="holdings-list">
                {#each Object.entries($tradingStore.holdings) as [symbol, holding]}
                    {#if $stocks[symbol]}
                        {@const { gainLoss, percentGainLoss } = calculateGainLoss($stocks[symbol].quote.c, holding.averagePrice, holding.quantity)}
                        <div class="holding-item">
                            <div class="holding-header">
                                <span class="symbol">{symbol}</span>
                                <span class="quantity">{holding.quantity} shares</span>
                            </div>
                            <div class="holding-details">
                                <div>Avg Price: ${formatPrice(holding.averagePrice)}</div>
                                <div>Current: ${formatPrice($stocks[symbol].quote.c)}</div>
                                <div class:positive={gainLoss > 0} class:negative={gainLoss < 0}>
                                    P/L: ${formatPrice(gainLoss)} ({formatPercent(percentGainLoss)})
                                </div>
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}
    </div>

    <div class="transactions">
        <h3>Transaction History</h3>
        {#if $tradingStore.transactions.length === 0}
            <p class="no-transactions">No transactions yet</p>
        {:else}
            <div class="transactions-list">
                {#each $tradingStore.transactions as transaction}
                    <div class="transaction-item" class:buy={transaction.type === 'buy'} class:sell={transaction.type === 'sell'}>
                        <div class="transaction-header">
                            <span class="type">{transaction.type.toUpperCase()}</span>
                            <span class="symbol">{transaction.symbol}</span>
                            <span class="timestamp">{new Date(transaction.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="transaction-details">
                            <div>{transaction.quantity} shares @ ${formatPrice(transaction.price)}</div>
                            <div>Total: ${formatPrice(transaction.total)}</div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .trading-panel {
        padding: 1rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .account-summary {
        margin-bottom: 1.5rem;
    }

    .balance {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 1.25rem;
        font-weight: 600;
    }

    .trading-form {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
    }

    .form-group {
        margin-bottom: 1rem;
        position: relative;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
    }

    input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .search-container {
        position: relative;
    }

    .loading {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: #6c757d;
        font-size: 0.875rem;
    }

    .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-top: 4px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .search-result {
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
    }

    .search-result:last-child {
        border-bottom: none;
    }

    .search-result:hover {
        background: #f8f9fa;
    }

    .search-result .symbol {
        font-weight: 600;
        margin-right: 8px;
    }

    .search-result .description {
        color: #6c757d;
        font-size: 0.875rem;
    }

    .trade-preview {
        margin: 1rem 0;
        padding: 0.5rem;
        background: #e9ecef;
        border-radius: 4px;
    }

    .trade-buttons {
        display: flex;
        gap: 1rem;
    }

    button {
        flex: 1;
        padding: 0.75rem;
        border: none;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
    }

    .buy-btn {
        background: #28a745;
        color: white;
    }

    .sell-btn {
        background: #dc3545;
        color: white;
    }

    .error {
        color: #dc3545;
        margin-top: 0.5rem;
    }

    .holdings, .transactions {
        margin-top: 1.5rem;
    }

    .holding-item, .transaction-item {
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 0.5rem;
    }

    .holding-header, .transaction-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .symbol {
        font-weight: 600;
    }

    .positive {
        color: #28a745;
    }

    .negative {
        color: #dc3545;
    }

    .buy {
        border-left: 4px solid #28a745;
    }

    .sell {
        border-left: 4px solid #dc3545;
    }

    .no-holdings, .no-transactions {
        color: #6c757d;
        font-style: italic;
    }
</style> 