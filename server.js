const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();

// --- QUAN TRỌNG: Cấu hình CORS cho phép mọi nguồn truy cập ---
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- 1. KẾT NỐI MONGODB ---
const MONGO_URI = "mongodb+srv://IOT:123@clusteriot.5bryo7q.mongodb.net/?appName=ClusterIOT";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB"))
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

const LogSchema = new mongoose.Schema({
    temp: Number,
    humi: Number,
    ldr: Number,
    pir: Number,
    timestamp: { type: Date, default: Date.now }
});
const LogModel = mongoose.model('Log', LogSchema);

// --- 2. KẾT NỐI MQTT (HiveMQ Cloud SSL) ---
const MQTT_BROKER = "mqtts://e92f64d335bb4671b8a0ec4a667e3438.s1.eu.hivemq.cloud";
const MQTT_OPTIONS = {
    port: 8883,
    username: 'MQTT_IOT',
    password: 'Iot@12345',
    protocol: 'mqtts',
    rejectUnauthorized: false
};
const MQTT_TOPIC = "sinhvien/iot/nha_thong_minh/data";

const mqttClient = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

mqttClient.on('connect', () => {
    console.log("✅ Đã kết nối HiveMQ Cloud!");
    mqttClient.subscribe(MQTT_TOPIC);
});

mqttClient.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log("📩 Nhận MQTT:", data);
        const newLog = new LogModel(data);
        await newLog.save();
    } catch (e) { console.error(e); }
});

// --- 3. API ĐĂNG NHẬP (MỚI THÊM) ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Code cứng tài khoản để demo (Bạn có thể sửa lại)
    if (username === 'admin' && password === '123456') {
        return res.json({ token: 'fake-jwt-token-admin', role: 'admin' });
    }
    if (username === 'user' && password === '123456') {
        return res.json({ token: 'fake-jwt-token-user', role: 'user' });
    }

    res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu!" });
});

// --- 4. API DỮ LIỆU ---
app.get('/api/history', async (req, res) => {
    try {
        const logs = await LogModel.find().sort({ timestamp: -1 }).limit(20);
        res.json(logs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API nhận data từ Simulator (Web)
app.post('/api/data', async (req, res) => {
    try {
        const newLog = new LogModel(req.body);
        await newLog.save();
        res.json({ status: "success" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));