require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const path = require('path');
const { requireLogin, requireAdmin } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3001;

// Build MongoDB connection string using .env parts
const dbUrl = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/${process.env.MONGODB_DATABASE}`;

mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Session configuration
app.use(session({
  secret: process.env.NODE_SESSION_SECRET,
  store: MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
      secret: process.env.MONGODB_SESSION_SECRET
    },
    ttl: 60 * 60 // 1 hour
  }),
  resave: false,
  saveUninitialized: false
}));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  user_type: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
});
const User = mongoose.model('User', userSchema);

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

app.get('/signup', (req, res) => {
  res.render('signup', { user: req.session.user, error: null });
});

app.get('/admin', requireAdmin, async (req, res) => {
  const users = await User.find().lean();
  res.render('admin', { users, user: req.session.user });
});

app.post('/admin/promote/:id', requireAdmin, async (req, res) => {
  await User.updateOne({ _id: new mongoose.Types.ObjectId(req.params.id) }, { $set: { user_type: 'admin' } });
  res.redirect('/admin');
});

app.post('/admin/demote/:id', requireAdmin, async (req, res) => {
  await User.updateOne({ _id: new mongoose.Types.ObjectId(req.params.id) }, { $set: { user_type: 'user' } });
  res.redirect('/admin');
});

app.post('/signup', async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(5).required()
  });

  const result = schema.validate(req.body);
  if (result.error) {
    return res.render('signup', { 
      user: null,
      error: result.error.details[0].message 
    });
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  await User.create({ ...req.body, password: hashedPassword });

  req.session.user = { 
    name: req.body.name, 
    email: req.body.email, 
    user_type: 'user' 
  };
  res.redirect('/members');
});

app.get('/login', (req, res) => {
  res.render('login', { user: null, error: null });
});

app.post('/login', async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  const result = schema.validate(req.body);
  if (result.error) {
    return res.render('login', { error: result.error.details[0].message });
  }

  const user = await User.findOne({ email: req.body.email });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.render('login', { user: null, error: 'Invalid email or password' });
  }

  req.session.user = { 
    name: user.name, 
    email: user.email, 
    user_type: user.user_type
  };
  res.redirect('/members');
});

app.get('/members', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const images = ['img/duck.jpg', 'img/minecraft_house.jpg', 'img/snowmen.jpg'];
  res.render('members', {
    user: req.session.user,
    images 
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user });
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));