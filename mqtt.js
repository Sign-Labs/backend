import express from 'express';
import axios from 'axios';
import mqtt from "mqtt"; // import namespace "mqtt"
let client = mqtt.connect("mqtt://test.mosquitto.org"); // create a client

const app = express();
app.use(express.json());

// Subscribe to MQTT topics
client.on('connect', () => {
  console.log('Connected to MQTT');
  client.subscribe('device/+/status'); // wildcard topic
});

// When a message is received
client.on('message', async (topic, message) => {
  const data = message.toString();
  const apiPath = `/${topic}`; // แปลงเป็น API endpoint

  try {
    const res = await axios.post(`http://localhost:3000${apiPath}`, { data });
    console.log('Forwarded to API:', res.data);
  } catch (error) {
    console.error('API error:', error.response?.data || error.message);
  }
});


client.on('connect', () => {
  console.log('Connected to MQTT');
  client.subscribe('device/+/status'); // wildcard topic
});

// When a message is received
client.on('message', async (topic, message) => {
  const data = message.toString();
  const apiPath = `/${topic}`; // แปลงเป็น API endpoint

  try {
    const res = await axios.post(`http://localhost:3000${apiPath}`, { data });
    console.log('Forwarded to API:', res.data);
  } catch (error) {
    console.error('API error:', error.response?.data || error.message);
  }
});