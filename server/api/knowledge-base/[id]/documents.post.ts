import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { prisma } from "~/server/utils/db";
import { processDocument } from "~/server/services/knowledgeBase";

export default defineEventHandler(async (event) => {
  const knowledgeBaseId = event.context.params?.id;
  if (!knowledgeBaseId) {
    throw createError({ statusCode: 400, message: "知识库 ID 缺失" });
  }

  const formData = await readMultipartFormData(event);
  const file = formData?.[0];
  if (!file?.data) {
    throw createError({ statusCode: 400, message: "请上传文件" });
  }

  const fileName = file.filename || "unknown";
  const ext = (fileName.split(".").pop() || "txt").toLowerCase();
  let text = "";
  try {
    if (ext === "pdf") {
      const parser = new PDFParse({ data: file.data });
      const parsed = await parser.getText();
      text = parsed.text || "";
      await parser.destroy();
    } else if (ext === "docx") {
      const parsed = await mammoth.extractRawText({ buffer: file.data });
      text = parsed.value || "";
    } else if (ext === "txt" || ext === "md") {
      text = file.data.toString("utf-8");
    } else {
      throw new Error(`不支持的文件类型: ${ext}`);
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: `文件解析失败: ${error instanceof Error ? error.message : "未知错误"}`,
    });
  }

  const document = await prisma.document.create({
    data: {
      knowledgeBaseId,
      name: fileName,
      originalName: fileName,
      format: ext,
      size: file.data.length,
      status: "uploading",
    },
  });

  processDocument(knowledgeBaseId, document.id, text, fileName).catch(
    async (error) => {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "文档处理失败",
        },
      });
    },
  );

  return {
    id: document.id,
    message: "文档上传成功，正在处理中",
  };
});
