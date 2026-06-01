import { describe, expect, it } from "vitest";
import { collectMessages } from "../src/extractor";
import { conversationToMarkdown } from "../src/markdown";

describe("real ChatGPT DOM extraction", () => {
  it("keeps current ChatGPT CodeMirror language labels as fenced code info strings", () => {
    document.body.innerHTML = `
      <main>
        <div data-message-author-role="user" dir="auto" class="text-message">
          <div class="user-message-bubble-color">
            <div class="whitespace-pre-wrap">For testing a Chrome extension, reply with exactly two short paragraphs and one JavaScript code block that prints &quot;AI Chat Vault test&quot;.</div>
          </div>
        </div>
        <div data-message-author-role="assistant" data-turn-start-message="true" dir="auto" class="text-message">
          <div class="markdown prose dark:prose-invert wrap-break-word w-full light markdown-new-styling">
            <p data-start="0" data-end="137">
              Here's the minimal Chrome-extension test snippet.
              <code data-start="50" data-end="65">console.log()</code>
              outputs a message to the console.
              <span data-testid="webpage-citation-pill">
                <a href="https://developer.mozilla.org/en-US/docs/Web/API/console/log_static?utm_source=chatgpt.com" target="_blank" rel="noopener">
                  <span>MDN Web Docs</span>
                </a>
              </span>
            </p>
            <pre class="overflow-visible! px-0!" data-start="139" data-end="191">
              <div class="relative w-full mt-4 mb-1">
                <div class="border border-token-border-light rounded-3xl">
                  <div class="sticky top-(--sticky-padding-top) z-2 select-none">
                    <div class="flex w-full items-center justify-between py-1.5 ps-4 pe-1.5 font-sans bg-token-bg-elevated-secondary">
                      <div class="flex max-w-[75%] min-w-0 cursor-default items-center text-sm font-medium justify-self-start text-token-text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon-sm"></svg>
                        JavaScript
                      </div>
                      <div class="flex flex-row items-center gap-0.5 justify-self-end">
                        <button type="button" aria-label="Copy">Copy</button>
                      </div>
                    </div>
                  </div>
                  <div class="relative">
                    <div class="relative z-0 flex max-w-full">
                      <div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 flex h-full w-full flex-col items-stretch">
                        <div class="cm-scroller">
                          <pre class="cm-content q9tKkq_readonly m-0"><code><span>console</span><span>.</span><span>log(</span><span>&quot;AI Chat Vault test&quot;</span><span>);</span></code></pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </pre>
            <p data-start="193" data-end="270">Use it in your extension script or DevTools console to confirm logging works.</p>
          </div>
        </div>
      </main>
    `;

    const messages = collectMessages(document);
    const markdown = conversationToMarkdown({
      title: "Chrome Extension Test",
      url: "https://chatgpt.com/c/sanitized",
      exportedAt: "2026-06-01T01:23:50.238Z",
      messages
    });

    expect(messages).toHaveLength(2);
    expect(markdown).toContain(
      '```javascript\nconsole.log("AI Chat Vault test");\n```'
    );
    expect(markdown).toContain(
      "[MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/console/log_static?utm_source=chatgpt.com)"
    );
    expect(markdown).not.toContain('JavaScriptconsole.log("AI Chat Vault test");');
    expect(markdown).not.toContain("Copy");
  });
});
