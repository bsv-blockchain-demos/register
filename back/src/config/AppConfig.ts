import { cleanEnv, str, num, bool } from 'envalid';
import { PrivateKey } from '@bsv/sdk';

/**
 * Centralized configuration service for the QuarkID application
 * Validates and provides typed access to environment variables
 */
export class AppConfig {
  private static instance: AppConfig;
  private config: ReturnType<typeof cleanEnv>;

  private constructor() {
    this.config = cleanEnv(process.env, {
      // Database Configuration
      MONGO_URI: str({ default: 'mongodb://localhost:27017' }),
      APP_DB_NAME: str({ default: 'quarkid_prescriptions_db' }),
      MONGODB_URI: str({ default: 'mongodb://localhost:27017' }),

      // Server Configuration
      PORT: num({ default: 3000 }),
      EXPRESS_LIMIT: str({ default: '50mb' }),

      // BSV/Wallet Configuration
      PLATFORM_FUNDING_KEY: str({
        desc: 'Private key as 64-character hexadecimal string'
      }),
      FEE_PER_KB: num({ desc: 'Fee per KB in satoshis' }),
      WALLET_STORAGE_URL: str({ default: 'https://storage.babbage.systems' }),

      // DID/Overlay Configuration
      DID_TOPIC: str({ default: 'tm_did' }),
      VC_TOPIC: str({ default: 'tm_did' }),
      OVERLAY_PROVIDER_URL: str({ default: 'https://overlay.test.com' }),
      PRESCRIPTION_TOPIC: str({ default: 'prescriptions' }),

      // Optional Configuration
      DWN_URL: str({ default: undefined }),
    });

    // Additional validation
    this.validateConfig();
  }

  /**
   * Get singleton instance of AppConfig
   */
  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  /**
   * Additional validation for complex requirements
   */
  private validateConfig(): void {
    // Validate platform funding key hex string format
    if (!/^[0-9a-fA-F]{64}$/.test(this.config.PLATFORM_FUNDING_KEY)) {
      throw new Error('PLATFORM_FUNDING_KEY must be a 64-character hexadecimal string');
    }

    // Validate fee is positive
    if (this.config.FEE_PER_KB <= 0) {
      throw new Error('FEE_PER_KB must be a positive integer');
    }
  }

  // Database Configuration
  get mongoUri(): string {
    return this.config.MONGO_URI;
  }

  get dbName(): string {
    return this.config.APP_DB_NAME;
  }

  get mongodbUri(): string {
    return this.config.MONGODB_URI;
  }

  // Server Configuration
  get port(): number {
    return this.config.PORT;
  }

  get expressLimit(): string {
    return this.config.EXPRESS_LIMIT;
  }

  // BSV/Wallet Configuration
  get platformFundingKey(): string {
    return this.config.PLATFORM_FUNDING_KEY;
  }

  get defaultFundingPublicKeyHex(): string {
    // Derive public key from private key
    const privateKey = PrivateKey.fromHex(this.config.PLATFORM_FUNDING_KEY);
    return privateKey.toPublicKey().toString();
  }

  get feePerKb(): number {
    return this.config.FEE_PER_KB;
  }

  get walletStorageUrl(): string {
    return this.config.WALLET_STORAGE_URL;
  }

  // DID/Overlay Configuration
  get didTopic(): string {
    return this.config.DID_TOPIC;
  }

  get vcTopic(): string {
    return this.config.VC_TOPIC;
  }

  get overlayProviderUrl(): string {
    return this.config.OVERLAY_PROVIDER_URL;
  }

  get prescriptionTopic(): string {
    return this.config.PRESCRIPTION_TOPIC;
  }

  // Optional Configuration
  get dwnUrl(): string | undefined {
    return this.config.DWN_URL;
  }

  /**
   * Get MongoDB configuration object
   */
  get mongoConfig() {
    return {
      uri: this.mongoUri,
      dbName: this.dbName
    };
  }

  /**
   * Get overlay configuration object
   */
  get overlayConfig() {
    return {
      endpoint: this.overlayProviderUrl,
      topic: this.didTopic
    };
  }

  /**
   * Get wallet configuration object
   */
  get walletConfig() {
    return {
      platformFundingKey: this.platformFundingKey,
      defaultFundingPublicKeyHex: this.defaultFundingPublicKeyHex,
      feePerKb: this.feePerKb,
      storageUrl: this.walletStorageUrl
    };
  }

  /**
   * Check if application is in development mode
   */
  get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Check if application is in production mode
   */
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Get environment name
   */
  get environment(): string {
    return process.env.NODE_ENV || 'development';
  }
}

// Export singleton instance
export const appConfig = AppConfig.getInstance();