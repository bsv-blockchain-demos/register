
import OverlayExpress from '@bsv/overlay-express'
import { Transaction, ARC } from '@bsv/sdk'
import tm_tm_did from '/app/src/DIDTopicManager.ts'
import tm_tm_vc from '/app/src/VCTopicManager.ts'
import lsf_ls_did from '/app/src/DIDLookupServiceFactory.ts'
import lsf_ls_vc from '/app/src/VCLookupServiceFactory.ts'


// Wrapper to add broadcasting functionality to TopicManagers
const wrapTopicManager = (originalManager: any, topicName: string) => {
  return {
    ...originalManager,
    async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]) {
      const result = await originalManager.identifyAdmissibleOutputs(beef, previousCoins)
      
      // If outputs were admitted, broadcast the transaction to mainnet
      if (result.outputsToAdmit && result.outputsToAdmit.length > 0) {
        try {
          const transaction = Transaction.fromBEEF(beef)
          console.log(`[${topicName}] Broadcasting transaction ${transaction.id('hex')} to mainnet...`)
          
          if (broadcaster) {
            const result = await transaction.broadcast(broadcaster)
            if (result.status === 'success') {
              console.log(`[${topicName}] Successfully broadcasted transaction to mainnet: ${result.txid}`)
            } else {
              console.error(`[${topicName}] Broadcasting failed:`, result)
            }
          } else {
            console.warn(`[${topicName}] ARC broadcaster not available for broadcasting`)
          }
        } catch (error) {
          console.error(`[${topicName}] Error broadcasting transaction to mainnet:`, error)
          // Don't throw - overlay should still work even if mainnet broadcast fails
        }
      }
      
      return result
    }
  }
}

let broadcaster: ARC | null = null

const main = async () => {
    // Initialize ARC broadcaster for mainnet broadcasting if API key is available
    if (process.env.ARC_API_KEY) {
      try {
        console.log('[BLOCKMED OVERLAY] Initializing ARC broadcaster for mainnet...')
        broadcaster = new ARC('https://arc.taal.com', {
          apiKey: process.env.ARC_API_KEY
        })
        console.log('[BLOCKMED OVERLAY] ARC broadcaster initialized successfully')
      } catch (error) {
        console.error('[BLOCKMED OVERLAY] Failed to initialize ARC broadcaster:', error)
        console.warn('[BLOCKMED OVERLAY] Continuing without mainnet broadcasting capability')
      }
    } else {
      console.log('[BLOCKMED OVERLAY] ARC_API_KEY not provided - mainnet broadcasting disabled')
    }

    const adminToken = process.env.ADMIN_BEARER_TOKEN; // may be undefined
    const server = new OverlayExpress(
        `BlockMed`,
        process.env.SERVER_PRIVATE_KEY!,
        process.env.HOSTING_URL!,
        adminToken
    )

    server.configurePort(8080)
    server.configureVerboseRequestLogging(process.env.REQUEST_LOGGING === 'true')
    server.configureNetwork(process.env.NETWORK === 'mainnet' ? 'main' : 'test')
    await server.configureKnex(process.env.KNEX_URL!)
    await server.configureMongo(process.env.MONGO_URL!)
    server.configureEnableGASPSync(process.env.GASP_SYNC === 'true')

    if (process.env.ARC_API_KEY) {
      server.configureArcApiKey(process.env.ARC_API_KEY)
    }

    // Apply advanced engine config from environment
    const logTime = process.env.LOG_TIME === 'true'
    const logPrefix = process.env.LOG_PREFIX || '[LARS OVERLAY ENGINE] '
    const throwOnBroadcastFailure = process.env.THROW_ON_BROADCAST_FAIL === 'true'
    let parsedSyncConfig = {}
    if (process.env.SYNC_CONFIG_JSON) {
      try {
        parsedSyncConfig = JSON.parse(process.env.SYNC_CONFIG_JSON)
      } catch(e) {
        console.error('Failed to parse SYNC_CONFIG_JSON:', e)
      }
    }

    server.configureEngineParams({
      logTime,
      logPrefix,
      throwOnBroadcastFailure,
      syncConfiguration: parsedSyncConfig
    })
    // Wrap topic managers with broadcasting functionality
    const didTopicManager = new tm_tm_did()
    const vcTopicManager = new tm_tm_vc()
    
    server.configureTopicManager('tm_did', wrapTopicManager(didTopicManager, 'DID_TOPIC'))
    server.configureTopicManager('tm_vc', wrapTopicManager(vcTopicManager, 'VC_TOPIC'))
    server.configureLookupServiceWithMongo('ls_did', lsf_ls_did)
    server.configureLookupServiceWithMongo('ls_vc', lsf_ls_vc)

    await server.configureEngine()
    await server.start()
}

main()
