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