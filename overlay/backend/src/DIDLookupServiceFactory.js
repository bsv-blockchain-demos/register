"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const DIDStorageManager_js_1 = require("./DIDStorageManager.js");
const sdk_1 = require("@bsv/sdk");
const DIDLookupDocs_md_js_1 = __importDefault(require("./docs/DIDLookupDocs.md.js"));
/**
 * Implements a lookup service for DID tokens
 * @public
 */
class DIDLookupService {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.admissionMode = 'locking-script';
        this.spendNotificationMode = 'none';
    }
    async outputAdmittedByTopic(payload) {
        if (payload.mode !== 'locking-script')
            throw new Error('Invalid payload');
        const { txid, outputIndex, topic, lockingScript } = payload;
        if (topic !== 'tm_did')
            return;
        console.log(`DID lookup service outputAdded called with ${txid}.${outputIndex}`);
        // Decode the DID token fields from the Bitcoin outputScript
        const result = sdk_1.PushDrop.decode(lockingScript);
        const serialNumber = sdk_1.Utils.toUTF8(result.fields[0]);
        console.log('DID lookup service is storing a record', txid, outputIndex, serialNumber);
        // Store DID record
        await this.storageManager.storeRecord(txid, outputIndex, serialNumber);
    }
    async outputSpent(payload) {
        if (payload.mode !== 'none')
            throw new Error('Invalid payload');
        const { topic, txid, outputIndex } = payload;
        if (topic !== 'tm_did')
            return;
        await this.storageManager.deleteRecord(txid, outputIndex);
    }
    async outputEvicted(txid, outputIndex) {
        await this.storageManager.deleteRecord(txid, outputIndex);
    }
    async lookup(question) {
        console.log('DID lookup with question', question);
        if (question.query === undefined || question.query === null) {
            throw new Error('A valid query must be provided!');
        }
        if (question.service !== 'ls_did') {
            throw new Error('Lookup service not supported!');
        }
        const questionToAnswer = question.query;
        let results;
        if (questionToAnswer.serialNumber != null) {
            results = await this.storageManager.findByCertificateSerialNumber(questionToAnswer.serialNumber);
            return results;
        }
        if (questionToAnswer.outpoint != null) {
            results = await this.storageManager.findByOutpoint(questionToAnswer.outpoint);
            return results;
        }
        throw new Error('No valid query parameters provided!');
    }
    async getDocumentation() {
        return DIDLookupDocs_md_js_1.default;
    }
    async getMetaData() {
        return {
            name: 'DID Lookup Service',
            shortDescription: 'DID resolution made easy.'
        };
    }
}
// Factory function
exports.default = (db) => {
    return new DIDLookupService(new DIDStorageManager_js_1.DIDStorageManager(db));
};
//# sourceMappingURL=DIDLookupServiceFactory.js.map