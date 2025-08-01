const express = require("express");
const cors = require("cors");
const app = express();
var jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // coming from .env
const port = process.env.PORT || 5000;

const nodemailer = require("nodemailer");

// Create a test account or replace with real credentials.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "ziabackbencherstudio2000@gmail.com",
    pass: "wgxjnjizzcbpecap",
  },
});

// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zui8vyn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();

    let userCollection = client.db("bistroBoss").collection("users");
    let menuCollection = client.db("bistroBoss").collection("menus");
    let reviewCollection = client.db("bistroBoss").collection("reviews");
    let cartCollection = client.db("bistroBoss").collection("carts");
    const paymentCollection = client.db("bistroBoss").collection("payments");

    // JWT API
    app.post("/jwt", (req, res) => {
      let user = req.body;
      let token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "1h" });
      res.send({ token });
    });

    // Verify Token
    let verifyToken = (req, res, next) => {
      let authorization = req.headers.authorization;
      let token = authorization.split(" ")[1];

      if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }

        // set user email to access later in api
        req.user = decoded.user;
        next();
      });
    };

    // Verify Admin
    let verifyAdmin = async (req, res, next) => {
      let email = req.user.email;

      console.log(email);
      let query = { email: email };
      let user = await userCollection.findOne(query);

      let admin = user?.role === "admin";

      if (!admin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // User APIS ===========

    // check admin
    app.get("/users/:email", verifyToken, async (req, res) => {
      let email = req.params.email;

      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      let query = { email };
      let user = await userCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }

      res.send(admin);
    });

    // Insert a new user
    app.post("/users", verifyToken, verifyAdmin, async (req, res) => {
      let user = req.body;
      // Check if user already exists
      let query = { email: user.email };
      let existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      // Insert new user
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // get all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      let cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //delete a user
    app.delete("/users/:id", async (req, res) => {
      let id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // update user role as admin
    app.patch("/users/admin/:id", async (req, res) => {
      let id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      let result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Menus APIs ==========
    app.get("/menus", async (req, res) => {
      let cursor = menuCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      let data = req.body;
      let result = await menuCollection.insertOne(data);
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      let id = req.params.id;
      let query = { _id: id };
      let result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.patch("/menu/:id", async (req, res) => {
      let id = req.params.id;
      let menu = req.body;

      let filter = { _id: id };

      const updateDoc = {
        $set: {
          name: menu.name,
          recipe: menu.recipe,
          image: menu.image,
          category: menu.category,
          price: menu.price,
        },
      };

      let result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      let id = req.params.id;

      let query = { _id: id }; // Programming heror old datay object Id nai
      //let query = { _id: new ObjectId(id) }; // new entries record ey object id ace
      let result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // Reviews APIs
    app.get("/reviews", async (req, res) => {
      let cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Cart APIs

    // Get user cart by email
    app.get("/carts", async (req, res) => {
      let email = req.query.email;
      let query = { email };
      let cursor = cartCollection.find(query);
      let result = await cursor.toArray();
      res.send(result);
    });

    // Add cart item for user
    app.post("/carts", async (req, res) => {
      let item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    // Delete cart item by id
    app.delete("/carts/:id", async (req, res) => {
      let id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Payments Releated API

    // Stripe Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      //const amount = parseInt(price * 100); // Need to convert into paisa/cent --- Because step only handle full number not decimal
      const amount = Math.max(parseInt(price * 100), 50); // Ensure minimum amount is 50 cents (USD)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // After Payment
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // Carefully delete each item from cart
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      // Send Email After Payment Complete
      const info = await transporter.sendMail({
        from: '"Message From Bistro Boss" <maddison53@ethereal.email>',
        to: "ziabackbencherstudio2000@gmail.com",
        subject: "Order Confirmed",
        text: "Hello world?",
        html: `Your payment is successfully done. Your transaction id is - ${payment.transactionId}`,
      });

      res.send({ paymentResult, deleteResult });
    });

    // payments history
    app.get("/payments/:email", async (req, res) => {
      let email = req.params.email;
      let query = { email };
      let result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // Dashboard States Data
    app.get("/admin/stats", verifyToken, verifyAdmin, async (req, res) => {
      const user = await userCollection.estimatedDocumentCount();
      const menu = await menuCollection.estimatedDocumentCount();
      const order = await paymentCollection.estimatedDocumentCount();

      // ========== Option 1 ==============
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce(
      //   (total, payment) => total + payment.price,
      //   0
      // );

      // option 2
      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      let revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        user,
        menu,
        order,
        revenue,
      });
    });

    // Order Stats
    app.get("/order-stats", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$menuItemIds",
          },
          {
            $lookup: {
              from: "menus",
              localField: "menuItemIds",
              foreignField: "_id",
              as: "menuItems", // Menus collection data is here as menuItems
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quantity: { $sum: 1 },
              revenue: { $sum: "$menuItems.price" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue",
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Bistro Boss is running");
});

app.listen(port, () => {
  console.log(`Bistro Boss server is running on port ${port}`);
});
