import { writable } from 'svelte/store';

export interface Holding {
    symbol: string;
    quantity: number;
    averagePrice: number;
    totalCost: number;
}

export interface Transaction {
    id: string;
    symbol: string;
    type: 'buy' | 'sell';
    quantity: number;
    price: number;
    total: number;
    timestamp: number;
}

interface TradingAccount {
    balance: number;
    holdings: Record<string, Holding>;
    transactions: Transaction[];
}

const INITIAL_BALANCE = 10000;

function createTradingStore() {
    const { subscribe, set, update } = writable<TradingAccount>({
        balance: INITIAL_BALANCE,
        holdings: {},
        transactions: []
    });

    return {
        subscribe,
        buy: (symbol: string, quantity: number, price: number) => {
            update(account => {
                const total = quantity * price;
                if (total > account.balance) {
                    throw new Error('Insufficient funds');
                }

                const transaction: Transaction = {
                    id: crypto.randomUUID(),
                    symbol,
                    type: 'buy',
                    quantity,
                    price,
                    total,
                    timestamp: Date.now()
                };

                const existingHolding = account.holdings[symbol];
                let newHolding: Holding;

                if (existingHolding) {
                    const newQuantity = existingHolding.quantity + quantity;
                    const newTotalCost = existingHolding.totalCost + total;
                    newHolding = {
                        symbol,
                        quantity: newQuantity,
                        averagePrice: newTotalCost / newQuantity,
                        totalCost: newTotalCost
                    };
                } else {
                    newHolding = {
                        symbol,
                        quantity,
                        averagePrice: price,
                        totalCost: total
                    };
                }

                return {
                    ...account,
                    balance: account.balance - total,
                    holdings: {
                        ...account.holdings,
                        [symbol]: newHolding
                    },
                    transactions: [transaction, ...account.transactions]
                };
            });
        },
        sell: (symbol: string, quantity: number, price: number) => {
            update(account => {
                const holding = account.holdings[symbol];
                if (!holding || holding.quantity < quantity) {
                    throw new Error('Insufficient shares');
                }

                const total = quantity * price;
                const transaction: Transaction = {
                    id: crypto.randomUUID(),
                    symbol,
                    type: 'sell',
                    quantity,
                    price,
                    total,
                    timestamp: Date.now()
                };

                const newQuantity = holding.quantity - quantity;
                const newHolding = newQuantity > 0 ? {
                    ...holding,
                    quantity: newQuantity,
                    totalCost: holding.totalCost * (newQuantity / holding.quantity)
                } : null;

                const newHoldings = { ...account.holdings };
                if (newHolding) {
                    newHoldings[symbol] = newHolding;
                } else {
                    delete newHoldings[symbol];
                }

                return {
                    ...account,
                    balance: account.balance + total,
                    holdings: newHoldings,
                    transactions: [transaction, ...account.transactions]
                };
            });
        },
        reset: () => {
            set({
                balance: INITIAL_BALANCE,
                holdings: {},
                transactions: []
            });
        }
    };
}

export const tradingStore = createTradingStore(); 