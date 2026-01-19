// Type declarations to augment libsignal's incomplete TypeScript definitions
// The upstream @whiskeysockets/libsignal-node has .d.ts files but they're missing curve/crypto exports

declare module 'libsignal' {
	export interface KeyPairType {
		pubKey: Uint8Array
		privKey: Uint8Array
	}

	export const curve: {
		generateKeyPair(): KeyPairType
		calculateAgreement(publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array
		calculateSignature(privateKey: Uint8Array, message: Uint8Array): Uint8Array
		verifySignature(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean
	}

	export const crypto: {
		encrypt(key: Uint8Array, data: Uint8Array, iv: Uint8Array): Uint8Array
		decrypt(key: Uint8Array, data: Uint8Array, iv: Uint8Array): Uint8Array
		calculateMAC(key: Uint8Array, data: Uint8Array): Uint8Array
	}

	export const keyhelper: {
		generateIdentityKeyPair(): KeyPairType
		generateRegistrationId(): number
		generatePreKey(keyId: number): { keyId: number; keyPair: KeyPairType }
		generateSignedPreKey(identityKeyPair: KeyPairType, keyId: number): {
			keyId: number
			keyPair: KeyPairType
			signature: Uint8Array
		}
	}

	export interface SignalStorage {
		loadSession(id: string): Promise<SessionRecord | null | undefined>
		storeSession(id: string, session: SessionRecord): Promise<void>
		isTrustedIdentity(identifier: string, identityKey: Uint8Array, direction: number): boolean
		loadPreKey(id: number | string): Promise<{ privKey: Buffer; pubKey: Buffer } | undefined>
		removePreKey(id: number): void
		loadSignedPreKey(): { privKey: Buffer; pubKey: Buffer }
		getOurRegistrationId(): Promise<number> | number
		getOurIdentity(): { privKey: Buffer; pubKey: Buffer }
	}

	export class ProtocolAddress {
		constructor(name: string, deviceId: number)
		public id: string
		public deviceId: number
		public toString(): string
	}

	export class SessionRecord {
		static deserialize(serialized: Uint8Array): SessionRecord
		public serialize(): Uint8Array
		public haveOpenSession(): boolean
	}

	export class SessionCipher {
		constructor(storage: SignalStorage, remoteAddress: ProtocolAddress)
		public decryptPreKeyWhisperMessage(ciphertext: Uint8Array): Promise<Buffer>
		public decryptWhisperMessage(ciphertext: Uint8Array): Promise<Buffer>
		public encrypt(data: Uint8Array): Promise<{ type: number; body: string }>
	}

	export class SessionBuilder {
		constructor(storage: SignalStorage, remoteAddress: ProtocolAddress)
		public initOutgoing(session: {
			registrationId: number
			identityKey: Uint8Array
			signedPreKey: { keyId: number; publicKey: Uint8Array; signature: Uint8Array }
			preKey: { keyId: number; publicKey: Uint8Array }
		}): Promise<void>
	}

	// Error classes
	export class SignalError extends Error {}
	export class UntrustedIdentityKeyError extends SignalError {}
	export class SessionError extends SignalError {}
}
