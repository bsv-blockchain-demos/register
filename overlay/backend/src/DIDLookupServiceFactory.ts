import { DIDStorageManager } from './DIDStorageManager.js'
import { AdmissionMode, LookupFormula, LookupQuestion, LookupService, OutputAdmittedByTopic, OutputSpent, SpendNotificationMode } from '@bsv/overlay'
import { LookupAnswer, PushDrop, Utils } from '@bsv/sdk'
import docs from './docs/DIDLookupDocs.md.js'
import { Db } from 'mongodb'
import { DIDQuery } from 'mod.js'

/**
 * Implements a lookup service for DID tokens
 * @public
 */
class DIDLookupService implements LookupService {
  readonly admissionMode: AdmissionMode = 'locking-script'
  readonly spendNotificationMode: SpendNotificationMode = 'none'

  constructor(public storageManager: DIDStorageManager) { }

  async outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void> {
    if (payload.mode !== 'locking-script') throw new Error('Invalid payload')
    const { txid, outputIndex, topic, lockingScript } = payload
    if (topic !== 'tm_did') return
    console.log(`DID lookup service outputAdded called with ${txid}.${outputIndex}`)
    
    try {
      // Decode the DID token fields from the Bitcoin outputScript
      const result = PushDrop.decode(lockingScript)
      
      // The first field now contains the full DID document as JSON
      const didDocumentString = Utils.toUTF8(result.fields[0])
      const didDocument = JSON.parse(didDocumentString)
      
      // Extract the serialNumber from the DID document ID
      // Format: did:bsv:tm_did:serialNumber
      const didParts = didDocument.id.split(':')
      const serialNumber = didParts[3] // This is the serialNumber used for lookups
      
      console.log(
        'DID lookup service is storing a record',
        txid,
        outputIndex,
        serialNumber,
        'DID:', didDocument.id
      )

      // Store DID record with the extracted serialNumber
      // Note: atomicBeef parameter is expected but not used in current storage implementation
      await this.storageManager.storeRecord(
        txid,
        outputIndex,
        serialNumber,
        [] // Empty atomicBeef array - overlay provides the beef elsewhere
      )
    } catch (error) {
      console.error('Error processing DID token in lookup service:', error)
      console.error('Raw locking script:', lockingScript)
      throw error
    }
  }

  async outputSpent(payload: OutputSpent): Promise<void> {
    if (payload.mode !== 'none') throw new Error('Invalid payload')
    const { topic, txid, outputIndex } = payload
    if (topic !== 'tm_did') return
    await this.storageManager.deleteRecord(txid, outputIndex)
  }

  async outputEvicted(txid: string, outputIndex: number): Promise<void> {
    await this.storageManager.deleteRecord(txid, outputIndex)
  }

  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    console.log('DID lookup with question', question)
    if (question.query === undefined || question.query === null) {
      throw new Error('A valid query must be provided!')
    }
    if (question.service !== 'ls_did') {
      throw new Error('Lookup service not supported!')
    }

    const questionToAnswer = (question.query as DIDQuery)
    let results

    if (questionToAnswer.serialNumber != null) {
      results = await this.storageManager.findByCertificateSerialNumber(
        questionToAnswer.serialNumber
      )
      return results
    }

    if (questionToAnswer.outpoint != null) {
      results = await this.storageManager.findByOutpoint(
        questionToAnswer.outpoint
      )
      return results
    }

    throw new Error('No valid query parameters provided!')
  }

  async getDocumentation(): Promise<string> {
    return docs
  }

  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'DID Lookup Service',
      shortDescription: 'DID resolution made easy.'
    }
  }
}

// Factory function
export default (db: Db): DIDLookupService => {
  return new DIDLookupService(new DIDStorageManager(db))
}
