/**
 * Deployment scripts that enroll a RustDesk OSS device without an interactive
 * login. One module per platform; this file is the entry point.
 */
import { linuxScript } from './deployment/linux'
import { macosScript } from './deployment/macos'
import { windowsScript } from './deployment/windows'

export {
  DEFAULT_RUSTDESK_VERSION,
  type DeploymentPlatform,
  type DeploymentScriptOptions,
} from './deployment/shared'

import type {
  DeploymentPlatform,
  DeploymentScriptOptions,
} from './deployment/shared'

export function buildDeploymentScript(
  platform: DeploymentPlatform,
  options: DeploymentScriptOptions,
): string {
  if (platform === 'windows') return windowsScript(options)
  if (platform === 'linux') return linuxScript(options)
  return macosScript(options)
}

export function buildDeploymentScripts(options: DeploymentScriptOptions) {
  return {
    windows: buildDeploymentScript('windows', options),
    linux: buildDeploymentScript('linux', options),
    macos: buildDeploymentScript('macos', options),
  }
}
