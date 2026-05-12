/**
 * API barrel exports
 */

export { fetchCategoryNews, fetchAllNews } from './news';
export {
	fetchCryptoPrices,
	fetchIndices,
	fetchSectorPerformance,
	fetchCommodities,
	fetchAllMarkets
} from './markets';
export { fetchPolymarket, fetchWhaleTransactions, fetchGovContracts, fetchLayoffs, fetchWeather } from './misc';
export type { Prediction, WhaleTransaction, Contract, Layoff, WeatherData } from './misc';
export { fetchWorldLeaders } from './leaders';
export { fetchFedIndicators, fetchFedNews, isFredConfigured } from './fred';
export type { FedIndicators, EconomicIndicator, FedNewsItem, FedNewsType } from './fred';
