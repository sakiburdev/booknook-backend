import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const port = process.env.PORT || 8000;

const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

const JWKS = createRemoteJWKSet(new URL(`${BETTER_AUTH_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      success: false,
      message: "Authorization token is required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({
      success: false,
      message: "Token not found",
    });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: BETTER_AUTH_URL,
      audience: BETTER_AUTH_URL,
    });

    if (!payload.email) {
      return res.status(401).send({
        success: false,
        message: "User email not found in token",
      });
    }

    req.user = payload;

    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);

    return res.status(401).send({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URL);

await client.connect();

console.log("MongoDB Connected Successfully!");

const db = client.db("booknook");

// Collections
const booksCollection = db.collection("books");
const borrowsCollection = db.collection("borrows");

app.get("/books/mine", verifyToken, async (req, res) => {
  const result = await booksCollection
    .find({ userEmail: req.user.email })
    .sort({ addedAt: -1 })
    .toArray();

  res.send(result);
});

app.get("/books", async (req, res) => {
  const result = await booksCollection.find().sort({ addedAt: -1 }).toArray();

  res.send(result);
});

app.get("/books/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Book ID",
    });
  }

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

app.post("/books", verifyToken, async (req, res) => {
  // ok
  const data = req.body;
  const userEmail = req.user.email;

  if (data.userEmail !== userEmail) {
    return res.status(403).send({
      message: "You cannot add a book for another user",
    });
  }

  data.addedAt = new Date();
  data.totalCopies = Number(data.totalCopies);
  data.userName = req.user.name || data.userEmail;

  if (
    !data.title ||
    !data.author ||
    !Number.isInteger(data.totalCopies) ||
    data.totalCopies < 1
  ) {
    return res.status(400).send({
      message: "Please provide valid book information",
    });
  }

  const result = await booksCollection.insertOne(data);

  res.status(201).send({
    success: true,
    message: "Book Added Successfully",
    insertedId: result.insertedId,
  });
});

app.patch("/books/:id", verifyToken, async (req, res) => {
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

  if (updatedData.totalCopies !== undefined) {
    updatedData.totalCopies = Number(updatedData.totalCopies);

    if (
      !Number.isInteger(updatedData.totalCopies) ||
      updatedData.totalCopies < 1
    ) {
      return res.status(400).send({
        message: "Invalid total copies",
      });
    }
  }

  const result = await booksCollection.updateOne(
    {
      _id: new ObjectId(id),
      userEmail: req.user.email,
    },
    {
      $set: updatedData,
    },
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

app.delete("/books/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Book ID",
    });
  }

  const result = await booksCollection.deleteOne({
    _id: new ObjectId(id),
    userEmail: req.user.email,
  });

  if (result.deletedCount === 0) {
    return res.status(404).send({
      message: "Book Not Found or Unauthorized",
    });
  }

  res.send({
    success: true,
    message: "Book Deleted Successfully",
  });
});

app.post("/borrows", verifyToken, async (req, res) => {
  const { bookId, returnDate } = req.body;

  const userEmail = req.user.email;
  const userName = req.user.name || "BookNook User";

  if (!ObjectId.isValid(bookId)) {
    return res.status(400).send({
      message: "Invalid Book ID",
    });
  }

  const book = await booksCollection.findOne({
    _id: new ObjectId(bookId),
  });

  if (!book) {
    return res.status(404).send({
      message: "Book Not Found",
    });
  }

  const alreadyBorrowed = await borrowsCollection.findOne({
    bookId: new ObjectId(bookId),
    userEmail,
  });

  if (alreadyBorrowed) {
    return res.status(409).send({
      message: "You have already borrowed this book",
    });
  }

  if (book.totalCopies <= 0) {
    return res.status(400).send({
      message: "Book is Not Available",
    });
  }

  const borrowDate = new Date();
  const selectedReturnDate = new Date(returnDate);

  if (
    !returnDate ||
    isNaN(selectedReturnDate.getTime()) ||
    selectedReturnDate <= borrowDate
  ) {
    return res.status(400).send({
      message: "Please provide a valid future return date",
    });
  }

  // Decrease available copies
  const updatedBook = await booksCollection.findOneAndUpdate(
    {
      _id: new ObjectId(bookId),
      totalCopies: { $gt: 0 },
    },
    {
      $inc: { totalCopies: -1 },
    },
    {
      returnDocument: "after",
    },
  );

  if (!updatedBook) {
    return res.status(400).send({
      message: "Book is Not Available",
    });
  }

  const borrowData = {
    bookId: new ObjectId(bookId),
    bookTitle: book.title,
    bookImage: book.image,
    userName,
    userEmail,
    borrowDate,
    returnDate: selectedReturnDate,
  };

  const result = await borrowsCollection.insertOne(borrowData);

  res.status(201).send({
    success: true,
    message: "Book Borrowed Successfully",
    insertedId: result.insertedId,
  });
});

app.get("/borrows", verifyToken, async (req, res) => {
  const result = await borrowsCollection
    .find({ userEmail: req.user.email })
    .sort({ borrowDate: -1 })
    .toArray();

  res.send(result);
});

app.delete("/borrows/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({
      message: "Invalid Borrow ID",
    });
  }

  const borrow = await borrowsCollection.findOne({
    _id: new ObjectId(id),
    userEmail: req.user.email,
  });

  if (!borrow) {
    return res.status(404).send({
      message: "Borrow Record Not Found",
    });
  }

  const result = await borrowsCollection.deleteOne({
    _id: new ObjectId(id),
    userEmail: req.user.email,
  });

  if (result.deletedCount === 0) {
    return res.status(404).send({
      message: "Borrow Record Not Found",
    });
  }

  // Increase available copies after returning
  await booksCollection.updateOne(
    {
      _id: borrow.bookId,
    },
    {
      $inc: { totalCopies: 1 },
    },
  );

  res.send({
    success: true,
    message: "Book Returned Successfully",
  });
});

app.get("/", (req, res) => {
  res.send({
    message: "BookNook Server is Running.",
  });
});

// Start Server
app.listen(port, () => {
  console.log(`BookNook Server is Running ${port}`);
});
