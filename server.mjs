import express from "express"
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import dotenv from "dotenv"
import OpenAI from "openai";
import cors from "cors"

dotenv.config()

const PORT = process.env.PORT;
const app = express()

app.use(express.json())
app.use(cors({
    origin: "*"
}))
const client = new MongoClient(process.env.MONGODB_URI,
    { serverApi: ServerApiVersion.v1 }
);
await client.connect();
await client.db("vector-search").command({ ping: 1 });
console.log("You successfully connected to MongoDB!");


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const db = client.db("vector-search")
const postCollection = db.collection('posts');

app.get("/api/v1/posts", async (req, res) => {
    try {
        const cursor = db.collection('posts').find({}).sort({ _id: -1 })
        const allPosts = await cursor.toArray()
        res.status(200).send({
            success: true,
            data: allPosts
        })
    } catch (error) {
        res.status(400).send({
            success: false,
            message: "Failed To Fetch All Post, Try again later"
        })
    }
})

app.get("/api/v1/post/:id", async (req, res) => {
    try {
        const cursor = db.collection('posts').find({ _id: new ObjectId(req.params.id) })
        const post = await cursor.toArray()
        res.status(200).send({
            success: true,
            data: post
        })
    } catch (error) {
        res.status(400).send({
            success: false,
            message: "Failed To Fetch Post, Try again later"
        })
    }
})

app.delete("/api/v1/post/:id", async (req, res) => {
    try {
        await db.collection('posts').deleteOne({ _id: new ObjectId(req.params.id) })
        res.status(200).send({
            success: true,
            message: "Post Deleted Succesfully!"
        })
    } catch (error) {
        res.status(400).send({
            success: false,
            message: "Failed To Delete Post, Try again later"
        })
    }
})

app.put("/api/v1/post/:id", async (req, res) => {
    const { title, body } = req.body
    try {
        console.log(title);
        let story = {}
        if (title) story.title = title
        if (body) story.body = body
        await db.collection('posts').updateOne({ _id: new ObjectId(req.params.id) }, { $set: story })
        res.status(200).send({
            success: true,
            message: "Post Updated Succesfully!"
        })
    } catch (error) {
        res.status(400).send({
            success: false,
            message: "Failed To Update Post, Try again later"
        })
    }
})

app.post("/api/v1/post", async (req, res) => {
    const { title, body } = req.body
    try {
        await postCollection.insertOne({
            title,
            body
        });
        res.status(201).send({
            success: true,
            message: "Post Added Succesfully"
        })
    } catch (error) {
        res.status(400).send({
            success: false,
            message: "Failed To Add Post, Try again later"
        })
    }
})

app.get("/api/v1/search", async (req, res) => {
    const queryText = req.query.q;
    const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: queryText,
    });
    const vector = response?.data[0]?.embedding
    const documents = await postCollection.aggregate([
        {
            "$search": {
                "index": "default",
                "knnBeta": {
                    "vector": vector,
                    "path": "plot_embedding",
                    "k": 1000
                }
            }
        }
    ]).toArray();
    res.send({
        success: true,
        data: documents
    })
})

app.listen(PORT, () => {
    console.log(`Server is Running on PORT ${PORT}`);
})