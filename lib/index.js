import { createGateway } from './gateway.js'

export const name = 'dsh-remote-hosts'

export const inject = []

/**
 * Loopback remote-host gateway.
 *
 * - always starts the gateway so the Client can manage hosts (empty state included);
 * - starts one `ssh -N -L` per configured/persisted host;
 * - hosts added/removed through `/manage/hosts` update tunnels and persist to
 *   `hostsFile` (default `$DSH_HOME/remote-hosts.json`);
 * - disposal: stops every tunnel and closes the gateway.
 *
 * @param ctx - Cordis Host context.
 * @param {{ gatewayPort?: number, hosts?: unknown[], hostsFile?: string }} config - profile-patch config.
 */
export async function apply(ctx, config = {}) {
  const hosts = Array.isArray(config.hosts) ? config.hosts : []
  const gateway = createGateway({
    gatewayPort: config.gatewayPort,
    hosts,
    hostsFile: config.hostsFile,
    sshConfigFile: config.sshConfigFile,
  }, ctx.logger ?? console)
  ctx.effect(() => () => gateway.stop(), 'remote-hosts: gateway')
  await gateway.start()
  ctx.on('webserver/index-inject', table => {
    table.push({ kind: 'global', name: '__DSH_REMOTE_HOSTS_CONFIG__', value: { gateway: `http://127.0.0.1:${gateway.status().gatewayPort}` } })
  })
}
