export function attachReplication (swarm, core) {
  swarm.on('connection', (conn) => {
    core.replicate(conn, { live: true }) //using live mode from hypercore, si no funciona canvio
  })
}