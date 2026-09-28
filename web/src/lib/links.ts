/** Every outbound URL used by ixiscope, in one place. Docs links go to the most specific page. */
const DOCS = 'https://docs.ixian.io/docs';

export const links = {
  site: 'https://www.ixian.io/',
  github: 'https://github.com/ixian-platform',
  explorerRepo: 'https://github.com/ixian-platform/Ixian-Explorer',
  privacy: 'https://www.ixian.io/privacy-policy',
  terms: 'https://www.ixian.io/terms-of-use',
  cookies: 'https://www.ixian.io/cookie-policy',
  runNode: 'https://www.ixian.io/get-involved#ixi-mining',
  docs: {
    home: 'https://docs.ixian.io/',
    addresses: `${DOCS}/architecture/10_data-structures/addresses`,
    blocks: `${DOCS}/architecture/10_data-structures/blocks`,
    transactions: `${DOCS}/architecture/10_data-structures/transactions`,
    signatures: `${DOCS}/architecture/10_data-structures/block-signatures`,
    parameters: `${DOCS}/architecture/network-parameters`,
    consensus: `${DOCS}/architecture/ixiac-consensus`,
    emission: `${DOCS}/architecture/ixi-emission`,
    economics: `${DOCS}/architecture/economics`,
    roadmap: `${DOCS}/architecture/roadmap`,
    topology: `${DOCS}/architecture/network-topology`,
    operatorsDlt: `${DOCS}/operators/dlt`,
    operatorsS2: `${DOCS}/operators/s2`,
    glossary: `${DOCS}/glossary`,
  },
} as const;
