const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const mqtt = require('mqtt');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CẤU HÌNH MONGODB ---
const MONGO_URI = "mongodb+srv://IOT:123@clusteriot.5bryo7q.mongodb.net/?appName=ClusterIOT";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB"))
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

// Schema dữ liệu
const LogSchema = new mongoose.Schema({
    temp: Number,
    humi: Number,
    ldr: Number,
    pir: Number,
    timestamp: { type: Date, default: Date.now }
});
const LogModel = mongoose.model('Log', LogSchema);

// --- 2. CẤU HÌNH MQTT (HiveMQ Cloud - SSL/TLS) ---
// Lưu ý: Phải có 'mqtts://' ở đầu vì dùng port 8883
const MQTT_BROKER = "mqtts://e92f64d335bb4671b8a0ec4a667e3438.s1.eu.hivemq.cloud";

const MQTT_OPTIONS = {
    port: 8883,
    username: 'MQTT_IOT',  // User bạn cung cấp
    password: 'Iot@12345', // Pass bạn cung cấp
    protocol: 'mqtts',
    rejectUnauthorized: false // Chấp nhận kết nối dễ dàng hơn
};

// Topic (Giữ nguyên như cũ để khớp với ESP8266)
const MQTT_TOPIC = "sinhvien/iot/nha_thong_minh/data";

const mqttClient = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

mqttClient.on('connect', () => {
    console.log("✅ Đã kết nối tới HiveMQ Cloud (Private)!");
    mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (!err) {
            console.log(`📡 Đang lắng nghe tại topic: ${MQTT_TOPIC}`);
        }
    });
});

mqttClient.on('error', (err) => {
    console.error("❌ Lỗi kết nối MQTT:", err);
});

// Xử lý tin nhắn nhận về
mqttClient.on('message', async (topic, message) => {
    if (topic === MQTT_TOPIC) {
        try {
            const dataStr = message.toString();
            console.log("📩 Nhận MQTT:", dataStr);
            const data = JSON.parse(dataStr);

            const newLog = new LogModel(data);
            await newLog.save();
            console.log("💾 Đã lưu DB!");
        } catch (err) {
            console.error("❌ Lỗi data:", err.message);
        }
    }
});

// --- API WEB ---
app.post('/api/data', async (req, res) => {
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
        // Lấy lịch sử, có thể lọc theo ngày nếu cần
        let query = {};
        if (req.query.startDate && req.query.endDate) {
            query.timestamp = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate)
            };
        }
        const logs = await LogModel.find(query).sort({ timestamp: -1 }).limit(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy port ${PORT}`));