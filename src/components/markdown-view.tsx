import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { copyText } from "@/lib/actions";

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return nodeText(props.children);
  }
  return "";
}

function CodeFrame({ children }: { children: ReactNode }) {
  const child = Array.isArray(children) ? children[0] : children;
  let lang = "text";
  let text = "";
  if (isValidElement(child)) {
    const props = child.props as { className?: string; children?: ReactNode };
    lang = /language-([\w+-]+)/.exec(props.className || "")?.[1] || "text";
    text = nodeText(props.children).replace(/\n$/, "");
  } else {
    text = nodeText(children).replace(/\n$/, "");
  }
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-frame">
      <div className="code-top">
        <span>{lang}</span>
        <button
          type="button"
          className="btn btn-ghost min-h-8 rounded-full px-3 text-xs"
          onClick={() => {
            void copyText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? "Готово" : "Копировать"}
        </button>
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}

export function MarkdownView({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const safe = href && /^(https?:|mailto:)/i.test(href) ? href : undefined;
            return (
              <a href={safe} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            );
          },
          img({ src, alt }) {
            if (!src || !/^https:\/\//i.test(src)) return null;
            return <img src={src} alt={alt || ""} className="md-img" />;
          },
          code({ className, children }) {
            if (className) return <code className={className}>{children}</code>;
            return <code className="inline-code">{children}</code>;
          },
          pre({ children }) {
            return <CodeFrame>{children}</CodeFrame>;
          },
          table({ children }) {
            return (
              <div className="table-scroll">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
