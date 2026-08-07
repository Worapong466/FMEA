# SolarCellDIY Service FMEA

เว็บภายในสำหรับทีมงาน SolarCellDIY ใช้บันทึกเคสบริการในรูปแบบ FMEA และค้นหาวิธีแก้จากเคสเดิม

## โครงสร้าง

- `index.html` หน้าเว็บ GitHub Pages
- `styles.css` รูปแบบหน้าจอ
- `app.js` การค้นหา รวมกลุ่ม คำนวณ RPN และเชื่อม API
- `config.js` URL ของ Google Apps Script Web App
- `Code.gs` ฝั่ง Google Apps Script สำหรับอ่าน/เขียน Google Sheets และตรวจรหัสพนักงาน

## การเชื่อม Google Sheets

ฐานข้อมูล: `SolarCellDIY FMEA Database`

1. เปิด Google Sheets > Extensions > Apps Script
2. วางโค้ดจาก `Code.gs`
3. Deploy > New deployment > Web app
4. Execute as: Me
5. Who has access: Anyone
6. คัดลอก Web app URL แล้วใส่ใน `config.js` ที่ `API_URL`

API ตรวจรหัสพนักงานจากแท็บ `Staff` ทุกครั้งก่อนอนุญาตให้อ่านหรือเขียนข้อมูล
