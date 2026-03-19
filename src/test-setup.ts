import { webcrypto } from "node:crypto";

// Node 18 doesn't expose crypto as a global — required by jose
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}
