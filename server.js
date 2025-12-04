const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// const mqtt = require('mqtt'); // Tạm ẩn MQTT nếu chưa dùng tới

const app = express();
app.use(cors());
app.use(express.json());

// --- CẤU HÌNH MONGODB ---
// Thay chuỗi kết nối của bạn vào đây
const MONGO_URI = "mongodb+srv://<USER>:<PASS>@cluster....mongodb.net/SmartHomeDB";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB"))
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

// Định nghĩa dữ liệu
const LogSchema = new mongoose.Schema({
    temp: Number,
    humi: Number,
    ldr: Number,
    pir: Number,
    timestamp: { type: Date, default: Date.now }
});
const LogModel = mongoose.model('Log', LogSchema);

// --- 1. API NHẬN DỮ LIỆU TỪ WEB (SIMULATOR) ---
app.post('/api/data', async (req, res) => {
    try {
        const data = req.body;
        console.log("Nhận dữ liệu từ Web:", data);

        // Lưu vào MongoDB
        const newLog = new LogModel(data);
        await newLog.save();

        res.json({ status: "success", message: "Đã lưu DB" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. API TRẢ VỀ LỊCH SỬ CHO BÁO CÁO ---
app.get('/api/history', async (req, res) => {
    try {
        // Lấy 20 dòng mới nhất, sắp xếp mới -> cũ
        const logs = await LogModel.find().sort({ timestamp: -1 }).limit(20);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chạy Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server đang chạy tại port ${PORT}`));