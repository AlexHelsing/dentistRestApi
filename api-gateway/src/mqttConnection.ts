import mqtt from 'mqtt';

const BROKER_URL = process.env.BROKER_URL || "mqtt://test.mosquitto.org"; 
const USER = process.env.USER || 'user';
const PASSWORD = process.env.PASSWORD || 'password';

const client =  mqtt.connect(BROKER_URL, {username: USER, password: PASSWORD});

client.on('connect', () => {
    console.log(`Mqtt connected to broker at ${BROKER_URL}`);
})

client.on('error', (err) => {
    console.error(err.message)
})

export default client;