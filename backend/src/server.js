import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3000);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters.");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Existing JSON storage remains in use for users, products and enquiries.
// Buyer requirements are stored in Supabase.
const DATA_DIR = process.env.DATA_DIR || path.join(root, "data");
const DATA_FILE = path.join(DATA_DIR, "thokbazaar.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

const initial = {
  users: [],
  categories: [
    { id: "textiles", name: "Textiles & Fabrics", hue: 168 },
    { id: "apparel", name: "Apparel & Garments", hue: 20 },
    { id: "packaging", name: "Packaging", hue: 38 },
    { id: "food", name: "Food & Staples", hue: 100 },
    { id: "building", name: "Building Materials", hue: 14 },
    { id: "machinery", name: "Industrial Machinery", hue: 215 },
    { id: "electronics", name: "Electronics & Electricals", hue: 262 },
    { id: "chemicals", name: "Chemicals & Plastics", hue: 190 },
    { id: "sports", name: "Sports & Fitness", hue: 140 },
    { id: "toys", name: "Toys & Games", hue: 330 },
    { id: "cosmetics", name: "Cosmetics & Beauty", hue: 345 },
    { id: "gadgets", name: "Mobile & Gadgets", hue: 225 },
    { id: "home", name: "Home & Kitchen", hue: 48 },
    { id: "stationery", name: "Stationery & Office", hue: 205 },
    { id: "footwear", name: "Footwear & Bags", hue: 28 },
    { id: "jewellery", name: "Jewellery & Accessories", hue: 300 },
    { id: "furniture", name: "Furniture", hue: 30 },
    { id: "auto", name: "Auto Parts", hue: 8 },
    { id: "health", name: "Health & Medical", hue: 175 },
    { id: "farm", name: "Agriculture & Farm", hue: 90 },
    { id: "gifts", name: "Gifts & Handicrafts", hue: 355 },
    { id: "pets", name: "Pet Supplies", hue: 160 }
  ],
  products: [],
  enquiries: []
};

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
}

let db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

for (const key of Object.keys(initial)) {
  if (!Array.isArray(db[key])) db[key] = initial[key];
}

for (const cat of initial.categories) {
  if (!db.categories.some(x => x.id === cat.id)) {
    db.categories.push(cat);
  }
}

function persist() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function id() {
  return crypto.randomUUID();
}

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function fail(res, status, error) {
  return res.status(status).json({ error });
}

const app = express();

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));

const allowed = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowed.length ? allowed : true
}));

app.use(express.json({ limit: "100kb" }));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) return fail(res, 401, "Please sign in.");

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find(u => u.id === payload.sub);

    if (!user) {
      return fail(res, 401, "Session is no longer valid.");
    }

    req.user = user;
    next();
  } catch {
    return fail(res, 401, "Invalid or expired session.");
  }
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    businessName: user.businessName,
    city: user.city
  };
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "thokbazaar.store",
    database: "Supabase connected"
  });
});

// Register
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const name = clean(req.body.name, 80);
    const email = clean(req.body.email, 160).toLowerCase();
    const password = String(req.body.password || "");
    const businessName = clean(req.body.businessName, 100);
    const city = clean(req.body.city, 80);

    if (
      !name ||
      !businessName ||
      !city ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8
    ) {
      return fail(
        res,
        400,
        "Enter name, firm, city, a valid email and a password of at least 8 characters."
      );
    }

    if (db.users.some(u => u.email === email)) {
      return fail(res, 409, "An account with this email already exists.");
    }

    const user = {
      id: id(),
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      businessName,
      city,
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    persist();

    const token = jwt.sign(
      {},
      JWT_SECRET,
      { subject: user.id, expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

// Login
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = clean(req.body.email, 160).toLowerCase();
    const password = String(req.body.password || "");

    const user = db.users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return fail(res, 401, "Email or password is incorrect.");
    }

    const token = jwt.sign(
      {},
      JWT_SECRET,
      { subject: user.id, expiresIn: "7d" }
    );

    res.json({
      token,
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Categories
app.get("/api/categories", (_req, res) => {
  res.json({ categories: db.categories });
});

app.post("/api/categories", auth, (req, res) => {
  const name = clean(req.body.name, 40);

  if (!name) {
    return fail(res, 400, "Category name is required.");
  }

  let category = db.categories.find(
    c => c.name.toLowerCase() === name.toLowerCase()
  );

  if (!category) {
    category = {
      id: "c-" + crypto.createHash("sha1")
        .update(name.toLowerCase())
        .digest("hex")
        .slice(0, 12),
      name,
      hue: Number(req.body.hue) || 200
    };

    db.categories.push(category);
    persist();
  }

  res.status(201).json({ category });
});

// Get products
app.get("/api/products", (req, res) => {
  let products = [...db.products];

  const q = clean(req.query.q, 120).toLowerCase();
  const cat = clean(req.query.cat, 80);
  const city = clean(req.query.city, 80);
  const sort = clean(req.query.sort, 20);

  if (q) {
    products = products.filter(p =>
      (p.name + " " + p.supplier + " " + p.city + " " + p.desc)
        .toLowerCase()
        .includes(q)
    );
  }

  if (cat && cat !== "all") {
    products = products.filter(p => p.cat === cat);
  }

  if (city && city !== "all") {
    products = products.filter(
      p => p.city.toLowerCase() === city.toLowerCase()
    );
  }

  if (sort === "low") {
    products.sort((a, b) => a.price - b.price);
  } else if (sort === "high") {
    products.sort((a, b) => b.price - a.price);
  } else if (sort === "moq") {
    products.sort((a, b) => a.moq - b.moq);
  } else {
    products.sort((a, b) =>
      String(b.ts).localeCompare(String(a.ts))
    );
  }

  const offset = Math.max(0, Number(req.query.offset) || 0);
  const limit = Math.min(
    500,
    Math.max(1, Number(req.query.limit) || 200)
  );

  res.json({
    products: products.slice(offset, offset + limit),
    total: products.length
  });
});

// Add product
app.post("/api/products", auth, (req, res) => {
  const b = req.body || {};

  const name = clean(b.name, 90);
  const supplier = clean(b.supplier || req.user.businessName, 100);
  const city = clean(b.city || req.user.city, 80);
  const price = Number(b.price);
  const moq = Number(b.moq);
  const unit = clean(b.unit || "pc", 20);
  const cat = clean(b.cat, 80);

  if (!name || !(price > 0) || !(moq >= 1) || !supplier || !city || !cat) {
    return fail(
      res,
      400,
      "Product name, category, positive price, minimum order, firm and city are required."
    );
  }

  if (!db.categories.some(c => c.id === cat)) {
    return fail(res, 400, "Choose a valid category.");
  }

  const product = {
    id: id(),
    name,
    cat,
    price,
    unit,
    moq,
    supplier,
    city,
    tag: clean(b.tag, 40),
    desc: clean(b.desc, 300),
    by: req.user.id,
    ts: new Date().toISOString()
  };

  db.products.push(product);
  persist();

  res.status(201).json({ product });
});

// Edit product
app.patch("/api/products/:id", auth, (req, res) => {
  const product = db.products.find(x => x.id === req.params.id);

  if (!product) return fail(res, 404, "Product not found.");

  if (product.by !== req.user.id) {
    return fail(res, 403, "You can only edit your own products.");
  }

  const b = req.body || {};

  for (const key of [
    "name", "cat", "unit", "supplier", "city", "tag", "desc"
  ]) {
    if (b[key] !== undefined) {
      product[key] = clean(b[key], key === "desc" ? 300 : 100);
    }
  }

  if (b.price !== undefined) product.price = Number(b.price);
  if (b.moq !== undefined) product.moq = Number(b.moq);

  if (
    !product.name ||
    !(product.price > 0) ||
    !(product.moq >= 1) ||
    !db.categories.some(c => c.id === product.cat)
  ) {
    return fail(res, 400, "Product data is invalid.");
  }

  product.ts = new Date().toISOString();
  persist();

  res.json({ product });
});

// Delete product
app.delete("/api/products/:id", auth, (req, res) => {
  const index = db.products.findIndex(x => x.id === req.params.id);

  if (index < 0) return fail(res, 404, "Product not found.");

  if (db.products[index].by !== req.user.id) {
    return fail(res, 403, "You can only delete your own products.");
  }

  db.products.splice(index, 1);
  persist();

  res.json({ ok: true });
});

// Product enquiries
app.post("/api/enquiries", (req, res) => {
  const b = req.body || {};
  const product = db.products.find(
    x => x.id === String(b.productId || "")
  );

  const quantity = Number(b.quantity);
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 20).replace(/\D/g, "");

  if (!product) return fail(res, 404, "Product not found.");

  if (!(quantity >= product.moq) || phone.length !== 10) {
    return fail(
      res,
      400,
      "Quantity must meet the minimum order and phone must be 10 digits."
    );
  }

  const enquiry = {
    id: id(),
    pid: product.id,
    pname: product.name,
    seller: product.by,
    qty: quantity,
    unit: product.unit,
    name,
    phone,
    ts: new Date().toISOString()
  };

  db.enquiries.push(enquiry);
  persist();

  res.status(201).json({
    enquiry: { id: enquiry.id }
  });
});

app.get("/api/seller/enquiries", auth, (req, res) => {
  res.json({
    enquiries: db.enquiries.filter(
      e => e.seller === req.user.id
    )
  });
});

// --------------------------------------------------
// BUYER REQUIREMENTS: SAVED DIRECTLY IN SUPABASE
// --------------------------------------------------

// Submit a buyer requirement
app.post("/api/requirements", async (req, res, next) => {
  try {
    const b = req.body || {};

    const name = clean(b.customerName || b.name, 80);
    const firmName = clean(b.firmName || b.businessName, 100);
    const email = clean(b.email, 160).toLowerCase();
    const productName = clean(b.productName || b.prod, 120);
    const quantity = Number(b.quantity || b.qty);
    const unit = clean(b.unit || "pc", 20);
    const city = clean(b.city, 80);
    const phone = clean(b.phone, 20).replace(/\D/g, "");
    const budget = b.budget == null || b.budget === ""
      ? null
      : Number(b.budget);
    const description = clean(b.description || b.details, 2000);

    if (
      !name ||
      !firmName ||
      !productName ||
      !(quantity >= 1) ||
      phone.length !== 10
    ) {
      return fail(
        res,
        400,
        "Customer name, firm name, product, quantity and a 10-digit phone number are required."
      );
    }

    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      return fail(res, 400, "Please enter a valid budget.");
    }

    const { data, error } = await supabase
      .from("requirements")
      .insert({
        customer_name: name,
        firm_name: firmName,
        email: email || null,
        phone,
        product_name: productName,
        quantity,
        unit,
        city: city || null,
        budget,
        description: description || null
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase requirement insert error:", error);
      return fail(res, 500, "Could not save requirement. Please try again.");
    }

    res.status(201).json({
      requirement: {
        id: data.id,
        name: data.customer_name,
        firmName: data.firm_name,
        email: data.email,
        phone: data.phone,
        prod: data.product_name,
        qty: data.quantity,
        unit: data.unit,
        city: data.city,
        budget: data.budget,
        description: data.description,
        status: data.status,
        ts: data.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all buyer requirements
app.get("/api/requirements", async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("requirements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase requirement fetch error:", error);
      return fail(res, 500, "Could not load requirements.");
    }

    const requirements = (data || []).map(row => ({
      id: row.id,
      name: row.customer_name,
      firmName: row.firm_name,
      email: row.email,
      phone: row.phone,
      prod: row.product_name,
      qty: row.quantity,
      unit: row.unit,
      city: row.city,
      budget: row.budget,
      description: row.description,
      status: row.status,
      adminReply: row.admin_reply,
      ts: row.created_at
    }));

    res.json({ requirements });
  } catch (error) {
    next(error);
  }
});

// Backend root
app.get("/", (_req, res) => {
  res.redirect("https://thokbazaar.store");
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path
  });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Thokbazaar API running on port ${PORT}`);
});
