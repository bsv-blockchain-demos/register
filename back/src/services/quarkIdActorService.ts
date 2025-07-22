import { Agent, DID } from '@quarkid/agent';
import { Did as DidRegistry } from '@quarkid/did-registry';
import { WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';
import * as crypto from 'crypto';

/**
 * Enhanced Actor interface with QuarkID DID integration
 */
export interface QuarkIdActor {
  id: string;
  did?: string;
  name: string;
  type: 'patient' | 'doctor' | 'pharmacy' | 'insurance';
  email?: string;
  phone?: string;
  address?: string;
  licenseNumber?: string; // For doctors and pharmacies
  specialization?: string; // For doctors
  insuranceProvider?: string; // For patients
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Service for managing actors with proper QuarkID DID integration
 */
export class QuarkIdActorService {
  private actorsCollection: any;

  constructor(
    private db: Db,
    private walletClient: WalletClient,
    private agent?: Agent,
    private didRegistry?: DidRegistry
  ) {
    this.actorsCollection = db.collection('actors');
  }

  /**
   * Create a new actor (DID creation requires proper Agent setup)
   */
  async createActorWithDid(actorData: Partial<QuarkIdActor>): Promise<QuarkIdActor> {
    try {
      // For now, create actor without DID until Agent is properly initialized
      // TODO: Implement proper DID creation once Agent KMS and registry are configured
      
      // Create actor record
      const actor: QuarkIdActor = {
        id: actorData.id || crypto.randomUUID(),
        did: undefined, // Will be set when DID creation is implemented
        name: actorData.name || '',
        type: actorData.type || 'patient',
        email: actorData.email,
        phone: actorData.phone,
        address: actorData.address,
        licenseNumber: actorData.licenseNumber,
        specialization: actorData.specialization,
        insuranceProvider: actorData.insuranceProvider,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // Save to database
      await this.actorsCollection.insertOne(actor);
      
      console.log(`Created actor without DID: ${actor.id}`);
      return actor;

    } catch (error) {
      console.error('Error creating actor:', error);
      throw new Error(`Failed to create actor: ${error.message}`);
    }
  }

  /**
   * Get actor by DID
   */
  async getActorByDid(did: string): Promise<QuarkIdActor | null> {
    const actor = await this.actorsCollection.findOne({ did: did });
    return actor;
  }

  /**
   * Get actor by ID
   */
  async getActorById(id: string): Promise<QuarkIdActor | null> {
    const actor = await this.actorsCollection.findOne({ id: id });
    return actor;
  }

  /**
   * Update actor information
   */
  async updateActor(actorId: string, updates: Partial<QuarkIdActor>): Promise<QuarkIdActor | null> {
    const updatedActor = await this.actorsCollection.findOneAndUpdate(
      { id: actorId },
      { 
        $set: { 
          ...updates,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return updatedActor.value;
  }

  /**
   * Get all actors
   */
  async getAllActors(): Promise<QuarkIdActor[]> {
    const actors = await this.actorsCollection.find({}).toArray();
    return actors;
  }

  /**
   * Get actors by type
   */
  async getActorsByType(type: QuarkIdActor['type']): Promise<QuarkIdActor[]> {
    const actors = await this.actorsCollection.find({ type: type }).toArray();
    return actors;
  }

  /**
   * Deactivate actor
   */
  async deactivateActor(actorId: string): Promise<boolean> {
    const result = await this.actorsCollection.updateOne(
      { id: actorId },
      { 
        $set: { 
          isActive: false,
          updatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Resolve DID document for an actor
   */
  async resolveDid(did: string): Promise<any> {
    try {
      if (this.agent) {
        return await this.agent.resolver.resolve(DID.from(did));
      }
      console.warn('Agent not available for DID resolution');
      return null;
    } catch (error) {
      console.error('Error resolving DID:', error);
      return null;
    }
  }
}
