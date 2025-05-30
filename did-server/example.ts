import {
    VerificationMethod,
    VerificationMethodGpg,
    VerificationMethodJwk,
    VerificationMethodPublicKey58,
    VerificationMethodTypes,
  } from "./verification-method";
  import { Service } from "./service";
  export interface DIDDocument {
    "@context": string | string[] | undefined | null;
    id: string;
    verificationMethod: Array<
      | VerificationMethodPublicKey58
      | VerificationMethodGpg
      | VerificationMethodJwk
    >;
    authentication: Array<
      | string
      | VerificationMethodPublicKey58
      | VerificationMethodGpg
      | VerificationMethodJwk
    >;
    assertionMethod: Array<
      | string
      | VerificationMethodPublicKey58
      | VerificationMethodGpg
      | VerificationMethodJwk
    >;
    keyAgreement: Array<
      | string
      | VerificationMethodPublicKey58
      | VerificationMethodGpg
      | VerificationMethodJwk
    >;
    capabilityDelegation: Array<
      | string
      | VerificationMethodPublicKey58
      | VerificationMethodGpg
      | VerificationMethodJwk
    >;
    capabilityInvocation: Array<
      | string
      | VerificationMethodPublicKey58
      | VerificationMethodGpg
      | VerificationMethodJwk
    >;
    service?: Array<Service>;
  }
  export interface DIDDocumentMetadata {
    document: DIDDocument;
    metadata: any;
  }
  export class DIDDocumentUtils {
    static getServiceUrl(
      didDocument: DIDDocument,
      serviceType: string,
      serviceEndpointMapKey?: string
    ): string[] {
      try {
        const { serviceEndpoint } = didDocument.service.find(
          (service) => service.type === serviceType
        );
        if (typeof serviceEndpoint === "object")
          return serviceEndpoint[serviceEndpointMapKey];
        return [serviceEndpoint];
      } catch (error) {
        console.error(error);
        throw Error(`Error finding ${serviceType} service in DID Document`);
      }
    }
    static getVerificationMethodsByType(
      didDocument: DIDDocument,
      verificationMethodType: VerificationMethodTypes
    ): Array<
      | VerificationMethodPublicKey58
      | VerificationMethodGpg
      | VerificationMethodJwk
    > {
      try {
        return didDocument?.verificationMethod.filter(
          (method) => method.type === verificationMethodType
        );
      } catch (error) {
        throw Error(
          `Error finding ${verificationMethodType} verification methods in DID Document`
        );
      }
    }
    static getVerificationMethodById(
      didDocument: DIDDocument,
      verificationMethodId: string
    ): VerificationMethodPublicKey58 | VerificationMethodGpg | VerificationMethodJwk {
      try {
        return didDocument?.verificationMethod.find(
          (method) => method.id === verificationMethodId ||
          (
            didDocument.id == verificationMethodId.substring(0, verificationMethodId.indexOf("#")) &&
            method.id == verificationMethodId.substring(verificationMethodId.indexOf("#"))
          )
        );
      } catch (error) {
        throw Error(
          `Error finding ${verificationMethodId} verification method in DID Document`
        );
      }
    }
  }