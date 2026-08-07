// دریافت دامنه اصلی (برش زدن اتوماتیک مسیرهای اضافی)
// خروجی مثال: https://yourdomain.com یا http://localhost:3000
const currentOrigin = window.location.origin;

// ساخت URL نهایی برای هدایت کاربر
const finalUrl = currentOrigin + "/lobby";

// پیدا کردن المان نگهدارنده کیوآر کد در HTML
const qrContainer = document.getElementById("qrcode");

// تولید کیوآر کد با استفاده از کتابخانه لوکال
const qrcode = new QRCode(qrContainer, {
    text: finalUrl,           // آدرسی که کاربر پس از اسکن به آن می‌رود
    width: 250,               // عرض تصویر خروجی (پیکسل)
    height: 250,              // ارتفاع تصویر خروجی (پیکسل)
    colorDark: "#1a1a27",     // رنگ خانه‌های کیوآر کد
    colorLight: "#ffffff",    // رنگ پس‌زمینه
    correctLevel: QRCode.CorrectLevel.H // بالاترین سطح تصحیح خطا
});

// صرفاً جهت بررسی در کنسول مرورگر
console.log("آدرس پایه:", currentOrigin);
console.log("کیوآر کد برای این آدرس ساخته شد:", finalUrl);