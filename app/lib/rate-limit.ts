type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const bucket = buckets.get(input.key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { allowed: true, remaining: input.limit - 1, resetAt: now + input.windowMs };
  }

  if (bucket.count >= input.limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: input.limit - bucket.count, resetAt: bucket.resetAt };
}

export function getClientKey(request: Request, contributorId?: string | null) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor || realIp || "unknown-ip";
  return `${ip}:${contributorId || "anonymous"}`;
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
