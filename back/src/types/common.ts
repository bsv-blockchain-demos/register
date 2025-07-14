// Common types used throughout the QuarkID application

import { WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';
import { ActorService } from '../services/ActorService';
import { QuarkIdAgentService } from '../services/quarkIdAgentService';
import { PrescriptionTokenService } from '../services/prescriptionTokenService';
import { VCTokenService } from '../services/vcTokenService';

/**
 * Extended Express Request interface with QuarkID services
 */
export interface QuarkIdRequest extends Express.Request {
  db?: Db;
  walletClient?: WalletClient;
  quarkIdActorService?: ActorService;
  quarkIdAgentService?: QuarkIdAgentService;
  prescriptionTokenService?: PrescriptionTokenService;
  vcTokenService?: VCTokenService;
}

/**
 * Unified Actor interface for all actor-related operations
 */
export interface Actor {
  id: string;
  did?: string;
  name: string;
  type: ActorType;
  email?: string;
  phone?: string;
  address?: string;
  publicKey?: string;
  privateKey?: string; // Only for demo purposes
  licenseNumber?: string; // For doctors and pharmacies
  specialization?: string; // For doctors
  insuranceProvider?: string; // For patients
  bsvAddress?: string;
  didDocument?: any;
  status?: ActorStatus;
  txid?: string;
  vout?: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Actor types in the system
 */
export type ActorType = 'patient' | 'doctor' | 'pharmacy' | 'insurance';

/**
 * Actor status in the system
 */
export type ActorStatus = 'active' | 'inactive' | 'revoked' | 'superseded';

/**
 * Request interface for creating actors
 */
export interface CreateActorRequest {
  name: string;
  type: ActorType;
  email?: string;
  phone?: string;
  address?: string;
  licenseNumber?: string;
  specialization?: string;
  insuranceProvider?: string;
  identityKey?: string;
}

/**
 * Request interface for updating actors
 */
export interface UpdateActorRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  licenseNumber?: string;
  specialization?: string;
  insuranceProvider?: string;
  status?: ActorStatus;
}

/**
 * Response interface for actor operations
 */
export interface ActorResponse {
  success: boolean;
  data?: Actor;
  error?: string;
  message?: string;
}

/**
 * Response interface for actor list operations
 */
export interface ActorListResponse {
  success: boolean;
  data: Actor[];
  count: number;
  error?: string;
}

/**
 * Response interface for actor statistics
 */
export interface ActorStatsResponse {
  success: boolean;
  data: {
    total: number;
    active: number;
    inactive: number;
    typeBreakdown: Record<ActorType, number>;
  };
  error?: string;
}

/**
 * Configuration interface for BSV overlay
 */
export interface BsvOverlayConfig {
  endpoint: string;
  topic: string;
}

/**
 * Configuration interface for MongoDB
 */
export interface MongoConfig {
  uri: string;
  dbName: string;
}

/**
 * Configuration interface for wallet operations
 */
export interface WalletConfig {
  platformFundingKey: string;
  defaultFundingPublicKeyHex: string;
  feePerKb: number;
  storageUrl: string;
}

/**
 * Standard API response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Standard API error response interface
 */
export interface ApiError {
  success: false;
  error: string;
  details?: string;
}

/**
 * Pagination interface for list operations
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

/**
 * Filter interface for actor queries
 */
export interface ActorFilter {
  type?: ActorType;
  status?: ActorStatus;
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Identity record interface for simple DID operations
 */
export interface IdentityRecord {
  certificate: {
    subject: string;
  };
}

/**
 * Transformed identity interface
 */
export interface TransformedIdentity {
  id: string;
  subject: string;
}

/**
 * Service health check interface
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  mongodb?: 'connected' | 'not connected';
  walletClient?: 'connected' | 'not connected';
  quarkIdAgentService?: 'connected' | 'not connected';
  prescriptionTokenService?: 'connected' | 'not connected';
  vcTokenService?: 'connected' | 'not connected';
}

/**
 * Service initialization interface
 */
export interface ServiceInitializationConfig {
  db: Db;
  walletClient: WalletClient;
  overlayConfig: BsvOverlayConfig;
  mongoConfig: MongoConfig;
}

/**
 * DID creation response interface
 */
export interface CreateDidResponse {
  did: string;
  privateKey?: string;
  publicKey?: string;
  didDocument?: any;
  txid?: string;
  vout?: number;
}