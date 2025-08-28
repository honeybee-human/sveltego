<script lang="ts">
    import { onMount } from 'svelte';
    import { tradingStore } from '../stores/tradingStore';
    import { stockStore } from '../stores/stockStore';
    import { formatPrice, formatPercent, calculateGainLoss, isUSStock } from '../utils/stockUtils';

    let selectedSymbol = '';
    let quantity = 1;
    let error = '';
    let searchQuery = '';
    let searchResults: any[] = [];
    let loading = false;

    onMount(async () => {
        for (const symbol of Object.keys($stockStore)) {
            try {
                await stockStore.fetchStockData(symbol);
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
            const allResults = await stockStore.searchStocks(searchQuery);
            searchResults = allResults.filter(result => isUSStock(result.symbol));
        } catch (e) {
            error = 'Search failed. Please try again.';
            searchResults = [];
        }
        loading = false;
    }

    async function handleAddStock(symbol: string) {
        try {
            await stockStore.fetchStockData(symbol);
            selectedSymbol = symbol;
            searchQuery = '';
            searchResults = [];
        } catch (e) {
            error = `Failed to add ${symbol}. Please try again.`;
        }
    }

    function handleBuy() {
        try {
            const stock = $stockStore[selectedSymbol];
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
            const stock = $stockStore[selectedSymbol];
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
	<header>
			<h1>📈 Advanced Stock Tracker</h1>
			
				
			
		</header>
        	<div class="update-info">
						Updates every 15 seconds • Persistent data storage
					</div>
        <h3>Trading Account</h3>
        <div class="balance">
            <span>Balance:</span>
            <span class="amount">${formatPrice($tradingStore.balance)}</span>
        </div>

        <div class="form-group">
        <br/>
            <label for="search">Place Trade:</label>
            <div class="search-container">
                <input
                    type="text"
                    id="search"
                    bind:value={searchQuery}
                    on:input={handleSearch}
                    placeholder="Search US stocks (e.g., AAPL, GOOGL, AMD)"
                />
                {#if loading}
                    <span class="loading">Searching...</span>
                {/if}
                {#if searchResults.length > 0}
                    <div class="search-results">
                        {#each searchResults.slice(0, 5) as result}
                            <div 
                                class="search-result" 
                                role="button"
                                tabindex="0"
                                on:click={() => handleAddStock(result.symbol)}
                                on:keydown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleAddStock(result.symbol);
                                    }
                                }}
                            >
                                <span class="symbol"><strong>{result.symbol}</strong></span>
                                <span class="description">{result.description}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

        {#if selectedSymbol}
            <div class="selected-stock">
                <h4>Selected Stock:</h4>
                <div class="stock-info">
                    <div class="stock-header">
                        <span class="symbol">{selectedSymbol}</span>
                        {#if $stockStore[selectedSymbol]}
                            <span class="price">${formatPrice($stockStore[selectedSymbol].quote.c)}</span>
                        {/if}
                    </div>
                    {#if $stockStore[selectedSymbol]}
                        <div class="stock-details">
                            <span class="change" class:positive={$stockStore[selectedSymbol].quote.d > 0} class:negative={$stockStore[selectedSymbol].quote.d < 0}>
                                {$stockStore[selectedSymbol].quote.d > 0 ? '+' : ''}{formatPrice($stockStore[selectedSymbol].quote.d)} 
                                ({formatPercent($stockStore[selectedSymbol].quote.dp)})
                            </span>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

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

        {#if selectedSymbol && $stockStore[selectedSymbol]}
            <div class="trade-preview">
                <p>Current Price: ${formatPrice($stockStore[selectedSymbol].quote.c)}</p>
                <p>Total: ${formatPrice($stockStore[selectedSymbol].quote.c * quantity)}</p>
            </div>
        {/if}

        <div class="trade-buttons">
            <button class="buy-btn" on:click={handleBuy} disabled={!selectedSymbol}>Buy</button>
            <button class="sell-btn" on:click={handleSell} disabled={!selectedSymbol}>Sell</button>
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
                    {#if $stockStore[symbol]}
                        {@const { gainLoss, percentGainLoss } = calculateGainLoss($stockStore[symbol].quote.c, holding.averagePrice, holding.quantity)}
                        <div class="holding-item">
                            <div class="holding-header">
                                <span class="symbol">{symbol}</span>
                                <span class="quantity">{holding.quantity} shares</span>
                            </div>
                            <div class="holding-details">
                                <div>Avg Price: ${formatPrice(holding.averagePrice)}</div>
                                <div>Current: ${formatPrice($stockStore[symbol].quote.c)}</div>
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
	@import '../styles/panel.css';
</style>