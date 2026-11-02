import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

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

// Collections
const booksCollection = db.collection("books");


// All Books
app.get("/books", async (req, res) => {

  const result = await booksCollection.find().sort({ addedAt: -1 }).toArray();

  res.send(result);
});

// Single Book
app.get("/books/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Book ID",
    });
  }

  // Book Collection Find
  const result = await booksCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!result) {
    return res.status(404).send({
      message: "Book Not Found",
    });
  }

  res.send(result);
});







app.get('/', (req, res) => {
  res.send({ message: 'BookNook Server is Running.' });
});

app.listen(port, () => {
  console.log(`BookNook Server is Running at ${port}`);
});
