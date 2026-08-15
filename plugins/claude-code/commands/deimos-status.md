---
description: 查看 Deimos 任务队列与进展
allowed-tools: mcp__deimos__list_my_jobs
---

调用 list_my_jobs 获取任务队列，按以下要点汇总给用户：

- 每个任务：想法标题、状态（待处理/实现中/已完成/未成）、最近一条进展
- 有 pending_question 的任务重点标出：「等你回答」+ 问题内容
- 已完成的任务附带 repo_url 与完成摘要
- 队列尾部给出建议：有待处理任务时可提示运行 /deimos-work 领取
