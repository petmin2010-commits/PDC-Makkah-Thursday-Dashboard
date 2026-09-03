PDC MAKKAH — WEBSITE VERSION
============================

هذه نسخة ويب مستقلة من مشروع Google Apps Script الأصلي.
تم الحفاظ على واجهة الـ Dashboard والشارتات والفلاتر، مع استبدال google.script.run بواجهة API داخلية.

المتطلبات:
1) Node.js 20 أو أحدث.
2) Google Service Account لديه صلاحية قراءة Google Sheet.
3) مشاركة ملف Google Sheet مع بريد الـ Service Account بصلاحية Viewer.

الإعداد لأول مرة:
1) انسخ .env.example إلى ملف اسمه .env
2) افتح Google Sheet وانسخ الـ ID من الرابط:
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
3) ضع الـ ID في:
   SPREADSHEET_ID=...
4) ضع ملف Service Account JSON باسم credentials.json داخل نفس مجلد المشروع.
5) شارك Google Sheet مع client_email الموجود داخل credentials.json كـ Viewer.

التشغيل على Windows PowerShell:
cd "مسار\PDC_Makkah_Website"
npm install
npm start

ثم افتح:
http://localhost:3000

فحص الاتصال:
http://localhost:3000/api/health

للنشر على سيرفر:
يمكن تشغيل نفس المشروع على VPS / Render / Railway / Azure / Google Cloud Run.
لا ترفع credentials.json إلى GitHub أو أي مستودع عام.
