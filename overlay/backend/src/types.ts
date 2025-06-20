import { Base64String } from "@bsv/sdk"
import { AtomicBEEF } from "@bsv/sdk"

export interface DIDRecord {
  txid: string
  outputIndex: number
  serialNumber: Base64String
  atomicBeef: AtomicBEEF
  createdAt: Date
}

export interface DIDQuery {
  serialNumber?: Base64String,
  outpoint?: string
}

export interface VCRecord {
  txid: string
  outputIndex: number
  serialNumber: Base64String
  atomicBeef: AtomicBEEF
  createdAt: Date
}

export interface VCQuery {
  serialNumber?: Base64String,
  outpoint?: string
}