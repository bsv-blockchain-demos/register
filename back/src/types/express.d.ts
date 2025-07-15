import { Db } from 'mongodb';
import { WalletClient } from '@bsv/sdk';
import { ActorService } from '../services/ActorService';
import { QuarkIdAgentService } from '../services/quarkIdAgentService';
import { PrescriptionTokenService } from '../services/prescriptionTokenService';
import { VCTokenService } from '../services/vcTokenService';
import { InsuranceFraudPreventionService } from '../services/InsuranceFraudPreventionService';
import { KMSClient } from '@quarkid/kms-client';

declare global {
  namespace Express {
    interface Request {
      db?: Db;
      walletClient?: WalletClient;
      quarkIdActorService?: ActorService;
      quarkIdAgentService?: QuarkIdAgentService;
      prescriptionTokenService?: PrescriptionTokenService;
      vcTokenService?: VCTokenService;
      fraudPreventionService?: InsuranceFraudPreventionService;
      kmsClient?: KMSClient;
      actorRole?: string;
      actorDid?: string;
    }
  }
}