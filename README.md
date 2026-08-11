# Internal Vision Platform

เว็บภายในสำหรับจัดการงาน Computer Vision ตั้งแต่สร้างโปรเจกต์ อัปโหลดรูป ตีกรอบวัตถุ (Annotation) และสร้าง Dataset สำหรับ YOLO โดยใช้พื้นที่ทำงานและที่เก็บข้อมูลร่วมกันหนึ่งชุด

## ตอนนี้ใช้งานอะไรได้แล้ว

- เข้าใช้งานได้ทันทีผ่านพื้นที่ทำงานร่วมกัน ไม่ต้องล็อกอิน
- สร้างและลบโปรเจกต์
- อัปโหลดรูปแบบหลายไฟล์ ทั้ง JPG, PNG และ WebP
- เลือกอัปโหลดทั้งโฟลเดอร์หรือไฟล์ ZIP
- ส่งรูปจากมือถือผ่าน QR Code
- ตรวจรูปซ้ำด้วย SHA-256
- สร้าง Class และตีกรอบ Bounding Box
- ย้าย ย่อ ขยาย เปลี่ยน Class และลบกรอบ
- Undo, Redo และบันทึก Annotation อัตโนมัติ
- สร้าง Dataset Version จากรูปที่ Annotate แล้ว
- แบ่งรูปเป็น Train, Validation และ Test ตามเปอร์เซ็นต์ที่กำหนด
- แปลง Bounding Box เป็น YOLO label และสร้าง `data.yaml`
- เลือกเก็บภาพต้นฉบับหรือปรับเป็น 120×120, 320×320 และ 640×640
- ดาวน์โหลด Dataset ทั้งชุดเป็น ZIP
- Register เครื่อง Training Worker และส่ง Heartbeat ทุก 8 วินาที
- เลือก Dataset ได้หลายเวอร์ชัน เลือก Worker, รุ่น YOLO และค่าการ Train แล้วส่งงานเข้า Queue
- ดู Epoch, Progress, Metrics และ Training log
- ยกเลิกงานและ Retry งานที่ไม่สำเร็จ
- ตั้งชื่อโฟลเดอร์ผลลัพธ์ก่อน Train และดาวน์โหลดผลลัพธ์เป็น ZIP
- รับไฟล์ `best.pt`, `last.pt` และผลลัพธ์จาก Worker พร้อมตรวจสิทธิ์ก่อนดาวน์โหลด

Worker ทำงานใน **Real mode** เป็นค่าเริ่มต้น โดยใช้ PyTorch และ Ultralytics เทรน Dataset จริง เมื่อเสร็จจะส่ง `best.pt`, `last.pt` และ `results.csv` กลับ Web Server แล้วลบ Dataset กับไฟล์ชั่วคราวออกจากเครื่อง Worker อัตโนมัติ ส่วน `Simulation mode` ยังเปิดใช้ได้ด้วย `WORKER_MODE="simulation"` สำหรับทดสอบ Queue โดยไม่สร้างโมเดลจริง

หมายเหตุเรื่องการนำไปใช้: Ultralytics มีทั้ง AGPL-3.0 และ Enterprise License หากจะใช้เป็นระบบภายในองค์กรหรือเชิงพาณิชย์ ให้ตรวจเงื่อนไขล่าสุดจาก [Ultralytics Licensing](https://docs.ultralytics.com/#yolo-licenses-how-is-ultralytics-yolo-licensed) ให้ตรงกับรูปแบบการใช้งานของคุณ

## เริ่มใช้งานครั้งแรก

เครื่องที่ใช้รันต้องมี:

- Node.js 20.9 ขึ้นไป แนะนำ Node.js 22 LTS
- Corepack และ Yarn 4.18.0 (โปรเจกต์ล็อกเวอร์ชันให้อัตโนมัติ)
- Python 3.10 ขึ้นไปและแพ็กเกจ `python3-venv` สำหรับเครื่องที่จะใช้ Train
- Ubuntu, Linux หรือระบบอื่นที่รองรับ Node.js

ตรวจสอบเวอร์ชันก่อน:

```bash
node -v
corepack --version
corepack enable
yarn --version
```

ถ้ายังไม่มีไฟล์ `.env` ให้คัดลอกจาก `.env.example` ก่อน จากนั้นเปิด Terminal ที่โฟลเดอร์โปรเจกต์แล้วรัน:

```bash
cp .env.example .env
yarn install
yarn db:deploy
yarn worker:setup
yarn dev
```

`yarn worker:setup` ใช้เฉพาะเครื่องที่จะ Train และรันครั้งแรกหรือเมื่อเปลี่ยน PyTorch เท่านั้น หากไม่พบ NVIDIA ระบบจะติดตั้ง PyTorch รุ่น CPU ให้เอง

เมื่อ Terminal แสดงว่าเว็บพร้อมแล้ว ให้เปิด:

[http://localhost:3000](http://localhost:3000)

ครั้งต่อไปใช้เพียง:

```bash
yarn dev
```

หยุดเว็บได้ด้วย `Ctrl + C` ที่ Terminal

## โหมดพื้นที่ทำงานเดียว

ตอนนี้ระบบปิดหน้า Login ชั่วคราว เมื่อเปิดเว็บจะเข้าสู่พื้นที่ทำงานร่วมกันทันที โปรเจกต์ รูป Annotation และ Dataset ใหม่ทั้งหมดจะเก็บภายใต้พื้นที่หลัก `mo` ชุดเดียว ข้อมูลบัญชีเดิมยังอยู่ใน Database เพื่อให้เปิดระบบ Login กลับมาได้ภายหลัง

เนื่องจากไม่มีรหัสผ่าน ผู้ที่เปิด URL ของเว็บได้จะสามารถดู แก้ไข และลบข้อมูลได้ ควรใช้เฉพาะในเครื่องหรือเครือข่ายส่วนตัวที่ไว้ใจได้

## วิธีใช้งานแบบสั้น

1. เปิดเว็บแล้วกด **New Project** เพื่อสร้างโปรเจกต์
2. เข้าเมนู **Upload** แล้วเพิ่มรูป
3. เข้าเมนู **Annotate**
4. สร้าง Class เช่น `person`, `car` หรือ `bottle`
5. เลือกเครื่องมือ Bounding Box แล้วลากกรอบรอบวัตถุ
6. รอให้มุมขวาบนแสดงคำว่า **Saved**
7. เข้าเมนู **Dataset** แล้วกด **Generate dataset**
8. กำหนดสัดส่วน Train, Validation และ Test ให้รวมกันเป็น 100%
9. ดาวน์โหลด ZIP เพื่อนำไปใช้กับ YOLO
10. เปิด Worker แล้วเข้าเมนู **Train โมเดล** เพื่อส่งงานเข้า Queue

## การอัปโหลดรูป

เข้าโปรเจกต์แล้วเลือกเมนู **Upload** สามารถเพิ่มรูปได้หลายวิธี:

- ลากไฟล์มาวาง
- เลือกหลายไฟล์พร้อมกัน
- เลือกทั้งโฟลเดอร์ผ่าน Chrome หรือ Edge
- อัปโหลด ZIP แล้วให้ Server แตกไฟล์รูปออกมา

ระบบรองรับ JPG, JPEG, PNG และ WebP รูปหนึ่งไฟล์มีขนาดได้ไม่เกิน 25 MB ส่วน ZIP มีขนาดได้ไม่เกิน 250 MB

ถ้ารูปเดิมมีอยู่ในโปรเจกต์แล้ว ระบบจะแจ้งว่าเป็นรูปซ้ำและไม่บันทึกซ้ำ

## ส่งรูปจากมือถือด้วย QR Code

มือถือและคอมพิวเตอร์ต้องเชื่อมต่อเครือข่ายเดียวกัน หรือเชื่อมกันผ่าน Tailscale

1. เปิดเว็บผ่าน LAN IP, ชื่อโดเมน หรือ Tailscale URL ที่มือถือเข้าถึงได้
2. ระบบจะสร้าง QR จาก URL ที่เปิดเว็บอยู่โดยอัตโนมัติ (รวมถึง `X-Forwarded-Host` เมื่ออยู่หลัง reverse proxy)
3. ห้ามสแกน QR ที่มี `localhost` เพราะในมือถือคำนี้หมายถึงมือถือเอง
4. เข้าเมนู **Upload** แล้วกด **Upload from mobile**
5. ใช้มือถือสแกน QR Code และเลือกรูปจากเครื่อง

หาก Web Server เห็น request เป็น `localhost` เสมอ ให้ตั้ง fallback นี้ใน `.env` แล้วเปิดเว็บใหม่:

```env
PUBLIC_APP_URL="https://vision.example.com"
```

QR Code ใช้ได้เฉพาะโปรเจกต์ที่สร้างลิงก์ มีอายุ 15 นาที และสามารถกดยกเลิกก่อนหมดเวลาได้

## วิธีใช้หน้า Annotate

เข้าเมนู **Annotate** แล้วสร้าง Class ทางด้านขวาก่อน เช่น `person` หรือ `bottle` จากนั้นเลือกเครื่องมือ Bounding Box และลากกรอบรอบวัตถุในภาพ

เครื่องมือที่มี:

- **Select** — เลือก ย้าย หรือปรับขนาดกรอบ
- **Bounding Box** — วาดกรอบใหม่
- **Pan** — เลื่อนดูภาพ
- **Zoom In / Zoom Out** — ขยายหรือย่อภาพ
- **Fit Image** — จัดภาพให้พอดีกับพื้นที่ทำงาน
- **Undo / Redo** — ย้อนกลับหรือทำซ้ำ
- **Delete** — ลบกรอบที่เลือก

คีย์ลัด:

| ปุ่ม | การทำงาน |
| --- | --- |
| `B` | เลือกเครื่องมือ Bounding Box |
| `V` | เลือกเครื่องมือ Select |
| `H` | เลือกเครื่องมือ Pan |
| `Delete` | ลบกรอบที่เลือก |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `←` / `→` | ไปยังรูปก่อนหน้าหรือรูปถัดไป |

ระบบบันทึกให้อัตโนมัติ ไม่ต้องกดปุ่ม Save หากขึ้น **Save failed** ให้ตรวจการเชื่อมต่อแล้วกด **Retry**

หากลบ Class ที่ถูกใช้ไปแล้ว ระบบจะถามยืนยันก่อน และเมื่อลบจะลบ Annotation ที่ใช้ Class นั้นด้วย

## การสร้าง Dataset

เข้าเมนู **Dataset** แล้วกด **Generate dataset** ระบบจะใช้เฉพาะรูปที่มี Annotation และสร้างสำเนาใหม่แยกเป็นแต่ละเวอร์ชัน เช่น v1, v2 และ v3

ในหน้าสร้าง Dataset ให้กำหนด:

- ชื่อ Dataset
- ขนาดภาพ Original, 120×120, 320×320 หรือ 640×640
- Train %
- Validation %
- Test %

เปอร์เซ็นต์ทั้งสามส่วนต้องรวมกันเป็น 100% หากจำนวนรูปมีน้อย บางส่วนอาจได้ 0 รูปหลังการปัดเศษ

Dataset ที่สร้างแล้วจะไม่เปลี่ยนตาม Annotation ภายหลัง หากแก้กรอบหรือเพิ่มรูป ต้อง Generate เป็นเวอร์ชันใหม่เพื่อเก็บ snapshot ล่าสุด

### ควรเลือกขนาดภาพเท่าไร

| ตัวเลือก | เหมาะกับงานแบบไหน |
| --- | --- |
| **Original** | เก็บรายละเอียดต้นฉบับ แล้วให้ YOLO resize ตอน Train ตามค่า `imgsz` แนะนำสำหรับงานทั่วไป |
| **120×120** | ไฟล์เล็กและเร็วมาก แต่รายละเอียดวัตถุขนาดเล็กอาจหาย |
| **320×320** | สมดุลระหว่างความเร็วกับรายละเอียด |
| **640×640** | ขนาดมาตรฐานที่นิยมใช้กับ YOLO และเก็บรายละเอียดได้ดีกว่า |

รูปใน Train และ Validation ไม่จำเป็นต้องมีขนาดต้นฉบับเท่ากัน เพราะ YOLO จะ resize และทำ letterbox ตาม `imgsz` ระหว่าง Train อย่างไรก็ตาม ทั้งสองชุดควรใช้ขั้นตอนเตรียมภาพแบบเดียวกันเพื่อให้ผล Validation ยุติธรรม

หากเลือก 120, 320 หรือ 640 ระบบจะใช้ขนาดนั้นกับ Train, Validation และ Test ทั้งหมด โดยรักษาสัดส่วนภาพ เติมขอบสีเทาแบบ letterbox และคำนวณ Bounding Box ใหม่ให้ตรงกับภาพ จึงไม่ยืดหรือครอปวัตถุ

ไฟล์ ZIP ที่ดาวน์โหลดจะมีโครงสร้าง:

```text
dataset_v1/
  images/
    train/
    val/
    test/
  labels/
    train/
    val/
    test/
  data.yaml
  dataset.json
```

ไฟล์ label ใช้รูปแบบ YOLO:

```text
class_id center_x center_y width height
```

พิกัดทั้งหมดเป็นค่าระหว่าง 0–1 ระบบแบ่งรูปแบบ deterministic เพื่อให้ผลลัพธ์ตรวจสอบซ้ำได้

## ระบบ Train โมเดลจริง

ระบบแยกเป็นสองส่วนเพื่อไม่ให้การ Train ทำให้เว็บค้าง:

- **Web Server** เก็บ Project, Dataset, Training Queue, Progress และ Log
- **Training Worker** รันแยกบนเครื่องที่ใช้ CPU/GPU และติดต่อ Server ผ่าน REST API

Worker จะ Register ตัวเองเมื่อเปิด ส่ง Heartbeat ทุก 8 วินาที และถามหา Job ใหม่ทุก 3 วินาที หาก Server ไม่ได้รับ Heartbeat เกิน 30 วินาที เครื่องนั้นจะแสดงเป็นออฟไลน์อัตโนมัติ

เมื่อ Worker รับงาน ระบบจะดาวน์โหลด ZIP จาก Server แตกไฟล์อย่างปลอดภัย เรียก Ultralytics เพื่อ Train และ Validation รายงานผลแต่ละ Epoch แล้วอัปโหลด Checkpoint กลับ Server หากกดยกเลิก ระบบจะหยุด Python trainer และล้าง Cache ของงานนั้น

สถานะงานที่รองรับคือ `Queued`, `Preparing`, `Downloading Dataset`, `Training`, `Validating`, `Saving Model`, `Completed`, `Failed` และ `Cancelled` นอกจากนี้มี SSE endpoint เตรียมไว้สำหรับแสดง Progress แบบ Real-time เมื่อปรับ UI รอบถัดไป

โมเดลที่เลือกได้ตอนนี้:

- YOLOv8n — `yolov8n.pt`
- YOLOv8s — `yolov8s.pt`
- YOLO11n / YOLO11s / YOLO11m
- YOLO26n — `yolo26n.pt`

หากเลือกหลาย Dataset ระบบจะสร้าง Training bundle ชั่วคราวให้เอง โดย:

- รวม Class ที่ชื่อเหมือนกันโดยไม่สนตัวพิมพ์เล็ก/ใหญ่
- รีแมปเลข Class ใน YOLO label ให้ตรงกับ `data.yaml` ชุดใหม่
- ใส่คำนำหน้าชื่อรูปและ Label เพื่อป้องกันชื่อไฟล์ชนกัน
- รักษา split `train`, `val` และ `test` ของ Dataset ต้นทาง
- ตัดรูปซ้ำที่อ้างถึงรูปต้นฉบับเดียวกันออก โดยเก็บข้อมูลจาก Dataset ที่เลือกก่อน

เมื่อ Train สำเร็จ ล้มเหลว หรือถูกยกเลิก Worker จะลบ `storage/worker-cache/<trainingJobId>` ออกจากเครื่อง Train ทันที ส่วน Server จะลบ Training bundle ชั่วคราวแต่ยังเก็บ Training log ไว้ตรวจสอบ

ก่อนเริ่ม Train สามารถตั้งชื่อโฟลเดอร์ผลลัพธ์ได้ เช่น `ตรวจจับรถ-v1` จากนั้นหน้า **โมเดล** จะดาวน์โหลดเป็น `ตรวจจับรถ-v1.zip` โดยจัดโครงสร้างให้คล้ายผลลัพธ์ Ultralytics:

```text
ตรวจจับรถ-v1/
  weights/
    best.pt
    last.pt
  results/
    results.csv
    metrics.json
  args.yaml
  model-info.json
  README.txt
```

ไฟล์ `best.pt` และ `last.pt` ใน ZIP เป็น PyTorch checkpoint จริง สามารถนำไปเปิดด้วย Ultralytics หรือย้ายไป Predict/Train ต่อที่เครื่องอื่นได้ สำหรับงานเก่าที่สร้างด้วย Simulation ZIP จะไม่มีไฟล์ `.pt` และมี `simulation-summary.json` แทน

### เปิด Web และ Worker บนเครื่องเดียวกัน

เตรียมโปรแกรม Train ครั้งแรกหนึ่งครั้ง:

```bash
yarn worker:setup
```

เปิด Terminal แรกแล้วรันเว็บ:

```bash
yarn dev
```

เปิด Terminal ที่สองในโฟลเดอร์โปรเจกต์เดียวกัน:

```bash
yarn worker
```

เมื่อเห็น `โหมด Real` และข้อความว่า Worker เชื่อมต่อแล้ว ให้เปิดเมนู **Train โมเดล** เลือก Dataset และ Worker จากนั้นกด **เริ่ม Train** หากเครื่องไม่มี NVIDIA จะ Train ด้วย CPU ซึ่งใช้งานได้จริงแต่ช้ากว่า GPU หากพอร์ต `3000` ถูกใช้อยู่และ Next.js เลื่อนไป `3001` หรือพอร์ตถัดไป Worker จะค้นหาพอร์ต Web API ใหม่ให้อัตโนมัติ

> เปิด `yarn dev` เพียง Terminal เดียวต่อโปรเจกต์ เพราะ Next.js หลายตัวที่ใช้โฟลเดอร์ `.next` เดียวกันจะทำให้ cache ชนกันและ API อาจตอบ 404

เปิด `yarn worker` เพียง Terminal เดียวต่อ `WORKER_KEY` เช่นกัน ระบบมีไฟล์ Lock ป้องกันการเปิดซ้ำ เพราะ Worker สองตัวที่ใช้ Key เดียวกันอาจแย่งรับ Training job เดียวกัน หากเปิดซ้ำจะมีข้อความบอก PID ของ Terminal เดิมและโปรแกรมตัวใหม่จะหยุดทันที

### ใช้เครื่อง A สั่งให้เครื่อง B ทำงานผ่าน Tailscale

เครื่อง A คือเครื่องที่เปิดเว็บและเก็บ Dataset ส่วนเครื่อง B คือเครื่องที่รัน Worker ทั้งสองเครื่องต้องอยู่ใน Tailnet เดียวกัน

ที่เครื่อง A กำหนด Token ใน `.env` แล้วเปิดเว็บ:

```env
WORKER_API_TOKEN="ตั้ง-token-ยาวๆ-ที่เดายาก"
```

ที่เครื่อง B ติดตั้ง Node.js 20.9+, Corepack, Yarn, Python 3.10+ และ `python3-venv` แล้วนำโปรเจกต์ชุดเดียวกันมาไว้ในเครื่อง จากนั้นสร้าง `.env` โดยใช้ Tailscale IP หรือ MagicDNS ของเครื่อง A:

```env
WORKER_SERVER_URL="http://100.x.y.z:3000"
WORKER_API_TOKEN="ตั้ง-token-เดียวกับเครื่อง-A"
WORKER_KEY="training-pc-02"
WORKER_DATA_DIR="./storage/worker-cache"
WORKER_MODE="real"
WORKER_PYTHON=".venv/bin/python"
```

ติดตั้งและเปิด Worker ที่เครื่อง B:

```bash
corepack enable
yarn install
yarn worker:setup
yarn worker
```

หากเครื่อง B มี NVIDIA GPU ให้ติดตั้ง Driver จนคำสั่ง `nvidia-smi` ทำงานได้ แล้วเลือกคำสั่งติดตั้ง PyTorch ที่ตรงกับ CUDA ของเครื่องจากหน้า [PyTorch Get Started](https://pytorch.org/get-started/locally/) หากต้องกำหนด Wheel index เองให้รัน เช่น:

```bash
WORKER_TORCH_INDEX_URL="URL-จากหน้า-PyTorch" yarn worker:setup
```

ตรวจว่า PyTorch เห็น GPU:

```bash
.venv/bin/python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
```

กลับมาที่หน้า **Train โมเดล** บนเครื่อง A จะเห็นชื่อเครื่อง B พร้อม CPU, RAM, GPU/VRAM (หากมี NVIDIA และคำสั่ง `nvidia-smi`) และสถานะ Heartbeat จากนั้นเครื่อง A สามารถเลือก Dataset แล้วส่ง Job ให้เครื่อง B ได้

ครั้งต่อไปที่เปิดเครื่อง B ให้เปิด Tailscale ก่อน แล้วเปิด Terminal รัน:

```bash
cd /ตำแหน่ง/internal-vision-platform
yarn worker
```

ต้องเปิด Terminal นี้ค้างไว้ระหว่างรอรับงาน หากปิด Terminal หรือกด `Ctrl + C` เครื่อง B จะกลายเป็น Offline ในหน้าเว็บภายในประมาณ 30 วินาที

ข้อสำคัญ:

- ห้ามตั้ง `WORKER_SERVER_URL` เป็น `localhost` บนเครื่อง B เพราะจะหมายถึงเครื่อง B เอง
- `WORKER_API_TOKEN` ของ A และ B ต้องตรงกัน
- `WORKER_KEY` ของแต่ละเครื่องต้องไม่ซ้ำกัน
- ต้องให้ Firewall ของเครื่อง A รับการเชื่อมต่อผ่านพอร์ตที่เว็บกำลังรัน
- เครื่อง B จะลองพอร์ตเริ่มต้นและพอร์ตถัดไปตาม `WORKER_DISCOVERY_PORT_COUNT` หาก Web เปลี่ยนจาก 3000 เป็น 3001 เป็นต้น
- Dataset ต้นฉบับยังอยู่เครื่อง A; เครื่อง B ได้เฉพาะ Training bundle ชั่วคราว และจะลบทิ้งหลังงานจบ ล้มเหลว หรือถูกยกเลิก
- ไฟล์ Model ที่ Train เสร็จจะถูกส่งกลับและเก็บที่เครื่อง A ก่อนที่ Cache เครื่อง B จะถูกลบ

## ข้อมูลถูกเก็บไว้ที่ไหน

- Database: `prisma/dev.db`
- รูปต้นฉบับและ Thumbnail: `storage/accounts/account_mo/projects/<projectId>/`
- Dataset ที่ Generate แล้ว: `storage/accounts/account_mo/datasets/<datasetVersionId>/`
- Training log: `storage/training/<trainingJobId>/logs/training.log`
- Dataset cache ของ Worker: `storage/worker-cache/<trainingJobId>/dataset.zip`
- Model ที่ Worker ส่งกลับ: `storage/models/<projectId>/<trainingJobId>/`
- โครงสร้าง Database และ Migration: `prisma/`

ระบบเก็บไฟล์รูปไว้บน Server และเก็บเฉพาะข้อมูลกับตำแหน่งไฟล์ใน Database ไม่ได้เก็บรูปเป็น Base64

ตอนนี้ Storage เป็นพื้นที่บนเครื่องหรือไดรฟ์ที่ mount เข้ากับ Server ยังไม่ได้เชื่อม S3 หรือ Google Drive โดยตรง

## คำสั่งที่ใช้บ่อย

```bash
yarn dev          # เปิดเว็บสำหรับพัฒนา
yarn typecheck    # ตรวจ TypeScript
yarn lint         # ตรวจรูปแบบและปัญหาในโค้ด
yarn build        # สร้าง Production build
yarn db:deploy    # ติดตั้ง Migration ที่มีอยู่
yarn db:migrate   # สร้าง Migration ใหม่ระหว่างพัฒนา
yarn db:studio    # เปิดหน้าดูข้อมูลใน Database
yarn worker:setup # ติดตั้ง PyTorch และ Ultralytics สำหรับ Worker
yarn worker       # เปิด Training Worker แบบ Real mode
```

## แก้ปัญหาเบื้องต้น

### ขึ้น `node: command not found`

ถ้าติดตั้ง Node ผ่าน nvm แล้ว ให้เปิด Terminal ใหม่ หรือลอง:

```bash
source ~/.bashrc
nvm use 22
node -v
```

### ขึ้น `yarn: command not found`

โปรเจกต์ใช้ Yarn ผ่าน Corepack ไม่ต้องติดตั้ง Yarn แบบ Global ให้รัน:

```bash
corepack enable
corepack prepare yarn@4.18.0 --activate
yarn --version
```

จากนั้นติดตั้งแพ็กเกจด้วย `yarn install` และอย่าใช้ตัวจัดการแพ็กเกจอื่นปะปน เพราะโปรเจกต์ใช้ `yarn.lock` เป็นไฟล์ล็อกเพียงชุดเดียว

### หน้าเว็บค้างหรือขึ้น Error หลังแก้โค้ด

หยุดเว็บด้วย `Ctrl + C` ล้าง Next.js cache แล้วเปิดใหม่:

```bash
rm -rf apps/web/.next
yarn dev
```

จากนั้นกด `Ctrl + Shift + R` ใน Browser เพื่อรีเฟรชแบบไม่ใช้ cache

### มือถือเปิด QR Code ไม่ได้

ตรวจสอบว่า:

- มือถือกับคอมอยู่เครือข่ายเดียวกัน
- ให้เปิดเว็บด้วย URL ที่มือถือเข้าถึงได้; หาก server เห็น request เป็น `localhost` ให้ตั้ง `PUBLIC_APP_URL`
- Firewall อนุญาตพอร์ต 3000
- เปิดเว็บใหม่หลังแก้ `.env` (เฉพาะกรณีที่ตั้ง fallback)

## เทคโนโลยีหลัก

- Next.js, React และ TypeScript
- Tailwind CSS และ Lucide Icons
- Konva / React Konva สำหรับหน้า Annotation
- Prisma ORM และ SQLite
- Sharp สำหรับตรวจรูปและสร้าง Thumbnail
- Zod สำหรับตรวจข้อมูลจาก API
- Python, PyTorch และ Ultralytics สำหรับ Train โมเดลจริง

ออกแบบ Database ให้สามารถเปลี่ยนไปใช้ PostgreSQL ได้ในอนาคต

## งานลำดับถัดไป

- ทดสอบภาคสนามกับ NVIDIA GPU Worker หลายเครื่องพร้อมกัน
- เพิ่มระบบล็อกอินและสิทธิ์ก่อนเปิดใช้นอกเครือข่ายส่วนตัว
- ย้าย Database เป็น PostgreSQL และ Storage เป็น S3-compatible เมื่อข้อมูลมีขนาดใหญ่
- เพิ่มหน้า Predict/ทดสอบโมเดลจาก `best.pt` ในเว็บ

ดูรายละเอียดเพิ่มเติมได้ที่ [Architecture](docs/architecture.md) และ [Development roadmap](docs/roadmap.md)
