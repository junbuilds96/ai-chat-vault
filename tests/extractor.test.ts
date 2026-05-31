import { describe, expect, it } from "vitest";
import { collectMessages, extractTitle } from "../src/extractor";
import { conversationToMarkdown, markdownFilename } from "../src/markdown";
import { allMessageIndexes, filterConversationMessages, shortMessagePreview } from "../src/selection";

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

  it("preserves ChatGPT rich Markdown content without copy UI text", () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant">
        <div class="markdown">
          <p>Read the <a href="https://example.com/docs">docs</a>.</p>
          <blockquote>
            <p>Use the stable API.</p>
          </blockquote>
          <table>
            <thead>
              <tr><th>Name</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>Alpha</td><td>A | B</td></tr>
            </tbody>
          </table>
          <button>Copy</button>
          <span hidden>Copied</span>
        </div>
      </article>
    `;

    expect(collectMessages(document)[0].text).toBe(
      [
        "Read the [docs](https://example.com/docs).",
        "",
        "> Use the stable API.",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| Alpha | A \\| B |"
      ].join("\n")
    );
  });

  it("preserves ordered and unordered list markers without hidden or button text", () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant">
        <div class="markdown">
          <ol>
            <li>First</li>
            <li>Second with <code>x</code></li>
          </ol>
          <ul>
            <li>Bullet</li>
          </ul>
          <button>Copy</button>
          <span hidden>Copied</span>
        </div>
      </article>
    `;

    expect(collectMessages(document)[0].text).toBe(
      ["1. First", "2. Second with x", "- Bullet"].join("\n")
    );
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

  it("keeps Chinese title text in generated filenames", () => {
    expect(markdownFilename("中文标题", new Date("2026-05-31T12:00:00Z"))).toBe(
      "中文标题-2026-05-31.md"
    );
  });

  it("keeps words and numbers while replacing mixed emoji and punctuation with hyphens", () => {
    expect(markdownFilename("Launch 🚀 Plan #42!!!", new Date("2026-05-31T12:00:00Z"))).toBe(
      "launch-plan-42-2026-05-31.md"
    );
  });

  it("removes unsafe path characters from generated filename slugs", () => {
    const filename = markdownFilename('bad/name\\thing:*?"<>| done', new Date("2026-05-31T12:00:00Z"));
    const slug = filename.replace("-2026-05-31.md", "");

    expect(slug).not.toMatch(/[<>:"/\\|?*]/);
    expect(filename).toBe("bad-name-thing-done-2026-05-31.md");
  });
});

describe("message selection", () => {
  const conversation = {
    title: "Export Notes",
    url: "https://chatgpt.com/c/abc",
    exportedAt: "2026-05-31T00:00:00.000Z",
    messages: [
      { speaker: "user" as const, text: "Question" },
      { speaker: "assistant" as const, text: "Answer" },
      { speaker: "user" as const, text: "Follow-up" }
    ]
  };

  it("selects every detected message by default", () => {
    expect([...allMessageIndexes(3)]).toEqual([0, 1, 2]);
  });

  it("filters exported messages by checked message index", () => {
    expect(filterConversationMessages(conversation, new Set([0, 2, 99, 2]))).toEqual({
      ...conversation,
      messages: [
        { speaker: "user", text: "Question" },
        { speaker: "user", text: "Follow-up" }
      ]
    });
  });

  it("keeps selected-message Markdown scoped to checked messages", () => {
    const markdown = conversationToMarkdown(filterConversationMessages(conversation, [1]));

    expect(markdown).not.toContain("## User\n\nQuestion");
    expect(markdown).toContain("## Assistant\n\nAnswer");
    expect(markdown).not.toContain("Follow-up");
  });

  it("renders compact one-line message previews", () => {
    expect(
      shortMessagePreview(
        {
          speaker: "assistant",
          text: "First line\n\nSecond line with enough text to truncate cleanly"
        },
        24
      )
    ).toBe("First line Second...");
  });
});
