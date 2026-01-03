export function extractVideoId(input: string): string | null {
  try {
    // 1) 그냥 id만 넣는 경우
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

    const url = new URL(input);

    // https://www.youtube.com/watch?v=xxxx
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // https://youtu.be/xxxx
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "");
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // https://www.youtube.com/shorts/xxxx
    const parts = url.pathname.split("/").filter(Boolean);
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) {
      const id = parts[shortsIdx + 1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // https://www.youtube.com/embed/xxxx
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) {
      const id = parts[embedIdx + 1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    return null;
  } catch {
    return null;
  }
}
