import { currentUser } from "@/lib/auth";
import { getTrainingJob } from "@/server/services/training.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { jobId } = await params;
  const initialJob = await getTrainingJob(jobId, user.id);
  if (!initialJob) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let lastVersion = "";
  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        if (closed) return;
        const job = await getTrainingJob(jobId, user.id).catch(() => null);
        if (!job) return;
        const version = `${job.updatedAt}:${job.logs.at(-1)?.id || ""}`;
        if (version === lastVersion) return;
        lastVersion = version;
        controller.enqueue(encoder.encode(`event: job\ndata: ${JSON.stringify(job)}\n\n`));
      };
      await push();
      timer = setInterval(() => void push(), 1_000);
      request.signal.addEventListener("abort", () => {
        closed = true;
        if (timer) clearInterval(timer);
        controller.close();
      }, { once: true });
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
