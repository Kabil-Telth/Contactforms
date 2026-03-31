import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const rateLimits = {
  // 2 requests per 1 minute per IP
  perMinute: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2, "1 m"),  // 2 req / 1min
    prefix: "rl:minute",                          // redis key prefix
  }),

  // 3 requests per 5 minutes per IP
  per5Minutes: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "5 m"),  // 3 req / 5min
    prefix: "rl:5minute",                         // separate prefix
  }),
}