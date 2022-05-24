const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized Access" })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden Access" })
        }
        req.decoded = decoded;
        next();
    })
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xx5t3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const productCollection = client.db("paintgenix").collection("products");
        const OrderCollection = client.db("paintgenix").collection("orders");
        const featuredCollection = client.db("paintgenix").collection("featured");
        const userCollection = client.db("paintgenix").collection("users");

        //get all products
        app.get('/products', async (req, res) => {
            const products = await productCollection.find().toArray();
            res.send(products);
        });

        //get one product
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const product = await productCollection.findOne(filter);
            res.send(product);
        });

        // post order
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await OrderCollection.insertOne(order);
            res.send(result)
        })

        //login or creating user info
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' });
            res.send({ result, token })
        })

        //get all featured
        app.get('/featured', async (req, res) => {
            const feature = await featuredCollection.find().toArray();
            res.send(feature);
        });
    }
    finally {
        //   await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello everyone!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})