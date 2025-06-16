# API

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

## Interfaces

| |
| --- |
| [DIDQuery](#interface-didquery) |
| [DIDRecord](#interface-didrecord) |

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---

### Interface: DIDQuery

```ts
export interface DIDQuery {
    serialNumber?: Base64String;
    outpoint?: string;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
### Interface: DIDRecord

```ts
export interface DIDRecord {
    txid: string;
    outputIndex: number;
    serialNumber: Base64String;
    createdAt: Date;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
## Classes

| |
| --- |
| [DIDStorageManager](#class-didstoragemanager) |
| [DIDTopicManager](#class-didtopicmanager) |

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---

### Class: DIDStorageManager

```ts
export class DIDStorageManager {
    constructor(private readonly db: Db) 
    async storeRecord(txid: string, outputIndex: number, serialNumber: Base64String): Promise<void> 
    async deleteRecord(txid: string, outputIndex: number): Promise<void> 
    async findByCertificateSerialNumber(serialNumber: Base64String): Promise<LookupFormula> 
    async findByOutpoint(outpoint: string): Promise<LookupFormula> 
}
```

<details>

<summary>Class DIDStorageManager Details</summary>

#### Constructor

Constructs a new DIDStorage instance

```ts
constructor(private readonly db: Db) 
```

Argument Details

+ **db**
  + connected mongo database instance

#### Method deleteRecord

Delete a matching DID record

```ts
async deleteRecord(txid: string, outputIndex: number): Promise<void> 
```

Argument Details

+ **txid**
  + transaction id
+ **outputIndex**
  + index of the UTXO

#### Method findByCertificateSerialNumber

Find a matching DID record by matching certificate serial number

```ts
async findByCertificateSerialNumber(serialNumber: Base64String): Promise<LookupFormula> 
```

Returns

- Returns matching UTXO references

Argument Details

+ **serialNumber**
  + Unique certificate serial number to query by

#### Method findByOutpoint

Find a matching DID record by matching outpoint

```ts
async findByOutpoint(outpoint: string): Promise<LookupFormula> 
```

Returns

- Returns matching UTXO references

Argument Details

+ **outpoint**
  + Outpoint to query by (format: "txid.outputIndex")

#### Method storeRecord

Stores a new DID record

```ts
async storeRecord(txid: string, outputIndex: number, serialNumber: Base64String): Promise<void> 
```

Argument Details

+ **txid**
  + transaction id
+ **outputIndex**
  + index of the UTXO
+ **serialNumber**
  + certificate serial number to store

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
### Class: DIDTopicManager

Implements a topic manager for DID tokens

```ts
export default class DIDTopicManager implements TopicManager {
    async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> 
    async getDocumentation(): Promise<string> 
    async getMetaData(): Promise<{
        name: string;
        shortDescription: string;
        iconURL?: string;
        version?: string;
        informationURL?: string;
    }> 
}
```

<details>

<summary>Class DIDTopicManager Details</summary>

#### Method getDocumentation

Get the documentation associated with this DID topic manager

```ts
async getDocumentation(): Promise<string> 
```

Returns

A promise that resolves to a string containing the documentation

#### Method getMetaData

Get metadata about the topic manager

```ts
async getMetaData(): Promise<{
    name: string;
    shortDescription: string;
    iconURL?: string;
    version?: string;
    informationURL?: string;
}> 
```

Returns

A promise that resolves to an object containing metadata

Throws

An error indicating the method is not implemented

#### Method identifyAdmissibleOutputs

Returns the outputs from the DID transaction that are admissible.

```ts
async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> 
```

Returns

A promise that resolves with the admittance instructions

Argument Details

+ **beef**
  + The transaction data in BEEF format
+ **previousCoins**
  + The previous coins to consider

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
