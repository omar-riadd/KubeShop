import type { components } from './schema';

export type Product = components['schemas']['Product'];
export type ProductList = components['schemas']['ProductList'];
export type Category = components['schemas']['Category'];
export type CategoryList = components['schemas']['CategoryList'];
export type Cart = components['schemas']['Cart'];
export type CartItem = components['schemas']['CartItem'];
export type AddCartItemRequest = components['schemas']['AddCartItemRequest'];
export type UpdateCartItemRequest = components['schemas']['UpdateCartItemRequest'];
export type Order = components['schemas']['Order'];
export type OrderItem = components['schemas']['OrderItem'];
export type OrderList = components['schemas']['OrderList'];
export type OrderRequest = components['schemas']['OrderRequest'];
export type Customer = components['schemas']['Customer'];
export type ShippingAddress = components['schemas']['ShippingAddress'];
export type Version = components['schemas']['Version'];

export interface RuntimeConfig {
  environment: 'local' | 'dev' | 'staging' | 'prod';
  version: string;
  gitSha: string;
  buildTime: string;
}
