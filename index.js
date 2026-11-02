import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient } from "mongodb";

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());


// MongoDB Connection Setup
const client = new MongoClient(process.env.MONGODB_URL);

export async function connectToMongoDB() {
  await client.connect();
  console.log("MongoDB Connected Successfully!");
  return client;
}
const dbClient = await connectToMongoDB();

// Project Database
const db = dbClient.db("booknook");











app.get('/', (req, res) => {
  res.send({ message: 'BookNook Server is Running.' });
});

app.listen(port, () => {
  console.log(`BookNook Server is Running at ${port}`);
});
