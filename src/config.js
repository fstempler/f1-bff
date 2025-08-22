import 'dotenv/config';

export const config = {
    port: Number(process.env.PORT ?? 5055),
    openf1Base: process.env.OPENF1_BASE ?? 'http://api.openf1.org/v1',
    openf1AuthUrl: process.env.OPENF1_AUTH_URL ?? 'http://api.openf1.org/token',
    poll: {
        meta: Number(process.env.POLL_META_MS ?? 60000),
        live: Number(process.env.POLL_META_MS ?? 1000),
    },
    limits: {
        openf1MaxRps: Number(process.env.OPENF1_MAX_RPS ?? 5),
    },
    mqtt: {
        brokerUrl: process.env.MQTT_BROKER_URL ?? 'mqtts://mqtt.openf1.org:8883',
        wsUrl: process.env.MQRR_WS_URL ?? 'wss://mqtt.openf1.org:8084/mqtt',
    }
};