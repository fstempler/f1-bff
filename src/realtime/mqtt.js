import mqtt from "mqtt";
import { getAccessToken } from "../services/auth";

export function startMqtt(hub) {
    //"hub" is an object were you store "last driver"
    (async () => {
        const token = await getAccessToken();
        const client = mqtt.connect('wss://mqtt.openf1.org:8084/mqtt', {
            username: 'fmstempler@gmail.com',
            password: token
        });
        client.on('connect', () => {
            console.log('[MQTT] connected');
            client.subscribe('v1/position');
            client.subscribe('v1/laps');
            client.subscribe('v1/pit');
            // client.subscribe('v1/intervals'); // en WSS sí llega en vivo
            // client.subscribe('v1/car_data');
        });
        client.on('message', (topic, message) => {
            const payload = JSON.parse(message.toString());
            hub.ingest(topic, payload);
        });
    })().catch(console.error);
}