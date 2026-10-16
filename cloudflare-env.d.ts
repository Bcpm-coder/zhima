declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    LLM_API_URL?: string;
    LLM_API_KEY?: string;
    LLM_MODEL?: string;
    BUCKET?: R2Bucket;
  }
}
