import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import session from 'express-session';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: false,      
    crossOriginEmbedderPolicy: false, 
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Terlalu banyak request dari IP ini, coba lagi nanti.'
});

const createPaymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: 'Terlalu banyak pembuatan pembayaran, tunggu 5 menit.'
});

const limitAdmin = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: 'Terlalu banyak request dari IP ini, coba lagi nanti.'
});

app.use('/api/', limiter);
app.use('/admin/', limitAdmin);
app.use('/api/payment/create', createPaymentLimiter);
app.use('/api/payment/create-panel', createPaymentLimiter);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// CONFIGURATION - EDIT DISINI BROK!
// ==========================================
const CONFIG = {
  storename: "Bixx Panel",
  
  // Payment Gateway (Pakasir)
  pakasir: {
    project: "bixx",
    apiKey: "Dp8cYFoeWupJXZKGMw9jN7fgDBFCDDRY"
  },
  
  // Cloudflare Turnstile (Captcha)
  cloudflare: {
    secretkey: "0x4AAAAAACIOobaEQNSWNQwz2VwpFUzfy_M",
    sitekey: "0x4AAAAAACadjJKUdbdtyOV5"
  }, 
  
  // Pterodactyl Panel (Untuk Server Bot)
  pterodactyl: {
    domain: "https://slk.zarproject.my.id",
    apiKey: "ptla_0SrYHKYl5t8msyeBgWnyXUmnTPN9qyKrpULGlDtrv0x",
    nestId: "5",
    eggId: "15",
    locationId: "1"
  },
  
  // Telegram Bot (Notifikasi)
  telegram: {
    botToken: "8544244356:AAHy4WufVrP2jd81m6ChHTQwjjQJAexJsOk",
    chatId: "8133533262"
  },
  
  // Admin Login
  admin: {
    username: "admin",
    password: "admin123"
  },
  
  // ==========================================
  // HARGA SERVER PANEL (RAM GB)
  // ==========================================
  prices: {
    "1gb": 2000,
    "2gb": 3000,
    "3gb": 4000,
    "4gb": 5000,
    "5gb": 6000,
    "6gb": 7000,
    "7gb": 8000,
    "8gb": 9000,
    "9gb": 10000,
    "10gb": 12000,
    "unlimited": 13000
  },
  
  // ==========================================
  // SPEK SERVER (RAM, DISK, CPU)
  // ==========================================
  specs: {
    "1gb": { ram: 1000, disk: 5000, cpu: 40 },
    "2gb": { ram: 2000, disk: 10000, cpu: 60 },
    "3gb": { ram: 3000, disk: 15000, cpu: 80 },
    "4gb": { ram: 4000, disk: 20000, cpu: 100 },
    "5gb": { ram: 5000, disk: 25000, cpu: 120 },
    "6gb": { ram: 6000, disk: 30000, cpu: 140 },
    "7gb": { ram: 7000, disk: 35000, cpu: 160 },
    "8gb": { ram: 8000, disk: 40000, cpu: 180 },
    "9gb": { ram: 9000, disk: 45000, cpu: 200 },
    "10gb": { ram: 10000, disk: 50000, cpu: 220 },
    "unlimited": { ram: 0, disk: 0, cpu: 0 }
  },
  
  // ==========================================
  // PRODUK RESELLER & ADMIN PANEL
  // HARGA BISA DIUBAH VIA ADMIN DASHBOARD!
  // ==========================================
  panelProducts: {
    reseller: {
      name: "Reseller Panel",
      description: "Akses grup reseller untuk jualan panel dengan harga murah",
      price: 16000,        // <-- HARGA RESELLER (default)
      type: "reseller",
      groupLink: "https://t.me/AKSESPANEL"  // <-- LINK GRUP RESELLER
    },
    admin: {
      name: "Admin Panel", 
      description: "Akses grup admin untuk manage panel dan harga termurah",
      price: 20000,       // <-- HARGA ADMIN (default)
      type: "admin",
      groupLink: "https://t.me/AKSESPANEL"      // <-- LINK GRUP ADMIN
    }
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/[<>"'&]/g, (char) => {
    const entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
    return entities[char];
  });
}

function isValidUsername(username) {
  return /^[a-z0-9]{3,16}$/.test(username);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendTelegramNotif(message) {
  try {
    await fetch(`https://api.telegram.org/bot${CONFIG.telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.telegram.chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('Telegram error:', err);
  }
}

// ==========================================
// PTERODACTYL FUNCTIONS (Buat Server)
// ==========================================

async function createPteroUser(username) {
  const email = `${username}@panel.store`;
  const password = username + crypto.randomBytes(4).toString('hex');
  
  const res = await fetch(`${CONFIG.pterodactyl.domain}/api/application/users`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.pterodactyl.apiKey}`
    },
    body: JSON.stringify({
      email,
      username: username.toLowerCase(),
      first_name: username,
      last_name: 'Server',
      language: 'en',
      password
    })
  });
  
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].detail);
  
  return { user: data.attributes, password };
}

async function createPteroServer(userId, username, plan) {
  const spec = CONFIG.specs[plan];
  const name = `${username} Server`;
  
  const eggRes = await fetch(
    `${CONFIG.pterodactyl.domain}/api/application/nests/${CONFIG.pterodactyl.nestId}/eggs/${CONFIG.pterodactyl.eggId}`,
    {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${CONFIG.pterodactyl.apiKey}`
      }
    }
  );
  const eggData = await eggRes.json();
  
  const res = await fetch(`${CONFIG.pterodactyl.domain}/api/application/servers`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.pterodactyl.apiKey}`
    },
    body: JSON.stringify({
      name,
      description: `Created at ${new Date().toLocaleString('id-ID')}`,
      user: userId,
      egg: parseInt(CONFIG.pterodactyl.eggId),
      docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
      startup: eggData.attributes.startup,
      environment: {
        INST: "npm",
        USER_UPLOAD: "0",
        AUTO_UPDATE: "0",
        CMD_RUN: "npm start"
      },
      limits: {
        memory: spec.ram,
        swap: 0,
        disk: spec.disk,
        io: 500,
        cpu: spec.cpu
      },
      feature_limits: {
        databases: 5,
        backups: 5,
        allocations: 5
      },
      deploy: {
        locations: [parseInt(CONFIG.pterodactyl.locationId)],
        dedicated_ip: false,
        port_range: []
      }
    })
  });
  
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].detail);
  
  return data.attributes;
}

// ==========================================
// AUTH MIDDLEWARE
// ==========================================

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
}

// ==========================================
// PAGE ROUTES - SERVER PANEL (Yang Lama)
// ==========================================

app.get('/', (req, res) => {
  res.render('index', { title: `${CONFIG.storename} - Home` });
});

app.get('/plans', (req, res) => {
  const plans = Object.keys(CONFIG.prices).map(key => ({
    id: key,
    name: key.toUpperCase(),
    price: CONFIG.prices[key],
    specs: CONFIG.specs[key]
  }));
  
  res.render('plans', { title: `${CONFIG.storename} - Plans`, plans });
});

app.get('/checkout/:plan', (req, res) => {
  const planId = req.params.plan;
  
  if (!CONFIG.prices[planId]) {
    return res.redirect('/plans');
  }
  
  res.render('checkout', {
    title: `${CONFIG.storename} - Checkout`,
    plan: {
      id: planId,
      name: planId.toUpperCase(),
      price: CONFIG.prices[planId],
      specs: CONFIG.specs[planId]
    },
    siteKey: CONFIG.cloudflare.sitekey
  });
});

app.get('/payment/:orderId', (req, res) => {
  res.render('payment', {
    title: `${CONFIG.storename} - Payment`,
    orderId: req.params.orderId
  });
});

app.get('/success', (req, res) => {
  res.render('success', {
    title: `${CONFIG.storename} - Success`
  });
});

app.get('/upgrade/:serverId', (req, res) => {
  res.render('upgrade', {
    title: `${CONFIG.storename} - Upgrade`,
    serverId: req.params.serverId
  });
});

// ==========================================
// PAGE ROUTES - RESELLER & ADMIN PANEL (BARU!)
// ==========================================

// Halaman produk panel (reseller & admin)
app.get('/panel-products', (req, res) => {
  const products = Object.keys(CONFIG.panelProducts).map(key => ({
    id: key,
    ...CONFIG.panelProducts[key]
  }));
  
  res.render('panel-products', { 
    title: `${CONFIG.storename} - Panel Products`,
    products 
  });
});

// Checkout untuk produk panel
app.get('/checkout-panel/:type', (req, res) => {
  const type = req.params.type;
  
  if (!CONFIG.panelProducts[type]) {
    return res.redirect('/panel-products');
  }
  
  res.render('checkout-panel', {
    title: `${CONFIG.storename} - Checkout ${CONFIG.panelProducts[type].name}`,
    product: {
      id: type,
      ...CONFIG.panelProducts[type]
    },
    siteKey: CONFIG.cloudflare.sitekey
  });
});

// Payment page untuk panel
app.get('/payment-panel/:orderId', (req, res) => {
  res.render('payment-panel', {
    title: `${CONFIG.storename} - Payment Panel`,
    orderId: req.params.orderId
  });
});

// Success page untuk panel
app.get('/success-panel', (req, res) => {
  res.render('success-panel', {
    title: `${CONFIG.storename} - Success Panel Access`
  });
});

// ==========================================
// ADMIN ROUTES
// ==========================================

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { 
    title: `${CONFIG.storename} - Admin Login`,
    error: null,
    siteKey: CONFIG.cloudflare.sitekey
  });
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const turnstileResponse = req.body['cf-turnstile-response'];

  if (!turnstileResponse) {
    return res.render('admin/login', { 
      title: `${CONFIG.storename} - Admin Login`,
      error: 'Harap selesaikan verifikasi keamanan (Cloudflare)!',
      siteKey: CONFIG.cloudflare.sitekey
    });
  }

  try {
    const secretKey = CONFIG.cloudflare.secretkey;
    const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    
    const result = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: turnstileResponse
      })
    });

    const data = await result.json();

    if (!data.success) {
      return res.render('admin/login', { 
        title: `${CONFIG.storename} - Admin Login`,
        error: 'Verifikasi keamanan gagal, silakan refresh halaman.',
        siteKey: CONFIG.cloudflare.sitekey
      });
    }

    if (username === CONFIG.admin.username && password === CONFIG.admin.password) {
      req.session.isAdmin = true;
      req.session.adminUsername = username;
      return res.redirect('/admin/dashboard');
    }
    
    res.render('admin/login', { 
      title: `${CONFIG.storename} - Admin Login`,
      error: 'Username atau password salah!',
      siteKey: CONFIG.cloudflare.sitekey
    });

  } catch (err) {
    console.error(err);
    res.render('admin/login', { 
      title: `${CONFIG.storename} - Admin Login`,
      error: 'Terjadi kesalahan server saat verifikasi.',
      siteKey: CONFIG.cloudflare.sitekey
    });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin/dashboard', requireAuth, (req, res) => {
  res.render('admin/dashboard', {
    title: `${CONFIG.storename} - Admin Dashboard`,
    adminUsername: req.session.adminUsername
  });
});

// ==========================================
// PUBLIC API - SERVER PANEL (Yang Lama)
// ==========================================

app.get('/api/plans', (req, res) => {
  const plans = Object.keys(CONFIG.prices).map(key => ({
    id: key,
    name: key.toUpperCase(),
    price: CONFIG.prices[key],
    specs: CONFIG.specs[key]
  }));
  res.json({ success: true, plans });
});

app.post('/api/payment/create', createPaymentLimiter, async (req, res) => {
  try {
    let { plan, username, email, recaptchaResponse } = req.body;
    
    if (!recaptchaResponse) {
      return res.status(400).json({ 
        success: false, 
        message: 'Harap verifikasi keamanan (Cloudflare)' 
      });
    }
    
    const turnstileSecretKey = CONFIG.cloudflare.secretkey;
    const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    
    const turnstileRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: turnstileSecretKey,
        response: recaptchaResponse
      })
    });
    
    const turnstileData = await turnstileRes.json();
    
    if (!turnstileData.success) {
      console.error('Turnstile validation failed:', turnstileData['error-codes']);
      return res.status(400).json({ 
        success: false, 
        message: 'Verifikasi keamanan gagal/kadaluarsa. Silakan refresh halaman.' 
      });
    }
    
    username = sanitizeInput(username);
    email = sanitizeInput(email);
    
    if (!plan || !username || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Plan, username, dan email wajib diisi' 
      });
    }
    
    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username harus 3-16 karakter, hanya huruf kecil dan angka'
      });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }
    
    if (!CONFIG.prices[plan]) {
      return res.status(400).json({ 
        success: false, 
        message: 'Plan tidak valid' 
      });
    }
    
    const amount = CONFIG.prices[plan];
    const orderId = `ZP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    const createRes = await fetch('https://app.pakasir.com/api/transactioncreate/qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: CONFIG.pakasir.project,
        api_key: CONFIG.pakasir.apiKey,
        order_id: orderId,
        amount
      })
    });
    
    const createData = await createRes.json();
    
    if (!createData || createData.error) {
      return res.status(500).json({ 
        success: false, 
        message: createData?.error || 'Gagal membuat transaksi QRIS' 
      });
    }
    
    const paymentCode = createData.code || createData.payment?.code;
    const qrisString = createData.qris_string || createData.payment?.qris_string || createData.payment?.payment_number;
    const paymentNumber = createData.payment_number || createData.payment?.payment_number;
    
    if (!paymentCode && !qrisString && !paymentNumber) {
      return res.status(500).json({ 
        success: false, 
        message: 'Format response QRIS tidak valid' 
      });
    }
    
    let qrisUrl;
    if (paymentCode) {
      qrisUrl = `https://app.pakasir.com/qris/${paymentCode}.png`;
    } else if (qrisString || paymentNumber) {
      const qrData = qrisString || paymentNumber;
      qrisUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=500&format=png`;
    }
    
    console.log(`Order Created: ${orderId} | User: ${username} | Cloudflare Verified`);
    
    res.json({
      success: true,
      orderId,
      amount,
      qrisUrl,
      paymentCode: paymentCode || null,
      qrisString: qrisString || paymentNumber || null,
      plan,
      username,
      email
    });
    
  } catch (err) {
    console.error('Payment creation error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server: ' + err.message 
    });
  }
});

app.post('/api/payment/check', async (req, res) => {
  try {
    const { orderId, amount, plan, username, email } = req.body;
    
    const url = `https://app.pakasir.com/api/transactiondetail?project=${CONFIG.pakasir.project}&amount=${amount}&order_id=${orderId}&api_key=${CONFIG.pakasir.apiKey}`;
    
    const detailRes = await fetch(url);
    const detail = await detailRes.json();
    const tx = detail.transaction || detail;
    const status = (tx.status || '').toString().toUpperCase();
    
    if (status.includes('SUCCESS') || status.includes('COMPLETED') || status.includes('BERHASIL')) {
      try {
        const { user, password } = await createPteroUser(username);
        const server = await createPteroServer(user.id, username, plan);
        
        const telegramMsg = `🎉 <b>TRANSAKSI BARU BERHASIL</b>\n\n📦 <b>Order ID:</b> ${orderId}\n👤 <b>Username:</b> ${username}\n📧 <b>Email:</b> ${email}\n💰 <b>Plan:</b> ${plan.toUpperCase()}\n💵 <b>Amount:</b> Rp ${amount.toLocaleString('id-ID')}\n🆔 <b>Server ID:</b> ${server.id}\n\n✅ Panel telah dikirim ke user`;
        
        await sendTelegramNotif(telegramMsg);
        
        return res.json({
          success: true,
          status: 'success',
          panel: {
            serverId: server.id,
            username: user.username,
            password,
            email: user.email,
            domain: CONFIG.pterodactyl.domain
          }
        });
        
      } catch (panelErr) {
        console.error('Panel creation error:', panelErr);
        return res.json({
          success: false,
          status: 'payment_success_panel_failed',
          message: 'Pembayaran berhasil tapi gagal membuat panel. Hubungi admin.'
        });
      }
    }
    
    if (status.includes('FAILED') || status.includes('EXPIRED') || status.includes('GAGAL')) {
      return res.json({ success: true, status: 'failed' });
    }
    
    res.json({ success: true, status: 'pending' });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server' 
    });
  }
});

// ==========================================
// PUBLIC API - RESELLER & ADMIN PANEL (BARU!)
// ==========================================

// API untuk membuat pembayaran produk panel
app.post('/api/payment/create-panel', createPaymentLimiter, async (req, res) => {
  try {
    let { productType, telegramUsername, recaptchaResponse } = req.body;
    
    // Validasi Turnstile
    if (!recaptchaResponse) {
      return res.status(400).json({ 
        success: false, 
        message: 'Harap verifikasi keamanan (Cloudflare)' 
      });
    }
    
    const turnstileSecretKey = CONFIG.cloudflare.secretkey;
    const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    
    const turnstileRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: turnstileSecretKey,
        response: recaptchaResponse
      })
    });
    
    const turnstileData = await turnstileRes.json();
    
    if (!turnstileData.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verifikasi keamanan gagal/kadaluarsa. Silakan refresh halaman.' 
      });
    }
    
    // Sanitasi input
    telegramUsername = sanitizeInput(telegramUsername);
    
    // Validasi
    if (!productType || !telegramUsername) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tipe produk dan username Telegram wajib diisi' 
      });
    }
    
    if (!CONFIG.panelProducts[productType]) {
      return res.status(400).json({ 
        success: false, 
        message: 'Produk tidak valid' 
      });
    }
    
    // Validasi format username Telegram (tanpa @)
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(telegramUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username Telegram tidak valid (5-32 karakter, huruf, angka, underscore, tanpa @)'
      });
    }
    
    const product = CONFIG.panelProducts[productType];
    const amount = product.price;
    const orderId = `ZP-${productType.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    // Buat transaksi QRIS
    const createRes = await fetch('https://app.pakasir.com/api/transactioncreate/qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: CONFIG.pakasir.project,
        api_key: CONFIG.pakasir.apiKey,
        order_id: orderId,
        amount
      })
    });
    
    const createData = await createRes.json();
    
    if (!createData || createData.error) {
      return res.status(500).json({ 
        success: false, 
        message: createData?.error || 'Gagal membuat transaksi QRIS' 
      });
    }
    
    const paymentCode = createData.code || createData.payment?.code;
    const qrisString = createData.qris_string || createData.payment?.qris_string || createData.payment?.payment_number;
    const paymentNumber = createData.payment_number || createData.payment?.payment_number;
    
    let qrisUrl;
    if (paymentCode) {
      qrisUrl = `https://app.pakasir.com/qris/${paymentCode}.png`;
    } else if (qrisString || paymentNumber) {
      const qrData = qrisString || paymentNumber;
      qrisUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=500&format=png`;
    }
    
    console.log(`Panel Order Created: ${orderId} | Type: ${productType} | User: ${telegramUsername}`);
    
    res.json({
      success: true,
      orderId,
      amount,
      qrisUrl,
      paymentCode: paymentCode || null,
      qrisString: qrisString || paymentNumber || null,
      productType,
      telegramUsername,
      productName: product.name
    });
    
  } catch (err) {
    console.error('Panel payment creation error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server: ' + err.message 
    });
  }
});

// API untuk cek status pembayaran panel
app.post('/api/payment/check-panel', async (req, res) => {
  try {
    const { orderId, amount, productType, telegramUsername } = req.body;
    
    const url = `https://app.pakasir.com/api/transactiondetail?project=${CONFIG.pakasir.project}&amount=${amount}&order_id=${orderId}&api_key=${CONFIG.pakasir.apiKey}`;
    
    const detailRes = await fetch(url);
    const detail = await detailRes.json();
    const tx = detail.transaction || detail;
    const status = (tx.status || '').toString().toUpperCase();
    
    if (status.includes('SUCCESS') || status.includes('COMPLETED') || status.includes('BERHASIL')) {
      const product = CONFIG.panelProducts[productType];
      const groupLink = product.groupLink;
      
      // Kirim notifikasi Telegram
      const telegramMsg = `🎉 <b>AKSES PANEL BARU BERHASIL</b>\n\n📦 <b>Order ID:</b> ${orderId}\n👤 <b>Username TG:</b> @${telegramUsername}\n🏷️ <b>Produk:</b> ${product.name}\n💵 <b>Amount:</b> Rp ${amount.toLocaleString('id-ID')}\n🔗 <b>Group Link:</b> ${groupLink}\n\n✅ User telah berhasil membeli akses ${product.name}`;
      
      await sendTelegramNotif(telegramMsg);
      
      return res.json({
        success: true,
        status: 'success',
        panel: {
          type: productType,
          name: product.name,
          telegramUsername,
          groupLink,
          orderId
        }
      });
    }
    
    if (status.includes('FAILED') || status.includes('EXPIRED') || status.includes('GAGAL')) {
      return res.json({ success: true, status: 'failed' });
    }
    
    res.json({ success: true, status: 'pending' });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server' 
    });
  }
});

// ==========================================
// ADMIN API - SERVER PRODUCTS (Yang Lama)
// ==========================================

app.get('/api/admin/products', requireAuth, (req, res) => {
  const products = Object.keys(CONFIG.prices).map(key => ({
    id: key,
    name: key.toUpperCase(),
    price: CONFIG.prices[key],
    specs: CONFIG.specs[key]
  }));
  
  res.json({ success: true, products });
});

app.post('/api/admin/products', requireAuth, async (req, res) => {
  try {
    let { id, price, ram, disk, cpu } = req.body;
    
    id = sanitizeInput(id);
    
    if (!id || price === undefined || ram === undefined || disk === undefined || cpu === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Semua field wajib diisi' 
      });
    }
    
    if (!/^[a-z0-9_-]+$/.test(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID hanya boleh huruf kecil, angka, - dan _' 
      });
    }
    
    if (CONFIG.prices[id]) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product ID sudah ada' 
      });
    }
    
    price = parseInt(price);
    ram = parseInt(ram);
    disk = parseInt(disk);
    cpu = parseInt(cpu);
    
    if (isNaN(price) || isNaN(ram) || isNaN(disk) || isNaN(cpu)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Price, RAM, Disk, dan CPU harus berupa angka' 
      });
    }
    
    if (price < 0 || ram < 0 || disk < 0 || cpu < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nilai tidak boleh negatif (gunakan 0 untuk unlimited)' 
      });
    }
    
    CONFIG.prices[id] = price;
    CONFIG.specs[id] = { ram, disk, cpu };
    
    const telegramMsg = `🆕 <b>PRODUK BARU DITAMBAHKAN</b>\n\n🏷️ <b>ID:</b> ${id}\n💰 <b>Harga:</b> Rp ${price.toLocaleString('id-ID')}\n💾 <b>RAM:</b> ${ram === 0 ? 'Unlimited' : ram + ' MB'}\n📦 <b>Disk:</b> ${disk === 0 ? 'Unlimited' : disk + ' MB'}\n⚡ <b>CPU:</b> ${cpu === 0 ? 'Unlimited' : cpu + '%'}\n\n👤 <b>Oleh:</b> ${req.session.adminUsername}`;
    
    await sendTelegramNotif(telegramMsg);
    
    res.json({ 
      success: true, 
      message: 'Product berhasil ditambahkan',
      product: { id, price, specs: CONFIG.specs[id] }
    });
    
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server' 
    });
  }
});

app.put('/api/admin/products/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    let { price, ram, disk, cpu } = req.body;
    
    if (!CONFIG.prices[id]) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product tidak ditemukan' 
      });
    }
    
    if (price === undefined || ram === undefined || disk === undefined || cpu === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Semua field wajib diisi' 
      });
    }
    
    price = parseInt(price);
    ram = parseInt(ram);
    disk = parseInt(disk);
    cpu = parseInt(cpu);
    
    if (isNaN(price) || isNaN(ram) || isNaN(disk) || isNaN(cpu)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Price, RAM, Disk, dan CPU harus berupa angka' 
      });
    }
    
    if (price < 0 || ram < 0 || disk < 0 || cpu < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nilai tidak boleh negatif (gunakan 0 untuk unlimited)' 
      });
    }
    
    const oldData = {
      price: CONFIG.prices[id],
      specs: {...CONFIG.specs[id]}
    };
    
    CONFIG.prices[id] = price;
    CONFIG.specs[id] = { ram, disk, cpu };
    
    const telegramMsg = `✏️ <b>PRODUK DIUPDATE</b>\n\n🏷️ <b>ID:</b> ${id}\n\n<b>Harga:</b>\n❌ Lama: Rp ${oldData.price.toLocaleString('id-ID')}\n✅ Baru: Rp ${price.toLocaleString('id-ID')}\n\n<b>Spek:</b>\n💾 RAM: ${oldData.specs.ram} MB → ${ram} MB\n📦 Disk: ${oldData.specs.disk} MB → ${disk} MB\n⚡ CPU: ${oldData.specs.cpu}% → ${cpu}%\n\n👤 <b>Oleh:</b> ${req.session.adminUsername}`;
    
    await sendTelegramNotif(telegramMsg);
    
    res.json({ 
      success: true, 
      message: 'Product berhasil diupdate',
      product: { id, price, specs: CONFIG.specs[id] }
    });
    
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server' 
    });
  }
});

app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!CONFIG.prices[id]) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product tidak ditemukan' 
      });
    }
    
    const deletedData = {
      price: CONFIG.prices[id],
      specs: {...CONFIG.specs[id]}
    };
    
    delete CONFIG.prices[id];
    delete CONFIG.specs[id];
    
    const telegramMsg = `🗑️ <b>PRODUK DIHAPUS</b>\n\n🏷️ <b>ID:</b> ${id}\n💰 <b>Harga:</b> Rp ${deletedData.price.toLocaleString('id-ID')}\n💾 <b>RAM:</b> ${deletedData.specs.ram} MB\n📦 <b>Disk:</b> ${deletedData.specs.disk} MB\n⚡ <b>CPU:</b> ${deletedData.specs.cpu}%\n\n👤 <b>Oleh:</b> ${req.session.adminUsername}`;
    
    await sendTelegramNotif(telegramMsg);
    
    res.json({ 
      success: true, 
      message: 'Product berhasil dihapus'
    });
    
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server' 
    });
  }
});

// ==========================================
// ADMIN API - PANEL PRODUCTS (RESELLER & ADMIN) - BARU!
// ==========================================

// Get panel products (admin)
app.get('/api/admin/panel-products', requireAuth, (req, res) => {
  const products = Object.keys(CONFIG.panelProducts).map(key => ({
    id: key,
    ...CONFIG.panelProducts[key]
  }));
  
  res.json({ success: true, products });
});

// Update panel product (admin) - INI BUAT UBAH HARGA & LINK GRUP!
app.put('/api/admin/panel-products/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    let { price, groupLink, description } = req.body;
    
    if (!CONFIG.panelProducts[id]) {
      return res.status(404).json({ 
        success: false, 
        message: 'Produk tidak ditemukan' 
      });
    }
    
    if (price === undefined || !groupLink) {
      return res.status(400).json({ 
        success: false, 
        message: 'Harga dan link grup wajib diisi' 
      });
    }
    
    price = parseInt(price);
    
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Harga harus berupa angka positif' 
      });
    }
    
    // Validasi URL
    if (!groupLink.startsWith('http')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Link grup harus URL yang valid (contoh: https://t.me/...)' 
      });
    }
    
    const oldPrice = CONFIG.panelProducts[id].price;
    const oldLink = CONFIG.panelProducts[id].groupLink;
    const oldDesc = CONFIG.panelProducts[id].description;
    
    CONFIG.panelProducts[id].price = price;
    CONFIG.panelProducts[id].groupLink = groupLink;
    if (description) CONFIG.panelProducts[id].description = description;
    
    const telegramMsg = `✏️ <b>PRODUK PANEL DIUPDATE</b>\n\n🏷️ <b>ID:</b> ${id}\n📛 <b>Nama:</b> ${CONFIG.panelProducts[id].name}\n\n<b>Harga:</b>\n❌ Lama: Rp ${oldPrice.toLocaleString('id-ID')}\n✅ Baru: Rp ${price.toLocaleString('id-ID')}\n\n<b>Link Grup:</b>\n❌ Lama: ${oldLink}\n✅ Baru: ${groupLink}\n\n👤 <b>Oleh:</b> ${req.session.adminUsername}`;
    
    await sendTelegramNotif(telegramMsg);
    
    res.json({ 
      success: true, 
      message: 'Produk panel berhasil diupdate',
      product: { id, ...CONFIG.panelProducts[id] }
    });
    
  } catch (err) {
    console.error('Update panel product error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server' 
    });
  }
});

// ==========================================
// STATS & HEALTH
// ==========================================

app.get('/api/admin/stats', requireAuth, (req, res) => {
  const totalProducts = Object.keys(CONFIG.prices).length;
  const totalRevenue = Object.values(CONFIG.prices).reduce((sum, price) => sum + price, 0);
  const avgPrice = totalProducts > 0 ? totalRevenue / totalProducts : 0;
  
  const totalPanelProducts = Object.keys(CONFIG.panelProducts).length;
  
  res.json({
    success: true,
    stats: {
      totalProducts,
      totalRevenue,
      avgPrice: Math.round(avgPrice),
      cheapestProduct: totalProducts > 0 ? Math.min(...Object.values(CONFIG.prices)) : 0,
      mostExpensive: totalProducts > 0 ? Math.max(...Object.values(CONFIG.prices)) : 0,
      totalPanelProducts,
      resellerPrice: CONFIG.panelProducts.reseller.price,
      adminPrice: CONFIG.panelProducts.admin.price
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Terjadi kesalahan server' 
  });
});

app.use((req, res) => {
  res.status(404).send('404 - Not Found');
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔒 Security: Helmet + Rate Limiting enabled`);
  console.log(`👤 Admin: http://localhost:${PORT}/admin/login`);
  console.log(`📝 Username: ${CONFIG.admin.username} | Password: ${CONFIG.admin.password}`);
  console.log(`📦 Server Plans: ${Object.keys(CONFIG.prices).length} products`);
  console.log(`👑 Panel Products: Reseller (Rp ${CONFIG.panelProducts.reseller.price.toLocaleString()}) | Admin (Rp ${CONFIG.panelProducts.admin.price.toLocaleString()})`);
});
