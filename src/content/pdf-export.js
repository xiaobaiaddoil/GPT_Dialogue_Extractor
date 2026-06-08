"use strict";
// @ts-nocheck
(function () {
    if (window.__chatgptExporterPdfExportLoaded) {
        return;
    }
    window.__chatgptExporterPdfExportLoaded = true;
    function normalizeWhitespace(value) {
        return value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    }
    function bytesToBinaryString(bytes) {
        let binary = "";
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
            const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
            binary += String.fromCharCode(...chunk);
        }
        return binary;
    }
    function binaryStringToUint8Array(binary) {
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index) & 0xff;
        }
        return bytes;
    }
    function bytesToBase64(bytes) {
        return btoa(bytesToBinaryString(bytes));
    }
    function dataUrlToBytes(dataUrl) {
        const base64Marker = "base64,";
        const markerIndex = dataUrl.indexOf(base64Marker);
        if (markerIndex === -1) {
            throw new Error("无法读取页面图像数据。");
        }
        const base64 = dataUrl.slice(markerIndex + base64Marker.length);
        const binary = atob(base64);
        return binaryStringToUint8Array(binary);
    }
    function wrapCanvasText(context, text, maxWidth) {
        if (!text) {
            return [""];
        }
        const lines = [];
        let current = "";
        for (const char of text) {
            const next = current + char;
            if (current && context.measureText(next).width > maxWidth) {
                lines.push(current);
                current = char;
            }
            else {
                current = next;
            }
        }
        if (current || !lines.length) {
            lines.push(current);
        }
        return lines;
    }
    function toRenderableBlocks(body) {
        const source = normalizeWhitespace(body || "").replace(/\r\n/g, "\n");
        const lines = source.split("\n");
        const blocks = [];
        let inCode = false;
        let buffer = [];
        const pushText = () => {
            if (!buffer.length) {
                return;
            }
            blocks.push({
                type: "text",
                lines: buffer.slice(),
            });
            buffer = [];
        };
        const pushCode = () => {
            blocks.push({
                type: "code",
                lines: buffer.slice(),
            });
            buffer = [];
        };
        lines.forEach((line) => {
            if (/^```/.test(line.trim())) {
                if (inCode) {
                    pushCode();
                    inCode = false;
                    return;
                }
                pushText();
                inCode = true;
                buffer = [];
                return;
            }
            buffer.push(line);
        });
        if (buffer.length) {
            if (inCode) {
                pushCode();
            }
            else {
                pushText();
            }
        }
        if (!blocks.length) {
            blocks.push({
                type: "text",
                lines: [source],
            });
        }
        return blocks;
    }
    function getMessageDisplayName(message) {
        return `${message.role === "user" ? "user" : message.assistantLabel || "gpt"}${message.index}`;
    }
    function renderConversationPdfPages(conversation) {
        const pageWidth = 1240;
        const pageHeight = 1754;
        const marginX = 84;
        const marginTop = 92;
        const marginBottom = 92;
        const contentWidth = pageWidth - marginX * 2;
        const pages = [];
        let canvas = null;
        let context = null;
        let y = marginTop;
        const startPage = () => {
            canvas = document.createElement("canvas");
            canvas.width = pageWidth;
            canvas.height = pageHeight;
            context = canvas.getContext("2d");
            if (!context) {
                throw new Error("无法创建 PDF 画布。");
            }
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, pageWidth, pageHeight);
            context.textBaseline = "top";
            y = marginTop;
            pages.push(canvas);
        };
        const ensureSpace = (height) => {
            if (!canvas || !context) {
                startPage();
            }
            if (y + height <= pageHeight - marginBottom) {
                return;
            }
            startPage();
        };
        const drawWrappedLines = (lines, options) => {
            const font = options.font;
            const lineHeight = options.lineHeight;
            const color = options.color;
            const background = options.background || "";
            const insetX = options.insetX || 0;
            const radius = options.radius || 0;
            context.font = font;
            context.fillStyle = color;
            lines.forEach((line) => {
                const wrapped = wrapCanvasText(context, line || " ", contentWidth - insetX * 2);
                wrapped.forEach((wrappedLine) => {
                    ensureSpace(lineHeight + (background ? 8 : 0));
                    if (background) {
                        context.fillStyle = background;
                        if (radius > 0 && typeof context.roundRect === "function") {
                            context.beginPath();
                            context.roundRect(marginX, y - 2, contentWidth, lineHeight + 8, radius);
                            context.fill();
                        }
                        else {
                            context.fillRect(marginX, y - 2, contentWidth, lineHeight + 8);
                        }
                        context.fillStyle = color;
                    }
                    context.fillText(wrappedLine, marginX + insetX, y + (background ? 2 : 0));
                    y += lineHeight + (background ? 8 : 0);
                });
            });
        };
        startPage();
        context.font = '700 30px "Segoe UI", "Microsoft YaHei", sans-serif';
        context.fillStyle = "#0f172a";
        drawWrappedLines([conversation.metadata.title], {
            font: '700 30px "Segoe UI", "Microsoft YaHei", sans-serif',
            lineHeight: 42,
            color: "#0f172a",
        });
        y += 10;
        drawWrappedLines([
            `Exported At: ${conversation.metadata.exportedAt}`,
            `Source: ${conversation.metadata.url}`,
            `Message Count: ${conversation.metadata.messageCount}`,
        ], {
            font: '400 18px "Segoe UI", "Microsoft YaHei", sans-serif',
            lineHeight: 28,
            color: "#475569",
        });
        y += 16;
        conversation.messages.forEach((message) => {
            ensureSpace(54);
            context.font = '700 20px "Segoe UI", "Microsoft YaHei", sans-serif';
            context.fillStyle = message.role === "user" ? "#2563eb" : "#0f172a";
            context.fillText(getMessageDisplayName(message), marginX, y);
            y += 32;
            const blocks = toRenderableBlocks(message.role === "assistant" ? message.markdown : message.text);
            blocks.forEach((block, blockIndex) => {
                if (block.type === "code") {
                    drawWrappedLines(block.lines.length ? block.lines : [""], {
                        font: '400 18px "Cascadia Code", "Consolas", monospace',
                        lineHeight: 24,
                        color: "#0f172a",
                        background: "#f8fafc",
                        insetX: 14,
                        radius: 14,
                    });
                }
                else {
                    block.lines.forEach((line, lineIndex) => {
                        if (!line.trim()) {
                            y += 12;
                            return;
                        }
                        drawWrappedLines([line], {
                            font: '400 20px "Segoe UI", "Microsoft YaHei", sans-serif',
                            lineHeight: 30,
                            color: "#111827",
                        });
                        if (lineIndex < block.lines.length - 1) {
                            y += 2;
                        }
                    });
                }
                if (blockIndex < blocks.length - 1) {
                    y += 10;
                }
            });
            y += 24;
        });
        return pages.map((pageCanvas) => ({
            width: pageCanvas.width,
            height: pageCanvas.height,
            bytes: dataUrlToBytes(pageCanvas.toDataURL("image/jpeg", 0.9)),
        }));
    }
    function buildPdfFromImages(images) {
        if (!images.length) {
            throw new Error("没有可写入 PDF 的页面。");
        }
        const objects = [null, null];
        const pageIds = [];
        images.forEach((image, index) => {
            const imageBinary = bytesToBinaryString(image.bytes);
            const imageObjectId = objects.push(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n${imageBinary}\nendstream`);
            const imageName = `Im${index + 1}`;
            const contentStream = `q\n${image.width} 0 0 ${image.height} 0 0 cm\n/${imageName} Do\nQ\n`;
            const contentObjectId = objects.push(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream`);
            const pageObjectId = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${image.width} ${image.height}] /Resources << /XObject << /${imageName} ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
            pageIds.push(pageObjectId);
        });
        objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
        objects[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
        let output = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
        const offsets = [0];
        objects.forEach((body, index) => {
            offsets[index + 1] = output.length;
            output += `${index + 1} 0 obj\n${body}\nendobj\n`;
        });
        const xrefOffset = output.length;
        output += `xref\n0 ${objects.length + 1}\n`;
        output += "0000000000 65535 f \n";
        for (let index = 1; index <= objects.length; index += 1) {
            output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
        }
        output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        return binaryStringToUint8Array(output);
    }
    function buildConversationPdfDataUrl(conversation) {
        const pages = renderConversationPdfPages(conversation);
        const pdfBytes = buildPdfFromImages(pages);
        return `data:application/pdf;base64,${bytesToBase64(pdfBytes)}`;
    }
    window.ChatGPTExporterPdfExport = {
        buildConversationPdfDataUrl,
    };
})();
