const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const mqtt = require('mqtt');
const bcrypt = require('bcryptjs'); // THƯ VIỆN MỚI để so sánh mật khẩu

const app = express();

// --- CẤU HÌNH CORS (Quan trọng để Web Firebase gọi được) ---
app.use(cors({
    origin: '*', // Cho phép mọi nguồn truy cập
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// --- 1. KẾT NỐI MONGODB ---
// Lưu ý: Đổi tên database thành 'test' vì trong ảnh của bạn database tên là 'test'
const MONGO_URI = "mongodb+srv://IOT:123@clusteriot.5bryo7q.mongodb.net/test?appName=ClusterIOT";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Đã kết nối MongoDB: Database 'test'"))
    .catch(err => console.error("❌ Lỗi MongoDB:", err));

// --- SCHEMA DỮ LIỆU ---

// 1. Schema cho Log cảm biến (Giữ nguyên)
const LogSchema = new mongoose.Schema({
    temp: Number,
    humi: Number,
    ldr: Number,
    pir: Number,
    timestamp: { type: Date, default: Date.now }
});
const LogModel = mongoose.model('Log', LogSchema); // Tự động tìm collection 'logs'

// 2. Schema cho User (MỚI: Để đăng nhập)
// Collection trong ảnh của bạn tên là 'users'
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
});
const UserModel = mongoose.model('users', UserSchema);

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

    // Thêm hàm báo lỗi chi tiết
    mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (!err) {
            console.log(`📡 Đã đăng ký nhận tin tại topic: ${MQTT_TOPIC}`);
        } else {
            console.error("❌ Lỗi Subscribe (Không thể nhận tin):", err);
        }
    });
});

mqttClient.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log("📩 Nhận MQTT:", data); // Tắt bớt log đỡ rối
        const newLog = new LogModel(data);
        await newLog.save();
        console.log("💾 Đã lưu vào DB!");
    } catch (e) { console.error(e); }
});

// --- 3. API ĐĂNG NHẬP (QUAN TRỌNG: Đã sửa để đọc từ DB) ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`📡 Login Request: ${username}`);

    try {
        // 1. Tìm user trong MongoDB
        const user = await UserModel.findOne({ username: username });

        if (!user) {
            return res.status(401).json({ error: "Tài khoản không tồn tại!" });
        }

        // 2. So sánh mật khẩu (Input vs Hash trong DB)
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: "Sai mật khẩu!" });
        }

        // 3. Đăng nhập thành công -> Trả về Token và Role
        res.json({
            status: "success",
            token: "fake-jwt-token-" + user._id, // Demo token
            role: user.role,
            username: user.username
        });
        console.log("=> Đăng nhập thành công!");

    } catch (err) {
        console.error("Lỗi đăng nhập:", err);
        res.status(500).json({ error: "Lỗi Server khi xử lý đăng nhập" });
    }
});

// --- API Lịch sử ---
app.get('/api/history', async (req, res) => {
    try {
        const logs = await LogModel.find().sort({ timestamp: -1 }).limit(20);
        res.json(logs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API nhận data từ Web
app.post('/api/data', async (req, res) => {
    try {
        const newLog = new LogModel(req.body);
        await newLog.save();
        res.json({ status: "success" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
// API TÌM KIẾM DỮ LIỆU (Search)
app.get('/api/search', async (req, res) => {
    try {
        const { start, end } = req.query;

        if (!start || !end) {
            return res.status(400).json({ error: "Vui lòng chọn ngày bắt đầu và kết thúc" });
        }

        // Xử lý ngày giờ: 
        // Start: Bắt đầu từ 00:00:00 của ngày đó
        // End: Kết thúc lúc 23:59:59 của ngày đó
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);

        console.log(`🔍 Search: ${startDate.toISOString()} -> ${endDate.toISOString()}`);

        const logs = await LogModel.find({
            timestamp: {
                $gte: startDate, // Lớn hơn hoặc bằng ngày bắt đầu
                $lte: endDate    // Nhỏ hơn hoặc bằng ngày kết thúc
            }
        }).sort({ timestamp: -1 }); // Mới nhất lên đầu

        res.json(logs);

    } catch (err) {
        console.error("Lỗi tìm kiếm:", err);
        res.status(500).json({ error: "Lỗi Server khi tìm kiếm" });
    }
});

// API XÓA DỮ LIỆU (Nhận vào mảng các ID)
app.post('/api/delete', async (req, res) => {
    try {
        const { ids } = req.body; // Ví dụ client gửi: { "ids": ["id1", "id2"] }

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Chưa chọn dữ liệu để xóa" });
        }

        // Lệnh deleteMany của MongoDB với toán tử $in (nằm trong danh sách)
        const result = await LogModel.deleteMany({ _id: { $in: ids } });

        console.log(`🗑️ Đã xóa ${result.deletedCount} bản ghi.`);
        res.json({ status: "success", deletedCount: result.deletedCount });

    } catch (err) {
        console.error("Lỗi xóa:", err);
        res.status(500).json({ error: "Lỗi Server khi xóa" });
    }
});
app.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));