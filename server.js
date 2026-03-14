require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const cors = require('cors');
const Product = require('./models/Product');
const Banner = require('./models/Banner');

const app = express();
app.use(cors());
app.use(express.json());

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB & Cloudinary Ready!"))
    .catch(err => console.log(err));

// --- CATEGORY MODEL ---
const CategorySchema = new mongoose.Schema({
    title: String,
    subtitle: String,
    linkText: String,
    imageURL: String
});
const Category = mongoose.model('Category', CategorySchema);

// --- ORDER MODEL (NEW) ---
const OrderSchema = new mongoose.Schema({
    customerName: String,
    phoneNumber: String,
    email: String,
    city: String,
    address: String,
    items: Array,        // List of products from the cart
    totalAmount: Number,
    status: { type: String, default: 'Pending' }, // Pending, Shipped, Delivered
    paymentMethod: { type: String, default: 'Cash on Delivery' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// Helper for Cloudinary Upload
const streamUpload = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((error, result) => {
            if (result) resolve(result);
            else reject(error);
        });
        stream.end(buffer);
    });
};

// --- PRODUCT ROUTES ---
app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("Image required");
        const result = await streamUpload(req.file.buffer);
        const newProduct = new Product({
            title: req.body.title,
            price: req.body.price,
            imageURL: result.secure_url
        });
        await newProduct.save();
        res.status(200).send("Product Saved!");
    } catch (err) { res.status(500).send("Upload failed"); }
});

app.get('/api/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

app.delete('/api/products/:id', async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.send("Product Deleted");
});

// --- BANNER ROUTES ---
app.post('/api/banners', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("Image required");
        const result = await streamUpload(req.file.buffer);
        const newBanner = new Banner({
            imageURL: result.secure_url,
            title: req.body.title,
            subtitle: req.body.subtitle
        });
        await newBanner.save();
        res.status(200).send("Banner Uploaded!");
    } catch (err) { res.status(500).send("Upload failed"); }
});

app.get('/api/banners', async (req, res) => {
    const banners = await Banner.find();
    res.json(banners);
});

app.delete('/api/banners/:id', async (req, res) => {
    await Banner.findByIdAndDelete(req.params.id);
    res.send("Banner Deleted");
});

// --- CATEGORY ROUTES ---
app.post('/api/categories', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("Please upload an image.");
        const result = await streamUpload(req.file.buffer);
        const newCat = new Category({
            title: req.body.title || "New Category",
            subtitle: req.body.subtitle || "",
            linkText: req.body.linkText || "Shop Now",
            imageURL: result.secure_url
        });
        await newCat.save();
        res.status(200).send("Category Added");
    } catch (err) { res.status(500).send("Server side error"); }
});

app.get('/api/categories', async (req, res) => {
    const categories = await Category.find();
    res.json(categories);
});

app.delete('/api/categories/:id', async (req, res) => {
    await Category.findByIdAndDelete(req.params.id);
    res.send("Category Deleted");
});

// --- ORDER ROUTES (NEW) ---

// 1. Route for user to place an order
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.status(200).send({ message: "Order Placed Successfully!", orderId: newOrder._id });
    } catch (err) {
        res.status(500).send("Error placing order");
    }
});

// 2. Route for Admin to see all orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).send("Error fetching orders");
    }
});

// 3. Update Status (Pending/Delivered)
app.put('/api/orders/:id', async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.send("Status Updated");
    } catch (err) {
        res.status(500).send("Error updating status");
    }
});

// --- USER MODEL ---
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false } // Added this to differentiate users
});
const User = mongoose.model('User', userSchema);

// Signup Route
app.post('/api/users/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).send({ message: "Email already exists" });
  
  const newUser = new User({ name, email, password }); 
  await newUser.save();
  res.send(newUser);
});

// Login Route
app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (!user) return res.status(400).send({ message: "Invalid Credentials" });
  res.send(user);
});

// --- GOOGLE LOGIN ROUTE (NEW) ---
app.post('/api/users/google-login', async (req, res) => {
    const { email, name } = req.body;
    try {
        let user = await User.findOne({ email });

        if (!user) {
            // Create user if they don't exist
            user = new User({
                name: name,
                email: email,
                password: Math.random().toString(36).slice(-8), // Dummy password
                isAdmin: false
            });
            await user.save();
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Google Login Error" });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));