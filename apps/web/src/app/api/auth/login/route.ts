import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { authenticateCredentials, createSession } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = await authenticateCredentials(input.username, input.password);
    if (!user) return apiError("INVALID_CREDENTIALS", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
    await createSession(user.id);
    return apiSuccess({ user });
  } catch (error) {
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", "กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน", 422, error.flatten().fieldErrors);
    return apiError("LOGIN_FAILED", "ยังไม่สามารถเข้าสู่ระบบได้ในขณะนี้", 500);
  }
}
