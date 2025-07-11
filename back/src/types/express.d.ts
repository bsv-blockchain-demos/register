import { Db } from 'mongodb';
import { WalletClient } from '@bsv/sdk';
import { QuarkIdActorService } from '../services/quarkIdActorService';
import { QuarkIdAgentService } from '../services/quarkIdAgentService';
import { PrescriptionTokenService } from '../services/prescriptionTokenService';
import { VCTokenService } from '../services/vcTokenService';

declare global {
  namespace Express {
    interface Request {
      db: Db;
      walletClient: WalletClient;
      quarkIdActorService: QuarkIdActorService;
      quarkIdAgentService: QuarkIdAgentService;
      prescriptionTokenService: PrescriptionTokenService;
      vcTokenService: VCTokenService;
    }
  }
}