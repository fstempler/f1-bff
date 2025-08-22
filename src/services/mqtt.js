import mqtt from 'mqtt';
import { getAccessToken } from './auth.js';
import { config } from '../config.js';

let client = null;

export async function connectMqtt() {
  if (client && client.connected) return client;
  const token = await getAccessToken();

  client = mqtt.connect(config.mqtt.brokerUrl, {
    username: process.env.OPENF1_AUTH_USERNAME || 'user',
    password: token,
    reconnectPeriod: 3000,
    protocolVersion: 4
  });

  client.on('error', err => console.error('[mqtt] error', err?.message));
  client.on('reconnect', () => console.log('[mqtt] reconnecting...'));
  client.on('close', () => console.log('[mqtt] closed'));

  await new Promise((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('error', reject);
  });
  return client;
}

export async function subscribe(topic, onMessage) {
  const c = await connectMqtt();
  const handler = (t, buf) => {
    if (t === topic || topic === '#') {
      try { onMessage(t, JSON.parse(buf.toString())); }
      catch { /* ignore non-JSON */ }
    }
  };
  c.on('message', handler);
  c.subscribe(topic, { qos: 0 });
  return () => { try { c.off('message', handler); c.unsubscribe(topic); } catch {} };
}
