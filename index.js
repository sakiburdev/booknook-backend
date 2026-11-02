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

app.post("/books", async (req, res) => {

  const data = req.body;

  const userEmail = req.user.email;

  if (data.userEmail !== userEmail) {
    return res.status(403).send({
      message: "You cannot add a book for another user",
    });
  }

  data.addedAt = new Date();

  data.totalCopies = Number(data.totalCopies);

  if (!data.title || !data.author || !data.totalCopies ||
      data.totalCopies < 1) {
    return res.status(400).send({
      message: "Please provide valid book information",
    });
  }

  // Database Book Add
  const result = await booksCollection.insertOne(data);

  res.status(201).send({
    success: true,
    message: "Book Added Successfully",
    insertedId: result.insertedId,
  });
});


app.patch("/books/:id", async (req, res) => {

  const { id } = req.params;
  const updatedData = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Book ID",
    });
  }

  delete updatedData._id;
  delete updatedData.userEmail;
  delete updatedData.addedAt;

  const result = await booksCollection.updateOne(
    {
      _id: new ObjectId(id),
      userEmail: req.user.email,
    },
    {
      $set: updatedData,
    }
  );

  if (result.matchedCount === 0) {
    return res.status(404).send({
      message: "Book Not Found or Unauthorized",
    });
  }

  res.send({
    success: true,
    message: "Book Updated Successfully",
  });
});





app.get('/', (req, res) => {
  res.send({ message: 'BookNook Server is Running.' });
});

app.listen(port, () => {
  console.log(`BookNook Server is Running at ${port}`);
});
