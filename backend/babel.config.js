// WP-22: solo se usa para que Jest (test/jest-e2e.json) pueda transformar
// las dependencias ESM-only de @hyperledger/fabric-gateway (@noble/curves,
// @noble/hashes) a CommonJS — Jest no soporta el `require(esm)` síncrono
// nativo de Node 22+ que sí usa `nest start` en ejecución normal. No afecta
// a ts-jest (TypeScript), que sigue siendo el transform de .ts/.js propios.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
