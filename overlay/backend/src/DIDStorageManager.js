"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIDStorageManager = void 0;
// Implements a Lookup Storage Manager for DID tokens
class DIDStorageManager {
    /**
     * Constructs a new DIDStorage instance
     * @param {Db} db - connected mongo database instance
     */
    constructor(db) {
        this.db = db;
        this.records = db.collection('didRecords');
        this.records.createIndex({
            searchableAttributes: 'text'
        }).catch((e) => console.error(e));
    }
    /**
     * Stores a new DID record
     * @param {string} txid transaction id
     * @param {number} outputIndex index of the UTXO
     * @param {Base64String} serialNumber certificate serial number to store
     */
    async storeRecord(txid, outputIndex, serialNumber, atomicBeef) {
        await this.records.insertOne({
            txid,
            outputIndex,
            serialNumber,
            createdAt: new Date(),
            atomicBeef
        });
    }
    /**
     * Delete a matching DID record
     * @param {string} txid transaction id
     * @param {number} outputIndex index of the UTXO
     */
    async deleteRecord(txid, outputIndex) {
        await this.records.deleteOne({ txid, outputIndex });
    }
    /**
     * Find a matching DID record by matching certificate serial number
     * @param {Base64String} serialNumber - Unique certificate serial number to query by
     * @returns {Promise<LookupFormula>} - Returns matching UTXO references
     */
    async findByCertificateSerialNumber(serialNumber) {
        return await this.findRecordWithQuery({ serialNumber });
    }
    /**
     * Find a matching DID record by matching outpoint
     * @param {string} outpoint - Outpoint to query by (format: "txid.outputIndex")
     * @returns {Promise<LookupFormula>} - Returns matching UTXO references
     */
    async findByOutpoint(outpoint) {
        // Parse txid and outputIndex from the outpoint string (format: "txid.outputIndex")
        const [txid, outputIndexStr] = outpoint.split('.');
        const outputIndex = parseInt(outputIndexStr, 10);
        if (!txid || isNaN(outputIndex)) {
            throw new Error('Invalid outpoint format. Expected "txid.outputIndex"');
        }
        return await this.findRecordWithQuery({ txid, outputIndex });
    }
    /**
     * Helper function for querying from the database
     * @param {object} query
     * @returns {Promise<LookupFormula>} returns matching UTXO references
     */
    async findRecordWithQuery(query) {
        // Find matching results from the DB
        const results = await this.records.find(query).project({ txid: 1, outputIndex: 1 }).toArray();
        return results.map((record) => {
            return {
                txid: record.txid,
                outputIndex: record.outputIndex
            };
        });
    }
}
exports.DIDStorageManager = DIDStorageManager;
//# sourceMappingURL=DIDStorageManager.js.map