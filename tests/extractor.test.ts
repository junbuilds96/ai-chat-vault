import { describe, expect, it } from "vitest";
import { collectMessages, extractTitle } from "../src/extractor";
import { conversationToMarkdown, markdownFilename } from "../src/markdown";

describe("conversation extraction", () => {
  it("collects ChatGPT role-tagged messages in order", () => {
    document.body.innerHTML = `
      <main>
        <article data-message-author-role="user">How do I export this?</article>
        <article data-message-author-role="assistant">
          <p>Use Markdown.</p>
          <button>Copy code</button>
        </article>
      </main>
    `;

    expect(collectMessages(document)).toEqual([
      { speaker: "user", text: "How do I export this?" },
      { speaker: "assistant", text: "Use Markdown." }
    ]);
  });

  it("wraps preformatted blocks as fenced Markdown", () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant">
        <p>Run this:</p>
        <pre>npm test</pre>
      </article>
    `;

    expect(collectMessages(document)[0].text).toContain("```\nnpm test\n```");
  });

  it("falls back to a default title", () => {
    document.title = "";
    document.body.innerHTML = "";

    expect(extractTitle(document)).toBe("ChatGPT Conversation");
  });
});

describe("Markdown output", () => {
  it("renders metadata and speaker sections", () => {
    const markdown = conversationToMarkdown({
      title: "Export Notes",
      url: "https://chatgpt.com/c/abc",
      exportedAt: "2026-05-31T00:00:00.000Z",
      messages: [
        { speaker: "user", text: "Question" },
        { speaker: "assistant", text: "Answer" }
      ]
    });

    expect(markdown).toContain("# Export Notes");
    expect(markdown).toContain("- Source: https://chatgpt.com/c/abc");
    expect(markdown).toContain("## User\n\nQuestion");
    expect(markdown).toContain("## Assistant\n\nAnswer");
  });

  it("creates a stable filename from the conversation title", () => {
    expect(markdownFilename("My Chat: Export!", new Date("2026-05-31T12:00:00Z"))).toBe(
      "my-chat-export-2026-05-31.md"
    );
  });
});
