# Archived Snippets

These scripts are kept for provenance and reference but are no longer the recommended versions. They fall into two groups: snippets superseded by a newer version, and the research/probe scripts used to reverse-engineer the current Claude.ai and Google AI Studio exporters.

For the actively maintained snippets, see the [main README](../README.md).

## Superseded Versions

Replaced by a newer version that is listed in the main README.

| Snippet                                                   | Target Site | Superseded by                     | Description                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ----------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude.ai Chat Exporter - Transcript + Attachments v1** | Claude.ai   | Chat Exporter v6                  | Exports the full conversation as structured Markdown plus artifact files and images. Uses the File System Access API to write to a named folder, falling back to a JSZip download.                                                                                                                            |
| **Claude.ai Chat Exporter - Transcript + Attachments v2** | Claude.ai   | Chat Exporter v6                  | Extracts conversation data directly from React's internal state for richer structured output, including timestamps, tool use, citations, and artifact metadata.                                                                                                                                               |
| **Claude.ai Chat Exporter - Transcript + Attachments v3** | Claude.ai   | Chat Exporter v6                  | Full export suite producing `transcript.md`, images, artifact files (triggered via native Download buttons), an `organize.sh` merge script, and a `manifest.json` index of all exported content.                                                                                                              |
| **Claude.ai Chat Exporter - Transcript + Attachments v4** | Claude.ai   | Chat Exporter v6                  | Fiber-based artifact extraction — pulls artifact file content directly from React state (`message.content[].input.file_text`) instead of clicking Download buttons. Produces `transcript.md`, `artifacts/`, `images/`, and `manifest.json` in a single ZIP or folder.                                         |
| **Claude.ai Chat Exporter - Transcript + Attachments v5** | Claude.ai   | Chat Exporter v6                  | Config UI + enhanced extraction. Shows a settings popup on launch with toggleable features: system reminder stripping, antArtifact regex extraction, API-compatible JSON output, self-contained HTML viewer, resume/skip re-export, and storage method choice. Fetches model info from Claude's internal API. |
| **Web Page Inspector v1**                                 | General     | Web Page Inspector v2             | Earlier iteration of the page inspector, before the v2 export and expanded framework/security/accessibility coverage.                                                                                                                                                                                         |
| **YouTube Playback Speed Control v1**                     | YouTube     | YouTube Playback Speed Control v2 | Adds keyboard shortcuts (`Shift+>` / `Shift+<`) and a console helper `ss(rate)` to control video playback speed beyond YouTube's 2x cap. Displays a brief overlay when the speed changes. (v2 adds brightness control.)                                                                                       |

## Research & Probe Scripts (Claude.ai Exporter R&D)

The Claude.ai exporter was reverse-engineered through a sequence of DOM inspectors and network/fiber probes. They document how artifact content was located (it lives client-side at `message.content[].input.file_text`) and are preserved as the research trail behind the exporter.

| Snippet                                                 | Description                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Claude.ai Chat - DOM Inspector (chat page)**          | Inspects the chat page DOM structure and downloads a `.txt` report, mapping element layout to inform the transcript exporter.                                                                                                        |
| **Claude.ai Chat - Deep Inspector (3 Gaps)**            | Targeted deep inspector that fills three gaps from the initial inspection: assistant message inner structure (action bar, tool-use, markdown), file attachment/thumbnail structure, and artifact block structure.                    |
| **Claude.ai Chat - Artifact Download Probe**            | Instruments `fetch`, `XHR`, `createObjectURL`, anchor creation, and `Blob` constructor to capture download button behavior. Found that `setAttribute` monitoring and click handlers capture download params effectively.             |
| **Claude.ai Chat - React Fiber Probe**                  | Walks the React fiber tree upward from the Download button using four strategies. Found a global messages store (`v2e` component) but not artifact content — superseded by the URL/file-object probes, which found the correct path. |
| **Claude.ai Chat - Artifact API Probe**                 | Extracts `filepath`, `orgUuid`, `conversationUuid` from React fibers and hooks all network APIs. Proved the Download button triggers zero network requests — artifact content is already client-side.                                |
| **Claude.ai Chat - Artifact URL Probe**                 | Tests 10 API URL patterns (all 404) and RSC action endpoints (405/404). Key discovery: artifact content lives at `message.content[].input.file_text` in the fiber props — no API call needed.                                        |
| **Claude.ai Chat - Artifact File Object Content Probe** | Dumps the full `message` object from the React fiber. Mapped the complete schema: `content[]` is an array of typed blocks (`text`, `tool_use`, `tool_result`) with timestamps, citations, and full tool I/O.                         |

## Google AI Studio Inspectors

DOM inspectors used to map Google AI Studio's structure before building the exporters.

| Snippet                                             | Description                                                                                                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google AI Studio - DOM Inspector (library page)** | Inspects the Library page DOM structure and downloads a `.txt` report of custom elements, list/grid containers, prompt-entry candidates, scrollable areas, and content-area tree dumps. |
| **Google AI Studio - DOM Inspector (prompts page)** | Dumps the full HTML tree of chat turns on a conversation page, showing how headings, lists, paragraphs, code blocks, and thought panels are nested.                                     |
