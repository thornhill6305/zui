import type { Handle } from '@sveltejs/kit';

function isTailscaleIP(ip: string): boolean {
  // Tailscale CGNAT range: 100.64.0.0/10
  const octets = ip.split('.').map(Number);
  if (octets.length === 4 && octets[0] === 100 && octets[1]! >= 64 && octets[1]! <= 127) {
    return true;
  }
  return false;
}

function isLocalIP(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip === 'localhost'
  );
}

export const handle: Handle = async ({ event, resolve }) => {
  const clientIp = event.getClientAddress();

  // Allow local and Tailscale connections, reject everything else
  if (!isLocalIP(clientIp) && !isTailscaleIP(clientIp)) {
    return new Response('Forbidden', { status: 403 });
  }

  return resolve(event);
};
