const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");

// App setup
const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory OTP store (RAM)
const otpStore = {}; // { email: { otp, expires } }

// === Create Gmail transporter ===
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASS,
    },
});

// === Generate 6-digit OTP ===
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// === Request OTP ===
app.post("/request-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const otp = generateOtp();
    const expires = Date.now() + 5 * 60 * 1000; // 5-minute expiry

    otpStore[email] = { otp, expires };

    try {
        await transporter.sendMail({
            from: `"MyBanking OTP" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
        });

        res.json({ success: true, message: "OTP sent" });
    } catch (err) {
        console.error("Email error:", err);
        res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
});

// === Verify OTP ===
app.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp)
        return res.status(400).json({ success: false, message: "Email & OTP required" });

    const record = otpStore[email];
    if (!record) return res.json({ success: false, message: "OTP not found" });

    if (record.expires < Date.now())
        return res.json({ success: false, message: "OTP expired" });

    if (record.otp !== otp)
        return res.json({ success: false, message: "Invalid OTP" });

    delete otpStore[email]; // Mark used
    res.json({ success: true, message: "OTP verified" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("OTP server running on port " + PORT);
});
