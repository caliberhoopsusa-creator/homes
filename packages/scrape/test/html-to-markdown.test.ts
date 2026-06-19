import { describe, it, expect } from "vitest";
import { htmlToMarkdown, extractTitle } from "../src/html-to-markdown.js";

const PAGE = `
<!doctype html>
<html>
  <head><title>  123 Main St &amp; Co  </title><style>.x{color:red}</style></head>
  <body>
    <nav><a href="/home">home</a></nav>
    <script>analytics()</script>
    <main>
      <h1>Property Record</h1>
      <p>Owner: Jane &amp; John</p>
      <ul><li>Tax delinquent</li><li>Vacant</li></ul>
      <a href="https://county.example.gov/p/1">View parcel</a>
    </main>
    <footer>copyright</footer>
  </body>
</html>`;

describe("htmlToMarkdown", () => {
  it("extracts and trims the title, decoding entities", () => {
    expect(extractTitle(PAGE)).toBe("123 Main St & Co");
  });

  it("strips scripts, styles, nav and footer", () => {
    const md = htmlToMarkdown(PAGE);
    expect(md).not.toMatch(/analytics/);
    expect(md).not.toMatch(/color:red/);
    expect(md).not.toMatch(/copyright/);
    expect(md).not.toMatch(/>home</);
  });

  it("keeps headings, list items and link targets from main content", () => {
    const md = htmlToMarkdown(PAGE);
    expect(md).toMatch(/# Property Record/);
    expect(md).toMatch(/- Tax delinquent/);
    expect(md).toMatch(/\[View parcel\]\(https:\/\/county\.example\.gov\/p\/1\)/);
    expect(md).toMatch(/Owner: Jane & John/);
  });

  it("falls back to body when there is no main/article", () => {
    const md = htmlToMarkdown("<body><p>hello world</p></body>");
    expect(md).toBe("hello world");
  });
});
