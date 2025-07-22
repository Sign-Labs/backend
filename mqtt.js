import express from 'express';
import mqtt from "mqtt"; 
import { createClient } from 'redis';

const app = express();
import dotenv from 'dotenv';

dotenv.config(); 

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});
await redisClient.connect();
const brokerUrl = process.env.MQTT_BROKER_URL ;




export function startMQTT() {
 const client= mqtt.connect(brokerUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
});

  client.on("connect", () => {
    console.log(` Connected to MQTT broker at ${brokerUrl}`);
    client.subscribe("#"); // subscribe ทุก topic
  });

  client.on("message", async (topic, message) => {
    const msg = message.toString();
    console.log(` MQTT: ${topic} → ${msg}`);

    try {
      await redisClient.set(`mqtt:${topic}`, msg, { EX: 300 }); // TTL 5 นาที
      console.log(` Saved to Redis (expires in 5 min): mqtt:${topic}`);
    } catch (err) {
      console.error(" Redis Error:", err);
    }
  });
}