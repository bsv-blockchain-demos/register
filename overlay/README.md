# BlockMed DID and Credential Overlay

Overlay components for the BlockMed demo. They admit and index BSV PushDrop outputs representing DID documents and credential-status identifiers.

The [project README](../README.md) describes the application and backend. This directory contains overlay extensions and deployment configuration, rather than a standalone prescription API.

## Registered services

[deployment-info.json](deployment-info.json) registers:

| Identifier | Implementation | Purpose |
| --- | --- | --- |
| `tm_did` | [DIDTopicManager](backend/src/DIDTopicManager.ts) | Admit outputs containing a JSON DID document with an identifier and context. |
| `ls_did` | [DIDLookupServiceFactory](backend/src/DIDLookupServiceFactory.ts) | Query DID records indexed in MongoDB. |
| `tm_vc` | [VCTopicManager](backend/src/VCTopicManager.ts) | Admit outputs containing a 32-byte credential serial field. |
| `ls_vc` | [VCLookupServiceFactory](backend/src/VCLookupServiceFactory.ts) | Query indexed credential-status records. |

Topic admission checks the expected output shape. It is not a complete application policy for medical qualifications or prescription validity. The backend's default `prescriptions` topic is not registered here.

## Build the extensions

From the repository root:

```sh
npm install --prefix overlay/backend
npm run build --prefix overlay/backend
```

The backend package compiles TypeScript and exports its managers and lookup factories through [backend/mod.ts](backend/mod.ts). It does not depend on the sibling QuarkID packages used by the application's API and frontend.

## Run locally

Docker with Compose is required by the local runner. Install the tooling from the repository root:

```sh
npm install --prefix overlay
```

The directory includes two ways to supply a runtime:

- The root [docker-compose.yml](../docker-compose.yml) starts the application stack with MongoDB, MySQL and the overlay container.
- `npm start --prefix overlay` builds and starts [local-data/docker-compose.yml](local-data/docker-compose.yml), the separate local overlay stack.

Choose one stack and inspect its environment and ports before starting it. The checked-in local deployment selects mainnet, uses development database credentials and needs wallet/storage configuration. The root stack reads the repository's `.env`; use the root environment example as a reference and provide your own key values.

Match the API's `OVERLAY_PROVIDER_URL`, `DID_TOPIC` and `VC_TOPIC` to the running endpoint and registrations. The usual local overlay port is 8080.

## Tooling and checks

The root overlay package provides LARS and CARS commands. `npm run build --prefix overlay` invokes **CARS**, while `npm run build --prefix overlay/backend` compiles the local TypeScript extensions. `npm run deploy --prefix overlay` invokes deployment tooling and is not a local check.

The backend package defines Jest commands that first compile TypeScript, but no test cases are included in this checkout. Its lint script also applies fixes, so review its effects before running it.

## Licence

Both package manifests refer to `LICENSE.txt`, but that file is not included in either package. The intended licence needs confirmation.
