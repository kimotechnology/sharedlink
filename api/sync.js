const axios = require('axios');
const admin = require('firebase-admin');

// تهيئة الفايربيز داخل السيرفر بأمان
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "kimo-tecnology",
            // الفايربيز بيقرا الحساب تلقائياً من الـ Environment Variables في السيرفر
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
        }),
        databaseURL: "https://kimo-tecnology-default-rtdb.firebaseio.com"
    });
}

const db = admin.database();

module.exports = async (req, res) => {
    // إعدادات الـ CORS عشان الفرونت إند يقدر يكلم السيرفر بدون مشاكل
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { uid, email } = req.body;
    if (!uid) return res.status(400).json({ error: 'User ID is required' });

    // الـ API Key الحقيقي بتاعك محفوظ في السيرفر مش في الكود
    const REVLINK_API_KEY = process.env.REVLINK_API_KEY; 

    try {
        // 1. جلب الأرباح الحقيقية من Revlink (تأكد من رابط الـ API الصحيح من دعم الموقع لديك)
        // لنفترض أن الرابط يتطلب الـ API Key ومعرف المستخدم لمعرفة أرباحه بدقة:
        const revlinkResponse = await axios.get(`https://revlink.pro/api?api=${REVLINK_API_KEY}&action=user_stats&user_email=${email}`);
        
        // جلب الرقم الحقيقي القادم من حسابك
        const realTotalEarnings = parseFloat(revlinkResponse.data.total_earnings) || 0; 
        
        // 2. المعادلة الرياضية الحقيقية (حساب نصف الأرباح بدقة 50%)
        const userShare = realTotalEarnings * 0.50;

        // 3. تحديث قاعدة بيانات Firebase Realtime Database فوراً من السيرفر الآمن
        await db.ref(`users/${uid}`).update({
            email: email,
            revlinkTotal: realTotalEarnings,
            userShare: userShare,
            lastUpdated: admin.database.ServerValue.TIMESTAMP
        });

        // إرجاع النتيجة للوحة التحكم لعرضها للمستخدم برقمها الحقيقي
        return res.status(200).json({
            success: true,
            revlinkTotal: realTotalEarnings,
            userShare: userShare
        });

    } catch (error) {
        console.error("Error updating real money:", error);
        return res.status(500).json({ error: 'فشل في الاتصال بمزود الأرباح الحقيقي أو الفايربيز' });
    }
};
