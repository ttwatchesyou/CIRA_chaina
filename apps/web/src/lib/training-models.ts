export const TRAINING_MODELS = [
  { id: "yolov8n.pt", label: "YOLOv8n", description: "รุ่น Nano ของ YOLOv8 เร็วและใช้ทรัพยากรน้อย", defaultBatchSize: 16 },
  { id: "yolov8s.pt", label: "YOLOv8s", description: "รุ่น Small ของ YOLOv8 แม่นยำขึ้นและยัง Train ได้เร็ว", defaultBatchSize: 16 },
  { id: "yolo11n.pt", label: "YOLO11n", description: "เล็กและเร็ว เหมาะสำหรับทดลองระบบ", defaultBatchSize: 16 },
  { id: "yolo11s.pt", label: "YOLO11s", description: "สมดุลระหว่างความเร็วกับความแม่นยำ", defaultBatchSize: 16 },
  { id: "yolo11m.pt", label: "YOLO11m", description: "โมเดลใหญ่ขึ้น ต้องการ GPU และ VRAM มากขึ้น", defaultBatchSize: 8 },
  { id: "yolo26n.pt", label: "YOLO26n", description: "รุ่น Nano ของ YOLO26 สำหรับงานตรวจจับวัตถุ", defaultBatchSize: 16 },
] as const;

export const TRAINING_MODEL_IDS = TRAINING_MODELS.map((model) => model.id) as [string, ...string[]];
