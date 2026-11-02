import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());



app.get('/', (req, res) => {
  res.send({ message: 'BookNook Server is Running.' });
});

app.listen(port, () => {
  console.log(`BookNook Server is Running at ${port}`);
});
