export interface WordpressContentFreshness {
  lastPostDate: string | null;
  lastPostTitle: string | null;
  daysSinceLastPost: number | null;
  isStale: boolean;
}

export async function probeWordpressContentFreshness(
  siteUrl: string,
  staleThresholdDays = 60,
): Promise<WordpressContentFreshness | null> {
  const cleanUrl = siteUrl.replace(/\/+$/, "");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${cleanUrl}/wp-json/wp/v2/posts?per_page=1&_fields=id,date,title`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Guardian-Content-Probe/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const posts = await res.json();
      if (Array.isArray(posts) && posts.length > 0) {
        const post = posts[0];
        const postDate = post.date ? new Date(post.date).toISOString() : null;
        const postTitle = post.title?.rendered ? String(post.title.rendered).replace(/<[^>]+>/g, "") : "Untitled Post";

        if (postDate) {
          const days = Math.max(0, Math.floor((Date.now() - Date.parse(postDate)) / (1000 * 60 * 60 * 24)));
          return {
            lastPostDate: postDate,
            lastPostTitle: postTitle,
            daysSinceLastPost: days,
            isStale: days > staleThresholdDays,
          };
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return null;
}

