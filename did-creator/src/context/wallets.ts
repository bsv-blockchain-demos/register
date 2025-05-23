import { PrivateKey, KeyDeriver, WalletClient } from '@bsv/sdk'
import { WalletStorageManager, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-client'

const medicalKey = import.meta.env.VITE_MEDICAL_LICENSE_CERTIFIER!
const doctorKey = import.meta.env.VITE_DOCTOR_KEY!
const patientKey = import.meta.env.VITE_PATIENT_KEY!
const pharmacyKey = import.meta.env.VITE_PHARMACY_KEY!
const walletStorageUrl = import.meta.env.VITE_WALLET_STORAGE_URL!

export const medicalIdentityKey = PrivateKey.fromHex(medicalKey).toPublicKey().toString()
export const doctorIdentityKey = PrivateKey.fromHex(doctorKey).toPublicKey().toString()
export const patientIdentityKey = PrivateKey.fromHex(patientKey).toPublicKey().toString()
export const pharmacyIdentityKey = PrivateKey.fromHex(pharmacyKey).toPublicKey().toString()

export const createWalletClient = async (key: string): Promise<WalletClient> => {
    const rootKey = PrivateKey.fromHex(key)
    const keyDeriver = new KeyDeriver(rootKey)
    const storage = new WalletStorageManager(keyDeriver.identityKey)
    const chain = 'main'
    const services = new Services(chain)
    const wallet = new Wallet({
        chain,
        keyDeriver,
        storage,
        services,
    })
    const client = new StorageClient(wallet, walletStorageUrl)
    await storage.addWalletStorageProvider(client)
    await storage.makeAvailable()
    return new WalletClient(wallet)
}

export const medicalPromise = createWalletClient(medicalKey)
export const doctorPromise = createWalletClient(doctorKey)
export const patientPromise = createWalletClient(patientKey)
export const pharmacyPromise = createWalletClient(pharmacyKey)