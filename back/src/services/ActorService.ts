import { Db } from 'mongodb';
import { WalletClient } from '@bsv/sdk';
import * as crypto from 'crypto';
import { 
  Actor, 
  ActorType, 
  ActorStatus, 
  CreateActorRequest, 
  UpdateActorRequest,
  ActorFilter,
  BsvOverlayConfig
} from '../types/common';
import { appConfig } from '../config/AppConfig';
import { QuarkIdAgentService } from './quarkIdAgentService';

/**
 * Unified Actor Service for managing actors with DID integration
 * 
 * This service combines the functionality of both QuarkIdActorService and EnhancedQuarkIdActorService
 * into a single, well-designed service with proper abstractions and error handling.
 */
export class ActorService {
  private actorsCollection: any;
  private overlayConfig: BsvOverlayConfig;

  constructor(
    private db: Db,
    private walletClient: WalletClient,
    private quarkIdAgentService?: QuarkIdAgentService,
    overlayConfig?: BsvOverlayConfig
  ) {
    this.actorsCollection = db.collection('actors');
    this.overlayConfig = overlayConfig || appConfig.overlayConfig;
  }

  /**
   * Create a new actor with DID integration
   */
  async createActor(actorData: CreateActorRequest): Promise<Actor> {
    try {
      console.log('[ActorService] Creating actor:', actorData.name);

      // Validate input
      this.validateCreateActorRequest(actorData);

      // Generate key pair if not provided
      let publicKey = actorData.identityKey;
      let privateKey = '';
      
      if (!publicKey) {
        const keyPair = this.generateKeyPair();
        publicKey = keyPair.publicKey;
        privateKey = keyPair.privateKey;
      }

      // Create DID if QuarkIdAgentService is available
      let did = '';
      if (this.quarkIdAgentService) {
        try {
          did = await this.quarkIdAgentService.createDID();
          console.log('[ActorService] Created DID:', did);
        } catch (error) {
          console.warn('[ActorService] Failed to create DID, continuing without:', error.message);
        }
      }

      // Create actor record
      const actor: Actor = {
        id: crypto.randomUUID(),
        did,
        name: actorData.name,
        type: actorData.type,
        email: actorData.email,
        phone: actorData.phone,
        address: actorData.address,
        publicKey,
        privateKey, // Store for demo purposes only
        licenseNumber: actorData.licenseNumber,
        specialization: actorData.specialization,
        insuranceProvider: actorData.insuranceProvider,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // Store in database
      await this.actorsCollection.insertOne(actor);

      // Store DID document if DID was created
      if (did) {
        await this.storeDIDDocument(actor);
      }

      console.log('[ActorService] Actor created successfully:', actor.id);
      return actor;

    } catch (error) {
      console.error('[ActorService] Error creating actor:', error);
      throw new Error(`Failed to create actor: ${error.message}`);
    }
  }

  /**
   * Update an existing actor
   */
  async updateActor(actorId: string, updateData: UpdateActorRequest): Promise<Actor | null> {
    try {
      console.log('[ActorService] Updating actor:', actorId);

      // Validate input
      this.validateUpdateActorRequest(updateData);

      // Prepare update object
      const updates: any = {
        ...updateData,
        updatedAt: new Date()
      };

      // Remove fields that shouldn't be updated
      delete updates.id;
      delete updates.did;
      delete updates.createdAt;

      // Update in database
      const result = await this.actorsCollection.findOneAndUpdate(
        { id: actorId },
        { $set: updates },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        console.warn('[ActorService] Actor not found for update:', actorId);
        return null;
      }

      console.log('[ActorService] Actor updated successfully:', actorId);
      return result.value;

    } catch (error) {
      console.error('[ActorService] Error updating actor:', error);
      throw new Error(`Failed to update actor: ${error.message}`);
    }
  }

  /**
   * Get actor by ID
   */
  async getActorById(actorId: string): Promise<Actor | null> {
    try {
      const actor = await this.actorsCollection.findOne({ id: actorId });
      return actor || null;
    } catch (error) {
      console.error('[ActorService] Error getting actor by ID:', error);
      throw new Error(`Failed to get actor: ${error.message}`);
    }
  }

  /**
   * Get actor by DID
   */
  async getActorByDid(did: string): Promise<Actor | null> {
    try {
      const actor = await this.actorsCollection.findOne({ did });
      return actor || null;
    } catch (error) {
      console.error('[ActorService] Error getting actor by DID:', error);
      throw new Error(`Failed to get actor by DID: ${error.message}`);
    }
  }

  /**
   * Get actors with filtering and pagination
   */
  async getActors(filter: ActorFilter = {}, limit: number = 100, offset: number = 0): Promise<Actor[]> {
    try {
      const query = this.buildFilterQuery(filter);
      
      const actors = await this.actorsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return actors;
    } catch (error) {
      console.error('[ActorService] Error getting actors:', error);
      throw new Error(`Failed to get actors: ${error.message}`);
    }
  }

  /**
   * Get actors by type
   */
  async getActorsByType(type: ActorType): Promise<Actor[]> {
    try {
      const actors = await this.actorsCollection.find({ type }).toArray();
      return actors;
    } catch (error) {
      console.error('[ActorService] Error getting actors by type:', error);
      throw new Error(`Failed to get actors by type: ${error.message}`);
    }
  }

  /**
   * Deactivate an actor
   */
  async deactivateActor(actorId: string): Promise<boolean> {
    try {
      const result = await this.actorsCollection.updateOne(
        { id: actorId },
        { 
          $set: { 
            isActive: false,
            status: 'inactive',
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('[ActorService] Error deactivating actor:', error);
      throw new Error(`Failed to deactivate actor: ${error.message}`);
    }
  }

  /**
   * Delete an actor
   */
  async deleteActor(actorId: string): Promise<boolean> {
    try {
      const result = await this.actorsCollection.deleteOne({ id: actorId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('[ActorService] Error deleting actor:', error);
      throw new Error(`Failed to delete actor: ${error.message}`);
    }
  }

  /**
   * Get actor statistics
   */
  async getActorStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    typeBreakdown: Record<ActorType, number>;
  }> {
    try {
      const totalActors = await this.actorsCollection.countDocuments();
      const activeActors = await this.actorsCollection.countDocuments({ isActive: true });

      // Get breakdown by type
      const typeBreakdown = await this.actorsCollection.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]).toArray();

      const typeBreakdownMap = typeBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<ActorType, number>);

      return {
        total: totalActors,
        active: activeActors,
        inactive: totalActors - activeActors,
        typeBreakdown: typeBreakdownMap
      };
    } catch (error) {
      console.error('[ActorService] Error getting actor statistics:', error);
      throw new Error(`Failed to get actor statistics: ${error.message}`);
    }
  }

  /**
   * Resolve DID document for an actor
   */
  async resolveDid(did: string): Promise<any> {
    try {
      if (this.quarkIdAgentService) {
        return await this.quarkIdAgentService.resolveDID(did);
      }
      console.warn('[ActorService] QuarkIdAgentService not available for DID resolution');
      return null;
    } catch (error) {
      console.error('[ActorService] Error resolving DID:', error);
      return null;
    }
  }

  // Private helper methods

  /**
   * Validate create actor request
   */
  private validateCreateActorRequest(actorData: CreateActorRequest): void {
    if (!actorData.name || !actorData.type) {
      throw new Error('Name and type are required');
    }

    const validTypes: ActorType[] = ['patient', 'doctor', 'pharmacy', 'insurance'];
    if (!validTypes.includes(actorData.type)) {
      throw new Error('Invalid actor type');
    }

    if (actorData.email && !this.isValidEmail(actorData.email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Validate update actor request
   */
  private validateUpdateActorRequest(updateData: UpdateActorRequest): void {
    if (updateData.email && !this.isValidEmail(updateData.email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Build filter query for database
   */
  private buildFilterQuery(filter: ActorFilter): any {
    const query: any = {};

    if (filter.type) {
      query.type = filter.type;
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }

    if (filter.createdAfter || filter.createdBefore) {
      query.createdAt = {};
      if (filter.createdAfter) {
        query.createdAt.$gte = filter.createdAfter;
      }
      if (filter.createdBefore) {
        query.createdAt.$lte = filter.createdBefore;
      }
    }

    return query;
  }

  /**
   * Generate key pair for actor
   */
  private generateKeyPair(): { publicKey: string; privateKey: string } {
    try {
      const { PrivateKey } = require('@bsv/sdk');
      const actorPrivateKey = PrivateKey.fromRandom();
      return {
        privateKey: actorPrivateKey.toHex(),
        publicKey: actorPrivateKey.toPublicKey().toString()
      };
    } catch (error) {
      console.error('[ActorService] Error generating key pair:', error);
      throw new Error('Failed to generate key pair');
    }
  }

  /**
   * Store DID document for actor
   */
  private async storeDIDDocument(actor: Actor): Promise<void> {
    try {
      if (!actor.did) return;

      const didDocument = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: actor.did,
        verificationMethod: [{
          id: `${actor.did}#key-1`,
          type: 'EcdsaSecp256k1VerificationKey2019',
          controller: actor.did,
          publicKeyHex: actor.publicKey
        }],
        authentication: [`${actor.did}#key-1`],
        assertionMethod: [`${actor.did}#key-1`]
      };

      await this.db.collection('did_documents').insertOne({
        did: actor.did,
        document: didDocument,
        actorId: actor.id,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('[ActorService] Error storing DID document:', error);
      // Non-critical error, continue
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Factory function to create ActorService
 */
export function createActorService(
  db: Db,
  walletClient: WalletClient,
  quarkIdAgentService?: QuarkIdAgentService,
  overlayConfig?: BsvOverlayConfig
): ActorService {
  return new ActorService(db, walletClient, quarkIdAgentService, overlayConfig);
}