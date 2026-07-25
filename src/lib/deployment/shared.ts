/**
 * Values and quoting helpers shared by the per-platform deployment scripts.
 * The SHA-256 digests pin the official RustDesk OSS release the scripts are
 * allowed to install.
 */
export const DEFAULT_RUSTDESK_VERSION = '1.4.9'

export type DeploymentPlatform = 'windows' | 'linux' | 'macos'

export interface DeploymentScriptOptions {
  baseUrl: string
  token: string
  installIfMissing: boolean
  rustdeskConfig?: string | null
}

export const DOWNLOAD_SHA256 = {
  windows: {
    x86_64: 'c87d2f4cef2a5acd6003b6507dcfbf5d5168a256db082cd90b54d35193224aaa',
    aarch64: '30bc8925e62c7ade52371758c2b944036ed2386f6c554e9e59f3bcfef06c7cd9',
  },
  deb: {
    x86_64: '7244ba47c40e804172044bfbe659467c54ce46554c98e78c8c0406f1d612fda3',
    aarch64: 'ce62c996f14d33f3bbe3a330e953644a44bace7f05885a7953f7395d69fb49c0',
  },
  rpm: {
    x86_64: 'eb1b053ac5b2f774f2271f7fbbfd2ea475899f7a55135c5e172bc54b9388f108',
    aarch64: '3e523df7ceb6f3804b047a3cac797354c4bf46ec19f2d7ff5e198787003cb092',
  },
  suse: {
    x86_64: 'b28bdb5a4afcd3f0475664ad2e635eb4209f15ed44566f83469453b175e8a197',
    aarch64: 'e426192be57357eb9178f886b92188d6839eeb438d64a206fcea9dfb49eaee59',
  },
  arch: '679760e1a1f1b930529069edfaec219afa16b5efe44c1bc593cede0e65576c11',
  macos: {
    x86_64: 'fa1129a0635019f9c5841937942cc2b08be028a192f47c009edde7e53812904e',
    aarch64: 'f7935597b247d42c8f2a2ed71176a9f5868018cd9e1a33b8096418a668c8caf0',
  },
} as const

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

export function powershellQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

export function normalizedOrigin(value: string): string {
  return new URL(value).origin
}
