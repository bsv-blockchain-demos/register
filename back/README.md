# Certify a VC

- You're given some VC with a did method of the issuer, and a bitstring of (some sort of JWT)
- Lookup the issuer did endpoint
- Issuer provides a response back telling you if the VC is valid

They're using IPFS to store the bitarray of the ethereum address, and they have a field for a smart contract.

VC creates a credential status object:
type
persistence
bit array address (literally just a bit which gets flipped to 1 when revoked and 0 at first)

VCSL creates the bit array for a particular credential, creates the VC, and it can revoke or unrevoke


# TODO

- Define the DID document for the medical license issuer, verifier, doctor, pharmacy, and patient
- Define the VC structure for the medical license
- Define the VC structure for the prescription
- Define the Verification Method which the verifier will use to verify the VC
- Define what each QR code is encoding at each step
    (the IPFS address ==> the UHRP)

# Ideally
- Fix the credential creation method
- Create a did for each participant tied to a simple key in each case
- Allow third party to lookup that did
- Medical License Issuer can create a VC for a doctor
- Doctor can create a VC for a patient
- Pharmacy can verify the VC independently
