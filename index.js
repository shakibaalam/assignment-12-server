const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
        const paymentCollection = client.db("paintgenix").collection("payments");
        const reviewCollection = client.db("paintgenix").collection("reviews");

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                return res.status(403).send({ message: "Forbidden to made an admin" })
            }
        }

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

        //add a product 
        app.post('/products', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });

        //delete a products
        app.delete('/products/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await productCollection.deleteOne(filter);
            res.send(result);
        });

        //get all orders
        app.get('/allorders', async (req, res) => {
            const orders = await OrderCollection.find().toArray();
            res.send(orders);
        });

        // get orders for users
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const orders = await OrderCollection.find(query).toArray();
                res.send(orders);
            }
            else {
                return res.status(403).send({ message: "Forbidden Access" })
            }
        });

        //get one booking for payment by id
        app.get('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await OrderCollection.findOne(query);
            res.send(order);
        });

        //paid hoise seta only update er jonno
        app.patch('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                    paidAmount: payment.amount
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await OrderCollection.updateOne(filter, updatedDoc);
            console.log(payment, updatedDoc);
            res.send(updatedDoc);
        })

        // change pending status by admin
        app.patch('/allOrders/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const order = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'shipped'
                }
            }
            const updatedOrder = await OrderCollection.updateOne(filter, updatedDoc);
            // console.log(payment, updatedDoc);
            res.send(updatedOrder);
        })

        //delete order by user
        app.delete('/orders/:id', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            const id = req.params.id;
            if (email === decodedEmail) {
                const filter = { _id: ObjectId(id) }
                const result = await OrderCollection.deleteOne(filter);
                console.log(filter);
                res.send(result);
            }
            else {
                return res.status(403).send({ message: "Forbidden cancel" })
            }
        });

        //delete order by admin
        app.delete('/allOrders/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await OrderCollection.deleteOne(filter);
            console.log(filter);
            res.send(result);
        });

        // post order
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await OrderCollection.insertOne(order);
            res.send(result)
        })

        //get all users info
        app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        });

        //get a specific user
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            res.send(user);
        });

        //delete a user
        app.delete('/user/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.deleteOne({ email: email });
            res.send(result);
        });

        //check user if he is a admin
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        //create and auto update admin 
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        //update  user info
        app.patch('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const userInfo = req.body;
            const filter = { email: email };
            const updateDoc = {
                $set: userInfo
            };
            const result = await userCollection.updateOne(filter, updateDoc);
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
        });

        //for payment intention
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { totalPrice } = req.body;
            const amount = totalPrice * 100;
            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        });

        //get all review
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewCollection.find().toArray();
            res.send(reviews);
        });

        //post a review 
        app.post('/reviews', verifyJWT, async (req, res) => {
            const reviews = req.body;
            const result = await reviewCollection.insertOne(reviews);
            res.send(result);
        });

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