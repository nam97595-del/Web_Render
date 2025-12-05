const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const mqtt = require('mqtt'); // Đã bật thư viện MQTT

const app = express();
app.use(cors());
app.use(express.json());

// --- CẤU HÌNH MONGODB ---
const MONGO_URI = "mongodb+srv://IOT:123@clusteriot.5bryo7q.mongodb.net/?appName=ClusterIOT";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB"))
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

// Định nghĩa dữ liệu (Schema)
const LogSchema = new mongoose.Schema({
    temp: Number,
    humi: Number,
    ldr: Number,
    pir: Number,
    timestamp: { type: Date, default: Date.now }
});
const LogModel = mongoose.model('Log', LogSchema);

// --- CẤU HÌNH MQTT (HiveMQ Public Broker) ---
const MQTT_BROKER = "mqtt://broker.hivemq.com";
// ⚠️ QUAN TRỌNG: Đặt tên Topic này thật độc lạ để không trùng với người khác
const MQTT_TOPIC = "sinhvien/iot/nha_thong_minh/data"; 

const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
    console.log("✅ Đã kết nối tới HiveMQ Broker");
    // Đăng ký nhận tin từ Topic
    mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (!err) {
            console.log(`📡 Đang lắng nghe tại topic: ${MQTT_TOPIC}`);
        }
    });
});

// Xử lý khi có tin nhắn từ ESP8266 gửi lên
mqttClient.on('message', async (topic, message) => {
    if (topic === MQTT_TOPIC) {
        try {
            // Chuyển chuỗi JSON nhận được thành Object
            const dataStr = message.toString();
            console.log("📩 Nhận MQTT:", dataStr);
            const data = JSON.parse(dataStr);

            // Lưu vào MongoDB
            const newLog = new LogModel(data);
            await newLog.save();
            console.log("💾 Đã lưu vào DB thành công!");

        } catch (err) {
            console.error("❌ Lỗi xử lý tin nhắn MQTT:", err.message);
        }
    }
});

// --- API CHO WEB (Vẫn giữ nguyên để Web hiển thị) ---
app.post('/api/data', async (req, res) => {
    // API này dùng cho Web giả lập (Simulator)
    try {
        const newLog = new LogModel(req.body);
        await newLog.save();
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const logs = await LogModel.find().sort({ timestamp: -1 }).limit(20);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server đang chạy tại port ${PORT}`));