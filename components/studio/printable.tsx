"use client";
import type { Task } from "@/lib/studio/model";
export function Printable({ task }: { task: Task }) {
  return (
    <div className="v3-print-root">
      <div className="v3-print-toolbar">
        <button className="v3-secondary" onClick={() => window.print()}>
          打印 / 另存为 PDF
        </button>
        <p>
          仅包含作答说明、故事、题目及四选项，不显示构念标签、计分键或模型评分。
        </p>
      </div>
      <div className="v3-print-document">
        <h1>{task.name}</h1>
        <p>{task.input.instruction}</p>
        {task.run?.story.segments.map((segment) => (
          <section key={segment.event_id}>
            <p>{segment.text}</p>
            {task.run?.items
              .filter((i) => i.event_id === segment.event_id)
              .map((item) => (
                <article key={item.item_id}>
                  <h3>
                    {(task.run?.items.findIndex(
                      (i) => i.item_id === item.item_id,
                    ) ?? 0) + 1}
                    . {item.stem}
                  </h3>
                  {item.options.map((o, n) => (
                    <p key={o.option_id}>
                      {String.fromCharCode(65 + n)}. {o.text}
                    </p>
                  ))}
                </article>
              ))}
          </section>
        ))}
        <footer>
          材料版本 r{task.revision} · {task.id}
        </footer>
      </div>
    </div>
  );
}
